import { Controller, Get, Param, Query } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { ApiTags } from '@nestjs/swagger';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import dayjs from 'dayjs';

@ApiTags('Analytics')
@Controller('/analytics')
export class AnalyticsController {
  constructor(
    private _integrationService: IntegrationService,
    private _postsService: PostsService
  ) {}

  @Get('/:integration')
  async getIntegration(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('date') date: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    let resolvedDate = Number(date || 0);
    if ((!resolvedDate || Number.isNaN(resolvedDate)) && fromDate && toDate) {
      resolvedDate = Math.max(1, dayjs(toDate).diff(dayjs(fromDate), 'day'));
    }
    if (!resolvedDate || Number.isNaN(resolvedDate)) {
      resolvedDate = 7;
    }
    return this._integrationService.checkAnalytics(
      org,
      integration,
      String(resolvedDate)
    );
  }

  @Get('/post/:postId')
  async getPostAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string,
    @Query('date') date: string
  ) {
    return this._postsService.checkPostAnalytics(org.id, postId, +date);
  }

  @Get('/post-timeline/:postId')
  async getPostTimeline(
    @GetOrgFromRequest() org: Organization,
    @Param('postId') postId: string
  ) {
    return this._postsService.checkPostAnalyticsTimeline(org.id, postId);
  }

  @Get('/:integration/extended')
  async getExtendedAnalytics(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('type')
    type: 'best-time' | 'decay' | 'daily' | 'followers' | 'frequency',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    return this._integrationService.getExtendedAnalytics(
      org,
      integration,
      type,
      fromDate,
      toDate
    );
  }

  @Get('/:integration/account-insights')
  async getAccountInsights(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string
  ) {
    return this._integrationService.getAccountInsightsAnalytics(
      org,
      integration,
      fromDate,
      toDate
    );
  }

  @Get('/:integration/demographics')
  async getDemographics(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('dimension') dimension?: string
  ) {
    return this._integrationService.getDemographicsAnalytics(
      org,
      integration,
      dimension
    );
  }

  @Get('/:integration/gbp-performance')
  async getGbpPerformance(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    return this._integrationService.getGBPPerformanceAnalytics(
      org,
      integration,
      startDate,
      endDate
    );
  }

  @Get('/:integration/gbp-keywords')
  async getGbpKeywords(
    @GetOrgFromRequest() org: Organization,
    @Param('integration') integration: string,
    @Query('startMonth') startMonth: string,
    @Query('endMonth') endMonth: string
  ) {
    return this._integrationService.getGBPKeywordsAnalytics(
      org,
      integration,
      startMonth,
      endMonth
    );
  }
}
