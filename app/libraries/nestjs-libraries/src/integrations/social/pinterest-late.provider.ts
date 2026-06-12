import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class PinterestLateProvider extends LateApiProvider {
  identifier = 'pinterest-late';
  name = 'Pinterest (Managed)';
  latePlatform = 'pinterest';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 500;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getPinterestConnectUrl(profileId, redirectUrl, state);
  }
}
