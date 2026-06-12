import { initializeSentry } from '@gitroom/nestjs-libraries/sentry/initialize.sentry';
initializeSentry('orchestrator', true);
import 'source-map-support/register';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

import { NestFactory } from '@nestjs/core';
import { AppModule } from '@gitroom/orchestrator/app.module';
import * as dns from 'node:dns';
import {
  createDatadogLogger,
  createDatadogRequestLogger,
} from '@gitroom/nestjs-libraries/observability/datadog.logger';
dns.setDefaultResultOrder('ipv4first');

const datadogLogger = createDatadogLogger({
  service: 'orchestrator',
  component: 'lifecycle',
});

process.on('uncaughtExceptionMonitor', (error) => {
  datadogLogger.fatal('Orchestrator uncaught exception', {
    event: 'hootnshoot.orchestrator.uncaught_exception',
    status: 'failed',
    error,
  });
});

async function bootstrap() {
  datadogLogger.info('Orchestrator startup started', {
    event: 'hootnshoot.orchestrator.starting',
    status: 'starting',
    'temporal.address': process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    'temporal.namespace': process.env.TEMPORAL_NAMESPACE || 'default',
  });

  const app = await NestFactory.create(AppModule);
  app.use(
    createDatadogRequestLogger({
      service: 'orchestrator',
      component: 'http',
    })
  );
  app.enableShutdownHooks();
  const port = process.env.ORCHESTRATOR_PORT || 3002;
  await app.listen(port);
  console.log(`Orchestrator health check listening on port ${port}`);
  datadogLogger.info('Orchestrator started successfully', {
    event: 'hootnshoot.orchestrator.started',
    status: 'started',
    port,
  });
}


bootstrap().catch((error) => {
  datadogLogger.fatal('Orchestrator failed to start', {
    event: 'hootnshoot.orchestrator.start_failed',
    status: 'failed',
    error,
  });
  throw error;
});
