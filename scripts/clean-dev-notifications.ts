/**
 * DEV ONLY — cleans excessive or test-tagged notification rows from the local database.
 *
 * Usage (from apps/backend):
 *   npm run clean-dev-notifications
 *   npm run clean-dev-notifications -- --driver-email driver@example.com
 *   npm run clean-dev-notifications -- --dedupe-job-available
 *   npm run clean-dev-notifications -- --stale-job-available
 *   npm run clean-dev-notifications -- --all
 *
 * Default run (no flags): test tags + dedupe job-available + stale job-available.
 * Never run in production. Only deletes rows from the `notifications` table.
 */

import { prisma } from '../apps/backend/src/database/prisma.js';
import { env } from '../apps/backend/src/config/env.js';
import { DRIVER_DELIVERY_NOTIFICATION_TYPES } from '../apps/backend/src/modules/notifications/driver-delivery-notification-types.js';

const TEST_MARKERS = [
  'test-driver-delivery-notifications',
  'test-driver',
  '[test',
  '@impactloop.test',
  'seed',
  'mock',
] as const;

const parseArg = (name: string) => {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1]?.trim();
};

const assertDevOnly = () => {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run clean-dev-notifications in production.');
    process.exit(1);
  }

  const databaseUrl = env.databaseUrl.toLowerCase();
  const looksLocal =
    databaseUrl.includes('localhost') ||
    databaseUrl.includes('127.0.0.1') ||
    databaseUrl.includes('0.0.0.0');

  if (!looksLocal) {
    console.error(
      'Refusing to run: DATABASE_URL does not look like a local dev database.',
    );
    console.error('Set a local DATABASE_URL or run this only on your machine.');
    process.exit(1);
  }
};

const buildTestTagWhere = () => ({
  OR: TEST_MARKERS.flatMap((marker) => [
    { title: { contains: marker, mode: 'insensitive' as const } },
    { body: { contains: marker, mode: 'insensitive' as const } },
  ]),
});

const dedupeJobAvailableNotifications = async () => {
  const duplicates = await prisma.$queryRaw<Array<{ id: string }>>`
    DELETE FROM notifications n
    USING (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY user_id, notification_type, related_entity_type, related_entity_id
               ORDER BY created_at ASC, id ASC
             ) AS row_num
      FROM notifications
      WHERE notification_type = ${DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_AVAILABLE}
        AND related_entity_type = 'DELIVERY'
        AND related_entity_id IS NOT NULL
    ) d
    WHERE n.id = d.id
      AND d.row_num > 1
    RETURNING n.id
  `;

  return duplicates.length;
};

const deleteStaleJobAvailableNotifications = async () => {
  const stale = await prisma.notification.findMany({
    where: {
      notificationType:
        DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_AVAILABLE,
      relatedEntityType: 'DELIVERY',
      relatedEntityId: { not: null },
    },
    select: {
      id: true,
      relatedEntityId: true,
    },
  });

  if (stale.length === 0) {
    return 0;
  }

  const deliveryIds = [
    ...new Set(
      stale
        .map((row) => row.relatedEntityId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const deliveries = await prisma.delivery.findMany({
    where: { id: { in: deliveryIds } },
    select: { id: true, status: true },
  });

  const waitingIds = new Set(
    deliveries
      .filter((delivery) => delivery.status === 'WAITING_FOR_DRIVER')
      .map((delivery) => delivery.id),
  );

  const staleNotificationIds = stale
    .filter(
      (row) =>
        row.relatedEntityId != null && !waitingIds.has(row.relatedEntityId),
    )
    .map((row) => row.id);

  if (staleNotificationIds.length === 0) {
    return 0;
  }

  const deleted = await prisma.notification.deleteMany({
    where: { id: { in: staleNotificationIds } },
  });

  return deleted.count;
};

async function main() {
  assertDevOnly();

  const deleteAll = process.argv.includes('--all');
  const driverEmail = parseArg('--driver-email');
  const explicitDedupe = process.argv.includes('--dedupe-job-available');
  const explicitStale = process.argv.includes('--stale-job-available');
  const runDefaultMaintenance =
    !deleteAll && !driverEmail && !explicitDedupe && !explicitStale;

  const totalBefore = await prisma.notification.count();
  const jobAvailableBefore = await prisma.notification.count({
    where: {
      notificationType:
        DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_AVAILABLE,
    },
  });

  console.log(`Notifications before cleanup: ${totalBefore}`);
  console.log(`DRIVER_DELIVERY_AVAILABLE before cleanup: ${jobAvailableBefore}`);

  if (deleteAll) {
    const deleted = await prisma.notification.deleteMany();
    console.log(`Deleted all notifications: ${deleted.count}`);
    console.log(
      `Notifications after cleanup: ${await prisma.notification.count()}`,
    );
    return;
  }

  if (runDefaultMaintenance || process.argv.length <= 2) {
    const testTagged = await prisma.notification.deleteMany({
      where: buildTestTagWhere(),
    });
    console.log(`Deleted test-tagged notifications: ${testTagged.count}`);

    const deduped = await dedupeJobAvailableNotifications();
    console.log(`Deleted duplicate job-available notifications: ${deduped}`);

    const staleRemoved = await deleteStaleJobAvailableNotifications();
    console.log(
      `Deleted stale job-available notifications (delivery no longer waiting): ${staleRemoved}`,
    );
  }

  if (explicitDedupe) {
    const deduped = await dedupeJobAvailableNotifications();
    console.log(`Deleted duplicate job-available notifications: ${deduped}`);
  }

  if (explicitStale) {
    const staleRemoved = await deleteStaleJobAvailableNotifications();
    console.log(
      `Deleted stale job-available notifications (delivery no longer waiting): ${staleRemoved}`,
    );
  }

  if (driverEmail) {
    const user = await prisma.user.findUnique({
      where: { email: driverEmail },
      select: { id: true, email: true },
    });

    if (!user) {
      console.error(`No user found for email: ${driverEmail}`);
      process.exit(1);
    }

    const driverDeleted = await prisma.notification.deleteMany({
      where: { userId: user.id },
    });
    console.log(
      `Deleted notifications for ${user.email}: ${driverDeleted.count}`,
    );
  }

  const totalAfter = await prisma.notification.count();
  const jobAvailableAfter = await prisma.notification.count({
    where: {
      notificationType:
        DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_AVAILABLE,
    },
  });

  console.log(`Notifications after cleanup: ${totalAfter}`);
  console.log(`DRIVER_DELIVERY_AVAILABLE after cleanup: ${jobAvailableAfter}`);
  console.log(`Total removed: ${totalBefore - totalAfter}`);
}

main()
  .catch((error) => {
    console.error('clean-dev-notifications failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
