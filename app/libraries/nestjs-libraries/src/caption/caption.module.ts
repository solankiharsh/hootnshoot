import { Module } from '@nestjs/common';
import { GeminiCaptionAdapter } from './gemini-caption.adapter';
import { GeminiCaptionSuggestAdapter } from './gemini-caption-suggest.adapter';
import { CaptionService } from './caption.service.interface';

@Module({
  providers: [
    {
      provide: CaptionService,
      useClass: GeminiCaptionAdapter,
    },
    GeminiCaptionSuggestAdapter,
  ],
  exports: [CaptionService, GeminiCaptionSuggestAdapter],
})
export class CaptionModule {}
