import './config/env.js';
import { app } from './app.js';
import { env, getResolvedEmailProvider } from './config/env.js';
import { databasePool, getDatabasePoolSnapshot, prisma } from './database/prisma.js';
import { verifySmtpInvitationTransport } from './modules/invitations/email/smtp-email-invitation-provider.js';
import {
  beginReadinessShutdown,
  registerDatabaseHealthProvider,
  registerRecommendationOutboxHealthProvider,
  registerReservationLifecycleHealthProvider,
  runReadinessAwareShutdown,
} from './modules/health/health.service.js';
import { DatabaseHealthProbe } from './modules/health/database-health.probe.js';
import {
  RecommendationOutboxWorker,
  RECOMMENDATION_OUTBOX_SHUTDOWN_WAIT_MS,
} from './modules/recommendation-events/recommendation-events.outbox.worker.js';
import { preloadRecommendationMlRuntime } from './modules/recommendations/ml-runtime-state.service.js';
import { ReservationLifecycleWorker } from './modules/reservations/reservation-lifecycle.worker.js';
import { MaterialRequestLifecycleWorker } from './modules/material-requests/material-request-lifecycle.worker.js';
import { logger } from './observability/logger.js';
import {
  logAiStartupConfig,
  logEmailInvitationStartupConfig,
  logPaymentStartupConfig,
  logRecommendationMlRuntimeReady,
  logRecommendationOutboxStartupConfig,
  logServerListening,
  logSmtpInvitationVerifyResult,
} from './observability/startup-logging.js';

logPaymentStartupConfig();
logAiStartupConfig();
logEmailInvitationStartupConfig();

const recommendationMlRuntime = await preloadRecommendationMlRuntime();
logRecommendationMlRuntimeReady(recommendationMlRuntime);

if (getResolvedEmailProvider() === 'smtp') {
  void verifySmtpInvitationTransport().then((result) => {
    logSmtpInvitationVerifyResult(result);
  });
}

const recommendationOutboxWorker = new RecommendationOutboxWorker({
  enabled: env.recommendationOutboxWorkerEnabled,
  required: env.recommendationOutboxWorkerRequired,
  pollIntervalMs: env.recommendationOutboxPollIntervalMs,
  batchSize: env.recommendationOutboxBatchSize,
  maxAttempts: env.recommendationOutboxMaxAttempts,
  leaseMs: env.recommendationOutboxLeaseMs,
});

if (env.recommendationOutboxWorkerEnabled) {
  recommendationOutboxWorker.start();
}
logRecommendationOutboxStartupConfig();

registerRecommendationOutboxHealthProvider({
  getSnapshot: (nowMs) => recommendationOutboxWorker.getHealthSnapshot(nowMs),
  markShutdownRequested: () => {
    recommendationOutboxWorker.markShutdownRequested();
  },
});

const databaseHealthProbe = new DatabaseHealthProbe();
databaseHealthProbe.start();
registerDatabaseHealthProvider({
  getSnapshot: (nowMs) => databaseHealthProbe.getHealthSnapshot(nowMs),
});

const reservationLifecycleWorker = new ReservationLifecycleWorker();
reservationLifecycleWorker.start();
registerReservationLifecycleHealthProvider({
  getSnapshot: (nowMs) => reservationLifecycleWorker.getHealthSnapshot(nowMs),
});

const materialRequestLifecycleWorker = new MaterialRequestLifecycleWorker();
materialRequestLifecycleWorker.start();

const server = app.listen(env.port, () => {
  const pool = getDatabasePoolSnapshot();
  logServerListening({
    port: env.port,
    pid: process.pid,
    poolMax: pool.poolMax,
  });
});

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  reservationLifecycleWorker.stop();
  materialRequestLifecycleWorker.stop();
  databaseHealthProbe.stop();
  logger.info(
    { operation: 'server.shutdown', reason: signal },
    'ImpactLoop API shutting down',
  );

  await runReadinessAwareShutdown({
    beginShutdown: beginReadinessShutdown,
    stopTimeoutMs: RECOMMENDATION_OUTBOX_SHUTDOWN_WAIT_MS,
    stopWorker: (timeoutMs) => recommendationOutboxWorker.stop(timeoutMs),
    closeHttp: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
    disconnectDb: async () => {
      await prisma.$disconnect();
      await databasePool.end();
    },
    markWorkerStopped: () => {
      recommendationOutboxWorker.markStopped();
    },
    onHardExit: (code) => {
      logger.error(
        {
          operation: 'server.shutdown_hard_exit',
          statusCode: code,
          reason: 'outbox_shutdown_timeout',
        },
        'ImpactLoop API hard exit after outbox shutdown timeout',
      );
      process.exit(code);
    },
  });
};

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
