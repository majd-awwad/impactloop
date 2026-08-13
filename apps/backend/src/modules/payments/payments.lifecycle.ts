import type {
  PaymentOrderStatus,
  Prisma,
  ReservationFulfillmentMethod,
  ReservationStatus,
} from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../observability/logger.js';

import { isElectronicPaymentEnforced } from './payments.policy.js';
import { isPositiveMoney, toMoneyDecimal } from './payments.money.js';
import {
  ACTIVE_DELIVERY_GROUP_RESERVATION_STATUSES,
  COMPLETED_DELIVERY_STATUSES,
  FULFILLMENT_STARTED_DELIVERY_STATUSES,
  LIFECYCLE_REFUND_REASONS,
  UNASSIGNED_CLOSEABLE_DELIVERY_STATUSES,
  classifyReservationPaymentLifecycle,
  type DeliveryFeeEligibility,
  type MaterialRefundEligibility,
} from './payments.lifecycle.policy.js';
import { requestFullRefundForPaidOrder } from './payments.refunds.js';
import { isPayablePaymentOrderStatus } from './payments.status-policy.js';

export type PostCommitRefundTask = {
  orderId: string;
  reason: string;
  actorUserId: string;
};

export type PaymentLifecycleAction =
  | { kind: 'NONE'; detail: string }
  | { kind: 'CANCELLED_UNPAID'; orderId: string }
  | { kind: 'REFUND_PREPARED'; orderId: string; refundId: string }
  | { kind: 'SKIPPED_REFUND_PENDING'; orderId: string }
  | { kind: 'SKIPPED_ALREADY_TERMINAL'; orderId: string }
  | { kind: 'SKIPPED_RESOLUTION_REQUIRED'; detail: string }
  | { kind: 'SKIPPED_FULFILLED'; detail: string }
  | { kind: 'DELIVERY_CANCELLED'; deliveryId: string }
  | { kind: 'FEE_ELIGIBILITY'; eligibility: DeliveryFeeEligibility }
  | { kind: 'MATERIAL_ELIGIBILITY'; eligibility: MaterialRefundEligibility };

export type FlushPostCommitRefundResult = {
  attemptedOrderIds: string[];
  succeededOrderIds: string[];
  failed: Array<{ orderId: string; code: string }>;
};

export type PostCommitResolutionTask = {
  reservationId: string;
  episodeKey: string;
  paymentOrderId?: string | null;
};

export type ReservationPaymentLifecycleResult = {
  actions: PaymentLifecycleAction[];
  postCommitRefunds: PostCommitRefundTask[];
  postCommitResolution?: PostCommitResolutionTask | null;
};

export type DeliveryGroupPaymentLifecycleResult = {
  eligibility: DeliveryFeeEligibility;
  actions: PaymentLifecycleAction[];
  postCommitRefunds: PostCommitRefundTask[];
};

const SYSTEM_ACTOR = 'payment-lifecycle';

/**
 * Cancel active CheckoutSessions that include the given PaymentOrder.
 * Session-owned attempts use paymentOrderId=null, so order-scoped attempt
 * cancellation alone cannot clear them.
 */
export const cancelActiveCheckoutSessionsForPaymentOrder = async (
  tx: Prisma.TransactionClient,
  input: { paymentOrderId: string; reason: string },
): Promise<void> => {
  const pendingItems = await tx.paymentCheckoutSessionItem.findMany({
    where: {
      paymentOrderId: input.paymentOrderId,
      status: 'PENDING',
      checkoutSession: {
        status: { in: ['CREATED', 'CHECKOUT_PENDING'] },
      },
    },
    select: { checkoutSessionId: true },
  });

  const sessionIds = [...new Set(pendingItems.map((row) => row.checkoutSessionId))];
  for (const sessionId of sessionIds) {
    const session = await tx.paymentCheckoutSession.findUnique({
      where: { id: sessionId },
      include: {
        items: { include: { paymentOrder: true } },
        attempts: {
          where: { status: { in: ['CREATED', 'PENDING'] } },
        },
      },
    });
    if (!session) continue;
    if (
      session.status !== 'CREATED' &&
      session.status !== 'CHECKOUT_PENDING'
    ) {
      continue;
    }

    for (const attempt of session.attempts) {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'CANCELLED',
          failureCode: 'SOURCE_LIFECYCLE_CANCELLED',
          failureMessage: input.reason.slice(0, 500),
        },
      });
    }

    await tx.paymentCheckoutSession.update({
      where: { id: session.id },
      data: { status: 'CANCELLED' },
    });

    for (const item of session.items) {
      if (item.status === 'PENDING') {
        await tx.paymentCheckoutSessionItem.update({
          where: { id: item.id },
          data: { status: 'CANCELLED' },
        });
      }

      // Reopen sibling unpaid orders that are not the lifecycle target and
      // are not already terminal.
      if (
        item.paymentOrderId !== input.paymentOrderId &&
        item.paymentOrder.status === 'CHECKOUT_PENDING'
      ) {
        await tx.paymentOrder.update({
          where: { id: item.paymentOrderId },
          data: { status: 'REQUIRES_PAYMENT' },
        });
      }
    }
  }
};

