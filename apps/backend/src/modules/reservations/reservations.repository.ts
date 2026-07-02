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

export const findLearnerReservationById = async (
  requesterId: string,
  reservationId: string,
) => {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      requesterId,
    },
    include: learnerReservationListInclude,
  });
};

export const createLearnerReservation = async (input: {
  requesterId: string;
  materialId: string;
  quantityRequested: number;
  message?: string;
  fulfillmentMethod: 'PICKUP' | 'DELIVERY';
  learnerPreferredPickupWindows?: { start: string; end: string }[];
  learnerPreferredDeliveryWindows?: { start: string; end: string }[];
  deliveryAddressText?: string;
  safeDropoffAllowed?: boolean;
  deliveryNote?: string;
}) => {
  return runSerializableTransaction(async (tx) => {
    const material = await tx.material.findUnique({
      where: { id: input.materialId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        pickupAllowed: true,
        deliveryAllowed: true,
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

    if (input.fulfillmentMethod === 'PICKUP' && !material.pickupAllowed) {
      return { outcome: 'PICKUP_NOT_ALLOWED' as const };
    }

    if (input.fulfillmentMethod === 'DELIVERY' && !material.deliveryAllowed) {
      return { outcome: 'DELIVERY_NOT_ALLOWED' as const };
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
    const deliveryNote = input.deliveryNote?.trim() || null;

    const reservation = await tx.reservation.create({
      data: {
        materialId: material.id,
        requesterId: input.requesterId,
        ownerId: material.ownerId,
        quantityRequested: requestedQuantity,
        message,
        fulfillmentMethod: input.fulfillmentMethod,
        learnerPreferredPickupWindows:
          input.fulfillmentMethod === 'PICKUP'
            ? input.learnerPreferredPickupWindows
            : null,
        learnerPreferredDeliveryWindows:
          input.fulfillmentMethod === 'DELIVERY'
            ? input.learnerPreferredDeliveryWindows
            : null,
        deliveryAddressText:
          input.fulfillmentMethod === 'DELIVERY'
            ? input.deliveryAddressText?.trim() ?? null
            : null,
        safeDropoffAllowed:
          input.fulfillmentMethod === 'DELIVERY'
            ? input.safeDropoffAllowed ?? null
            : null,
        deliveryNote:
          input.fulfillmentMethod === 'DELIVERY' ? deliveryNote : null,
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
