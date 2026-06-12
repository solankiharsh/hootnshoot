import { Injectable } from '@nestjs/common';
import { TemplateDecomposeService } from './template-decompose.service';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';

@Injectable()
export class PostUploadDecomposeService {
  constructor(
    private readonly decomposer: TemplateDecomposeService,
    private readonly media: MediaService
  ) {}

  /**
   * Fire-and-forget. Marks the media row as pending, runs full decompose,
   * writes the resulting polotno JSON back to the media row on success,
   * or marks it failed on error. Never throws.
   */
  async decomposeAndAttach(params: {
    mediaId: string;
    imageUrl: string;
  }): Promise<void> {
    const { mediaId, imageUrl } = params;
    const tag = `[PostUploadDecompose] mediaId=${mediaId}`;
    try {
      await this.media.setDecomposeStatus(mediaId, 'pending');
    } catch (err) {
      console.warn(`${tag} could not mark pending:`, (err as Error).message);
    }

    const t0 = Date.now();
    try {
      const result = await this.decomposer.decompose({ imageUrl });
      await this.media.attachPolotnoJson(mediaId, result.template);
      console.log(
        `${tag} decomposed in ${Date.now() - t0}ms, score=${result.quality.score}, issues=${result.quality.issues.length}`
      );
    } catch (err) {
      console.error(`${tag} decompose failed after ${Date.now() - t0}ms:`, err);
      try {
        await this.media.setDecomposeStatus(mediaId, 'failed');
      } catch (markErr) {
        console.warn(`${tag} could not mark failed:`, (markErr as Error).message);
      }
    }
  }
}
