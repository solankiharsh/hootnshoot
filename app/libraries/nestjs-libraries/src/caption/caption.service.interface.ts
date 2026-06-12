export interface CaptionBrief {
  topic: string;
  contentType: 'academy' | 'announcement' | 'campaign';
  language: 'en';
  keyMessage?: string;
  assets?: string;
  cta?: string;
  tone?: string;
}

export interface CaptionResult {
  headline: string;
  body: string;
  hashtags: string;
}

export abstract class CaptionService {
  abstract generate(brief: CaptionBrief): Promise<CaptionResult>;
}
