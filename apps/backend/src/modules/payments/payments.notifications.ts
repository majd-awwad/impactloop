import { AppError } from '../../utils/app-error.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../observability/logger.js';
import { createNotification } from '../notifications/notifications.repository.js';

import { buildDeliveryDispatchReadyEventKey } from './payments.notification-fingerprint.js';
import { moneyDecimalToString, toMoneyDecimal } from './payments.money.js';
import { isElectronicPaymentEnforced } from './payments.policy.js';
import {
  evaluateDeliveryGroupPaymentReadiness,
  evaluatePickupPaymentReadiness,
} from './payments.readiness.js';

export const PAYMENT_NOTIFICATION_TYPES = {
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  PAYMENT_FULFILLMENT_READY: 'PAYMENT_FULFILLMENT_READY',
  PAYMENT_REFUND_REQUESTED: 'PAYMENT_REFUND_REQUESTED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  PAYMENT_REFUND_FAILED: 'PAYMENT_REFUND_FAILED',
  PAYMENT_LATE_SUCCESS_REFUND: 'PAYMENT_LATE_SUCCESS_REFUND',
  PAYMENT_NEW_CYCLE_REQUIRED: 'PAYMENT_NEW_CYCLE_REQUIRED',
  PAYMENT_RESOLUTION_REQUIRED: 'PAYMENT_RESOLUTION_REQUIRED',
} as const;

const notifySafely = async (
  operation: string,
  task: () => Promise<unknown>,
  context?: {
    paymentOrderId?: string | null;
    reservationId?: string | null;
    deliveryGroupId?: string | null;
  },
) => {
  try {
    await task();
  } catch (error) {
    const errorCode =
      error instanceof AppError
        ? error.code
        : error instanceof Error
          ? error.name
          : 'PAYMENT_NOTIFY_FAILED';
    const safeMessage =
      error instanceof Error
        ? error.message.slice(0, 200)
        : 'Payment notification failed';
    logger.error(
      {
        operation,
        errorCode,
        paymentOrderId: context?.paymentOrderId ?? undefined,
        reservationId: context?.reservationId ?? undefined,
        deliveryGroupId: context?.deliveryGroupId ?? undefined,
      },
      safeMessage,
    );
  }
};

const purposeLabelEn = (purpose: string) =>
  purpose === 'DELIVERY_FEE' ? 'delivery fee' : 'material payment';

