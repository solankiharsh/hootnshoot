import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CaptionService } from '@gitroom/nestjs-libraries/caption/caption.service.interface';
import { GeminiCaptionSuggestAdapter } from '@gitroom/nestjs-libraries/caption/gemini-caption-suggest.adapter';
import { ImageService } from '@gitroom/nestjs-libraries/image/image.service.interface';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { PostUploadDecomposeService } from '@gitroom/nestjs-libraries/templates/post-upload-decompose.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';

@ApiTags('Caption')
@Controller('/caption')
export class CaptionController {
  private storage = UploadFactory.createStorage();

  constructor(
    private _captionService: CaptionService,
    private _captionSuggestAdapter: GeminiCaptionSuggestAdapter,
    private _imageService: ImageService,
    private _mediaService: MediaService,
    private _postUploadDecompose: PostUploadDecomposeService
  ) {}

  @Post('/generate')
  async generate(
    @GetOrgFromRequest() org: Organization,
    @Body() body: {
      topic: string;
      contentType: string;
      language: string;
      keyMessage?: string;
      assets?: string;
      cta?: string;
      tone?: string;
      withImage?: boolean;
      imagePersona?: string;
    }
  ) {
    const caption = await this._captionService.generate({
      topic: body.topic,
      contentType: body.contentType as 'academy' | 'announcement' | 'campaign',
      language: 'en',
      keyMessage: body.keyMessage,
      assets: body.assets,
      cta: body.cta,
      tone: body.tone,
    });

    if (!body.withImage || !process.env.GENER8_API_KEY) {
      return caption;
    }

    try {
      const imageResult = await this._imageService.generate({
        inputText: `${body.topic} — ${caption.headline}`,
        personas: body.imagePersona ? [body.imagePersona] : undefined,
        onBrand: true,
      });
      const sourceUrl = imageResult.images[0];
      let mediaId: string | undefined;
      let persistedUrl: string | undefined;

      try {
        const stored = await this.storage.uploadSimple(sourceUrl);
        const name = stored.split('/').pop() ?? `caption-${Date.now()}.png`;
        const savedMedia = await this._mediaService.saveFile(org.id, name, stored);
        mediaId = savedMedia?.id;
        persistedUrl = stored;

        if (mediaId && persistedUrl) {
          void this._postUploadDecompose.decomposeAndAttach({
            mediaId,
            imageUrl: persistedUrl,
          });
        }
      } catch (persistErr) {
        console.error(
          '[CaptionController] Failed to persist Gener8 image to media library:',
          persistErr
        );
      }

      return {
        ...caption,
        imageUrl: persistedUrl ?? sourceUrl,
        mediaId,
      };
    } catch (err) {
      // Image generation is best-effort — return caption even if it fails
      console.error('[CaptionController] Image generation failed:', err);
      return caption;
    }
  }

  @Post('/suggest')
  async suggest(
    @Body() body: { topic: string; contentType: string }
  ) {
    return this._captionSuggestAdapter.suggest(body.topic, body.contentType);
  }
}
