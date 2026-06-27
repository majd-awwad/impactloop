import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

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
      deliveryAllowed: true,
      location: {
        select: {
          city: true,
          area: true,
        },
      },
      images: {
        where: { isCover: true },
        take: 1,
        orderBy: { sortOrder: 'asc' as const },
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

export type LearnerReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

export type LearnerReservationListRecord = Prisma.ReservationGetPayload<{
  include: typeof learnerReservationListInclude;
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
  return prisma.$transaction(async (tx) => {
    const material = await tx.material.findUnique({
      where: { id: input.materialId },
      select: {
        id: true,
        ownerId: true,
        quantity: true,
        status: true,
      },
    });

    if (!material) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (material.ownerId === input.requesterId) {
      return { outcome: 'SELF_RESERVATION' as const };
    }

    const materialQuantity =
      typeof material.quantity === 'number'
        ? material.quantity
        : material.quantity.toNumber();

    if (
      input.quantityRequested <= 0 ||
      input.quantityRequested > materialQuantity
    ) {
      return {
        outcome: 'INVALID_QUANTITY' as const,
        availableQuantity: materialQuantity,
      };
    }

    if (material.status !== 'AVAILABLE') {
      return { outcome: 'UNAVAILABLE' as const };
    }

    const activeReservationCount = await tx.reservation.count({
      where: {
        materialId: material.id,
        status: { in: ['PENDING', 'ACCEPTED', 'COMPLETED'] },
      },
    });

    if (activeReservationCount > 0) {
      return { outcome: 'ACTIVE_RESERVATION_EXISTS' as const };
    }

    const materialUpdate = await tx.material.updateMany({
      where: {
        id: material.id,
        status: 'AVAILABLE',
      },
      data: {
        status: 'PENDING_RESERVATION',
      },
    });

    if (materialUpdate.count !== 1) {
      return { outcome: 'UNAVAILABLE' as const };
    }

    const message = input.message?.trim() || null;

    const reservation = await tx.reservation.create({
      data: {
        materialId: material.id,
        requesterId: input.requesterId,
        ownerId: material.ownerId,
        quantityRequested: input.quantityRequested,
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

    return { outcome: 'CREATED' as const, reservation };
  });
};
