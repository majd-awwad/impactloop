import type { Prisma } from '../../generated/prisma/client.js';

import {
  findFeasibleDeliveryWindow,
  type PreferredWindow,
} from '../supplier-reservations/supplier-reservation-scheduling.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
  decimalToNumber,
} from './reservations.quantity.js';
import {
  buildSelfPickupCodeData,
  ensureSelfPickupCodeStored,
} from '../../utils/handover-codes.js';
import { ensureDeliveryForAcceptedReservation } from '../delivery-groups/delivery-group-operations.service.js';

const learnerConfirmationInclude = {
  material: {
    include: {
      location: true,
    },
  },
  _count: {
    select: {
      deliveries: true,
    },
  },
} satisfies Prisma.ReservationInclude;

export type LearnerConfirmationReservationRecord = Prisma.ReservationGetPayload<{
  include: typeof learnerConfirmationInclude;
}>;

export const resolveLearnerConfirmation = async (input: {
  requesterId: string;
  reservationId: string;
  action: 'ACCEPT_PROPOSED_PICKUP' | 'SUBMIT_DELIVERY_WINDOW' | 'CANCEL';
  deliveryWindow?: PreferredWindow;
}) => {
  return runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        requesterId: input.requesterId,
      },
      include: learnerConfirmationInclude,
    });

    if (!existing) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (existing.status !== 'AWAITING_LEARNER_CONFIRMATION') {
      return { outcome: 'INVALID_STATUS' as const };
    }

    if (input.action === 'CANCEL') {
      if (existing._count.deliveries > 0) {
        return { outcome: 'DELIVERY_EXISTS' as const };
      }

      const now = new Date();
      const reservation = await tx.reservation.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        },
        include: learnerConfirmationInclude,
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'AWAITING_LEARNER_CONFIRMATION',
          newStatus: 'CANCELLED',
          changedBy: input.requesterId,
          note: 'Cancelled by learner while awaiting confirmation',
        },
      });

      await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

      return { outcome: 'CANCELLED' as const, reservation };
    }

    if (input.action === 'ACCEPT_PROPOSED_PICKUP') {
      if (existing.fulfillmentMethod !== 'PICKUP') {
        return { outcome: 'INVALID_ACTION' as const };
      }

      if (
        !existing.supplierProposedPickupWindowStart ||
        !existing.supplierProposedPickupWindowEnd
      ) {
        return { outcome: 'MISSING_PROPOSED_PICKUP' as const };
      }

      if (existing._count.deliveries > 0) {
        return { outcome: 'DELIVERY_EXISTS' as const };
      }

      const pickupCodeData = await buildSelfPickupCodeData(existing.id);

      const reservation = await tx.reservation.update({
        where: { id: existing.id },
        data: {
          status: 'ACCEPTED',
          pickupWindowStart: existing.supplierProposedPickupWindowStart,
          pickupWindowEnd: existing.supplierProposedPickupWindowEnd,
          supplierProposedPickupWindowStart: null,
          supplierProposedPickupWindowEnd: null,
          schedulingConflictReason: null,
          pendingRescheduleRequestedBy: null,
          pendingRescheduleReason: null,
          pendingRescheduleNote: null,
          learnerProposedPickupWindowStart: null,
          learnerProposedPickupWindowEnd: null,
          ...pickupCodeData.data,
        },
        include: learnerConfirmationInclude,
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'AWAITING_LEARNER_CONFIRMATION',
          newStatus: 'ACCEPTED',
          changedBy: input.requesterId,
          note: 'Learner accepted supplier proposed pickup window',
        },
      });

      await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

      return { outcome: 'ACCEPTED' as const, reservation };
    }

    if (input.action !== 'SUBMIT_DELIVERY_WINDOW') {
      return { outcome: 'INVALID_ACTION' as const };
    }

    if (
      !existing.supplierPickupWindowStart ||
      !existing.supplierPickupWindowEnd
    ) {
      return { outcome: 'MISSING_SUPPLIER_PICKUP' as const };
    }

    if (!existing.deliveryAddressText?.trim()) {
      return { outcome: 'MISSING_DELIVERY_ADDRESS' as const };
    }

    if (existing._count.deliveries > 0) {
      return { outcome: 'DELIVERY_EXISTS' as const };
    }

    if (!input.deliveryWindow) {
      return { outcome: 'MISSING_DELIVERY_WINDOW' as const };
    }

    const feasible = findFeasibleDeliveryWindow(
      existing.supplierPickupWindowEnd,
      [input.deliveryWindow],
    );

    if (!feasible) {
      return {
        outcome: 'INFEASIBLE_DELIVERY_WINDOW' as const,
        reason:
          'The selected delivery window is not feasible after the supplier pickup window and delivery buffer.',
      };
    }

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'ACCEPTED',
        confirmedDeliveryWindowStart: feasible.confirmed.start,
        confirmedDeliveryWindowEnd: feasible.confirmed.end,
        earliestDeliveryStart: feasible.earliestDeliveryStart,
        schedulingConflictReason: null,
      },
      include: learnerConfirmationInclude,
    });

    await ensureDeliveryForAcceptedReservation(tx, {
      reservation: {
        id: existing.id,
        requesterId: input.requesterId,
        deliveryGroupId: existing.deliveryGroupId,
        deliveryAddressText: existing.deliveryAddressText,
        dropoffCity: existing.dropoffCity,
        dropoffArea: existing.dropoffArea,
        deliveryNote: existing.deliveryNote,
        material: existing.material,
      },
      changedByUserId: input.requesterId,
      statusHistoryNote:
        'Delivery created when learner confirmed delivery window',
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_LEARNER_CONFIRMATION',
        newStatus: 'ACCEPTED',
        changedBy: input.requesterId,
        note: 'Learner confirmed feasible delivery window',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    const updated = await tx.reservation.findFirstOrThrow({
      where: { id: existing.id },
      include: {
        ...learnerConfirmationInclude,
        deliveries: {
          select: { id: true, status: true },
          orderBy: { requestedAt: 'desc' },
          take: 1,
        },
      },
    });

    return { outcome: 'ACCEPTED' as const, reservation: updated };
  });
};