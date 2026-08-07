import { prisma } from '../../database/prisma.js';
import { isWithinAllowedHandoverRange } from '../../utils/handover-timing.js';

import { isPayablePaymentOrderStatus } from './payments.constants.js';
import { moneyDecimalToString, toMoneyDecimal } from './payments.money.js';
import { classifyReservationPaymentLifecycle } from './payments.lifecycle.policy.js';
import { isElectronicPaymentEnforced } from './payments.policy.js';

/**
 * Compact server-derived payment summary for learner reservation list cards.
 * No provider metadata, attempt tokens, or pickup codes.
 */
export type ReservationPaymentListSummary = {
  enforcementEnabled: boolean;
  overallStatus: string;
  outstandingOrderCount: number;
  outstandingAmount: string | null;
  currency: string | null;
  hasMaterialPaymentOutstanding: boolean;
  hasDeliveryFeeOutstanding: boolean;
  checkoutableOrderId: string | null;
  fulfillmentReady: boolean;
  pickupCodeAvailable: boolean;
  deliveryDispatchable: boolean;
};

export type ReservationPaymentListSummaryInput = {
  id: string;
  status: string;
  fulfillmentMethod: 'PICKUP' | 'DELIVERY' | string;
  materialSubtotal: unknown;
  deliveryFee: unknown;
  pricingCurrency: string | null;
  deliveryGroupId: string | null;
  deliveryStatus: string | null;
  assignedDriverProfileId: string | null;
  pickupWindowStart?: Date | string | null;
  pickupWindowEnd?: Date | string | null;
};

/**
 * Pickup-code visibility window gate.
 *
 * When a confirmed pickup window exists, the code is available only inside the
 * allowed handover range (window ± early/grace). Missing windows do not block
 * (legacy fixtures / incomplete rows) — payment readiness remains the other gate.
 */
export const isPickupCodeVisibilityWindowOpen = (
  pickupWindowStart: Date | string | null | undefined,
  pickupWindowEnd: Date | string | null | undefined,
  now: Date = new Date(),
): boolean => {
  if (pickupWindowStart == null || pickupWindowEnd == null) {
    return true;
  }

  const start =
    pickupWindowStart instanceof Date
      ? pickupWindowStart
      : new Date(pickupWindowStart);
  const end =
    pickupWindowEnd instanceof Date
      ? pickupWindowEnd
      : new Date(pickupWindowEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return true;
  }

  return isWithinAllowedHandoverRange(now, start, end);
};

type OrderRow = {
  id: string;
  reservationId: string | null;
  deliveryGroupId: string | null;
  purpose: string;
  status: string;
  amount: { toFixed: (n: number) => string };
  currency: string;
  cycleNumber: number;
};

const DISPATCHABLE_DELIVERY_STATUSES = new Set(['WAITING_FOR_DRIVER']);

const unpaidStatuses = new Set(['REQUIRES_PAYMENT', 'CHECKOUT_PENDING']);

const mapOrderReadiness = (status: string): string => {
  switch (status) {
    case 'PAID':
      return 'PAID';
    case 'REQUIRES_PAYMENT':
      return 'REQUIRES_PAYMENT';
    case 'CHECKOUT_PENDING':
      return 'PROCESSING';
    case 'REFUND_PENDING':
      return 'REFUND_PENDING';
    case 'REFUNDED':
      return 'REFUNDED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'TERMINAL_OR_INVALID';
  }
};

const isPositiveAmount = (value: unknown): boolean => {
  try {
    return toMoneyDecimal(value as never).gt(0);
  } catch {
    return false;
  }
};

const addAmounts = (a: string | null, b: string | null): string | null => {
  if (a == null && b == null) return null;
  const total = toMoneyDecimal(a ?? 0).add(toMoneyDecimal(b ?? 0));
  return moneyDecimalToString(total);
};

/**
 * Batch-resolve payment summaries for a learner reservation list.
 * Uses at most two PaymentOrder queries (materials + fees), never per-row.
 */