const selectActiveDeliveryLinkReservation = async (input: {
  deliveryGroupId: string;
  payerUserId: string;
}): Promise<string | null> => {
  const member = await prisma.reservation.findFirst({
    where: {
      deliveryGroupId: input.deliveryGroupId,
      requesterId: input.payerUserId,
      status: 'ACCEPTED',
      fulfillmentMethod: 'DELIVERY',
    },
    orderBy: [{ acceptedAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  return member?.id ?? null;
};

const loadOrderContext = async (paymentOrderId: string) => {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: paymentOrderId },
    select: {
      id: true,
      payerUserId: true,
      purpose: true,
      status: true,
      amount: true,
      currency: true,
      cycleNumber: true,
      reservationId: true,
      deliveryGroupId: true,
      reservation: {
        select: {
          id: true,
          status: true,
          fulfillmentMethod: true,
          material: { select: { title: true } },
        },
      },
      deliveryGroup: {
        select: {
          id: true,
          learnerId: true,
        },
      },
      refund: { select: { id: true, status: true, reason: true } },
    },
  });
  return order;
};

const materialTitle = (title: string | null | undefined) =>
  title?.trim() || 'your material';

const linkReservationId = async (order: NonNullable<
  Awaited<ReturnType<typeof loadOrderContext>>
>): Promise<string | null> => {
  if (order.reservationId) {
    return order.reservationId;
  }
  if (!order.deliveryGroupId) {
    return null;
  }
  return selectActiveDeliveryLinkReservation({
    deliveryGroupId: order.deliveryGroupId,
    payerUserId: order.payerUserId,
  });
};

const baseMetadata = async (order: NonNullable<
  Awaited<ReturnType<typeof loadOrderContext>>
>) => ({
  paymentOrderId: order.id,
  paymentPurpose: order.purpose,
  paymentStatus: order.status,
  amount: moneyDecimalToString(toMoneyDecimal(order.amount)),
  currency: order.currency,
  cycleNumber: order.cycleNumber,
  reservationId: await linkReservationId(order),
  deliveryGroupId: order.deliveryGroupId,
});

const countOutstandingMaterialOrders = async (deliveryGroupId: string) =>
  prisma.paymentOrder.count({
    where: {
      purpose: 'MATERIAL_SUBTOTAL',
      reservation: {
        deliveryGroupId,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
      },
      status: { in: ['REQUIRES_PAYMENT', 'CHECKOUT_PENDING'] },
    },
  });

/**
 * After final ACCEPTED + obligations ensured (post-commit).
 * One notification per material order cycle and one per fee order cycle
 * (strict eventKey: payment:<orderId>:required). Never bundles a shared fee
 * into a reservation-specific key.
 */
export const notifyPaymentRequiredAfterAcceptance = async (
  reservationId: string,
) =>
  notifySafely(
    'payment_notify_required_after_acceptance',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          status: true,
          requesterId: true,
          fulfillmentMethod: true,
          deliveryGroupId: true,
          material: { select: { title: true } },
        },
      });

      if (!reservation || reservation.status !== 'ACCEPTED') {
        return;
      }

      const materialOrder = await prisma.paymentOrder.findFirst({
        where: {
          purpose: 'MATERIAL_SUBTOTAL',
          reservationId: reservation.id,
          status: { in: ['REQUIRES_PAYMENT', 'CHECKOUT_PENDING'] },
        },
        orderBy: { cycleNumber: 'desc' },
      });

      const feeOrder =
        reservation.fulfillmentMethod === 'DELIVERY' &&
        reservation.deliveryGroupId
          ? await prisma.paymentOrder.findFirst({
              where: {
                purpose: 'DELIVERY_FEE',
                deliveryGroupId: reservation.deliveryGroupId,
                status: { in: ['REQUIRES_PAYMENT', 'CHECKOUT_PENDING'] },
              },
              orderBy: { cycleNumber: 'desc' },
            })
          : null;

      if (!materialOrder && !feeOrder) {
        return;
      }

      const title = materialTitle(reservation.material.title);

      if (materialOrder) {
        await createNotification({
          userId: reservation.requesterId,
          notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
          title: 'Payment required',
          body:
            reservation.fulfillmentMethod === 'PICKUP'
              ? `Pay ${moneyDecimalToString(toMoneyDecimal(materialOrder.amount))} ${materialOrder.currency} for ${title} before pickup. Your pickup code stays hidden until payment is complete.`
              : `Pay ${moneyDecimalToString(toMoneyDecimal(materialOrder.amount))} ${materialOrder.currency} for ${title} before delivery can proceed.`,
          relatedEntityType: 'RESERVATION',
          relatedEntityId: reservation.id,
          entityType: 'RESERVATION',
          entityId: reservation.id,
          eventKey: `payment:${materialOrder.id}:required`,
          actionType: 'OPEN_RESERVATION',
          metadata: {
            paymentOrderId: materialOrder.id,
            paymentPurpose: 'MATERIAL_SUBTOTAL',
            paymentStatus: materialOrder.status,
            amount: moneyDecimalToString(toMoneyDecimal(materialOrder.amount)),
            currency: materialOrder.currency,
            cycleNumber: materialOrder.cycleNumber,
            reservationId: reservation.id,
            deliveryGroupId: reservation.deliveryGroupId,
            materialTitle: title,
            fulfillmentBlocked: true,
            materialOutstanding: true,
            deliveryFeeOutstanding: Boolean(feeOrder),
          },
        });
      }

      if (feeOrder && reservation.deliveryGroupId) {
        const outstandingMaterials = await countOutstandingMaterialOrders(
          reservation.deliveryGroupId,
        );
        const feeLinkReservationId =
          (await selectActiveDeliveryLinkReservation({
            deliveryGroupId: reservation.deliveryGroupId,
            payerUserId: reservation.requesterId,
          })) ?? reservation.id;
        await createNotification({
          userId: reservation.requesterId,
          notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
          title: 'Delivery fee required',
          body: `A delivery fee of ${moneyDecimalToString(toMoneyDecimal(feeOrder.amount))} ${feeOrder.currency} is required before your delivery request can be processed.`,
          relatedEntityType: 'RESERVATION',
          relatedEntityId: feeLinkReservationId,
          entityType: 'RESERVATION',
          entityId: feeLinkReservationId,
          eventKey: `payment:${feeOrder.id}:required`,
          actionType: 'OPEN_RESERVATION',
          metadata: {
            paymentOrderId: feeOrder.id,
            paymentPurpose: 'DELIVERY_FEE',
            paymentStatus: feeOrder.status,
            amount: moneyDecimalToString(toMoneyDecimal(feeOrder.amount)),
            currency: feeOrder.currency,
            cycleNumber: feeOrder.cycleNumber,
            reservationId: feeLinkReservationId,
            deliveryGroupId: reservation.deliveryGroupId,
            materialTitle: title,
            fulfillmentBlocked: true,
            materialOutstanding: outstandingMaterials > 0,
            outstandingMaterialCount: outstandingMaterials,
            deliveryFeeOutstanding: true,
          },
        });
      }
    },
    { reservationId },
  );

