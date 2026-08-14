import type { DeliveryStatus, Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

export const RETRY_WINDOW_LIMIT_MS = 48 * 60 * 60 * 1000;

const schedulingConflict = () =>
  new AppError(
    'Delivery scheduling state changed. Refresh and try again.',
    409,
    'DELIVERY_SCHEDULING_CONFLICT',
  );

export const assertValidOperationalWindow = (input: {
  start: Date;
  end: Date;
  now: Date;
  requireFutureStart?: boolean;
  retryDeadline?: Date | null;
}) => {
  if (
    Number.isNaN(input.start.getTime()) ||
    Number.isNaN(input.end.getTime()) ||
    input.end.getTime() <= input.start.getTime()
  ) {
    throw new AppError(
      'Delivery window end must be after its start.',
      400,
      'DELIVERY_WINDOW_INVALID',
    );
  }

  if (
    (input.requireFutureStart && input.start.getTime() <= input.now.getTime()) ||
    input.end.getTime() <= input.now.getTime()
  ) {
    throw new AppError(
      'Delivery window must be in the future.',
      400,
      'DELIVERY_WINDOW_INVALID',
    );
  }

  if (
    input.retryDeadline &&
    input.end.getTime() > input.retryDeadline.getTime()
  ) {
    throw new AppError(
      'Redelivery must finish within 48 hours of the first failed attempt.',
      409,
      'REDELIVERY_DEADLINE_EXCEEDED',
    );
  }
};

export const loadCarriedReservationIds = async (
  tx: Prisma.TransactionClient,
  deliveryId: string,
) => {
  const delivery = await tx.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      reservationId: true,
      deliveryGroupId: true,
      pickupItems: {
        where: { wasPicked: true },
        select: { reservationId: true },
      },
    },
  });
  if (!delivery) throw schedulingConflict();

  const ids = [...new Set(delivery.pickupItems.map((row) => row.reservationId))];
  if (ids.length === 0 || !ids.includes(delivery.reservationId)) {
    throw schedulingConflict();
  }

  const represented = await tx.reservation.findMany({
    where: {
      id: { in: ids },
      status: 'ACCEPTED',
      fulfillmentMethod: 'DELIVERY',
      ...(delivery.deliveryGroupId
        ? { deliveryGroupId: delivery.deliveryGroupId }
        : { id: delivery.reservationId, deliveryGroupId: null }),
    },
    select: { id: true },
  });
  if (represented.length !== ids.length) throw schedulingConflict();
  return ids;
};

export const applyOperationalWindowToCarriedReservations = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryId: string;
    start: Date;
    end: Date;
  },
) => {
  const reservationIds = await loadCarriedReservationIds(tx, input.deliveryId);
  const updated = await tx.reservation.updateMany({
    where: {
      id: { in: reservationIds },
      status: 'ACCEPTED',
      fulfillmentMethod: 'DELIVERY',
    },
    data: {
      confirmedDeliveryWindowStart: input.start,
      confirmedDeliveryWindowEnd: input.end,
      earliestDeliveryStart: null,
      schedulingConflictReason: null,
    },
  });
  if (updated.count !== reservationIds.length) throw schedulingConflict();
  return reservationIds;
};

export const updateDeliveryScheduleOccurrence = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryId: string;
    driverProfileId: string;
    expectedStatus: DeliveryStatus;
    nextStatus?: DeliveryStatus;
  },
) => {
  const updated = await tx.delivery.updateMany({
    where: {
      id: input.deliveryId,
      status: input.expectedStatus,
      assignedDriverProfileId: input.driverProfileId,
      assignments: {
        some: { driverProfileId: input.driverProfileId, status: 'ACTIVE' },
      },
    },
    data: {
      ...(input.nextStatus ? { status: input.nextStatus } : {}),
      scheduleOccurrence: { increment: 1 },
      learnerDeliveryHandoverTokenHash: null,
      learnerDeliveryHandoverTokenIssuedAt: null,
      learnerDeliveryHandoverTokenExpiresAt: null,
    },
  });
  if (updated.count !== 1) throw schedulingConflict();

  return tx.delivery.findUniqueOrThrow({
    where: { id: input.deliveryId },
    select: { scheduleOccurrence: true },
  });
};
