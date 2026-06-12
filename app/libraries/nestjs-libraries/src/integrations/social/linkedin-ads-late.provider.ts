import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class LinkedinAdsLateProvider extends LateApiProvider {
  identifier = 'linkedin-ads-late';
  name = 'LinkedIn Ads (Managed)';
  latePlatform = 'linkedin-ads';
  override category = 'ads' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 3000;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getLinkedInAdsConnectUrl(profileId, redirectUrl, state);
  }
}
