import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class LinkedinAdsLateProvider extends LateApiProvider {
  identifier = 'linkedin-ads-late';
  name = 'LinkedIn Ads (Managed)';
  latePlatform = 'linkedin-ads';
  override category = 'ads' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 3000;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getLinkedInAdsConnectUrl(profileId, redirectUrl, state);
  }
}
