import { BadBody, RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import {
  resolveOrgApiKey,
  hasOrgScopedKey,
} from '@gitroom/nestjs-libraries/org-api-keys/org-api-key.store';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

export interface LateAccount {
  _id: string;
  platform: string;
  displayName: string;
  profileUrl?: string;
  isActive: boolean;
  username?: string;
}

export interface LatePageInfo {
  id: string;
  name: string;
  username?: string;
  category?: string;
  fan_count?: number;
}

export interface LatePagesResponse {
  pages: LatePageInfo[];
  selectedPageId: string | null;
  cached: boolean;
}

const LATE_API_BASE_URL =
  process.env.LATE_API_URL?.trim() || 'https://getlate.dev/api/v1';

export class LateApiService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private toDateString(input: string | Date): string {
    if (typeof input === 'string') return input;
    return input.toISOString().slice(0, 10);
  }

  private buildDateRangeQuery(
    fromDate?: string | Date,
    toDate?: string | Date
  ): string {
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', this.toDateString(fromDate));
    if (toDate) params.set('toDate', this.toDateString(toDate));
    const query = params.toString();
    return query ? `&${query}` : '';
  }

  private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${LATE_API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    let response: Response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (err) {
      const msg = `Late API network error: ${err instanceof Error ? err.message : String(err)}`;
      console.error('[LateAPI]', msg);
      throw new BadBody('late-api', '{}', '{}', msg);
    }

    let body = '{}';
    try {
      body = await response.text();
    } catch {
      /* empty */
    }

    if (response.ok) {
      try {
        return JSON.parse(body);
      } catch {
        return {};
      }
    }

    console.error(`[LateAPI] ${response.status} ${endpoint}: ${body}`);

    if (response.status === 401 || response.status === 403) {
      throw new RefreshToken('late-api', body, '{}', `Late API auth error (${response.status}): check LATE_API_KEY`);
    }

    if (response.status === 429) {
      throw new BadBody('late-api', body, '{}', 'Late API rate limit exceeded, please try again later');
    }

    throw new BadBody('late-api', body, '{}', `Late API error ${response.status}: ${body}`);
  }

  private async getConnectUrl(platform: string, profileId: string, redirectUrl?: string, state?: string): Promise<string> {
    let query = `?profileId=${encodeURIComponent(profileId)}`;
    if (redirectUrl) query += `&redirect_url=${encodeURIComponent(redirectUrl)}`;
    if (state) query += `&state=${encodeURIComponent(state)}`;
    const data = await this.request(`/connect/${platform}${query}`);
    const url = data?.authUrl || data?.url;
    if (!url || typeof url !== 'string') {
      throw new BadBody('late-api', '{}', '{}', `Failed to get ${platform} auth URL from Late API`);
    }
    return url;
  }

  getFacebookConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('facebook', profileId, redirectUrl, state);
  }

  getInstagramConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('instagram', profileId, redirectUrl, state);
  }

  getTwitterConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('twitter', profileId, redirectUrl, state);
  }

  getLinkedInConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('linkedin', profileId, redirectUrl, state);
  }

  getTikTokConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('tiktok', profileId, redirectUrl, state);
  }

  getYouTubeConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('youtube', profileId, redirectUrl, state);
  }

  getRedditConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('reddit', profileId, redirectUrl, state);
  }

  getThreadsConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('threads', profileId, redirectUrl, state);
  }

  getWhatsAppConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('whatsapp', profileId, redirectUrl, state);
  }

  getPinterestConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('pinterest', profileId, redirectUrl, state);
  }

  getMetaAdsConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('facebook-ads', profileId, redirectUrl, state);
  }

  getInstagramAdsConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('instagram-ads', profileId, redirectUrl, state);
  }

  getLinkedInAdsConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('linkedin-ads', profileId, redirectUrl, state);
  }

  getTikTokAdsConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('tiktok-ads', profileId, redirectUrl, state);
  }

  getGoogleAdsConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('google-ads', profileId, redirectUrl, state);
  }

  getXAdsConnectUrl(profileId: string, redirectUrl?: string, state?: string) {
    return this.getConnectUrl('twitter-ads', profileId, redirectUrl, state);
  }

  async createProfile(name: string): Promise<{ _id: string; name: string }> {
    const data = await this.request('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return data?.profile ?? data;
  }

  async listProfiles(): Promise<Array<{ _id: string; name: string }>> {
    const data = await this.request('/profiles');
    return Array.isArray(data?.profiles) ? data.profiles : Array.isArray(data) ? data : [];
  }

  async getAccounts(profileId?: string): Promise<LateAccount[]> {
    const query = profileId ? `?profileId=${encodeURIComponent(profileId)}` : '';
    const data = await this.request(`/accounts${query}`);
    return Array.isArray(data?.accounts) ? data.accounts : [];
  }

  async getFacebookPages(accountId: string): Promise<LatePagesResponse> {
    const data = await this.request(`/accounts/${encodeURIComponent(accountId)}/facebook-page`);
    return {
      pages: data?.pages ?? [],
      selectedPageId: data?.selectedPageId ?? null,
      cached: data?.cached ?? false,
    };
  }

  async updateFacebookPage(accountId: string, pageId: string): Promise<void> {
    await this.request(`/accounts/${encodeURIComponent(accountId)}/facebook-page`, {
      method: 'PUT',
      body: JSON.stringify({ pageId }),
    });
  }

  async getAccountInsights(accountId: string, days: number): Promise<any> {
    return this.request(`/analytics?days=${days}&accountId=${encodeURIComponent(accountId)}`);
  }

  async getPostInsights(accountId: string, days: number): Promise<any> {
    return this.request(`/analytics?days=${days}&accountId=${encodeURIComponent(accountId)}`);
  }

  async getPostAnalytics(
    accountId: string,
    fromDate?: string,
    toDate?: string,
    postId?: string
  ): Promise<any> {
    const postQuery = postId ? `&postId=${encodeURIComponent(postId)}` : '';
    return this.request(
      `/analytics?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}${postQuery}`
    );
  }

  async getBestTimeToPost(accountId: string): Promise<any> {
    return this.request(`/analytics/best-time?accountId=${encodeURIComponent(accountId)}`);
  }

  async getDailyMetrics(accountId: string, fromDate?: string, toDate?: string): Promise<any> {
    return this.request(
      `/analytics/daily-metrics?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}`
    );
  }

  async getContentDecay(accountId: string): Promise<any> {
    return this.request(`/analytics/content-decay?accountId=${encodeURIComponent(accountId)}`);
  }

  async getPostingFrequency(accountId: string): Promise<any> {
    return this.request(`/analytics/posting-frequency?accountId=${encodeURIComponent(accountId)}`);
  }

  async getFollowerStats(accountId: string): Promise<any> {
    return this.request(`/accounts/follower-stats?accountId=${encodeURIComponent(accountId)}`);
  }

  async getInstagramAccountInsights(
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any> {
    return this.request(
      `/analytics/instagram/account-insights?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}`
    );
  }

  async getInstagramFollowerHistory(
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any> {
    return this.request(
      `/analytics/instagram/follower-history?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}`
    );
  }

  async getInstagramDemographics(accountId: string, dimension?: string): Promise<any> {
    const dimQuery = dimension ? `&dimension=${encodeURIComponent(dimension)}` : '';
    return this.request(
      `/analytics/instagram/demographics?accountId=${encodeURIComponent(accountId)}${dimQuery}`
    );
  }

  async getFacebookPageInsights(
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any> {
    return this.request(
      `/analytics/facebook/page-insights?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}`
    );
  }

  async getLinkedInAggregateAnalytics(
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any> {
    return this.request(
      `/analytics/linkedin/aggregate-analytics?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}`
    );
  }

  async getLinkedInOrgAnalytics(
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any> {
    return this.request(
      `/analytics/linkedin/org-aggregate-analytics?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}`
    );
  }

  async getLinkedInPostAnalytics(accountId: string, postId: string): Promise<any> {
    return this.request(
      `/analytics/linkedin/post-analytics?accountId=${encodeURIComponent(accountId)}&postId=${encodeURIComponent(postId)}`
    );
  }

  async getLinkedInPostReactions(accountId: string, postId: string): Promise<any> {
    return this.request(
      `/accounts/${encodeURIComponent(accountId)}/linkedin-post-reactions?postId=${encodeURIComponent(postId)}`
    );
  }

  async getPostAnalyticsTimeline(postId: string): Promise<any> {
    return this.request(`/analytics/post-timeline?postId=${encodeURIComponent(postId)}`);
  }

  async getTikTokAccountInsights(
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any> {
    return this.request(
      `/analytics/tiktok/account-insights?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}`
    );
  }

  async getYouTubeChannelInsights(
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any> {
    return this.request(
      `/analytics/youtube/channel-insights?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}`
    );
  }

  async getYouTubeDailyViews(
    accountId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<any> {
    return this.request(
      `/analytics/youtube/daily-views?accountId=${encodeURIComponent(accountId)}${this.buildDateRangeQuery(fromDate, toDate)}`
    );
  }

  async getYouTubeDemographics(accountId: string): Promise<any> {
    return this.request(`/analytics/youtube/demographics?accountId=${encodeURIComponent(accountId)}`);
  }

  async getGBPPerformance(accountId: string, startDate: string, endDate: string): Promise<any> {
    return this.request(
      `/analytics/googlebusiness/performance?accountId=${encodeURIComponent(accountId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
    );
  }

  async getGBPSearchKeywords(
    accountId: string,
    startMonth: string,
    endMonth: string
  ): Promise<any> {
    return this.request(
      `/analytics/googlebusiness/search-keywords?accountId=${encodeURIComponent(accountId)}&startMonth=${encodeURIComponent(startMonth)}&endMonth=${encodeURIComponent(endMonth)}`
    );
  }

  async getAdAnalytics(adId: string, fromDate?: string, toDate?: string): Promise<any> {
    const query = new URLSearchParams();
    if (fromDate) query.set('fromDate', fromDate);
    if (toDate) query.set('toDate', toDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/ads/${encodeURIComponent(adId)}/analytics${suffix}`);
  }

  async createPost(payload: {
    platforms: Array<{
      platform: string;
      accountId: string;
      platformSpecificData?: Record<string, any>;
      customContent?: string;
      customMedia?: Array<{ type: string; url: string }>;
    }>;
    content?: string;
    mediaItems?: Array<{ type: string; url: string }>;
    publishNow: boolean;
  }): Promise<any> {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

// BYOK: instances are keyed by the resolved API key. An organization with its
// own key (Settings → API Keys) gets its own instance; orgs without one share
// the env-key instance — identical to the old singleton behavior.
const _instances = new Map<string, LateApiService>();

export async function getLateApi(organizationId?: string | null): Promise<LateApiService> {
  const apiKey = await resolveOrgApiKey('late-api', organizationId);
  if (!apiKey) {
    throw new Error(
      'No Late API key available — add one in Settings → API Keys, or set LATE_API_KEY in the server environment'
    );
  }
  let instance = _instances.get(apiKey);
  if (!instance) {
    instance = new LateApiService(apiKey);
    _instances.set(apiKey, instance);
  }
  return instance;
}

// Cached Late API profile IDs — one profile is shared across all channel
// connections that use the same key. Creating a new profile per connection
// exhausts plan limits (Free = 2 profiles total).
// Env-key path: in-memory singleton (same as before BYOK).
// Org-key path: cached in Redis per organization, invalidated on key change.
let _sharedProfileId: string | null = null;

const lateProfileCacheKey = (organizationId: string) => `late:profile:${organizationId}`;

async function lookupOrCreateProfile(api: LateApiService): Promise<string> {
  const existing = await api.listProfiles();
  if (existing.length > 0) {
    return existing[0]._id;
  }
  const created = await api.createProfile('hootnshoot');
  console.log(`[LateAPI] Created profile ${created._id}`);
  return created._id;
}

export async function getOrCreateProfile(organizationId?: string | null): Promise<string> {
  const usesOrgKey = organizationId
    ? await hasOrgScopedKey('late-api', organizationId)
    : false;

  if (organizationId && usesOrgKey) {
    const cacheKey = lateProfileCacheKey(organizationId);
    const cached = await ioRedis.get(cacheKey);
    if (cached) return cached;
    const api = await getLateApi(organizationId);
    const profileId = await lookupOrCreateProfile(api);
    await ioRedis.set(cacheKey, profileId);
    return profileId;
  }

  // Env-key path — preserve the original shared-profile behavior exactly
  if (_sharedProfileId) return _sharedProfileId;
  if (process.env.LATE_API_PROFILE_ID) {
    _sharedProfileId = process.env.LATE_API_PROFILE_ID;
    return _sharedProfileId;
  }
  const api = await getLateApi();
  _sharedProfileId = await lookupOrCreateProfile(api);
  console.log(
    `[LateAPI] Using shared profile ${_sharedProfileId} — set LATE_API_PROFILE_ID=${_sharedProfileId} to skip this lookup on restart`
  );
  return _sharedProfileId;
}

export async function invalidateLateProfileCache(organizationId: string): Promise<void> {
  try {
    await ioRedis.del(lateProfileCacheKey(organizationId));
  } catch {
    /* best-effort */
  }
}
