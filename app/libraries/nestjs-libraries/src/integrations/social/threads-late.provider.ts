import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class ThreadsLateProvider extends LateApiProvider {
  identifier = 'threads-late';
  name = 'Threads (Managed)';
  latePlatform = 'threads';
  override maxConcurrentJob = 50;

  override maxLength() {
    return 500;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getThreadsConnectUrl(profileId, redirectUrl, state);
  }
}
