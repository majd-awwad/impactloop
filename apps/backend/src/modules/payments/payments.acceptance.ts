import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { isPositiveMoney, toMoneyDecimal } from './payments.money.js';
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
 * Native DELIVERY without preferred windows can reach ACCEPTED with a priced
 * deliveryFee but no DeliveryGroup. Payment aggregation only treats fees as
 * applicable when deliveryGroupId is set, so attach a solo group from the
 * confirmed delivery window before ensuring PaymentOrders.
 */
export const ensureDeliveryGroupAttachedForAcceptedReservation = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
): Promise<string | null> => {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      deliveryGroupId: true,
      requesterId: true,
      deliveryFee: true,
      deliveryZone: true,
      pricingCurrency: true,
      deliveryAddressText: true,
      dropoffCity: true,
      dropoffArea: true,
      confirmedDeliveryWindowStart: true,
      confirmedDeliveryWindowEnd: true,
      material: {
        select: { supplierProfileId: true },
      },
    },
  });

  if (!reservation || reservation.status !== 'ACCEPTED') {
    return null;
  }

  if (reservation.fulfillmentMethod !== 'DELIVERY') {
    return null;
  }

  if (reservation.deliveryGroupId) {
    return reservation.deliveryGroupId;
  }

  const feeAmount = toMoneyDecimal(reservation.deliveryFee ?? 0);
  const supplierProfileId = reservation.material.supplierProfileId;
  const dropoffCity = reservation.dropoffCity?.trim() || null;
  const windowStart = reservation.confirmedDeliveryWindowStart;
  const windowEnd = reservation.confirmedDeliveryWindowEnd;

  if (!isPositiveMoney(feeAmount)) {
    // Free delivery: group is optional for fee collection.
    return null;
  }

  if (
    !supplierProfileId ||
    !dropoffCity ||
    !reservation.deliveryZone ||
    !windowStart ||
    !windowEnd ||
    !reservation.deliveryAddressText?.trim() ||
    !reservation.pricingCurrency?.trim()
  ) {
    throw new AppError(
      'Accepted delivery with a positive fee is missing required DeliveryGroup fields.',
      409,
      'PAYMENT_SOURCE_INVARIANT_VIOLATION',
      {
        reservationId,
        reason: 'MISSING_DELIVERY_GROUP_FIELDS',
        missing: {
          supplierProfileId: !supplierProfileId,
          dropoffCity: !dropoffCity,
          deliveryZone: !reservation.deliveryZone,
          confirmedDeliveryWindow: !windowStart || !windowEnd,
          deliveryAddressText: !reservation.deliveryAddressText?.trim(),
          pricingCurrency: !reservation.pricingCurrency?.trim(),
        },
      },
    );
  }

  const group = await tx.deliveryGroup.create({
    data: {
      learnerId: reservation.requesterId,
      supplierProfileId,
      dropoffCity,
      dropoffArea: reservation.dropoffArea,
      deliveryAddressText: reservation.deliveryAddressText,
      deliveryFee: feeAmount,
      currency: reservation.pricingCurrency ?? 'NIS',
      deliveryZone: reservation.deliveryZone,
      status: 'OPEN',
      windowStart,
      windowEnd,
    },
  });

  await tx.reservation.update({
    where: { id: reservation.id },
    data: { deliveryGroupId: group.id },
  });

  return group.id;
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

  await ensureDeliveryGroupAttachedForAcceptedReservation(tx, reservationId);

  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      deliveryGroupId: true,
      deliveryFee: true,
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

  let deliveryGroupId = input.reservation.deliveryGroupId;
  if (!deliveryGroupId && input.reservation.id) {
    deliveryGroupId = await ensureDeliveryGroupAttachedForAcceptedReservation(
      tx,
      input.reservation.id,
    );
  }

  if (deliveryGroupId) {
    const readiness = await evaluateDeliveryGroupPaymentReadiness(
      deliveryGroupId,
      tx,
    );

    if (readiness.invariantViolations.length > 0) {
      throw new AppError(
        'Payment obligations are incomplete for this delivery group.',
        500,
        'PAYMENT_SOURCE_INVARIANT_VIOLATION',
        {
          deliveryGroupId,
          violations: readiness.invariantViolations,
        },
      );
    }

    if (!readiness.overallReady) {
      return { createdOrExisting: false, deferred: true };
    }
  } else {
    // Ungrouped delivery is only allowed when there is no positive delivery fee
    // (free delivery / zero-fee). Material must still be paid.
    const material = await ensureMaterialPaymentOrder(input.reservation.id, tx);
    if (material.outcome === 'CREATED' || material.outcome === 'EXISTING') {
      if (material.order.status !== 'PAID') {
        return { createdOrExisting: false, deferred: true };
      }
    }
  }

  await ensureDeliveryForAcceptedReservation(tx, {
    ...input,
    reservation: {
      ...input.reservation,
      deliveryGroupId,
    },
  });
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

  const fresh = await tx.reservation.findUnique({
    where: { id: input.reservationId },
    select: { deliveryGroupId: true },
  });

  const result = await ensureDeliveryForAcceptedReservationIfPaymentReady(tx, {
    ...input.ensureDelivery,
    reservation: {
      ...input.ensureDelivery.reservation,
      deliveryGroupId:
        fresh?.deliveryGroupId ??
        input.ensureDelivery.reservation.deliveryGroupId,
    },
  });
  return { deliveryDeferred: result.deferred };
};
