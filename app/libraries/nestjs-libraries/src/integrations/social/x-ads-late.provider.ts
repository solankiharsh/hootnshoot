import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class XAdsLateProvider extends LateApiProvider {
  identifier = 'x-ads-late';
  name = 'X Ads (Managed)';
  latePlatform = 'twitter-ads';
  override category = 'ads' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 280;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getXAdsConnectUrl(profileId, redirectUrl, state);
  }
}
