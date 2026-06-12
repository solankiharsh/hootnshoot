import { RedditSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/reddit.dto';
import { PinterestSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/pinterest.dto';
import { YoutubeSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/youtube.settings.dto';
import { TikTokDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/tiktok.dto';
import { XDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/x.dto';
import { LemmySettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/lemmy.dto';
import { DribbbleDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/dribbble.dto';
import { DiscordDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/discord.dto';
import { SlackDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/slack.dto';
import { KickDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/kick.dto';
import { TwitchDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/twitch.dto';
import { InstagramDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/instagram.dto';
import { LinkedinDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/linkedin.dto';
import { IsIn } from 'class-validator';
import { MediumSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/medium.settings.dto';
import { DevToSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/dev.to.settings.dto';
import { HashnodeSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/hashnode.settings.dto';
import { WordpressDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/wordpress.dto';
import { ListmonkDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/listmonk.dto';
import { GmbSettingsDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/gmb.settings.dto';
import { FarcasterDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/farcaster.dto';
import { FacebookDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/facebook.dto';
import { MoltbookDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/moltbook.dto';
import { SkoolDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/skool.dto';
import { WhopDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/whop.dto';
import { MeweDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/mewe.dto';

export type ProviderExtension<T extends string, M> = { __type: T } & M;
export type AllProvidersSettings =
  | ProviderExtension<'reddit', RedditSettingsDto>
  | ProviderExtension<'reddit-late', RedditSettingsDto>
  | ProviderExtension<'lemmy', LemmySettingsDto>
  | ProviderExtension<'youtube', YoutubeSettingsDto>
  | ProviderExtension<'youtube-late', YoutubeSettingsDto>
  | ProviderExtension<'pinterest', PinterestSettingsDto>
  | ProviderExtension<'dribbble', DribbbleDto>
  | ProviderExtension<'tiktok', TikTokDto>
  | ProviderExtension<'tiktok-late', TikTokDto>
  | ProviderExtension<'discord', DiscordDto>
  | ProviderExtension<'slack', SlackDto>
  | ProviderExtension<'kick', KickDto>
  | ProviderExtension<'twitch', TwitchDto>
  | ProviderExtension<'x', XDto>
  | ProviderExtension<'x-late', XDto>
  | ProviderExtension<'linkedin', LinkedinDto>
  | ProviderExtension<'linkedin-late', LinkedinDto>
  | ProviderExtension<'linkedin-page', LinkedinDto>
  | ProviderExtension<'instagram', InstagramDto>
  | ProviderExtension<'instagram-late', InstagramDto>
  | ProviderExtension<'instagram-standalone', InstagramDto>
  | ProviderExtension<'medium', MediumSettingsDto>
  | ProviderExtension<'devto', DevToSettingsDto>
  | ProviderExtension<'hashnode', HashnodeSettingsDto>
  | ProviderExtension<'wordpress', WordpressDto>
  | ProviderExtension<'listmonk', ListmonkDto>
  | ProviderExtension<'gmb', GmbSettingsDto>
  | ProviderExtension<'facebook', FacebookDto>
  | ProviderExtension<'facebook-late', FacebookDto>
  | ProviderExtension<'wrapcast', FarcasterDto>
  | ProviderExtension<'threads', None>
  | ProviderExtension<'threads-late', None>
  | ProviderExtension<'mastodon', None>
  | ProviderExtension<'bluesky', None>
  | ProviderExtension<'telegram', None>
  | ProviderExtension<'nostr', None>
  | ProviderExtension<'moltbook', MoltbookDto>
  | ProviderExtension<'vk', None>
  | ProviderExtension<'skool', SkoolDto>
  | ProviderExtension<'mewe', MeweDto>
  | ProviderExtension<'whop', WhopDto>;

type None = NonNullable<unknown>;

export const allProviders = (setEmpty?: any) => {
  return [
    { value: RedditSettingsDto, name: 'reddit' },
    { value: RedditSettingsDto, name: 'reddit-late' },
    { value: LemmySettingsDto, name: 'lemmy' },
    { value: YoutubeSettingsDto, name: 'youtube' },
    { value: YoutubeSettingsDto, name: 'youtube-late' },
    { value: PinterestSettingsDto, name: 'pinterest' },
    { value: DribbbleDto, name: 'dribbble' },
    { value: TikTokDto, name: 'tiktok' },
    { value: TikTokDto, name: 'tiktok-late' },
    { value: DiscordDto, name: 'discord' },
    { value: SlackDto, name: 'slack' },
    { value: KickDto, name: 'kick' },
    { value: TwitchDto, name: 'twitch' },
    { value: XDto, name: 'x' },
    { value: XDto, name: 'x-late' },
    { value: LinkedinDto, name: 'linkedin' },
    { value: LinkedinDto, name: 'linkedin-late' },
    { value: LinkedinDto, name: 'linkedin-page' },
    { value: InstagramDto, name: 'instagram' },
    { value: InstagramDto, name: 'instagram-late' },
    { value: InstagramDto, name: 'instagram-standalone' },
    { value: MediumSettingsDto, name: 'medium' },
    { value: DevToSettingsDto, name: 'devto' },
    { value: WordpressDto, name: 'wordpress' },
    { value: HashnodeSettingsDto, name: 'hashnode' },
    { value: ListmonkDto, name: 'listmonk' },
    { value: GmbSettingsDto, name: 'gmb' },
    { value: FarcasterDto, name: 'wrapcast' },
    { value: FacebookDto, name: 'facebook' },
    { value: FacebookDto, name: 'facebook-late' },
    { value: setEmpty, name: 'threads' },
    { value: setEmpty, name: 'threads-late' },
    { value: setEmpty, name: 'mastodon' },
    { value: setEmpty, name: 'bluesky' },
    { value: setEmpty, name: 'telegram' },
    { value: setEmpty, name: 'nostr' },
    { value: setEmpty, name: 'vk' },
    { value: MoltbookDto, name: 'moltbook' },
    { value: SkoolDto, name: 'skool' },
    { value: WhopDto, name: 'whop' },
    { value: MeweDto, name: 'mewe' },
  ].filter((f) => f.value);
};

export class EmptySettings {
  @IsIn(allProviders(EmptySettings).map((p) => p.name), {
    message: `"__type" must be ${allProviders(EmptySettings)
      .map((p) => p.name)
      .join(', ')}`,
  })
  __type: string;
}
