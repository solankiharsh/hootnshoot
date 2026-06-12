import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { OcrBox } from '../templates.types';

export interface CandidateScore {
  /** Overall composite score 0–100, higher = better */
  score: number;
  /** 0–100: spatial Lab color grid similarity to source */
  colorScore: number;
  /** 0–100: Sobel gradient continuity at inpaint seams (higher = smoother) */
  seamScore: number;
  candidateIndex: number;
  /** 128×128 JPEG thumbnail as data URL for visual inspection */
  thumbnail: string;
}

// ── Lab colour helpers ───────────────────────────────────────────────────────

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToLab(r: number, g: number, b: number): [number, number, number] {
  const X = 0.4124 * r + 0.3576 * g + 0.1805 * b;
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Z = 0.0193 * r + 0.1192 * g + 0.9505 * b;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [
    116 * f(Y) - 16,
    500 * (f(X / 0.95047) - f(Y)),
    200 * (f(Y) - f(Z / 1.08883)),
  ];
}

const GRID_W = 8;
const GRID_H = 8;
const THUMB_SRC = 64; // resolution used for colour grid

async function buildColorGrid(
  buf: Buffer
): Promise<[number, number, number][]> {
  const raw = await sharp(buf)
    .resize(THUMB_SRC, THUMB_SRC, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const cellW = THUMB_SRC / GRID_W;
  const cellH = THUMB_SRC / GRID_H;
  const cells: [number, number, number][] = [];

  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      let sumL = 0, sumA = 0, sumB = 0, count = 0;
      for (let py = 0; py < cellH; py++) {
        for (let px = 0; px < cellW; px++) {
          const x = Math.floor(cx * cellW + px);
          const y = Math.floor(cy * cellH + py);
          const idx = (y * THUMB_SRC + x) * 3;
          const [L, Av, Bv] = linearToLab(
            srgbToLinear(raw[idx]),
            srgbToLinear(raw[idx + 1]),
            srgbToLinear(raw[idx + 2])
          );
          sumL += L; sumA += Av; sumB += Bv; count++;
        }
      }
      cells.push([sumL / count, sumA / count, sumB / count]);
    }
  }
  return cells;
}

function colorGridDistance(
  a: [number, number, number][],
  b: [number, number, number][]
): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    const dL = a[i][0] - b[i][0];
    const dA = a[i][1] - b[i][1];
    const dB = a[i][2] - b[i][2];
    total += Math.sqrt(dL * dL + dA * dA + dB * dB);
  }
  return total / a.length;
}

// ── Seam-specific Sobel ──────────────────────────────────────────────────────
// Sobel kernels (3×3): applied via sharp.convolve in two passes

const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

// Scale factor to bring the OCR box coordinates (original resolution) into the
// working resolution used for Sobel (256 px shorter side).
const SOBEL_WORK_SIZE = 256;

/**
 * Compute mean Sobel gradient magnitude inside a dilated seam mask.
 *
 * The seam is defined by the OCR bounding boxes (the regions that were
 * inpainted). We dilate each box by SEAM_DILATION pixels so we measure
 * gradient at the boundary, not inside the flat inpainted region.
 *
 * Lower mean = smoother seam = better inpaint.
 */
async function seamSobelMean(
  buf: Buffer,
  ocrBoxes: OcrBox[],
  sourceW: number,
  sourceH: number
): Promise<number> {
  if (!ocrBoxes.length) {
    // No seam info — fall back to global Sobel mean
    return globalSobelMean(buf);
  }

  const { data: gxData, info } = await sharp(buf)
    .resize(SOBEL_WORK_SIZE, Math.round(SOBEL_WORK_SIZE * (sourceH / sourceW)), { fit: 'fill' })
    .greyscale()
    .convolve({ width: 3, height: 3, kernel: SOBEL_X })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: gyData } = await sharp(buf)
    .resize(SOBEL_WORK_SIZE, Math.round(SOBEL_WORK_SIZE * (sourceH / sourceW)), { fit: 'fill' })
    .greyscale()
    .convolve({ width: 3, height: 3, kernel: SOBEL_Y })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const scaleX = w / sourceW;
  const scaleY = h / sourceH;

  // Build a seam mask bitmap (1 = inside seam border region)
  const SEAM_DILATION = 6; // pixels in working resolution
  const mask = new Uint8Array(w * h);

  for (const box of ocrBoxes) {
    const x0 = Math.max(0, Math.round(box.x * scaleX) - SEAM_DILATION);
    const y0 = Math.max(0, Math.round(box.y * scaleY) - SEAM_DILATION);
    const x1 = Math.min(w - 1, Math.round((box.x + box.width) * scaleX) + SEAM_DILATION);
    const y1 = Math.min(h - 1, Math.round((box.y + box.height) * scaleY) + SEAM_DILATION);
    // inner box (the actual inpainted region — gradient here should be near-zero)
    const ix0 = Math.max(0, Math.round(box.x * scaleX) + SEAM_DILATION);
    const iy0 = Math.max(0, Math.round(box.y * scaleY) + SEAM_DILATION);
    const ix1 = Math.min(w - 1, Math.round((box.x + box.width) * scaleX) - SEAM_DILATION);
    const iy1 = Math.min(h - 1, Math.round((box.y + box.height) * scaleY) - SEAM_DILATION);

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Only mark the ring (dilated − inner), i.e., the seam boundary
        if (x < ix0 || x > ix1 || y < iy0 || y > iy1) {
          mask[y * w + x] = 1;
        }
      }
    }
  }

  let sum = 0;
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue;
    const gx = (gxData[i] as number) - 128; // sharp outputs unsigned, centre at 128
    const gy = (gyData[i] as number) - 128;
    sum += Math.sqrt(gx * gx + gy * gy);
    count++;
  }
  if (count === 0) return globalSobelMean(buf);
  return sum / count;
}

