import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class GoogleAdsLateProvider extends LateApiProvider {
  identifier = 'google-ads-late';
  name = 'Google Ads (Managed)';
  latePlatform = 'google-ads';
  override category = 'ads' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 2200;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getGoogleAdsConnectUrl(profileId, redirectUrl, state);
  }
}
