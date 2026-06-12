import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class MetaAdsLateProvider extends LateApiProvider {
  identifier = 'meta-ads-late';
  name = 'Meta Ads (Managed)';
  latePlatform = 'facebook-ads';
  override category = 'ads' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 2200;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getMetaAdsConnectUrl(profileId, redirectUrl, state);
  }
}
