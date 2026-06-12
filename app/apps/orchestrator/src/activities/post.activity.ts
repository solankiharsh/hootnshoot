import { Injectable } from '@nestjs/common';
import {
  Activity,
  ActivityMethod,
  TemporalService,
} from 'nestjs-temporal-core';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import {
  NotificationService,
  NotificationType,
} from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { Integration, Post, State } from '@prisma/client';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { AuthTokenDetails } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { RefreshIntegrationService } from '@gitroom/nestjs-libraries/integrations/refresh.integration.service';
import { timer } from '@gitroom/helpers/utils/timer';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { WebhooksService } from '@gitroom/nestjs-libraries/database/prisma/webhooks/webhooks.service';
import { TypedSearchAttributes } from '@temporalio/common';
import {
  organizationId,
  postId as postIdSearchParam,
} from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { createDatadogLogger } from '@gitroom/nestjs-libraries/observability/datadog.logger';

const logger = createDatadogLogger({ service: 'orchestrator', component: 'post-activity' });

@Injectable()
@Activity()
export class PostActivity {
  constructor(
    private _postService: PostsService,
    private _notificationService: NotificationService,
    private _integrationManager: IntegrationManager,
    private _integrationService: IntegrationService,
    private _refreshIntegrationService: RefreshIntegrationService,
    private _webhookService: WebhooksService,
    private _temporalService: TemporalService,
    private _subscriptionService: SubscriptionService
  ) {}

  @ActivityMethod()
  async getIntegrationById(orgId: string, id: string) {
    return this._integrationService.getIntegrationById(orgId, id);
  }

  @ActivityMethod()
  async searchForMissingThreeHoursPosts() {
    const list = await this._postService.searchForMissingThreeHoursPosts();
    for (const post of list) {
      await this._temporalService.client
        .getRawClient()
        .workflow.signalWithStart('postWorkflowV102', {
          workflowId: `post_${post.id}`,
          taskQueue: 'main',
          signal: 'poke',
          workflowIdConflictPolicy: 'USE_EXISTING',
          signalArgs: [],
          args: [
            {
              taskQueue: post.integration.providerIdentifier
                .split('-')[0]
                .toLowerCase(),
              postId: post.id,
              organizationId: post.organizationId,
            },
          ],
          typedSearchAttributes: new TypedSearchAttributes([
            {
              key: postIdSearchParam,
              value: post.id,
            },
            {
              key: organizationId,
              value: post.organizationId,
            },
          ]),
        });
    }
  }

  @ActivityMethod()
  async gatePublishByComplianceOrHold(
    orgId: string,
    postGroupId: string
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    return this._postService.gatePublishByComplianceOrHold(orgId, postGroupId);
  }

  @ActivityMethod()
  async updatePost(id: string, postId: string, releaseURL: string) {
    return this._postService.updatePost(id, postId, releaseURL);
  }

  @ActivityMethod()
  async getPostsList(orgId: string, postId: string) {
    logger.info('getPostsList started', { event: 'hootnshoot.post.getPostsList.start', postId, orgId });
    if (process.env.STRIPE_SECRET_KEY) {
      const subscription = await this._subscriptionService.getSubscription(orgId);
      if (!subscription) {
        logger.warn('getPostsList: no active subscription, skipping', { event: 'hootnshoot.post.getPostsList.skip', postId, orgId });
        return [];
      }
    }

    const getPosts = await this._postService.getPostsRecursively(postId, true, orgId);
    if (!getPosts || getPosts.length === 0 || getPosts[0].parentPostId) {
      logger.warn('getPostsList: no root posts found', { event: 'hootnshoot.post.getPostsList.empty', postId, orgId, count: getPosts?.length ?? 0 });
      return [];
    }

    logger.info('getPostsList completed', { event: 'hootnshoot.post.getPostsList.done', postId, orgId, count: getPosts.length });
    return getPosts;
  }

  @ActivityMethod()
  async isCommentable(integration: Integration) {
    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    return !!getIntegration.comment;
  }

