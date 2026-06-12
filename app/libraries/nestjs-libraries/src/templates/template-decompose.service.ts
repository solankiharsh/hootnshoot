import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { PolotnoStoreJSON } from './assembler/polotno-schema';
import { assemblePolotnoJSON } from './assembler/assemble';
import { OcrAdapter } from './stages/ocr.adapter';
import { InpaintAdapter } from './stages/inpaint.adapter';
import { SubjectDetectAdapter } from './stages/subject-detect.adapter';
import { SubjectIsolateAdapter } from './stages/subject-isolate.adapter';
import { AccentDetectAdapter } from './stages/accent-detect.adapter';
import { QualityCheckService } from './quality/quality-check.service';
import { CandidateScoringService } from './quality/candidate-scoring.service';
import { QualityReport } from './quality/quality.types';
import { HarmonizeAdapter } from './stages/harmonize.adapter';
import { StageCacheService } from './stages/stage-cache.service';
import {
  DEFAULT_STRATEGIES,
  DecomposeRequest,
  DecomposeStageOutputs,
} from './templates.types';
import { AccentBox, BackgroundPlate, OcrResult, SubjectMask } from './templates.types';

export interface DecomposeResult {
  template: PolotnoStoreJSON;
  quality: QualityReport;
}

interface ImageMeta {
  imageUrl: string;
  imageBase64?: string;
  imageMimeType: string;
  width: number;
  height: number;
}

@Injectable()
export class TemplateDecomposeService {
  constructor(
    private readonly ocr: OcrAdapter,
    private readonly subjectDetect: SubjectDetectAdapter,
    private readonly subjectIsolate: SubjectIsolateAdapter,
    private readonly inpaint: InpaintAdapter,
    private readonly accentDetect: AccentDetectAdapter,
    private readonly quality: QualityCheckService,
    private readonly candidateScoring: CandidateScoringService,
    private readonly stageCache: StageCacheService,
    private readonly harmonize: HarmonizeAdapter
  ) {}

