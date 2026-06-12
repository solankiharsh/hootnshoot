import { initializeSentry } from '@gitroom/nestjs-libraries/sentry/initialize.sentry';
initializeSentry('backend', true);
import compression from 'compression';

import { loadSwagger } from '@gitroom/helpers/swagger/load.swagger';
import { json, urlencoded } from 'body-parser';
import { Runtime } from '@temporalio/worker';
Runtime.install({ shutdownSignals: [] });

process.env.TZ = 'UTC';

import cookieParser from 'cookie-parser';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getBodyParserOptions } from '@nestjs/platform-express/adapters/utils/get-body-parser-options.util';
import { AppModule } from './app.module';

import { SubscriptionExceptionFilter } from '@gitroom/backend/services/auth/permissions/subscription.exception';
import { HttpExceptionFilter } from '@gitroom/nestjs-libraries/services/exception.filter';
import { ConfigurationChecker } from '@gitroom/helpers/configuration/configuration.checker';
import { startMcp } from '@gitroom/nestjs-libraries/chat/start.mcp';
import {
  createDatadogLogger,
  createDatadogRequestLogger,
} from '@gitroom/nestjs-libraries/observability/datadog.logger';

const datadogLogger = createDatadogLogger({
  service: 'backend',
  component: 'lifecycle',
});

async function start() {
  datadogLogger.info('Backend startup started', {
    event: 'hootnshoot.backend.starting',
    status: 'starting',
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bodyParser: false,
    cors: {
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'auth',
        'showorg',
        'impersonate',
        'X-Requested-With',
        'x-requested-with',
        'uppy-auth-token',
      ],
      exposedHeaders: [
        'reload',
        'onboarding',
        'activate',
        ...(process.env.NOT_SECURED ? ['auth', 'showorg', 'impersonate'] : []),
      ],
      origin: [
        process.env.FRONTEND_URL,
        'http://localhost:6274',
        ...(process.env.MAIN_URL ? [process.env.MAIN_URL] : []),
      ],
    },
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use(json({ ...getBodyParserOptions(true), limit: '50mb' }));
  expressApp.use(
    urlencoded({
      ...getBodyParserOptions(true, { extended: true }),
      limit: '50mb',
    })
  );

  app.use(
    createDatadogRequestLogger({
      service: 'backend',
      component: 'http',
    })
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    })
  );

  app.use(cookieParser());
  app.use(compression());
  app.useGlobalFilters(new SubscriptionExceptionFilter());
  app.useGlobalFilters(new HttpExceptionFilter());

  loadSwagger(app);

  const port = process.env.PORT || 3000;

  try {
    await app.listen(port);
    console.log('Backend started successfully on port ' + port);
    datadogLogger.info('Backend started successfully', {
      event: 'hootnshoot.backend.started',
      status: 'started',
      port,
    });

    try {
      await startMcp(app);
      datadogLogger.info('MCP/Mastra registered', {
        event: 'hootnshoot.backend.mcp.started',
        status: 'started',
      });
    } catch (mcpErr) {
      const err = mcpErr as Error;
      Logger.error(
        'MCP/Mastra startup failed; HTTP API continues without MCP routes',
        err?.stack
      );
      datadogLogger.error('MCP/Mastra startup failed', {
        event: 'hootnshoot.backend.mcp.start_failed',
        status: 'failed',
        'error.name': err?.name,
        'error.message': err?.message,
      });
    }

    checkConfiguration(); // Do this last, so that users will see obvious issues at the end of the startup log without having to scroll up.

    Logger.log(`🚀 Backend is running on: http://localhost:${port}`);
  } catch (e) {
    Logger.error(`Backend failed to start on port ${port}`, e);
    datadogLogger.error('Backend failed to start', {
      event: 'hootnshoot.backend.start_failed',
      status: 'failed',
      port,
      error: e,
    });
  }
}

function checkConfiguration() {
  const checker = new ConfigurationChecker();
  checker.readEnvFromProcess();
  checker.check();

  if (checker.hasIssues()) {
    for (const issue of checker.getIssues()) {
      Logger.warn(issue, 'Configuration issue');
    }

    Logger.warn('Configuration issues found: ' + checker.getIssuesCount());
    datadogLogger.warn('Backend configuration issues found', {
      event: 'hootnshoot.backend.configuration.checked',
      status: 'warn',
      'configuration.issue_count': checker.getIssuesCount(),
    });
  } else {
    Logger.log('Configuration check completed without any issues');
    datadogLogger.info('Backend configuration check passed', {
      event: 'hootnshoot.backend.configuration.checked',
      status: 'passed',
      'configuration.issue_count': 0,
    });
  }
}

start();
