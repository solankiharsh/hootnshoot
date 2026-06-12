export type PolotnoElementType =
  | 'text'
  | 'image'
  | 'svg'
  | 'figure'
  | 'line'
  | 'video'
  | 'gif'
  | 'group';

export interface PolotnoElementBase {
  id?: string;
  type: PolotnoElementType;
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  visible?: boolean;
  selectable?: boolean;
  draggable?: boolean;
  custom?: Record<string, unknown>;
}

export interface PolotnoTextElement extends PolotnoElementBase {
  type: 'text';
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  fill?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  backgroundColor?: string;
  stroke?: string;
  strokeWidth?: number;
}

export interface PolotnoImageElement extends PolotnoElementBase {
  type: 'image';
  src: string;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  cornerRadius?: number;
  flipX?: boolean;
  flipY?: boolean;
  borderColor?: string;
  borderSize?: number;
}

export interface PolotnoSvgElement extends PolotnoElementBase {
  type: 'svg';
  src: string;
  maskSrc?: string;
}

export interface PolotnoFigureElement extends PolotnoElementBase {
  type: 'figure';
  subType?: 'rect' | 'ellipse' | 'triangle' | 'star';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface PolotnoGroupElement extends PolotnoElementBase {
  type: 'group';
  children: PolotnoElement[];
}

export type PolotnoElement =
  | PolotnoTextElement
  | PolotnoImageElement
  | PolotnoSvgElement
  | PolotnoFigureElement
  | PolotnoGroupElement
  | PolotnoElementBase;

export interface PolotnoPage {
  id: string;
  children: PolotnoElement[];
  width?: number | 'auto';
  height?: number | 'auto';
  background?: string;
  bleed?: number;
  duration?: number;
  custom?: Record<string, unknown>;
}

export interface PolotnoFont {
  fontFamily: string;
  url?: string;
  styles?: Array<{ src: string; fontWeight?: string | number; fontStyle?: string }>;
}

export interface PolotnoStoreJSON {
  width: number;
  height: number;
  fonts: PolotnoFont[];
  pages: PolotnoPage[];
  unit?: 'px' | 'pt' | 'in' | 'cm' | 'mm';
  dpi?: number;
  schemaVersion?: number;
  custom?: Record<string, unknown>;
  audios?: unknown[];
}
