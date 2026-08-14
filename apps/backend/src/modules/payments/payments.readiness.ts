import type {
  PaymentOrderStatus,
  PaymentCollectionMethod,
  Prisma,
  ReservationStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import { isPositiveMoney, toMoneyDecimal } from './payments.money.js';
import { isElectronicPaymentEnforced } from './payments.policy.js';

export type PaymentReadinessStatus =
  | 'PAYMENT_DISABLED'
  | 'NOT_REQUIRED'
  | 'NOT_YET_PAYABLE'
  | 'AWAITING_GROUP_CONFIRMATION'
  | 'REQUIRES_PAYMENT'
  | 'PROCESSING'
  | 'PAID'
  | 'REFUND_PENDING'
  | 'TERMINAL_OR_INVALID'
  | 'INVARIANT_VIOLATION';

export type ObligationReadiness = {
  status: PaymentReadinessStatus;
  paymentOrderId: string | null;
  purpose: 'MATERIAL_SUBTOTAL' | 'DELIVERY_FEE' | null;
  amount: string | null;
  currency: string | null;
  cycleNumber: number | null;
  paymentMethod: PaymentCollectionMethod;
  ready: boolean;
  fulfillmentReady: boolean;
  dueAtHandover: boolean;
};

export type PickupPaymentReadiness = ObligationReadiness & {
  reservationId: string;
};

export type DeliveryGroupPaymentReadiness = {
  deliveryGroupId: string;
  overallReady: boolean;
  overallPaymentReady: boolean;
  overallFulfillmentReady: boolean;
  overallStatus: PaymentReadinessStatus;
  fee: ObligationReadiness;
  materials: Array<
    ObligationReadiness & {
      reservationId: string;
    }
  >;
  awaitingConfirmationReservationIds: string[];
  outstandingReservationIds: string[];
  outstandingPaymentOrderIds: string[];
  invariantViolations: string[];
};

const ACTIVE_GROUP_RESERVATION_STATUSES = [
  'ACCEPTED',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
] as const satisfies readonly ReservationStatus[];

const resolveTx = (tx?: Prisma.TransactionClient) => tx ?? prisma;

const mapOrderStatus = (status: PaymentOrderStatus): PaymentReadinessStatus => {
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
    case 'CANCELLED':
      return 'TERMINAL_OR_INVALID';
    default:
      return 'TERMINAL_OR_INVALID';
  }
};

const orderReadiness = (
  paymentMethod: PaymentCollectionMethod,
  status: PaymentReadinessStatus,
) => ({
  ready: status === 'PAID',
  fulfillmentReady:
    status === 'PAID' ||
    (paymentMethod === 'CASH' && status === 'REQUIRES_PAYMENT'),
  dueAtHandover:
    paymentMethod === 'CASH' && status === 'REQUIRES_PAYMENT',
});

const findCurrentMaterialOrder = (
  tx: Prisma.TransactionClient | typeof prisma,
  reservationId: string,
) =>
  tx.paymentOrder.findFirst({
    where: {
      purpose: 'MATERIAL_SUBTOTAL',
      reservationId,
    },
    orderBy: { cycleNumber: 'desc' },
  });

const findCurrentFeeOrder = (
  tx: Prisma.TransactionClient | typeof prisma,
  deliveryGroupId: string,
) =>
  tx.paymentOrder.findFirst({
    where: {
      purpose: 'DELIVERY_FEE',
      deliveryGroupId,
    },
    orderBy: { cycleNumber: 'desc' },
  });

