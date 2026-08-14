import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import { resolvePayableOrdersForReservationCheckout } from './payments.checkout-session.js';
import {
  buildActionablePaymentEventKey,
  type DeliveryObligationFingerprintPart,
} from './payments.notification-fingerprint.js';import { moneyDecimalToString, toMoneyDecimal } from './payments.money.js';
import { isElectronicPaymentEnforced } from './payments.policy.js';

export type ActionablePaymentNotificationSnapshot = {
  reservationId: string;
  requesterId: string;
  fulfillmentMethod: 'PICKUP' | 'DELIVERY';
  materialTitle: string;
  currency: string;
  totalAmount: string;
  materialAmount: string | null;
  deliveryFeeAmount: string | null;
  materialOutstanding: boolean;
  deliveryFeeOutstanding: boolean;
  eventKey: string;
};

const materialTitle = (title: string | null | undefined) =>
  title?.trim() || 'your material';

const sumOrderAmounts = (orders: Array<{ amount: Prisma.Decimal }>) =>  moneyDecimalToString(
    orders.reduce(
      (sum, order) => sum.add(toMoneyDecimal(order.amount)),
      toMoneyDecimal(0),
    ),
  );

export const buildActionablePaymentNotificationSnapshot = async (
  reservationId: string,
): Promise<ActionablePaymentNotificationSnapshot | null> => {
  if (!isElectronicPaymentEnforced()) {
    return null;
  }

  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      requesterId: true,
      fulfillmentMethod: true,
      paymentMethod: true,
      deliveryGroupId: true,
      material: { select: { title: true } },
    },
  });

  if (
    !reservation ||
    reservation.status !== 'ACCEPTED' ||
    reservation.paymentMethod !== 'CARD'
  ) {
    return null;
  }

  let resolved;
  try {
    resolved = await resolvePayableOrdersForReservationCheckout(
      prisma,
      reservation.id,
      reservation.requesterId,
    );
  } catch {
    return null;
  }

  if (resolved.orders.length === 0) {
    return null;
  }

  const orderDetails = await prisma.paymentOrder.findMany({
    where: { id: { in: resolved.orders.map((order) => order.id) } },
    select: {
      id: true,
      purpose: true,
      cycleNumber: true,
      reservationId: true,
      amount: true,
    },
  });
  const orderById = new Map(orderDetails.map((order) => [order.id, order]));

  const materialOrders = resolved.orders.filter(
    (order) => order.purpose === 'MATERIAL_SUBTOTAL',
  );
  const feeOrders = resolved.orders.filter(
    (order) => order.purpose === 'DELIVERY_FEE',
  );
  const materialOutstanding = materialOrders.length > 0;
  const deliveryFeeOutstanding = feeOrders.length > 0;

  const materialAmount = materialOutstanding
    ? sumOrderAmounts(materialOrders)
    : null;
  const deliveryFeeAmount = deliveryFeeOutstanding
    ? sumOrderAmounts(feeOrders)
    : null;
  const totalAmount = sumOrderAmounts(resolved.orders);

  const fingerprintParts: DeliveryObligationFingerprintPart[] = resolved.orders
    .map((order) => orderById.get(order.id))
    .filter((order): order is NonNullable<typeof order> => order != null)
    .map((order) => ({
      purpose: order.purpose as DeliveryObligationFingerprintPart['purpose'],
      paymentOrderId: order.id,
      cycleNumber: order.cycleNumber,
    }));

  return {
    reservationId: reservation.id,
    requesterId: reservation.requesterId,
    fulfillmentMethod: reservation.fulfillmentMethod,
    materialTitle: materialTitle(reservation.material.title),
    currency: resolved.currency,
    totalAmount,
    materialAmount,
    deliveryFeeAmount,
    materialOutstanding,
    deliveryFeeOutstanding,
    eventKey: buildActionablePaymentEventKey({
      reservationId: reservation.id,
      parts: fingerprintParts,
    }),
  };
};

export const hasActionableCardPaymentForReservation = async (
  reservationId: string,
): Promise<boolean> =>
  (await buildActionablePaymentNotificationSnapshot(reservationId)) != null;

export const buildAggregatedPaymentRequiredBody = (
  snapshot: ActionablePaymentNotificationSnapshot,
): string => {
  const totalLabel = `${snapshot.totalAmount} ${snapshot.currency}`;

  if (snapshot.materialOutstanding && snapshot.deliveryFeeOutstanding) {
    return `Your reservation is ready for payment. Total: ${totalLabel} including materials and delivery.`;
  }

  if (snapshot.deliveryFeeOutstanding && !snapshot.materialOutstanding) {
    return `Your reservation is ready for payment. Total: ${totalLabel} including delivery.`;
  }

  if (snapshot.fulfillmentMethod === 'PICKUP') {
    return `Your reservation is ready for payment. Total: ${totalLabel} for ${snapshot.materialTitle} before pickup. Your pickup code stays hidden until payment is complete.`;
  }

  return `Your reservation is ready for payment. Total: ${totalLabel} including materials.`;
};
