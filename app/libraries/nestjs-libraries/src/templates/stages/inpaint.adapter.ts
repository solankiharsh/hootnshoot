import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { GeminiImageEditProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-image-edit.provider';
import { ReplicateProvider } from '@gitroom/nestjs-libraries/3rdparties/replicate/replicate.provider';
import { BackgroundPlate } from '../templates.types';

const LAMA_MODEL = 'cjwbw/lama';

const buildBackgroundPrompt = (width: number, height: number): string => `You are erasing only the TEXT from this graphic design while keeping every other visual element identical to the source.

INSTRUCTIONS:
- Remove every piece of readable text: headlines, body copy, captions, source lines, disclaimers, button labels, watermarks, logo wordmarks.
- Faithfully inpaint the background pixels that were behind the removed text so no text is visible.
- KEEP everything else exactly as it appears in the source: product photos, illustrations, icons, arrows, shapes, color blocks, gradients, lighting, textures, and overall composition.
- Do NOT redraw, restyle, recolor, or reposition any non-text element.
- Do NOT introduce new objects, new lighting, new backgrounds, new shadows, or new effects.
- Output dimensions: EXACTLY ${width} pixels wide by ${height} pixels tall. Do not crop, pad, or letterbox.
- Output a single flat image. No transparency.`;

export interface InpaintInput {
  imageUrl: string;
  imageBase64?: string;
  imageMimeType?: string;
  width: number;
  height: number;
}

@Injectable()
export class InpaintAdapter {
  constructor(
    private readonly gemini: GeminiImageEditProvider,
    private readonly replicate: ReplicateProvider
  ) {}

  async recoverBackground(input: InpaintInput): Promise<BackgroundPlate> {
    let plate: BackgroundPlate;
    try {
      plate = await this.runNanoBanana(input);
    } catch (err) {
      console.warn(
        '[InpaintAdapter] Nano Banana background recovery failed, falling back to LaMa:',
        err
      );
      plate = await this.runLama(input);
    }
    return this.resampleToDimensions(plate, input.width, input.height);
  }

  /**
   * Generate `count` background-recovery candidates in parallel.
   * Uses the Nano Banana path when base64 is present; LaMa as a per-call fallback.
   * At least one candidate is always returned (may be fewer than requested on errors).
   */
  async recoverBackgroundCandidates(
    input: InpaintInput,
    count: number
  ): Promise<BackgroundPlate[]> {
    const attempts = Array.from({ length: count }, (_, i) =>
      this.recoverBackground(input).catch((err) => {
        console.warn(`[InpaintAdapter] candidate ${i} failed:`, err);
        return null;
      })
    );
    const results = await Promise.all(attempts);
    const valid = results.filter((r): r is BackgroundPlate => r !== null);
    // Always return at least one candidate — re-run sync if all parallel attempts failed
    if (valid.length === 0) {
      const fallback = await this.recoverBackground(input);
      return [fallback];
    }
    return valid;
  }

  private async runNanoBanana(input: InpaintInput): Promise<BackgroundPlate> {
    if (!input.imageBase64) {
      throw new Error('Nano Banana requires base64 image data');
    }
    const result = await this.gemini.edit({
      prompt: buildBackgroundPrompt(input.width, input.height),
      imageBase64: input.imageBase64,
      imageMimeType: input.imageMimeType ?? 'image/png',
    });
    const dataUrl = `data:${result.mimeType};base64,${result.imageBase64}`;
    console.log('[InpaintAdapter] background recovered via Nano Banana');
    return { url: dataUrl };
  }

  private async runLama(input: InpaintInput): Promise<BackgroundPlate> {
    const output = await this.replicate.run<string | string[]>({
      model: LAMA_MODEL,
      input: { image: input.imageUrl },
    });
    const url = Array.isArray(output) ? output[0] : output;
    if (typeof url !== 'string') {
      throw new Error('LaMa inpaint returned no image URL');
    }
    console.log('[InpaintAdapter] background recovered via LaMa');
    return { url };
  }

  private async resampleToDimensions(
    plate: BackgroundPlate,
    targetWidth: number,
    targetHeight: number
  ): Promise<BackgroundPlate> {
    const dataMatch = plate.url.match(/^data:([^;]+);base64,(.+)$/);
    if (!dataMatch) return plate;

    const inputBuf = Buffer.from(dataMatch[2], 'base64');
    try {
      const meta = await sharp(inputBuf).metadata();
      if (meta.width === targetWidth && meta.height === targetHeight) {
        return plate;
      }
      console.log(
        `[InpaintAdapter] resampling bg plate ${meta.width}x${meta.height} → ${targetWidth}x${targetHeight}`
      );
      const resized = await sharp(inputBuf)
        .resize(targetWidth, targetHeight, { fit: 'fill' })
        .png()
        .toBuffer();
      return {
        url: `data:image/png;base64,${resized.toString('base64')}`,
      };
    } catch (err) {
      console.warn('[InpaintAdapter] resample failed, returning original plate:', err);
      return plate;
    }
  }
}
