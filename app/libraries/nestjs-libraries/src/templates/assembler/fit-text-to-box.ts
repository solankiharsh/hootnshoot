const MIN_FONT_SIZE = 8;
// Average glyph width as fraction of em-square. 0.62 was too high for bold/black —
// it caused fitFontSizeToBox to over-estimate line overflow and shrink headlines by ~20%.
const CHAR_WIDTH_RATIO = 0.52;
const CHAR_WIDTH_RATIO_BOLD = 0.50;

function charWidthRatio(fontWeight?: string): number {
  const w = (fontWeight ?? 'normal').toLowerCase();
  if (w === 'bold' || w === '700' || w === '900' || w === '600' || w === 'semibold') {
    return CHAR_WIDTH_RATIO_BOLD;
  }
  return CHAR_WIDTH_RATIO;
}

/** Estimate how many rendered lines Polotno will use at this font size (wrap + explicit newlines). */
export function estimateWrappedLineCount(
  text: string,
  boxWidth: number,
  fontSize: number,
  fontWeight?: string
): number {
  if (boxWidth <= 0 || fontSize <= 0) return 1;

  const charWidth = fontSize * charWidthRatio(fontWeight);
  const charsPerLine = Math.max(1, Math.floor(boxWidth / charWidth));

  return text.split('\n').reduce((total, paragraph) => {
    const len = paragraph.length;
    return total + Math.max(1, len === 0 ? 1 : Math.ceil(len / charsPerLine));
  }, 0);
}

export function textFitsBox(
  text: string,
  boxWidth: number,
  boxHeight: number,
  fontSize: number,
  lineHeightFactor: number,
  fontWeight?: string
): boolean {
  if (fontSize < MIN_FONT_SIZE) return true;
  const lines = estimateWrappedLineCount(text, boxWidth, fontSize, fontWeight);
  const requiredHeight = fontSize * lineHeightFactor * lines;
  return requiredHeight <= boxHeight;
}

/** Largest font size (down to min) so wrapped text fits inside the OCR text box. */
export function fitFontSizeToBox(params: {
  text: string;
  boxWidth: number;
  boxHeight: number;
  preferredFontSize: number;
  lineHeightFactor: number;
  fontWeight?: string;
  minFontSize?: number;
}): number {
  const {
    text,
    boxWidth,
    boxHeight,
    preferredFontSize,
    lineHeightFactor,
    fontWeight,
    minFontSize = MIN_FONT_SIZE,
  } = params;

  if (boxWidth <= 0 || boxHeight <= 0) {
    return Math.max(minFontSize, preferredFontSize);
  }

  const maxByHeight = Math.floor(boxHeight / lineHeightFactor);
  let maxFontSize = Math.min(Math.round(preferredFontSize), maxByHeight);

  if (maxFontSize < minFontSize) {
    return minFontSize;
  }

  if (textFitsBox(text, boxWidth, boxHeight, maxFontSize, lineHeightFactor, fontWeight)) {
    return maxFontSize;
  }

  for (let fs = maxFontSize - 1; fs >= minFontSize; fs--) {
    if (textFitsBox(text, boxWidth, boxHeight, fs, lineHeightFactor, fontWeight)) {
      return fs;
    }
  }

  return minFontSize;
}
