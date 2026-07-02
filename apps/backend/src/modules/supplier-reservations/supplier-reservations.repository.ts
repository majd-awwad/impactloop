import {
  Prisma,
  type ReservationStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  applyReservationCompletionToMaterial,
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
} from '../reservations/reservations.quantity.js';
import { resolveReservationFollowUp } from '../reservations/reservation-follow-up.js';

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
  deliveries: {
    select: {
      id: true,
      status: true,
    },
    orderBy: { requestedAt: 'desc' as const },
    take: 1,
  },
  _count: {
    select: {
      deliveries: true,
    },
  },
  noShowReports: {
    select: {
      id: true,
      targetUserId: true,
      targetRole: true,
      status: true,
      reasonCode: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ReservationInclude;

export type SupplierReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationInclude;
}>;

export const supplierCanCompleteReservation = (input: {
  status: ReservationStatus;
  deliveryRequested: boolean;
  hasDelivery: boolean;
}) => {
  if (input.status !== 'ACCEPTED') {
    return false;
  }

  if (input.deliveryRequested || input.hasDelivery) {
    return false;
  }

  return true;
};

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

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

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

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

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

    const deliveryCount = await tx.delivery.count({
      where: { reservationId: existing.id },
    });

    if (existing.deliveryRequested || deliveryCount > 0) {
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

    await applyReservationCompletionToMaterial(tx, {
      materialId: existing.materialId,
      reservationId: reservation.id,
      quantityRequested: existing.quantityRequested,
      completedAt: now,
    });

    return { conflict: false as const, reservation };
  });
};

export const rescheduleSupplierReservation = async (input: {
  reservationId: string;
  ownerId: string;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  supplierNote?: string;
  followUpMessage?: string;
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

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const, reservation: existing };
    }

    const supplierNote = input.supplierNote?.trim() || existing.supplierNote;
    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
        supplierNote,
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'ACCEPTED',
        changedBy: input.ownerId,
        note: 'Pickup window rescheduled by supplier',
      },
    });

    if (input.followUpMessage?.trim()) {
      await tx.reservationMessage.create({
        data: {
          reservationId: reservation.id,
          senderUserId: input.ownerId,
          body: input.followUpMessage.trim(),
        },
      });
    }

    return { conflict: false as const, reservation };
  });
};

export const cancelSupplierAcceptedReservation = async (input: {
  reservationId: string;
  ownerId: string;
  reason?: string;
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

    const followUp = resolveReservationFollowUp({
      status: existing.status,
      pickupWindowStart: existing.pickupWindowStart,
      pickupWindowEnd: existing.pickupWindowEnd,
    });

    if (!followUp.isOverdue) {
      return { notOverdue: true as const, reservation: existing };
    }

    const deliveryCount = await tx.delivery.count({
      where: { reservationId: existing.id },
    });

    if (deliveryCount > 0 || existing.deliveryRequested) {
      return { deliveryBlocked: true as const, reservation: existing };
    }

    const now = new Date();
    const reason = input.reason?.trim() || 'Cancelled by supplier after overdue pickup window';

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        rejectionReason: reason,
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'CANCELLED',
        changedBy: input.ownerId,
        note: reason,
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const, reservation };
  });
};

export const createSupplierNoShowReport = async (input: {
  reservationId: string;
  ownerId: string;
  reasonCode: 'LEARNER_DID_NOT_ARRIVE' | 'DRIVER_DID_NOT_ARRIVE' | 'NO_RESPONSE_AFTER_PICKUP_WINDOW' | 'OTHER';
  note?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
      include: {
        deliveries: {
          select: {
            assignedDriverProfileId: true,
            assignedDriverProfile: {
              select: { userId: true },
            },
          },
          orderBy: { requestedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const };
    }

    const followUp = resolveReservationFollowUp({
      status: existing.status,
      pickupWindowStart: existing.pickupWindowStart,
      pickupWindowEnd: existing.pickupWindowEnd,
    });

    if (!followUp.isOverdue) {
      return { windowNotEnded: true as const };
    }

    const latestDelivery = existing.deliveries[0] ?? null;
    let targetUserId = existing.requesterId;
    let targetRole: 'LEARNER' | 'DRIVER' = 'LEARNER';

    if (existing.deliveryRequested || latestDelivery) {
      const driverUserId = latestDelivery?.assignedDriverProfile?.userId;
      if (driverUserId) {
        targetUserId = driverUserId;
        targetRole = 'DRIVER';
      } else if (input.reasonCode === 'DRIVER_DID_NOT_ARRIVE') {
        return { driverNotAssigned: true as const };
      }
    } else if (input.reasonCode === 'DRIVER_DID_NOT_ARRIVE') {
      return { driverNotAssigned: true as const };
    }

    const duplicate = await tx.noShowReport.findUnique({
      where: {
        reservationId_targetUserId: {
          reservationId: existing.id,
          targetUserId,
        },
      },
    });

    if (duplicate) {
      return { duplicate: true as const, report: duplicate };
    }

    const report = await tx.noShowReport.create({
      data: {
        reservationId: existing.id,
        reporterUserId: input.ownerId,
        targetUserId,
        targetRole,
        reasonCode: input.reasonCode,
        note: input.note?.trim() || null,
        pickupWindowStart: existing.pickupWindowStart,
        pickupWindowEnd: existing.pickupWindowEnd,
      },
    });

    return { report };
  });
};
