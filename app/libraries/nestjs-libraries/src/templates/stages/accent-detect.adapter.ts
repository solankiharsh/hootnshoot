import { Injectable } from '@nestjs/common';
import { GeminiVisionProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-vision.provider';
import { AccentBox } from '../templates.types';

const ACCENT_PROMPT = `You are identifying DECORATIVE STRUCTURAL ELEMENTS in a graphic design image — things like thin lines, dividers, color bars, accent strips, and borders that are NOT text and NOT the main subjects/objects.

Look specifically for:
- Thin horizontal or vertical rules / divider lines (any color)
- Solid color accent bars or strips (e.g. a red stripe along the left edge of a card)
- Colored border outlines around rectangular regions
- Bullet point markers or numbering decorators (small dots, squares, colored tags)
- Gradient overlay strips (solid-ish color regions used as visual separators)

Do NOT include:
- The main background
- Photographic subjects or illustrations
- Text of any kind
- Shadows or soft gradients

For each element, return:
- label: short description (e.g. "red horizontal rule", "vertical red accent bar")
- box: { x, y, width, height } in PIXELS, top-left origin. Be precise — thin lines may be only 3-8px tall/wide.
- fill_hex: the dominant solid color of the element as a hex string like "#E5424D"

Return ONLY a JSON object:
{ "image_width": <int>, "image_height": <int>, "accents": [ { "label": "...", "box": {"x":0,"y":0,"width":0,"height":0}, "fill_hex": "#000000" } ] }

If you find no decorative structural elements, return: { "image_width": <int>, "image_height": <int>, "accents": [] }`;

interface GeminiAccentItem {
  label?: string;
  box: { x: number; y: number; width: number; height: number };
  fill_hex?: string;
}

interface GeminiAccentResponse {
  image_width: number;
  image_height: number;
  accents: GeminiAccentItem[];
}

export interface AccentInput {
  imageBase64: string;
  imageMimeType?: string;
  imageWidth: number;
  imageHeight: number;
}

@Injectable()
export class AccentDetectAdapter {
  constructor(private readonly vision: GeminiVisionProvider) {}

  async detect(input: AccentInput): Promise<AccentBox[]> {
    let response: GeminiAccentResponse;
    try {
      response = await this.vision.generateJson<GeminiAccentResponse>({
        prompt: ACCENT_PROMPT,
        imageBase64: input.imageBase64,
        imageMimeType: input.imageMimeType ?? 'image/png',
      });
    } catch (err) {
      console.warn('[AccentDetectAdapter] Gemini call failed:', (err as Error).message);
      return [];
    }

    const reportedWidth = response.image_width || input.imageWidth;
    const reportedHeight = response.image_height || input.imageHeight;
    const scaleX = input.imageWidth / reportedWidth;
    const scaleY = input.imageHeight / reportedHeight;

    const accents: AccentBox[] = (response.accents ?? [])
      .filter((a) => a?.box && a.fill_hex)
      .map((a) => ({
        x: Math.round((a.box.x ?? 0) * scaleX),
        y: Math.round((a.box.y ?? 0) * scaleY),
        width: Math.max(1, Math.round((a.box.width ?? 0) * scaleX)),
        height: Math.max(1, Math.round((a.box.height ?? 0) * scaleY)),
        fillHex: a.fill_hex!,
        label: a.label,
      }));

    console.log(`[AccentDetectAdapter] detected ${accents.length} accent elements`);
    return accents;
  }
}
