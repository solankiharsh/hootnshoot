import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization, User } from '@prisma/client';
import { ComplianceService } from '@gitroom/nestjs-libraries/compliance/compliance.service';
import { ComplianceFeatureGuard } from '@gitroom/nestjs-libraries/compliance/compliance.feature.guard';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  ContentCopBusyError,
  ContentCopRateLimitError,
} from '@gitroom/nestjs-libraries/compliance/compliance.errors';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';

@ApiTags('Compliance')
@UseGuards(ComplianceFeatureGuard)
@Controller('/compliance')
export class ComplianceController {
  constructor(
    private readonly _compliance: ComplianceService,
    private readonly _prisma: PrismaService
  ) {}

  @Get('/integration-status')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  integrationStatus() {
    return this._compliance.integrationStatus();
  }

  @Post('/start')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async start(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { postGroupId: string; platform: string }
  ) {
    if (!body?.postGroupId || !body?.platform) {
      throw new HttpException('postGroupId and platform are required', 400);
    }
    try {
      const { captionText, imageUrl } =
        await this._compliance.resolveCaptionAndImageUrl(
          org.id,
          body.postGroupId,
          body.platform
        );
      const job = await this._compliance.startJob({
        orgId: org.id,
        postGroupId: body.postGroupId,
        captionText,
        imageUrl,
        platform: body.platform,
      });
      return {
        jobId: job.id,
        externalJobId: job.externalJobId,
        status: job.status,
      };
    } catch (e) {
      if (e instanceof ContentCopRateLimitError) {
        throw new HttpException({ error: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      if (e instanceof ContentCopBusyError) {
        throw new HttpException(
          { error: 'busy', retryAfter: e.retryAfter },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      throw e;
    }
  }

  @Post('/reanalyze')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async reanalyze(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { complianceJobId: string }
  ) {
    if (!body?.complianceJobId) {
      throw new HttpException('complianceJobId is required', 400);
    }
    const existing = await this._compliance.loadComplianceJob(
      body.complianceJobId,
      org.id
    );
    if (existing.status !== 'completed' && existing.status !== 'failed') {
      throw new HttpException(
        'Job must be completed or failed before reanalysis',
        HttpStatus.BAD_REQUEST
      );
    }
    const { captionText, imageUrl } =
      await this._compliance.resolveCaptionAndImageUrl(
        org.id,
        existing.postGroupId,
        existing.platform
      );
    try {
      const job = await this._compliance.reanalyzeJob({
        complianceJobId: body.complianceJobId,
        orgId: org.id,
        captionText,
        imageUrl,
      });
      return { jobId: job.id, externalJobId: job.externalJobId, status: job.status };
    } catch (e) {
      if (e instanceof ContentCopRateLimitError) {
        throw new HttpException({ error: 'rate_limited' }, HttpStatus.TOO_MANY_REQUESTS);
      }
      if (e instanceof ContentCopBusyError) {
        throw new HttpException(
          { error: 'busy', retryAfter: e.retryAfter },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }
      throw e;
    }
  }

  @Get('/status/:jobId')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async status(
    @GetOrgFromRequest() org: Organization,
    @Param('jobId') jobId: string
  ) {
    return this._compliance.getStatus(jobId, org.id);
  }

  @Post('/override')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async override(
    @GetOrgFromRequest() org: Organization,
    @GetUserFromRequest() user: User,
    @Body() body: { complianceJobId: string; reason: string }
  ) {
    if (!body?.complianceJobId || typeof body.reason !== 'string') {
      throw new HttpException(
        'complianceJobId and reason are required',
        HttpStatus.BAD_REQUEST
      );
    }
    if (body.reason.trim().length < 20) {
      throw new HttpException(
        'reason must be at least 20 characters',
        HttpStatus.BAD_REQUEST
      );
    }
    return this._compliance.overrideJob({
      complianceJobId: body.complianceJobId,
      orgId: org.id,
      overriddenBy: user.id,
      reason: body.reason.trim(),
    });
  }

  @Get('/settings')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async getSettings(@GetOrgFromRequest() org: Organization) {
    const settings = await this._compliance.getOrgComplianceSettings(org.id);
    const routing = await this._prisma.organization.findUnique({
      where: { id: org.id },
      select: { complianceRouting: true },
    });
    return {
      settings: settings ?? null,
      routing: (routing?.complianceRouting ?? {}) as Record<string, unknown>,
    };
  }

  @Post('/settings')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async saveSettings(
    @GetOrgFromRequest() org: Organization,
    @Body()
    body: {
      threshold?: number;
      autoPublishOnApproval?: boolean;
      bannedWords?: string[];
      disabled?: boolean;
    }
  ) {
    if (body.threshold != null) {
      if (typeof body.threshold !== 'number' || body.threshold < 0 || body.threshold > 100) {
        throw new HttpException('threshold must be a number 0-100', HttpStatus.BAD_REQUEST);
      }
    }
    if (body.bannedWords != null && !Array.isArray(body.bannedWords)) {
      throw new HttpException('bannedWords must be an array of strings', HttpStatus.BAD_REQUEST);
    }
    return this._compliance.upsertOrgComplianceSettings(org.id, body);
  }

  /**
   * Test-mode endpoint for the /test/compliance page. Creates a synthetic
   * draft Post + group bound to any connected social integration in the org,
   * then kicks off a real Content Cop job. Does NOT publish — Post stays in
   * DRAFT state. Lets the user exercise the full webhook→callback→update flow.
   */
  @Post('/test-submit')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async testSubmit(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { captionText?: string; imageUrl?: string; platform?: string }
  ) {
    const platform = (body?.platform ?? '').trim();
    const captionText = (body?.captionText ?? '').trim();
    const imageUrl = (body?.imageUrl ?? '').trim();
    if (!captionText && !imageUrl) {
      throw new HttpException(
        'captionText or imageUrl is required',
        HttpStatus.BAD_REQUEST
      );
    }
    if (!platform) {
      throw new HttpException('platform is required', HttpStatus.BAD_REQUEST);
    }
    const platformToProvider: Record<string, string[]> = {
      Instagram: ['instagram', 'instagram-standalone', 'instagram-late'],
      Facebook: ['facebook', 'facebook-late'],
      X: ['x', 'twitter', 'x-late'],
      TikTok: ['tiktok', 'tiktok-late'],
      LinkedIn: ['linkedin', 'linkedin-page', 'linkedin-late'],
    };
    const candidates = platformToProvider[platform];
    if (!candidates) {
      throw new HttpException(
        `platform must be one of: ${Object.keys(platformToProvider).join(', ')}`,
        HttpStatus.BAD_REQUEST
      );
    }
    const integration = await this._prisma.integration.findFirst({
      where: {
        organizationId: org.id,
        providerIdentifier: { in: candidates },
        deletedAt: null,
        disabled: false,
      },
      select: { id: true, providerIdentifier: true },
    });
    if (!integration) {
      throw new HttpException(
        `No connected ${platform} integration in this workspace. Connect one first or pick a different platform.`,
        HttpStatus.BAD_REQUEST
      );
    }
    const groupId = `test-compliance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const imageJson = imageUrl ? JSON.stringify([{ url: imageUrl }]) : null;
    await this._prisma.post.create({
      data: {
        organizationId: org.id,
        integrationId: integration.id,
        content: captionText,
        publishDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        group: groupId,
        state: 'DRAFT',
        image: imageJson,
      },
    });
    const job = await this._compliance.startJob({
      orgId: org.id,
      postGroupId: groupId,
      captionText,
      imageUrl: imageUrl || undefined,
      platform,
    });
    return {
      job: {
        id: job.id,
        externalJobId: job.externalJobId,
        status: job.status,
        decision: job.decision,
        score: job.score,
      },
      postGroupId: groupId,
      platform,
      integrationProvider: integration.providerIdentifier,
    };
  }

  @Post('/preview')
  @CheckPolicies([AuthorizationActions.Create, Sections.POSTS_PER_MONTH])
  async preview(
    @GetOrgFromRequest() org: Organization,
    @Body() body: { caption?: string; platform?: string }
  ) {
    const caption = (body?.caption ?? '').trim();
    const policy = await this._compliance.getEffectivePolicy(org.id);
    const matches: string[] = [];
    if (caption && policy.bannedWords.length) {
      const lower = caption.toLowerCase();
      for (const word of policy.bannedWords) {
        if (!word) continue;
        if (lower.includes(word.toLowerCase())) matches.push(word);
      }
    }
    let verdict: 'ok' | 'warning' | 'rejected' = 'ok';
    if (matches.length === 0) {
      verdict = caption.length === 0 ? 'ok' : 'ok';
    } else if (matches.length <= 1) {
      verdict = 'warning';
    } else {
      verdict = 'rejected';
    }
    return {
      verdict,
      bannedWordHits: matches,
      threshold: policy.threshold,
      enabled: policy.enabled,
    };
  }

  @Post('/routing')
  @CheckPolicies([AuthorizationActions.Create, Sections.ADMIN])
  async saveRouting(
    @GetOrgFromRequest() org: Organization,
    @Body()
    body: {
      routing: Record<string, { thresholdOverride?: number; enabled?: boolean }>;
    }
  ) {
    if (!body || typeof body.routing !== 'object' || body.routing === null) {
      throw new HttpException('routing must be an object', HttpStatus.BAD_REQUEST);
    }
    for (const entry of Object.values(body.routing)) {
      if (
        entry?.thresholdOverride != null &&
        (typeof entry.thresholdOverride !== 'number' ||
          entry.thresholdOverride < 0 ||
          entry.thresholdOverride > 100)
      ) {
        throw new HttpException(
          'thresholdOverride must be a number 0-100',
          HttpStatus.BAD_REQUEST
        );
      }
    }
    await this._prisma.organization.update({
      where: { id: org.id },
      data: { complianceRouting: body.routing as unknown as object },
    });
    return { routing: body.routing };
  }
}
