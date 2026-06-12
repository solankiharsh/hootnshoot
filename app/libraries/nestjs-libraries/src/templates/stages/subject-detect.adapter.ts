import { Injectable } from '@nestjs/common';
import { GeminiVisionProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-vision.provider';
import { ReplicateProvider } from '@gitroom/nestjs-libraries/3rdparties/replicate/replicate.provider';

const GROUNDING_DINO_MODEL = 'adirik/grounding-dino';

interface DinoDetection {
  bbox: [number, number, number, number];
  label: string;
  confidence: number;
}
interface DinoOutput {
  detections: DinoDetection[];
}

const SUBJECT_DETECT_PROMPT = `You are identifying every distinct VISUAL element in this graphic design that should become its own editable layer.

INCLUDE (one entry per element):
- Product photos (bottles, devices, coins, cars, etc.)
- Illustrations, characters, mascots
- Icons that are visually prominent (not bullet glyphs)
- Decorative graphics like arrows, swooshes, ribbons, badges, stars, stickers
- Horizontal accent strips, dividers, underline rules, brand color bars (even short or thin ones near headlines)
- Geometric color blocks that are clearly a brand element rather than a background fill
- Logo MARKS (the iconographic part of a logo, not the wordmark)
- Stylized photo objects that overlap text/background regions

EXCLUDE:
- Any readable text (handled separately)
- Plain background fills, gradients, or geometric color-block backgrounds (those stay in the bg plate)
- The overall canvas frame
- Drop shadows, cast shadows, or shadow regions projected by any object onto the background or floor
- Reflections or mirror images of objects on any surface
- Surface light effects: glows, lens flares, light streaks, caustics

For each visual element return:
- label: a short noun phrase the element can be called (e.g. "silver XRP coin", "red breakout arrow", "brand logo mark")
- box: { x, y, width, height } in PIXELS, top-left origin
- z_hint: integer 0 (back) → 100 (front). Use bigger numbers for elements that visually sit on top of others.

Return ONLY a JSON object with shape:
{ "image_width": <int>, "image_height": <int>, "subjects": [ { "label": "...", "box": {"x":0,"y":0,"width":0,"height":0}, "z_hint": 50 } ] }

If there are NO non-text visual elements, return "subjects": []. Do not invent subjects that are not visible.`;

interface GeminiSubjectItem {
  label: string;
  box: { x: number; y: number; width: number; height: number };
  z_hint?: number;
}

interface GeminiSubjectResponse {
  image_width: number;
  image_height: number;
  subjects: GeminiSubjectItem[];
}

export interface DetectedSubject {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zHint: number;
}

export interface SubjectDetectInput {
  imageBase64: string;
  imageMimeType?: string;
  imageWidth: number;
  imageHeight: number;
}

const buildSubjectRefinePrompt = (missed: string[]) => `You previously identified visual subjects in this graphic-design image. Our quality auditor found these visual elements in the source that you DID NOT return:

${missed.map((s, i) => `${i + 1}. ${s}`).join('\n')}

For EACH of those missing elements, locate it in the image and return ONE entry with:
- label: a short noun phrase the element can be called
- box: { x, y, width, height } in PIXELS, top-left origin (TIGHT bbox — only the element itself, no surrounding context)
- z_hint: 0 (back) to 100 (front)

Return ONLY a JSON object:
{ "image_width": <int>, "image_height": <int>, "subjects": [...] }

Do NOT return subjects you already returned in your first pass. Only the missing ones listed above. If you genuinely cannot find a listed element, omit it.`;

@Injectable()
export class SubjectDetectAdapter {
  constructor(
    private readonly vision: GeminiVisionProvider,
    private readonly replicate: ReplicateProvider
  ) {}

  async detect(input: SubjectDetectInput): Promise<DetectedSubject[]> {
    const response = await this.vision.generateJson<GeminiSubjectResponse>({
      prompt: SUBJECT_DETECT_PROMPT,
      imageBase64: input.imageBase64,
      imageMimeType: input.imageMimeType ?? 'image/png',
    });

    const reportedWidth = response.image_width || input.imageWidth;
    const reportedHeight = response.image_height || input.imageHeight;
    const scaleX = input.imageWidth / reportedWidth;
    const scaleY = input.imageHeight / reportedHeight;

    const subjects: DetectedSubject[] = (response.subjects ?? [])
      .filter((s) => s?.label && s?.box)
      .map((s) => ({
        label: s.label,
        x: Math.round((s.box.x ?? 0) * scaleX),
        y: Math.round((s.box.y ?? 0) * scaleY),
        width: Math.round((s.box.width ?? 0) * scaleX),
        height: Math.round((s.box.height ?? 0) * scaleY),
        zHint: s.z_hint ?? 50,
      }))
      .filter((s) => s.width > 8 && s.height > 8);

    console.log(
      `[SubjectDetectAdapter] detected ${subjects.length} subjects: ${subjects.map((s) => s.label).join(', ')}`
    );
    return subjects;
  }

  async refineWithDino(
    input: SubjectDetectInput,
    geminiSubjects: DetectedSubject[]
  ): Promise<DetectedSubject[]> {
    if (geminiSubjects.length === 0) return [];

    // Build a comma-separated query of all labels for one grounding-dino call.
    const query = geminiSubjects.map((s) => s.label).join(', ');
    const sourceDataUrl = `data:${input.imageMimeType ?? 'image/png'};base64,${input.imageBase64}`;

    let dinoOutput: DinoOutput;
    try {
      dinoOutput = await this.replicate.run<DinoOutput>({
        model: GROUNDING_DINO_MODEL,
        input: {
          image: sourceDataUrl,
          query,
          box_threshold: 0.25,
          text_threshold: 0.2,
          show_visualisation: false,
        },
      });
    } catch (err) {
      console.warn(
        '[SubjectDetectAdapter] grounding-dino failed, falling back to Gemini bboxes:',
        err
      );
      return geminiSubjects;
    }

    const detections = dinoOutput.detections ?? [];
    console.log(
      `[SubjectDetectAdapter] grounding-dino returned ${detections.length} detections for query="${query}"`
    );

    // For each Gemini subject, find the dino detection with the matching label and highest IoU with Gemini's box.
    // If none matches, keep Gemini's original.
    return geminiSubjects.map((gem) => {
      const candidates = detections.filter((d) =>
        labelMatches(d.label, gem.label)
      );
      if (candidates.length === 0) {
        console.log(`[SubjectDetectAdapter] no dino match for "${gem.label}" — keeping Gemini bbox`);
        return gem;
      }
      const gemBox: [number, number, number, number] = [
        gem.x,
        gem.y,
        gem.x + gem.width,
        gem.y + gem.height,
      ];
      const gemArea = gem.width * gem.height;

      // Pick the candidate with: smallest area, decent IoU with Gemini's box (>=0.3), highest confidence.
      // Reject candidates that are LARGER than Gemini (we want tighter, not looser).
      const ranked = candidates
        .map((c) => {
          const [x1, y1, x2, y2] = c.bbox;
          const area = Math.max(1, (x2 - x1) * (y2 - y1));
          const iou = iouXyxy(gemBox, c.bbox);
          return { c, area, iou };
        })
        .filter((r) => r.iou >= 0.3 && r.area < gemArea * 1.05)
        .sort((a, b) => a.area - b.area);

      if (ranked.length === 0) {
        console.log(
          `[SubjectDetectAdapter] dino candidates for "${gem.label}" were all larger or low-IoU — keeping Gemini bbox (${gem.width}x${gem.height})`
        );
        return gem;
      }
      const best = ranked[0].c;
      const [x1, y1, x2, y2] = best.bbox;
      const refined: DetectedSubject = {
        label: gem.label,
        x: Math.round(x1),
        y: Math.round(y1),
        width: Math.round(x2 - x1),
        height: Math.round(y2 - y1),
        zHint: gem.zHint,
      };
      const shrinkPct =
        100 * (1 - (refined.width * refined.height) / gemArea);
      console.log(
        `[SubjectDetectAdapter] dino refined "${gem.label}" conf=${best.confidence.toFixed(2)} ${gem.width}x${gem.height} → ${refined.width}x${refined.height} (${shrinkPct.toFixed(0)}% tighter)`
      );
      return refined;
    });
  }

  async detectWithHints(
    input: SubjectDetectInput,
    missedDescriptions: string[]
  ): Promise<DetectedSubject[]> {
    if (!missedDescriptions.length) return [];
    const response = await this.vision.generateJson<GeminiSubjectResponse>({
      prompt: buildSubjectRefinePrompt(missedDescriptions),
      imageBase64: input.imageBase64,
      imageMimeType: input.imageMimeType ?? 'image/png',
    });

    const reportedWidth = response.image_width || input.imageWidth;
    const reportedHeight = response.image_height || input.imageHeight;
    const scaleX = input.imageWidth / reportedWidth;
    const scaleY = input.imageHeight / reportedHeight;

    const subjects: DetectedSubject[] = (response.subjects ?? [])
      .filter((s) => s?.label && s?.box)
      .map((s) => ({
        label: s.label,
        x: Math.round((s.box.x ?? 0) * scaleX),
        y: Math.round((s.box.y ?? 0) * scaleY),
        width: Math.round((s.box.width ?? 0) * scaleX),
        height: Math.round((s.box.height ?? 0) * scaleY),
        zHint: s.z_hint ?? 50,
      }))
      .filter((s) => s.width > 8 && s.height > 8);

    console.log(
      `[SubjectDetectAdapter] refine pass recovered ${subjects.length}/${missedDescriptions.length} missed subjects: ${subjects.map((s) => s.label).join(', ')}`
    );
    return subjects;
  }
}

function iouXyxy(
  a: [number, number, number, number],
  b: [number, number, number, number]
): number {
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[2], b[2]);
  const y2 = Math.min(a[3], b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const aArea = Math.max(0, a[2] - a[0]) * Math.max(0, a[3] - a[1]);
  const bArea = Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
  const union = aArea + bArea - inter;
  return union === 0 ? 0 : inter / union;
}

function labelMatches(detectionLabel: string, queryLabel: string): boolean {
  // grounding-dino sometimes returns substring of the query (e.g. "coin" for "silver XRP coin").
  const d = detectionLabel.toLowerCase();
  const q = queryLabel.toLowerCase();
  if (d === q) return true;
  if (q.includes(d) || d.includes(q)) return true;
  // Token overlap
  const qTokens = new Set(q.split(/\s+/));
  for (const t of d.split(/\s+/)) {
    if (t.length >= 4 && qTokens.has(t)) return true;
  }
  return false;
}
