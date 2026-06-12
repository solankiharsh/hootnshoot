import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class YoutubeLateProvider extends LateApiProvider {
  identifier = 'youtube-late';
  name = 'YouTube (Managed)';
  latePlatform = 'youtube';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 5000;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getYouTubeConnectUrl(profileId, redirectUrl, state);
  }
}