export const evaluatePickupPaymentReadiness = async (
  reservationId: string,
  txClient?: Prisma.TransactionClient,
): Promise<PickupPaymentReadiness> => {
  const tx = resolveTx(txClient);

  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      materialSubtotal: true,
      pricingCurrency: true,
      status: true,
      paymentMethod: true,
    },
  });

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (reservation.paymentMethod === 'CARD' && !isElectronicPaymentEnforced()) {
    return {
      reservationId,
      status: 'PAYMENT_DISABLED',
      paymentOrderId: null,
      purpose: null,
      amount: null,
      currency: null,
      cycleNumber: null,
      paymentMethod: 'CARD',
      ready: true,
      fulfillmentReady: true,
      dueAtHandover: false,
    };
  }

  const amount = toMoneyDecimal(reservation.materialSubtotal ?? 0);
  if (!isPositiveMoney(amount)) {
    return {
      reservationId,
      status: 'NOT_REQUIRED',
      paymentOrderId: null,
      purpose: null,
      amount: null,
      currency: null,
      cycleNumber: null,
      paymentMethod: reservation.paymentMethod,
      ready: true,
      fulfillmentReady: true,
      dueAtHandover: false,
    };
  }

  const order = await findCurrentMaterialOrder(tx, reservationId);
  if (!order) {
    const finallyAccepted = reservation.status === 'ACCEPTED';
    return {
      reservationId,
      status: finallyAccepted ? 'INVARIANT_VIOLATION' : 'NOT_YET_PAYABLE',
      paymentOrderId: null,
      purpose: 'MATERIAL_SUBTOTAL',
      amount: amount.toFixed(2),
      currency: reservation.pricingCurrency ?? 'NIS',
      cycleNumber: null,
      paymentMethod: reservation.paymentMethod,
      ready: false,
      fulfillmentReady: false,
      dueAtHandover: false,
    };
  }

  const status = mapOrderStatus(order.status);
  const readiness = orderReadiness(order.paymentMethod, status);
  return {
    reservationId,
    status,
    paymentOrderId: order.id,
    purpose: 'MATERIAL_SUBTOTAL',
    amount: order.amount.toFixed(2),
    currency: order.currency,
    cycleNumber: order.cycleNumber,
    paymentMethod: order.paymentMethod,
    ...readiness,
  };
};