/**
 * Notify for specific newly created obligations after reconcile mutations.
 * Each order id is communicated at most once via its durable eventKey.
 */
export const notifyPaymentRequiredForCreatedOrders = async (input: {
  materialOrderIds: string[];
  feeOrderIds: string[];
}) => {
  const seen = new Set<string>();
  for (const orderId of [
    ...input.materialOrderIds,
    ...input.feeOrderIds,
  ]) {
    if (seen.has(orderId)) {
      continue;
    }
    seen.add(orderId);
    await notifyPaymentRequiredForOrder(orderId);
  }
};

export const notifyPaymentRequiredForOrder = async (paymentOrderId: string) =>
  notifySafely(
    'payment_notify_required_for_order',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const order = await prisma.paymentOrder.findUnique({
        where: { id: paymentOrderId },
        select: {
          id: true,
          purpose: true,
          status: true,
          amount: true,
          currency: true,
          cycleNumber: true,
          payerUserId: true,
          reservationId: true,
          deliveryGroupId: true,
        },
      });

      if (
        !order ||
        (order.status !== 'REQUIRES_PAYMENT' &&
          order.status !== 'CHECKOUT_PENDING')
      ) {
        return;
      }

      if (order.purpose === 'MATERIAL_SUBTOTAL' && order.reservationId) {
        await notifyPaymentRequiredAfterAcceptance(order.reservationId);
        return;
      }

      if (order.purpose === 'DELIVERY_FEE' && order.deliveryGroupId) {
        const linkId = await selectActiveDeliveryLinkReservation({
          deliveryGroupId: order.deliveryGroupId,
          payerUserId: order.payerUserId,
        });
        if (!linkId) {
          return;
        }
        await notifyPaymentRequiredAfterAcceptance(linkId);
      }
    },
    { paymentOrderId },
  );
