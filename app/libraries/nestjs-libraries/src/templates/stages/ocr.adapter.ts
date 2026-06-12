import { Injectable } from '@nestjs/common';
import { GeminiVisionProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-vision.provider';
import { OcrBox, OcrResult } from '../templates.types';
import { sampleTextColor } from './text-color-sampler';

const OCR_PROMPT = `You are extracting the editable text layers from a graphic design image.

For EVERY piece of visible text in the image (every headline, subhead, body paragraph, button label, source line, disclaimer, watermark, logo wordmark, etc.), return one entry.

Group text that is part of the same paragraph / same visual line block into a single entry. In the "text" field, join visible lines with the literal newline character \\n so a 2-line headline becomes "First line\\nSecond line".

CRITICAL LINE-BREAK RULES:
- Use ONLY the JSON newline escape \\n between visible lines of the same paragraph.
- Do NOT use slash, pipe, dash, or any other separator character to encode a line break.
- Single-line text contains NO \\n.

CRITICAL BBOX RULES (read carefully):
- The bounding box MUST be the smallest rectangle that fully contains the visible glyphs of ALL lines in this entry.
- For multi-line text the box.height MUST cover the top of line 1 down to the bottom of the LAST line, including the gap between lines.
- The box.width MUST be at least as wide as the widest visible line.
- If text appears in different colors on different lines (or words), STILL return one entry per visually distinct color span — do not merge differently-coloured runs into one entry.

For each entry, return:
- text: the exact text content, preserving case, punctuation, and intra-paragraph line breaks (\\n)
- box: { x, y, width, height } in PIXELS, top-left origin
- line_count: integer — how many visible lines of text are inside the bbox (1 for single-line, 2 for a 2-line headline, etc.)
- font_size_px: approximate visual font size in pixels (cap height of an upper-case letter on one line — NOT the box height)
- font_family: the closest matching font family name visible in the image (e.g. "Arial", "DM Sans", "Helvetica Neue", "Roboto", "Inter"). Use your best judgment from the letterform shapes. If you cannot determine it, return "unknown".
- font_weight: one of "regular", "medium", "semibold", "bold", "black". Use "black" for any ultra-heavy / extra-bold weight (e.g. Helvetica Neue Black, Futura Heavy, Impact) where strokes are noticeably thicker than ordinary bold. When the headline text looks significantly heavier than typical bold, choose "black" over "bold".
- font_style: "normal" or "italic"
- fill_hex: the dominant text color as a hex string like "#000000"
- role: one of "headline", "subhead", "body", "cta", "source", "disclaimer", "logo", "label", "other". Use "logo" ONLY for a logo mark or wordmark that is a brand asset image/symbol, not for ordinary text.

Return ONLY a JSON object with shape:
{ "image_width": <int>, "image_height": <int>, "items": [ { "text": "...", "box": {"x":0,"y":0,"width":0,"height":0}, "line_count": 1, "font_size_px": 0, "font_family": "unknown", "font_weight": "regular", "font_style": "normal", "fill_hex": "#000000", "role": "body" } ] }`;

interface GeminiOcrItem {
  text: string;
  box: { x: number; y: number; width: number; height: number };
  line_count?: number;
  font_size_px?: number;
  font_family?: string;
  font_weight?: string;
  font_style?: 'normal' | 'italic';
  fill_hex?: string;
  role?: string;
}

interface GeminiOcrResponse {
  image_width: number;
  image_height: number;
  items: GeminiOcrItem[];
}

export interface OcrInput {
  imageBase64: string;
  imageMimeType?: string;
  imageWidth: number;
  imageHeight: number;
}

const buildOcrRefinePrompt = (missed: string[]) => `You previously extracted text from this graphic-design image. Our quality auditor found these text strings in the source that you DID NOT return:

${missed.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

For EACH of those missing strings, locate it in the image and return ONE entry with:
- text: the exact text (preserve case and punctuation as you see it in the image)
- box: { x, y, width, height } in PIXELS, top-left origin
- font_size_px: approximate visual font size in pixels
- font_family: closest matching font family name (e.g. "Arial", "DM Sans"). Use "unknown" if unsure.
- font_weight: "regular" | "medium" | "semibold" | "bold" | "black"
- font_style: "normal" | "italic"
- fill_hex: dominant text color as hex
- role: "headline" | "subhead" | "body" | "cta" | "source" | "disclaimer" | "logo" | "label" | "other"

Return ONLY a JSON object:
{ "image_width": <int>, "image_height": <int>, "items": [...] }

Do NOT return text strings you already returned in your first pass. Only the missing ones listed above. If you genuinely cannot find a listed string, omit it.`;

@Injectable()
export class OcrAdapter {
  constructor(private readonly vision: GeminiVisionProvider) {}

  async extract(input: OcrInput): Promise<OcrResult> {
    const response = await this.vision.generateJson<GeminiOcrResponse>({
      prompt: OCR_PROMPT,
      imageBase64: input.imageBase64,
      imageMimeType: input.imageMimeType ?? 'image/png',
    });

    const reportedWidth = response.image_width || input.imageWidth;
    const reportedHeight = response.image_height || input.imageHeight;
    const scaleX = input.imageWidth / reportedWidth;
    const scaleY = input.imageHeight / reportedHeight;

    const boxes: OcrBox[] = (response.items ?? [])
      .filter((it) => it?.text && it?.box)
      .map((it) => {
        const lineCount = Math.max(1, Math.round(it.line_count ?? 1));
        return {
          text: normalizeLineBreaks(it.text, lineCount),
          x: Math.round((it.box.x ?? 0) * scaleX),
          y: Math.round((it.box.y ?? 0) * scaleY),
          width: Math.round((it.box.width ?? 0) * scaleX),
          height: Math.round((it.box.height ?? 0) * scaleY),
          angle: 0,
          confidence: 1,
          fontSizePx: it.font_size_px ? Math.round(it.font_size_px * scaleY) : undefined,
          fontFamily: it.font_family && it.font_family !== 'unknown' ? it.font_family : undefined,
          fontWeight: it.font_weight,
          fontStyle: it.font_style,
          fillHex: it.fill_hex,
          role: it.role,
          lineCount,
        };
      });

    await this.applyPixelColorSampling(input, boxes);

    console.log(`[OcrAdapter] extracted ${boxes.length} text boxes via Gemini vision`);
    return {
      boxes,
      imageWidth: input.imageWidth,
      imageHeight: input.imageHeight,
    };
  }

  async extractWithHints(
    input: OcrInput,
    missedStrings: string[]
  ): Promise<OcrBox[]> {
    if (!missedStrings.length) return [];
    const response = await this.vision.generateJson<GeminiOcrResponse>({
      prompt: buildOcrRefinePrompt(missedStrings),
      imageBase64: input.imageBase64,
      imageMimeType: input.imageMimeType ?? 'image/png',
    });
    const reportedWidth = response.image_width || input.imageWidth;
    const reportedHeight = response.image_height || input.imageHeight;
    const scaleX = input.imageWidth / reportedWidth;
    const scaleY = input.imageHeight / reportedHeight;

    const boxes: OcrBox[] = (response.items ?? [])
      .filter((it) => it?.text && it?.box)
      .map((it) => {
        const lineCount = Math.max(1, Math.round(it.line_count ?? 1));
        return {
          text: normalizeLineBreaks(it.text, lineCount),
          x: Math.round((it.box.x ?? 0) * scaleX),
          y: Math.round((it.box.y ?? 0) * scaleY),
          width: Math.round((it.box.width ?? 0) * scaleX),
          height: Math.round((it.box.height ?? 0) * scaleY),
          angle: 0,
          confidence: 1,
          fontSizePx: it.font_size_px ? Math.round(it.font_size_px * scaleY) : undefined,
          fontFamily: it.font_family && it.font_family !== 'unknown' ? it.font_family : undefined,
          fontWeight: it.font_weight,
          fontStyle: it.font_style,
          fillHex: it.fill_hex,
          role: it.role,
          lineCount,
        };
      });

    await this.applyPixelColorSampling(input, boxes);

    console.log(
      `[OcrAdapter] refine pass recovered ${boxes.length}/${missedStrings.length} missed strings`
    );
    return boxes;
  }

  private async applyPixelColorSampling(
    input: OcrInput,
    boxes: OcrBox[]
  ): Promise<void> {
    if (!boxes.length) return;
    const results = await Promise.all(
      boxes.map((box) =>
        sampleTextColor({
          imageBase64: input.imageBase64,
          imageWidth: input.imageWidth,
          imageHeight: input.imageHeight,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
        }).catch(() => undefined)
      )
    );
    let overrides = 0;
    for (let i = 0; i < boxes.length; i++) {
      const sampled = results[i];
      if (!sampled) continue;
      const previous = boxes[i].fillHex;

      // Guard: don't override a chromatic Gemini color with an achromatic sampled
      // color — the Otsu sampler can fail on dark backgrounds (colored text near
      // background luminance → sampler picks a dark achromatic value by mistake).
      //
      // Exception: if the sampled color is very dark (luminance < 60, i.e. near-
      // black) the sampler is reliable because dark ink on any background produces
      // a clean bimodal luminance histogram. Gemini hallucinating a chromatic color
      // for what is actually black body text is a known failure mode — trust the
      // sampler in this case.
      if (previous && hexSaturation(previous) > 0.25 && hexSaturation(sampled) < 0.1) {
        const sampledLum = hexLuminance(sampled);
        if (sampledLum >= 60) {
          // Mid-range achromatic — sampler may have failed on dark bg; keep Gemini value
          continue;
        }
        // Near-black sampled value is reliable; fall through to override
      }

      if (!previous || !sameColorWithinTolerance(previous, sampled, 12)) {
        boxes[i].fillHex = sampled;
        overrides++;
      }
    }
    if (overrides > 0) {
      console.log(
        `[OcrAdapter] pixel color sampling overrode ${overrides}/${boxes.length} fill_hex values`
      );
    }
  }
}

function sameColorWithinTolerance(a: string, b: string, tolerance: number): boolean {
  const pa = parseHex(a);
  const pb = parseHex(b);
  if (!pa || !pb) return false;
  return (
    Math.abs(pa[0] - pb[0]) <= tolerance &&
    Math.abs(pa[1] - pb[1]) <= tolerance &&
    Math.abs(pa[2] - pb[2]) <= tolerance
  );
}

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Returns perceived luminance 0–255 (standard luma formula). */
function hexLuminance(hex: string): number {
  const parsed = parseHex(hex);
  if (!parsed) return 128;
  return 0.299 * parsed[0] + 0.587 * parsed[1] + 0.114 * parsed[2];
}

/** Returns HSL saturation in [0, 1] for a hex color string. */
function hexSaturation(hex: string): number {
  const parsed = parseHex(hex);
  if (!parsed) return 0;
  const r = parsed[0] / 255;
  const g = parsed[1] / 255;
  const b = parsed[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return 0;
  const d = max - min;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

function normalizeLineBreaks(raw: string, expectedLines: number): string {
  if (raw.includes('\n')) return raw;
  if (expectedLines < 2) return raw;
  const slashSplit = raw.split(/\s+\/\s+/);
  if (slashSplit.length === expectedLines) return slashSplit.join('\n');
  const pipeSplit = raw.split(/\s+\|\s+/);
  if (pipeSplit.length === expectedLines) return pipeSplit.join('\n');
  if (slashSplit.length > 1) return slashSplit.join('\n');
  if (pipeSplit.length > 1) return pipeSplit.join('\n');
  return raw;
}
