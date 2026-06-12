import { TweetV2, TwitterApi } from 'twitter-api-v2';
import {
  AnalyticsData,
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { lookup } from 'mime-types';
import sharp from 'sharp';
import { readOrFetch } from '@gitroom/helpers/utils/read.or.fetch';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { Plug } from '@gitroom/helpers/decorators/plug.decorator';
import { Integration } from '@prisma/client';
import { timer } from '@gitroom/helpers/utils/timer';
import { PostPlug } from '@gitroom/helpers/decorators/post.plug';
import dayjs from 'dayjs';
import { uniqBy } from 'lodash';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { XDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/x.dto';
import { Rules } from '@gitroom/nestjs-libraries/chat/rules.description.decorator';
import { randomBytes, createHash } from 'crypto';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';

function formatTwitterApiProblemJson(body: string): string | undefined {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{')) {
    return undefined;
  }
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof o.title === 'string' && typeof o.detail === 'string') {
      if (o.title === 'CreditsDepleted') {
        return 'X API usage credits are exhausted for this developer app. Add credits or usage allowance in the X Developer Portal (project billing), or use OAuth credentials for an app that still has quota.';
      }
      return `${o.title}: ${o.detail}`;
    }
    const errors = o.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const e0 = errors[0] as Record<string, unknown>;
      const parts = [e0.message, e0.detail].filter((x) => typeof x === 'string');
      if (parts.length) {
        return parts.join(' — ');
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

@Rules(
  'X can have maximum 4 pictures, or maximum one video, it can also be without attachments'
)
export class XProvider extends SocialAbstract implements SocialProvider {
  identifier = 'x';
  name = 'X';
  isBetweenSteps = false;
  scopes = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'];
  override maxConcurrentJob = 1; // X has strict rate limits (300 posts per 3 hours)
  toolTip =
    'You will be logged in into your current account, if you would like a different account, change it first on X';

  editor = 'normal' as const;
  dto = XDto;

  maxLength(isTwitterPremium: boolean) {
    return isTwitterPremium ? 4000 : 200;
  }

  protected override badBodyMessageFromHttpFetch(
    status: number,
    responseText: string,
    handleError:
      | { type: 'refresh-token' | 'bad-body' | 'retry'; value: string }
      | undefined
  ): string {
    if (handleError?.value) {
      return handleError.value;
    }
    const fromProblem = formatTwitterApiProblemJson(responseText);
    if (fromProblem) {
      return fromProblem;
    }
    return responseText.length > 0 ? responseText : String(status);
  }

  override handleErrors(
    body: string,
    _status = 200
  ):
    | {
        type: 'refresh-token' | 'bad-body';
        value: string;
      }
    | undefined {
    const lower = body.toLowerCase();

    if (
      lower.includes('creditsdepleted') ||
      lower.includes('problems/credits') ||
      lower.includes('does not have any credits to fulfill')
    ) {
      return {
        type: 'bad-body',
        value:
          'X API usage credits are exhausted for this developer app. Add credits in the X Developer Portal (project billing / usage), or deploy OAuth credentials for an app that still has quota.',
      };
    }

    if (
      body.includes('Unsupported Authentication') ||
      lower.includes('unsupported-authentication')
    ) {
      return {
        type: 'refresh-token',
        value: 'X authentication has expired, please reconnect your account',
      };
    }

    if (
      _status === 401 ||
      /\bfailed to fetch x username\s*\(\s*401\s*\)/i.test(body)
    ) {
      return {
        type: 'refresh-token',
        value: 'X authentication has expired, please reconnect your account',
      };
    }

    return undefined;
  }

  @Plug({
    identifier: 'x-autoRepostPost',
    title: 'Auto Repost Posts',
    disabled: !!process.env.DISABLE_X_ANALYTICS,
    description:
      'When a post reached a certain number of likes, repost it to increase engagement (1 week old posts)',
    runEveryMilliseconds: 21600000,
    totalRuns: 3,
    fields: [
      {
        name: 'likesAmount',
        type: 'number',
        placeholder: 'Amount of likes',
        description: 'The amount of likes to trigger the repost',
        validation: /^\d+$/,
      },
    ],
  })
  async autoRepostPost(
    integration: Integration,
    id: string,
    fields: { likesAmount: string }
  ) {
    const client = new TwitterApi({ oauth2Token: integration.token });

    if (
      (await client.v2.tweetLikedBy(id)).meta.result_count >=
      +fields.likesAmount
    ) {
      await timer(2000);
      await client.v2.retweet(integration.internalId, id);
      return true;
    }

    return false;
  }

  @PostPlug({
    identifier: 'x-repost-post-users',
    title: 'Add Re-posters',
    description: 'Add accounts to repost your post',
    pickIntegration: ['x'],
    fields: [],
  })
  async repostPostUsers(
    integration: Integration,
    originalIntegration: Integration,
    postId: string,
    information: any
  ) {
    const client = new TwitterApi({ oauth2Token: integration.token });

    const {
      data: { id },
    } = await client.v2.me();

    try {
      await client.v2.retweet(id, postId);
    } catch (err) {
      /** nothing **/
    }
  }

  @Plug({
    identifier: 'x-autoPlugPost',
    title: 'Auto plug post',
    disabled: !!process.env.DISABLE_X_ANALYTICS,
    description:
      'When a post reached a certain number of likes, add another post to it so you followers get a notification about your promotion',
    runEveryMilliseconds: 21600000,
    totalRuns: 3,
    fields: [
      {
        name: 'likesAmount',
        type: 'number',
        placeholder: 'Amount of likes',
        description: 'The amount of likes to trigger the repost',
        validation: /^\d+$/,
      },
      {
        name: 'post',
        type: 'richtext',
        placeholder: 'Post to plug',
        description: 'Message content to plug',
        validation: /^[\s\S]{3,}$/g,
      },
    ],
  })
  async autoPlugPost(
    integration: Integration,
    id: string,
    fields: { likesAmount: string; post: string }
  ) {
    const client = new TwitterApi({ oauth2Token: integration.token });

    if (
      (await client.v2.tweetLikedBy(id)).meta.result_count >=
      +fields.likesAmount
    ) {
      await timer(2000);

      await client.v2.tweet({
        text: stripHtmlValidation('normal', fields.post, true),
        reply: { in_reply_to_tweet_id: id },
      });
      return true;
    }

    return false;
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    const { clientId, clientSecret } = this.getCredentials();
    const authB64 = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const resp = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authB64}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }).toString(),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`X token refresh failed (${resp.status}): ${text}`);
    }

    const data: any = await resp.json();

    if (!data.access_token) {
      throw new Error('X OAuth2 token refresh returned an invalid response');
    }

    return {
      id: '',
      name: '',
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresIn: data.expires_in || 7200,
      picture: '',
      username: '',
    };
  }

  async generateAuthUrl() {
    const { clientId } = this.getCredentials();
    const codeVerifier = randomBytes(32).toString('base64url');
    const state = randomBytes(16).toString('hex');
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: this.getXCallbackUrl(),
      scope: this.scopes.join(' '),
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      url: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
      codeVerifier,
      state,
    };
  }

  async authenticate(params: { code: string; codeVerifier: string }) {
    const { code, codeVerifier } = params;
    const { clientId, clientSecret } = this.getCredentials();
    const authB64 = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenResp = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authB64}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.getXCallbackUrl(),
        client_id: clientId,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      throw new Error(`X OAuth2 token exchange failed (${tokenResp.status}): ${text}`);
    }

    const tokenData: any = await tokenResp.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    if (!refresh_token) {
      throw new Error(
        'X OAuth2 refresh token is missing. Ensure offline.access scope is enabled.'
      );
    }

    if (!expires_in) {
      throw new Error(
        'X OAuth2 token expiry is missing from authentication response.'
      );
    }

    const userResp = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=username,verified,verified_type,profile_image_url,name',
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!userResp.ok) {
      const text = await userResp.text();
      throw new Error(`Failed to fetch X user profile (${userResp.status}): ${text}`);
    }

    const userData: any = await userResp.json();
    const { id, username, name, verified, profile_image_url } = userData.data;

    return {
      id: String(id),
      accessToken: access_token,
      name,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      picture: profile_image_url || '',
      username,
      additionalSettings: [
        {
          title: 'Verified',
          description: 'Is this a verified user? (Premium)',
          type: 'checkbox' as const,
          value: verified,
        },
      ],
    };
  }

  private async getXUsername(accessToken: string): Promise<string> {
    const resp = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=username',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!resp.ok) {
      const text = await resp.text();
      const err = new Error(
        `Failed to fetch X username (${resp.status}): ${text}`
      ) as Error & { code?: number };
      err.code = resp.status;
      throw err;
    }

    const data: any = await resp.json();
    return data.data.username as string;
  }

  private async getClient(accessToken: string) {
    return new TwitterApi({ oauth2Token: accessToken });
  }

  private getCredentials(): { clientId: string; clientSecret: string } {
    const clientId = process.env.X_CLIENT_ID;
    const clientSecret = process.env.X_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error(
        'Missing X OAuth2 credentials (X_CLIENT_ID / X_CLIENT_SECRET)'
      );
    }
    return { clientId, clientSecret };
  }

  private getXCallbackUrl() {
    return (
      (process.env.X_URL || process.env.FRONTEND_URL) + `/integrations/social/x`
    );
  }

  private async uploadMedia(
    client: TwitterApi,
    postDetails: PostDetails<any>[]
  ) {
    return (
      await Promise.all(
        postDetails.flatMap((p) =>
          p?.media?.flatMap(async (m) => {
            return {
              id: await this.runInConcurrent(
                async () =>
                  client.v2.uploadMedia(
                    m.path.indexOf('mp4') > -1
                      ? Buffer.from(await readOrFetch(m.path))
                      : await sharp(await readOrFetch(m.path), {
                          animated: lookup(m.path) === 'image/gif',
                        })
                          .resize({
                            width: 1000,
                          })
                          .gif()
                          .toBuffer(),
                    {
                      media_type: (lookup(m.path) || '') as any,
                    }
                  ),
                true
              ),
              postId: p.id,
            };
          })
        )
      )
    ).reduce((acc, val) => {
      if (!val?.id) {
        return acc;
      }

      acc[val.postId] = acc[val.postId] || [];
      acc[val.postId].push(val.id);

      return acc;
    }, {} as Record<string, string[]>);
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<{
      active_thread_finisher: boolean;
      thread_finisher: string;
      community?: string;
      who_can_reply_post:
        | 'everyone'
        | 'following'
        | 'mentionedUsers'
        | 'subscribers'
        | 'verified';
      made_with_ai?: boolean;
      paid_partnership?: boolean;
    }>[]
  ): Promise<PostResponse[]> {
    const client = await this.getClient(accessToken);
    const username = await this.runInConcurrent(() =>
      this.getXUsername(accessToken)
    );

    const [firstPost] = postDetails;

    const uploadAll = await this.uploadMedia(client, [firstPost]);
    const media_ids = (uploadAll[firstPost.id] || []).filter((f) => f);

    const tweetBody: Record<string, any> = { text: firstPost.message };

    if (media_ids.length) {
      tweetBody['media'] = { media_ids };
    }

    if (
      firstPost?.settings?.who_can_reply_post &&
      firstPost.settings.who_can_reply_post !== 'everyone'
    ) {
      tweetBody['reply_settings'] = firstPost.settings.who_can_reply_post;
    }

    if (firstPost?.settings?.community) {
      tweetBody['share_with_followers'] = true;
      tweetBody['community_id'] =
        firstPost.settings.community.split('/').pop() || '';
    }

    if (firstPost?.settings?.made_with_ai) {
      tweetBody['made_with_ai'] = true;
    }

    if (firstPost?.settings?.paid_partnership) {
      tweetBody['paid_partnership'] = true;
    }

    const tweetResp = await this.fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });

    const tweetData: any = await tweetResp.json();

    return [
      {
        postId: tweetData.data.id,
        id: firstPost.id,
        releaseURL: `https://twitter.com/${username}/status/${tweetData.data.id}`,
        status: 'posted',
      },
    ];
  }

  async comment(
    id: string,
    postId: string,
    lastCommentId: string | undefined,
    accessToken: string,
    postDetails: PostDetails<{
      active_thread_finisher: boolean;
      thread_finisher: string;
      made_with_ai?: boolean;
      paid_partnership?: boolean;
    }>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const client = await this.getClient(accessToken);
    const username = await this.runInConcurrent(() =>
      this.getXUsername(accessToken)
    );

    const [commentPost] = postDetails;

    const uploadAll = await this.uploadMedia(client, [commentPost]);
    const media_ids = (uploadAll[commentPost.id] || []).filter((f) => f);

    const replyToId = lastCommentId || postId;

    const tweetBody: Record<string, any> = {
      text: commentPost.message,
      reply: { in_reply_to_tweet_id: replyToId },
    };

    if (media_ids.length) {
      tweetBody['media'] = { media_ids };
    }

    if (commentPost?.settings?.made_with_ai) {
      tweetBody['made_with_ai'] = true;
    }

    if (commentPost?.settings?.paid_partnership) {
      tweetBody['paid_partnership'] = true;
    }

    const tweetResp = await this.fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
    });

    const tweetData: any = await tweetResp.json();

    return [
      {
        postId: tweetData.data.id,
        id: commentPost.id,
        releaseURL: `https://twitter.com/${username}/status/${tweetData.data.id}`,
        status: 'posted',
      },
    ];
  }

  private loadAllTweets = async (
    client: TwitterApi,
    id: string,
    until: string,
    since: string,
    token = '',
    excludeRepliesAndRetweets = true
  ): Promise<TweetV2[]> => {
    const tweets = await client.v2.userTimeline(id, {
      'tweet.fields': ['id'],
      'user.fields': [],
      'poll.fields': [],
      'place.fields': [],
      'media.fields': [],
      ...(excludeRepliesAndRetweets
        ? { exclude: ['replies', 'retweets'] as const }
        : {}),
      start_time: since,
      end_time: until,
      max_results: 100,
      ...(token ? { pagination_token: token } : {}),
    });

    const rows = tweets?.data?.data || [];

    return [
      ...rows,
      ...(rows.length === 100
        ? await this.loadAllTweets(
            client,
            id,
            until,
            since,
            tweets.meta.next_token,
            excludeRepliesAndRetweets
          )
        : []),
    ];
  };

  async analytics(
    id: string,
    accessToken: string,
    date: number
  ): Promise<AnalyticsData[]> {
    if (process.env.DISABLE_X_ANALYTICS) {
      return [];
    }

    // end_time must be in the past (X API requires ≥10 s before now).
    const until = dayjs().subtract(30, 'second');
    const since = dayjs().subtract(date > 100 ? 100 : date, 'day');

    const client = new TwitterApi({ oauth2Token: accessToken });

    // Quick probe: verify the token can reach the users/me endpoint before
    // attempting the heavier userTimeline call. This gives clearer error info.
    try {
      const me = await client.v2.me();
      console.log(`[X analytics] token OK — verified as user ${me.data.id} (@${me.data.username})`);
    } catch (probeErr) {
      const probeCode = (probeErr as any)?.code;
      const probeData = (probeErr as any)?.data;
      console.error(
        `[X analytics] probe (users/me) failed http=${probeCode}` +
        ` body=${JSON.stringify(probeData ?? (probeErr as any)?.message ?? null)}`
      );
      if (probeCode === 401) {
        // 401 on users/me almost always means the X Developer App is missing
        // "Read" permissions. Go to developer.twitter.com → your app →
        // User authentication settings → App permissions → "Read and Write".
        // After saving, reconnect the X account to get a token with read scope.
        console.error(
          `[X analytics] ACTION REQUIRED: your X Developer App likely has "Write only" permissions. ` +
          `Enable "Read and Write" at developer.twitter.com → App → User authentication settings → App permissions.`
        );
        // Do NOT throw RefreshToken — that triggers an unnecessary token rotation loop.
        // Just return empty data so the UI shows the empty state without the reconnect prompt.
        return [];
      }
    }

    try {
      const tweets = uniqBy(
        await this.loadAllTweets(
          client,
          id,
          until.format('YYYY-MM-DDTHH:mm:ssZ'),
          since.format('YYYY-MM-DDTHH:mm:ssZ')
        ),
        (p) => p.id
      );

      const timelineTweets =
        tweets.length > 0
          ? tweets
          : uniqBy(
              await this.loadAllTweets(
                client,
                id,
                until.format('YYYY-MM-DDTHH:mm:ssZ'),
                since.format('YYYY-MM-DDTHH:mm:ssZ'),
                '',
                false
              ),
              (p) => p.id
            );

      console.log(`[X analytics] user=${id} date=${date}d found=${timelineTweets.length} tweets`);

      if (timelineTweets.length === 0) {
        return [];
      }

      const data = await client.v2.tweets(
        timelineTweets.map((p) => p.id),
        {
          'tweet.fields': ['public_metrics'],
        }
      );

      const metrics = data.data.reduce(
        (all, current) => {
          all.impression_count =
            (all.impression_count || 0) +
            +current.public_metrics.impression_count;
          all.bookmark_count =
            (all.bookmark_count || 0) + +current.public_metrics.bookmark_count;
          all.like_count =
            (all.like_count || 0) + +current.public_metrics.like_count;
          all.quote_count =
            (all.quote_count || 0) + +current.public_metrics.quote_count;
          all.reply_count =
            (all.reply_count || 0) + +current.public_metrics.reply_count;
          all.retweet_count =
            (all.retweet_count || 0) + +current.public_metrics.retweet_count;

          return all;
        },
        {
          impression_count: 0,
          bookmark_count: 0,
          like_count: 0,
          quote_count: 0,
          reply_count: 0,
          retweet_count: 0,
        }
      );

      return Object.entries(metrics).map(([key, value]) => ({
        label: key.replace('_count', '').replace('_', ' ').toUpperCase(),
        percentageChange: 5,
        data: [
          {
            total: 0,
            date: since.format('YYYY-MM-DD'),
          },
          {
            total: value,
            date: until.format('YYYY-MM-DD'),
          },
        ],
      }));
    } catch (err) {
      const code   = (err as any)?.code;
      const data   = (err as any)?.data;
      const errors = data?.errors ?? data?.detail ?? data?.title ?? (err as any)?.message;
      console.error(
        `[X analytics] error user=${id} http=${code}` +
        ` body=${JSON.stringify(data ?? null)}`
      );
      if (code === 401) {
        throw new RefreshToken(
          'x',
          JSON.stringify(data || {}),
          '{}',
          'X analytics auth error (401). Please reconnect this channel.'
        );
      }
      if (code === 403) {
        // 403 = your X app does not have the required access level (Basic or higher).
        // Return a synthetic analytics response so the UI shows a helpful message
        // instead of a blank reconnect prompt.
        console.error(
          `[X analytics] 403 Forbidden — the X Developer App may be on the Free tier. ` +
          `Reading the user timeline requires Basic access ($100/mo). ` +
          `errors=${JSON.stringify(errors)}`
        );
      }
    }
    return [];
  }

  async postAnalytics(
    integrationId: string,
    accessToken: string,
    postId: string,
    date: number
  ): Promise<AnalyticsData[]> {
    if (process.env.DISABLE_X_ANALYTICS) {
      return [];
    }

    const today = dayjs().format('YYYY-MM-DD');

    const client = new TwitterApi({ oauth2Token: accessToken });

    try {
      // Fetch the specific tweet with public metrics
      const tweet = await client.v2.singleTweet(postId, {
        'tweet.fields': ['public_metrics', 'created_at'],
      });

      if (!tweet?.data?.public_metrics) {
        return [];
      }

      const metrics = tweet.data.public_metrics;

      const result: AnalyticsData[] = [];

      if (metrics.impression_count !== undefined) {
        result.push({
          label: 'Impressions',
          percentageChange: 0,
          data: [{ total: String(metrics.impression_count), date: today }],
        });
      }

      if (metrics.like_count !== undefined) {
        result.push({
          label: 'Likes',
          percentageChange: 0,
          data: [{ total: String(metrics.like_count), date: today }],
        });
      }

      if (metrics.retweet_count !== undefined) {
        result.push({
          label: 'Retweets',
          percentageChange: 0,
          data: [{ total: String(metrics.retweet_count), date: today }],
        });
      }

      if (metrics.reply_count !== undefined) {
        result.push({
          label: 'Replies',
          percentageChange: 0,
          data: [{ total: String(metrics.reply_count), date: today }],
        });
      }

      if (metrics.quote_count !== undefined) {
        result.push({
          label: 'Quotes',
          percentageChange: 0,
          data: [{ total: String(metrics.quote_count), date: today }],
        });
      }

      if (metrics.bookmark_count !== undefined) {
        result.push({
          label: 'Bookmarks',
          percentageChange: 0,
          data: [{ total: String(metrics.bookmark_count), date: today }],
        });
      }

      return result;
    } catch (err) {
      if ((err as any)?.code === 401) {
        throw new RefreshToken(
          'x',
          JSON.stringify((err as any)?.data || {}),
          '{}',
          'X post analytics auth error (401). Please reconnect this channel.'
        );
      }
      console.log('Error fetching X post analytics:', err);
    }

    return [];
  }

  override async mention(token: string, d: { query: string }) {
    const client = new TwitterApi({ oauth2Token: token });

    try {
      const data = await client.v2.userByUsername(d.query, {
        'user.fields': ['username', 'name', 'profile_image_url'],
      });

      if (!data?.data?.username) {
        return [];
      }

      return [
        {
          id: data.data.username,
          image: data.data.profile_image_url,
          label: data.data.name,
        },
      ];
    } catch (err) {
      console.log(err);
    }
    return [];
  }

  mentionFormat(idOrHandle: string, name: string) {
    return `@${idOrHandle}`;
  }
}