export const notifyPaymentCompleted = async (paymentOrderId: string) =>
  notifySafely(
    'payment_notify_completed',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const order = await loadOrderContext(paymentOrderId);
      if (!order || order.status !== 'PAID') {
        return;
      }

      const reservationId = await linkReservationId(order);
      if (!reservationId) {
        return;
      }

      let outstandingCount = 0;
      let outstandingSameCurrency = true;
      let outstandingTotal = toMoneyDecimal(0);
      let outstandingCurrency: string | null = null;

      const accumulateOutstanding = (rows: Array<{
        ready: boolean;
        amount: string | null;
        currency: string | null;
      }>) => {
        const unpaid = rows.filter((row) => !row.ready);
        outstandingCount = unpaid.length;
        if (!unpaid.length) {
          return;
        }
        const currencies = new Set(
          unpaid.map((row) => row.currency).filter(Boolean) as string[],
        );
        if (currencies.size !== 1) {
          outstandingSameCurrency = false;
          outstandingCurrency = null;
          return;
        }
        outstandingCurrency = [...currencies][0]!;
        outstandingSameCurrency = true;
        outstandingTotal = unpaid.reduce(
          (sum, row) =>
            row.amount ? sum.add(toMoneyDecimal(row.amount)) : sum,
          toMoneyDecimal(0),
        );
      };

      if (order.purpose === 'MATERIAL_SUBTOTAL' && order.reservationId) {
        if (order.reservation?.fulfillmentMethod === 'DELIVERY') {
          const reservation = await prisma.reservation.findUnique({
            where: { id: order.reservationId },
            select: { deliveryGroupId: true },
          });
          if (reservation?.deliveryGroupId) {
            const group = await evaluateDeliveryGroupPaymentReadiness(
              reservation.deliveryGroupId,
            );
            if (!group.overallReady) {
              accumulateOutstanding([
                ...group.materials.map((m) => ({
                  ready: m.ready,
                  amount: m.amount,
                  currency: m.currency,
                })),
                {
                  ready: group.fee.ready,
                  amount: group.fee.amount,
                  currency: group.fee.currency,
                },
              ]);
            }
          }
        } else {
          const pickup = await evaluatePickupPaymentReadiness(order.reservationId);
          if (!pickup.ready && pickup.paymentOrderId) {
            accumulateOutstanding([
              {
                ready: false,
                amount: pickup.amount,
                currency: pickup.currency,
              },
            ]);
          }
        }
      } else if (order.purpose === 'DELIVERY_FEE' && order.deliveryGroupId) {
        const group = await evaluateDeliveryGroupPaymentReadiness(
          order.deliveryGroupId,
        );
        if (!group.overallReady) {
          accumulateOutstanding([
            ...group.materials.map((m) => ({
              ready: m.ready,
              amount: m.amount,
              currency: m.currency,
            })),
            {
              ready: group.fee.ready,
              amount: group.fee.amount,
              currency: group.fee.currency,
            },
          ]);
        }
      }

      const purpose = purposeLabelEn(order.purpose);
      const amount = moneyDecimalToString(toMoneyDecimal(order.amount));
      const title = materialTitle(order.reservation?.material.title);
      const moreRemain = outstandingCount > 0;
      const meta = await baseMetadata(order);

      await createNotification({
        userId: order.payerUserId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_COMPLETED,
        title: 'Payment received',
        body: moreRemain
          ? `We received your ${purpose} of ${amount} ${order.currency} for ${title}. Additional payment is still required before fulfillment can continue.`
          : `We received your ${purpose} of ${amount} ${order.currency} for ${title}.`,
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservationId,
        entityType: 'RESERVATION',
        entityId: reservationId,
        eventKey: `payment:${order.id}:paid`,
        actionType: 'OPEN_RESERVATION',
        metadata: {
          ...meta,
          materialTitle: title,
          outstandingCount,
          outstandingTotal:
            moreRemain && outstandingSameCurrency && outstandingCurrency
              ? moneyDecimalToString(outstandingTotal)
              : null,
          outstandingCurrency: outstandingSameCurrency
            ? outstandingCurrency
            : null,
          fulfillmentBlocked: moreRemain,
          morePaymentRequired: moreRemain,
        },
      });
    },
    { paymentOrderId },
  );