export const evaluateDeliveryGroupPaymentReadiness = async (
  deliveryGroupId: string,
  txClient?: Prisma.TransactionClient,
): Promise<DeliveryGroupPaymentReadiness> => {
  const tx = resolveTx(txClient);

  const group = await tx.deliveryGroup.findUnique({
    where: { id: deliveryGroupId },
    select: {
      id: true,
      deliveryFee: true,
      currency: true,
      paymentMethod: true,
      reservations: {
        where: {
          status: { in: [...ACTIVE_GROUP_RESERVATION_STATUSES] },
          fulfillmentMethod: 'DELIVERY',
        },
        select: {
          id: true,
          status: true,
          materialSubtotal: true,
          pricingCurrency: true,
          paymentMethod: true,
        },
      },
    },
  });

  if (!group) {
    throw new AppError('Delivery group not found.', 404, 'NOT_FOUND');
  }

  if (group.paymentMethod === 'CARD' && !isElectronicPaymentEnforced()) {
    return {
      deliveryGroupId,
      overallReady: true,
      overallPaymentReady: true,
      overallFulfillmentReady: true,
      overallStatus: 'PAYMENT_DISABLED',
      fee: {
        status: 'PAYMENT_DISABLED', paymentOrderId: null, purpose: null,
        amount: null, currency: null, cycleNumber: null,
        paymentMethod: 'CARD', ready: true, fulfillmentReady: true,
        dueAtHandover: false,
      },
      materials: [], awaitingConfirmationReservationIds: [],
      outstandingReservationIds: [], outstandingPaymentOrderIds: [],
      invariantViolations: [],
    };
  }

  const invariantViolations: string[] = [];
  const outstandingReservationIds: string[] = [];
  const outstandingPaymentOrderIds: string[] = [];

  const feeAmount = toMoneyDecimal(group.deliveryFee);
  let fee: ObligationReadiness;
  if (!isPositiveMoney(feeAmount)) {
    fee = {
      status: 'NOT_REQUIRED',
      paymentOrderId: null,
      purpose: null,
      amount: null,
      currency: null,
      cycleNumber: null,
      paymentMethod: group.paymentMethod,
      ready: true,
      fulfillmentReady: true,
      dueAtHandover: false,
    };
  } else {
    const order = await findCurrentFeeOrder(tx, group.id);
    if (!order) {
      fee = {
        status: 'INVARIANT_VIOLATION',
        paymentOrderId: null,
        purpose: 'DELIVERY_FEE',
        amount: feeAmount.toFixed(2),
        currency: group.currency,
        cycleNumber: null,
        paymentMethod: group.paymentMethod,
        ready: false,
        fulfillmentReady: false,
        dueAtHandover: false,
      };
      invariantViolations.push(
        `Missing DELIVERY_FEE PaymentOrder for group ${group.id}`,
      );
    } else {
      const status = mapOrderStatus(order.status);
      const readiness = orderReadiness(order.paymentMethod, status);
      fee = {
        status,
        paymentOrderId: order.id,
        purpose: 'DELIVERY_FEE',
        amount: order.amount.toFixed(2),
        currency: order.currency,
        cycleNumber: order.cycleNumber,
        paymentMethod: order.paymentMethod,
        ...readiness,
      };
      if (!fee.ready && order.id) {
        outstandingPaymentOrderIds.push(order.id);
      }
    }
  }

  // Material obligations: finally ACCEPTED reservations only for payment checks.
  // Policy A: any active awaiting-confirmation member blocks dispatch.
  const awaiting = group.reservations.filter(
    (row) =>
      row.status === 'AWAITING_LEARNER_CONFIRMATION' ||
      row.status === 'AWAITING_SUPPLIER_CONFIRMATION',
  );
  const awaitingConfirmationReservationIds = awaiting.map((row) => row.id);

  const accepted = group.reservations.filter((row) => row.status === 'ACCEPTED');
  const materials: DeliveryGroupPaymentReadiness['materials'] = [];

  for (const reservation of accepted) {
    const amount = toMoneyDecimal(reservation.materialSubtotal ?? 0);
    if (!isPositiveMoney(amount)) {
      materials.push({
        reservationId: reservation.id,
        status: 'NOT_REQUIRED',
        paymentOrderId: null,
        purpose: null,
        amount: null,
        currency: null,
        cycleNumber: null,
        paymentMethod: reservation.paymentMethod,
        ready: true,
        fulfillmentReady: true,
        dueAtHandover: false,
      });
      continue;
    }

    const order = await findCurrentMaterialOrder(tx, reservation.id);
    if (!order) {
      materials.push({
        reservationId: reservation.id,
        status: 'INVARIANT_VIOLATION',
        paymentOrderId: null,
        purpose: 'MATERIAL_SUBTOTAL',
        amount: amount.toFixed(2),
        currency: reservation.pricingCurrency ?? 'NIS',
        cycleNumber: null,
        paymentMethod: reservation.paymentMethod,
        ready: false,
        fulfillmentReady: false,
        dueAtHandover: false,
      });
      outstandingReservationIds.push(reservation.id);
      invariantViolations.push(
        `Missing MATERIAL_SUBTOTAL PaymentOrder for reservation ${reservation.id}`,
      );
      continue;
    }

    const status = mapOrderStatus(order.status);
    const readiness = orderReadiness(order.paymentMethod, status);
    const ready = readiness.ready;
    materials.push({
      reservationId: reservation.id,
      status,
      paymentOrderId: order.id,
      purpose: 'MATERIAL_SUBTOTAL',
      amount: order.amount.toFixed(2),
      currency: order.currency,
      cycleNumber: order.cycleNumber,
      paymentMethod: order.paymentMethod,
      ...readiness,
    });
    if (!ready) {
      outstandingReservationIds.push(reservation.id);
      outstandingPaymentOrderIds.push(order.id);
    }
  }

  const overallPaymentReady =
    fee.ready &&
    materials.every((row) => row.ready) &&
    awaitingConfirmationReservationIds.length === 0 &&
    invariantViolations.length === 0;
  const overallFulfillmentReady =
    fee.fulfillmentReady &&
    materials.every((row) => row.fulfillmentReady) &&
    awaitingConfirmationReservationIds.length === 0 &&
    invariantViolations.length === 0;
  const overallReady = overallFulfillmentReady;

  let overallStatus: PaymentReadinessStatus = 'PAID';
  if (invariantViolations.length > 0) {
    overallStatus = 'INVARIANT_VIOLATION';
  } else if (awaitingConfirmationReservationIds.length > 0) {
    overallStatus = 'AWAITING_GROUP_CONFIRMATION';
  } else if (!overallPaymentReady) {
    if (
      fee.status === 'PROCESSING' ||
      materials.some((row) => row.status === 'PROCESSING')
    ) {
      overallStatus = 'PROCESSING';
    } else if (
      fee.status === 'REFUND_PENDING' ||
      materials.some((row) => row.status === 'REFUND_PENDING')
    ) {
      overallStatus = 'REFUND_PENDING';
    } else if (
      !isPositiveMoney(feeAmount) &&
      materials.every((row) => row.status === 'NOT_REQUIRED')
    ) {
      overallStatus = 'NOT_REQUIRED';
    } else {
      overallStatus = 'REQUIRES_PAYMENT';
    }
  } else if (
    !isPositiveMoney(feeAmount) &&
    materials.every((row) => row.status === 'NOT_REQUIRED')
  ) {
    overallStatus = 'NOT_REQUIRED';
  }

  return {
    deliveryGroupId,
    overallReady,
    overallPaymentReady,
    overallFulfillmentReady,
    overallStatus,
    fee,
    materials,
    awaitingConfirmationReservationIds,
    outstandingReservationIds,
    outstandingPaymentOrderIds,
    invariantViolations,
  };
};

