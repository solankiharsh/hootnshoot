import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class LinkedinLateProvider extends LateApiProvider {
  identifier = 'linkedin-late';
  name = 'LinkedIn (Managed)';
  latePlatform = 'linkedin';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 3000;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getLinkedInConnectUrl(profileId, redirectUrl, state);
  }
}