async function globalSobelMean(buf: Buffer): Promise<number> {
  const { data: gxData, info } = await sharp(buf)
    .resize(SOBEL_WORK_SIZE, SOBEL_WORK_SIZE, { fit: 'fill' })
    .greyscale()
    .convolve({ width: 3, height: 3, kernel: SOBEL_X })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: gyData } = await sharp(buf)
    .resize(SOBEL_WORK_SIZE, SOBEL_WORK_SIZE, { fit: 'fill' })
    .greyscale()
    .convolve({ width: 3, height: 3, kernel: SOBEL_Y })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const n = info.width * info.height;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const gx = (gxData[i] as number) - 128;
    const gy = (gyData[i] as number) - 128;
    sum += Math.sqrt(gx * gx + gy * gy);
  }
  return sum / n;
}

// ── Thumbnail generation ─────────────────────────────────────────────────────

async function makeThumbnail(buf: Buffer): Promise<string> {
  const thumb = await sharp(buf)
    .resize(128, 128, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 65 })
    .toBuffer();
  return `data:image/jpeg;base64,${thumb.toString('base64')}`;
}

// ── Main service ─────────────────────────────────────────────────────────────

@Injectable()
export class CandidateScoringService {
  /**
   * Score background-recovery candidates against the source image.
   *
   * Scoring axes:
   *   - colorScore (70%): spatial 8×8 Lab grid distance to source
   *   - seamScore (30%): Sobel gradient magnitude at OCR box seam boundaries
   *                       (lower gradient = smoother inpaint = higher score)
   *
   * Also generates a 128×128 thumbnail per candidate for visual inspection.
   * Returns scores sorted best → worst.
   */
  async rankCandidates(
    sourceBase64: string,
    candidateBase64s: string[],
    ocrBoxes: OcrBox[] = [],
    sourceW = 1080,
    sourceH = 1080
  ): Promise<CandidateScore[]> {
    if (candidateBase64s.length === 0) return [];
    if (candidateBase64s.length === 1) {
      const thumb = await makeThumbnail(Buffer.from(candidateBase64s[0], 'base64'));
      return [{ score: 100, colorScore: 100, seamScore: 100, candidateIndex: 0, thumbnail: thumb }];
    }

    const sourceBuf = Buffer.from(sourceBase64, 'base64');
    const candidateBufs = candidateBase64s.map((b64) => Buffer.from(b64, 'base64'));

    const [sourceGrid, ...candidateGrids] = await Promise.all([
      buildColorGrid(sourceBuf),
      ...candidateBufs.map((b) => buildColorGrid(b)),
    ]);

    const [seamMeans, thumbnails] = await Promise.all([
      Promise.all(candidateBufs.map((b) => seamSobelMean(b, ocrBoxes, sourceW, sourceH))),
      Promise.all(candidateBufs.map((b) => makeThumbnail(b))),
    ]);

    const colorDistances = candidateGrids.map((g) => colorGridDistance(sourceGrid, g));

    const maxColorDist = Math.max(...colorDistances, 0.001);
    const maxSeam = Math.max(...seamMeans, 0.001);

    const scores: CandidateScore[] = candidateBase64s.map((_, idx) => {
      const colorScore = 100 * (1 - colorDistances[idx] / maxColorDist);
      const seamScore = 100 * (1 - seamMeans[idx] / maxSeam);
      const score = colorScore * 0.7 + seamScore * 0.3;
      return {
        score: Math.round(score),
        colorScore: Math.round(colorScore),
        seamScore: Math.round(seamScore),
        candidateIndex: idx,
        thumbnail: thumbnails[idx],
      };
    });

    scores.sort((a, b) => b.score - a.score);
    return scores;
  }
}
