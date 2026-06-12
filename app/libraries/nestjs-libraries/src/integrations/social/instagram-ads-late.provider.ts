import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class InstagramAdsLateProvider extends LateApiProvider {
  identifier = 'instagram-ads-late';
  name = 'Instagram Ads (Managed)';
  latePlatform = 'instagram-ads';
  override category = 'ads' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 2200;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getInstagramAdsConnectUrl(profileId, redirectUrl, state);
  }
}
