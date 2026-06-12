import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class TiktokAdsLateProvider extends LateApiProvider {
  identifier = 'tiktok-ads-late';
  name = 'TikTok Ads (Managed)';
  latePlatform = 'tiktok-ads';
  override category = 'ads' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 2200;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getTikTokAdsConnectUrl(profileId, redirectUrl, state);
  }
}
