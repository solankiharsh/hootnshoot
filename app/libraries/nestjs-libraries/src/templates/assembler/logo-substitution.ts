import { OcrBox } from '../templates.types';
import {
  PolotnoElement,
  PolotnoFigureElement,
  PolotnoImageElement,
  PolotnoTextElement,
} from './polotno-schema';

// Default assumed aspect ratio for a horizontal wordmark logo (width:height ≈ 4.5:1).
// If you know your logo's exact ratio, set ORG_LOGO_ASPECT env var (e.g. "3.2").
const DEFAULT_LOGO_ASPECT = 4.5;

function getLogoAspect(): number {
  const raw = process.env.ORG_LOGO_ASPECT;
  if (raw) {
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) return n;
  }
  return DEFAULT_LOGO_ASPECT;
}

/**
 * Given an OCR bounding box and the logo's aspect ratio, return the largest
 * dimensions that fit entirely within the box while preserving the ratio,
 * centred on the original bbox origin.
 */
function fitLogoInBox(
  box: OcrBox,
  aspectRatio: number
): { x: number; y: number; width: number; height: number } {
  const widthFromBoxWidth = box.width;
  const heightFromBoxWidth = Math.round(box.width / aspectRatio);

  const heightFromBoxHeight = box.height;
  const widthFromBoxHeight = Math.round(box.height * aspectRatio);

  let logoWidth: number;
  let logoHeight: number;

  if (heightFromBoxWidth <= box.height) {
    logoWidth = widthFromBoxWidth;
    logoHeight = heightFromBoxWidth;
  } else {
    logoWidth = widthFromBoxHeight;
    logoHeight = heightFromBoxHeight;
  }

  const x = Math.round(box.x + (box.width - logoWidth) / 2);
  const y = Math.round(box.y + (box.height - logoHeight) / 2);

  return { x, y, width: logoWidth, height: logoHeight };
}

// ---------------------------------------------------------------------------
// Detection — generic: any OCR box with role === 'logo'
// ---------------------------------------------------------------------------

export function isLogoBox(box: OcrBox): boolean {
  return (box.role ?? '').toLowerCase() === 'logo';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export interface LogoSubstitutionResult {
  /** Polotno elements that replace logo OCR boxes (image when URL set, placeholder rect+label otherwise). */
  substituted: PolotnoElement[];
  /** OCR boxes that are NOT logo matches and should still become text layers. */
  remaining: OcrBox[];
}

// Minimum logo height as a fraction of the canvas height (prevents tiny logos at low OCR confidence).
const MIN_LOGO_HEIGHT_FRACTION = 0.06;

/**
 * Split OCR boxes into logo image elements (substituted) and normal text boxes
 * (remaining). Logo boxes (role === 'logo') are converted to PolotnoImageElement
 * pointing to the provided logo URL.
 *
 * @param boxes       All OCR boxes from the OCR stage.
 * @param logoUrl     Direct public URL to the org logo image.
 * @param idPrefix    Prefix for generated element IDs.
 * @param imageHeight Canvas height in pixels — used to enforce a minimum logo display size.
 */
export function substituteLogoBoxes(
  boxes: OcrBox[],
  logoUrl: string,
  idPrefix: string = `logo-${Date.now()}`,
  imageHeight: number = 0
): LogoSubstitutionResult {
  const substituted: PolotnoElement[] = [];

  if (!logoUrl) {
    // No logo URL configured — replace logo-role boxes with a visible placeholder
    // (light grey rect + centred "LOGO" label) so the designer can swap the asset in.
    // Falling through as text always renders garbled raster glyphs.
    for (const box of boxes) {
      if (!isLogoBox(box)) continue;
      const placeholder: PolotnoFigureElement = {
        id: `${idPrefix}-ph-${substituted.length}`,
        type: 'figure',
        subType: 'rect',
        name: 'Logo (placeholder)',
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        fill: '#e8e8e8',
        stroke: '#aaaaaa',
        strokeWidth: 2,
        custom: { role: 'logo', isPlaceholder: true },
      };
      const label: PolotnoTextElement = {
        id: `${idPrefix}-phlabel-${substituted.length}`,
        type: 'text',
        name: 'Logo label',
        text: 'LOGO',
        x: box.x,
        y: box.y + Math.round(box.height / 2) - 10,
        width: box.width,
        height: 20,
        fontFamily: 'Inter',
        fontSize: Math.max(10, Math.min(20, Math.round(box.height * 0.25))),
        fontWeight: '600',
        fill: '#888888',
        align: 'center',
      };
      substituted.push(placeholder, label);
    }
    return { substituted, remaining: boxes.filter((b) => !isLogoBox(b)) };
  }
  const remaining: OcrBox[] = [];
  const aspectRatio = getLogoAspect();
  let counter = 0;

  for (const box of boxes) {
    if (!isLogoBox(box)) {
      remaining.push(box);
      continue;
    }

    // Enforce a minimum display size so logos don't become microscopic when the
    // OCR bbox is tiny (common for compact wordmarks at the edge of the design).
    const minH = imageHeight > 0 ? Math.round(imageHeight * MIN_LOGO_HEIGHT_FRACTION) : 0;
    const effectiveBox: OcrBox = minH > box.height
      ? { ...box, height: minH, width: Math.max(box.width, Math.round(minH * aspectRatio)) }
      : box;

    const { x, y, width, height } = fitLogoInBox(effectiveBox, aspectRatio);

    const el: PolotnoImageElement = {
      id: `${idPrefix}-${counter++}`,
      type: 'image',
      name: 'Logo',
      src: logoUrl,
      x,
      y,
      width,
      height,
      cropX: 0,
      cropY: 0,
      cropWidth: 1,
      cropHeight: 1,
      rotation: box.angle ?? 0,
      selectable: true,
      custom: {
        role: 'logo',
        sourceBox: { x: box.x, y: box.y, width: box.width, height: box.height },
        originalText: box.text,
      },
    };

    substituted.push(el);

    console.log(
      `[LogoSubstitution] Replaced OCR box "${box.text}" (${box.x},${box.y} ${box.width}x${box.height}) → fitted ${width}x${height} at (${x},${y})`
    );
  }

  return { substituted, remaining };
}
