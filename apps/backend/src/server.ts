import './config/env.js';
import { app } from './app.js';
import {
  env,
  getResolvedEmailProvider,
  logAiPlatformDiagnostics,
  logAiPriceSuggestionStartupConfig,
  logEmailInvitationStartupConfig,
  logRecommendationOutboxStartupConfig,
} from './config/env.js';
import { prisma } from './database/prisma.js';
import { verifySmtpInvitationTransport } from './modules/invitations/email/smtp-email-invitation-provider.js';
import {
  beginReadinessShutdown,
  registerRecommendationOutboxHealthProvider,
  runReadinessAwareShutdown,
} from './modules/health/health.service.js';
import {
  RecommendationOutboxWorker,
  RECOMMENDATION_OUTBOX_SHUTDOWN_WAIT_MS,
} from './modules/recommendation-events/recommendation-events.outbox.worker.js';
import { preloadRecommendationMlRuntime } from './modules/recommendations/ml-runtime-state.service.js';

logAiPriceSuggestionStartupConfig();
logAiPlatformDiagnostics();
logEmailInvitationStartupConfig();
logRecommendationOutboxStartupConfig();

const recommendationMlRuntime = await preloadRecommendationMlRuntime();
console.log(
  '[Recommendation ML runtime]',
  JSON.stringify(recommendationMlRuntime),
);

if (getResolvedEmailProvider() === 'smtp') {
  void verifySmtpInvitationTransport().then((result) => {
    if (result.ok) {
      console.log('[Email invitation config] SMTP connection verify: ok');
      return;
    }

    console.log(
      `[Email invitation config] SMTP connection verify failed: ${result.error ?? 'unknown error'}`,
    );
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
  console.log('[Recommendation outbox] worker enabled');
} else if (env.recommendationOutboxWorkerRequired) {
  console.log(
    '[Recommendation outbox] worker required but disabled; readiness will remain not ready',
  );
} else {
  console.log('[Recommendation outbox] worker intentionally disabled');
}

registerRecommendationOutboxHealthProvider({
  getSnapshot: (nowMs) => recommendationOutboxWorker.getHealthSnapshot(nowMs),
  markShutdownRequested: () => {
    recommendationOutboxWorker.markShutdownRequested();
  },
});

const server = app.listen(env.port, () => {
  console.log(`ImpactLoop API listening on port ${env.port}`);
});

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[ImpactLoop API] ${signal} received; shutting down`);

  await runReadinessAwareShutdown({
    beginShutdown: beginReadinessShutdown,
    stopTimeoutMs: RECOMMENDATION_OUTBOX_SHUTDOWN_WAIT_MS,
    stopWorker: (timeoutMs) => recommendationOutboxWorker.stop(timeoutMs),
    closeHttp: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
    disconnectDb: () => prisma.$disconnect(),
    markWorkerStopped: () => {
      recommendationOutboxWorker.markStopped();
    },
    onHardExit: (code) => {
      console.error(
        `[ImpactLoop API] hard exit after outbox shutdown timeout (code=${code})`,
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
