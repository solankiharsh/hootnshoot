export interface ImageBrief {
  inputText: string;
  aspectRatio?: string;
  resolution?: '1K' | '2K' | '4K';
  personas?: string[];
  onBrand?: boolean;
  disclaimer?: boolean;
  logo?: string;
}

export interface ImageResult {
  images: string[];
  labels: string[];
  count: number;
}

export interface ImageJobSubmission {
  jobId: string;
}

export interface ImageJobStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string | null;
  error?: string | null;
}

export abstract class ImageService {
  abstract submit(brief: ImageBrief): Promise<ImageJobSubmission>;
  abstract getStatus(jobId: string): Promise<ImageJobStatus>;
  abstract getResult(jobId: string): Promise<ImageResult>;

  async generate(brief: ImageBrief): Promise<ImageResult> {
    const { jobId } = await this.submit(brief);
    await this.pollStatus(jobId);
    return this.getResult(jobId);
  }

  protected async pollStatus(jobId: string): Promise<void> {
    throw new Error(`Polling not implemented for job ${jobId}`);
  }
}
