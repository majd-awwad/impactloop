/**
 * DEV ONLY — audit driver notification records before cleanup.
 *
 * Usage (from apps/backend):
 *   npx tsx ../../scripts/audit-driver-notifications.ts
 *   npx tsx ../../scripts/audit-driver-notifications.ts --email driver@example.com
 */

import { prisma } from '../apps/backend/src/database/prisma.js';

const parseEmail = () => {
  const index = process.argv.indexOf('--email');
  if (index === -1) {
    return 'israaproject850@gmail.com';
  }
  return process.argv[index + 1]?.trim() ?? 'israaproject850@gmail.com';
};

async function main() {
  const email = parseEmail();

  const driver = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true },
  });

  const driverUserIds = driver
    ? [driver.id]
    : (
        await prisma.userRoleAssignment.findMany({
          where: { role: 'DRIVER' },
          select: { userId: true },
        })
      ).map((row) => row.userId);

  const total = await prisma.notification.count();
  const driverTotal = await prisma.notification.count({
    where: { userId: { in: driverUserIds } },
  });
  const driverUnread = await prisma.notification.count({
    where: { userId: { in: driverUserIds }, isRead: false },
  });

  const byType = await prisma.notification.groupBy({
    by: ['notificationType'],
    where: { userId: { in: driverUserIds } },
    _count: { _all: true },
  });

  const byTitle = await prisma.notification.groupBy({
    by: ['title'],
    where: { userId: { in: driverUserIds } },
    _count: { _all: true },
  });

  const jobRows = await prisma.notification.findMany({
    where: {
      userId: { in: driverUserIds },
      notificationType: 'DRIVER_DELIVERY_AVAILABLE',
    },
    select: {
      id: true,
      relatedEntityId: true,
      isRead: true,
    },
  });

  const deliveryIds = [
    ...new Set(
      jobRows
        .map((row) => row.relatedEntityId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const deliveries =
    deliveryIds.length > 0
      ? await prisma.delivery.findMany({
          where: { id: { in: deliveryIds } },
          select: { id: true, status: true },
        })
      : [];

  const deliveryStatus = new Map(deliveries.map((d) => [d.id, d.status]));

  console.log('=== Notification model ===');
  console.log('Table: notifications');
  console.log('Fields: id, userId, notificationType, title, body,');
  console.log('        relatedEntityType, relatedEntityId, isRead, createdAt');
  console.log('');
  console.log(`Driver email: ${email}`);
  console.log(`Total notifications (all users): ${total}`);
  console.log(`Driver notifications: ${driverTotal}`);
  console.log(`Driver unread: ${driverUnread}`);
  console.log('');
  console.log('By notificationType (drivers):');
  for (const row of byType) {
    console.log(`  ${row.notificationType}: ${row._count._all}`);
  }
  console.log('');
  console.log('By title (drivers):');
  for (const row of byTitle) {
    console.log(`  ${row.title}: ${row._count._all}`);
  }
  console.log('');
  console.log(`DRIVER_DELIVERY_AVAILABLE rows: ${jobRows.length}`);
  let waiting = 0;
  let missing = 0;
  let other = 0;
  for (const row of jobRows) {
    if (!row.relatedEntityId) {
      missing += 1;
      continue;
    }
    const status = deliveryStatus.get(row.relatedEntityId);
    if (!status) {
      missing += 1;
    } else if (status === 'WAITING_FOR_DRIVER') {
      waiting += 1;
    } else {
      other += 1;
    }
  }
  console.log(`  WAITING_FOR_DRIVER: ${waiting}`);
  console.log(`  missing delivery: ${missing}`);
  console.log(`  other status: ${other}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
