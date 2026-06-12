import { Module } from '@nestjs/common';
import { ReplicateProvider } from '@gitroom/nestjs-libraries/3rdparties/replicate/replicate.provider';
import { GeminiImageEditProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-image-edit.provider';
import { GeminiVisionProvider } from '@gitroom/nestjs-libraries/3rdparties/gemini/gemini-vision.provider';
import { OcrAdapter } from './stages/ocr.adapter';
import { InpaintAdapter } from './stages/inpaint.adapter';
import { SubjectDetectAdapter } from './stages/subject-detect.adapter';
import { SubjectIsolateAdapter } from './stages/subject-isolate.adapter';
import { AccentDetectAdapter } from './stages/accent-detect.adapter';
import { HarmonizeAdapter } from './stages/harmonize.adapter';
import { QualityCheckService } from './quality/quality-check.service';
import { CandidateScoringService } from './quality/candidate-scoring.service';
import { StageCacheService } from './stages/stage-cache.service';
import { TemplateDecomposeService } from './template-decompose.service';
import { PostUploadDecomposeService } from './post-upload-decompose.service';

@Module({
  providers: [
    ReplicateProvider,
    GeminiImageEditProvider,
    GeminiVisionProvider,
    OcrAdapter,
    InpaintAdapter,
    SubjectDetectAdapter,
    SubjectIsolateAdapter,
    AccentDetectAdapter,
    HarmonizeAdapter,
    QualityCheckService,
    CandidateScoringService,
    StageCacheService,
    TemplateDecomposeService,
    PostUploadDecomposeService,
  ],
  exports: [TemplateDecomposeService, PostUploadDecomposeService],
})
export class TemplateDecomposeModule {}
