import { Prisma, type ReservationStatus } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

const deliveryBlocksSupplierCompleteStatuses = [
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'DELIVERED',
] as const;

const isPrismaCode = (error: unknown, code: string) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === code;

const runSerializableTransaction = async <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (attempt < maxAttempts && isPrismaCode(error, 'P2034')) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to complete transaction.');
};

const reservationInclude = {
  material: {
    include: {
      category: { select: { nameEn: true } },
      images: {
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
  requester: {
    select: {
      id: true,
      displayName: true,
      profileImageUrl: true,
    },
  },
} satisfies Prisma.ReservationInclude;

export type SupplierReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

export const findSupplierReservations = async (
  ownerId: string,
  status?: ReservationStatus,
) => {
  return prisma.reservation.findMany({
    where: {
      ownerId,
      ...(status ? { status } : {}),
    },
    include: reservationInclude,
    orderBy: { createdAt: 'desc' },
  });
};

export const findSupplierReservationForOwner = async (
  ownerId: string,
  reservationId: string,
) => {
  return prisma.reservation.findFirst({
    where: {
      id: reservationId,
      ownerId,
    },
    include: reservationInclude,
  });
};

export const acceptSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  supplierNote?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'PENDING') {
      return { conflict: true as const, reservation: existing };
    }

    const supplierNote = input.supplierNote?.trim() || null;

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'ACCEPTED',
        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
        supplierNote,
        acceptedAt: new Date(),
      },
      include: reservationInclude,
    });

    await tx.material.update({
      where: { id: existing.materialId },
      data: {
        status: 'RESERVED',
      },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'PENDING',
        newStatus: 'ACCEPTED',
        changedBy: input.ownerId,
        note: supplierNote ?? 'Accepted by supplier',
      },
    });

    return { conflict: false as const, reservation };
  });
};

export const declineSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  reason?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'PENDING') {
      return { conflict: true as const, reservation: existing };
    }

    const reason = input.reason?.trim() || null;

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        rejectedAt: new Date(),
      },
      include: reservationInclude,
    });

    const activeReservationCount = await tx.reservation.count({
      where: {
        materialId: existing.materialId,
        status: { in: ['PENDING', 'ACCEPTED', 'COMPLETED'] },
      },
    });

    if (activeReservationCount === 0) {
      await tx.material.update({
        where: { id: existing.materialId },
        data: {
          status: 'AVAILABLE',
        },
      });
    }

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'PENDING',
        newStatus: 'REJECTED',
        changedBy: input.ownerId,
        note: reason,
      },
    });

    return { conflict: false as const, reservation };
  });
};

export const completeSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
}) => {
  return runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const, reservation: existing };
    }

    const blockingDeliveryCount = await tx.delivery.count({
      where: {
        reservationId: existing.id,
        status: { in: [...deliveryBlocksSupplierCompleteStatuses] },
      },
    });

    if (blockingDeliveryCount > 0) {
      return { conflict: true as const, reservation: existing };
    }

    const now = new Date();

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
        changedBy: input.ownerId,
        note: 'Pickup completed by supplier',
      },
    });

    await tx.material.update({
      where: { id: existing.materialId },
      data: {
        status: 'REUSED',
        reusedAt: now,
        reusedByReservationId: reservation.id,
      },
    });

    return { conflict: false as const, reservation };
  });
};
