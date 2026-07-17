import { app } from './app.js';
import {
  env,
  getResolvedEmailProvider,
  logAiPriceSuggestionStartupConfig,
  logEmailInvitationStartupConfig,
} from './config/env.js';
import { prisma } from './database/prisma.js';
import { verifySmtpInvitationTransport } from './modules/invitations/email/smtp-email-invitation-provider.js';
import { RecommendationOutboxWorker } from './modules/recommendation-events/recommendation-events.outbox.worker.js';

logAiPriceSuggestionStartupConfig();
logEmailInvitationStartupConfig();

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
  pollIntervalMs: env.recommendationOutboxPollIntervalMs,
  batchSize: env.recommendationOutboxBatchSize,
  maxAttempts: env.recommendationOutboxMaxAttempts,
  leaseMs: env.recommendationOutboxLeaseMs,
});

const server = app.listen(env.port, () => {
  console.log(`ImpactLoop API listening on port ${env.port}`);
  if (env.recommendationOutboxWorkerEnabled) {
    recommendationOutboxWorker.start();
    console.log('[Recommendation outbox] worker enabled');
  }
});

let shuttingDown = false;
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`[ImpactLoop API] ${signal} received; shutting down`);
  await recommendationOutboxWorker.stop();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
};

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
