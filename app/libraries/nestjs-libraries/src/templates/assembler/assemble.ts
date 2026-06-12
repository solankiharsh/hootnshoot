import {
  PolotnoElement,
  PolotnoFigureElement,
  PolotnoImageElement,
  PolotnoStoreJSON,
  PolotnoTextElement,
} from './polotno-schema';
import { DecomposeStageOutputs } from '../templates.types';
import {
  estimateWrappedLineCount,
  fitFontSizeToBox,
} from './fit-text-to-box';
import { substituteLogoBoxes } from './logo-substitution';

const DEFAULT_FONT = 'DM Sans';
const DEFAULT_FILL = '#111111';
const LINE_HEIGHT_FACTOR = 1.25;
const CAP_HEIGHT_RATIO = 0.72;

// Maps proprietary / system fonts (that can't be loaded from Google Fonts) to
// visually similar Google Fonts families. Keys are lowercase; matching is
// prefix-tolerant so "Helvetica Neue LT" still hits "helvetica neue".
const FONT_SUBSTITUTIONS: Record<string, string> = {
  // ── Helvetica / Arial family ────────────────────────────────────────────
  // Helvetica Neue → Montserrat (closer stroke weight at 900/black than Inter 900)
  'helvetica neue':   'Montserrat',
  'helvetica':        'Roboto',
  'arial':            'Roboto',
  'arial narrow':     'Roboto Condensed',
  'neue helvetica':   'Montserrat',
  'akzidenz-grotesk': 'Roboto',
  'akzidenz grotesk': 'Roboto',
  'univers':          'Roboto',

  // ── Geometric sans ──────────────────────────────────────────────────────
  'futura':           'Nunito',
  'century gothic':   'Nunito',
  'circular':         'Nunito',
  'gotham':           'Montserrat',
  'brandon grotesque':'Raleway',
  'proxima nova':     'Nunito Sans',
  'tt norms':         'Inter',
  'tt commons':       'Inter',

  // ── Humanist sans ───────────────────────────────────────────────────────
  'avenir next':      'Nunito Sans',
  'avenir':           'Nunito Sans',
  'gill sans':        'Cabin',
  'myriad pro':       'Source Sans 3',
  'myriad':           'Source Sans 3',
  'frutiger':         'Source Sans 3',
  'optima':           'Josefin Sans',
  'stone sans':       'Cabin',

  // ── Apple / Microsoft system UI ─────────────────────────────────────────
  'sf pro display':   'Inter',
  'sf pro text':      'Inter',
  'sf pro':           'Inter',
  'san francisco':    'Inter',
  'segoe ui':         'Open Sans',
  'segoe':            'Open Sans',
  'calibri':          'Libre Franklin',
  'candara':          'Cabin',
  'corbel':           'Source Sans 3',
  'constantia':       'Lora',
  'cambria':          'Lora',
  'whitney':          'Libre Franklin',
  'apertura':         'Inter',

  // ── Transitional / Old-style serifs ─────────────────────────────────────
  'garamond':         'EB Garamond',
  'adobe garamond':   'EB Garamond',
  'cormorant':        'Cormorant Garamond',
  'caslon':           'EB Garamond',
  'adobe caslon':     'EB Garamond',
  'baskerville':      'Libre Baskerville',
  'palatino':         'Lora',
  'book antiqua':     'Lora',
  'times new roman':  'Lora',
  'times':            'Lora',
  'georgia':          'Merriweather',
  'minion pro':       'Merriweather',
  'minion':           'Merriweather',
  'sabon':            'EB Garamond',
  'bembo':            'EB Garamond',
  'goudy old style':  'EB Garamond',

  // ── Modern / Didone serifs ───────────────────────────────────────────────
  'bodoni':           'Playfair Display',
  'bodoni mt':        'Playfair Display',
  'didot':            'Playfair Display',
  'walbaum':          'Playfair Display',
  'century':          'Playfair Display',
  'century schoolbook':'Merriweather',

  // ── Slab serifs ─────────────────────────────────────────────────────────
  'rockwell':         'Roboto Slab',
  'memphis':          'Roboto Slab',
  'clarendon':        'Roboto Slab',
  'courier new':      'Courier Prime',
  'courier':          'Courier Prime',

  // ── Display / Condensed ──────────────────────────────────────────────────
  'trajan':           'Cinzel',
  'trajan pro':       'Cinzel',
  'trade gothic':     'Barlow Condensed',
  'trade gothic bold no. 2': 'Barlow Condensed',
  'impact':           'Oswald',
  'compacta':         'Oswald',
  'interstate':       'Barlow',
  'din':              'Barlow',
  'ff din':           'Barlow',

  // ── Monospace ────────────────────────────────────────────────────────────
  'monaco':           'JetBrains Mono',
  'menlo':            'JetBrains Mono',
  'consolas':         'Fira Code',
  'andale mono':      'Fira Mono',
  'lucida console':   'Fira Mono',

  // ── Script / Handwritten ─────────────────────────────────────────────────
  'brush script':     'Pacifico',
  'brush script mt':  'Pacifico',
  'comic sans':       'Nunito',
  'comic sans ms':    'Nunito',
  'lucida handwriting': 'Dancing Script',
  'zapf chancery':    'Great Vibes',
  'papyrus':          'Metamorphous',
};