const cancelActiveAttempts = async (
  tx: Prisma.TransactionClient,
  paymentOrderId: string,
  reason: string,
) => {
  await cancelActiveCheckoutSessionsForPaymentOrder(tx, {
    paymentOrderId,
    reason,
  });

  await tx.paymentAttempt.updateMany({
    where: {
      paymentOrderId,
      status: { in: ['CREATED', 'PENDING'] },
    },
    data: {
      status: 'CANCELLED',
      failureCode: 'ORDER_CANCELLED',
      failureMessage: reason.slice(0, 500),
    },
  });
};

/**
 * Cancel an unpaid PaymentOrder idempotently.
 * Does not mutate PAID / REFUND_PENDING / REFUNDED / CANCELLED.
 */
export const cancelUnpaidPaymentOrder = async (
  tx: Prisma.TransactionClient,
  input: { orderId: string; reason: string },
): Promise<PaymentLifecycleAction> => {
  const order = await tx.paymentOrder.findUnique({
    where: { id: input.orderId },
  });

  if (!order) {
    throw new AppError('Payment order not found.', 404, 'NOT_FOUND');
  }

  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return { kind: 'SKIPPED_ALREADY_TERMINAL', orderId: order.id };
  }

  if (order.status === 'REFUND_PENDING') {
    return { kind: 'SKIPPED_REFUND_PENDING', orderId: order.id };
  }

  if (order.status === 'PAID') {
    throw new AppError(
      'Paid payment orders must be refunded, not cancelled.',
      409,
      'REFUND_REQUIRED',
      { orderId: order.id },
    );
  }

  if (!isPayablePaymentOrderStatus(order.status)) {
    return { kind: 'NONE', detail: `Unexpected status ${order.status}` };
  }

  await cancelActiveAttempts(tx, order.id, input.reason);

  await tx.paymentOrder.update({
    where: { id: order.id },
    data: {
      status: 'CANCELLED',
      cancelledAt: order.cancelledAt ?? new Date(),
    },
  });

  return { kind: 'CANCELLED_UNPAID', orderId: order.id };
};

/**
 * Prepare a full refund inside an existing transaction (no provider I/O).
 * Idempotent: reuses existing PaymentRefund row.
 */
export const prepareFullRefundForPaidOrderInTransaction = async (
  tx: Prisma.TransactionClient,
  input: { orderId: string; reason: string },
): Promise<{
  action: PaymentLifecycleAction;
  postCommit: PostCommitRefundTask | null;
}> => {
  const order = await tx.paymentOrder.findUnique({
    where: { id: input.orderId },
    include: {
      attempts: {
        where: { status: 'SUCCEEDED' },
        orderBy: { succeededAt: 'desc' },
        take: 1,
      },
      refund: true,
    },
  });

  if (!order) {
    throw new AppError('Payment order not found.', 404, 'NOT_FOUND');
  }

  if (order.status === 'REFUNDED') {
    return {
      action: { kind: 'SKIPPED_ALREADY_TERMINAL', orderId: order.id },
      postCommit: null,
    };
  }

  if (order.status === 'CANCELLED') {
    return {
      action: { kind: 'SKIPPED_ALREADY_TERMINAL', orderId: order.id },
      postCommit: null,
    };
  }

  if (
    order.status === 'REFUND_PENDING' &&
    order.refund &&
    (order.refund.status === 'PENDING' ||
      order.refund.status === 'REQUESTED' ||
      order.refund.status === 'FAILED')
  ) {
    // FAILED → retry via post-commit; PENDING/REQUESTED → continue orchestration.
    if (order.refund.status === 'FAILED') {
      await tx.paymentRefund.update({
        where: { id: order.refund.id },
        data: {
          status: 'REQUESTED',
          failureCode: null,
          failureMessage: null,
          reason: input.reason || order.refund.reason,
        },
      });
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'REFUND_PENDING' },
      });
    }

    return {
      action: {
        kind: 'REFUND_PREPARED',
        orderId: order.id,
        refundId: order.refund.id,
      },
      postCommit: {
        orderId: order.id,
        reason: input.reason,
        actorUserId: SYSTEM_ACTOR,
      },
    };
  }

  if (order.status !== 'PAID') {
    throw new AppError(
      'Only paid payment orders can be refunded.',
      409,
      'PAYMENT_NOT_REFUNDABLE',
      { status: order.status },
    );
  }

  if (order.paymentMethod === 'CASH') {
    throw new AppError(
      'Collected cash requires manual reversal; provider refund is unavailable.',
      409,
      'CASH_REVERSAL_REQUIRES_MANUAL_RESOLUTION',
      { orderId: order.id },
    );
  }

  const succeededAttempt = order.attempts[0];
  if (!succeededAttempt) {
    throw new AppError(
      'Paid order is missing a succeeded payment attempt.',
      500,
      'INTERNAL_ERROR',
      { orderId: order.id },
    );
  }

  let refundId = order.refund?.id;
  if (order.refund) {
    await tx.paymentRefund.update({
      where: { id: order.refund.id },
      data: {
        status: 'REQUESTED',
        failureCode: null,
        failureMessage: null,
        reason: input.reason || order.refund.reason || 'Full refund requested',
      },
    });
    refundId = order.refund.id;
  } else {
    const created = await tx.paymentRefund.create({
      data: {
        paymentOrderId: order.id,
        paymentAttemptId: succeededAttempt.id,
        status: 'REQUESTED',
        amount: order.amount,
        currency: order.currency,
        reason: input.reason || 'Full refund requested',
      },
    });
    refundId = created.id;
  }

  await tx.paymentOrder.update({
    where: { id: order.id },
    data: { status: 'REFUND_PENDING' },
  });

  return {
    action: {
      kind: 'REFUND_PREPARED',
      orderId: order.id,
      refundId: refundId!,
    },
    postCommit: {
      orderId: order.id,
      reason: input.reason,
      actorUserId: SYSTEM_ACTOR,
    },
  };
};

