import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { isElectronicPaymentEnforced } from './payments.policy.js';
import { evaluateDeliveryGroupPaymentReadiness } from './payments.readiness.js';
import { ensureDeliveryForAcceptedReservation } from '../delivery-groups/delivery-group-operations.service.js';

/**
 * Test-only injector: throw inside obligation creation (still inside the
 * caller's acceptance transaction) so rollback can be asserted without
 * ESM export redefinition. Cleared via `undefined`.
 */
let obligationCreationFailureForTests: Error | undefined;

const isTestRuntime = (): boolean =>
  (process.env.NODE_ENV ?? '').trim() === 'test' ||
  Boolean(process.env.NODE_TEST_CONTEXT?.trim());

/** Force the next obligation ensure to throw. Pass `undefined` to clear. */
export const setObligationCreationFailureForTests = (
  error: Error | undefined,
): void => {
  if (!isTestRuntime()) {
    throw new Error(
      'setObligationCreationFailureForTests is only available in test runtime.',
    );
  }
  obligationCreationFailureForTests = error;
};

/**
 * After a Reservation reaches final ACCEPTED, ensure required PaymentOrders
 * from authoritative snapshots. No provider I/O.
 */
export const ensurePaymentObligationsForAcceptedReservation = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
): Promise<void> => {
  if (!isElectronicPaymentEnforced()) {
    return;
  }

  if (obligationCreationFailureForTests) {
    throw obligationCreationFailureForTests;
  }

  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      deliveryGroupId: true,
      materialSubtotal: true,
    },
  });

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (reservation.status !== 'ACCEPTED') {
    return;
  }

  const material = await ensureMaterialPaymentOrder(reservation.id, tx);
  if (material.outcome === 'NOT_FOUND') {
    throw new AppError(
      'Reservation disappeared while ensuring payment obligations.',
      500,
      'PAYMENT_SOURCE_INVARIANT_VIOLATION',
      { reservationId },
    );
  }

  if (reservation.fulfillmentMethod === 'DELIVERY' && reservation.deliveryGroupId) {
    const fee = await ensureDeliveryFeePaymentOrder(
      reservation.deliveryGroupId,
      tx,
    );
    if (fee.outcome === 'NOT_FOUND') {
      throw new AppError(
        'Delivery group disappeared while ensuring payment obligations.',
        500,
        'PAYMENT_SOURCE_INVARIANT_VIOLATION',
        { deliveryGroupId: reservation.deliveryGroupId },
      );
    }
  }
};

type DeliveryEnsureInput = Parameters<
  typeof ensureDeliveryForAcceptedReservation
>[1];

/**
 * Create operational Delivery only when payments are disabled or the group
 * (or ungrouped reservation) is payment-ready. Absence of Delivery is the gate.
 */
export const ensureDeliveryForAcceptedReservationIfPaymentReady = async (
  tx: Prisma.TransactionClient,
  input: DeliveryEnsureInput,
): Promise<{ createdOrExisting: boolean; deferred: boolean }> => {
  if (!isElectronicPaymentEnforced()) {
    await ensureDeliveryForAcceptedReservation(tx, input);
    return { createdOrExisting: true, deferred: false };
  }

  if (input.reservation.deliveryGroupId) {
    const readiness = await evaluateDeliveryGroupPaymentReadiness(
      input.reservation.deliveryGroupId,
      tx,
    );

    if (readiness.invariantViolations.length > 0) {
      throw new AppError(
        'Payment obligations are incomplete for this delivery group.',
        500,
        'PAYMENT_SOURCE_INVARIANT_VIOLATION',
        {
          deliveryGroupId: input.reservation.deliveryGroupId,
          violations: readiness.invariantViolations,
        },
      );
    }

    if (!readiness.overallReady) {
      return { createdOrExisting: false, deferred: true };
    }
  } else {
    // Ungrouped delivery: material obligation only.
    const material = await ensureMaterialPaymentOrder(input.reservation.id, tx);
    if (material.outcome === 'CREATED' || material.outcome === 'EXISTING') {
      if (material.order.status !== 'PAID') {
        return { createdOrExisting: false, deferred: true };
      }
    }
  }

  await ensureDeliveryForAcceptedReservation(tx, input);
  return { createdOrExisting: true, deferred: false };
};

/**
 * Shared post-accept hook: obligations + conditional delivery creation.
 */
export const afterFinalAcceptanceInTransaction = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    ensureDelivery?: DeliveryEnsureInput | null;
  },
): Promise<{ deliveryDeferred: boolean }> => {
  await ensurePaymentObligationsForAcceptedReservation(tx, input.reservationId);

  if (!input.ensureDelivery) {
    return { deliveryDeferred: false };
  }

  const result = await ensureDeliveryForAcceptedReservationIfPaymentReady(
    tx,
    input.ensureDelivery,
  );
  return { deliveryDeferred: result.deferred };
};
