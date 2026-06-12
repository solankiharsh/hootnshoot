import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { InstagramLateDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/instagram-late.dto';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class InstagramLateProvider extends LateApiProvider {
  identifier = 'instagram-late';
  name = 'Instagram (Managed)';
  latePlatform = 'instagram';
  override maxConcurrentJob = 200;
  override dto = InstagramLateDto;

  override maxLength() {
    return 2200;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getInstagramConnectUrl(profileId, redirectUrl, state);
  }
}
