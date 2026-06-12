import 'reflect-metadata';

import { Injectable } from '@nestjs/common';
import { XProvider } from '@gitroom/nestjs-libraries/integrations/social/x.provider';
import { SocialProvider } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { LinkedinProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin.provider';
// import { RedditProvider } from '@gitroom/nestjs-libraries/integrations/social/reddit.provider';
// import { DevToProvider } from '@gitroom/nestjs-libraries/integrations/social/dev.to.provider';
// import { HashnodeProvider } from '@gitroom/nestjs-libraries/integrations/social/hashnode.provider';
// import { MediumProvider } from '@gitroom/nestjs-libraries/integrations/social/medium.provider';
import { FacebookProvider } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import { InstagramProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.provider';
import { YoutubeProvider } from '@gitroom/nestjs-libraries/integrations/social/youtube.provider';
import { TiktokProvider } from '@gitroom/nestjs-libraries/integrations/social/tiktok.provider';
// import { PinterestProvider } from '@gitroom/nestjs-libraries/integrations/social/pinterest.provider';
// import { DribbbleProvider } from '@gitroom/nestjs-libraries/integrations/social/dribbble.provider';
import { LinkedinPageProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin.page.provider';
import { ThreadsProvider } from '@gitroom/nestjs-libraries/integrations/social/threads.provider';
// import { DiscordProvider } from '@gitroom/nestjs-libraries/integrations/social/discord.provider';
import { SlackProvider } from '@gitroom/nestjs-libraries/integrations/social/slack.provider';
// import { MastodonProvider } from '@gitroom/nestjs-libraries/integrations/social/mastodon.provider';
// import { BlueskyProvider } from '@gitroom/nestjs-libraries/integrations/social/bluesky.provider';
// import { LemmyProvider } from '@gitroom/nestjs-libraries/integrations/social/lemmy.provider';
import { InstagramStandaloneProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.standalone.provider';
// import { FarcasterProvider } from '@gitroom/nestjs-libraries/integrations/social/farcaster.provider';
import { TelegramProvider } from '@gitroom/nestjs-libraries/integrations/social/telegram.provider';
// import { NostrProvider } from '@gitroom/nestjs-libraries/integrations/social/nostr.provider';
// import { VkProvider } from '@gitroom/nestjs-libraries/integrations/social/vk.provider';
// import { WordpressProvider } from '@gitroom/nestjs-libraries/integrations/social/wordpress.provider';
// import { ListmonkProvider } from '@gitroom/nestjs-libraries/integrations/social/listmonk.provider';
// import { GmbProvider } from '@gitroom/nestjs-libraries/integrations/social/gmb.provider';
// import { KickProvider } from '@gitroom/nestjs-libraries/integrations/social/kick.provider';
// import { TwitchProvider } from '@gitroom/nestjs-libraries/integrations/social/twitch.provider';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
// import { MoltbookProvider } from '@gitroom/nestjs-libraries/integrations/social/moltbook.provider';
// import { SkoolProvider } from '@gitroom/nestjs-libraries/integrations/social/skool.provider';
// import { WhopProvider } from '@gitroom/nestjs-libraries/integrations/social/whop.provider';
// import { MeweProvider } from '@gitroom/nestjs-libraries/integrations/social/mewe.provider';
import { FacebookLateProvider } from '@gitroom/nestjs-libraries/integrations/social/facebook-late.provider';
import { InstagramLateProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram-late.provider';
import { XLateProvider } from '@gitroom/nestjs-libraries/integrations/social/x-late.provider';
import { LinkedinLateProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin-late.provider';
import { TiktokLateProvider } from '@gitroom/nestjs-libraries/integrations/social/tiktok-late.provider';
import { YoutubeLateProvider } from '@gitroom/nestjs-libraries/integrations/social/youtube-late.provider';
import { RedditLateProvider } from '@gitroom/nestjs-libraries/integrations/social/reddit-late.provider';
import { ThreadsLateProvider } from '@gitroom/nestjs-libraries/integrations/social/threads-late.provider';
import { WhatsAppLateProvider } from '@gitroom/nestjs-libraries/integrations/social/whatsapp-late.provider';
import { PinterestLateProvider } from '@gitroom/nestjs-libraries/integrations/social/pinterest-late.provider';
import { MetaAdsLateProvider } from '@gitroom/nestjs-libraries/integrations/social/meta-ads-late.provider';
import { InstagramAdsLateProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram-ads-late.provider';
import { LinkedinAdsLateProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin-ads-late.provider';
import { TiktokAdsLateProvider } from '@gitroom/nestjs-libraries/integrations/social/tiktok-ads-late.provider';
import { GoogleAdsLateProvider } from '@gitroom/nestjs-libraries/integrations/social/google-ads-late.provider';
import { XAdsLateProvider } from '@gitroom/nestjs-libraries/integrations/social/x-ads-late.provider';

export const socialIntegrationList: Array<SocialAbstract & SocialProvider> = [
  new XProvider(),
  new LinkedinProvider(),
  new LinkedinPageProvider(),
  // new RedditProvider(),
  new InstagramProvider(),
  new InstagramStandaloneProvider(),
  new FacebookProvider(),
  new ThreadsProvider(),
  new YoutubeProvider(),
  new TiktokProvider(),
  // new GmbProvider(),
  // new PinterestProvider(),
  // new DribbbleProvider(),
  // new DiscordProvider(),
  new SlackProvider(),
  // new TwitchProvider(),
  // new KickProvider(),
  // new MastodonProvider(),
  // new BlueskyProvider(),
  // new LemmyProvider(),
  // new FarcasterProvider(),
  new TelegramProvider(),
  // new NostrProvider(),
  // new VkProvider(),
  // new MediumProvider(),
  // new DevToProvider(),
  // new HashnodeProvider(),
  // new WordpressProvider(),
  // new ListmonkProvider(),
  // new MoltbookProvider(),
  // new WhopProvider(),
  // new SkoolProvider(),
  // new MeweProvider(),
  // new MastodonCustomProvider(),
  // Late API providers — always registered (BYOK: each organization brings its
  // own Late API key via Settings → API Keys; LATE_API_KEY env is the fallback).
  // Key presence is enforced at connect time, not at boot.
  new FacebookLateProvider(),
  new InstagramLateProvider(),
  new XLateProvider(),
  new LinkedinLateProvider(),
  new TiktokLateProvider(),
  new YoutubeLateProvider(),
  new RedditLateProvider(),
  new ThreadsLateProvider(),
  new WhatsAppLateProvider(),
  new PinterestLateProvider(),
  new MetaAdsLateProvider(),
  new InstagramAdsLateProvider(),
  new LinkedinAdsLateProvider(),
  new TiktokAdsLateProvider(),
  new GoogleAdsLateProvider(),
  new XAdsLateProvider(),
];

@Injectable()
export class IntegrationManager {
  async getAllIntegrations() {
    const lateIdentifiers = new Set(
      socialIntegrationList
        .filter((p) => p.identifier.endsWith('-late'))
        .map((p) => p.identifier.replace(/-late$/, ''))
    );

    const visibleList = socialIntegrationList.filter((p) => {
      // When a managed (-late) equivalent is registered, hide the direct provider
      if (lateIdentifiers.has(p.identifier)) {
        return false;
      }
      return true;
    });

    return {
      social: await Promise.all(
        visibleList.map(async (p) => ({
          name: p.name,
          identifier: p.identifier,
          toolTip: p.toolTip,
          editor: p.editor,
          category: p.category,
          isExternal: !!p.externalUrl,
          isWeb3: !!p.isWeb3,
          isChromeExtension: !!p.isChromeExtension,
          ...(p.extensionCookies ? { extensionCookies: p.extensionCookies } : {}),
          ...(p.customFields ? { customFields: await p.customFields() } : {}),
        }))
      ),
      article: [] as any[],
    };
  }

  getAllTools(): {
    [key: string]: {
      description: string;
      dataSchema: any;
      methodName: string;
    }[];
  } {
    return socialIntegrationList.reduce(
      (all, current) => ({
        ...all,
        [current.identifier]:
          Reflect.getMetadata('custom:tool', current.constructor.prototype) ||
          [],
      }),
      {}
    );
  }

  getAllRulesDescription(): {
    [key: string]: string;
  } {
    return socialIntegrationList.reduce(
      (all, current) => ({
        ...all,
        [current.identifier]:
          Reflect.getMetadata(
            'custom:rules:description',
            current.constructor
          ) || '',
      }),
      {}
    );
  }

  getAllPlugs() {
    return socialIntegrationList
      .map((p) => {
        return {
          name: p.name,
          identifier: p.identifier,
          plugs: (
            Reflect.getMetadata('custom:plug', p.constructor.prototype) || []
          )
            .filter((f: any) => !f.disabled)
            .map((p: any) => ({
              ...p,
              fields: p.fields.map((c: any) => ({
                ...c,
                validation: c?.validation?.toString(),
              })),
            })),
        };
      })
      .filter((f) => f.plugs.length);
  }

  getInternalPlugs(providerName: string) {
    const p = socialIntegrationList.find((p) => p.identifier === providerName)!;
    return {
      internalPlugs:
        (
          Reflect.getMetadata(
            'custom:internal_plug',
            p.constructor.prototype
          ) || []
        ).filter((f: any) => !f.disabled) || [],
    };
  }

  getAllowedSocialsIntegrations() {
    return socialIntegrationList.map((p) => p.identifier);
  }
  getSocialIntegration(integration: string): SocialProvider {
    return socialIntegrationList.find((i) => i.identifier === integration)!;
  }
}
