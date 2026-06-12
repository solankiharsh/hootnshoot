import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import {
  AnalyticsData,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { Integration, Organization } from '@prisma/client';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import dayjs from 'dayjs';
import { timer } from '@gitroom/helpers/utils/timer';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { IntegrationTimeDto } from '@gitroom/nestjs-libraries/dtos/integrations/integration.time.dto';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { PlugDto } from '@gitroom/nestjs-libraries/dtos/plugs/plug.dto';
import { difference, uniq } from 'lodash';
import utc from 'dayjs/plugin/utc';
import { AutopostRepository } from '@gitroom/nestjs-libraries/database/prisma/autopost/autopost.repository';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { TemporalService } from 'nestjs-temporal-core';
import { getLateApiInstance } from '@gitroom/nestjs-libraries/integrations/social/late-api.service';

dayjs.extend(utc);

@Injectable()
export class IntegrationService {
  private storage = UploadFactory.createStorage();
  private getAnalyticsCacheTtlSeconds(): number {
    const ttl = Number(process.env.ANALYTICS_CACHE_TTL_SECONDS || 3600);
    return Number.isFinite(ttl) && ttl > 0 ? ttl : 3600;
  }
  constructor(
    private _integrationRepository: IntegrationRepository,
    private _autopostsRepository: AutopostRepository,
    private _integrationManager: IntegrationManager,
    private _notificationService: NotificationService,
    @Inject(forwardRef(() => RefreshIntegrationService))
    private _refreshIntegrationService: RefreshIntegrationService,
    private _temporalService: TemporalService
  ) {}

  async changeActiveCron(orgId: string) {
    const data = await this._autopostsRepository.getAutoposts(orgId);

    for (const item of data.filter((f) => f.active)) {
      try {
        await this._temporalService.terminateWorkflow(`autopost-${item.id}`);
      } catch (err) {}
    }

    return true;
  }

  getMentions(platform: string, q: string) {
    return this._integrationRepository.getMentions(platform, q);
  }

  insertMentions(
    platform: string,
    mentions: { name: string; username: string; image: string }[]
  ) {
    return this._integrationRepository.insertMentions(platform, mentions);
  }

  async setTimes(
    orgId: string,
    integrationId: string,
    times: IntegrationTimeDto
  ) {
    return this._integrationRepository.setTimes(orgId, integrationId, times);
  }

  updateProviderSettings(org: string, id: string, additionalSettings: string) {
    return this._integrationRepository.updateProviderSettings(
      org,
      id,
      additionalSettings
    );
  }

  checkPreviousConnections(org: string, id: string) {
    return this._integrationRepository.checkPreviousConnections(org, id);
  }

  async createOrUpdateIntegration(
    additionalSettings:
      | {
          title: string;
          description: string;
          type: 'checkbox' | 'text' | 'textarea';
          value: any;
          regex?: string;
        }[]
      | undefined,
    oneTimeToken: boolean,
    org: string,
    name: string,
    picture: string | undefined,
    type: 'article' | 'social',
    internalId: string,
    provider: string,
    token: string,
    refreshToken = '',
    expiresIn?: number,
    username?: string,
    isBetweenSteps = false,
    refresh?: string,
    timezone?: number,
    customInstanceDetails?: string
  ) {
    const uploadedPicture = picture
      ? picture?.indexOf('imagedelivery.net') > -1
        ? picture
        : await this.storage.uploadSimple(picture)
      : undefined;

    return this._integrationRepository.createOrUpdateIntegration(
      additionalSettings,
      oneTimeToken,
      org,
      name,
      uploadedPicture,
      type,
      internalId,
      provider,
      token,
      refreshToken,
      expiresIn,
      username,
      isBetweenSteps,
      refresh,
      timezone,
      customInstanceDetails
    );
  }

  updateIntegrationGroup(org: string, id: string, group: string) {
    return this._integrationRepository.updateIntegrationGroup(org, id, group);
  }

  updateOnCustomerName(org: string, id: string, name: string) {
    return this._integrationRepository.updateOnCustomerName(org, id, name);
  }

  getIntegrationsList(org: string) {
    return this._integrationRepository.getIntegrationsList(org);
  }

  getIntegrationForOrder(id: string, order: string, user: string, org: string) {
    return this._integrationRepository.getIntegrationForOrder(
      id,
      order,
      user,
      org
    );
  }

  updateNameAndUrl(id: string, name: string, url: string) {
    return this._integrationRepository.updateNameAndUrl(id, name, url);
  }

  getIntegrationById(org: string, id: string) {
    return this._integrationRepository.getIntegrationById(org, id);
  }

  async refreshToken(provider: SocialProvider, refresh: string) {
    try {
      const { refreshToken, accessToken, expiresIn } =
        await provider.refreshToken(refresh);

      if (!refreshToken || !accessToken || !expiresIn) {
        return false;
      }

      return { refreshToken, accessToken, expiresIn };
    } catch (e) {
      return false;
    }
  }

  async disconnectChannel(orgId: string, integration: Integration) {
    await this._integrationRepository.disconnectChannel(orgId, integration.id);
    await this.informAboutRefreshError(orgId, integration);
  }

  async informAboutRefreshError(
    orgId: string,
    integration: Integration,
    err = ''
  ) {
    await this._notificationService.inAppNotification(
      orgId,
      `Could not refresh your ${integration.providerIdentifier} channel ${err}`,
      `Could not refresh your ${integration.providerIdentifier} channel ${err}. Please go back to the system and connect it again ${process.env.FRONTEND_URL}/launches`,
      true,
      false,
      'info'
    );
  }

  async refreshNeeded(org: string, id: string) {
    return this._integrationRepository.refreshNeeded(org, id);
  }

  async setBetweenRefreshSteps(id: string) {
    return this._integrationRepository.setBetweenRefreshSteps(id);
  }

  async refreshTokens() {
    const integrations = await this._integrationRepository.needsToBeRefreshed();
    for (const integration of integrations) {
      const provider = this._integrationManager.getSocialIntegration(
        integration.providerIdentifier
      );

      const data = await this.refreshToken(provider, integration.refreshToken!);

      if (!data) {
        await this.informAboutRefreshError(
          integration.organizationId,
          integration
        );
        await this._integrationRepository.refreshNeeded(
          integration.organizationId,
          integration.id
        );
        return;
      }

      const { refreshToken, accessToken, expiresIn } = data;

      await this.createOrUpdateIntegration(
        undefined,
        !!provider.oneTimeToken,
        integration.organizationId,
        integration.name,
        undefined,
        'social',
        integration.internalId,
        integration.providerIdentifier,
        accessToken,
        refreshToken,
        expiresIn
      );
    }
  }

  async disableChannel(org: string, id: string) {
    return this._integrationRepository.disableChannel(org, id);
  }

  async enableChannel(org: string, totalChannels: number, id: string) {
    const integrations = (
      await this._integrationRepository.getIntegrationsList(org)
    ).filter((f) => !f.disabled);
    if (
      !!process.env.STRIPE_PUBLISHABLE_KEY &&
      integrations.length >= totalChannels
    ) {
      throw new Error('You have reached the maximum number of channels');
    }

    return this._integrationRepository.enableChannel(org, id);
  }

  async getPostsForChannel(org: string, id: string) {
    return this._integrationRepository.getPostsForChannel(org, id);
  }

  async deleteChannel(org: string, id: string) {
    return this._integrationRepository.deleteChannel(org, id);
  }

  async disableIntegrations(org: string, totalChannels: number) {
    return this._integrationRepository.disableIntegrations(org, totalChannels);
  }

  async checkForDeletedOnceAndUpdate(org: string, page: string) {
    return this._integrationRepository.checkForDeletedOnceAndUpdate(org, page);
  }

  async saveProviderPage(org: string, id: string, data: any) {
    const getIntegration = await this._integrationRepository.getIntegrationById(
      org,
      id
    );
    if (!getIntegration) {
      throw new HttpException('Integration not found', HttpStatus.NOT_FOUND);
    }
    if (!getIntegration.inBetweenSteps) {
      throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);
    }

    const provider = this._integrationManager.getSocialIntegration(
      getIntegration.providerIdentifier
    );

    if (!provider.fetchPageInformation) {
      throw new HttpException(
        'Provider does not support page selection',
        HttpStatus.BAD_REQUEST
      );
    }

    const getIntegrationInformation = await provider.fetchPageInformation(
      getIntegration.token,
      data
    );

    await this.checkForDeletedOnceAndUpdate(
      org,
      String(getIntegrationInformation.id)
    );
    await this._integrationRepository.updateIntegration(id, {
      picture: getIntegrationInformation.picture,
      internalId: String(getIntegrationInformation.id),
      organizationId: org,
      name: getIntegrationInformation.name,
      inBetweenSteps: false,
      token: getIntegrationInformation.access_token,
      profile: getIntegrationInformation.username,
    });

    return { success: true };
  }

  async checkAnalytics(
    org: Organization,
    integration: string,
    date: string,
    forceRefresh = false
  ): Promise<AnalyticsData[]> {
    console.log(`[checkAnalytics] start integration=${integration} date=${date} forceRefresh=${forceRefresh}`);

    const getIntegration = await this.getIntegrationById(org.id, integration);

    if (!getIntegration) {
      console.log(`[checkAnalytics] integration not found: ${integration}`);
      throw new Error('Invalid integration');
    }

    if (getIntegration.type !== 'social') {
      return [];
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(
      getIntegration.providerIdentifier
    );

    const tokenExpired = dayjs(getIntegration?.tokenExpiration).isBefore(dayjs());
    console.log(`[checkAnalytics] provider=${getIntegration.providerIdentifier} tokenExpired=${tokenExpired} forceRefresh=${forceRefresh} expiration=${getIntegration?.tokenExpiration}`);

    // For analytics (read-only), attempt a lightweight token refresh when the
    // token is expired or an explicit retry is requested.
    // IMPORTANT: never call disconnectChannel here — a failed refresh during a
    // read should not delete the integration. The user can reconnect via the UI.
    if (tokenExpired || forceRefresh) {
      console.log(`[checkAnalytics] refreshing token (analytics-safe)...`);
      try {
        const refreshResult = await integrationProvider.refreshToken(getIntegration.refreshToken);
        if (refreshResult?.accessToken) {
          getIntegration.token        = refreshResult.accessToken;
          getIntegration.refreshToken = refreshResult.refreshToken ?? getIntegration.refreshToken;
          console.log(`[checkAnalytics] token refreshed OK`);
          // Persist rotated tokens to DB directly (do NOT call refresh() again — that would re-rotate).
          // Use the repository's raw Prisma access to avoid the deduplication logic in updateIntegration.
          this._integrationRepository['_integration'].model.integration
            .update({
              where: { id: getIntegration.id },
              data: {
                token:           refreshResult.accessToken,
                refreshToken:    refreshResult.refreshToken ?? getIntegration.refreshToken,
                tokenExpiration: new Date(Date.now() + (refreshResult.expiresIn ?? 7200) * 1000),
                refreshNeeded:   false,
              },
            })
            .catch((e) => console.error(`[checkAnalytics] DB token persist error:`, (e as Error).message));
        } else {
          console.log(`[checkAnalytics] refresh returned no accessToken, proceeding with stored token`);
        }
      } catch (refreshErr) {
        console.error(`[checkAnalytics] token refresh error (non-fatal for analytics): ${(refreshErr as Error).message}`);
        // Proceed with the stored token — if it's also invalid, analytics() will
        // throw RefreshToken and we'll return [] below (no disconnect).
      }
    }

    console.log(`[checkAnalytics] checking Redis cache...`);
    let getIntegrationData: string | null = null;
    try {
      getIntegrationData = await Promise.race([
        ioRedis.get(`integration:${org.id}:${integration}:${date}`),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error('Redis GET timeout')), 5000)
        ),
      ]) as string | null;
    } catch (redisErr) {
      console.error(`[checkAnalytics] Redis GET error:`, (redisErr as Error).message);
    }

    if (getIntegrationData) {
      console.log(`[checkAnalytics] Redis cache hit, returning cached data`);
      return JSON.parse(getIntegrationData);
    }

    console.log(`[checkAnalytics] cache miss, calling provider.analytics()...`);
    if (integrationProvider.analytics) {
      try {
        const loadAnalytics = await integrationProvider.analytics(
          getIntegration.internalId,
          getIntegration.token,
          +date
        );
        console.log(`[checkAnalytics] analytics returned ${Array.isArray(loadAnalytics) ? loadAnalytics.length : '?'} items`);
        // Fire-and-forget cache write — don't let a slow Redis block the response.
        Promise.race([
          ioRedis.set(
            `integration:${org.id}:${integration}:${date}`,
            JSON.stringify(loadAnalytics),
            'EX',
            this.getAnalyticsCacheTtlSeconds()
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Redis SET timeout')), 3000)
          ),
        ]).catch((e) => console.error(`[checkAnalytics] Redis SET error:`, e.message));

        return loadAnalytics;
      } catch (e) {
        if (e instanceof RefreshToken && !forceRefresh) {
          // Only retry once to avoid infinite recursion + token exhaustion.
          console.log(`[checkAnalytics] got RefreshToken, retrying once with forceRefresh=true`);
          return this.checkAnalytics(org, integration, date, true);
        }
        if (e instanceof RefreshToken && forceRefresh) {
          // Already retried — the token is truly invalid. Mark refreshNeeded so
          // the UI prompts reconnect, but do NOT disconnect the integration.
          console.log(`[checkAnalytics] RefreshToken on retry — marking refreshNeeded, returning []`);
          await this._integrationRepository.refreshNeeded(org.id, integration);
          return [];
        }
        console.error(`[checkAnalytics] analytics error:`, (e as Error).message);
      }
    }

    return [];
  }

  private async getAnalyticsIntegration(
    org: Organization,
    integration: string,
    forceRefresh = false
  ) {
    const getIntegration = await this.getIntegrationById(org.id, integration);
    if (!getIntegration || getIntegration.type !== 'social') return null;

    const integrationProvider = this._integrationManager.getSocialIntegration(
      getIntegration.providerIdentifier
    );

    if (
      dayjs(getIntegration?.tokenExpiration).isBefore(dayjs()) ||
      forceRefresh
    ) {
      const data = await this._refreshIntegrationService.refresh(getIntegration);
      if (!data) return null;
      const { accessToken } = data;
      if (!accessToken) {
        await this.disconnectChannel(org.id, getIntegration);
        return null;
      }
      getIntegration.token = accessToken;
      if (integrationProvider.refreshWait) {
        await timer(10000);
      }
    }

    return {
      getIntegration,
      integrationProvider,
    };
  }

  async getExtendedAnalytics(
    org: Organization,
    integration: string,
    type: 'best-time' | 'decay' | 'daily' | 'followers' | 'frequency',
    fromDate?: string,
    toDate?: string,
    forceRefresh = false
  ): Promise<any> {
    const cacheKey = `integration:${org.id}:${integration}:extended:${type}:${fromDate || ''}:${toDate || ''}`;
    const cached = await ioRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const context = await this.getAnalyticsIntegration(org, integration, forceRefresh);
    if (!context) return [];
    const { getIntegration } = context;

    if (!getIntegration.providerIdentifier.endsWith('-late')) {
      return [];
    }

    try {
      const late = getLateApiInstance();
      let payload: any = [];
      if (type === 'best-time') {
        payload = await late.getBestTimeToPost(getIntegration.internalId);
      } else if (type === 'decay') {
        payload = await late.getContentDecay(getIntegration.internalId);
      } else if (type === 'daily') {
        payload = await late.getDailyMetrics(getIntegration.internalId, fromDate, toDate);
      } else if (type === 'followers') {
        payload = await late.getFollowerStats(getIntegration.internalId);
      } else if (type === 'frequency') {
        payload = await late.getPostingFrequency(getIntegration.internalId);
      }

      await ioRedis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        this.getAnalyticsCacheTtlSeconds()
      );

      return payload;
    } catch (e) {
      if (e instanceof RefreshToken) {
        return this.getExtendedAnalytics(
          org,
          integration,
          type,
          fromDate,
          toDate,
          true
        );
      }
      return [];
    }
  }

  private getLateBasePlatform(providerIdentifier: string): string {
    if (!providerIdentifier.endsWith('-late')) return providerIdentifier;
    const stripped = providerIdentifier.slice(0, -5);
    return stripped.endsWith('-ads') ? stripped.slice(0, -4) : stripped;
  }

  async getAccountInsightsAnalytics(
    org: Organization,
    integration: string,
    fromDate?: string,
    toDate?: string,
    forceRefresh = false
  ): Promise<any> {
    const cacheKey = `integration:${org.id}:${integration}:account-insights:${fromDate || ''}:${toDate || ''}`;
    const cached = await ioRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const context = await this.getAnalyticsIntegration(org, integration, forceRefresh);
    if (!context) return [];
    const { getIntegration } = context;
    if (!getIntegration.providerIdentifier.endsWith('-late')) return [];

    const basePlatform = this.getLateBasePlatform(getIntegration.providerIdentifier);
    try {
      const late = getLateApiInstance();
      let payload: any = [];
      if (basePlatform === 'instagram') {
        payload = await late.getInstagramAccountInsights(
          getIntegration.internalId,
          fromDate,
          toDate
        );
      } else if (basePlatform === 'facebook') {
        payload = await late.getFacebookPageInsights(
          getIntegration.internalId,
          fromDate,
          toDate
        );
      } else if (basePlatform === 'linkedin') {
        payload = await late.getLinkedInAggregateAnalytics(
          getIntegration.internalId,
          fromDate,
          toDate
        );
      } else if (basePlatform === 'tiktok') {
        payload = await late.getTikTokAccountInsights(
          getIntegration.internalId,
          fromDate,
          toDate
        );
      } else if (basePlatform === 'youtube') {
        payload = await late.getYouTubeChannelInsights(
          getIntegration.internalId,
          fromDate,
          toDate
        );
      }

      await ioRedis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        this.getAnalyticsCacheTtlSeconds()
      );
      return payload;
    } catch (e) {
      if (e instanceof RefreshToken) {
        return this.getAccountInsightsAnalytics(
          org,
          integration,
          fromDate,
          toDate,
          true
        );
      }
      return [];
    }
  }

  async getDemographicsAnalytics(
    org: Organization,
    integration: string,
    dimension?: string,
    forceRefresh = false
  ): Promise<any> {
    const cacheKey = `integration:${org.id}:${integration}:demographics:${dimension || ''}`;
    const cached = await ioRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const context = await this.getAnalyticsIntegration(org, integration, forceRefresh);
    if (!context) return [];
    const { getIntegration } = context;
    if (!getIntegration.providerIdentifier.endsWith('-late')) return [];

    const basePlatform = this.getLateBasePlatform(getIntegration.providerIdentifier);

    try {
      const late = getLateApiInstance();
      let payload: any = [];
      if (basePlatform === 'instagram') {
        payload = await late.getInstagramDemographics(
          getIntegration.internalId,
          dimension
        );
      } else if (basePlatform === 'youtube') {
        payload = await late.getYouTubeDemographics(getIntegration.internalId);
      }
      await ioRedis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        this.getAnalyticsCacheTtlSeconds()
      );
      return payload;
    } catch (e) {
      if (e instanceof RefreshToken) {
        return this.getDemographicsAnalytics(org, integration, dimension, true);
      }
      return [];
    }
  }

  async getGBPPerformanceAnalytics(
    org: Organization,
    integration: string,
    startDate: string,
    endDate: string,
    forceRefresh = false
  ): Promise<any> {
    const cacheKey = `integration:${org.id}:${integration}:gbp-performance:${startDate}:${endDate}`;
    const cached = await ioRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const context = await this.getAnalyticsIntegration(org, integration, forceRefresh);
    if (!context) return [];
    const { getIntegration } = context;
    const basePlatform = this.getLateBasePlatform(getIntegration.providerIdentifier);
    if (basePlatform !== 'gmb' && basePlatform !== 'googlebusiness') return [];

    try {
      const payload = await getLateApiInstance().getGBPPerformance(
        getIntegration.internalId,
        startDate,
        endDate
      );
      await ioRedis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        this.getAnalyticsCacheTtlSeconds()
      );
      return payload;
    } catch (e) {
      if (e instanceof RefreshToken) {
        return this.getGBPPerformanceAnalytics(
          org,
          integration,
          startDate,
          endDate,
          true
        );
      }
      return [];
    }
  }

  async getGBPKeywordsAnalytics(
    org: Organization,
    integration: string,
    startMonth: string,
    endMonth: string,
    forceRefresh = false
  ): Promise<any> {
    const cacheKey = `integration:${org.id}:${integration}:gbp-keywords:${startMonth}:${endMonth}`;
    const cached = await ioRedis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const context = await this.getAnalyticsIntegration(org, integration, forceRefresh);
    if (!context) return [];
    const { getIntegration } = context;
    const basePlatform = this.getLateBasePlatform(getIntegration.providerIdentifier);
    if (basePlatform !== 'gmb' && basePlatform !== 'googlebusiness') return [];

    try {
      const payload = await getLateApiInstance().getGBPSearchKeywords(
        getIntegration.internalId,
        startMonth,
        endMonth
      );
      await ioRedis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        this.getAnalyticsCacheTtlSeconds()
      );
      return payload;
    } catch (e) {
      if (e instanceof RefreshToken) {
        return this.getGBPKeywordsAnalytics(
          org,
          integration,
          startMonth,
          endMonth,
          true
        );
      }
      return [];
    }
  }

  customers(orgId: string) {
    return this._integrationRepository.customers(orgId);
  }

  getPlugsByIntegrationId(org: string, integrationId: string) {
    return this._integrationRepository.getPlugsByIntegrationId(
      org,
      integrationId
    );
  }

  async processInternalPlug(
    data: {
      post: string;
      originalIntegration: string;
      integration: string;
      plugName: string;
      orgId: string;
      delay: number;
      information: any;
    },
    forceRefresh = false
  ): Promise<any> {
    const originalIntegration =
      await this._integrationRepository.getIntegrationById(
        data.orgId,
        data.originalIntegration
      );

    const getIntegration = await this._integrationRepository.getIntegrationById(
      data.orgId,
      data.integration
    );

    if (!getIntegration || !originalIntegration) {
      return;
    }

    const getAllInternalPlugs = this._integrationManager
      .getInternalPlugs(getIntegration.providerIdentifier)
      .internalPlugs.find((p: any) => p.identifier === data.plugName);

    if (!getAllInternalPlugs) {
      return;
    }

    const getSocialIntegration = this._integrationManager.getSocialIntegration(
      getIntegration.providerIdentifier
    );

    // @ts-ignore
    await getSocialIntegration?.[getAllInternalPlugs.methodName]?.(
      getIntegration,
      originalIntegration,
      data.post,
      data.information
    );

    return;
  }

  async processPlugs(data: {
    plugId: string;
    postId: string;
    delay: number;
    totalRuns: number;
    currentRun: number;
  }) {
    const getPlugById = await this._integrationRepository.getPlug(data.plugId);
    if (!getPlugById) {
      return true;
    }

    const integration = this._integrationManager.getSocialIntegration(
      getPlugById.integration.providerIdentifier
    );

    // @ts-ignore
    const process = await integration[getPlugById.plugFunction](
      getPlugById.integration,
      data.postId,
      JSON.parse(getPlugById.data).reduce((all: any, current: any) => {
        all[current.name] = current.value;
        return all;
      }, {})
    );

    if (process) {
      return true;
    }

    if (data.totalRuns === data.currentRun) {
      return true;
    }

    return false;
  }

  async createOrUpdatePlug(
    orgId: string,
    integrationId: string,
    body: PlugDto
  ) {
    const { activated } = await this._integrationRepository.createOrUpdatePlug(
      orgId,
      integrationId,
      body
    );

    return {
      activated,
    };
  }

  async changePlugActivation(orgId: string, plugId: string, status: boolean) {
    const { id, integrationId, plugFunction } =
      await this._integrationRepository.changePlugActivation(
        orgId,
        plugId,
        status
      );

    return { id };
  }

  async getPlugs(orgId: string, integrationId: string) {
    return this._integrationRepository.getPlugs(orgId, integrationId);
  }

  async loadExisingData(
    methodName: string,
    integrationId: string,
    id: string[]
  ) {
    const exisingData = await this._integrationRepository.loadExisingData(
      methodName,
      integrationId,
      id
    );
    const loadOnlyIds = exisingData.map((p) => p.value);
    return difference(id, loadOnlyIds);
  }

  async findFreeDateTime(
    orgId: string,
    integrationsId?: string
  ): Promise<number[]> {
    const findTimes = await this._integrationRepository.getPostingTimes(
      orgId,
      integrationsId
    );
    return uniq(
      findTimes.reduce((all: any, current: any) => {
        return [
          ...all,
          ...JSON.parse(current.postingTimes).map(
            (p: { time: number }) => p.time
          ),
        ];
      }, [] as number[])
    );
  }
}
