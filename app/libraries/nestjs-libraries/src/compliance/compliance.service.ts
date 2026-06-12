import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ComplianceJob, Prisma } from '@prisma/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  ContentCopBusyError,
  ContentCopRateLimitError,
} from '@gitroom/nestjs-libraries/compliance/compliance.errors';
import { isComplianceEnabled } from '@gitroom/nestjs-libraries/compliance/compliance.config';

const FIFTEEN_MIN_MS = 15 * 60 * 1000;

const DEFAULT_COMPLIANCE_THRESHOLD = 70;

export interface OrgComplianceSettingsInput {
  threshold?: number;
  autoPublishOnApproval?: boolean;
  bannedWords?: string[];
  disabled?: boolean;
}

export interface OrgComplianceSettings {
  id: string;
  disabled: boolean;
  threshold: number;
  autoPublishOnApproval: boolean;
  bannedWords: string[];
}

export interface EffectiveCompliancePolicy {
  enabled: boolean;
  threshold: number;
  autoPublishOnApproval: boolean;
  bannedWords: string[];
}

function parseComplianceSettings(raw: string | null | undefined): {
  threshold: number;
  autoPublishOnApproval: boolean;
  bannedWords: string[];
} {
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      const json = JSON.parse(raw);
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        parsed = json as Record<string, unknown>;
      }
    } catch {
      /* fall through to defaults */
    }
  }
  const threshold =
    typeof parsed.threshold === 'number' ? parsed.threshold : DEFAULT_COMPLIANCE_THRESHOLD;
  const autoPublishOnApproval = parsed.autoPublishOnApproval === true;
  const bannedWords = Array.isArray(parsed.bannedWords)
    ? parsed.bannedWords.filter((w): w is string => typeof w === 'string')
    : [];
  return { threshold, autoPublishOnApproval, bannedWords };
}

function serializeComplianceSettings(input: OrgComplianceSettingsInput): string {
  const out: Record<string, unknown> = {};
  if (typeof input.threshold === 'number') out.threshold = input.threshold;
  if (typeof input.autoPublishOnApproval === 'boolean')
    out.autoPublishOnApproval = input.autoPublishOnApproval;
  if (Array.isArray(input.bannedWords)) out.bannedWords = input.bannedWords;
  return JSON.stringify(out);
}

/** Partner social pipeline — not `material_type: "social_media"` (client-facing rules). */
const CONTENT_COP_MATERIAL_TYPE_PARTNER = 'partner_material' as const;
const CONTENT_COP_PARTNER_CONTENT_SOCIAL = 'social_media' as const;

const CONTENT_COP_PLATFORMS = [
  'Instagram',
  'Facebook',
  'X',
  'TikTok',
  'LinkedIn',
] as const;

export type ContentCopPlatform = (typeof CONTENT_COP_PLATFORMS)[number];

function isContentCopPlatform(p: string): p is ContentCopPlatform {
  return (CONTENT_COP_PLATFORMS as readonly string[]).includes(p);
}

function providerToPlatform(providerIdentifier: string): ContentCopPlatform | null {
  const id = (providerIdentifier || '').toLowerCase();
  if (id === 'instagram' || id === 'instagram-standalone') return 'Instagram';
  if (id === 'facebook') return 'Facebook';
  if (id === 'x' || id === 'twitter') return 'X';
  if (id === 'tiktok') return 'TikTok';
  if (id === 'linkedin' || id === 'linkedin-page') return 'LinkedIn';
  return null;
}

