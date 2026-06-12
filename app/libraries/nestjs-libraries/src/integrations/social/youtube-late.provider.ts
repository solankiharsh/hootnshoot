import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class YoutubeLateProvider extends LateApiProvider {
  identifier = 'youtube-late';
  name = 'YouTube (Managed)';
  latePlatform = 'youtube';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 5000;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getYouTubeConnectUrl(profileId, redirectUrl, state);
  }
}
