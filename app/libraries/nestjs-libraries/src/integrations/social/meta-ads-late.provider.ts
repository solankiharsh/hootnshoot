import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class MetaAdsLateProvider extends LateApiProvider {
  identifier = 'meta-ads-late';
  name = 'Meta Ads (Managed)';
  latePlatform = 'facebook-ads';
  override category = 'ads' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 2200;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getMetaAdsConnectUrl(profileId, redirectUrl, state);
  }
}
