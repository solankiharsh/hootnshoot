import { Injectable } from '@nestjs/common';
import {
  ImageBrief,
  ImageJobStatus,
  ImageJobSubmission,
  ImageResult,
  ImageService,
} from './image.service.interface';

const GENER8_BASE_URL = (process.env.GENER8_BASE_URL || '').replace(/\/+$/, '');
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 300_000;

@Injectable()
export class Gener8ImageAdapter extends ImageService {
  async submit(brief: ImageBrief): Promise<ImageJobSubmission> {
    const apiKey = this.getApiKey();

    console.log(`[Gener8ImageAdapter] POST ${GENER8_BASE_URL}/v1/generate`);
    let submitResponse: Response;
    try {
      const payload: Record<string, unknown> = {
        input_text: brief.inputText,
        aspect_ratio: brief.aspectRatio ?? '4:5',
        resolution: brief.resolution ?? '1K',
        personas:
          brief.personas && brief.personas.length
            ? brief.personas
            : ['bernbacher', 'scrollbreaker'],
        on_brand: brief.onBrand ?? true,
        disclaimer: brief.disclaimer ?? false,
      };
      if (brief.logo && brief.logo.trim().length > 0) {
        payload.logo = brief.logo;
      }

      submitResponse = await fetch(`${GENER8_BASE_URL}/v1/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(payload),
      });
    } catch (networkErr) {
      console.error('[Gener8ImageAdapter] Network error submitting job:', networkErr);
      throw new Error('Image generation failed: network error');
    }

    if (!submitResponse.ok) {
      const errorBody = await submitResponse.text().catch(() => '(unreadable)');
      console.error(
        `[Gener8ImageAdapter] Submit returned HTTP ${submitResponse.status}`,
        '\nBody:',
        errorBody
      );
      throw new Error(`Image generation failed: HTTP ${submitResponse.status} on submit`);
    }

    let submitData: {
      job_id: string;
      status: string;
      status_url: string;
      result_url: string;
    };
    try {
      submitData = await submitResponse.json();
    } catch (parseErr) {
      console.error('[Gener8ImageAdapter] Failed to parse submit response:', parseErr);
      throw new Error('Image generation failed: invalid submit response');
    }

    const { job_id } = submitData;
    console.log(`[Gener8ImageAdapter] Job submitted. job_id=${job_id}`);

    return { jobId: job_id };
  }

  async getStatus(jobId: string): Promise<ImageJobStatus> {
    const apiKey = this.getApiKey();

    let pollResponse: Response;
    try {
      pollResponse = await fetch(`${GENER8_BASE_URL}/v1/generate/${jobId}/status`, {
        headers: { 'X-API-Key': apiKey },
      });
    } catch (networkErr) {
      console.error('[Gener8ImageAdapter] Network error polling status:', networkErr);
      throw new Error('Image generation failed: network error during polling');
    }

    if (!pollResponse.ok) {
      const errorBody = await pollResponse.text().catch(() => '(unreadable)');
      console.error(
        `[Gener8ImageAdapter] Poll returned HTTP ${pollResponse.status}`,
        '\nBody:',
        errorBody
      );
      throw new Error(`Image generation failed: HTTP ${pollResponse.status} on status poll`);
    }

    let statusData: {
      status: 'pending' | 'running' | 'completed' | 'failed';
      progress: number;
      message?: string | null;
      error?: string | null;
    };
    try {
      statusData = await pollResponse.json();
    } catch (parseErr) {
      console.error('[Gener8ImageAdapter] Failed to parse status response:', parseErr);
      throw new Error('Image generation failed: invalid status response');
    }

    console.log(
      `[Gener8ImageAdapter] job_id=${jobId} status=${statusData.status} progress=${statusData.progress}`
    );

    return statusData;
  }

  async getResult(jobId: string): Promise<ImageResult> {
    const apiKey = this.getApiKey();

    console.log(`[Gener8ImageAdapter] GET ${GENER8_BASE_URL}/v1/generate/${jobId}/result`);
    let resultResponse: Response;
    try {
      resultResponse = await fetch(`${GENER8_BASE_URL}/v1/generate/${jobId}/result`, {
        headers: { 'X-API-Key': apiKey },
      });
    } catch (networkErr) {
      console.error('[Gener8ImageAdapter] Network error fetching result:', networkErr);
      throw new Error('Image generation failed: network error fetching result');
    }

    if (!resultResponse.ok) {
      const errorBody = await resultResponse.text().catch(() => '(unreadable)');
      console.error(
        `[Gener8ImageAdapter] Result returned HTTP ${resultResponse.status}`,
        '\nBody:',
        errorBody
      );
      throw new Error(`Image generation failed: HTTP ${resultResponse.status} on result`);
    }

    let resultData: {
      success: boolean;
      images: string[];
      labels: string[];
      count: number;
    };
    try {
      resultData = await resultResponse.json();
    } catch (parseErr) {
      console.error('[Gener8ImageAdapter] Failed to parse result response:', parseErr);
      throw new Error('Image generation failed: invalid result response');
    }

    if (!resultData.success) {
      console.error(
        '[Gener8ImageAdapter] Gener8 returned success=false. Full result:',
        JSON.stringify(resultData)
      );
      throw new Error('Gener8 returned no images');
    }

    console.log(`[Gener8ImageAdapter] Done. count=${resultData.count}`);
    return {
      images: resultData.images,
      labels: resultData.labels,
      count: resultData.count,
    };
  }

  protected override async pollStatus(jobId: string): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const statusData = await this.getStatus(jobId);

      if (statusData.status === 'completed') return;
      if (statusData.status === 'failed') throw new Error('Gener8 image generation failed');
    }

    throw new Error('Gener8 job timed out');
  }

  private getApiKey(): string {
    const apiKey = process.env.GENER8_API_KEY;

    if (!apiKey) {
      console.error('[Gener8ImageAdapter] GENER8_API_KEY is not set in environment');
      throw new Error('Image generation failed: missing API key');
    }

    return apiKey;
  }
}
