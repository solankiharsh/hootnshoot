import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class TiktokLateProvider extends LateApiProvider {
  identifier = 'tiktok-late';
  name = 'TikTok (Managed)';
  latePlatform = 'tiktok';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 2200;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getTikTokConnectUrl(profileId, redirectUrl, state);
  }
}
