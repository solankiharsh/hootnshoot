import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class PinterestLateProvider extends LateApiProvider {
  identifier = 'pinterest-late';
  name = 'Pinterest (Managed)';
  latePlatform = 'pinterest';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 500;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getPinterestConnectUrl(profileId, redirectUrl, state);
  }
}
