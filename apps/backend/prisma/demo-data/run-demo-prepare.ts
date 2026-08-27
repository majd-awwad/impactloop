/**
 * Graduation / report screenshot-state preparation.
 *
 * Additive and idempotent. Does not run canonical demo:seed or prisma:seed.
 * Each stage still enforces the local-demo database guard.
 *
 * Usage (from apps/backend):
 *   npm run demo:prepare
 */
import { prisma } from '../../src/database/prisma.js';
import { env } from '../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../scripts/lib/local-database-guard.mjs';
import { runInProcessStage } from './run-demo-stages.mjs';
import { prepareReviewDemo } from './prepare/prepare-reviews.js';
import { prepareLandingDemo } from './prepare/prepare-landing.js';
import { prepareHelpSessionDemo } from './prepare/prepare-help-session.js';
import { prepareNotificationDemo } from './prepare/prepare-notifications.js';
import { prepareCashHandoverDemo } from './prepare/prepare-cash-handover.js';
import { prepareDriverOnTheWayDemo } from './prepare/prepare-driver-ontheway.js';
import { prepareAdminAuditDemo } from './prepare/prepare-admin-audit.js';
import { prepareLearningCheckDemo } from './prepare/prepare-learning-check.js';
import { prepareSupplierOperationsDemo } from './prepare/prepare-supplier-operations.js';
import { prepareDriverOperationsDemo } from './prepare/prepare-driver-operations.js';
import { prepareDriverAvailableJobsDemo } from './prepare/prepare-driver-available-jobs.js';

const STAGES = [
  {
    id: 'reviews',
    label: 'Project reviews + comment thread',
    run: prepareReviewDemo,
  },
  {
    id: 'landing',
    label: 'Logged-out landing cards',
    run: prepareLandingDemo,
  },
  {
    id: 'help-session',
    label: 'Project help session',
    run: prepareHelpSessionDemo,
  },
  {
    id: 'cash-handover',
    label: 'CASH handover ARRIVED_DROPOFF',
    run: prepareCashHandoverDemo,
  },
  {
    id: 'driver-on-the-way',
    label: 'Driver ON_THE_WAY delivery',
    run: prepareDriverOnTheWayDemo,
  },
  {
    id: 'notifications',
    label: 'Learner notification inbox',
    run: prepareNotificationDemo,
  },
  {
    id: 'admin-audit',
    label: 'Admin audit log activity',
    run: prepareAdminAuditDemo,
  },
  {
    id: 'learning-check',
    label: 'Learning Check screenshot build',
    run: prepareLearningCheckDemo,
  },
  {
    id: 'supplier-operations',
    label: 'Supplier verification, governance, pickup schedule',
    run: prepareSupplierOperationsDemo,
  },
  {
    id: 'driver-operations',
    label: 'Driver profile, grouped history, incident history',
    run: prepareDriverOperationsDemo,
  },
  {
    id: 'driver-available-jobs',
    label: 'Driver available jobs, distances, and grouped job',
    run: prepareDriverAvailableJobsDemo,
  },
];

async function main() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'demo:prepare orchestration');

  console.log(
    JSON.stringify(
      {
        orchestrator: 'demo:prepare',
        note:
          'Graduation/report screenshot-state preparation. Additive. Does not run demo:seed or prisma:seed.',
        stages: STAGES.map((stage) => stage.id),
      },
      null,
      2,
    ),
  );

  for (let index = 0; index < STAGES.length; index += 1) {
    await runInProcessStage({
      stage: STAGES[index],
      index,
      total: STAGES.length,
      orchestrator: 'demo:prepare',
    });
  }

  console.log(
    JSON.stringify(
      {
        orchestrator: 'demo:prepare',
        status: 'ok',
        completedStages: STAGES.map((stage) => stage.id),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
