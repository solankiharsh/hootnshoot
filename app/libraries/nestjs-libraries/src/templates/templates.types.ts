export type OcrStrategyName = 'gemini-vision';
export type SubjectDetectStrategyName = 'gemini-vision' | 'gemini-then-dino' | 'skip';
export type SubjectIsolateStrategyName = '851-labs' | 'sam2-prompted' | 'skip';
export type BgRecoverStrategyName = 'nano-banana-text-only' | 'keep-source';

export interface DecomposeStrategies {
  ocr?: OcrStrategyName;
  subjectDetect?: SubjectDetectStrategyName;
  subjectIsolate?: SubjectIsolateStrategyName;
  bgRecover?: BgRecoverStrategyName;
  autoRefine?: boolean;
  /** When true (default), replace detected logo OCR boxes with brand image assets (requires ORG_LOGO_URL). */
  logoSubstitution?: boolean;
  /**
   * Number of background-recovery candidates to generate and score.
   * The best-scoring candidate is used. Defaults to 1 (disabled).
   * Set to 2–4 for higher quality at the cost of more API calls.
   */
  numBackgroundCandidates?: number;
}

export const DEFAULT_STRATEGIES: Required<DecomposeStrategies> = {
  ocr: 'gemini-vision',
  subjectDetect: 'gemini-vision',
  subjectIsolate: '851-labs',
  bgRecover: 'nano-banana-text-only',
  autoRefine: true,
  logoSubstitution: true,
  numBackgroundCandidates: 1,
};

export interface DecomposeRequest {
  imageUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  strategies?: DecomposeStrategies;
}

export interface OcrBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  confidence?: number;
  fontSizePx?: number;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic' | string;
  fillHex?: string;
  role?: string;
  lineCount?: number;
}

export interface OcrResult {
  boxes: OcrBox[];
  imageWidth: number;
  imageHeight: number;
}

export interface BackgroundPlate {
  url: string;
}

export interface SubjectMask {
  url: string;
  box: { x: number; y: number; width: number; height: number };
  label?: string;
  /** True when subject was detected but isolation failed — url is a raw crop, not a cutout. */
  isolationFailed?: boolean;
  /** Bhattacharyya coefficient between this subject and background (0–1). Set by HarmonizeAdapter. */
  harmonyScore?: number;
  /** True when HarmonizeAdapter applied LUT or Gemini correction to this subject's url. */
  harmonized?: boolean;
}

export interface AccentBox {
  x: number;
  y: number;
  width: number;
  height: number;
  fillHex: string;
  label?: string;
}

export interface DecomposeStageOutputs {
  imageWidth: number;
  imageHeight: number;
  ocr: OcrResult;
  background?: BackgroundPlate;
  subjects: SubjectMask[];
  accents?: AccentBox[];
  /** Labels of subjects detected in stage-1 but whose isolation mask was missing or failed. */
  isolationFailures?: string[];
}
