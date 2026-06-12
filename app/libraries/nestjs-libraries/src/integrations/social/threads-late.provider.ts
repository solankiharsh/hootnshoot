import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class ThreadsLateProvider extends LateApiProvider {
  identifier = 'threads-late';
  name = 'Threads (Managed)';
  latePlatform = 'threads';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 500;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getThreadsConnectUrl(profileId, redirectUrl, state);
  }
}
