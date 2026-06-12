import { DecomposeStrategies } from '../templates.types';

export type QualitySeverity = 'critical' | 'warning' | 'info';

export interface QualityIssue {
  code: string;
  severity: QualitySeverity;
  layer?: string;
  message: string;
  suggestion?: string;
  apply?: Partial<DecomposeStrategies>;
}

export interface BackgroundCandidateInfo {
  candidatesGenerated: number;
  selectedIndex: number;
  scores: Array<{
    candidateIndex: number;
    score: number;
    colorScore: number;
    /** Sobel seam gradient continuity score (higher = smoother blend at text-removal seams) */
    seamScore: number;
    /** 128×128 JPEG data URL for visual inspection */
    thumbnail: string;
  }>;
}

export interface QualityReport {
  score: number;
  issues: QualityIssue[];
  tierBRan: boolean;
  refined?: { ocrAdded: number; subjectsAdded: number };
  backgroundCandidates?: BackgroundCandidateInfo;
  /** Per-subject Bhattacharyya coefficient after harmonization (subjectLabel → score 0–1). */
  harmonyScores?: Record<string, number>;
}