const findCurrentMaterialOrder = (
  tx: Prisma.TransactionClient,
  reservationId: string,
) =>
  tx.paymentOrder.findFirst({
    where: { purpose: 'MATERIAL_SUBTOTAL', reservationId },
    orderBy: { cycleNumber: 'desc' },
  });

const findCurrentFeeOrder = (
  tx: Prisma.TransactionClient,
  deliveryGroupId: string,
) =>
  tx.paymentOrder.findFirst({
    where: { purpose: 'DELIVERY_FEE', deliveryGroupId },
    orderBy: { cycleNumber: 'desc' },
  });

const findReservationDelivery = async (
  tx: Prisma.TransactionClient,
  reservation: {
    id: string;
    fulfillmentMethod: ReservationFulfillmentMethod;
    deliveryGroupId: string | null;
  },
) => {
  if (reservation.fulfillmentMethod !== 'DELIVERY') {
    return tx.delivery.findFirst({
      where: { reservationId: reservation.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        assignedDriverProfileId: true,
        pickedUpAt: true,
        deliveredAt: true,
      },
    });
  }

  if (reservation.deliveryGroupId) {
    return tx.delivery.findFirst({
      where: { deliveryGroupId: reservation.deliveryGroupId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        assignedDriverProfileId: true,
        pickedUpAt: true,
        deliveredAt: true,
      },
    });
  }

  return tx.delivery.findFirst({
    where: { reservationId: reservation.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
      pickedUpAt: true,
      deliveredAt: true,
    },
  });
};

/**
 * Authoritative material cancel/refund eligibility.
 * Status alone is insufficient for DELIVERY — Delivery custody blocks auto-refund.
 */
export const evaluateMaterialRefundEligibility = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
): Promise<{
  eligibility: MaterialRefundEligibility;
  orderId: string | null;
  deliveryId: string | null;
}> => {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      deliveryGroupId: true,
      materialSubtotal: true,
      completedAt: true,
    },
  });

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (!isPositiveMoney(toMoneyDecimal(reservation.materialSubtotal ?? 0))) {
    return {
      eligibility: 'NO_MATERIAL_PAYMENT_REQUIRED',
      orderId: null,
      deliveryId: null,
    };
  }

  const order = await findCurrentMaterialOrder(tx, reservation.id);
  const delivery = await findReservationDelivery(tx, reservation);

  if (reservation.status === 'COMPLETED' || reservation.completedAt != null) {
    return {
      eligibility: 'FULFILLED_NO_REFUND',
      orderId: order?.id ?? null,
      deliveryId: delivery?.id ?? null,
    };
  }

  if (
    reservation.status === 'AWAITING_RESOLUTION' ||
    reservation.status === 'FULFILLMENT_FAILED'
  ) {
    return {
      eligibility: 'SOURCE_RESOLUTION_REQUIRED',
      orderId: order?.id ?? null,
      deliveryId: delivery?.id ?? null,
    };
  }

  if (delivery) {
    if (
      (COMPLETED_DELIVERY_STATUSES as readonly string[]).includes(
        delivery.status,
      ) ||
      delivery.deliveredAt != null
    ) {
      return {
        eligibility: 'FULFILLED_NO_REFUND',
        orderId: order?.id ?? null,
        deliveryId: delivery.id,
      };
    }

    if (
      delivery.assignedDriverProfileId != null ||
      delivery.pickedUpAt != null ||
      (FULFILLMENT_STARTED_DELIVERY_STATUSES as readonly string[]).includes(
        delivery.status,
      )
    ) {
      return {
        eligibility: 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED',
        orderId: order?.id ?? null,
        deliveryId: delivery.id,
      };
    }
  }

  const classification = classifyReservationPaymentLifecycle(
    reservation.status,
  );
  if (classification !== 'PRE_FULFILLMENT_TERMINAL') {
    return {
      eligibility: 'SOURCE_NOT_TERMINAL',
      orderId: order?.id ?? null,
      deliveryId: delivery?.id ?? null,
    };
  }

  if (!order) {
    return {
      eligibility: 'NO_ORDER',
      orderId: null,
      deliveryId: delivery?.id ?? null,
    };
  }

  if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
    return {
      eligibility: 'ORDER_ALREADY_TERMINAL',
      orderId: order.id,
      deliveryId: delivery?.id ?? null,
    };
  }

  if (isPayablePaymentOrderStatus(order.status)) {
    return {
      eligibility: 'CANCEL_UNPAID',
      orderId: order.id,
      deliveryId: delivery?.id ?? null,
    };
  }

  if (order.status === 'PAID' || order.status === 'REFUND_PENDING') {
    return {
      eligibility: 'REFUND_PAID',
      orderId: order.id,
      deliveryId: delivery?.id ?? null,
    };
  }

  return {
    eligibility: 'ORDER_ALREADY_TERMINAL',
    orderId: order.id,
    deliveryId: delivery?.id ?? null,
  };
};