export const notifyFulfillmentUnlockedPickup = async (input: {
  reservationId: string;
  paymentOrderId: string;
  cycleNumber: number;
}) =>
  notifySafely(
    'payment_notify_pickup_unlocked',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const reservation = await prisma.reservation.findUnique({
        where: { id: input.reservationId },
        select: {
          id: true,
          status: true,
          requesterId: true,
          fulfillmentMethod: true,
          material: { select: { title: true } },
        },
      });

      if (
        !reservation ||
        reservation.status !== 'ACCEPTED' ||
        reservation.fulfillmentMethod !== 'PICKUP'
      ) {
        return;
      }

      const readiness = await evaluatePickupPaymentReadiness(reservation.id);
      if (!readiness.ready) {
        return;
      }

      await createNotification({
        userId: reservation.requesterId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_FULFILLMENT_READY,
        title: 'Pickup is available',
        body: `Payment for ${materialTitle(reservation.material.title)} is complete. You can now view the pickup code in your reservation details.`,
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservation.id,
        entityType: 'RESERVATION',
        entityId: reservation.id,
        eventKey: `reservation:${reservation.id}:pickup-unlocked:${input.cycleNumber}`,
        actionType: 'OPEN_RESERVATION',
        metadata: {
          reservationId: reservation.id,
          paymentOrderId: input.paymentOrderId,
          cycleNumber: input.cycleNumber,
          fulfillmentMethod: 'PICKUP',
          materialTitle: materialTitle(reservation.material.title),
        },
      });
    },
    {
      reservationId: input.reservationId,
      paymentOrderId: input.paymentOrderId,
    },
  );

export const notifyFulfillmentUnlockedDelivery = async (input: {
  deliveryGroupId: string;
  paymentOrderId: string;
}) =>
  notifySafely(
    'payment_notify_delivery_unlocked',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const readiness = await evaluateDeliveryGroupPaymentReadiness(
        input.deliveryGroupId,
      );
      if (!readiness.overallReady) {
        return;
      }

      const parts = [
        ...(readiness.fee.paymentOrderId && readiness.fee.cycleNumber != null
          ? [
              {
                purpose: 'DELIVERY_FEE' as const,
                paymentOrderId: readiness.fee.paymentOrderId,
                cycleNumber: readiness.fee.cycleNumber,
              },
            ]
          : []),
        ...readiness.materials
          .filter(
            (m) =>
              Boolean(m.paymentOrderId) &&
              m.cycleNumber != null &&
              m.purpose === 'MATERIAL_SUBTOTAL',
          )
          .map((m) => ({
            purpose: 'MATERIAL_SUBTOTAL' as const,
            paymentOrderId: m.paymentOrderId as string,
            cycleNumber: m.cycleNumber as number,
          })),
      ];

      const eventKey = buildDeliveryDispatchReadyEventKey({
        deliveryGroupId: input.deliveryGroupId,
        parts,
      });

      const group = await prisma.deliveryGroup.findUnique({
        where: { id: input.deliveryGroupId },
        select: { learnerId: true },
      });
      if (!group) {
        return;
      }

      const reservationId = await selectActiveDeliveryLinkReservation({
        deliveryGroupId: input.deliveryGroupId,
        payerUserId: group.learnerId,
      });
      if (!reservationId) {
        return;
      }

      const reservation = await prisma.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          requesterId: true,
          status: true,
          material: { select: { title: true } },
        },
      });
      if (!reservation || reservation.status !== 'ACCEPTED') {
        return;
      }

      await createNotification({
        userId: reservation.requesterId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_FULFILLMENT_READY,
        title: 'Delivery request ready',
        body: `Payment is complete for ${materialTitle(reservation.material.title)}. Your delivery request is ready to be processed.`,
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservation.id,
        entityType: 'RESERVATION',
        entityId: reservation.id,
        eventKey,
        actionType: 'OPEN_RESERVATION',
        metadata: {
          reservationId: reservation.id,
          deliveryGroupId: input.deliveryGroupId,
          paymentOrderId: input.paymentOrderId,
          fulfillmentMethod: 'DELIVERY',
          materialTitle: materialTitle(reservation.material.title),
          obligationFingerprint: eventKey.split(':').pop() ?? null,
        },
      });
    },
    {
      deliveryGroupId: input.deliveryGroupId,
      paymentOrderId: input.paymentOrderId,
    },
  );