  async decompose(req: DecomposeRequest): Promise<DecomposeResult> {
    const meta = await this.resolveImage(req);
    const strategies = { ...DEFAULT_STRATEGIES, ...(req.strategies ?? {}) };
    const logoUrl = await resolveLogoUrl(process.env.ORG_LOGO_URL);
    const imageHash = StageCacheService.hashImage(meta.imageBase64!);
    const requestId = StageCacheService.makeRequestId();
    console.log(
      `[TemplateDecomposeService] req=${requestId} image=${imageHash} strategies: ${JSON.stringify(strategies)}`
    );

    // Stage 1 — analysis (parallel)
    const ocrPromise: Promise<OcrResult> =
      strategies.ocr === 'gemini-vision'
        ? this.stageCache.wrap(
            { stage: 'ocr', strategy: strategies.ocr, imageHash, requestId },
            () =>
              this.ocr.extract({
                imageBase64: meta.imageBase64!,
                imageMimeType: meta.imageMimeType,
                imageWidth: meta.width,
                imageHeight: meta.height,
              })
          )
        : Promise.resolve({
            boxes: [],
            imageWidth: meta.width,
            imageHeight: meta.height,
          });

    const subjectDetectPromise =
      strategies.subjectDetect !== 'skip'
        ? this.stageCache.wrap(
            { stage: 'subject-detect', strategy: 'gemini-vision', imageHash, requestId },
            () =>
              this.subjectDetect.detect({
                imageBase64: meta.imageBase64!,
                imageMimeType: meta.imageMimeType,
                imageWidth: meta.width,
                imageHeight: meta.height,
              })
          )
        : Promise.resolve([]);

    const accentDetectPromise: Promise<AccentBox[]> = this.stageCache.wrap(
      { stage: 'accent-detect', strategy: 'gemini-vision', imageHash, requestId },
      () =>
        this.accentDetect.detect({
          imageBase64: meta.imageBase64!,
          imageMimeType: meta.imageMimeType,
          imageWidth: meta.width,
          imageHeight: meta.height,
        })
    );

    const [ocrResult, geminiSubjects, detectedAccents] = await Promise.all([
      ocrPromise,
      subjectDetectPromise,
      accentDetectPromise,
    ]);

    const detectedSubjects =
      strategies.subjectDetect === 'gemini-then-dino' && geminiSubjects.length > 0
        ? await this.stageCache.wrap(
            {
              stage: 'subject-detect-dino',
              strategy: 'gemini-then-dino',
              imageHash,
              requestId,
              extra: { labels: geminiSubjects.map((s) => s.label).sort() },
            },
            () =>
              this.subjectDetect.refineWithDino(
                {
                  imageBase64: meta.imageBase64!,
                  imageMimeType: meta.imageMimeType,
                  imageWidth: meta.width,
                  imageHeight: meta.height,
                },
                geminiSubjects
              )
          )
        : geminiSubjects;

    // Stage 2 — extraction (parallel, depends on subject list)
    const numCandidates = Math.max(1, strategies.numBackgroundCandidates ?? 1);
    const bgPromise: Promise<{ plate: BackgroundPlate; candidateInfo?: import('./quality/quality.types').BackgroundCandidateInfo }> =
      strategies.bgRecover === 'nano-banana-text-only'
        ? this.stageCache
            .wrap(
              { stage: 'bg-recover', strategy: strategies.bgRecover, imageHash, requestId },
              () =>
                this.inpaint.recoverBackground({
                  imageUrl: meta.imageUrl,
                  imageBase64: meta.imageBase64,
                  imageMimeType: meta.imageMimeType,
                  width: meta.width,
                  height: meta.height,
                })
            )
            .then(async (singlePlate): Promise<{ plate: BackgroundPlate; candidateInfo?: import('./quality/quality.types').BackgroundCandidateInfo }> => {
              if (numCandidates <= 1) return { plate: singlePlate };
              // Generate remaining candidates uncached (must be unique)
              const extra = await this.inpaint.recoverBackgroundCandidates(
                {
                  imageUrl: meta.imageUrl,
                  imageBase64: meta.imageBase64,
                  imageMimeType: meta.imageMimeType,
                  width: meta.width,
                  height: meta.height,
                },
                numCandidates - 1
              );
              const allPlates = [singlePlate, ...extra];
              const candidateBase64s = allPlates.map((p) => {
                const m = p.url.match(/^data:[^;]+;base64,(.+)$/);
                return m ? m[1] : '';
              });
              // Pass OCR boxes so seam scoring targets actual inpainted regions
              const scores = await this.candidateScoring.rankCandidates(
                meta.imageBase64!,
                candidateBase64s,
                ocrResult.boxes,
                meta.width,
                meta.height
              );
              const best = scores[0];
              console.log(
                `[TemplateDecomposeService] bg candidates=${allPlates.length} best=${best.candidateIndex} score=${best.score} (color=${best.colorScore} seam=${best.seamScore})`
              );
              return {
                plate: allPlates[best.candidateIndex],
                candidateInfo: {
                  candidatesGenerated: allPlates.length,
                  selectedIndex: best.candidateIndex,
                  scores,
                },
              };
            })
        : Promise.resolve({ plate: { url: meta.imageUrl } });

    const subjectIsolatePromise: Promise<SubjectMask[]> =
      strategies.subjectIsolate !== 'skip' && detectedSubjects.length > 0
        ? this.stageCache.wrap(
            {
              stage: 'subject-isolate',
              strategy: strategies.subjectIsolate,
              imageHash,
              requestId,
              extra: {
                subjects: detectedSubjects.map((s) => ({
                  label: s.label,
                  x: s.x,
                  y: s.y,
                  width: s.width,
                  height: s.height,
                })),
              },
            },
            () =>
              this.subjectIsolate.isolateAll({
                imageBase64: meta.imageBase64!,
                imageMimeType: meta.imageMimeType,
                imageWidth: meta.width,
                imageHeight: meta.height,
                subjects: detectedSubjects,
                strategy: strategies.subjectIsolate,
              })
          )
        : Promise.resolve([]);

    const [{ plate: background, candidateInfo }, subjects] = await Promise.all([
      bgPromise,
      subjectIsolatePromise,
    ]);

    const filteredOcr = filterDecorativeDigits(ocrResult, subjects);
    if (filteredOcr.boxes.length < ocrResult.boxes.length) {
      console.log(
        `[TemplateDecomposeService] post-OCR filter removed ${ocrResult.boxes.length - filteredOcr.boxes.length} decorative numeric boxes`
      );
    }

    // For every detected subject that has no corresponding isolation mask (IoU < 0.3),
    // produce a bounding-box crop of the original image as a fallback layer.
    // This ensures the element is always present and explicitly editable in the editor,
    // even when the cutout model failed.
    const { allSubjects: fallbackSubjects, isolationFailures } = await buildSubjectFallbacks(
      detectedSubjects,
      subjects,
      meta.imageBase64!
    );

    const allSubjects = await this.harmonize.harmonize(fallbackSubjects, background);

    const stages: DecomposeStageOutputs = {
      imageWidth: meta.width,
      imageHeight: meta.height,
      ocr: filteredOcr,
      background,
      subjects: allSubjects,
      accents: detectedAccents,
      isolationFailures: isolationFailures.length ? isolationFailures : undefined,
    };

    const assembleOpts = { logoSubstitution: strategies.logoSubstitution !== false, logoUrl };
    let template = assemblePolotnoJSON(stages, assembleOpts);
    let quality = await this.quality.assess({
      stages,
      template,
      sourceImageBase64: meta.imageBase64!,
      sourceImageMimeType: meta.imageMimeType,
    });
    if (candidateInfo) {
      quality = { ...quality, backgroundCandidates: candidateInfo };
    }

    // Add quality issues for every subject that couldn't be isolated.
    // These are actionable: the designer should manually cut out or re-run with SAM2.
    if (isolationFailures.length) {
      const failureIssues: import('./quality/quality.types').QualityIssue[] = isolationFailures.map(
        (label) => ({
          code: 'subject-isolation-failed',
          severity: 'warning' as const,
          layer: label,
          message: `"${label}" detected but isolation mask failed — layer is a raw bounding-box crop, not a cutout`,
          suggestion: 'Re-run with SAM2 cutout strategy or manually remove the background in the editor',
          apply: { subjectIsolate: 'sam2-prompted' as const },
        })
      );
      const penaltyPerFailure = 10;
      quality = {
        ...quality,
        score: Math.max(0, quality.score - isolationFailures.length * penaltyPerFailure),
        issues: [...quality.issues, ...failureIssues],
      };
      console.log(
        `[TemplateDecomposeService] ${isolationFailures.length} isolation failure(s): ${isolationFailures.join(', ')}`
      );
    }

    console.log(
      `[TemplateDecomposeService] quality score=${quality.score} issues=${quality.issues.length} tierB=${quality.tierBRan}`
    );

    if (strategies.autoRefine) {
      const missedTexts = quality.issues
        .filter((i) => i.code === 'vlm-missing-text')
        .map((i) => i.message);
      const missedSubjects = quality.issues
        .filter((i) => i.code === 'vlm-missing-element')
        .map((i) => i.message);

      if (missedTexts.length || missedSubjects.length) {
        console.log(
          `[TemplateDecomposeService] auto-refine: missedTexts=${missedTexts.length} missedSubjects=${missedSubjects.length}`
        );
        const [ocrDelta, subjectDelta] = await Promise.all([
          missedTexts.length
            ? this.stageCache.wrap(
                {
                  stage: 'ocr-refine',
                  strategy: strategies.ocr,
                  imageHash,
                  requestId,
                  extra: { missedTexts: missedTexts.slice().sort() },
                },
                () =>
                  this.ocr.extractWithHints(
                    {
                      imageBase64: meta.imageBase64!,
                      imageMimeType: meta.imageMimeType,
                      imageWidth: meta.width,
                      imageHeight: meta.height,
                    },
                    missedTexts
                  )
              )
            : Promise.resolve([]),
          missedSubjects.length
            ? this.stageCache.wrap(
                {
                  stage: 'subject-detect-refine',
                  strategy: 'gemini-vision',
                  imageHash,
                  requestId,
                  extra: { missedSubjects: missedSubjects.slice().sort() },
                },
                () =>
                  this.subjectDetect.detectWithHints(
                    {
                      imageBase64: meta.imageBase64!,
                      imageMimeType: meta.imageMimeType,
                      imageWidth: meta.width,
                      imageHeight: meta.height,
                    },
                    missedSubjects
                  )
              )
            : Promise.resolve([]),
        ]);

        if (ocrDelta.length) {
          stages.ocr = {
            ...stages.ocr,
            boxes: [...stages.ocr.boxes, ...ocrDelta],
          };
        }

        if (subjectDelta.length && strategies.subjectIsolate !== 'skip') {
          const newSubjectMasks = await this.stageCache.wrap(
            {
              stage: 'subject-isolate-refine',
              strategy: strategies.subjectIsolate,
              imageHash,
              requestId,
              extra: {
                subjects: subjectDelta.map((s) => ({
                  label: s.label,
                  x: s.x,
                  y: s.y,
                  width: s.width,
                  height: s.height,
                })),
              },
            },
            () =>
              this.subjectIsolate.isolateAll({
                imageBase64: meta.imageBase64!,
                imageMimeType: meta.imageMimeType,
                imageWidth: meta.width,
                imageHeight: meta.height,
                subjects: subjectDelta,
                strategy: strategies.subjectIsolate,
              })
          );
          stages.subjects = [...stages.subjects, ...newSubjectMasks];
        }

        template = assemblePolotnoJSON(stages, assembleOpts);

        // Filter out vlm-missing-text/element issues whose content was actually recovered
        // by refine. Avoids the "noise loop" that re-running Tier B causes.
        const recoveredTexts = new Set(ocrDelta.map((b) => b.text.trim().toLowerCase()));
        const recoveredLabels = new Set(
          subjectDelta.map((s) => s.label.trim().toLowerCase())
        );

        const remainingIssues = quality.issues.filter((iss) => {
          if (iss.code === 'vlm-missing-text') {
            const t = iss.message.trim().toLowerCase();
            for (const recovered of recoveredTexts) {
              if (recovered.includes(t) || t.includes(recovered)) return false;
            }
          }
          if (iss.code === 'vlm-missing-element') {
            const t = iss.message.trim().toLowerCase();
            for (const recovered of recoveredLabels) {
              if (recovered.includes(t) || t.includes(recovered)) return false;
            }
          }
          return true;
        });

        // Score: undo penalty for resolved issues
        const beforeIssueCount = quality.issues.length;
        const resolvedCount = beforeIssueCount - remainingIssues.length;
        const adjustedScore = Math.min(100, quality.score + resolvedCount * 10);

        quality = {
          ...quality,
          score: adjustedScore,
          issues: remainingIssues,
          refined: {
            ocrAdded: ocrDelta.length,
            subjectsAdded: subjectDelta.length,
          },
        };
        console.log(
          `[TemplateDecomposeService] auto-refine added ${ocrDelta.length} texts + ${subjectDelta.length} subjects; resolved ${resolvedCount} of ${beforeIssueCount} issues → ${remainingIssues.length} remain, score ${adjustedScore}`
        );
      }
    }

    return { template, quality };
  }

