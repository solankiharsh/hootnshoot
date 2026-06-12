import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class XLateProvider extends LateApiProvider {
  identifier = 'x-late';
  name = 'X (Managed)';
  latePlatform = 'twitter';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 280;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getTwitterConnectUrl(profileId, redirectUrl, state);
  }
}
