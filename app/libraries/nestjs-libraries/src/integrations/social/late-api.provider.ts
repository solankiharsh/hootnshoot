import {
  AnalyticsData,
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { Integration } from '@prisma/client';
import {
  getLateApi,
  getOrCreateProfile,
  LateApiService,
} from '@gitroom/nestjs-libraries/integrations/social/late-api.service';
import { ClientInformation } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

export abstract class LateApiProvider extends SocialAbstract implements SocialProvider {
  abstract identifier: string;
  abstract name: string;
  // Late API platform name (e.g. 'twitter', 'instagram', 'tiktok')
  abstract latePlatform: string;
  // Method on LateApiService that returns the OAuth URL (state is passed through for Redis keying)
  abstract getConnectUrl(api: LateApiService, profileId: string, redirectUrl: string, state: string): Promise<string>;

  isBetweenSteps = false;
  editor = 'normal' as const;
  scopes: string[] = [];
  override maxConcurrentJob = 100;
  maxLength() {
    return 2200;
  }

  async generateAuthUrl(_clientInformation?: ClientInformation, organizationId?: string) {
    const redirectUrl = `${process.env.FRONTEND_URL}/integrations/social/${this.identifier}`;
    // Connections share one Late API profile per key (reused, not re-created).
    // state = lateProfileId because Late API echoes back `profileId` in the callback URL,
    // so the frontend maps searchParams.profileId → state for the Redis org lookup.
    // codeVerifier = lateProfileId so authenticate() can call getAccounts(profileId).
    const api = await getLateApi(organizationId);
    const lateProfileId = await getOrCreateProfile(organizationId);
    const authUrl = await this.getConnectUrl(api, lateProfileId, redirectUrl, lateProfileId);
    return { url: authUrl, codeVerifier: lateProfileId, state: lateProfileId };
  }

  // params.code = Late API accountId from callback; params.codeVerifier = lateProfileId
  async authenticate(params: { code: string; codeVerifier: string; refresh?: string; organizationId?: string }): Promise<AuthTokenDetails> {
    const accounts = await (await getLateApi(params.organizationId)).getAccounts(params.codeVerifier);
    // Use params.code as accountId when present; fall back to the first account in this profile
    const account = (params.code ? accounts.find((a) => a._id === params.code) : null) ?? accounts[0];
    const lateAccountId = account?._id || params.code;
    if (!lateAccountId) {
      throw new Error(`Late API: no account found for profileId ${params.codeVerifier}`);
    }
    return {
      id: lateAccountId,
      name: account?.displayName || this.name,
      accessToken: lateAccountId,
      refreshToken: lateAccountId,
      picture: '',
      username: account?.username || '',
      expiresIn: 365 * 24 * 60 * 60,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    return {
      id: refreshToken,
      name: '',
      accessToken: refreshToken,
      refreshToken,
      picture: '',
      username: '',
      expiresIn: 365 * 24 * 60 * 60,
    };
  }

  async post(
    id: string,
    _accessToken: string,
    postDetails: PostDetails[],
    _integration: Integration
  ): Promise<PostResponse[]> {
    const api = await getLateApi(_integration.organizationId);
    return Promise.all(
      postDetails.map(async (p) => {
        const result = await api.createPost({
          platforms: [
            {
              platform: this.latePlatform,
              accountId: id,
              platformSpecificData: p.settings || undefined,
              customContent: p.message,
              customMedia: p.media?.map((m) => ({ type: m.type, url: m.path })),
            },
          ],
          content: p.message,
          mediaItems: p.media?.map((m) => ({ type: m.type, url: m.path })),
          publishNow: true,
        });

        const target = Array.isArray(result?.targets)
          ? result.targets.find((t: any) => t.platform === this.latePlatform)
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

  async analytics(id: string, _accessToken: string, date: number, organizationId?: string): Promise<AnalyticsData[]> {
    try {
      const raw = await (await getLateApi(organizationId)).getAccountInsights(id, date);
      return this.normalizeAccountAnalytics(raw);
    } catch {
      return [];
    }
  }

  async postAnalytics(
    _integrationId: string,
    accessToken: string,
    postId: string,
    fromDate: number,
    organizationId?: string,
  ): Promise<AnalyticsData[]> {
    try {
      const raw = await (await getLateApi(organizationId)).getPostInsights(accessToken, fromDate);
      const post = (raw?.posts ?? []).find(
        (p: any) => p.platformPostId === postId || p.id === postId
      );
      if (!post?.analytics) return [];
      const metricLabels: Record<string, string> = {
        impressions: 'Impressions',
        reach: 'Reach',
        likes: 'Likes',
        comments: 'Comments',
        shares: 'Shares',
        saves: 'Saves',
        clicks: 'Clicks',
        views: 'Views',
      };
      const date = post.publishedAt?.slice(0, 10) ?? '';
      return Object.entries(metricLabels)
        .filter(([key]) => post.analytics[key] != null)
        .map(([key, label]) => ({
          label,
          data: [{ date, total: String(post.analytics[key] ?? 0) }],
          percentageChange: 0,
        }));
    } catch {
      return [];
    }
  }

  private normalizeAccountAnalytics(raw: any): AnalyticsData[] {
    const posts: any[] = raw?.posts ?? [];
    if (!posts.length) return [];

    const metricKeys = ['impressions', 'reach', 'likes', 'comments', 'shares', 'saves', 'clicks', 'views'] as const;
    const metricLabels: Record<string, string> = {
      impressions: 'Impressions',
      reach: 'Reach',
      likes: 'Likes',
      comments: 'Comments',
      shares: 'Shares',
      saves: 'Saves',
      clicks: 'Clicks',
      views: 'Views',
    };

    const byDate = new Map<string, Record<string, number>>();
    for (const post of posts) {
      if (!post.publishedAt || !post.analytics) continue;
      const date = post.publishedAt.slice(0, 10);
      const agg = byDate.get(date) ?? {};
      for (const key of metricKeys) {
        agg[key] = (agg[key] ?? 0) + (Number(post.analytics[key]) || 0);
      }
      byDate.set(date, agg);
    }

    const sortedDates = Array.from(byDate.keys()).sort();
    const results: AnalyticsData[] = [];

    for (const key of metricKeys) {
      const data = sortedDates.map((date) => ({
        date,
        total: String(byDate.get(date)?.[key] ?? 0),
      }));
      const totals = data.map((d) => Number(d.total));
      if (totals.every((v) => v === 0)) continue;
      const last = totals[totals.length - 1] ?? 0;
      const prev = totals[totals.length - 2] ?? last;
      const percentageChange = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
      results.push({ label: metricLabels[key], data, percentageChange });
    }

    return results;
  }
}
