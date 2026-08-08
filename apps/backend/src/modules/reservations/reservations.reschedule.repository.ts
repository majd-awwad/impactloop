import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';
import {
  assertRescheduleAllowedOutsideHandover,
  clearPendingRescheduleFields,
} from './reservation-reschedule.js';
import { recomputeAndUpdateMaterialStatus } from './reservations.quantity.js';
import { applyBuildReservationSyncInTransaction } from '../learning-projects/learning-projects.build-reservation-sync.js';
import {
  flushPostCommitPaymentRefunds,
  handleReservationPaymentLifecycleTransition,
} from '../payments/payments.lifecycle.js';
import { formatReservationHistoryNote } from './reservation-status-history.js';

const learnerRescheduleExistingSelect = {
  id: true,
  status: true,
  fulfillmentMethod: true,
  pickupWindowStart: true,
  pickupWindowEnd: true,
  materialId: true,
  _count: {
    select: {
      deliveries: true,
    },
  },
} satisfies Prisma.ReservationSelect;

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
      select: learnerRescheduleExistingSelect,
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'ACCEPTED') {
      return { conflict: true as const };
    }

    if (existing.fulfillmentMethod !== 'PICKUP' || existing._count.deliveries > 0) {
      return { conflict: true as const };
    }

    const phaseCheck = assertRescheduleAllowedOutsideHandover({
      pickupWindowStart: existing.pickupWindowStart,
      pickupWindowEnd: existing.pickupWindowEnd,
    });

    if (!phaseCheck.ok) {
      return { duringHandover: true as const };
    }

    const reason = input.reason.trim();
    const note = input.note?.trim() || null;

    await tx.reservation.update({
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
      select: { id: true },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: existing.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
        changedBy: input.requesterId,
        note: formatReservationHistoryNote('LEARNER_REQUESTED_RESCHEDULE', {
          reasonText: reason,
        }),
      },
    });

    if (note) {
      await tx.reservationMessage.create({
        data: {
          reservationId: existing.id,
          senderUserId: input.requesterId,
          body: note,
        },
      });
    }

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { conflict: false as const };
  });
};

export const cancelLearnerRescheduleRequest = async (input: {
  requesterId: string;
  reservationId: string;
}) => {
  const result = await runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        requesterId: input.requesterId,
      },
      select: learnerRescheduleExistingSelect,
    });

    if (!existing) {
      return null;
    }

    if (existing.status !== 'AWAITING_SUPPLIER_CONFIRMATION') {
      return { conflict: true as const };
    }

    await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        rejectionReason: 'Learner cancelled after reschedule request',
        ...clearPendingRescheduleFields(),
      },
      select: { id: true },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: existing.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
        newStatus: 'CANCELLED',
        changedBy: input.requesterId,
        note: formatReservationHistoryNote('LEARNER_CANCELLED_AFTER_RESCHEDULE'),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);
    await applyBuildReservationSyncInTransaction(tx, existing.id);

    const payment = await handleReservationPaymentLifecycleTransition(tx, {
      reservationId: existing.id,
      newStatus: 'CANCELLED',
      actorUserId: input.requesterId,
      reason: 'Learner cancelled after reschedule request',
    });

    return {
      conflict: false as const,
      postCommitRefunds: payment.postCommitRefunds,
      postCommitResolution: payment.postCommitResolution ?? null,
    };
  });

  if (result && result.conflict === false) {
    await flushPostCommitPaymentRefunds(
      result.postCommitRefunds,
      result.postCommitResolution,
    );
  }

  return result;
};
