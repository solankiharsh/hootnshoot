/**
 * Refine font sizes for decomposed text layers after loadJSON using canvas measurement.
 * Complements server-side fitting in assemble.ts for edge cases (fonts, kerning).
 */

const MIN_FONT_SIZE = 8;
const LINE_HEIGHT_DEFAULT = 1.25;

function buildFont(
  fontSize: number,
  fontFamily: string,
  fontStyle: string,
  fontWeight: string
): string {
  return `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
}

function measureLineWidth(ctx: CanvasRenderingContext2D, line: string): number {
  return ctx.measureText(line).width;
}

function wrapParagraph(
  ctx: CanvasRenderingContext2D,
  paragraph: string,
  maxWidth: number
): string[] {
  if (!paragraph) return [''];

  const words = paragraph.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measureLineWidth(ctx, candidate) <= maxWidth || !current) {
      current = candidate;
      continue;
    }
    lines.push(current);
    current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function measureWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  lineHeightFactor: number
): { lineCount: number; totalHeight: number } {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    lines.push(...wrapParagraph(ctx, paragraph, maxWidth));
  }

  const lineCount = Math.max(1, lines.length);
  const totalHeight = fontSize * lineHeightFactor * lineCount;
  return { lineCount, totalHeight };
}

function fitsBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  fontSize: number,
  lineHeightFactor: number
): boolean {
  const { totalHeight } = measureWrappedText(
    ctx,
    text,
    width,
    fontSize,
    lineHeightFactor
  );
  return totalHeight <= height;
}

function fitFontSize(
  text: string,
  width: number,
  height: number,
  preferred: number,
  fontFamily: string,
  fontStyle: string,
  fontWeight: string,
  lineHeightFactor: number
): number {
  if (width <= 0 || height <= 0) return preferred;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return preferred;

  const maxByHeight = Math.floor(height / lineHeightFactor);
  let maxFontSize = Math.min(Math.round(preferred), maxByHeight);

  if (maxFontSize < MIN_FONT_SIZE) return MIN_FONT_SIZE;

  for (let fs = maxFontSize; fs >= MIN_FONT_SIZE; fs--) {
    ctx.font = buildFont(fs, fontFamily, fontStyle, fontWeight);
    if (fitsBox(ctx, text, width, height, fs, lineHeightFactor)) {
      return fs;
    }
  }

  return MIN_FONT_SIZE;
}

export function fitDecomposedTextLayers(store: {
  pages?: Array<{ children?: Array<Record<string, unknown>> }>;
}): void {
  if (typeof document === 'undefined') return;

  for (const page of store.pages ?? []) {
    for (const child of page.children ?? []) {
      if (child.type !== 'text' || typeof child.text !== 'string') continue;

      const custom = child.custom as
        | { sourceBox?: { width?: number; height?: number }; lineCount?: number }
        | undefined;
      if (!custom?.sourceBox) continue;

      const width = Number(child.width) || 0;
      const height = Number(child.height) || 0;
      if (width <= 0 || height <= 0) continue;

      const fontFamily = String(child.fontFamily ?? 'DM Sans');
      const fontStyle = String(child.fontStyle ?? 'normal');
      const fontWeight = String(child.fontWeight ?? 'normal');
      const lineHeightFactor = Number(child.lineHeight) || LINE_HEIGHT_DEFAULT;
      const preferred = Number(child.fontSize) || MIN_FONT_SIZE;

      const fontSize = fitFontSize(
        child.text,
        width,
        height,
        preferred,
        fontFamily,
        fontStyle,
        fontWeight,
        lineHeightFactor
      );

      if (fontSize !== preferred && typeof (child as { set?: unknown }).set === 'function') {
        (child as { set: (v: Record<string, unknown>) => void }).set({ fontSize });
      } else if (fontSize !== preferred) {
        child.fontSize = fontSize;
      }
    }
  }
}