/**
 * Whether a late provider success on a material order may auto-refund.
 * Uses fulfillment custody, then the **specific** PaymentOrder receiving success
 * (not only the latest cycle — a superseded CANCELLED cycle must still refund).
 */
export const evaluateMaterialLateSuccessAction = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
  paymentOrderId?: string,
): Promise<
  | 'AUTO_REFUND'
  | 'FULFILLED_NO_REFUND'
  | 'RESOLUTION_REQUIRED'
  | 'SOURCE_ACTIVE'
> => {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      status: true,
      fulfillmentMethod: true,
      deliveryGroupId: true,
      completedAt: true,
    },
  });
  if (!reservation) {
    return 'AUTO_REFUND';
  }

  if (reservation.status === 'COMPLETED' || reservation.completedAt != null) {
    return 'FULFILLED_NO_REFUND';
  }
  if (
    reservation.status === 'AWAITING_RESOLUTION' ||
    reservation.status === 'FULFILLMENT_FAILED'
  ) {
    return 'RESOLUTION_REQUIRED';
  }

  const delivery = await findReservationDelivery(tx, reservation);
  if (delivery) {
    if (
      (COMPLETED_DELIVERY_STATUSES as readonly string[]).includes(
        delivery.status,
      ) ||
      delivery.deliveredAt != null
    ) {
      return 'FULFILLED_NO_REFUND';
    }
    if (
      delivery.assignedDriverProfileId != null ||
      delivery.pickedUpAt != null ||
      (FULFILLMENT_STARTED_DELIVERY_STATUSES as readonly string[]).includes(
        delivery.status,
      )
    ) {
      return 'RESOLUTION_REQUIRED';
    }
  }

  if (paymentOrderId) {
    const order = await tx.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      select: { id: true, status: true, purpose: true },
    });
    if (order?.purpose === 'MATERIAL_SUBTOTAL' && order.status === 'CANCELLED') {
      // Late capture on a cancelled historical cycle — always refund; never reopen.
      return 'AUTO_REFUND';
    }
  }

  if (
    classifyReservationPaymentLifecycle(reservation.status) ===
    'PRE_FULFILLMENT_TERMINAL'
  ) {
    return 'AUTO_REFUND';
  }

  return 'SOURCE_ACTIVE';
};

const applyOrderTerminalAction = async (
  tx: Prisma.TransactionClient,
  order: { id: string; status: PaymentOrderStatus },
  reason: string,
  actions: PaymentLifecycleAction[],
  postCommitRefunds: PostCommitRefundTask[],
) => {
  // Re-read authoritative status inside the TX (handles concurrent checkout).
  let latest = await tx.paymentOrder.findUniqueOrThrow({
    where: { id: order.id },
    select: { id: true, status: true },
  });

  if (isPayablePaymentOrderStatus(latest.status)) {
    try {
      actions.push(
        await cancelUnpaidPaymentOrder(tx, { orderId: latest.id, reason }),
      );
      return;
    } catch (error) {
      // Concurrent success may have moved the order to PAID mid-flight.
      if (
        !(error instanceof AppError && error.code === 'REFUND_REQUIRED')
      ) {
        throw error;
      }
      latest = await tx.paymentOrder.findUniqueOrThrow({
        where: { id: order.id },
        select: { id: true, status: true },
      });
    }
  }

  if (latest.status === 'PAID') {
    const prepared = await prepareFullRefundForPaidOrderInTransaction(tx, {
      orderId: latest.id,
      reason,
    });
    actions.push(prepared.action);
    if (prepared.postCommit) {
      postCommitRefunds.push(prepared.postCommit);
    }
    return;
  }

  if (latest.status === 'REFUND_PENDING') {
    actions.push({ kind: 'SKIPPED_REFUND_PENDING', orderId: latest.id });
    postCommitRefunds.push({
      orderId: latest.id,
      reason,
      actorUserId: SYSTEM_ACTOR,
    });
    return;
  }

  if (latest.status === 'CANCELLED' || latest.status === 'REFUNDED') {
    actions.push({ kind: 'SKIPPED_ALREADY_TERMINAL', orderId: latest.id });
  }
};

/**
 * After a Reservation status write that affects payment, cancel/refund the
 * current material cycle and re-evaluate the DeliveryGroup fee when applicable.
 */
