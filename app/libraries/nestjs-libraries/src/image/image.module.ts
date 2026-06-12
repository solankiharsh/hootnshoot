import { Module } from '@nestjs/common';
import { Gener8ImageAdapter } from './gener8-image.adapter';
import { ImageService } from './image.service.interface';

@Module({
  providers: [
    {
      provide: ImageService,
      useClass: Gener8ImageAdapter,
    },
  ],
  exports: [ImageService],
})
export class ImageModule {}
