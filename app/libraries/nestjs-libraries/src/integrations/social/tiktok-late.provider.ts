import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class TiktokLateProvider extends LateApiProvider {
  identifier = 'tiktok-late';
  name = 'TikTok (Managed)';
  latePlatform = 'tiktok';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 2200;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getTikTokConnectUrl(profileId, redirectUrl, state);
  }
}