export const assertPickupPaymentSatisfiedOrThrow = async (
  reservationId: string,
  txClient?: Prisma.TransactionClient,
) => {
  const readiness = await evaluatePickupPaymentReadiness(
    reservationId,
    txClient,
  );

  if (readiness.status === 'INVARIANT_VIOLATION') {
    throw new AppError(
      'Payment obligation is missing for an accepted paid reservation.',
      500,
      'PAYMENT_ORDER_MISSING',
      { reservationId },
    );
  }

  if (!readiness.fulfillmentReady) {
    const code =
      readiness.status === 'REFUND_PENDING'
        ? 'REFUND_IN_PROGRESS'
        : readiness.status === 'TERMINAL_OR_INVALID'
          ? 'PAYMENT_ORDER_CANCELLED'
          : 'PAYMENT_REQUIRED';
    throw new AppError(
      readiness.status === 'REFUND_PENDING'
        ? 'Payment refund is in progress; pickup cannot be completed.'
        : readiness.status === 'TERMINAL_OR_INVALID'
          ? 'Payment order is cancelled or refunded; pickup cannot be completed.'
          : 'Payment is required before pickup can be completed.',
      409,
      code,
      {
        reservationId,
        paymentOrderId: readiness.paymentOrderId,
        paymentStatus: readiness.status,
        purpose: readiness.purpose,
      },
    );
  }

  return readiness;
};

export const assertDeliveryGroupPaymentReadyOrThrow = async (
  deliveryGroupId: string,
  txClient?: Prisma.TransactionClient,
) => {
  const readiness = await evaluateDeliveryGroupPaymentReadiness(
    deliveryGroupId,
    txClient,
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

  if (!readiness.overallFulfillmentReady) {
    throw new AppError(
      'Delivery cannot dispatch until all payment obligations are satisfied.',
      409,
      'DELIVERY_PAYMENT_NOT_READY',
      {
        deliveryGroupId,
        outstandingReservationIds: readiness.outstandingReservationIds,
        outstandingPaymentOrderIds: readiness.outstandingPaymentOrderIds,
        overallStatus: readiness.overallStatus,
      },
    );
  }

  return readiness;
};

/** Alias for callers that prefer PAYMENT_NOT_SATISFIED naming. */
export const assertPaymentSatisfiedOrThrow = assertPickupPaymentSatisfiedOrThrow;
