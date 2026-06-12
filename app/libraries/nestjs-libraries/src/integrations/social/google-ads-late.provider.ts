import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class GoogleAdsLateProvider extends LateApiProvider {
  identifier = 'google-ads-late';
  name = 'Google Ads (Managed)';
  latePlatform = 'google-ads';
  override category = 'ads' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 2200;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getGoogleAdsConnectUrl(profileId, redirectUrl, state);
  }
}
