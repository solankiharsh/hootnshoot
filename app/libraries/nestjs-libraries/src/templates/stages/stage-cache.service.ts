import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

export type DecomposeStage =
  | 'ocr'
  | 'ocr-refine'
  | 'subject-detect'
  | 'subject-detect-dino'
  | 'subject-detect-refine'
  | 'subject-isolate'
  | 'subject-isolate-refine'
  | 'bg-recover'
  | 'quality-tier-b';

interface WrapOptions {
  stage: DecomposeStage;
  strategy: string;
  imageHash: string;
  extra?: Record<string, unknown>;
  ttlSeconds?: number;
  requestId?: string;
}

const DEFAULT_TTL_SECONDS = 60 * 60;
const NAMESPACE = 'decompose:stage';

@Injectable()
export class StageCacheService {
  static hashImage(base64: string): string {
    return createHash('sha256').update(base64).digest('hex').slice(0, 16);
  }

  static makeRequestId(): string {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .slice(0, 12);
  }

  async wrap<T>(opts: WrapOptions, work: () => Promise<T>): Promise<T> {
    const key = this.buildKey(opts);
    const t0 = Date.now();

    const cached = await this.safeGet(key);
    if (cached !== null) {
      const ms = Date.now() - t0;
      this.emitTelemetry({ ...opts, hit: true, ms, outcome: 'cache-hit' });
      try {
        return JSON.parse(cached) as T;
      } catch {
        // Corrupt cache entry — drop it and re-run.
        await this.safeDel(key);
      }
    }

    let result: T;
    try {
      result = await work();
    } catch (err) {
      const ms = Date.now() - t0;
      this.emitTelemetry({
        ...opts,
        hit: false,
        ms,
        outcome: 'error',
        error: (err as Error).message,
      });
      throw err;
    }

    const ms = Date.now() - t0;
    await this.safeSet(key, result, opts.ttlSeconds ?? DEFAULT_TTL_SECONDS);
    this.emitTelemetry({ ...opts, hit: false, ms, outcome: 'computed' });
    return result;
  }

  private buildKey(opts: WrapOptions): string {
    const extraHash = opts.extra
      ? createHash('sha256').update(JSON.stringify(opts.extra)).digest('hex').slice(0, 12)
      : 'none';
    return `${NAMESPACE}:${opts.stage}:${opts.strategy}:${opts.imageHash}:${extraHash}`;
  }

  private async safeGet(key: string): Promise<string | null> {
    try {
      const v = await ioRedis.get(key);
      return v ?? null;
    } catch (err) {
      console.warn(`[StageCacheService] get failed for ${key}:`, (err as Error).message);
      return null;
    }
  }

  private async safeSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      // Skip cache for objects we couldn't serialize or that are absurdly large (>5MB).
      if (!serialized || serialized.length > 5 * 1024 * 1024) {
        return;
      }
      // ioredis supports EX option in real Redis; MockRedis ignores extras silently.
      await (ioRedis as unknown as { set: (k: string, v: string, ex?: string, t?: number) => Promise<unknown> }).set(
        key,
        serialized,
        'EX',
        ttlSeconds
      );
    } catch (err) {
      console.warn(`[StageCacheService] set failed for ${key}:`, (err as Error).message);
    }
  }

  private async safeDel(key: string): Promise<void> {
    try {
      await ioRedis.del(key);
    } catch {
      // best-effort
    }
  }

  private emitTelemetry(payload: {
    stage: DecomposeStage;
    strategy: string;
    imageHash: string;
    requestId?: string;
    hit: boolean;
    ms: number;
    outcome: 'cache-hit' | 'computed' | 'error';
    error?: string;
  }): void {
    const tag = payload.requestId ? `req=${payload.requestId} ` : '';
    console.log(
      `[stage-telemetry] ${tag}stage=${payload.stage} strategy=${payload.strategy} image=${payload.imageHash} hit=${payload.hit} ms=${payload.ms} outcome=${payload.outcome}${
        payload.error ? ` error="${payload.error}"` : ''
      }`
    );
  }
}