export const handleReservationPaymentLifecycleTransition = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    newStatus: ReservationStatus;
    actorUserId?: string | null;
    reason?: string;
  },
): Promise<ReservationPaymentLifecycleResult> => {
  const actions: PaymentLifecycleAction[] = [];
  const postCommitRefunds: PostCommitRefundTask[] = [];

  if (!isElectronicPaymentEnforced()) {
    return {
      actions: [{ kind: 'NONE', detail: 'PAYMENT_DISABLED' }],
      postCommitRefunds,
      postCommitResolution: null,
    };
  }

  const classification = classifyReservationPaymentLifecycle(input.newStatus);
  const reason =
    input.reason?.trim() ||
    LIFECYCLE_REFUND_REASONS.SOURCE_PRE_FULFILLMENT_TERMINAL;

  const reservation = await tx.reservation.findUnique({
    where: { id: input.reservationId },
    select: {
      id: true,
      status: true,
      deliveryGroupId: true,
      fulfillmentMethod: true,
    },
  });

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (classification === 'FULFILLED') {
    return {
      actions: [{ kind: 'SKIPPED_FULFILLED', detail: input.newStatus }],
      postCommitRefunds,
      postCommitResolution: null,
    };
  }

  if (classification === 'RESOLUTION_REQUIRED') {
    const history = await tx.reservationStatusHistory.findFirst({
      where: {
        reservationId: reservation.id,
        newStatus: input.newStatus,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return {
      actions: [
        { kind: 'SKIPPED_RESOLUTION_REQUIRED', detail: input.newStatus },
      ],
      postCommitRefunds,
      postCommitResolution: {
        reservationId: reservation.id,
        episodeKey: history?.id ?? `status-history-missing:${reservation.id}:${input.newStatus}`,
      },
    };
  }

  let postCommitResolution: PostCommitResolutionTask | null = null;

  if (classification === 'PRE_FULFILLMENT_TERMINAL') {
    const material = await evaluateMaterialRefundEligibility(
      tx,
      reservation.id,
    );
    actions.push({
      kind: 'MATERIAL_ELIGIBILITY',
      eligibility: material.eligibility,
    });

    if (material.eligibility === 'CANCEL_UNPAID' && material.orderId) {
      await applyOrderTerminalAction(
        tx,
        { id: material.orderId, status: 'REQUIRES_PAYMENT' },
        reason,
        actions,
        postCommitRefunds,
      );
    } else if (material.eligibility === 'REFUND_PAID' && material.orderId) {
      await applyOrderTerminalAction(
        tx,
        { id: material.orderId, status: 'PAID' },
        reason,
        actions,
        postCommitRefunds,
      );
    } else if (
      material.eligibility === 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED' ||
      material.eligibility === 'SOURCE_RESOLUTION_REQUIRED'
    ) {
      actions.push({
        kind: 'SKIPPED_RESOLUTION_REQUIRED',
        detail: material.eligibility,
      });
      const orderCycle = material.orderId
        ? await tx.paymentOrder.findUnique({
            where: { id: material.orderId },
            select: { cycleNumber: true },
          })
        : null;
      postCommitResolution = {
        reservationId: reservation.id,
        episodeKey: `material:${material.eligibility}:${material.orderId ?? 'none'}:c${orderCycle?.cycleNumber ?? 0}`,
        paymentOrderId: material.orderId,
      };
    } else if (material.eligibility === 'FULFILLED_NO_REFUND') {
      actions.push({
        kind: 'SKIPPED_FULFILLED',
        detail: material.eligibility,
      });
    } else if (material.eligibility === 'ORDER_ALREADY_TERMINAL') {
      actions.push({
        kind: 'SKIPPED_ALREADY_TERMINAL',
        orderId: material.orderId!,
      });
    } else {
      actions.push({ kind: 'NONE', detail: material.eligibility });
    }

    if (
      reservation.fulfillmentMethod === 'DELIVERY' &&
      reservation.deliveryGroupId
    ) {
      const groupResult = await handleDeliveryGroupPaymentLifecycleTransition(
        tx,
        {
          deliveryGroupId: reservation.deliveryGroupId,
          actorUserId: input.actorUserId,
          reason: LIFECYCLE_REFUND_REASONS.GROUP_EMPTY_BEFORE_FULFILLMENT,
        },
      );
      actions.push({
        kind: 'FEE_ELIGIBILITY',
        eligibility: groupResult.eligibility,
      });
      actions.push(...groupResult.actions);
      postCommitRefunds.push(...groupResult.postCommitRefunds);
      if (
        !postCommitResolution &&
        groupResult.eligibility === 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED'
      ) {
        actions.push({
          kind: 'SKIPPED_RESOLUTION_REQUIRED',
          detail: groupResult.eligibility,
        });
        const feeOrder = await tx.paymentOrder.findFirst({
          where: {
            purpose: 'DELIVERY_FEE',
            deliveryGroupId: reservation.deliveryGroupId,
          },
          orderBy: { cycleNumber: 'desc' },
          select: { id: true, cycleNumber: true },
        });
        postCommitResolution = {
          reservationId: reservation.id,
          episodeKey: `fee:${groupResult.eligibility}:${feeOrder?.id ?? reservation.deliveryGroupId}:c${feeOrder?.cycleNumber ?? 0}`,
          paymentOrderId: feeOrder?.id ?? null,
        };
      }
    }
  }

  return { actions, postCommitRefunds, postCommitResolution };
};

export const evaluateDeliveryFeeRefundEligibility = async (
  tx: Prisma.TransactionClient,
  deliveryGroupId: string,
): Promise<{
  eligibility: DeliveryFeeEligibility;
  feeOrderId: string | null;
  closeableDeliveryId: string | null;
}> => {
  const group = await tx.deliveryGroup.findUnique({
    where: { id: deliveryGroupId },
    select: {
      id: true,
      deliveryFee: true,
      currency: true,
      status: true,
      reservations: {
        where: {
          status: { in: [...ACTIVE_DELIVERY_GROUP_RESERVATION_STATUSES] },
          fulfillmentMethod: 'DELIVERY',
        },
        select: { id: true, status: true },
      },
    },
  });

  if (!group) {
    throw new AppError('Delivery group not found.', 404, 'NOT_FOUND');
  }

  if (!isPositiveMoney(toMoneyDecimal(group.deliveryFee))) {
    return {
      eligibility: 'NO_FEE_REQUIRED',
      feeOrderId: null,
      closeableDeliveryId: null,
    };
  }

  const feeOrder = await findCurrentFeeOrder(tx, group.id);
  if (!feeOrder) {
    return {
      eligibility: 'NO_FEE_ORDER',
      feeOrderId: null,
      closeableDeliveryId: null,
    };
  }

  if (feeOrder.status === 'REFUNDED') {
    return {
      eligibility: 'FEE_ALREADY_REFUNDED',
      feeOrderId: feeOrder.id,
      closeableDeliveryId: null,
    };
  }

  if (feeOrder.status === 'CANCELLED') {
    return {
      eligibility: 'FEE_ALREADY_CANCELLED',
      feeOrderId: feeOrder.id,
      closeableDeliveryId: null,
    };
  }

  if (group.reservations.length > 0) {
    return {
      eligibility: 'FEE_STILL_REQUIRED',
      feeOrderId: feeOrder.id,
      closeableDeliveryId: null,
    };
  }

  const delivery = await tx.delivery.findFirst({
    where: { deliveryGroupId: group.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
    },
  });

  if (
    delivery &&
    (COMPLETED_DELIVERY_STATUSES as readonly string[]).includes(delivery.status)
  ) {
    return {
      eligibility: 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED',
      feeOrderId: feeOrder.id,
      closeableDeliveryId: null,
    };
  }

  if (
    delivery &&
    ((FULFILLMENT_STARTED_DELIVERY_STATUSES as readonly string[]).includes(
      delivery.status,
    ) ||
      delivery.assignedDriverProfileId != null)
  ) {
    return {
      eligibility: 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED',
      feeOrderId: feeOrder.id,
      closeableDeliveryId: null,
    };
  }

  const closeable =
    delivery &&
    (UNASSIGNED_CLOSEABLE_DELIVERY_STATUSES as readonly string[]).includes(
      delivery.status,
    ) &&
    delivery.assignedDriverProfileId == null
      ? delivery.id
      : null;

  if (isPayablePaymentOrderStatus(feeOrder.status)) {
    return {
      eligibility: 'GROUP_EMPTY_CANCEL_UNPAID',
      feeOrderId: feeOrder.id,
      closeableDeliveryId: closeable,
    };
  }

  if (feeOrder.status === 'PAID' || feeOrder.status === 'REFUND_PENDING') {
    return {
      eligibility: 'GROUP_EMPTY_REFUND_PAID',
      feeOrderId: feeOrder.id,
      closeableDeliveryId: closeable,
    };
  }

  return {
    eligibility: 'NO_FEE_ORDER',
    feeOrderId: feeOrder.id,
    closeableDeliveryId: closeable,
  };
};

const cancelUnassignedWaitingDelivery = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryId: string;
    changedByUserId: string;
    note: string;
  },
): Promise<PaymentLifecycleAction> => {
  const delivery = await tx.delivery.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      assignedDriverProfileId: true,
    },
  });

  if (
    !delivery ||
    delivery.assignedDriverProfileId != null ||
    !(UNASSIGNED_CLOSEABLE_DELIVERY_STATUSES as readonly string[]).includes(
      delivery.status,
    )
  ) {
    return { kind: 'NONE', detail: 'DELIVERY_NOT_CLOSEABLE' };
  }

  const updated = await tx.delivery.updateMany({
    where: {
      id: delivery.id,
      status: delivery.status,
      assignedDriverProfileId: null,
    },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
    },
  });

  if (updated.count !== 1) {
    return { kind: 'NONE', detail: 'DELIVERY_CANCEL_RACE' };
  }

  await tx.deliveryStatusHistory.create({
    data: {
      deliveryId: delivery.id,
      oldStatus: delivery.status,
      newStatus: 'CANCELLED',
      changedByUserId: input.changedByUserId,
      note: input.note,
    },
  });

  return { kind: 'DELIVERY_CANCELLED', deliveryId: delivery.id };
};

