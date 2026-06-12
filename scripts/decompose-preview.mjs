/**
 * Decompose an image using Gemini OCR and render a layered preview via sharp + SVG.
 * Usage: node scripts/decompose-preview.mjs <input-image> <output-image>
 *
 * Simulates what the Polotno template would look like:
 *  1. Paints white over detected text regions (erasing original text)
 *  2. Re-renders text at those positions using font substitution + correct weights
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from '/Users/harshsolanki/Developer/hootnshoot/app/node_modules/sharp/lib/index.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = 'gemini-2.5-pro';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── Font substitution map (mirrors assemble.ts) ──────────────────────────────
const FONT_SUBSTITUTIONS = {
  'helvetica neue': 'Helvetica Neue',
  'helvetica': 'Helvetica',
  'arial': 'Arial',
  'futura': 'Futura',
  'gotham': 'Gill Sans',
  'proxima nova': 'Arial',
  'inter': 'Arial',
  'sf pro': '-apple-system',
};

function resolveFont(raw) {
  if (!raw) return 'Helvetica Neue';
  const key = raw.toLowerCase().trim();
  if (FONT_SUBSTITUTIONS[key]) return FONT_SUBSTITUTIONS[key];
  for (const prefix of Object.keys(FONT_SUBSTITUTIONS)) {
    if (key.startsWith(prefix)) return FONT_SUBSTITUTIONS[prefix];
  }
  return raw;
}

function mapFontWeight(weight) {
  switch ((weight || 'regular').toLowerCase()) {
    case 'black': case '900': return '900';
    case 'bold': case '700': return 'bold';
    case 'semibold': case '600': return '600';
    case 'medium': case '500': return '500';
    case 'light': case '300': return '300';
    default: return 'normal';
  }
}

// ── Gemini OCR ────────────────────────────────────────────────────────────────
async function runOcr(imageBase64, mimeType) {
  const prompt = `You are an OCR engine for graphic design images. Extract ALL visible text blocks from this image.

CRITICAL BBOX RULES:
- The bounding box MUST be the smallest rectangle that fully contains the visible glyphs of ALL lines in this entry.
- For multi-line text the box.height MUST cover the top of line 1 down to the bottom of the LAST line.

For each entry, return:
- text: exact text content, preserving case and intra-paragraph line breaks (\\n)
- box: { x, y, width, height } in PIXELS, top-left origin
- line_count: integer — how many visible lines are inside the bbox
- font_size_px: approximate visual font size in pixels (cap height of an upper-case letter, NOT box height)
- font_family: closest matching font family name (e.g. "Helvetica Neue", "Arial"). Return "unknown" if uncertain.
- font_weight: one of "regular", "medium", "semibold", "bold", "black". Use "black" for ultra-heavy weights (Helvetica Neue Black, Impact, etc.) where strokes are noticeably thicker than ordinary bold.
- font_style: "normal" or "italic"
- fill_hex: dominant text color as hex like "#000000"
- role: one of "headline", "subhead", "body", "cta", "source", "disclaimer", "logo", "label", "other". Use "logo" ONLY for a logo mark or wordmark that is a brand asset image/symbol.

Return ONLY a JSON object: { "image_width": <int>, "image_height": <int>, "items": [ ... ] }`;

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mimeType, data: imageBase64 } },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini OCR failed: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  return JSON.parse(cleaned);
}

// ── SVG escape ────────────────────────────────────────────────────────────────
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const inputPath = process.argv[2] || '/Users/harshsolanki/Desktop/zIl3IsEgsP.png';
  const outputPath = process.argv[3] || '/Users/harshsolanki/Desktop/decomposed-preview.png';

  console.log(`Reading image: ${inputPath}`);
  const imgBuffer = fs.readFileSync(inputPath);
  const meta = await sharp(imgBuffer).metadata();
  const W = meta.width;
  const H = meta.height;
  console.log(`Image size: ${W}×${H}`);

  const imageBase64 = imgBuffer.toString('base64');
  const mimeType = 'image/png';

  console.log('Calling Gemini OCR…');
  const ocr = await runOcr(imageBase64, mimeType);
  console.log(`OCR returned ${ocr.items.length} items:`);
  ocr.items.forEach((it, i) => {
    const b = it.box;
    console.log(`  [${i}] role=${it.role} weight=${it.font_weight} box=(${b.x},${b.y} ${b.width}×${b.height}) lines=${it.line_count} fs=${it.font_size_px} "${it.text.replace(/\n/g, '\\n').slice(0, 40)}"`);
  });

  // Filter out logo-role boxes
  const textItems = ocr.items.filter(it => (it.role || '').toLowerCase() !== 'logo');
  const logoItems = ocr.items.filter(it => (it.role || '').toLowerCase() === 'logo');
  console.log(`Dropping ${logoItems.length} logo box(es), rendering ${textItems.length} text layer(s)`);

  // ── Right panel: text layers on white (mirrors what Polotno text layers look like)
  // We draw: faint bounding-box outlines (so you can check positioning) + re-rendered text.
  const LINE_HEIGHT_FACTOR = 1.25;
  const CAP_HEIGHT_RATIO = 0.72;

  const textLayerItems = textItems.map(it => {
    const { x, y, width, height } = it.box;
    const font = resolveFont(it.font_family);
    const weight = mapFontWeight(it.font_weight);
    const style = it.font_style === 'italic' ? 'italic' : 'normal';
    const fill = it.fill_hex || '#000000';

    const lineCount = it.line_count || Math.max(1, (it.text.match(/\n/g)?.length ?? 0) + 1);
    const heightDerived = Math.max(8, Math.round((height / lineCount) * CAP_HEIGHT_RATIO));
    const fontSize = lineCount > 1 ? heightDerived : (it.font_size_px || heightDerived);
    const lineH = Math.round(fontSize * LINE_HEIGHT_FACTOR);
    const firstBaseline = y + Math.round(fontSize * 0.85);

    const lines = it.text.split('\n');
    const tspans = lines.map((line, li) =>
      `<tspan x="${x}" dy="${li === 0 ? 0 : lineH}">${esc(line)}</tspan>`
    ).join('');

    // Faint blue bounding box so we can visually verify OCR positioning
    const bbox = `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#4488ff" stroke-width="1" stroke-dasharray="4 3" opacity="0.5"/>`;

    const text = `<text
  x="${x}"
  y="${firstBaseline}"
  font-family="${esc(font)}, Helvetica Neue, Arial, sans-serif"
  font-size="${fontSize}"
  font-weight="${weight}"
  font-style="${style}"
  fill="${fill}"
  xml:space="preserve"
>${tspans}</text>`;

    return bbox + '\n' + text;
  }).join('\n');

  // Also draw logo boxes in red (dropped from text, just showing detected region)
  const logoBoxes = logoItems.map(it => {
    const { x, y, width, height } = it.box;
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="#ff4444" stroke-width="2" stroke-dasharray="6 3" opacity="0.7"/>
<text x="${x}" y="${y - 4}" font-family="Arial" font-size="11" fill="#ff4444" opacity="0.8">logo (dropped)</text>`;
  }).join('\n');

  // Right panel SVG: white background + OCR boxes + re-rendered text
  const rightPanelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${logoBoxes}
  ${textLayerItems}
</svg>`;

  // Left panel: original image (unmodified). Right panel: text layers on white.
  // Output is 2× wide so both panels sit side by side.
  const DIVIDER = 4; // px gap between panels
  const outW = W * 2 + DIVIDER;

  console.log(`Compositing side-by-side preview (${outW}×${H})…`);
  await sharp({
    create: { width: outW, height: H, channels: 4, background: { r: 220, g: 220, b: 220, alpha: 255 } },
  })
    .composite([
      // Left: original image unchanged
      { input: imgBuffer, left: 0, top: 0 },
      // Right: text layers on white
      { input: Buffer.from(rightPanelSvg), left: W + DIVIDER, top: 0 },
    ])
    .png({ quality: 95 })
    .toFile(outputPath);

  console.log(`✓ Saved: ${outputPath} (left = original, right = OCR text layers)`);
  console.log('\nOCR layer summary:');
  textItems.forEach((it, i) => {
    const font = resolveFont(it.font_family);
    const weight = mapFontWeight(it.font_weight);
    const lineCount = it.line_count || 1;
    const heightDerived = Math.max(8, Math.round((it.box.height / lineCount) * 0.72));
    const fs = lineCount > 1 ? heightDerived : (it.font_size_px || heightDerived);
    console.log(`  [${i}] ${it.role} | "${it.text.replace(/\n/g, '↵').slice(0, 35)}" | font=${font} w=${weight} size=${fs}px fill=${it.fill_hex}`);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
