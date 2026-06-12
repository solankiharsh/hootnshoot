import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { GeminiVisionProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-vision.provider';
import { DecomposeStageOutputs } from '../templates.types';
import { PolotnoStoreJSON } from '../assembler/polotno-schema';
import { QualityIssue, QualityReport, QualitySeverity } from './quality.types';

const SEVERITY_WEIGHT: Record<QualitySeverity, number> = {
  critical: 30,
  warning: 10,
  info: 3,
};

const TIER_B_THRESHOLD = 101; // always-on: Tier A is static and cannot enumerate "missing element" failures
const MIN_OPAQUE_RATIO = 0.25;
const DUP_IOU_THRESHOLD = 0.5;
const SUBJECT_OVERLAP_THRESHOLD = 0.7;
const MIN_CONTRAST_RATIO = 4.5;

@Injectable()
export class QualityCheckService {
  constructor(private readonly vision: GeminiVisionProvider) {}

  async assess(args: {
    stages: DecomposeStageOutputs;
    template: PolotnoStoreJSON;
    sourceImageBase64: string;
    sourceImageMimeType?: string;
  }): Promise<QualityReport> {
    const issues: QualityIssue[] = [];

    issues.push(...this.checkBackground(args.stages, args.template));
    issues.push(
      ...(await this.checkBgColorDrift(args.stages, args.sourceImageBase64))
    );
    issues.push(...(await this.checkSubjectMasks(args.stages)));
    issues.push(...(await this.checkSubjectErasure(args.stages, args.sourceImageBase64)));
    issues.push(...this.checkOcrDuplicates(args.stages));
    issues.push(...this.checkSubjectBoxOverlap(args.stages));
    issues.push(...this.checkBoundsAndCoverage(args.template));
    issues.push(...this.checkTextClipRisk(args.template));

    let score = 100;
    for (const issue of issues) score -= SEVERITY_WEIGHT[issue.severity];
    score = Math.max(0, Math.min(100, score));

    let tierBRan = false;
    if (score < TIER_B_THRESHOLD) {
      try {
        const tierBIssues = await this.runVlmScorecard(args);
        issues.push(...tierBIssues);
        for (const issue of tierBIssues) score -= SEVERITY_WEIGHT[issue.severity];
        score = Math.max(0, Math.min(100, score));
        tierBRan = true;
      } catch (err) {
        console.warn('[QualityCheckService] Tier B failed:', err);
      }
    }

    const harmonyScores = this.collectHarmonyScores(args.stages);
    return { score, issues, tierBRan, ...(harmonyScores ? { harmonyScores } : {}) };
  }

  // ─────────── Tier A ───────────

  private checkBackground(
    stages: DecomposeStageOutputs,
    template: PolotnoStoreJSON
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const bg = template.pages[0]?.children.find(
      (c) => (c as { name?: string }).name === 'Background'
    ) as { width?: number; height?: number } | undefined;
    if (!bg) {
      issues.push({
        code: 'bg-missing',
        severity: 'critical',
        message: 'No background plate element in template.',
      });
      return issues;
    }
    if (bg.width !== template.width || bg.height !== template.height) {
      issues.push({
        code: 'bg-dim-mismatch',
        severity: 'warning',
        layer: 'Background',
        message: `Background plate is ${bg.width}x${bg.height} but canvas is ${template.width}x${template.height}.`,
        suggestion: 'Use the source image as background.',
        apply: { bgRecover: 'keep-source' },
      });
    }
    if (!stages.background?.url) {
      issues.push({
        code: 'bg-empty-url',
        severity: 'critical',
        message: 'Background plate URL is empty.',
      });
    }
    return issues;
  }

  private async checkSubjectMasks(
    stages: DecomposeStageOutputs
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    for (const subj of stages.subjects) {
      const dataMatch = subj.url.match(/^data:([^;]+);base64,(.+)$/);
      if (!dataMatch) continue;
      try {
        const buf = Buffer.from(dataMatch[2], 'base64');
        const { width, height } = await sharp(buf).metadata();
        if (!width || !height) continue;

        const { data, info } = await sharp(buf)
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        let opaque = 0;
        const stride = info.channels;
        for (let i = 0; i < data.length; i += stride) {
          const a = data[i + 3];
          if (a > 16) opaque++;
        }
        const totalPx = info.width * info.height;
        const opaqueRatio = totalPx === 0 ? 0 : opaque / totalPx;

        if (opaqueRatio < MIN_OPAQUE_RATIO) {
          issues.push({
            code: 'subject-thin-mask',
            severity: 'warning',
            layer: subj.label ?? 'subject',
            message: `Subject "${subj.label}" cutout has only ${(opaqueRatio * 100).toFixed(0)}% opaque pixels — likely over-stripped.`,
            suggestion: 'Tighten subject bboxes with grounding-dino.',
            apply: { subjectDetect: 'gemini-then-dino' },
          });
        }
      } catch (err) {
        console.warn(`[QualityCheckService] mask measure failed for ${subj.label}:`, err);
      }
    }
    return issues;
  }

  private checkOcrDuplicates(stages: DecomposeStageOutputs): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const boxes = stages.ocr.boxes;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (normalizeText(a.text) !== normalizeText(b.text)) continue;
        if (iou(a, b) >= DUP_IOU_THRESHOLD) {
          issues.push({
            code: 'ocr-duplicate',
            severity: 'warning',
            layer: a.role ?? 'text',
            message: `Duplicate text layers detected: "${a.text.slice(0, 40)}".`,
            suggestion: 'Dedup OCR output (merge boxes with same text and overlapping bbox).',
          });
          return issues;
        }
      }
    }
    return issues;
  }

  private checkSubjectBoxOverlap(
    stages: DecomposeStageOutputs
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const subs = stages.subjects;
    for (let i = 0; i < subs.length; i++) {
      for (let j = i + 1; j < subs.length; j++) {
        const a = subs[i].box;
        const b = subs[j].box;
        if (iou(a, b) >= SUBJECT_OVERLAP_THRESHOLD) {
          issues.push({
            code: 'subject-overlap',
            severity: 'warning',
            message: `Subjects "${subs[i].label}" and "${subs[j].label}" have heavily overlapping bboxes — detector may have merged them.`,
            suggestion: 'Tighten subject bboxes with grounding-dino.',
            apply: { subjectDetect: 'gemini-then-dino' },
          });
        } else if (boxContains(a, b)) {
          issues.push({
            code: 'subject-contains',
            severity: 'warning',
            layer: subs[j].label,
            message: `Subject "${subs[i].label}" bbox fully contains "${subs[j].label}" — the larger cutout will include the smaller subject as contamination.`,
            suggestion: 'Tighten subject bboxes with grounding-dino.',
            apply: { subjectDetect: 'gemini-then-dino' },
          });
        } else if (boxContains(b, a)) {
          issues.push({
            code: 'subject-contains',
            severity: 'warning',
            layer: subs[i].label,
            message: `Subject "${subs[j].label}" bbox fully contains "${subs[i].label}" — the larger cutout will include the smaller subject as contamination.`,
            suggestion: 'Tighten subject bboxes with grounding-dino.',
            apply: { subjectDetect: 'gemini-then-dino' },
          });
        }
      }
    }
    return issues;
  }

  private checkBoundsAndCoverage(template: PolotnoStoreJSON): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const W = template.width;
    const H = template.height;
    const children = template.pages[0]?.children ?? [];

    for (const el of children) {
      const e = el as {
        type: string;
        name?: string;
        x: number;
        y: number;
        width: number;
        height: number;
      };
      if (e.type === 'image' && e.name === 'Background') continue;
      if (e.x < -2 || e.y < -2 || e.x + e.width > W + 2 || e.y + e.height > H + 2) {
        issues.push({
          code: 'bbox-out-of-canvas',
          severity: 'info',
          layer: e.name,
          message: `Layer "${e.name}" extends outside the canvas (${e.x},${e.y} ${e.width}x${e.height}).`,
        });
      }
    }

    const nonBgArea = children
      .filter((c) => (c as { name?: string }).name !== 'Background')
      .reduce((sum, c) => {
        const e = c as { width: number; height: number };
        return sum + e.width * e.height;
      }, 0);
    const coverage = nonBgArea / (W * H);
    if (coverage < 0.05) {
      issues.push({
        code: 'low-coverage',
        severity: 'warning',
        message: `Detected layers cover only ${(coverage * 100).toFixed(0)}% of the canvas — OCR or subject-detect may have under-recognized elements.`,
      });
    }
    return issues;
  }

  private checkTextClipRisk(template: PolotnoStoreJSON): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const children = template.pages[0]?.children ?? [];
    for (const el of children) {
      const e = el as {
        type: string;
        name?: string;
        text?: string;
        fontSize?: number;
        height?: number;
        custom?: { lineCount?: number; sourceBox?: { height?: number } };
      };
      if (e.type !== 'text' || !e.text) continue;
      const lineCount = Math.max(
        1,
        e.custom?.lineCount ?? (e.text.match(/\n/g)?.length ?? 0) + 1
      );
      if (lineCount < 2) continue;
      const requiredHeight = (e.fontSize ?? 0) * 1.25 * lineCount;
      const sourceHeight = e.custom?.sourceBox?.height;
      if (sourceHeight && requiredHeight > sourceHeight * 1.4) {
        issues.push({
          code: 'text-clip-risk',
          severity: 'info',
          layer: e.name,
          message: `Text "${e.text.slice(0, 40).replace(/\n/g, ' / ')}" needs ${Math.round(requiredHeight)}px to render ${lineCount} lines but source bbox was only ${sourceHeight}px — assembler grew the element to fit. Verify the bbox in the source.`,
        });
      }
    }
    return issues;
  }

  private async checkBgColorDrift(
    stages: DecomposeStageOutputs,
    sourceImageBase64: string
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const bgUrl = stages.background?.url;
    if (!bgUrl) return issues;
    const dataMatch = bgUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!dataMatch) return issues; // only check when bg is inline (Nano Banana case)

    try {
      const srcBuf = Buffer.from(sourceImageBase64, 'base64');
      const bgBuf = Buffer.from(dataMatch[2], 'base64');

      const sample = async (buf: Buffer): Promise<[number, number, number]> => {
        const { data, info } = await sharp(buf)
          .removeAlpha()
          .resize(64, 64, { fit: 'fill' })
          .raw()
          .toBuffer({ resolveWithObject: true });
        // sample 12 corner-region pixels (top-left, top-right, bottom-left, bottom-right) * 3
        const points = [
          [2, 2], [10, 2], [2, 10],
          [61, 2], [53, 2], [61, 10],
          [2, 61], [10, 61], [2, 53],
          [61, 61], [53, 61], [61, 53],
        ];
        let r = 0, g = 0, b = 0;
        for (const [x, y] of points) {
          const idx = (y * info.width + x) * info.channels;
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
        }
        return [r / points.length, g / points.length, b / points.length];
      };

      const [sr, sg, sb] = await sample(srcBuf);
      const [br, bg, bb] = await sample(bgBuf);
      const dist = Math.sqrt((sr - br) ** 2 + (sg - bg) ** 2 + (sb - bb) ** 2);

      if (dist > 10) {
        const srcHex = `#${toHex(sr)}${toHex(sg)}${toHex(sb)}`;
        const bgHex = `#${toHex(br)}${toHex(bg)}${toHex(bb)}`;
        issues.push({
          code: 'bg-color-drift',
          severity: 'warning',
          layer: 'Background',
          message: `Background corner color shifted from ${srcHex} to ${bgHex} (Δ=${dist.toFixed(0)}).`,
          suggestion: 'Use the source image as background to preserve exact colors.',
          apply: { bgRecover: 'keep-source' },
        });
      }
    } catch (err) {
      console.warn('[QualityCheckService] bg color drift check failed:', err);
    }
    return issues;
  }

  private async checkSubjectErasure(
    stages: DecomposeStageOutputs,
    sourceImageBase64: string
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const bgUrl = stages.background?.url;
    if (!bgUrl || !stages.subjects.length) return issues;
    const bgMatch = bgUrl.match(/^data:[^;]+;base64,(.+)$/);
    if (!bgMatch) return issues;

    const srcBuf = Buffer.from(sourceImageBase64, 'base64');
    const bgBuf = Buffer.from(bgMatch[1], 'base64');

    for (const subj of stages.subjects) {
      const box = subj.box;
      if (!box || box.width < 8 || box.height < 8) continue;
      const region = {
        left: Math.max(0, Math.round(box.x)),
        top: Math.max(0, Math.round(box.y)),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
      try {
        const [srcCrop, bgCrop] = await Promise.all([
          sharp(srcBuf).extract(region).removeAlpha().resize(32, 32, { fit: 'fill' }).raw().toBuffer(),
          sharp(bgBuf).extract(region).removeAlpha().resize(32, 32, { fit: 'fill' }).raw().toBuffer(),
        ]);
        let totalDiff = 0;
        for (let i = 0; i < srcCrop.length; i++) {
          totalDiff += Math.abs(srcCrop[i] - bgCrop[i]);
        }
        const meanDiff = totalDiff / srcCrop.length;
        if (meanDiff < 15) {
          issues.push({
            code: 'subject-not-erased',
            severity: 'warning',
            layer: subj.label ?? 'subject',
            message: `Subject "${subj.label}" may not have been erased from the background plate (mean pixel diff=${meanDiff.toFixed(1)}/255). Subject may render as ghost in both layers.`,
            suggestion: 'Re-inpaint with a tighter mask or composite the isolated mask alpha over the background plate.',
          });
        }
      } catch (err) {
        console.warn(`[QualityCheckService] subject-erasure check failed for "${subj.label}":`, err);
      }
    }
    return issues;
  }

  // ─────────── Tier B ───────────

  private async runVlmScorecard(args: {
    stages: DecomposeStageOutputs;
    sourceImageBase64: string;
    sourceImageMimeType?: string;
  }): Promise<QualityIssue[]> {
    const summary = this.summarizeStagesForVlm(args.stages);
    const prompt = `You are auditing a graphic-design decomposition for COMPLETENESS against the source IMAGE shown.

Our pipeline extracted the following (and nothing else):
${summary}

Your task: walk through the source image and call out anything visible in it that is NOT in our list above. Be ruthless about completeness — small accent strips, horizontal rules, dividers, brand color bars, second/third lines of body copy, fine-print disclaimers, watermarks, icons, all count.

Return ONLY a JSON object:
{
  "missing_text": ["exact text string visible in source but missing from our list", ...],
  "missing_elements": ["short description of any non-text visual element visible in source but missing (e.g. 'red horizontal accent rule under headline')", ...],
  "wrong_color": ["short description of any element where our color is materially different from source (e.g. 'background is off-white in source but pure white in plate')", ...],
  "wrong_position": ["short description", ...],
  "wrong_font_or_style": ["short description", ...],
  "hallucinated": ["short description of any element we extracted that is NOT visible in the source", ...]
}

Only list items you can clearly see in the source. Empty arrays are OK. Be specific.`;

    type Resp = {
      missing_text?: string[];
      missing_elements?: string[];
      wrong_color?: string[];
      wrong_position?: string[];
      wrong_font_or_style?: string[];
      hallucinated?: string[];
    };

    const resp = await this.vision.generateJson<Resp>({
      prompt,
      imageBase64: args.sourceImageBase64,
      imageMimeType: args.sourceImageMimeType ?? 'image/png',
    });

    const issues: QualityIssue[] = [];
    const pushAll = (
      arr: string[] | undefined,
      code: string,
      severity: QualitySeverity,
      suggestion?: string
    ) => {
      for (const msg of arr ?? []) {
        if (typeof msg !== 'string' || !msg.trim()) continue;
        issues.push({ code, severity, message: msg.trim(), suggestion });
      }
    };
    pushAll(resp.missing_text, 'vlm-missing-text', 'warning');
    pushAll(resp.missing_elements, 'vlm-missing-element', 'warning');
    pushAll(resp.wrong_color, 'vlm-wrong-color', 'info');
    pushAll(resp.wrong_position, 'vlm-wrong-position', 'info');
    pushAll(resp.wrong_font_or_style, 'vlm-wrong-font', 'info');
    pushAll(resp.hallucinated, 'vlm-hallucinated', 'warning');
    return issues;
  }

  private collectHarmonyScores(
    stages: DecomposeStageOutputs
  ): Record<string, number> | undefined {
    const harmonized = stages.subjects.filter(
      (s) => typeof s.harmonyScore === 'number'
    );
    if (!harmonized.length) return undefined;
    return Object.fromEntries(
      harmonized.map((s) => [s.label ?? 'subject', s.harmonyScore as number])
    );
  }

  private summarizeStagesForVlm(stages: DecomposeStageOutputs): string {
    const textLines = stages.ocr.boxes
      .map((b) => `  - text="${b.text.replace(/\n/g, ' [↵] ').slice(0, 80)}" role=${b.role ?? 'unknown'} fill=${b.fillHex ?? '?'} weight=${b.fontWeight ?? '?'} style=${b.fontStyle ?? 'normal'} size=${b.fontSizePx ?? '?'}px font=${b.fontFamily ?? 'unknown'}`)
      .join('\n');
    const subjLines = stages.subjects
      .map((s) => `  - "${s.label}" at (${s.box.x},${s.box.y}) ${s.box.width}x${s.box.height}`)
      .join('\n');
    const accentLines = (stages.accents ?? [])
      .map((a) => `  - "${a.label ?? 'accent'}" fill=${a.fillHex} at (${a.x},${a.y}) ${a.width}x${a.height}`)
      .join('\n');
    return [
      `Canvas: ${stages.imageWidth}x${stages.imageHeight}`,
      `Text layers (${stages.ocr.boxes.length}):`,
      textLines || '  (none)',
      `Subject layers (${stages.subjects.length}):`,
      subjLines || '  (none)',
      `Accent/decorative elements (${(stages.accents ?? []).length}):`,
      accentLines || '  (none)',
      `Background plate: ${stages.background?.url ? 'generated' : 'missing'}`,
    ].join('\n');
  }
}

function normalizeText(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, ' ');
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const interW = Math.max(0, x2 - x1);
  const interH = Math.max(0, y2 - y1);
  const inter = interW * interH;
  const union = a.width * a.height + b.width * b.height - inter;
  return union === 0 ? 0 : inter / union;
}

function toHex(v: number): string {
  const n = Math.max(0, Math.min(255, Math.round(v)));
  return n.toString(16).padStart(2, '0');
}

function boxContains(outer: Box, inner: Box, slack = 4): boolean {
  return (
    inner.x >= outer.x - slack &&
    inner.y >= outer.y - slack &&
    inner.x + inner.width <= outer.x + outer.width + slack &&
    inner.y + inner.height <= outer.y + outer.height + slack &&
    inner.width * inner.height < outer.width * outer.height * 0.9
  );
}