/**
 * Re-evaluate DeliveryGroup fee after a member leaves or the group empties.
 */
export const handleDeliveryGroupPaymentLifecycleTransition = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryGroupId: string;
    actorUserId?: string | null;
    reason?: string;
  },
): Promise<DeliveryGroupPaymentLifecycleResult> => {
  const actions: PaymentLifecycleAction[] = [];
  const postCommitRefunds: PostCommitRefundTask[] = [];

  if (!isElectronicPaymentEnforced()) {
    return {
      eligibility: 'NO_FEE_REQUIRED',
      actions: [{ kind: 'NONE', detail: 'PAYMENT_DISABLED' }],
      postCommitRefunds,
    };
  }

  const group = await tx.deliveryGroup.findUnique({
    where: { id: input.deliveryGroupId },
    select: {
      id: true,
      learnerId: true,
    },
  });
  if (!group) {
    throw new AppError('Delivery group not found.', 404, 'NOT_FOUND');
  }

  const evaluated = await evaluateDeliveryFeeRefundEligibility(
    tx,
    input.deliveryGroupId,
  );
  const reason =
    input.reason?.trim() ||
    LIFECYCLE_REFUND_REASONS.GROUP_EMPTY_BEFORE_FULFILLMENT;
  const changedByUserId = input.actorUserId?.trim() || group.learnerId;

  if (evaluated.closeableDeliveryId) {
    actions.push(
      await cancelUnassignedWaitingDelivery(tx, {
        deliveryId: evaluated.closeableDeliveryId,
        changedByUserId,
        note: 'Delivery cancelled after DeliveryGroup lost all active members',
      }),
    );
  }

  if (
    evaluated.eligibility === 'GROUP_EMPTY_CANCEL_UNPAID' &&
    evaluated.feeOrderId
  ) {
    actions.push(
      await cancelUnpaidPaymentOrder(tx, {
        orderId: evaluated.feeOrderId,
        reason,
      }),
    );
  } else if (
    evaluated.eligibility === 'GROUP_EMPTY_REFUND_PAID' &&
    evaluated.feeOrderId
  ) {
    const feeOrder = await tx.paymentOrder.findUniqueOrThrow({
      where: { id: evaluated.feeOrderId },
    });
    if (feeOrder.status === 'PAID' || feeOrder.status === 'REFUND_PENDING') {
      await applyOrderTerminalAction(
        tx,
        feeOrder,
        reason,
        actions,
        postCommitRefunds,
      );
    }
  }

  return {
    eligibility: evaluated.eligibility,
    actions,
    postCommitRefunds,
  };
};