export function fingerprintForCompliance(
  captionText: string,
  imageUrl?: string
): string {
  return createHash('sha256')
    .update(`${captionText}\0${imageUrl ?? ''}`, 'utf8')
    .digest('hex');
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly _prisma: PrismaService,
    private readonly _posts: PostsService
  ) {}

  resolveCaptionAndImageUrl(
    orgId: string,
    postGroupId: string,
    platform: string
  ): Promise<{ captionText: string; imageUrl: string }> {
    if (!isContentCopPlatform(platform)) {
      throw new BadRequestException(
        `Invalid platform. Must be one of: ${CONTENT_COP_PLATFORMS.join(', ')}`
      );
    }
    return this._resolveCaptionAndImageUrl(orgId, postGroupId, platform);
  }

  private async _resolveCaptionAndImageUrl(
    orgId: string,
    postGroupId: string,
    platform: ContentCopPlatform
  ): Promise<{ captionText: string; imageUrl: string }> {
    const group = await this._posts.getPostsByGroup(orgId, postGroupId);
    const posts = group?.posts || [];
    if (!posts.length) {
      throw new BadRequestException('Post group not found');
    }

    const match = posts.find(
      (p: { integration?: { providerIdentifier?: string } }) =>
        providerToPlatform(p.integration?.providerIdentifier || '') === platform
    );
    const post = match || posts[0];
    const captionText = (post as { content?: string }).content || '';
    const images = (post as { image?: { url?: string }[] }).image || [];
    const first = images.find((i) => i?.url);
    if (!first?.url) {
      throw new BadRequestException(
        'Post must have at least one image with a URL for compliance check'
      );
    }
    return { captionText, imageUrl: first.url };
  }

  async startJob(params: {
    orgId: string;
    postGroupId: string;
    captionText: string;
    imageUrl?: string;
    platform: string;
    publishWhenApproved?: boolean;
  }): Promise<ComplianceJob> {
    if (!isContentCopPlatform(params.platform)) {
      throw new BadRequestException(
        `Invalid platform. Must be one of: ${CONTENT_COP_PLATFORMS.join(', ')}`
      );
    }
    const platform = params.platform as ContentCopPlatform;
    const fingerprint = fingerprintForCompliance(
      params.captionText,
      params.imageUrl
    );

    const latest = await this._prisma.complianceJob.findFirst({
      where: { orgId: params.orgId, postGroupId: params.postGroupId },
      orderBy: { createdAt: 'desc' },
    });

    if (latest) {
      if (latest.status === 'pending' || latest.status === 'running') {
        if (params.publishWhenApproved && !latest.publishWhenApproved) {
          return this._prisma.complianceJob.update({
            where: { id: latest.id },
            data: { publishWhenApproved: true },
          });
        }
        return latest;
      }
      if (
        latest.status === 'completed' &&
        latest.decision === 'Approved' &&
        (latest.sourceFingerprint == null ||
          latest.sourceFingerprint === fingerprint)
      ) {
        if (params.publishWhenApproved || latest.publishWhenApproved) {
          await this._posts.publishNowForApprovedGroup(
            params.orgId,
            params.postGroupId
          );
        }
        return latest;
      }
    }

    let file:
      | { buffer: Buffer; contentType: string; filename: string }
      | undefined;
    if (params.imageUrl) {
      file = await this._fetchImageBuffer(params.imageUrl);
    }
    const { job_id, version } = await this._postStartExternal({
      captionText: params.captionText,
      platform,
      buffer: file?.buffer,
      contentType: file?.contentType,
      filename: file?.filename,
    });

    const created = await this._prisma.complianceJob.create({
      data: {
        orgId: params.orgId,
        postGroupId: params.postGroupId,
        externalJobId: job_id,
        version,
        status: 'pending',
        platform,
        sourceFingerprint: fingerprint,
        publishWhenApproved: params.publishWhenApproved === true,
      },
    });
    return created;
  }

  async reanalyzeJob(params: {
    complianceJobId: string;
    orgId: string;
    captionText: string;
    imageUrl?: string;
    publishWhenApproved?: boolean;
  }): Promise<ComplianceJob> {
    const existing = await this._prisma.complianceJob.findFirst({
      where: { id: params.complianceJobId, orgId: params.orgId },
    });
    if (!existing) {
      throw new BadRequestException('Compliance job not found');
    }
    if (existing.status !== 'completed' && existing.status !== 'failed') {
      throw new BadRequestException(
        'Job must be completed or failed before reanalysis'
      );
    }

    let file:
      | { buffer: Buffer; contentType: string; filename: string }
      | undefined;
    if (params.imageUrl) {
      file = await this._fetchImageBuffer(params.imageUrl);
    }
    const { job_id, version } = await this._postStartExternal({
      captionText: params.captionText,
      platform: existing.platform as ContentCopPlatform,
      buffer: file?.buffer,
      contentType: file?.contentType,
      filename: file?.filename,
      jobId: existing.externalJobId,
    });

    if (job_id !== existing.externalJobId) {
      this.logger.warn(
        `Content Cop reanalyze returned unexpected job_id ${job_id} (expected ${existing.externalJobId})`
      );
    }

    const fingerprint = fingerprintForCompliance(
      params.captionText,
      params.imageUrl
    );

    return this._prisma.complianceJob.update({
      where: { id: existing.id },
      data: {
        version,
        status: 'pending',
        decision: null,
        score: null,
        violations: [],
        suggestedEdits: [],
        breakdown: {},
        webhookReceivedAt: null,
        completedAt: null,
        sourceFingerprint: fingerprint,
        publishWhenApproved:
          params.publishWhenApproved === true || existing.publishWhenApproved,
      },
    });
  }

  async handleWebhook(payload: unknown): Promise<void> {
    try {
      const body = payload as {
        job_id?: string;
        status?: string;
        result_data?: {
          decision?: string;
          compliance_score?: number;
          violations?: unknown;
          suggested_edits?: unknown;
          breakdown?: unknown;
        };
      };
      const job_id = body?.job_id;
      const status = body?.status;
      const result_data = body?.result_data;

      if (!job_id || typeof job_id !== 'string') {
        this.logger.warn('ContentCop webhook: missing job_id');
        return;
      }

      const job = await this._prisma.complianceJob.findUnique({
        where: { externalJobId: job_id },
      });
      if (!job) {
        this.logger.warn(`ContentCop webhook: unknown job_id ${job_id}`);
        return;
      }

      if (job.webhookReceivedAt) {
        this.logger.log(
          `ContentCop webhook: duplicate delivery for ${job_id}, skipping`
        );
        return;
      }

      const now = new Date();
      const updateData: Prisma.ComplianceJobUpdateInput = {
        status: status || 'unknown',
        webhookReceivedAt: now,
        completedAt: now,
      };

      if (status === 'completed' && result_data) {
        updateData.decision = result_data.decision ?? null;
        const rawScore = result_data.compliance_score;
        updateData.score =
          rawScore === undefined || rawScore === null
            ? null
            : Math.round(Number(rawScore));
        updateData.violations =
          result_data.violations !== undefined && result_data.violations !== null
            ? (result_data.violations as Prisma.InputJsonValue)
            : [];
        updateData.suggestedEdits =
          result_data.suggested_edits !== undefined &&
          result_data.suggested_edits !== null
            ? (result_data.suggested_edits as Prisma.InputJsonValue)
            : [];
        updateData.breakdown =
          result_data.breakdown !== undefined && result_data.breakdown !== null
            ? (result_data.breakdown as Prisma.InputJsonValue)
            : {};
      }

      await this._prisma.complianceJob.update({
        where: { id: job.id },
        data: updateData,
      });

      // In-app notification for the org — one row per terminal compliance event.
      if (status === 'completed' || status === 'failed') {
        const decision = (updateData.decision as string | null | undefined) ?? null;
        const score = (updateData.score as number | null | undefined) ?? null;
        const content =
          status === 'failed'
            ? `Compliance check failed for a ${job.platform} post.`
            : decision === 'Approved'
              ? `Compliance approved for a ${job.platform} post${
                  score != null ? ` (score ${score})` : ''
                }.`
              : decision === 'Rejected'
                ? `Compliance rejected a ${job.platform} post${
                    score != null ? ` (score ${score})` : ''
                  }.`
                : `Compliance review completed for a ${job.platform} post.`;
        try {
          await this._prisma.notifications.create({
            data: {
              organizationId: job.orgId,
              content,
              link: `/launches`,
            },
          });
        } catch (notifErr) {
          this.logger.warn(
            `Compliance notification insert failed (non-fatal): ${
              notifErr instanceof Error ? notifErr.message : String(notifErr)
            }`
          );
        }
      }

      // Fan out compliance event to org's external webhooks linked to the
      // content-cop integration. Best-effort, never blocks the callback.
      this._fanoutComplianceEvent(job.orgId, {
        type: 'compliance.completed',
        jobId: job.id,
        externalJobId: job.externalJobId,
        postGroupId: job.postGroupId,
        platform: job.platform,
        status: status || 'unknown',
        decision: (updateData.decision as string | null | undefined) ?? null,
        score: (updateData.score as number | null | undefined) ?? null,
        receivedAt: now.toISOString(),
      }).catch((err) => {
        this.logger.warn(
          `Compliance webhook fan-out failed (non-fatal): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });

      if (status === 'completed' && result_data?.decision === 'Approved') {
        try {
          if (job.publishWhenApproved) {
            await this._posts.publishNowForApprovedGroup(
              job.orgId,
              job.postGroupId
            );
          } else {
            await this._posts.releaseComplianceHoldAndRestartWorkflow(
              job.orgId,
              job.postGroupId
            );
          }
        } catch (releaseErr) {
          this.logger.warn(
            `ContentCop webhook: publish after approval failed: ${
              releaseErr instanceof Error
                ? releaseErr.message
                : String(releaseErr)
            }`
          );
        }
      }

      this.logger.log(
        `ContentCop job ${job_id}: ${status}, decision: ${result_data?.decision}, score: ${result_data?.compliance_score}`
      );
    } catch (err) {
      this.logger.error('ContentCop webhook handler error', err as Error);
    }
  }

  async loadComplianceJob(jobId: string, orgId: string): Promise<ComplianceJob> {
    const job = await this._prisma.complianceJob.findFirst({
      where: { id: jobId, orgId },
    });
    if (!job) {
      throw new BadRequestException('Compliance job not found');
    }
    return job;
  }

  async getStatus(jobId: string, orgId: string): Promise<ComplianceJob> {
    const job = await this._prisma.complianceJob.findFirst({
      where: { id: jobId, orgId },
    });
    if (!job) {
      throw new BadRequestException('Compliance job not found');
    }

    if (
      (job.status === 'pending' || job.status === 'running') &&
      Date.now() - job.updatedAt.getTime() > FIFTEEN_MIN_MS
    ) {
      return this._prisma.complianceJob.update({
        where: { id: job.id },
        data: { status: 'timeout' },
      });
    }

    return job;
  }

  async overrideJob(params: {
    complianceJobId: string;
    orgId: string;
    overriddenBy: string;
    reason: string;
  }): Promise<ComplianceJob> {
    const existing = await this._prisma.complianceJob.findFirst({
      where: { id: params.complianceJobId, orgId: params.orgId },
    });
    if (!existing) {
      throw new BadRequestException('Compliance job not found');
    }
    const updated = await this._prisma.complianceJob.update({
      where: { id: existing.id },
      data: {
        decision: 'Approved',
        overriddenBy: params.overriddenBy,
        overriddenAt: new Date(),
        overrideReason: params.reason,
      },
    });
    try {
      if (existing.publishWhenApproved) {
        await this._posts.publishNowForApprovedGroup(
          params.orgId,
          existing.postGroupId
        );
      } else {
        await this._posts.releaseComplianceHoldAndRestartWorkflow(
          params.orgId,
          existing.postGroupId
        );
      }
    } catch (err) {
      this.logger.warn(
        `publish after override failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
    return updated;
  }

  /**
   * Per-org compliance settings stored on the `content-cop` Integration row.
   * Returns null when the org hasn't connected (or row was deleted).
   */
  async getOrgComplianceSettings(orgId: string): Promise<OrgComplianceSettings | null> {
    const row = await this._prisma.integration.findFirst({
      where: {
        organizationId: orgId,
        providerIdentifier: 'content-cop',
        deletedAt: null,
      },
      select: {
        id: true,
        disabled: true,
        additionalSettings: true,
      },
    });
    if (!row) return null;
    const parsed = parseComplianceSettings(row.additionalSettings);
    return { id: row.id, disabled: row.disabled, ...parsed };
  }

  /**
   * Upsert per-org compliance settings. Creates the row if missing.
   * API key + base URL remain global env vars — this only stores rule config.
   */
  async upsertOrgComplianceSettings(
    orgId: string,
    settings: OrgComplianceSettingsInput
  ): Promise<OrgComplianceSettings> {
    const existing = await this._prisma.integration.findFirst({
      where: {
        organizationId: orgId,
        providerIdentifier: 'content-cop',
        deletedAt: null,
      },
    });
    const merged = serializeComplianceSettings(settings);
    if (existing) {
      const row = await this._prisma.integration.update({
        where: { id: existing.id },
        data: {
          additionalSettings: merged,
          disabled: settings.disabled ?? existing.disabled,
        },
        select: { id: true, disabled: true, additionalSettings: true },
      });
      const parsed = parseComplianceSettings(row.additionalSettings);
      return { id: row.id, disabled: row.disabled, ...parsed };
    }
    const row = await this._prisma.integration.create({
      data: {
        internalId: `content-cop:${orgId}`,
        organizationId: orgId,
        name: 'Content Cop',
        picture: '',
        providerIdentifier: 'content-cop',
        type: 'compliance',
        token: '',
        postingTimes: '[]',
        additionalSettings: merged,
        disabled: settings.disabled ?? false,
      },
      select: { id: true, disabled: true, additionalSettings: true },
    });
    const parsed = parseComplianceSettings(row.additionalSettings);
    return { id: row.id, disabled: row.disabled, ...parsed };
  }

  /**
   * Resolve the effective compliance policy for a post submission.
   * Order: per-platform routing override (Organization.complianceRouting JSON)
   *        → org-wide settings (Integration row)
   *        → defaults.
   */
  async getEffectivePolicy(
    orgId: string,
    socialIntegrationId?: string
  ): Promise<EffectiveCompliancePolicy> {
    const [org, settings] = await Promise.all([
      this._prisma.organization.findUnique({
        where: { id: orgId },
        select: { complianceRouting: true },
      }),
      this.getOrgComplianceSettings(orgId),
    ]);
    const routing = (org?.complianceRouting ?? {}) as Record<
      string,
      { thresholdOverride?: number; enabled?: boolean } | undefined
    >;
    const override = socialIntegrationId ? routing[socialIntegrationId] : undefined;
    const threshold =
      override?.thresholdOverride ?? settings?.threshold ?? DEFAULT_COMPLIANCE_THRESHOLD;
    const enabled = override?.enabled ?? !(settings?.disabled ?? false);
    return {
      enabled,
      threshold,
      autoPublishOnApproval: settings?.autoPublishOnApproval ?? false,
      bannedWords: settings?.bannedWords ?? [],
    };
  }

  /**
   * Best-effort fan-out of a compliance event to all webhooks linked to the
   * org's content-cop integration. Each delivery is independent — one failure
   * doesn't block the others. Uses the SSRF-safe dispatcher.
   */
  private _buildSlackComplianceBody(event: Record<string, unknown>): string {
    const decision = event.decision as string | null;
    const score = event.score as number | null;
    const platform = (event.platform as string) || 'unknown';
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.MAIN_URL ||
      'http://localhost:4200';
    const calendarUrl = `${frontendUrl}/launches`;

    let color: string;
    let emoji: string;
    let title: string;

    if (decision === 'Approved') {
      color = '#2eb886';
      emoji = '✅';
      title = 'Compliance Approved';
    } else if (decision === 'Rejected') {
      color = '#e01e5a';
      emoji = '🚫';
      title = 'Compliance Rejected';
    } else if (event.status === 'failed') {
      color = '#ff9800';
      emoji = '⚠️';
      title = 'Compliance Check Failed';
    } else {
      color = '#6b7280';
      emoji = '🔍';
      title = 'Compliance Review Complete';
    }

    const scoreText = score != null ? ` — Score: *${score}/100*` : '';
    const platformText = platform.charAt(0).toUpperCase() + platform.slice(1);

    return JSON.stringify({
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${emoji} *${title}*${scoreText}\nPlatform: ${platformText}`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'View in calendar' },
                  url: calendarUrl,
                },
              ],
            },
          ],
        },
      ],
    });
  }

  private async _fanoutComplianceEvent(
    orgId: string,
    event: Record<string, unknown>
  ): Promise<void> {
    // Use global webhooks (no integration filter) so any webhook registered
    // for the org without a specific integration scoping receives compliance
    // events. Users with a 'content-cop' integration linked will also fire
    // through the integrations.some() path below.
    const allWebhooks = await this._prisma.webhooks.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: { integrations: { select: { integrationId: true } } },
    });

    const contentCopIntegration = await this._prisma.integration.findFirst({
      where: {
        organizationId: orgId,
        providerIdentifier: 'content-cop',
        deletedAt: null,
      },
      select: { id: true },
    });

    const targets = allWebhooks.filter(
      (w) =>
        w.integrations.length === 0 ||
        (contentCopIntegration &&
          w.integrations.some(
            (i) => i.integrationId === contentCopIntegration.id
          ))
    );

    if (!targets.length) return;

    await Promise.allSettled(
      targets.map(async (webhook) => {
        try {
          const { fetch: undiciFetch } = await import('undici');
          const { ssrfSafeDispatcher } = await import(
            '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher'
          );
          const isSlack = webhook.url.includes('hooks.slack.com');
          const body = isSlack
            ? this._buildSlackComplianceBody(event)
            : JSON.stringify(event);
          await undiciFetch(webhook.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            dispatcher: ssrfSafeDispatcher,
            signal: AbortSignal.timeout(10_000),
          });
        } catch (err) {
          this.logger.warn(
            `Compliance webhook delivery to ${webhook.url} failed: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      })
    );
  }

  /** Non-secret diagnostics for configuring Content Cop (API + webhook). */
  integrationStatus(): {
    contentCopApiKeyConfigured: boolean;
    webhookCallbackBaseConfigured: boolean;
    webhookUsesHttps: boolean;
    contentCopWebhookOverrideConfigured: boolean;
    contentCopBaseUrl: string;
  } {
    const webhookBase = (
      process.env.CONTENT_COP_WEBHOOK_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      ''
    ).trim();
    const normalizedBase = webhookBase.replace(/\/+$/, '');
    const baseUrl = (process.env.CONTENT_COP_BASE_URL || '').replace(/\/+$/, '');
    return {
      contentCopApiKeyConfigured: Boolean(process.env.CONTENT_COP_API_KEY?.trim()),
      webhookCallbackBaseConfigured: Boolean(normalizedBase),
      webhookUsesHttps: normalizedBase.toLowerCase().startsWith('https:'),
      contentCopWebhookOverrideConfigured: Boolean(
        process.env.CONTENT_COP_WEBHOOK_PUBLIC_URL?.trim()
      ),
      contentCopBaseUrl: baseUrl,
    };
  }

  private async _fetchImageBuffer(imageUrl: string): Promise<{
    buffer: Buffer;
    contentType: string;
    filename: string;
  }> {
    const headers = this._imageFetchHeaders(imageUrl);
    const res = await fetch(imageUrl, { headers });
    if (!res.ok) {
      throw new BadRequestException(
        `Failed to fetch image (${res.status}) for compliance submission`
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType =
      res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
    let filename = 'image.jpg';
    try {
      const path = new URL(imageUrl).pathname.split('/').pop();
      if (path) filename = path.split('?')[0] || filename;
    } catch {
      /* use default */
    }
    return { buffer, contentType, filename };
  }

  private _imageFetchHeaders(url: string): HeadersInit {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return {};
    }
    try {
      const supabaseHost = new URL(supabaseUrl).hostname;
      const targetHost = new URL(url).hostname;
      if (targetHost === supabaseHost) {
        return { Authorization: `Bearer ${serviceKey}` };
      }
    } catch {
      /* ignore */
    }
    return {};
  }

  private _webhookCallbackUrl(): string {
    const raw = (
      process.env.CONTENT_COP_WEBHOOK_PUBLIC_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      ''
    ).trim();
    const base = raw.replace(/\/+$/, '');
    if (!base) {
      throw new BadRequestException(
        'Set NEXT_PUBLIC_BACKEND_URL to the public API base (HTTPS in prod) so Content Cop can POST to /public/content-cop/callback. Optional: CONTENT_COP_WEBHOOK_PUBLIC_URL if the webhook must use a different HTTPS origin (e.g. ngrok).'
      );
    }
    if (!base.toLowerCase().startsWith('https:')) {
      this.logger.warn(
        'Content Cop webhook base is not HTTPS; staging/production APIs typically reject http:// callbacks. Set NEXT_PUBLIC_BACKEND_URL to HTTPS, or use CONTENT_COP_WEBHOOK_PUBLIC_URL for an HTTPS tunnel (e.g. ngrok).'
      );
    }
    return `${base}/public/content-cop/callback`;
  }

  private async _loadPrimaryPostForCompliance(
    orgId: string,
    postGroupId: string
  ): Promise<{
    captionText: string;
    imageUrl?: string;
    platform: ContentCopPlatform;
  } | null> {
    const group = await this._posts.getPostsByGroup(orgId, postGroupId);
    const posts = group?.posts || [];
    if (!posts.length) {
      return null;
    }
    const match =
      posts.find(
        (p: { integration?: { providerIdentifier?: string } }) =>
          providerToPlatform(p.integration?.providerIdentifier || '') !== null
      ) || posts[0];
    const pid = (match as { integration?: { providerIdentifier?: string } })
      .integration?.providerIdentifier;
    const platform = providerToPlatform(pid || '');
    if (!platform) {
      return null;
    }
    const captionText = (match as { content?: string }).content || '';
    const images = (match as { image?: { url?: string }[] }).image || [];
    const first = images.find((i) => i?.url);
    return {
      captionText,
      imageUrl: first?.url,
      platform,
    };
  }

  /**
   * After a post group is saved to the calendar, run or resume Content Cop without blocking the HTTP response.
   */
  async queueComplianceCheckAfterSave(
    orgId: string,
    postGroupId: string,
    options?: { publishWhenApproved?: boolean }
  ): Promise<void> {
    if (!isComplianceEnabled()) {
      return;
    }
    try {
      const loaded = await this._loadPrimaryPostForCompliance(
        orgId,
        postGroupId
      );
      if (!loaded) {
        this.logger.log(
          `Compliance queue skipped for group ${postGroupId}: no supported platform or no posts in group`
        );
        return;
      }

      const hasMaterial =
        loaded.captionText.trim().length > 0 || Boolean(loaded.imageUrl);
      if (!hasMaterial) {
        this.logger.log(
          `Compliance queue skipped for group ${postGroupId}: empty caption and no image (Content Cop needs text and/or a file)`
        );
        return;
      }

      const latest = await this._prisma.complianceJob.findFirst({
        where: { orgId, postGroupId },
        orderBy: { createdAt: 'desc' },
      });

      if (latest) {
        if (latest.status === 'pending' || latest.status === 'running') {
          if (options?.publishWhenApproved && !latest.publishWhenApproved) {
            await this._prisma.complianceJob.update({
              where: { id: latest.id },
              data: { publishWhenApproved: true },
            });
          }
          return;
        }
        if (latest.status === 'completed' || latest.status === 'failed') {
          await this.reanalyzeJob({
            complianceJobId: latest.id,
            orgId,
            captionText: loaded.captionText,
            imageUrl: loaded.imageUrl,
            publishWhenApproved: options?.publishWhenApproved,
          });
          return;
        }
      }

      await this.startJob({
        orgId,
        postGroupId,
        captionText: loaded.captionText,
        imageUrl: loaded.imageUrl,
        platform: loaded.platform,
        publishWhenApproved: options?.publishWhenApproved,
      });
    } catch (err) {
      this.logger.warn(
        `Background compliance failed for group ${postGroupId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  private async _postStartExternal(params: {
    captionText: string;
    platform: ContentCopPlatform;
    buffer?: Buffer;
    contentType?: string;
    filename?: string;
    jobId?: string;
  }): Promise<{ job_id: string; version: number }> {
    const apiKey = process.env.CONTENT_COP_API_KEY;
    const baseUrl = (process.env.CONTENT_COP_BASE_URL || '').replace(/\/+$/, '');
    if (!apiKey) {
      throw new BadRequestException('CONTENT_COP_API_KEY is not configured');
    }

    const trimmedCaption = (params.captionText || '').trim();
    const hasImageFile = Boolean(params.buffer && params.buffer.length > 0);
    const otherParams: Record<string, unknown> = { post_type: 'news_feed' };
    if (hasImageFile && !trimmedCaption) {
      otherParams.image_only = true;
    }

    const payloadObj: Record<string, unknown> = {
      material_type: CONTENT_COP_MATERIAL_TYPE_PARTNER,
      partner_content_type: CONTENT_COP_PARTNER_CONTENT_SOCIAL,
      content: trimmedCaption,
      entity: 'ROW',
      webhook_url: this._webhookCallbackUrl(),
      platform: params.platform,
      other_params: otherParams,
      draft_mode: 'false',
      client_name: 'Hootnshoot',
    };
    if (params.jobId) {
      payloadObj.job_id = params.jobId;
    }

    const form = new FormData();
    form.append('payload', JSON.stringify(payloadObj));
    if (params.buffer && params.buffer.length > 0) {
      const blob = new Blob([new Uint8Array(params.buffer)], {
        type: params.contentType || 'image/jpeg',
      });
      form.append('files', blob, params.filename || 'image.jpg');
    }

    const submitUrl = `${baseUrl}/api/v1/jobs/start-external`;
    this.logger.log(
      `Content Cop POST start-external platform=${params.platform} hasFile=${Boolean(params.buffer?.length)}`
    );

    const res = await fetch(submitUrl, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey },
      body: form,
    });

    if (res.status === 429) {
      throw new ContentCopRateLimitError();
    }
    if (res.status === 503) {
      const retryAfter = parseInt(
        res.headers.get('retry-after') || '60',
        10
      );
      throw new ContentCopBusyError(
        Number.isFinite(retryAfter) ? retryAfter : 60
      );
    }

    if (res.status !== 202) {
      let detail = res.statusText;
      try {
        const errJson = (await res.json()) as { detail?: string };
        if (errJson?.detail) detail = errJson.detail;
      } catch {
        try {
          detail = await res.text();
        } catch {
          /* keep statusText */
        }
      }
      throw new BadRequestException(
        `Content Cop submission failed (${res.status}): ${detail}`
      );
    }

    const data = (await res.json()) as { job_id?: string; version?: number };
    if (!data?.job_id) {
      throw new BadRequestException('Content Cop response missing job_id');
    }
    this.logger.log(
      `Content Cop accepted job externalJobId=${data.job_id} version=${typeof data.version === 'number' ? data.version : 1}`
    );
    return {
      job_id: data.job_id,
      version: typeof data.version === 'number' ? data.version : 1,
    };
  }
}
