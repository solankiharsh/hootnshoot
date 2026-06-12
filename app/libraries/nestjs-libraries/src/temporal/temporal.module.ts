import { TemporalModule } from 'nestjs-temporal-core';
import { socialIntegrationList } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { createDatadogLogger } from '@gitroom/nestjs-libraries/observability/datadog.logger';

const datadogLogger = createDatadogLogger({
  service: 'orchestrator',
  component: 'temporal',
});

export const getTemporalModule = (
  isWorkers: boolean,
  path?: string,
  activityClasses?: any[]
) => {
  const workerIntegrations = [
    { identifier: 'main', maxConcurrentJob: undefined },
    ...socialIntegrationList,
  ].filter((f) => f.identifier.indexOf('-') === -1);

  if (isWorkers) {
    datadogLogger.info('Temporal workers configured', {
      event: 'hootnshoot.temporal.workers.configured',
      status: 'configured',
      'temporal.address': process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      'temporal.namespace': process.env.TEMPORAL_NAMESPACE || 'default',
      'temporal.worker.count': workerIntegrations.length,
      'temporal.task_queues': workerIntegrations.map((integration) =>
        integration.identifier.split('-')[0]
      ),
    });
  }

  return TemporalModule.register({
    isGlobal: true,
    connection: {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
      ...(process.env.TEMPORAL_TLS === 'true' ? { tls: true } : {}),
      ...(process.env.TEMPORAL_API_KEY
        ? { apiKey: process.env.TEMPORAL_API_KEY }
        : {}),
      namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    },
    taskQueue: 'main',
    logLevel: 'error',
    ...(isWorkers
      ? {
          workers: workerIntegrations.map((integration) => ({
            taskQueue: integration.identifier.split('-')[0],
            workflowsPath: path!,
            activityClasses: activityClasses!,
            autoStart: true,
            ...(integration.maxConcurrentJob
              ? {
                  workerOptions: {
                    maxConcurrentActivityTaskExecutions:
                      integration.maxConcurrentJob,
                  }
                }
              : {}),
          })),
        }
      : {}),
  });
};