  @ActivityMethod()
  async postComment(
    postId: string,
    lastPostId: string | undefined,
    integration: Integration,
    posts: Post[]
  ) {
    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    const newPosts = await this._postService.updateTags(
      integration.organizationId,
      posts
    );

    return getIntegration.comment(
      integration.internalId,
      postId,
      lastPostId,
      integration.token,
      await Promise.all(
        (newPosts || []).map(async (p) => ({
          id: p.id,
          message: stripHtmlValidation(
            getIntegration.editor,
            p.content,
            true,
            false,
            !/<\/?[a-z][\s\S]*>/i.test(p.content),
            getIntegration.mentionFormat
          ),
          settings: JSON.parse(p.settings || '{}'),
          media: await this._postService.updateMedia(
            p.id,
            JSON.parse(p.image || '[]'),
            getIntegration?.convertToJPEG || false
          ),
        }))
      ),
      integration
    );
  }

  @ActivityMethod()
  async postSocial(integration: Integration, posts: Post[]) {
    const provider = integration.providerIdentifier;
    logger.info('postSocial started', {
      event: 'hootnshoot.post.postSocial.start',
      provider,
      integrationId: integration.id,
      orgId: integration.organizationId,
      postCount: posts.length,
      postIds: posts.map((p) => p.id),
    });

    const getIntegration = this._integrationManager.getSocialIntegration(provider);
    if (!getIntegration) {
      logger.error('postSocial: no integration found for provider', {
        event: 'hootnshoot.post.postSocial.no_integration',
        provider,
      });
      throw new Error(`No social integration found for provider: ${provider}`);
    }

    const newPosts = await this._postService.updateTags(
      integration.organizationId,
      posts
    );

    let postNow: any;
    try {
    postNow = await getIntegration.post(
      integration.internalId,
      integration.token,
      await Promise.all(
        (newPosts || []).map(async (p) => ({
          id: p.id,
          message: stripHtmlValidation(
            getIntegration.editor,
            p.content,
            true,
            false,
            !/<\/?[a-z][\s\S]*>/i.test(p.content),
            getIntegration.mentionFormat
          ),
          settings: JSON.parse(p.settings || '{}'),
          media: await this._postService.updateMedia(
            p.id,
            JSON.parse(p.image || '[]'),
            getIntegration?.convertToJPEG || false
          ),
        }))
      ),
      integration
    );

    await this._temporalService.client
      .getRawClient()
      .workflow.start('streakWorkflow', {
        args: [{ organizationId: integration.organizationId }],
        workflowId: `streak_${integration.organizationId}`,
        taskQueue: 'main',
        workflowIdConflictPolicy: 'TERMINATE_EXISTING',
        typedSearchAttributes: new TypedSearchAttributes([
          {
            key: organizationId,
            value: integration.organizationId,
          },
        ]),
      });
    } catch (err: any) {
      logger.error('postSocial failed', {
        event: 'hootnshoot.post.postSocial.error',
        provider,
        integrationId: integration.id,
        orgId: integration.organizationId,
        error: err?.message ?? String(err),
        stack: err?.stack?.split('\n').slice(0, 5).join(' | '),
      });
      throw err;
    }

    logger.info('postSocial completed', {
      event: 'hootnshoot.post.postSocial.done',
      provider,
      integrationId: integration.id,
      orgId: integration.organizationId,
    });

    return postNow;
  }

  @ActivityMethod()
  async inAppNotification(
    orgId: string,
    subject: string,
    message: string,
    sendEmail = false,
    digest = false,
    type: NotificationType = 'success'
  ) {
    return this._notificationService.inAppNotification(
      orgId,
      subject,
      message,
      sendEmail,
      digest,
      type
    );
  }

  @ActivityMethod()
  async globalPlugs(integration: Integration) {
    return this._postService.checkPlugs(
      integration.organizationId,
      integration.providerIdentifier,
      integration.id
    );
  }

  @ActivityMethod()
  async changeState(id: string, state: State, err?: any, body?: any) {
    logger.info('changeState', {
      event: 'hootnshoot.post.changeState',
      postId: id,
      state,
      ...(err ? { error: String(err) } : {}),
    });
    return this._postService.changeState(id, state, err, body);
  }

  @ActivityMethod()
  async internalPlugs(integration: Integration, settings: any) {
    return this._postService.checkInternalPlug(
      integration,
      integration.organizationId,
      integration.id,
      settings
    );
  }

