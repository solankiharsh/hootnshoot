import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { LateApiProvider } from '@gitroom/nestjs-libraries/integrations/social/late-api.provider';
import { FacebookLateDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/facebook-late.dto';
import { Integration } from '@prisma/client';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

export class FacebookLateProvider extends LateApiProvider {
  identifier = 'facebook-late';
  name = 'Facebook (Managed)';
  latePlatform = 'facebook';
  override maxConcurrentJob = 100;
  override dto = FacebookLateDto;

  override maxLength() {
    return 63206;
  }

  getConnectUrl(profileId: string, redirectUrl: string, state: string) {
    return getLateApiInstance().getFacebookConnectUrl(profileId, redirectUrl, state);
  }

  // Override authenticate to auto-select the Facebook page chosen during Late API OAuth
  override async authenticate(params: { code: string; codeVerifier: string; refresh?: string }): Promise<AuthTokenDetails> {
    const base = await super.authenticate(params);
    const lateAccountId = base.accessToken;

    // The Late API OAuth page already had the user select a page — use that selection
    const { pages, selectedPageId } = await getLateApiInstance().getFacebookPages(lateAccountId);
    const pageId = selectedPageId || pages[0]?.id;
    const page = pages.find((p) => p.id === pageId) || pages[0];

    return {
      ...base,
      id: pageId || lateAccountId,
      name: page?.name || base.name,
      username: page?.username || base.username,
      // token stays as lateAccountId (needed for API calls); internalId is the FB page ID
      accessToken: lateAccountId,
    };
  }

  override async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails[],
    _integration: Integration
  ): Promise<PostResponse[]> {
    return Promise.all(
      postDetails.map(async (p) => {
        const settings = p.settings || {};
        const result = await getLateApiInstance().createPost({
          platforms: [
            {
              platform: 'facebook',
              accountId: accessToken,
              platformSpecificData: {
                pageId: id,
                ...(settings.contentType ? { contentType: settings.contentType } : {}),
                ...(settings.firstComment ? { firstComment: settings.firstComment } : {}),
              },
              customContent: p.message,
              customMedia: p.media?.map((m) => ({ type: m.type, url: m.path })),
            },
          ],
          content: p.message,
          mediaItems: p.media?.map((m) => ({ type: m.type, url: m.path })),
          publishNow: true,
        });
        const target = Array.isArray(result?.targets)
          ? result.targets.find((t: any) => t.platform === 'facebook')
          : null;
        return {
          id: p.id,
          postId: target?.platformPostId || result?.latePostId || result?.id || '',
          releaseURL: target?.platformPostUrl || '',
          status: target?.status || 'published',
        };
      })
    );
  }
}
