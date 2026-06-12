import { Injectable } from '@nestjs/common';

const REPLICATE_BASE_URL = 'https://api.replicate.com/v1';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_POLL_TIMEOUT_MS = 300_000;

export type ReplicatePredictionStatus =
  | 'starting'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'canceled';

export interface ReplicatePrediction<O = unknown> {
  id: string;
  status: ReplicatePredictionStatus;
  output: O | null;
  error: string | null;
  logs?: string | null;
}

export interface ReplicateRunOptions {
  model: string;
  input: Record<string, unknown>;
  version?: string;
  pollIntervalMs?: number;
  pollTimeoutMs?: number;
}

@Injectable()
export class ReplicateProvider {
  private readonly versionCache = new Map<string, string>();

  async run<O = unknown>(opts: ReplicateRunOptions): Promise<O> {
    let version = opts.version;
    if (!version) {
      version = await this.getLatestVersion(opts.model);
    }
    const prediction = await this.createPrediction<O>({ ...opts, version });
    const final = await this.waitForCompletion<O>(prediction.id, {
      pollIntervalMs: opts.pollIntervalMs,
      pollTimeoutMs: opts.pollTimeoutMs,
    });

    if (final.status !== 'succeeded') {
      throw new Error(
        `Replicate prediction ${final.id} ${final.status}: ${final.error ?? 'unknown error'}`
      );
    }
    if (final.output === null || final.output === undefined) {
      throw new Error(`Replicate prediction ${final.id} returned no output`);
    }
    return final.output;
  }

  private async getLatestVersion(model: string): Promise<string> {
    const cached = this.versionCache.get(model);
    if (cached) return cached;

    const token = this.getApiToken();
    const response = await fetch(`${REPLICATE_BASE_URL}/models/${model}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error(
        `Replicate model lookup failed: HTTP ${response.status} for ${model}`
      );
    }
    const data = (await response.json()) as { latest_version?: { id?: string } };
    const id = data.latest_version?.id;
    if (!id) {
      throw new Error(`Replicate model ${model} has no latest_version`);
    }
    this.versionCache.set(model, id);
    console.log(`[ReplicateProvider] resolved ${model} → version ${id.slice(0, 12)}…`);
    return id;
  }

  private async createPrediction<O>(opts: ReplicateRunOptions): Promise<ReplicatePrediction<O>> {
    const token = this.getApiToken();
    const url = `${REPLICATE_BASE_URL}/predictions`;

    const body: Record<string, unknown> = { input: opts.input };
    if (opts.version) body.version = opts.version;

    console.log(`[ReplicateProvider] POST ${url} model=${opts.model}`);
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error('[ReplicateProvider] Network error creating prediction:', err);
      throw new Error('Replicate prediction failed: network error');
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '(unreadable)');
      console.error(
        `[ReplicateProvider] Create returned HTTP ${response.status}`,
        '\nBody:',
        errBody
      );
      throw new Error(`Replicate prediction failed: HTTP ${response.status} on create`);
    }

    let data: ReplicatePrediction<O>;
    try {
      data = (await response.json()) as ReplicatePrediction<O>;
    } catch (err) {
      console.error('[ReplicateProvider] Failed to parse create response:', err);
      throw new Error('Replicate prediction failed: invalid create response');
    }

    console.log(`[ReplicateProvider] Prediction created id=${data.id} status=${data.status}`);
    return data;
  }

  async getPrediction<O = unknown>(id: string): Promise<ReplicatePrediction<O>> {
    const token = this.getApiToken();
    let response: Response;
    try {
      response = await fetch(`${REPLICATE_BASE_URL}/predictions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('[ReplicateProvider] Network error polling prediction:', err);
      throw new Error('Replicate prediction failed: network error during polling');
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => '(unreadable)');
      console.error(
        `[ReplicateProvider] Poll returned HTTP ${response.status}`,
        '\nBody:',
        errBody
      );
      throw new Error(`Replicate prediction failed: HTTP ${response.status} on poll`);
    }

    try {
      return (await response.json()) as ReplicatePrediction<O>;
    } catch (err) {
      console.error('[ReplicateProvider] Failed to parse poll response:', err);
      throw new Error('Replicate prediction failed: invalid poll response');
    }
  }

  private async waitForCompletion<O>(
    id: string,
    opts: { pollIntervalMs?: number; pollTimeoutMs?: number }
  ): Promise<ReplicatePrediction<O>> {
    const intervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    const deadline = Date.now() + (opts.pollTimeoutMs ?? DEFAULT_POLL_TIMEOUT_MS);

    while (Date.now() < deadline) {
      const prediction = await this.getPrediction<O>(id);
      if (
        prediction.status === 'succeeded' ||
        prediction.status === 'failed' ||
        prediction.status === 'canceled'
      ) {
        return prediction;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Replicate prediction ${id} timed out`);
  }

  private getApiToken(): string {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      console.error('[ReplicateProvider] REPLICATE_API_TOKEN is not set');
      throw new Error('Replicate prediction failed: missing API token');
    }
    return token;
  }
}