  private _buildSlackPostBody(post: Record<string, unknown>): string {
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.MAIN_URL ||
      'http://localhost:4200';
    const integration = post.integration as Record<string, unknown> | undefined;
    const platform = (integration?.name as string) || 'Unknown platform';
    const content = ((post.content as string) || '').slice(0, 280);
    const releaseUrl = post.releaseURL as string | null | undefined;

    const blocks: unknown[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚀 *Post published* — ${platform}\n>${content}`,
        },
      },
    ];

    const buttons: unknown[] = [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View in calendar' },
        url: `${frontendUrl}/launches`,
      },
    ];
    if (releaseUrl) {
      buttons.push({
        type: 'button',
        text: { type: 'plain_text', text: 'View post' },
        url: releaseUrl,
      });
    }
    blocks.push({ type: 'actions', elements: buttons });

    return JSON.stringify({
      attachments: [{ color: '#2eb886', blocks }],
    });
  }

  @ActivityMethod()
  async sendWebhooks(postId: string, orgId: string, integrationId: string) {
    const webhooks = (await this._webhookService.getWebhooks(orgId)).filter(
      (f) => {
        return (
          f.integrations.length === 0 ||
          f.integrations.some((i) => i.integration.id === integrationId)
        );
      }
    );

    const post = await this._postService.getPostByForWebhookId(postId);
    return Promise.all(
      webhooks.map(async (webhook) => {
        try {
          const isSlack = webhook.url.includes('hooks.slack.com');
          await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: isSlack
              ? this._buildSlackPostBody(post as Record<string, unknown>)
              : JSON.stringify(post),
          });
        } catch (e) {
          /**empty**/
        }
      })
    );
  }
  @ActivityMethod()
  async sendOrgAlert(
    orgId: string,
    type: 'held' | 'error' | 'disconnected',
    platform: string,
    detail: string
  ) {
    const webhooks = (await this._webhookService.getWebhooks(orgId)).filter(
      (w) => w.integrations.length === 0
    );
    if (!webhooks.length) return;

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.MAIN_URL ||
      'http://localhost:4200';

    const configs: Record<typeof type, { color: string; emoji: string; title: string }> = {
      held:         { color: '#ff9800', emoji: '⏸️', title: 'Post held for compliance' },
      error:        { color: '#e01e5a', emoji: '❌', title: 'Post failed to publish' },
      disconnected: { color: '#6b7280', emoji: '🔌', title: 'Integration needs attention' },
    };
    const { color, emoji, title } = configs[type];
    const platformText = platform.charAt(0).toUpperCase() + platform.slice(1);

    const slackBody = JSON.stringify({
      attachments: [
        {
          color,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `${emoji} *${title}* — ${platformText}\n${detail}`,
              },
            },
            {
              type: 'actions',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'View in calendar' },
                  url: `${frontendUrl}/launches`,
                },
              ],
            },
          ],
        },
      ],
    });

    const rawBody = JSON.stringify({ type, platform, detail });

    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        try {
          await fetch(webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: webhook.url.includes('hooks.slack.com') ? slackBody : rawBody,
          });
        } catch (e) {
          /** best-effort **/
        }
      })
    );
  }

  @ActivityMethod()
  async processPlug(data: {
    plugId: string;
    postId: string;
    delay: number;
    totalRuns: number;
    currentRun: number;
  }) {
    return this._integrationService.processPlugs(data);
  }

  @ActivityMethod()
  async processInternalPlug(data: {
    post: string;
    originalIntegration: string;
    integration: string;
    plugName: string;
    orgId: string;
    delay: number;
    information: any;
  }) {
    return this._integrationService.processInternalPlug(data);
  }

  @ActivityMethod()
  async refreshToken(
    integration: Integration
  ): Promise<false | AuthTokenDetails> {
    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    try {
      const refresh = await this._refreshIntegrationService.refresh(
        integration
      );
      if (!refresh) {
        return false;
      }

      if (getIntegration.refreshWait) {
        await timer(10000);
      }

      return refresh;
    } catch (err) {
      await this._refreshIntegrationService.setBetweenSteps(integration);
      return false;
    }
  }

  @ActivityMethod()
  async refreshTokenWithCause(
    integration: Integration,
    cause: string
  ): Promise<false | AuthTokenDetails> {
    const getIntegration = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    try {
      const refresh = await this._refreshIntegrationService.refresh(
        integration,
        cause
      );
      if (!refresh) {
        return false;
      }

      if (getIntegration.refreshWait) {
        await timer(10000);
      }

      return refresh;
    } catch (err) {
      await this._refreshIntegrationService.setBetweenSteps(
        integration,
        cause
      );
      return false;
    }
  }
}