function resolveFont(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const key = raw.toLowerCase().trim();
  if (FONT_SUBSTITUTIONS[key]) return FONT_SUBSTITUTIONS[key];
  // prefix match — catches "Helvetica Neue LT Std 55 Roman" → "helvetica neue"
  for (const prefix of Object.keys(FONT_SUBSTITUTIONS)) {
    if (key.startsWith(prefix)) return FONT_SUBSTITUTIONS[prefix];
  }
  return raw;
}

export function assemblePolotnoJSON(
  stages: DecomposeStageOutputs,
  options: { logoSubstitution?: boolean; logoUrl?: string } = {}
): PolotnoStoreJSON {
  const enableLogoSubstitution = options.logoSubstitution !== false;
  const pageId = `page-${Date.now()}`;
  let elementCounter = 0;
  const newId = (kind: string) => `${pageId}-${kind}-${elementCounter++}`;

  const children: PolotnoElement[] = [];

  if (stages.background?.url) {
    const background: PolotnoImageElement = {
      id: newId('bg'),
      type: 'image',
      name: 'Background',
      src: stages.background.url,
      x: 0,
      y: 0,
      width: stages.imageWidth,
      height: stages.imageHeight,
      selectable: true,
    };
    children.push(background);
  }

  (stages.accents ?? []).forEach((accent, idx) => {
    const el: PolotnoFigureElement = {
      id: newId('accent'),
      type: 'figure',
      subType: 'rect',
      name: accent.label ?? `Accent ${idx + 1}`,
      x: accent.x,
      y: accent.y,
      width: accent.width,
      height: accent.height,
      fill: accent.fillHex,
    };
    children.push(el);
  });

  stages.subjects.forEach((subject, idx) => {
    const el: PolotnoImageElement = {
      id: newId('subj'),
      type: 'image',
      name: subject.label ?? `Subject ${idx + 1}`,
      src: subject.url,
      x: subject.box.x,
      y: subject.box.y,
      width: subject.box.width,
      height: subject.box.height,
    };
    children.push(el);
  });

  // Replace logo OCR boxes with brand image asset elements.
  // Caller may pre-resolve ORG_LOGO_URL (file path → data URL); falls back to env var.
  const orgLogoUrl = options.logoUrl ?? process.env.ORG_LOGO_URL ?? '';
  const { substituted: logoElements, remaining: ocrTextBoxes } = enableLogoSubstitution
    ? substituteLogoBoxes(stages.ocr.boxes, orgLogoUrl, newId('logo'), stages.imageHeight)
    : { substituted: [], remaining: stages.ocr.boxes };
  logoElements.forEach((el) => children.push(el));

  ocrTextBoxes.forEach((box, idx) => {
    const lineCount = Math.max(
      1,
      box.lineCount ?? Math.max(1, (box.text.match(/\n/g)?.length ?? 0) + 1)
    );

    // Derive font size from box height when multi-line (more reliable than Gemini's estimate).
    // box.height = lineCount × fontSize × LINE_HEIGHT_FACTOR  →  fontSize = box.height / (lineCount × factor)
    const heightDerivedFontSize = Math.max(
      8,
      Math.round(box.height / (lineCount * LINE_HEIGHT_FACTOR))
    );
    const preferredFontSize =
      lineCount > 1
        ? heightDerivedFontSize
        : box.fontSizePx ?? heightDerivedFontSize;

    const fontWeight = mapFontWeight(box.fontWeight);

    const fontSize = fitFontSizeToBox({
      text: box.text,
      boxWidth: box.width,
      boxHeight: box.height,
      preferredFontSize,
      lineHeightFactor: LINE_HEIGHT_FACTOR,
      fontWeight: box.fontWeight,
    });

    const wrappedLineCount = estimateWrappedLineCount(
      box.text,
      box.width,
      fontSize,
      box.fontWeight
    );

    const text: PolotnoTextElement = {
      id: newId('text'),
      type: 'text',
      name: layerNameFromRole(box.role, idx),
      text: box.text,
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      rotation: box.angle ?? 0,
      fontFamily: resolveFont(box.fontFamily) ?? DEFAULT_FONT,
      fontSize,
      fontWeight,
      fontStyle: box.fontStyle === 'italic' ? 'italic' : 'normal',
      fill: box.fillHex ?? DEFAULT_FILL,
      align: 'left',
      lineHeight: LINE_HEIGHT_FACTOR,
      custom: {
        role: box.role,
        lineCount: wrappedLineCount,
        sourceBox: { x: box.x, y: box.y, width: box.width, height: box.height },
      },
    };
    children.push(text);
  });  // end ocrTextBoxes.forEach

  return {
    width: stages.imageWidth,
    height: stages.imageHeight,
    unit: 'px',
    dpi: 72,
    schemaVersion: 2,
    fonts: [],
    pages: [
      {
        id: pageId,
        width: stages.imageWidth,
        height: stages.imageHeight,
        background: '#ffffff',
        children,
      },
    ],
  };
}

function mapFontWeight(weight?: string): string {
  switch ((weight ?? 'regular').toLowerCase()) {
    case 'black':
    case '900':
      return '900';
    case 'bold':
    case '700':
      return 'bold';
    case 'semibold':
    case '600':
      return '600';
    case 'medium':
    case '500':
      return '500';
    case 'light':
    case '300':
      return '300';
    default:
      return 'normal';
  }
}

function layerNameFromRole(role: string | undefined, idx: number): string {
  if (!role) return `Text ${idx + 1}`;
  return role.charAt(0).toUpperCase() + role.slice(1);
}