  private async resolveImage(req: DecomposeRequest): Promise<ImageMeta> {
    if (!req.imageUrl && !req.imageBase64) {
      throw new Error('Either imageUrl or imageBase64 is required');
    }

    if (req.imageBase64) {
      const dims = await this.measureBase64(req.imageBase64);
      const mimeType = req.imageMimeType ?? 'image/png';
      const dataUrl = `data:${mimeType};base64,${req.imageBase64}`;
      return {
        imageUrl: dataUrl,
        imageBase64: req.imageBase64,
        imageMimeType: mimeType,
        width: dims.width,
        height: dims.height,
      };
    }

    const { base64, mimeType, width, height } = await this.fetchImage(req.imageUrl!);
    return {
      imageUrl: req.imageUrl!,
      imageBase64: base64,
      imageMimeType: mimeType,
      width,
      height,
    };
  }

  private async fetchImage(
    url: string
  ): Promise<{ base64: string; mimeType: string; width: number; height: number }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }
    const mimeType = response.headers.get('content-type') ?? 'image/png';
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dims = await this.measureBuffer(buffer);
    return { base64, mimeType, width: dims.width, height: dims.height };
  }

  private async measureBase64(b64: string): Promise<{ width: number; height: number }> {
    return this.measureBuffer(Buffer.from(b64, 'base64'));
  }

  private async measureBuffer(buf: Buffer): Promise<{ width: number; height: number }> {
    const png = readPngDimensions(buf);
    if (png) return png;
    const jpeg = readJpegDimensions(buf);
    if (jpeg) return jpeg;
    console.warn('[TemplateDecomposeService] could not measure image dimensions, defaulting to 1080x1080');
    return { width: 1080, height: 1080 };
  }
}

function readPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  const isPng =
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47;
  if (!isPng) return null;
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

/**
 * Drops OCR boxes that are purely decorative numeric labels (1-2 digit numbers)
 * fully contained within a detected subject's bounding box. These arise when
 * Gemini OCR reads numbers off clock faces, chart axes, or dial indicators that
 * are part of the subject image and not independently editable text layers.
 */
function filterDecorativeDigits(
  ocr: OcrResult,
  subjects: SubjectMask[]
): OcrResult {
  if (!subjects.length) return ocr;
  const DIGIT_PATTERN = /^\d{1,2}$/;
  const filtered = ocr.boxes.filter((box) => {
    if (!DIGIT_PATTERN.test(box.text.trim())) return true;
    return !subjects.some((s) => boxContainedIn(box, s.box, 4));
  });
  return { ...ocr, boxes: filtered };
}

function boxContainedIn(
  inner: { x: number; y: number; width: number; height: number },
  outer: { x: number; y: number; width: number; height: number },
  slack = 4
): boolean {
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.width <= outer.x + outer.width + slack &&
    inner.y + inner.height <= outer.y + outer.height + slack
  );
}

function readJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    offset += 2;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = buf.readUInt16BE(offset + 3);
      const width = buf.readUInt16BE(offset + 5);
      return { width, height };
    }
    const segmentLength = buf.readUInt16BE(offset);
    offset += segmentLength;
  }
  return null;
}

