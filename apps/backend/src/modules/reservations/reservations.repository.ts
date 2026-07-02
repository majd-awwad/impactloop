import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  ACTIVE_HOLD_STATUSES,
  decimalToNumber,
  getMaterialQuantityState,
  isPositiveDecimal,
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
  toDecimal,
} from './reservations.quantity.js';

const reservationInclude = {
  material: {
    select: {
      id: true,
      title: true,
      status: true,
      unit: true,
      quantity: true,
    },
  },
  requester: {
    select: {
      id: true,
      displayName: true,
    },
  },
  owner: {
    select: {
      id: true,
      displayName: true,
    },
  },
} satisfies Prisma.ReservationInclude;

const learnerReservationListInclude = {
  material: {
    select: {
      id: true,
      title: true,
      materialType: true,
      customMaterialType: true,
      status: true,
      unit: true,
      deliveryAllowed: true,
      location: {
        select: {
          country: true,
          city: true,
          area: true,
          addressLine: true,
          latitude: true,
          longitude: true,
          isApproximate: true,
        },
      },
      images: {
        select: {
          imageUrl: true,
          isCover: true,
          sortOrder: true,
        },
        orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
        take: 1,
      },
    },
  },
  owner: {
    select: {
      id: true,
      displayName: true,
      supplierProfile: {
        select: {
          publicName: true,
          organizationProfile: {
            select: {
              organizationName: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ReservationInclude;

const learnerCancelInclude = {
  material: {
    select: {
      id: true,
      title: true,
      status: true,
      unit: true,
      quantity: true,
    },
  },
} satisfies Prisma.ReservationInclude;

export type LearnerReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

export type LearnerReservationListRecord = Prisma.ReservationGetPayload<{
  include: typeof learnerReservationListInclude;
}>;

export type LearnerCancelledReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof learnerCancelInclude;
}>;

export const findLearnerReservations = async (requesterId: string) => {
  return prisma.reservation.findMany({
    where: { requesterId },
    include: learnerReservationListInclude,
    orderBy: { createdAt: 'desc' },
  });
};

export const createLearnerReservation = async (input: {
  requesterId: string;
  materialId: string;
  quantityRequested: number;
  message?: string;
}) => {
  return runSerializableTransaction(async (tx) => {
    const material = await tx.material.findUnique({
      where: { id: input.materialId },
      select: {
        id: true,
        ownerId: true,
        status: true,
      },
    });

    if (!material) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (material.ownerId === input.requesterId) {
      return { outcome: 'SELF_RESERVATION' as const };
    }

    if (material.status === 'UNAVAILABLE' || material.status === 'REUSED') {
      return { outcome: 'UNAVAILABLE' as const };
    }

    const quantityState = await getMaterialQuantityState(tx, material.id);

    if (!quantityState) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const requestedQuantity = toDecimal(input.quantityRequested);

    if (!isPositiveDecimal(requestedQuantity)) {
      return {
        outcome: 'INVALID_QUANTITY' as const,
        availableQuantity: decimalToNumber(quantityState.availableQuantity),
      };
    }

    if (requestedQuantity.gt(quantityState.availableQuantity)) {
      return {
        outcome: 'INVALID_QUANTITY' as const,
        availableQuantity: decimalToNumber(quantityState.availableQuantity),
      };
    }

    const openLearnerReservationCount = await tx.reservation.count({
      where: {
        materialId: material.id,
        requesterId: input.requesterId,
        status: { in: [...ACTIVE_HOLD_STATUSES] },
      },
    });

    if (openLearnerReservationCount > 0) {
      return { outcome: 'OPEN_RESERVATION_EXISTS' as const };
    }

    const message = input.message?.trim() || null;

    const reservation = await tx.reservation.create({
      data: {
        materialId: material.id,
        requesterId: input.requesterId,
        ownerId: material.ownerId,
        quantityRequested: requestedQuantity,
        message,
        status: 'PENDING',
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: null,
        newStatus: 'PENDING',
        changedBy: input.requesterId,
        note: 'Reservation requested by learner',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, material.id);

    const updatedReservation = await tx.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      include: reservationInclude,
    });

    return { outcome: 'CREATED' as const, reservation: updatedReservation };
  });
};

export const cancelLearnerReservation = async (input: {
  requesterId: string;
  reservationId: string;
}) => {
  return runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        requesterId: input.requesterId,
      },
    });

    if (!existing) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (existing.status !== 'PENDING') {
      return { outcome: 'INVALID_STATUS' as const, status: existing.status };
    }

    const deliveryCount = await tx.delivery.count({
      where: { reservationId: existing.id },
    });

    if (deliveryCount > 0) {
      return { outcome: 'DELIVERY_EXISTS' as const };
    }

    const now = new Date();

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
      },
      include: learnerCancelInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'PENDING',
        newStatus: 'CANCELLED',
        changedBy: input.requesterId,
        note: 'Cancelled by learner',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { outcome: 'CANCELLED' as const, reservation };
  });
};