export const resolvePaymentSummariesByReservations = async (
  reservations: ReservationPaymentListSummaryInput[],
): Promise<Map<string, ReservationPaymentListSummary>> => {
  const result = new Map<string, ReservationPaymentListSummary>();
  if (reservations.length === 0) {
    return result;
  }

  const enforcement = isElectronicPaymentEnforced();

  if (!enforcement) {
    for (const reservation of reservations) {
      const accepted = reservation.status === 'ACCEPTED';
      const pickup = reservation.fulfillmentMethod === 'PICKUP';
      const windowOpen = isPickupCodeVisibilityWindowOpen(
        reservation.pickupWindowStart,
        reservation.pickupWindowEnd,
      );
      const deliveryDispatchable =
        accepted &&
        reservation.fulfillmentMethod === 'DELIVERY' &&
        reservation.deliveryStatus != null &&
        DISPATCHABLE_DELIVERY_STATUSES.has(reservation.deliveryStatus) &&
        reservation.assignedDriverProfileId == null;

      result.set(reservation.id, {
        enforcementEnabled: false,
        overallStatus: 'PAYMENT_DISABLED',
        outstandingOrderCount: 0,
        outstandingAmount: null,
        currency: reservation.pricingCurrency,
        hasMaterialPaymentOutstanding: false,
        hasDeliveryFeeOutstanding: false,
        checkoutableOrderId: null,
        fulfillmentReady: accepted,
        pickupCodeAvailable: accepted && pickup && windowOpen,
        deliveryDispatchable,
      });
    }
    return result;
  }

  // PAY-05D: reads must not mutate. Report invariant without creating groups/orders.
  // Historical malformed rows are healed via reconcile CLI / command paths only.
  const reservationIds = reservations.map((r) => r.id);
  const groupIds = [
    ...new Set(
      reservations
        .map((r) => r.deliveryGroupId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  ];

  const [materialOrders, feeOrders] = await Promise.all([
    prisma.paymentOrder.findMany({
      where: {
        purpose: 'MATERIAL_SUBTOTAL',
        reservationId: { in: reservationIds },
      },
      orderBy: [{ reservationId: 'asc' }, { cycleNumber: 'desc' }],
      select: {
        id: true,
        reservationId: true,
        deliveryGroupId: true,
        purpose: true,
        status: true,
        amount: true,
        currency: true,
        cycleNumber: true,
      },
    }),
    groupIds.length === 0
      ? Promise.resolve([] as OrderRow[])
      : prisma.paymentOrder.findMany({
          where: {
            purpose: 'DELIVERY_FEE',
            deliveryGroupId: { in: groupIds },
          },
          orderBy: [{ deliveryGroupId: 'asc' }, { cycleNumber: 'desc' }],
          select: {
            id: true,
            reservationId: true,
            deliveryGroupId: true,
            purpose: true,
            status: true,
            amount: true,
            currency: true,
            cycleNumber: true,
          },
        }),
  ]);

  const currentMaterialByReservation = new Map<string, OrderRow>();
  for (const order of materialOrders as OrderRow[]) {
    if (!order.reservationId) continue;
    if (!currentMaterialByReservation.has(order.reservationId)) {
      currentMaterialByReservation.set(order.reservationId, order);
    }
  }

  const currentFeeByGroup = new Map<string, OrderRow>();
  for (const order of feeOrders as OrderRow[]) {
    if (!order.deliveryGroupId) continue;
    if (!currentFeeByGroup.has(order.deliveryGroupId)) {
      currentFeeByGroup.set(order.deliveryGroupId, order);
    }
  }

  // Attribute shared delivery-fee amount once per group (primary payer =
  // reservation with positive deliveryFee). Joiners still see the flag + CTA.
  const primaryPayerByGroup = new Map<string, string>();
  for (const reservation of reservations) {
    if (!reservation.deliveryGroupId) continue;
    if (!isPositiveAmount(reservation.deliveryFee)) continue;
    if (!primaryPayerByGroup.has(reservation.deliveryGroupId)) {
      primaryPayerByGroup.set(reservation.deliveryGroupId, reservation.id);
    }
  }

  for (const reservation of reservations) {
    const materialOrder = currentMaterialByReservation.get(reservation.id);
    const feeOrder = reservation.deliveryGroupId
      ? currentFeeByGroup.get(reservation.deliveryGroupId) ?? null
      : null;

    const materialRequired = isPositiveAmount(reservation.materialSubtotal);
    const feeApplicable = reservation.deliveryGroupId != null;
    const feeRequired =
      feeApplicable &&
      (feeOrder != null
        ? isPositiveAmount(feeOrder.amount)
        : isPositiveAmount(reservation.deliveryFee));

    const materialOutstanding =
      materialRequired &&
      (materialOrder == null
        ? reservation.status === 'ACCEPTED'
        : unpaidStatuses.has(materialOrder.status));

    const feeOutstanding =
      feeRequired &&
      (feeOrder == null
        ? reservation.status === 'ACCEPTED'
        : unpaidStatuses.has(feeOrder.status));

    const materialAmount =
      materialOutstanding && materialOrder
        ? moneyDecimalToString(materialOrder.amount as never)
        : materialOutstanding
          ? moneyDecimalToString(
              toMoneyDecimal(reservation.materialSubtotal as never),
            )
          : null;

    const isFeePrimary =
      reservation.deliveryGroupId != null &&
      (primaryPayerByGroup.get(reservation.deliveryGroupId) === reservation.id ||
        !primaryPayerByGroup.has(reservation.deliveryGroupId));

    const feeAmount =
      feeOutstanding && feeOrder && isFeePrimary
        ? moneyDecimalToString(feeOrder.amount as never)
        : feeOutstanding && !feeOrder && isFeePrimary
          ? moneyDecimalToString(toMoneyDecimal(reservation.deliveryFee as never))
          : null;

    const outstandingAmount = addAmounts(materialAmount, feeAmount);
    const currency =
      materialOrder?.currency ??
      feeOrder?.currency ??
      reservation.pricingCurrency;

    let outstandingOrderCount = 0;
    if (materialOutstanding && materialOrder) outstandingOrderCount += 1;
    if (feeOutstanding && feeOrder) outstandingOrderCount += 1;
    if (materialOutstanding && !materialOrder) outstandingOrderCount += 1;
    if (feeOutstanding && !feeOrder && isFeePrimary) outstandingOrderCount += 1;

    const materialCheckoutable =
      reservation.status === 'ACCEPTED' &&
      materialOrder != null &&
      isPayablePaymentOrderStatus(materialOrder.status);
    const feeCheckoutable =
      reservation.status === 'ACCEPTED' &&
      feeOrder != null &&
      isPayablePaymentOrderStatus(feeOrder.status);

    const checkoutableOrderId = materialCheckoutable
      ? materialOrder!.id
      : feeCheckoutable
        ? feeOrder!.id
        : null;

    const materialReady =
      !materialRequired ||
      (materialOrder != null && materialOrder.status === 'PAID');
    const feeReady =
      !feeRequired || (feeOrder != null && feeOrder.status === 'PAID');
    const paymentReady = materialReady && feeReady;

    const accepted = reservation.status === 'ACCEPTED';
    const fulfillmentReady = accepted && paymentReady;
    const windowOpen = isPickupCodeVisibilityWindowOpen(
      reservation.pickupWindowStart,
      reservation.pickupWindowEnd,
    );
    const pickup =
      reservation.fulfillmentMethod === 'PICKUP' &&
      accepted &&
      paymentReady &&
      windowOpen;
    const deliveryDispatchable =
      fulfillmentReady &&
      reservation.fulfillmentMethod === 'DELIVERY' &&
      reservation.deliveryStatus != null &&
      DISPATCHABLE_DELIVERY_STATUSES.has(reservation.deliveryStatus) &&
      reservation.assignedDriverProfileId == null;

    const lifecycle = classifyReservationPaymentLifecycle(reservation.status);
    let overallStatus: string;

    const missingGroupInvariant =
      accepted &&
      reservation.fulfillmentMethod === 'DELIVERY' &&
      reservation.deliveryGroupId == null &&
      isPositiveAmount(reservation.deliveryFee);

    if (missingGroupInvariant) {
      overallStatus = 'INVARIANT_VIOLATION';
    } else if (lifecycle === 'PRE_FULFILLMENT_TERMINAL') {
      overallStatus =
        materialOrder?.status === 'REFUNDED'
          ? 'REFUNDED'
          : materialOrder?.status === 'REFUND_PENDING'
            ? 'REFUND_PENDING'
            : 'CANCELLED';
    } else if (lifecycle === 'RESOLUTION_REQUIRED') {
      overallStatus = 'RESOLUTION_REQUIRED';
    } else if (!accepted && reservation.status === 'PENDING') {
      overallStatus = materialRequired ? 'AWAITING_ACCEPTANCE' : 'NOT_REQUIRED';
    } else if (
      reservation.status === 'AWAITING_LEARNER_CONFIRMATION' ||
      reservation.status === 'AWAITING_SUPPLIER_CONFIRMATION'
    ) {
      overallStatus = 'AWAITING_ACCEPTANCE';
    } else if (materialOutstanding && feeOutstanding) {
      overallStatus = materialOrder?.status === 'CHECKOUT_PENDING'
        ? 'PROCESSING'
        : 'REQUIRES_PAYMENT';
    } else if (materialOutstanding) {
      overallStatus = mapOrderReadiness(materialOrder?.status ?? 'REQUIRES_PAYMENT');
      if (overallStatus === 'TERMINAL_OR_INVALID') {
        overallStatus = 'REQUIRES_PAYMENT';
      }
    } else if (feeOutstanding) {
      overallStatus = materialReady ? 'REQUIRES_PAYMENT' : mapOrderReadiness(
        feeOrder?.status ?? 'REQUIRES_PAYMENT',
      );
      // Partial: material settled, fee still due.
      if (materialReady && materialRequired) {
        overallStatus = 'REQUIRES_PAYMENT';
      }
    } else if (
      materialOrder?.status === 'REFUND_PENDING' ||
      feeOrder?.status === 'REFUND_PENDING'
    ) {
      overallStatus = 'REFUND_PENDING';
    } else if (
      materialOrder?.status === 'REFUNDED' ||
      feeOrder?.status === 'REFUNDED'
    ) {
      overallStatus = 'REFUNDED';
    } else if (paymentReady) {
      overallStatus = materialRequired || feeRequired ? 'PAID' : 'NOT_REQUIRED';
    } else if (
      accepted &&
      materialRequired &&
      materialOrder == null
    ) {
      overallStatus = 'BLOCKED';
    } else {
      overallStatus = 'NOT_REQUIRED';
    }

    // Mark partial when material paid and fee outstanding (or vice versa).
    if (
      accepted &&
      ((materialReady && materialRequired && feeOutstanding) ||
        (feeReady && feeRequired && materialOutstanding && materialRequired))
    ) {
      // Keep REQUIRES_PAYMENT for CTA; Flutter maps partial via flags.
      overallStatus = 'REQUIRES_PAYMENT';
    }

    result.set(reservation.id, {
      enforcementEnabled: true,
      overallStatus,
      outstandingOrderCount,
      outstandingAmount,
      currency,
      hasMaterialPaymentOutstanding: materialOutstanding,
      hasDeliveryFeeOutstanding: feeOutstanding,
      checkoutableOrderId,
      fulfillmentReady,
      pickupCodeAvailable: pickup,
      deliveryDispatchable,
    });
  }

  return result;
};