type BBox = { x: number; y: number; width: number; height: number };

function iou(a: BBox, b: BBox): number {
  const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const intersection = ix * iy;
  if (intersection === 0) return 0;
  const union = a.width * a.height + b.width * b.height - intersection;
  return intersection / union;
}

/**
 * For detected subjects with no matching isolation mask (IoU < 0.3),
 * crop the original image to the bounding box and return a fallback SubjectMask
 * with isolationFailed=true. This preserves the element as an editable layer
 * even when the cutout model didn't produce a mask.
 */
async function buildSubjectFallbacks(
  detected: Array<{ label: string; x: number; y: number; width: number; height: number }>,
  isolated: SubjectMask[],
  imageBase64: string
): Promise<{ allSubjects: SubjectMask[]; isolationFailures: string[] }> {
  if (!detected.length) return { allSubjects: isolated, isolationFailures: [] };

  const failures: string[] = [];
  const fallbacks: SubjectMask[] = [];
  const srcBuf = Buffer.from(imageBase64, 'base64');

  for (const det of detected) {
    const matched = isolated.some((m) => iou(m.box, det) >= 0.3);
    if (matched) continue;

    failures.push(det.label);
    try {
      const left = Math.max(0, Math.round(det.x));
      const top = Math.max(0, Math.round(det.y));
      const cropBuf = await sharp(srcBuf)
        .extract({ left, top, width: Math.round(det.width), height: Math.round(det.height) })
        .png()
        .toBuffer();
      fallbacks.push({
        url: `data:image/png;base64,${cropBuf.toString('base64')}`,
        box: { x: det.x, y: det.y, width: det.width, height: det.height },
        label: det.label,
        isolationFailed: true,
      });
      console.log(
        `[SubjectFallback] No isolation mask for "${det.label}" — using raw crop at (${left},${top} ${det.width}x${det.height})`
      );
    } catch (err) {
      console.warn(`[SubjectFallback] Crop failed for "${det.label}":`, err);
    }
  }

  return { allSubjects: [...isolated, ...fallbacks], isolationFailures: failures };
}

/**
 * Convert ORG_LOGO_URL to a form the browser can load.
 * - http(s):// → pass through
 * - data:       → pass through
 * - /absolute/path → read file, return data URL
 * - undefined/empty → return ''
 */
async function resolveLogoUrl(raw: string | undefined): Promise<string> {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return raw;
  }
  // Local filesystem path
  try {
    const absPath = path.resolve(raw);
    let buf = fs.readFileSync(absPath);
    const ext = path.extname(absPath).toLowerCase();
    const mime =
      ext === '.svg' ? 'image/svg+xml' :
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
      'application/octet-stream';

    if (ext === '.svg') {
      // SVGs without explicit width/height render at naturalWidth=0 in Konva/browsers
      // when loaded as data URLs. Inject width+height from the viewBox so Polotno
      // can scale the element correctly.
      buf = injectSvgDimensions(buf);
    }

    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch (err) {
    console.warn(`[resolveLogoUrl] Could not read logo file "${raw}":`, err);
    return '';
  }
}

/**
 * If the SVG element is missing width/height attributes, derive them from the
 * viewBox and inject them. This prevents Konva from computing naturalWidth=0.
 */
function injectSvgDimensions(buf: Buffer): Buffer {
  let svg = buf.toString('utf8');
  // Already has explicit dimensions — leave it alone
  if (/\bwidth\s*=/.test(svg) && /\bheight\s*=/.test(svg)) return buf;
  const vbMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
  if (!vbMatch) return buf;
  const parts = vbMatch[1].trim().split(/[\s,]+/);
  if (parts.length < 4) return buf;
  const vbW = parseFloat(parts[2]);
  const vbH = parseFloat(parts[3]);
  if (!vbW || !vbH) return buf;
  // Insert width/height right after <svg
  svg = svg.replace(/(<svg\b)/, `$1 width="${Math.round(vbW)}" height="${Math.round(vbH)}"`);
  return Buffer.from(svg, 'utf8');
}
