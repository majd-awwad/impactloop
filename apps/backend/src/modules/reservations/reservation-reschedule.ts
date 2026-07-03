import type { ReservationStatus } from '../../generated/prisma/client.js';
import {
  resolvePickupHandoverPhase,
  type PickupHandoverPhase,
} from '../../utils/handover-timing.js';

export type PendingRescheduleSummary = {
  requestedBy: 'SUPPLIER' | 'LEARNER' | null;
  reason: string | null;
  note: string | null;
  proposedPickupWindowStart: string | null;
  proposedPickupWindowEnd: string | null;
};

export const isSelfPickupReservation = (input: {
  fulfillmentMethod: string;
  deliveryRequested: boolean;
  deliveryCount: number;
}) =>
  input.fulfillmentMethod === 'PICKUP' &&
  !input.deliveryRequested &&
  input.deliveryCount === 0;

export const resolveSelfPickupHandoverPhase = (input: {
  status: ReservationStatus;
  pickupWindowStart: Date | null;
  pickupWindowEnd: Date | null;
  fulfillmentMethod: string;
  deliveryRequested: boolean;
  deliveryCount: number;
}): PickupHandoverPhase | null => {
  if (
    input.status !== 'ACCEPTED' ||
    !isSelfPickupReservation({
      fulfillmentMethod: input.fulfillmentMethod,
      deliveryRequested: input.deliveryRequested,
      deliveryCount: input.deliveryCount,
    })
  ) {
    return null;
  }

  return resolvePickupHandoverPhase(
    new Date(),
    input.pickupWindowStart,
    input.pickupWindowEnd,
  );
};

export const canRequestPickupReschedule = (input: {
  status: ReservationStatus;
  fulfillmentMethod: string;
  deliveryRequested: boolean;
  deliveryCount: number;
  pickupWindowStart: Date | null;
  pickupWindowEnd: Date | null;
  hasFinalReport: boolean;
}) => {
  if (input.hasFinalReport) {
    return false;
  }

  if (
    !isSelfPickupReservation({
      fulfillmentMethod: input.fulfillmentMethod,
      deliveryRequested: input.deliveryRequested,
      deliveryCount: input.deliveryCount,
    })
  ) {
    return false;
  }

  if (input.status === 'AWAITING_SUPPLIER_CONFIRMATION') {
    return false;
  }

  if (input.status !== 'ACCEPTED') {
    return false;
  }

  const phase = resolveSelfPickupHandoverPhase(input);
  return phase === 'BEFORE_ALLOWED' || phase === 'AFTER_ALLOWED';
};

export const assertRescheduleAllowedOutsideHandover = (input: {
  pickupWindowStart: Date | null;
  pickupWindowEnd: Date | null;
}) => {
  const phase = resolvePickupHandoverPhase(
    new Date(),
    input.pickupWindowStart,
    input.pickupWindowEnd,
  );

  if (phase === 'DURING_ALLOWED') {
    return { ok: false as const, reason: 'DURING_HANDOVER' as const };
  }

  if (phase !== 'BEFORE_ALLOWED' && phase !== 'AFTER_ALLOWED') {
    return { ok: false as const, reason: 'INVALID_PHASE' as const };
  }

  return { ok: true as const, phase };
};

export const mapPendingRescheduleSummary = (reservation: {
  status: ReservationStatus;
  pendingRescheduleRequestedBy: 'SUPPLIER' | 'LEARNER' | null;
  pendingRescheduleReason: string | null;
  pendingRescheduleNote: string | null;
  supplierProposedPickupWindowStart: Date | null;
  supplierProposedPickupWindowEnd: Date | null;
  learnerProposedPickupWindowStart: Date | null;
  learnerProposedPickupWindowEnd: Date | null;
}): PendingRescheduleSummary | null => {
  if (reservation.status === 'AWAITING_LEARNER_CONFIRMATION') {
    return {
      requestedBy: reservation.pendingRescheduleRequestedBy ?? 'SUPPLIER',
      reason: reservation.pendingRescheduleReason,
      note: reservation.pendingRescheduleNote,
      proposedPickupWindowStart:
        reservation.supplierProposedPickupWindowStart?.toISOString() ?? null,
      proposedPickupWindowEnd:
        reservation.supplierProposedPickupWindowEnd?.toISOString() ?? null,
    };
  }

  if (reservation.status === 'AWAITING_SUPPLIER_CONFIRMATION') {
    return {
      requestedBy: reservation.pendingRescheduleRequestedBy ?? 'LEARNER',
      reason: reservation.pendingRescheduleReason,
      note: reservation.pendingRescheduleNote,
      proposedPickupWindowStart:
        reservation.learnerProposedPickupWindowStart?.toISOString() ?? null,
      proposedPickupWindowEnd:
        reservation.learnerProposedPickupWindowEnd?.toISOString() ?? null,
    };
  }

  return null;
};

export const clearPendingRescheduleFields = () => ({
  supplierProposedPickupWindowStart: null,
  supplierProposedPickupWindowEnd: null,
  learnerProposedPickupWindowStart: null,
  learnerProposedPickupWindowEnd: null,
  pendingRescheduleRequestedBy: null,
  pendingRescheduleReason: null,
  pendingRescheduleNote: null,
  schedulingConflictReason: null,
});
