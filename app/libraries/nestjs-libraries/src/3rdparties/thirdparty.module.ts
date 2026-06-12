import { Global, Module } from '@nestjs/common';
import { HeygenProvider } from '@gitroom/nestjs-libraries/3rdparties/heygen/heygen.provider';
import { Gener8Provider } from '@gitroom/nestjs-libraries/3rdparties/gener8/gener8.provider';
import { AuroraProvider } from '@gitroom/nestjs-libraries/3rdparties/aurora/aurora.provider';
import { ThirdPartyManager } from '@gitroom/nestjs-libraries/3rdparties/thirdparty.manager';
import { ImageModule } from '@gitroom/nestjs-libraries/image/image.module';

@Global()
@Module({
  imports: [ImageModule],
  providers: [HeygenProvider, Gener8Provider, AuroraProvider, ThirdPartyManager],
  get exports() {
    return this.providers;
  },
})
export class ThirdPartyModule {}
