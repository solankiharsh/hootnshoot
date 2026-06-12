import { HttpException, Injectable } from '@nestjs/common';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { Organization } from '@prisma/client';
import { SaveMediaInformationDto } from '@gitroom/nestjs-libraries/dtos/media/save.media.information.dto';
import { VideoManager } from '@gitroom/nestjs-libraries/videos/video.manager';
import { VideoDto } from '@gitroom/nestjs-libraries/dtos/videos/video.dto';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import {
  assertPromptLength,
  decodeBase64Image,
  MAX_BASE64_IMAGE_BYTES,
} from '@gitroom/nestjs-libraries/media/media-input.validation';
import { isSafePublicHttpsUrl } from '@gitroom/nestjs-libraries/dtos/webhooks/webhook.url.validator';

@Injectable()
export class MediaService {
  private storage = UploadFactory.createStorage();

  constructor(
    private _mediaRepository: MediaRepository,
    private _openAi: OpenaiService,
    private _subscriptionService: SubscriptionService,
    private _videoManager: VideoManager
  ) {}

  async editImage(imageDataUrl: string, prompt: string) {
    const googleApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      throw new HttpException(
        'GEMINI_API_KEY (or GOOGLE_API_KEY) is not configured for AI image edit',
        503
      );
    }

    const userPrompt = assertPromptLength(prompt);
    const { mimeType, data } = this._parseDataUrl(imageDataUrl);
    const systemInstruction =
      'You are an expert photo editor AI. Perform a realistic, seamless edit according to the user request. ' +
      'The output image MUST have exactly the same dimensions and aspect ratio as the input image. ' +
      'Do not crop, resize, or change the aspect ratio. Return only the final edited image.';

    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': googleApiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data } },
                { text: userPrompt },
              ],
            },
          ],
          generationConfig: { responseModalities: ['image', 'text'] },
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new HttpException(`Gemini API error (${response.status}): ${errBody}`, 502);
    }

    const result = await response.json();
    const parts = result?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);
    if (!imagePart?.inlineData?.data) {
      const text = parts.map((p: any) => p.text).filter(Boolean).join(' ');
      throw new HttpException(text ? `Gemini returned text: ${text}` : 'Image edit returned no image', 500);
    }

    return { base64: imagePart.inlineData.data };
  }

  async eraseImage(imageDataUrl: string, maskDataUrl: string) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      throw new HttpException('REPLICATE_API_TOKEN is not configured for AI erase', 503);
    }

    decodeBase64Image(imageDataUrl);
    decodeBase64Image(maskDataUrl);

    const toDataUrl = (s: string) => s.startsWith('data:') ? s : `data:image/png;base64,${s}`;

    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
      },
      body: JSON.stringify({
        version: '2757d1ac2f1291af219f5f10e8ecba15e92e7c05253e2841295f3ba6bff6adc4',
        input: {
          image: toDataUrl(imageDataUrl),
          mask: toDataUrl(maskDataUrl),
          mask_type: 'manual',
        },
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text().catch(() => '');
      throw new HttpException(`Erase API error (${createRes.status}): ${errBody}`, 502);
    }

    let prediction: any = await createRes.json();

    if (prediction.status !== 'succeeded') {
      prediction = await this._waitForPrediction(prediction.id, token);
    }

    let resultUrl = prediction.output;
    if (Array.isArray(resultUrl)) resultUrl = resultUrl[0];

    if (!resultUrl) {
      throw new HttpException('Erase returned no output', 500);
    }

    if (!(await isSafePublicHttpsUrl(resultUrl))) {
      throw new HttpException('Erase returned an unsafe result URL', 502);
    }

    const imageRes = await fetch(resultUrl);
    if (!imageRes.ok) {
      throw new HttpException(`Failed to download erase result (${imageRes.status})`, 502);
    }
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    return { base64: buffer.toString('base64') };
  }

  private async _waitForPrediction(id: string, token: string, maxWaitMs = 120000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new HttpException(`Poll failed: ${res.status}`, 502);
      const prediction = await res.json();
      if (prediction.status === 'succeeded') return prediction;
      if (prediction.status === 'failed' || prediction.status === 'canceled') {
        throw new HttpException(prediction.error || 'Prediction failed', 500);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new HttpException('Prediction timed out', 504);
  }

  private _parseDataUrl(dataUrl: string) {
    const buf = decodeBase64Image(dataUrl);
    const parts = dataUrl.split(',');
    const header = parts[0] ?? '';
    const mimeMatch = header.match(/data:([^;]+);/);
    const mimeType = mimeMatch?.[1] ?? 'image/png';
    if (!mimeType.startsWith('image/')) {
      throw new HttpException('Only image data URLs are supported', 400);
    }
    if (buf.length > MAX_BASE64_IMAGE_BYTES) {
      throw new HttpException(
        `Image exceeds ${MAX_BASE64_IMAGE_BYTES / (1024 * 1024)}MB limit`,
        400
      );
    }
    return { mimeType, data: buf.toString('base64') };
  }

  async deleteMedia(org: string, id: string) {
    return this._mediaRepository.deleteMedia(org, id);
  }

  getMediaById(id: string) {
    return this._mediaRepository.getMediaById(id);
  }

  async generateImage(
    prompt: string,
    org: Organization,
    generatePromptFirst?: boolean
  ) {
    const generating = await this._subscriptionService.useCredit(
      org,
      'ai_images',
      async () => {
        if (generatePromptFirst) {
          prompt = await this._openAi.generatePromptForPicture(prompt);
          console.log('Prompt:', prompt);
        }
        return this._openAi.generateImage(prompt, !!generatePromptFirst);
      }
    );

    return generating;
  }

  saveFile(org: string, fileName: string, filePath: string, originalName?: string) {
    return this._mediaRepository.saveFile(org, fileName, filePath, originalName);
  }

  getPolotnoJson(org: string, id: string) {
    return this._mediaRepository.getPolotnoJson(org, id);
  }

  attachPolotnoJson(id: string, polotnoJson: unknown) {
    return this._mediaRepository.attachPolotnoJson(id, polotnoJson);
  }

  setDecomposeStatus(id: string, status: 'pending' | 'ready' | 'failed') {
    return this._mediaRepository.setDecomposeStatus(id, status);
  }

  getMedia(org: string, page: number, search?: string, filterMode?: 'all' | 'layers' | 'raw') {
    return this._mediaRepository.getMedia(org, page, search, filterMode);
  }

  saveMediaInformation(org: string, data: SaveMediaInformationDto) {
    return this._mediaRepository.saveMediaInformation(org, data);
  }

  getVideoOptions() {
    return this._videoManager.getAllVideos();
  }

  async generateVideoAllowed(org: Organization, type: string) {
    const video = this._videoManager.getVideoByName(type);
    if (!video) {
      throw new Error(`Video type ${type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    return true;
  }

  async generateVideo(org: Organization, body: VideoDto) {
    const totalCredits = await this._subscriptionService.checkCredits(
      org,
      'ai_videos'
    );

    if (totalCredits.credits <= 0) {
      throw new SubscriptionException({
        action: AuthorizationActions.Create,
        section: Sections.VIDEOS_PER_MONTH,
      });
    }

    const video = this._videoManager.getVideoByName(body.type);
    if (!video) {
      throw new Error(`Video type ${body.type} not found`);
    }

    if (!video.trial && org.isTrailing) {
      throw new HttpException('This video is not available in trial mode', 406);
    }

    console.log(body.customParams);
    await video.instance.processAndValidate(body.customParams);
    console.log('no err');

    return await this._subscriptionService.useCredit(
      org,
      'ai_videos',
      async () => {
        const loadedData = await video.instance.process(
          body.output,
          body.customParams
        );

        const file = await this.storage.uploadSimple(loadedData);
        return this.saveFile(org.id, file.split('/').pop(), file);
      }
    );
  }

  async videoFunction(identifier: string, functionName: string, body: any) {
    const video = this._videoManager.getVideoByName(identifier);
    if (!video) {
      throw new Error(`Video with identifier ${identifier} not found`);
    }

    // @ts-ignore
    const functionToCall = video.instance[functionName];
    if (
      typeof functionToCall !== 'function' ||
      this._videoManager.checkAvailableVideoFunction(functionToCall)
    ) {
      throw new HttpException(
        `Function ${functionName} not found on video instance`,
        400
      );
    }

    return functionToCall(body);
  }
}
