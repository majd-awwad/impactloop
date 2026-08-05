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
import { afterFinalAcceptanceInTransaction } from '../payments/payments.acceptance.js';
import { applyBuildReservationSyncInTransaction } from '../learning-projects/learning-projects.build-reservation-sync.js';

const learnerConfirmationExistingSelect = {
  id: true,
  status: true,
  fulfillmentMethod: true,
  materialId: true,
  requesterId: true,
  deliveryGroupId: true,
  deliveryAddressText: true,
  dropoffCity: true,
  dropoffArea: true,
  deliveryNote: true,
  supplierProposedPickupWindowStart: true,
  supplierProposedPickupWindowEnd: true,
  supplierPickupWindowStart: true,
  supplierPickupWindowEnd: true,
  _count: {
    select: {
      deliveries: true,
    },
  },
  material: {
    select: {
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
    },
  },
} satisfies Prisma.ReservationSelect;

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
      select: learnerConfirmationExistingSelect,
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
      await tx.reservation.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
        },
        select: { id: true },
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: existing.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'AWAITING_LEARNER_CONFIRMATION',
          newStatus: 'CANCELLED',
          changedBy: input.requesterId,
          note: 'Cancelled by learner while awaiting confirmation',
        },
      });

      await recomputeAndUpdateMaterialStatus(tx, existing.materialId);
      await applyBuildReservationSyncInTransaction(tx, existing.id);

      return { outcome: 'CANCELLED' as const };
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

      await tx.reservation.update({
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
        select: { id: true },
      });

      await afterFinalAcceptanceInTransaction(tx, {
        reservationId: existing.id,
      });

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: existing.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'AWAITING_LEARNER_CONFIRMATION',
          newStatus: 'ACCEPTED',
          changedBy: input.requesterId,
          note: 'Learner accepted supplier proposed pickup window',
        },
      });

      await recomputeAndUpdateMaterialStatus(tx, existing.materialId);
      await applyBuildReservationSyncInTransaction(tx, existing.id);

      return { outcome: 'ACCEPTED' as const };
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

    await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'ACCEPTED',
        confirmedDeliveryWindowStart: feasible.confirmed.start,
        confirmedDeliveryWindowEnd: feasible.confirmed.end,
        earliestDeliveryStart: feasible.earliestDeliveryStart,
        schedulingConflictReason: null,
      },
      select: { id: true },
    });

    await afterFinalAcceptanceInTransaction(tx, {
      reservationId: existing.id,
      ensureDelivery: {
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
      },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: existing.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_LEARNER_CONFIRMATION',
        newStatus: 'ACCEPTED',
        changedBy: input.requesterId,
        note: 'Learner confirmed feasible delivery window',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { outcome: 'ACCEPTED' as const };
  });
};