/**
 * Execute provider refund orchestration after the lifecycle DB transaction commits.
 * Safe to call repeatedly — delegates to requestFullRefundForPaidOrder idempotency.
 * Failures are logged (safe IDs/codes only) and left retryable; they do not throw.
 */
export const flushPostCommitPaymentRefunds = async (
  tasks: PostCommitRefundTask[],
  resolution?:
    | PostCommitResolutionTask
    | PostCommitResolutionTask[]
    | null,
): Promise<FlushPostCommitRefundResult> => {
  const result: FlushPostCommitRefundResult = {
    attemptedOrderIds: [],
    succeededOrderIds: [],
    failed: [],
  };

  if (resolution && isElectronicPaymentEnforced()) {
    const { notifyPaymentResolutionRequired } = await import(
      './payments.notifications.js'
    );
    const resolutions = Array.isArray(resolution) ? resolution : [resolution];
    const seen = new Set<string>();
    for (const item of resolutions) {
      const key = `${item.reservationId}:${item.episodeKey}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      await notifyPaymentResolutionRequired({
        reservationId: item.reservationId,
        paymentOrderId: item.paymentOrderId,
        episodeKey: item.episodeKey,
      });
    }
  }

  if (!tasks.length || !isElectronicPaymentEnforced()) {
    return result;
  }

  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.orderId)) {
      continue;
    }
    seen.add(task.orderId);
    result.attemptedOrderIds.push(task.orderId);
    try {
      await requestFullRefundForPaidOrder({
        orderId: task.orderId,
        reason: task.reason,
        actorUserId: task.actorUserId || SYSTEM_ACTOR,
      });
      result.succeededOrderIds.push(task.orderId);
    } catch (error) {
      const code =
        error instanceof AppError
          ? error.code
          : error instanceof Error
            ? error.name
            : 'REFUND_FLUSH_FAILED';
      result.failed.push({ orderId: task.orderId, code });
      logger.warn(
        {
          operation: 'payment_refund_flush',
          errorCode: code,
          event: `order:${task.orderId}`,
        },
        'Post-commit payment refund initiation failed; left retryable',
      );
    }
  }

  return result;
};

/**
 * After a verified refund succeeds, create the next cycle when the source is
 * again payable (ACCEPTED). Never reopens the refunded cycle.
 */
export const ensureNextPaymentCycleAfterVerifiedRefund = async (
  paymentOrderId: string,
): Promise<{
  outcome:
    | 'DISABLED'
    | 'NOT_REFUNDED'
    | 'NOT_LATEST'
    | 'NOT_PAYABLE'
    | 'CREATED'
    | 'EXISTING'
    | 'NOT_REQUIRED'
    | 'NOT_FOUND';
  cycleNumber?: number;
}> => {
  if (!isElectronicPaymentEnforced()) {
    return { outcome: 'DISABLED' };
  }

  const {
    ensureMaterialPaymentOrder,
    ensureDeliveryFeePaymentOrder,
  } = await import('./payments.ensure.js');

  const order = await prisma.paymentOrder.findUnique({
    where: { id: paymentOrderId },
    select: {
      id: true,
      status: true,
      purpose: true,
      cycleNumber: true,
      reservationId: true,
      deliveryGroupId: true,
    },
  });

  if (!order || order.status !== 'REFUNDED') {
    return { outcome: 'NOT_REFUNDED' };
  }

  if (order.purpose === 'MATERIAL_SUBTOTAL' && order.reservationId) {
    const latest = await prisma.paymentOrder.findFirst({
      where: {
        purpose: 'MATERIAL_SUBTOTAL',
        reservationId: order.reservationId,
      },
      orderBy: { cycleNumber: 'desc' },
      select: { id: true, cycleNumber: true },
    });
    if (!latest || latest.id !== order.id) {
      return { outcome: 'NOT_LATEST' };
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: order.reservationId },
      select: { status: true },
    });
    if (!reservation || reservation.status !== 'ACCEPTED') {
      return { outcome: 'NOT_PAYABLE' };
    }

    const ensured = await ensureMaterialPaymentOrder(order.reservationId);
    if (ensured.outcome === 'CREATED') {
      return { outcome: 'CREATED', cycleNumber: ensured.order.cycleNumber };
    }
    if (ensured.outcome === 'EXISTING') {
      return { outcome: 'EXISTING', cycleNumber: ensured.order.cycleNumber };
    }
    return { outcome: ensured.outcome };
  }

  if (order.purpose === 'DELIVERY_FEE' && order.deliveryGroupId) {
    const latest = await prisma.paymentOrder.findFirst({
      where: {
        purpose: 'DELIVERY_FEE',
        deliveryGroupId: order.deliveryGroupId,
      },
      orderBy: { cycleNumber: 'desc' },
      select: { id: true },
    });
    if (!latest || latest.id !== order.id) {
      return { outcome: 'NOT_LATEST' };
    }

    const completedDelivery = await prisma.delivery.findFirst({
      where: {
        deliveryGroupId: order.deliveryGroupId,
        status: { in: [...COMPLETED_DELIVERY_STATUSES] },
      },
      select: { id: true },
    });
    if (completedDelivery) {
      return { outcome: 'NOT_PAYABLE' };
    }

    const acceptedMember = await prisma.reservation.findFirst({
      where: {
        deliveryGroupId: order.deliveryGroupId,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
      },
      select: { id: true },
    });
    if (!acceptedMember) {
      return { outcome: 'NOT_PAYABLE' };
    }

    const ensured = await ensureDeliveryFeePaymentOrder(order.deliveryGroupId);
    if (ensured.outcome === 'CREATED') {
      return { outcome: 'CREATED', cycleNumber: ensured.order.cycleNumber };
    }
    if (ensured.outcome === 'EXISTING') {
      return { outcome: 'EXISTING', cycleNumber: ensured.order.cycleNumber };
    }
    return { outcome: ensured.outcome };
  }

  return { outcome: 'NOT_FOUND' };
};

/** Apply late-success auto-refund after a cancelled order was paid by the provider. */
export const prepareLateSuccessAutoRefundInTransaction = async (
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    succeededAttemptId: string;
    paidAt: Date;
  },
): Promise<PostCommitRefundTask> => {
  const order = await tx.paymentOrder.findUniqueOrThrow({
    where: { id: input.orderId },
    include: { refund: true },
  });

  // Late success may land on CANCELLED / unpaid / checkout-pending orders.
  // Always move to REFUND_PENDING so post-commit provider refund can run.
  if (
    order.status === 'CANCELLED' ||
    order.status === 'REQUIRES_PAYMENT' ||
    order.status === 'CHECKOUT_PENDING' ||
    order.status === 'PAID'
  ) {
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'REFUND_PENDING',
        paidAt: order.paidAt ?? input.paidAt,
        cancelledAt: order.cancelledAt,
      },
    });
  }

  if (!order.refund) {
    await tx.paymentRefund.create({
      data: {
        paymentOrderId: order.id,
        paymentAttemptId: input.succeededAttemptId,
        status: 'REQUESTED',
        amount: order.amount,
        currency: order.currency,
        reason: LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_AFTER_SOURCE_TERMINAL,
      },
    });
  } else if (
    order.refund.status === 'FAILED' ||
    order.refund.status === 'REQUESTED'
  ) {
    await tx.paymentRefund.update({
      where: { id: order.refund.id },
      data: {
        status: 'REQUESTED',
        failureCode: null,
        failureMessage: null,
        reason: LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_AFTER_SOURCE_TERMINAL,
      },
    });
  }

  return {
    orderId: order.id,
    reason: LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_AFTER_SOURCE_TERMINAL,
    actorUserId: SYSTEM_ACTOR,
  };
};

export const isSourceTerminalForLateSuccess = async (
  tx: Prisma.TransactionClient,
  order: {
    id?: string;
    purpose: string;
    reservationId: string | null;
    deliveryGroupId: string | null;
  },
): Promise<boolean> => {
  if (order.purpose === 'MATERIAL_SUBTOTAL' && order.reservationId) {
    const action = await evaluateMaterialLateSuccessAction(
      tx,
      order.reservationId,
      order.id,
    );
    // Only intercept unpaid success when auto-refund is required.
    // Resolution/active sources must continue through the normal PAID path.
    return action === 'AUTO_REFUND';
  }

  if (order.purpose === 'DELIVERY_FEE' && order.deliveryGroupId) {
    const eligibility = await evaluateDeliveryFeeRefundEligibility(
      tx,
      order.deliveryGroupId,
    );
    return (
      eligibility.eligibility === 'GROUP_EMPTY_CANCEL_UNPAID' ||
      eligibility.eligibility === 'GROUP_EMPTY_REFUND_PAID' ||
      eligibility.eligibility === 'FEE_ALREADY_CANCELLED' ||
      eligibility.eligibility === 'NO_FEE_ORDER'
    );
  }

  return false;
};

/** Used by tests to inspect eligibility without mutation. */
export const peekDeliveryFeeEligibility = async (deliveryGroupId: string) =>
  evaluateDeliveryFeeRefundEligibility(prisma, deliveryGroupId);

export const peekMaterialRefundEligibility = async (reservationId: string) =>
  evaluateMaterialRefundEligibility(prisma, reservationId);
