import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class RedditLateProvider extends LateApiProvider {
  identifier = 'reddit-late';
  name = 'Reddit (Managed)';
  latePlatform = 'reddit';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 40000;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getRedditConnectUrl(profileId, redirectUrl, state);
  }
}
