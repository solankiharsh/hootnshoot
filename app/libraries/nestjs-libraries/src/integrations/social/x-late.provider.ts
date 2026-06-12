import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class XLateProvider extends LateApiProvider {
  identifier = 'x-late';
  name = 'X (Managed)';
  latePlatform = 'twitter';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 280;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getTwitterConnectUrl(profileId, redirectUrl, state);
  }
}
