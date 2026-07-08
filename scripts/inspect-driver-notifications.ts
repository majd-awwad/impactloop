/**
 * DEV ONLY — inspect driver notification pollution in local DB.
 */
import { prisma } from '../apps/backend/src/database/prisma.js';
import { DRIVER_DELIVERY_NOTIFICATION_TYPES } from '../apps/backend/src/modules/notifications/driver-delivery-notification-types.js';

const JOB_TYPE = DRIVER_DELIVERY_NOTIFICATION_TYPES.DRIVER_DELIVERY_AVAILABLE;

async function main() {
  const total = await prisma.notification.count();

  const driverUserIds = (
    await prisma.userRoleAssignment.findMany({
      where: { role: 'DRIVER' },
      select: { userId: true },
    })
  ).map((r) => r.userId);

  const driverWhere = { userId: { in: driverUserIds } };
  const driverTotal = await prisma.notification.count({ where: driverWhere });
  const driverUnread = await prisma.notification.count({
    where: { ...driverWhere, isRead: false },
  });

  const byType = await prisma.notification.groupBy({
    by: ['notificationType'],
    where: driverWhere,
    _count: { _all: true },
  });

  const jobAvailable = await prisma.notification.findMany({
    where: {
      ...driverWhere,
      notificationType: JOB_TYPE,
    },
    select: {
      id: true,
      userId: true,
      title: true,
      relatedEntityId: true,
      relatedEntityType: true,
      isRead: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const deliveryIds = [
    ...new Set(
      jobAvailable
        .map((n) => n.relatedEntityId)
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

  const deliveryStatusById = new Map(
    deliveries.map((d) => [d.id, d.status] as const),
  );

  const jobCount = await prisma.notification.count({
    where: { ...driverWhere, notificationType: JOB_TYPE },
  });

  const waitingCount = jobAvailable.filter(
    (n) =>
      n.relatedEntityId &&
      deliveryStatusById.get(n.relatedEntityId) === 'WAITING_FOR_DRIVER',
  ).length;

  console.log('=== Driver notification inspection ===');
  console.log(`Total notifications: ${total}`);
  console.log(`Driver notifications: ${driverTotal}`);
  console.log(`Driver unread: ${driverUnread}`);
  console.log('Driver notifications by type:');
  for (const row of byType) {
    console.log(`  ${row.notificationType}: ${row._count._all}`);
  }
  console.log(`DRIVER_DELIVERY_AVAILABLE (drivers): ${jobCount}`);
  console.log(
    `Sample job-available with WAITING_FOR_DRIVER delivery: ${waitingCount} of ${Math.min(jobAvailable.length, 20)} sampled`,
  );

  const statusBreakdown = new Map<string, number>();
  for (const n of await prisma.notification.findMany({
    where: { ...driverWhere, notificationType: JOB_TYPE },
    select: { relatedEntityId: true },
  })) {
    const key = n.relatedEntityId
      ? deliveryStatusById.get(n.relatedEntityId) ?? 'MISSING_DELIVERY'
      : 'NO_DELIVERY_ID';
    statusBreakdown.set(key, (statusBreakdown.get(key) ?? 0) + 1);
  }

  console.log('Job-available delivery status breakdown:');
  for (const [status, count] of [...statusBreakdown.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${status}: ${count}`);
  }

  const drivers = await prisma.user.findMany({
    where: { id: { in: driverUserIds } },
    select: {
      id: true,
      email: true,
      displayName: true,
      _count: { select: { notifications: true } },
    },
    orderBy: { notifications: { _count: 'desc' } },
    take: 5,
  });

  console.log('Top drivers by notification count:');
  for (const d of drivers) {
    const unread = await prisma.notification.count({
      where: { userId: d.id, isRead: false },
    });
    console.log(
      `  ${d.email} — total ${d._count.notifications}, unread ${unread}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
