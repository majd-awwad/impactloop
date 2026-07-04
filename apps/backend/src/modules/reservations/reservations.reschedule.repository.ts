import { prisma } from '../../database/prisma.js';
import {
  assertRescheduleAllowedOutsideHandover,
  clearPendingRescheduleFields,
} from './reservation-reschedule.js';
import { recomputeAndUpdateMaterialStatus } from './reservations.quantity.js';

const learnerRescheduleInclude = {
  material: true,
  _count: {
    select: {
      deliveries: true,
    },
  },
} as const;

export const requestLearnerPickupReschedule = async (input: {
  requesterId: string;
  reservationId: string;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  reason: string;
  note?: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        requesterId: input.requesterId,
      },
      include: learnerRescheduleInclude,
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const, reservation: existing };
    }

    if (existing.fulfillmentMethod !== 'PICKUP' || existing._count.deliveries > 0) {
      return { conflict: true as const, reservation: existing };
    }

    const phaseCheck = assertRescheduleAllowedOutsideHandover({
      pickupWindowStart: existing.pickupWindowStart,
      pickupWindowEnd: existing.pickupWindowEnd,
    });

    if (!phaseCheck.ok) {
      return { duringHandover: true as const, reservation: existing };
    }

    const reason = input.reason.trim();
    const note = input.note?.trim() || null;

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'AWAITING_SUPPLIER_CONFIRMATION',
        learnerProposedPickupWindowStart: input.pickupWindowStart,
        learnerProposedPickupWindowEnd: input.pickupWindowEnd,
        supplierProposedPickupWindowStart: null,
        supplierProposedPickupWindowEnd: null,
        pendingRescheduleRequestedBy: 'LEARNER',
        pendingRescheduleReason: reason,
        pendingRescheduleNote: note,
      },
      include: learnerRescheduleInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
        changedBy: input.requesterId,
        note: `Learner requested reschedule: ${reason}`,
      },
    });

    if (note) {
      await tx.reservationMessage.create({
        data: {
          reservationId: reservation.id,
          senderUserId: input.requesterId,
          body: note,
        },
      });
    }

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const, reservation };
  });
};

export const cancelLearnerRescheduleRequest = async (input: {
  requesterId: string;
  reservationId: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        requesterId: input.requesterId,
      },
      include: learnerRescheduleInclude,
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'AWAITING_SUPPLIER_CONFIRMATION') {
      return { conflict: true as const, reservation: existing };
    }

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        rejectionReason: 'Learner cancelled after reschedule request',
        ...clearPendingRescheduleFields(),
      },
      include: learnerRescheduleInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
        newStatus: 'CANCELLED',
        changedBy: input.requesterId,
        note: 'Learner cancelled after reschedule request',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const, reservation };
  });
};
