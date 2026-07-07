/**
 * DEV ONLY — backfill DRIVER_NEW_JOB for WAITING_FOR_DRIVER deliveries missing notifications.
 *
 * Usage (from apps/backend):
 *   npx tsx ../../scripts/backfill-driver-new-job-notifications.ts
 *
 * Does not create fake data. Only calls notifyNewDriverJob for real waiting deliveries.
 */

import { prisma } from '../apps/backend/src/database/prisma.js';
import { env } from '../apps/backend/src/config/env.js';
import { notifyNewDriverJob } from '../apps/backend/src/modules/notifications/driver-notification-events.service.js';
import { DRIVER_NOTIFICATION_TYPES } from '../apps/backend/src/modules/notifications/driver-delivery-notification-types.js';

const assertDevOnly = () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run in production.');
    process.exit(1);
  }

  const databaseUrl = env.databaseUrl.toLowerCase();
  const looksLocal =
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1') ||
    databaseUrl.includes('0.0.0.0');

  if (!looksLocal) {
    console.error('Refusing to run: DATABASE_URL does not look local.');
    process.exit(1);
  }
};

async function main() {
  assertDevOnly();

  const waiting = await prisma.delivery.findMany({
    where: {
      status: 'WAITING_FOR_DRIVER',
      assignedDriverProfileId: null,
    },
    select: { id: true, reservationId: true },
    orderBy: { requestedAt: 'desc' },
  });

  console.log(`WAITING_FOR_DRIVER deliveries: ${waiting.length}`);

  let created = 0;
  for (const delivery of waiting) {
    const existing = await prisma.notification.count({
      where: {
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityType: 'DELIVERY',
        relatedEntityId: delivery.id,
      },
    });

    if (existing > 0) {
      console.log(`  skip ${delivery.id} (already has ${existing} notification(s))`);
      continue;
    }

    await notifyNewDriverJob(delivery.id);

    const after = await prisma.notification.count({
      where: {
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
      },
    });

    console.log(`  backfilled ${delivery.id}: ${after} notification row(s)`);
    created += after;
  }

  console.log(`Total new notification rows created: ${created}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
