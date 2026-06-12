import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { ReplicateProvider } from '@gitroom/nestjs-libraries/3rdparties/replicate/replicate.provider';
import { DetectedSubject } from './subject-detect.adapter';
import { SubjectIsolateStrategyName, SubjectMask } from '../templates.types';

const BG_REMOVE_MODEL = '851-labs/background-remover';
const GROUNDED_SAM_MODEL = 'schananas/grounded_sam';
const CROP_PADDING_RATIO = 0.04;

export interface SubjectIsolateInput {
  imageBase64: string;
  imageMimeType?: string;
  imageWidth: number;
  imageHeight: number;
  subjects: DetectedSubject[];
  strategy?: SubjectIsolateStrategyName;
}

@Injectable()
export class SubjectIsolateAdapter {
  constructor(private readonly replicate: ReplicateProvider) {}

  async isolateAll(input: SubjectIsolateInput): Promise<SubjectMask[]> {
    if (!input.subjects.length) return [];
    const strategy = input.strategy ?? '851-labs';
    if (strategy === 'sam2-prompted') {
      return this.isolateWithGroundedSam(input);
    }
    return this.isolateWithBgRemover(input);
  }

  // ─────────── 851-labs/background-remover (crop → strip-bg) ───────────

  private async isolateWithBgRemover(
    input: SubjectIsolateInput
  ): Promise<SubjectMask[]> {
    const sourceBuf = Buffer.from(input.imageBase64, 'base64');

    const results = await Promise.all(
      input.subjects.map(async (subject, idx): Promise<SubjectMask | null> => {
        try {
          const { left, top, cropW, cropH } = paddedCrop(
            subject,
            input.imageWidth,
            input.imageHeight
          );

          const cropBuf = await sharp(sourceBuf)
            .extract({ left, top, width: cropW, height: cropH })
            .png()
            .toBuffer();
          const cropDataUrl = `data:image/png;base64,${cropBuf.toString('base64')}`;

          const outputUrl = await this.replicate.run<string | string[]>({
            model: BG_REMOVE_MODEL,
            input: { image: cropDataUrl, format: 'png' },
          });
          const url = Array.isArray(outputUrl) ? outputUrl[0] : outputUrl;
          if (typeof url !== 'string') throw new Error('background-remover returned no URL');

          const fetched = await fetch(url);
          if (!fetched.ok) throw new Error(`fetch transparent PNG HTTP ${fetched.status}`);
          const pngBuf = Buffer.from(await fetched.arrayBuffer());
          const dataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`;

          console.log(
            `[SubjectIsolateAdapter:851-labs] isolated "${subject.label}" (${idx + 1}/${input.subjects.length}) crop=${cropW}x${cropH}`
          );
          return {
            url: dataUrl,
            label: subject.label,
            box: { x: left, y: top, width: cropW, height: cropH },
          };
        } catch (err) {
          console.warn(
            `[SubjectIsolateAdapter:851-labs] failed for "${subject.label}":`,
            err
          );
          return null;
        }
      })
    );

    return results.filter((r): r is SubjectMask => r !== null);
  }

  // ─────────── schananas/grounded_sam (label-prompted mask) ───────────

  private async isolateWithGroundedSam(
    input: SubjectIsolateInput
  ): Promise<SubjectMask[]> {
    const sourceBuf = Buffer.from(input.imageBase64, 'base64');

    const results = await Promise.all(
      input.subjects.map(async (subject, idx): Promise<SubjectMask | null> => {
        try {
          const { left, top, cropW, cropH } = paddedCrop(
            subject,
            input.imageWidth,
            input.imageHeight
          );

          // Step 1 — crop source to the focused region so grounded_sam can't bleed across the canvas.
          const cropBuf = await sharp(sourceBuf)
            .extract({ left, top, width: cropW, height: cropH })
            .png()
            .toBuffer();
          const cropDataUrl = `data:image/png;base64,${cropBuf.toString('base64')}`;

          // Step 2 — grounded_sam on the crop, using the subject label.
          const negatives = input.subjects
            .filter((s) => s.label !== subject.label)
            .map((s) => s.label)
            .join(', ');
          const output = await this.replicate.run<string | string[]>({
            model: GROUNDED_SAM_MODEL,
            input: {
              image: cropDataUrl,
              mask_prompt: subject.label,
              negative_mask_prompt: negatives || 'text, background',
              adjustment_factor: -5,
            },
          });
          const maskUrl = Array.isArray(output) ? output[0] : output;
          if (typeof maskUrl !== 'string') {
            throw new Error('grounded_sam returned no mask URL');
          }

          // Step 3 — fetch mask, resize to crop dims, use as alpha channel of crop.
          const maskResp = await fetch(maskUrl);
          if (!maskResp.ok) throw new Error(`fetch mask HTTP ${maskResp.status}`);
          const maskBuf = Buffer.from(await maskResp.arrayBuffer());
          const resizedMask = await sharp(maskBuf)
            .resize(cropW, cropH, { fit: 'fill' })
            .greyscale()
            .toBuffer();
          const rgbCrop = await sharp(cropBuf).removeAlpha().toFormat('png').toBuffer();
          const masked = await sharp(rgbCrop)
            .joinChannel(resizedMask)
            .png()
            .toBuffer();

          const dataUrl = `data:image/png;base64,${masked.toString('base64')}`;
          console.log(
            `[SubjectIsolateAdapter:sam2-prompted] isolated "${subject.label}" (${idx + 1}/${input.subjects.length}) crop=${cropW}x${cropH}`
          );
          return {
            url: dataUrl,
            label: subject.label,
            box: { x: left, y: top, width: cropW, height: cropH },
          };
        } catch (err) {
          console.warn(
            `[SubjectIsolateAdapter:sam2-prompted] failed for "${subject.label}":`,
            err
          );
          return null;
        }
      })
    );

    return results.filter((r): r is SubjectMask => r !== null);
  }
}

function paddedCrop(
  subject: DetectedSubject,
  imgW: number,
  imgH: number
): { left: number; top: number; cropW: number; cropH: number } {
  const padX = Math.round(subject.width * CROP_PADDING_RATIO);
  const padY = Math.round(subject.height * CROP_PADDING_RATIO);
  const left = clamp(subject.x - padX, 0, imgW - 1);
  const top = clamp(subject.y - padY, 0, imgH - 1);
  const right = clamp(subject.x + subject.width + padX, left + 1, imgW);
  const bottom = clamp(subject.y + subject.height + padY, top + 1, imgH);
  return {
    left,
    top,
    cropW: right - left,
    cropH: bottom - top,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