export const notifyRefundRequested = async (paymentOrderId: string) =>
  notifySafely(
    'payment_notify_refund_requested',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const order = await loadOrderContext(paymentOrderId);
      if (!order || order.status !== 'REFUND_PENDING') {
        return;
      }

      if (
        order.refund?.reason === 'LATE_SUCCESS_AFTER_SOURCE_TERMINAL' ||
        order.refund?.reason === 'LATE_SUCCESS_RESOLUTION_REQUIRED'
      ) {
        return;
      }

      const reservationId = await linkReservationId(order);
      if (!reservationId) {
        return;
      }

      const amount = moneyDecimalToString(toMoneyDecimal(order.amount));
      const meta = await baseMetadata(order);
      await createNotification({
        userId: order.payerUserId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUND_REQUESTED,
        title: 'Refund in progress',
        body: `We started refunding your ${purposeLabelEn(order.purpose)} of ${amount} ${order.currency}. Fulfillment for this payment is no longer available while the refund is processed.`,
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservationId,
        entityType: 'RESERVATION',
        entityId: reservationId,
        eventKey: `payment:${order.id}:refund-requested`,
        actionType: 'OPEN_RESERVATION',
        metadata: {
          ...meta,
          refundId: order.refund?.id ?? null,
        },
      });
    },
    { paymentOrderId },
  );

export const notifyRefundCompleted = async (input: {
  paymentOrderId: string;
  newCycleCreated?: boolean;
  newCycleNumber?: number;
}) =>
  notifySafely(
    'payment_notify_refund_completed',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const order = await loadOrderContext(input.paymentOrderId);
      if (!order || order.status !== 'REFUNDED') {
        return;
      }

      const reservationId = await linkReservationId(order);
      if (!reservationId) {
        return;
      }

      const amount = moneyDecimalToString(toMoneyDecimal(order.amount));
      const purpose = purposeLabelEn(order.purpose);
      const meta = await baseMetadata(order);

      if (input.newCycleCreated) {
        await createNotification({
          userId: order.payerUserId,
          notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUNDED,
          title: 'Refund completed — new payment required',
          body: `Your previous ${purpose} of ${amount} ${order.currency} was refunded. A new payment is now required for this reservation to continue.`,
          relatedEntityType: 'RESERVATION',
          relatedEntityId: reservationId,
          entityType: 'RESERVATION',
          entityId: reservationId,
          eventKey: `payment:${order.id}:refunded`,
          actionType: 'OPEN_RESERVATION',
          metadata: {
            ...meta,
            refundId: order.refund?.id ?? null,
            newCycleCreated: true,
            newCycleNumber: input.newCycleNumber ?? null,
          },
        });
        return;
      }

      await createNotification({
        userId: order.payerUserId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUNDED,
        title: 'Refund completed',
        body: `Your ${purpose} of ${amount} ${order.currency} was fully refunded.`,
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservationId,
        entityType: 'RESERVATION',
        entityId: reservationId,
        eventKey: `payment:${order.id}:refunded`,
        actionType: 'OPEN_RESERVATION',
        metadata: {
          ...meta,
          refundId: order.refund?.id ?? null,
          newCycleCreated: false,
        },
      });
    },
    { paymentOrderId: input.paymentOrderId },
  );

export const notifyRefundFailed = async (input: {
  paymentOrderId: string;
  refundId: string;
}) =>
  notifySafely(
    'payment_notify_refund_failed',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const order = await loadOrderContext(input.paymentOrderId);
      if (!order) {
        return;
      }

      const reservationId = await linkReservationId(order);
      if (!reservationId) {
        return;
      }

      const meta = await baseMetadata(order);
      await createNotification({
        userId: order.payerUserId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUND_FAILED,
        title: 'Refund needs attention',
        body: `We could not finish processing your ${purposeLabelEn(order.purpose)} refund yet. We will retry or review it — no action is required from you right now.`,
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservationId,
        entityType: 'RESERVATION',
        entityId: reservationId,
        eventKey: `payment:${order.id}:refund-failed:${input.refundId}`,
        actionType: 'OPEN_RESERVATION',
        metadata: {
          ...meta,
          refundId: input.refundId,
        },
      });
    },
    { paymentOrderId: input.paymentOrderId },
  );

