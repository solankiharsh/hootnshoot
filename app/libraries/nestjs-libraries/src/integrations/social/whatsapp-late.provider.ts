import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { LateApiService } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class WhatsAppLateProvider extends LateApiProvider {
  identifier = 'whatsapp-late';
  name = 'WhatsApp (Managed)';
  latePlatform = 'whatsapp';
  override category = 'communication' as const;
  override maxConcurrentJob = 50;

  override maxLength() {
    return 4096;
  }

  getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string) {
    return api.getWhatsAppConnectUrl(profileId, redirectUrl, state);
  }
}
