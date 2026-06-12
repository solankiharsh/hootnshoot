jest.mock('@gitroom/nestjs-libraries/database/prisma/posts/posts.service', () => ({
  PostsService: jest.fn(),
}));

jest.mock('@gitroom/nestjs-libraries/database/prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import type { ComplianceJob } from '@prisma/client';
import { Logger } from '@nestjs/common';
import {
  ComplianceService,
  fingerprintForCompliance,
} from './compliance.service';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  ContentCopBusyError,
  ContentCopRateLimitError,
} from './compliance.errors';

describe('ComplianceService', () => {
  let service: ComplianceService;
  let prisma: {
    complianceJob: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let posts: {
    getPostsByGroup: jest.Mock;
    releaseComplianceHoldAndRestartWorkflow: jest.Mock;
    publishNowForApprovedGroup: jest.Mock;
  };
  let fetchMock: jest.Mock;

  const baseJob = {
    id: 'internal-job-id',
    orgId: 'org-1',
    postGroupId: 'group-1',
    externalJobId: '550e8400-e29b-41d4-a716-446655440000',
    version: 1,
    status: 'pending',
    decision: null,
    score: null,
    violations: null,
    suggestedEdits: null,
    breakdown: null,
    platform: 'Instagram',
    webhookReceivedAt: null,
    overriddenBy: null,
    overriddenAt: null,
    overrideReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  } as unknown as ComplianceJob;

  beforeEach(() => {
    prisma = {
      complianceJob: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    posts = {
      getPostsByGroup: jest.fn(),
      releaseComplianceHoldAndRestartWorkflow: jest
        .fn()
        .mockResolvedValue(undefined),
      publishNowForApprovedGroup: jest.fn().mockResolvedValue(undefined),
    };
    service = new ComplianceService(
      prisma as unknown as PrismaService,
      posts as unknown as PostsService
    );
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.example.com';
    process.env.CONTENT_COP_API_KEY = 'test-key';
    process.env.CONTENT_COP_BASE_URL = 'https://compliance.example.com';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveCaptionAndImageUrl', () => {
    it('rejects invalid platform', async () => {
      try {
        await service.resolveCaptionAndImageUrl('org', 'g', 'YouTube');
        expect(true).toBe(false);
      } catch (e: unknown) {
        const ex = e as { constructor?: { name?: string }; message?: string };
        expect(ex?.constructor?.name).toBe('BadRequestException');
        expect(String(ex?.message || e)).toMatch(/Must be one of/);
      }
    });

    it('rejects when post group is empty', async () => {
      posts.getPostsByGroup.mockResolvedValue({ posts: [] });
      await expect(
        service.resolveCaptionAndImageUrl('org', 'g', 'Instagram')
      ).rejects.toThrow('Post group not found');
    });

    it('rejects when no image URL', async () => {
      posts.getPostsByGroup.mockResolvedValue({
        posts: [
          {
            content: 'hello',
            image: [],
            integration: { providerIdentifier: 'instagram' },
          },
        ],
      });
      await expect(
        service.resolveCaptionAndImageUrl('org', 'g', 'Instagram')
      ).rejects.toThrow('at least one image');
    });

    it('returns caption and image for matching platform', async () => {
      posts.getPostsByGroup.mockResolvedValue({
        posts: [
          {
            content: 'caption',
            image: [{ url: 'https://cdn.example.com/a.png' }],
            integration: { providerIdentifier: 'instagram' },
          },
        ],
      });
      const r = await service.resolveCaptionAndImageUrl(
        'org',
        'g',
        'Instagram'
      );
      expect(r).toEqual({
        captionText: 'caption',
        imageUrl: 'https://cdn.example.com/a.png',
      });
    });
  });

  describe('startJob', () => {
    it('returns existing job when still pending', async () => {
      const pending = { ...baseJob, status: 'pending' };
      prisma.complianceJob.findFirst.mockResolvedValue(pending);
      const r = await service.startJob({
        orgId: 'org-1',
        postGroupId: 'group-1',
        captionText: 'x',
        imageUrl: 'https://img/x.png',
        platform: 'Instagram',
      });
      expect(r).toBe(pending);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns existing job when completed Approved', async () => {
      const approved = {
        ...baseJob,
        status: 'completed',
        decision: 'Approved',
      };
      prisma.complianceJob.findFirst.mockResolvedValue(approved);
      const r = await service.startJob({
        orgId: 'org-1',
        postGroupId: 'group-1',
        captionText: 'x',
        imageUrl: 'https://img/x.png',
        platform: 'Instagram',
      });
      expect(r).toBe(approved);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('submits new job when completed Approved but caption or image changed', async () => {
      const fp = fingerprintForCompliance('x', 'https://img/x.png');
      const approvedStale = {
        ...baseJob,
        status: 'completed',
        decision: 'Approved',
        sourceFingerprint: `${fp}stale`,
      };
      prisma.complianceJob.findFirst.mockResolvedValue(approvedStale);
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          headers: { get: () => 'image/png' },
        })
        .mockResolvedValueOnce({
          status: 202,
          json: async () => ({
            job_id: 'new-uuid-0000-0000-0000-000000000002',
            version: 1,
          }),
        });
      prisma.complianceJob.create.mockResolvedValue({
        ...baseJob,
        id: 'new-internal-2',
        externalJobId: 'new-uuid-0000-0000-0000-000000000002',
      });

      const r = await service.startJob({
        orgId: 'org-1',
        postGroupId: 'group-1',
        captionText: 'x',
        imageUrl: 'https://img/x.png',
        platform: 'Instagram',
      });

      expect(fetchMock).toHaveBeenCalled();
      expect(prisma.complianceJob.create).toHaveBeenCalled();
      expect(r.externalJobId).toBe('new-uuid-0000-0000-0000-000000000002');

      const ccCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('start-external')
      );
      expect(ccCall).toBeDefined();
      const form = ccCall![1].body as FormData;
      const parsed = JSON.parse(String(form.get('payload'))) as Record<string, unknown>;
      expect(parsed.material_type).toBe('partner_material');
      expect(parsed.partner_content_type).toBe('social_media');
      expect(parsed.other_params).toEqual({ post_type: 'news_feed' });
    });

    it('submits new job when last was Rejected', async () => {
      prisma.complianceJob.findFirst.mockResolvedValue({
        ...baseJob,
        status: 'completed',
        decision: 'Rejected',
      });
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          headers: { get: () => 'image/png' },
        })
        .mockResolvedValueOnce({
          status: 202,
          json: async () => ({
            job_id: 'new-uuid-0000-0000-0000-000000000001',
            version: 1,
          }),
        });
      prisma.complianceJob.create.mockResolvedValue({
        ...baseJob,
        id: 'new-internal',
        externalJobId: 'new-uuid-0000-0000-0000-000000000001',
      });

      const r = await service.startJob({
        orgId: 'org-1',
        postGroupId: 'group-1',
        captionText: 'cap',
        imageUrl: 'https://cdn.example.com/p.png',
        platform: 'Instagram',
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(prisma.complianceJob.create).toHaveBeenCalled();
      expect(r.externalJobId).toBe('new-uuid-0000-0000-0000-000000000001');
    });

    it('sends image_only in other_params when caption is empty but image is attached', async () => {
      prisma.complianceJob.findFirst.mockResolvedValue(null);
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
          headers: { get: () => 'image/png' },
        })
        .mockResolvedValueOnce({
          status: 202,
          json: async () => ({
            job_id: 'new-uuid-0000-0000-0000-000000000099',
            version: 1,
          }),
        });
      prisma.complianceJob.create.mockResolvedValue({
        ...baseJob,
        externalJobId: 'new-uuid-0000-0000-0000-000000000099',
      });

      await service.startJob({
        orgId: 'org-1',
        postGroupId: 'group-1',
        captionText: '   ',
        imageUrl: 'https://cdn.example.com/p.png',
        platform: 'Instagram',
      });

      const ccCall = fetchMock.mock.calls.find(
        (c) => typeof c[0] === 'string' && (c[0] as string).includes('start-external')
      );
      expect(ccCall).toBeDefined();
      const form = ccCall![1].body as FormData;
      const parsed = JSON.parse(String(form.get('payload'))) as Record<string, unknown>;
      expect(parsed.material_type).toBe('partner_material');
      expect(parsed.partner_content_type).toBe('social_media');
      expect(parsed.content).toBe('');
      expect(parsed.other_params).toEqual({
        post_type: 'news_feed',
        image_only: true,
      });
    });

    it('throws ContentCopRateLimitError on 429', async () => {
      prisma.complianceJob.findFirst.mockResolvedValue(null);
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new Uint8Array([1]).buffer,
          headers: { get: () => 'image/jpeg' },
        })
        .mockResolvedValueOnce({ status: 429 });

      await expect(
        service.startJob({
          orgId: 'org-1',
          postGroupId: 'group-1',
          captionText: 'c',
          imageUrl: 'https://cdn.example.com/x.jpg',
          platform: 'Instagram',
        })
      ).rejects.toBeInstanceOf(ContentCopRateLimitError);
    });

    it('throws ContentCopBusyError on 503 with Retry-After', async () => {
      prisma.complianceJob.findFirst.mockResolvedValue(null);
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new Uint8Array([1]).buffer,
          headers: { get: () => 'image/jpeg' },
        })
        .mockResolvedValueOnce({
          status: 503,
          headers: { get: (h: string) => (h === 'retry-after' ? '90' : null) },
        });

      let caught: unknown;
      try {
        await service.startJob({
          orgId: 'org-1',
          postGroupId: 'group-1',
          captionText: 'c',
          imageUrl: 'https://cdn.example.com/x.jpg',
          platform: 'Instagram',
        });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(ContentCopBusyError);
      expect((caught as ContentCopBusyError).retryAfter).toBe(90);
    });
  });

  describe('handleWebhook', () => {
    let logSpies: jest.SpyInstance[];

    beforeEach(() => {
      logSpies = [
        jest.spyOn(Logger.prototype, 'log').mockImplementation(),
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(),
        jest.spyOn(Logger.prototype, 'error').mockImplementation(),
      ];
    });

    afterEach(() => {
      for (const s of logSpies) {
        s.mockRestore();
      }
    });

    it('does not throw when job_id missing', async () => {
      await expect(service.handleWebhook({})).resolves.toBeUndefined();
    });

    it('warn path: unknown external job_id', async () => {
      prisma.complianceJob.findUnique.mockResolvedValue(null);
      await service.handleWebhook({
        job_id: 'unknown-uuid',
        status: 'completed',
        result_data: { decision: 'Approved' },
      });
      expect(prisma.complianceJob.update).not.toHaveBeenCalled();
    });

    it('updates job on first completed webhook', async () => {
      prisma.complianceJob.findUnique.mockResolvedValue({
        ...baseJob,
        webhookReceivedAt: null,
      });
      prisma.complianceJob.update.mockResolvedValue({});

      await service.handleWebhook({
        job_id: baseJob.externalJobId,
        status: 'completed',
        result_data: {
          decision: 'Approved',
          compliance_score: 87.4,
          violations: [{ module: 'm', rule: 'r' }],
          suggested_edits: [],
          breakdown: { disclaimer: 10 },
        },
      });

      expect(prisma.complianceJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseJob.id },
          data: expect.objectContaining({
            status: 'completed',
            decision: 'Approved',
            score: 87,
          }),
        })
      );
      expect(
        posts.releaseComplianceHoldAndRestartWorkflow
      ).toHaveBeenCalledWith('org-1', 'group-1');
    });

    it('does not release hold when completed but not Approved', async () => {
      prisma.complianceJob.findUnique.mockResolvedValue({
        ...baseJob,
        webhookReceivedAt: null,
      });
      prisma.complianceJob.update.mockResolvedValue({});

      await service.handleWebhook({
        job_id: baseJob.externalJobId,
        status: 'completed',
        result_data: { decision: 'Rejected' },
      });

      expect(
        posts.releaseComplianceHoldAndRestartWorkflow
      ).not.toHaveBeenCalled();
    });

    it('skips duplicate when webhookReceivedAt already set', async () => {
      prisma.complianceJob.findUnique.mockResolvedValue({
        ...baseJob,
        webhookReceivedAt: new Date(),
      });
      await service.handleWebhook({
        job_id: baseJob.externalJobId,
        status: 'completed',
        result_data: { decision: 'Rejected' },
      });
      expect(prisma.complianceJob.update).not.toHaveBeenCalled();
    });

    it('swallows prisma errors', async () => {
      prisma.complianceJob.findUnique.mockResolvedValue({
        ...baseJob,
        webhookReceivedAt: null,
      });
      prisma.complianceJob.update.mockRejectedValue(new Error('db down'));
      await expect(
        service.handleWebhook({
          job_id: baseJob.externalJobId,
          status: 'completed',
          result_data: { decision: 'Approved' },
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('getStatus', () => {
    it('throws when job missing', async () => {
      prisma.complianceJob.findFirst.mockResolvedValue(null);
      await expect(service.getStatus('missing', 'org')).rejects.toThrow(
        'Compliance job not found'
      );
    });

    it('marks timeout when pending and stale', async () => {
      const stale = new Date(Date.now() - 20 * 60 * 1000);
      prisma.complianceJob.findFirst.mockResolvedValue({
        ...baseJob,
        status: 'pending',
        updatedAt: stale,
      });
      prisma.complianceJob.update.mockResolvedValue({
        ...baseJob,
        status: 'timeout',
      });
      const r = await service.getStatus(baseJob.id, 'org-1');
      expect(prisma.complianceJob.update).toHaveBeenCalledWith({
        where: { id: baseJob.id },
        data: { status: 'timeout' },
      });
      expect(r.status).toBe('timeout');
    });
  });

  describe('overrideJob', () => {
    it('sets synthetic Approved', async () => {
      prisma.complianceJob.findFirst.mockResolvedValue(baseJob);
      prisma.complianceJob.update.mockResolvedValue({
        ...baseJob,
        decision: 'Approved',
        overriddenBy: 'user-1',
      });
      const r = await service.overrideJob({
        complianceJobId: baseJob.id,
        orgId: 'org-1',
        overriddenBy: 'user-1',
        reason: 'xxxxxxxxxxxxxxxxxxxx',
      });
      expect(prisma.complianceJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            decision: 'Approved',
            overriddenBy: 'user-1',
            overrideReason: 'xxxxxxxxxxxxxxxxxxxx',
          }),
        })
      );
      expect(r.decision).toBe('Approved');
      expect(
        posts.releaseComplianceHoldAndRestartWorkflow
      ).toHaveBeenCalledWith('org-1', 'group-1');
    });
  });

  describe('reanalyzeJob', () => {
    it('rejects when job not terminal', async () => {
      prisma.complianceJob.findFirst.mockResolvedValue({
        ...baseJob,
        status: 'pending',
      });
      await expect(
        service.reanalyzeJob({
          complianceJobId: baseJob.id,
          orgId: 'org-1',
          captionText: 'c',
          imageUrl: 'https://x/img.png',
        })
      ).rejects.toThrow('completed or failed');
    });
  });

  describe('_webhookCallbackUrl', () => {
    it('uses NEXT_PUBLIC_BACKEND_URL when CONTENT_COP_WEBHOOK_PUBLIC_URL is unset', () => {
      delete process.env.CONTENT_COP_WEBHOOK_PUBLIC_URL;
      process.env.NEXT_PUBLIC_BACKEND_URL = 'https://app.example.com/api';
      const getUrl = service as unknown as { _webhookCallbackUrl(): string };
      expect(getUrl._webhookCallbackUrl()).toBe(
        'https://app.example.com/api/public/content-cop/callback'
      );
    });

    it('strips trailing slashes from the chosen base', () => {
      delete process.env.CONTENT_COP_WEBHOOK_PUBLIC_URL;
      process.env.NEXT_PUBLIC_BACKEND_URL = 'https://app.example.com/api/';
      const getUrl = service as unknown as { _webhookCallbackUrl(): string };
      expect(getUrl._webhookCallbackUrl()).toBe(
        'https://app.example.com/api/public/content-cop/callback'
      );
    });

    it('prefers CONTENT_COP_WEBHOOK_PUBLIC_URL over NEXT_PUBLIC_BACKEND_URL', () => {
      process.env.CONTENT_COP_WEBHOOK_PUBLIC_URL =
        'https://ngrok.example.com/proxy';
      process.env.NEXT_PUBLIC_BACKEND_URL = 'https://ignored.example.com/api';
      const getUrl = service as unknown as { _webhookCallbackUrl(): string };
      expect(getUrl._webhookCallbackUrl()).toBe(
        'https://ngrok.example.com/proxy/public/content-cop/callback'
      );
    });
  });

  describe('integrationStatus', () => {
    it('reports configured flags without exposing secrets', () => {
      process.env.CONTENT_COP_API_KEY = 'secret';
      process.env.NEXT_PUBLIC_BACKEND_URL = 'https://api.example.com';
      delete process.env.CONTENT_COP_WEBHOOK_PUBLIC_URL;
      const r = service.integrationStatus();
      expect(r.contentCopApiKeyConfigured).toBe(true);
      expect(r.webhookCallbackBaseConfigured).toBe(true);
      expect(r.webhookUsesHttps).toBe(true);
      expect(r.contentCopWebhookOverrideConfigured).toBe(false);
      expect(r.contentCopBaseUrl).toContain('compliance-hub');
    });
  });
});
