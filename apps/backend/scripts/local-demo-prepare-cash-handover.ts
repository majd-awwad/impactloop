/**
 * One-off LOCAL demo prep: paid CASH delivery ready for learner handover
 * screenshots. Isolated from the ON_THE_WAY driver scenario.
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-cash-handover.ts
 *   npx tsx scripts/local-demo-prepare-cash-handover.ts --delivery-id=<id>
 *   npm run demo:prepare:cash-handover
 */
import { prisma } from '../src/database/prisma.js';
import { env } from '../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from './lib/local-database-guard.mjs';
import {
  getDriverDeliveryDetail,
  updateDriverDeliveryStatus,
} from '../src/modules/driver/driver.service.js';
import { prepareCashHandoverDemo } from '../prisma/demo-data/prepare/prepare-cash-handover.js';

const deliveryIdArgument = process.argv.find((argument) =>
  argument.startsWith('--delivery-id='),
);

const deliveryId = deliveryIdArgument?.slice('--delivery-id='.length).trim();

if (deliveryIdArgument && !deliveryId) {
  throw new Error('--delivery-id requires a non-empty Delivery id.');
}

const formatWindow = (start: Date | null, end: Date | null) => ({
  start: start?.toISOString() ?? null,
  end: end?.toISOString() ?? null,
});

/**
 * Refresh an explicitly selected CASH delivery for a screenshot without
 * selecting a scenario or creating any reservation, delivery, or payment.
 */
const prepareExistingCashDelivery = async (targetDeliveryId: string) => {
  assertLocalDemoDatabaseUrl(
    env.databaseUrl,
    'explicit local CASH handover delivery prep',
  );

  const delivery = await prisma.delivery.findUnique({
    where: { id: targetDeliveryId },
    include: {
      reservation: {
        select: {
          id: true,
          deliveryGroupId: true,
          confirmedDeliveryWindowStart: true,
          confirmedDeliveryWindowEnd: true,
          material: { select: { title: true } },
        },
      },
      deliveryGroup: {
        select: {
          id: true,
          windowStart: true,
          windowEnd: true,
        },
      },
      assignedDriverProfile: {
        select: { userId: true, status: true },
      },
    },
  });

  if (!delivery) {
    throw new Error(`Delivery ${targetDeliveryId} was not found.`);
  }
  if (
    delivery.deliveryGroup &&
    delivery.reservation.deliveryGroupId !== delivery.deliveryGroup.id
  ) {
    throw new Error(
      `Delivery ${targetDeliveryId} and Reservation ${delivery.reservation.id} are not linked to the same DeliveryGroup; no changes were made.`,
    );
  }
  if (!delivery.assignedDriverProfile) {
    throw new Error(
      `Delivery ${targetDeliveryId} has no assigned driver for driver-detail verification; no changes were made.`,
    );
  }
  if (
    delivery.status === 'ON_THE_WAY' &&
    delivery.assignedDriverProfile.status !== 'ACTIVE'
  ) {
    throw new Error(
      `Delivery ${targetDeliveryId} has no active assigned driver for the ARRIVED_DROPOFF transition; no changes were made.`,
    );
  }

  const oldWindow = {
    reservation: formatWindow(
      delivery.reservation.confirmedDeliveryWindowStart,
      delivery.reservation.confirmedDeliveryWindowEnd,
    ),
    deliveryGroup: delivery.deliveryGroup
      ? formatWindow(
          delivery.deliveryGroup.windowStart,
          delivery.deliveryGroup.windowEnd,
        )
      : null,
    deliveryLevelScheduling: { scheduleOccurrence: delivery.scheduleOccurrence },
  };
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60_000);
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60_000);

  await prisma.$transaction(async (tx) => {
    // The runtime reads this reservation window for the driver detail UI.
    await tx.reservation.update({
      where: { id: delivery.reservation.id },
      data: {
        confirmedDeliveryWindowStart: windowStart,
        confirmedDeliveryWindowEnd: windowEnd,
      },
    });
    if (delivery.deliveryGroup) {
      await tx.deliveryGroup.update({
        where: { id: delivery.deliveryGroup.id },
        data: { windowStart, windowEnd },
      });
    }
    // Delivery has no scheduled/window timestamp fields in the current schema.
  });

  if (delivery.status === 'ON_THE_WAY') {
    await updateDriverDeliveryStatus(
      delivery.assignedDriverProfile!.userId,
      delivery.id,
      { status: 'ARRIVED_DROPOFF' },
    );
  }

  const prepared = await prisma.delivery.findUniqueOrThrow({
    where: { id: delivery.id },
    include: {
      reservation: {
        select: {
          id: true,
          confirmedDeliveryWindowStart: true,
          confirmedDeliveryWindowEnd: true,
          material: { select: { title: true } },
        },
      },
      deliveryGroup: { select: { windowStart: true, windowEnd: true } },
    },
  });

  const detail = await getDriverDeliveryDetail(
    delivery.assignedDriverProfile.userId,
    prepared.id,
  );
  const detailWindow = {
    start: detail.delivery.confirmedDeliveryWindowStart,
    end: detail.delivery.confirmedDeliveryWindowEnd,
  };
  const currentTimeIsVisible =
    detailWindow.start != null &&
    detailWindow.end != null &&
    new Date(detailWindow.start).getTime() <= Date.now() &&
    Date.now() <= new Date(detailWindow.end).getTime();

  if (!currentTimeIsVisible) {
    throw new Error(
      `Driver detail did not return a delivery window containing the current time: ${JSON.stringify(detailWindow)}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        deliveryId: prepared.id,
        reservationId: prepared.reservation.id,
        material: prepared.reservation.material.title,
        deliveryStatus: prepared.status,
        deliveryGroupExists: prepared.deliveryGroup != null,
        oldWindow,
        newWindow: {
          reservation: formatWindow(
            prepared.reservation.confirmedDeliveryWindowStart,
            prepared.reservation.confirmedDeliveryWindowEnd,
          ),
          deliveryGroup: prepared.deliveryGroup
            ? formatWindow(
                prepared.deliveryGroup.windowStart,
                prepared.deliveryGroup.windowEnd,
              )
            : null,
          deliveryLevelScheduling: {
            scheduleOccurrence: prepared.scheduleOccurrence,
          },
        },
        driverDetailWindow: detailWindow,
        currentTimeIsVisibleInDriverDetail: currentTimeIsVisible,
      },
      null,
      2,
    ),
  );
};

(deliveryId
  ? prepareExistingCashDelivery(deliveryId)
  : prepareCashHandoverDemo())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