export const notifyLatePaymentAutoRefund = async (paymentOrderId: string) =>
  notifySafely(
    'payment_notify_late_success_refund',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const order = await loadOrderContext(paymentOrderId);
      if (!order) {
        return;
      }

      const reservationId = await linkReservationId(order);
      if (!reservationId) {
        return;
      }

      const amount = moneyDecimalToString(toMoneyDecimal(order.amount));
      const meta = await baseMetadata(order);
      await createNotification({
        userId: order.payerUserId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_LATE_SUCCESS_REFUND,
        title: 'Payment arrived after cancellation',
        body: `A payment of ${amount} ${order.currency} arrived after this reservation was no longer active. Fulfillment was not unlocked, and a full refund was started automatically.`,
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservationId,
        entityType: 'RESERVATION',
        entityId: reservationId,
        eventKey: `payment:${order.id}:late-success-refund`,
        actionType: 'OPEN_RESERVATION',
        metadata: {
          ...meta,
          refundId: order.refund?.id ?? null,
        },
      });
    },
    { paymentOrderId },
  );

export const notifyNewPaymentCycleRequired = async (paymentOrderId: string) =>
  notifySafely(
    'payment_notify_new_cycle_required',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const order = await loadOrderContext(paymentOrderId);
      if (
        !order ||
        (order.status !== 'REQUIRES_PAYMENT' &&
          order.status !== 'CHECKOUT_PENDING')
      ) {
        return;
      }

      const reservationId = await linkReservationId(order);
      if (!reservationId) {
        return;
      }

      if (order.cycleNumber <= 1) {
        return;
      }

      const amount = moneyDecimalToString(toMoneyDecimal(order.amount));
      const meta = await baseMetadata(order);
      await createNotification({
        userId: order.payerUserId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_NEW_CYCLE_REQUIRED,
        title: 'New payment required',
        body: `A previous payment was closed. Please pay ${amount} ${order.currency} for the ${purposeLabelEn(order.purpose)} to continue.`,
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservationId,
        entityType: 'RESERVATION',
        entityId: reservationId,
        eventKey: `payment:${order.id}:new-cycle`,
        actionType: 'OPEN_RESERVATION',
        metadata: meta,
      });
    },
    { paymentOrderId },
  );

export const notifyPaymentResolutionRequired = async (input: {
  reservationId: string;
  paymentOrderId?: string | null;
  episodeKey: string;
}) =>
  notifySafely(
    'payment_notify_resolution_required',
    async () => {
      if (!isElectronicPaymentEnforced()) {
        return;
      }

      const reservation = await prisma.reservation.findUnique({
        where: { id: input.reservationId },
        select: {
          id: true,
          requesterId: true,
          material: { select: { title: true } },
        },
      });
      if (!reservation) {
        return;
      }

      await createNotification({
        userId: reservation.requesterId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_RESOLUTION_REQUIRED,
        title: 'Payment under review',
        body: `We are reviewing the payment status for ${materialTitle(reservation.material.title)}. Fulfillment is paused until the review is complete.`,
        relatedEntityType: 'RESERVATION',
        relatedEntityId: reservation.id,
        entityType: 'RESERVATION',
        entityId: reservation.id,
        eventKey: `reservation:${reservation.id}:payment-resolution:${input.episodeKey}`,
        actionType: 'OPEN_RESERVATION',
        metadata: {
          reservationId: reservation.id,
          paymentOrderId: input.paymentOrderId ?? null,
          materialTitle: materialTitle(reservation.material.title),
        },
      });
    },
    {
      reservationId: input.reservationId,
      paymentOrderId: input.paymentOrderId,
    },
  );
