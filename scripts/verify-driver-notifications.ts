/**
 * Trace driver notification pipeline against real DB state (read-only).
 *
 * Usage (from apps/backend):
 *   npx tsx ../../scripts/verify-driver-notifications.ts
 *   npx tsx ../../scripts/verify-driver-notifications.ts --email israaproject850@gmail.com
 */

import { prisma } from '../apps/backend/src/database/prisma.js';
import { DRIVER_NOTIFICATION_TYPES } from '../apps/backend/src/modules/notifications/driver-delivery-notification-types.js';

const MAX_ACTIVE_DRIVER_DELIVERIES = 3;
const DRIVER_IN_PROGRESS = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
] as const;

const STATUSES = [
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
] as const;

const parseEmail = () => {
  const index = process.argv.indexOf('--email');
  if (index === -1) {
    return 'israaproject850@gmail.com';
  }
  return process.argv[index + 1]?.trim() ?? 'israaproject850@gmail.com';
};

async function main() {
  const email = parseEmail();

  const user = await prisma.user.findFirst({
    where: { email },
    select: {
      id: true,
      email: true,
      displayName: true,
      driverProfile: {
        select: {
          id: true,
          status: true,
          availability: true,
          city: true,
          area: true,
        },
      },
    },
  });

  if (!user) {
    console.error(`No user for email: ${email}`);
    process.exit(1);
  }

  const profile = user.driverProfile;
  const activeCount = profile
    ? await prisma.delivery.count({
        where: {
          assignedDriverProfileId: profile.id,
          status: { in: [...DRIVER_IN_PROGRESS] },
        },
      })
    : 0;

  console.log('=== Driver ===');
  console.log(`userId: ${user.id}`);
  console.log(`email: ${user.email}`);
  console.log(`driverProfileId: ${profile?.id ?? 'NONE'}`);
  console.log(`driverStatus: ${profile?.status ?? 'NONE'}`);
  console.log(`availability: ${profile?.availability ?? 'NONE'}`);
  console.log(`city/area: ${profile?.city ?? '-'} / ${profile?.area ?? '-'}`);
  console.log(`activeDeliveryCount: ${activeCount}`);
  console.log(`maxActiveLimit: ${MAX_ACTIVE_DRIVER_DELIVERIES}`);
  console.log(
    `eligibleForNewJobs: ${
      profile?.status === 'ACTIVE' && activeCount < MAX_ACTIVE_DRIVER_DELIVERIES
    }`,
  );

  console.log('\n=== Deliveries by status ===');
  for (const status of STATUSES) {
    const count = await prisma.delivery.count({ where: { status } });
    if (count > 0) {
      console.log(`  ${status}: ${count}`);
    }
  }

  const waiting = await prisma.delivery.findMany({
    where: { status: 'WAITING_FOR_DRIVER', assignedDriverProfileId: null },
    select: {
      id: true,
      status: true,
      createdAt: true,
      reservation: {
        select: {
          material: { select: { title: true } },
        },
      },
      pickupLocation: { select: { city: true, area: true } },
      dropoffLocation: { select: { city: true, area: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log(`\n=== WAITING_FOR_DRIVER deliveries (${waiting.length}) ===`);
  for (const delivery of waiting) {
    const notif = profile
      ? await prisma.notification.findFirst({
          where: {
            userId: user.id,
            notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
            relatedEntityType: 'DELIVERY',
            relatedEntityId: delivery.id,
          },
          select: { id: true, isRead: true, createdAt: true },
        })
      : null;

    const eligible =
      profile?.status === 'ACTIVE' && activeCount < MAX_ACTIVE_DRIVER_DELIVERIES;

    console.log(`\n  deliveryId: ${delivery.id}`);
    console.log(`  material: ${delivery.reservation.material.title}`);
    console.log(
      `  pickup: ${delivery.pickupLocation.city ?? '-'} / ${delivery.pickupLocation.area ?? '-'}`,
    );
    console.log(
      `  dropoff: ${delivery.dropoffLocation.city ?? '-'} / ${delivery.dropoffLocation.area ?? '-'}`,
    );
    console.log(`  driverEligible: ${eligible}`);
    console.log(
      `  DRIVER_NEW_JOB notification: ${notif ? `yes (id=${notif.id}, read=${notif.isRead})` : 'MISSING'}`,
    );
  }

  const driverNotifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  console.log(`\n=== Driver notifications (${driverNotifications.length}) ===`);
  for (const row of driverNotifications) {
    let deliveryStatus = 'n/a';
    if (row.relatedEntityId) {
      const d = await prisma.delivery.findUnique({
        where: { id: row.relatedEntityId },
        select: { status: true },
      });
      deliveryStatus = d?.status ?? 'MISSING';
    }

    console.log(
      `  [${row.isRead ? 'read' : 'unread'}] ${row.notificationType} | ${row.title} | delivery=${row.relatedEntityId} (${deliveryStatus})`,
    );
  }

  if (profile) {
    const assigned = await prisma.delivery.findMany({
      where: { assignedDriverProfileId: profile.id },
      select: {
        id: true,
        status: true,
        reservation: {
          select: {
            supplierPickupWindowStart: true,
            supplierPickupWindowEnd: true,
            confirmedDeliveryWindowStart: true,
            confirmedDeliveryWindowEnd: true,
            material: { select: { title: true } },
          },
        },
      },
    });

    console.log(`\n=== Assigned deliveries (${assigned.length}) ===`);
    const now = Date.now();
    const lookahead = 15 * 60 * 1000;

    for (const d of assigned) {
      const pickupStart = d.reservation.supplierPickupWindowStart;
      const dropoffStart = d.reservation.confirmedDeliveryWindowStart;
      const pickupDue =
        pickupStart &&
        now >= pickupStart.getTime() - lookahead &&
        now < (d.reservation.supplierPickupWindowEnd ?? pickupStart).getTime();
      const dropoffDue =
        dropoffStart &&
        now >= dropoffStart.getTime() - lookahead &&
        now <
          (d.reservation.confirmedDeliveryWindowEnd ?? dropoffStart).getTime();

      const pickupNotif = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
          relatedEntityId: d.id,
        },
      });
      const dropoffNotif = await prisma.notification.findFirst({
        where: {
          userId: user.id,
          notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_DROPOFF_TIME,
          relatedEntityId: d.id,
        },
      });

      console.log(`\n  deliveryId: ${d.id} status=${d.status}`);
      console.log(`  material: ${d.reservation.material.title}`);
      console.log(`  pickupWindow: ${pickupStart?.toISOString() ?? 'MISSING'}`);
      console.log(`  dropoffWindow: ${dropoffStart?.toISOString() ?? 'MISSING'}`);
      console.log(`  pickupDueNow: ${Boolean(pickupDue)}`);
      console.log(`  dropoffDueNow: ${Boolean(dropoffDue)}`);
      console.log(`  DRIVER_PICKUP_TIME: ${pickupNotif ? 'yes' : 'MISSING'}`);
      console.log(`  DRIVER_DROPOFF_TIME: ${dropoffNotif ? 'yes' : 'MISSING'}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
