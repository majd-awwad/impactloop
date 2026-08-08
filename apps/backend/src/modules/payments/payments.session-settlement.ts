import type { Prisma } from '../../generated/prisma/client.js';

import { PROVIDER_EVENT_TYPES } from './payments.constants.js';
import {
  isSourceTerminalForLateSuccess,
  prepareLateSuccessAutoRefundInTransaction,
} from './payments.lifecycle.js';
import { moneyDecimalToMinorUnits } from './payments.money.js';
import type { NormalizedProviderEvent } from './providers/payment-provider.js';
import type { ProcessProviderEventResult } from './payments.event-processor.types.js';

type MarkFn = (
  tx: Prisma.TransactionClient,
  eventRowId: string,
  reason?: string,
) => Promise<void>;

const isPayableOrderStatus = (status: string): boolean =>
  status === 'REQUIRES_PAYMENT' || status === 'CHECKOUT_PENDING';

/**
 * Atomic settlement / failure / late-success for a CheckoutSession-owned attempt.
 * Verified provider success always becomes ledger truth (settle and/or allocate refunds).
 */
export const processSessionOwnedPaymentEvent = async (input: {
  tx: Prisma.TransactionClient;
  event: NormalizedProviderEvent;
  eventRowId: string;
  attempt: {
    id: string;
    status: string;
    provider: string;
    providerRef: string | null;
    amountMinor: number;
    currency: string;
    checkoutSessionId: string;
    succeededAt: Date | null;
  };
  markProcessed: MarkFn;
  markRejected: MarkFn;
}): Promise<ProcessProviderEventResult | null> => {
  const { tx, event, eventRowId, attempt, markProcessed, markRejected } = input;
  const now = new Date();

  const session = await tx.paymentCheckoutSession.findUnique({
    where: { id: attempt.checkoutSessionId },
    include: {
      items: {
        include: { paymentOrder: true },
      },
    },
  });

  if (!session) {
    await markRejected(tx, eventRowId, 'CHECKOUT_SESSION_NOT_FOUND');
    return {
      processingStatus: 'REJECTED',
      reason: 'CHECKOUT_SESSION_NOT_FOUND',
      paymentAttemptId: attempt.id,
      checkoutSessionId: attempt.checkoutSessionId,
    };
  }

  const orderIds = session.items.map((item) => item.paymentOrderId);
  const primaryOrderId = orderIds[0];

  if (event.provider !== attempt.provider) {
    await markRejected(tx, eventRowId, 'PROVIDER_MISMATCH');
    return {
      processingStatus: 'REJECTED',
      reason: 'PROVIDER_MISMATCH',
      paymentAttemptId: attempt.id,
      checkoutSessionId: session.id,
      paymentOrderId: primaryOrderId,
      paymentOrderIds: orderIds,
    };
  }

  if (event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED) {
    if (!event.paymentAttemptId) {
      await markRejected(tx, eventRowId, 'MISSING_ATTEMPT_ID');
      return { processingStatus: 'REJECTED', reason: 'MISSING_ATTEMPT_ID' };
    }
    if (!event.providerRef) {
      await markRejected(tx, eventRowId, 'MISSING_PROVIDER_REF');
      return { processingStatus: 'REJECTED', reason: 'MISSING_PROVIDER_REF' };
    }
    if (event.amountMinor == null) {
      await markRejected(tx, eventRowId, 'MISSING_AMOUNT');
      return { processingStatus: 'REJECTED', reason: 'MISSING_AMOUNT' };
    }
    if (!event.currency) {
      await markRejected(tx, eventRowId, 'MISSING_CURRENCY');
      return { processingStatus: 'REJECTED', reason: 'MISSING_CURRENCY' };
    }

    if (event.amountMinor !== attempt.amountMinor) {
      await markRejected(tx, eventRowId, 'AMOUNT_MISMATCH');
      return {
        processingStatus: 'REJECTED',
        reason: 'AMOUNT_MISMATCH',
        paymentAttemptId: attempt.id,
        checkoutSessionId: session.id,
        paymentOrderIds: orderIds,
      };
    }

    if (event.amountMinor !== session.totalAmountMinor) {
      await markRejected(tx, eventRowId, 'SESSION_AMOUNT_MISMATCH');
      return {
        processingStatus: 'REJECTED',
        reason: 'SESSION_AMOUNT_MISMATCH',
        paymentAttemptId: attempt.id,
        checkoutSessionId: session.id,
        paymentOrderIds: orderIds,
      };
    }

    if (event.currency.toUpperCase() !== attempt.currency.toUpperCase()) {
      await markRejected(tx, eventRowId, 'CURRENCY_MISMATCH');
      return {
        processingStatus: 'REJECTED',
        reason: 'CURRENCY_MISMATCH',
        paymentAttemptId: attempt.id,
        checkoutSessionId: session.id,
        paymentOrderIds: orderIds,
      };
    }

    if (event.currency.toUpperCase() !== session.currency.toUpperCase()) {
      await markRejected(tx, eventRowId, 'SESSION_CURRENCY_MISMATCH');
      return {
        processingStatus: 'REJECTED',
        reason: 'SESSION_CURRENCY_MISMATCH',
        paymentAttemptId: attempt.id,
        checkoutSessionId: session.id,
        paymentOrderIds: orderIds,
      };
    }

    if (
      attempt.providerRef != null &&
      event.providerRef !== attempt.providerRef
    ) {
      await markRejected(tx, eventRowId, 'PROVIDER_REF_MISMATCH');
      return {
        processingStatus: 'REJECTED',
        reason: 'PROVIDER_REF_MISMATCH',
        paymentAttemptId: attempt.id,
        checkoutSessionId: session.id,
        paymentOrderIds: orderIds,
      };
    }

    // Fully settled + no open refunds → idempotent no-op.
    const allSettledClean = session.items.every(
      (item) =>
        item.status === 'SETTLED' &&
        (item.paymentOrder.status === 'PAID' ||
          item.paymentOrder.status === 'REFUND_PENDING' ||
          item.paymentOrder.status === 'REFUNDED'),
    );
    if (attempt.status === 'SUCCEEDED' && session.status === 'SUCCEEDED' && allSettledClean) {
      const anyRefundPending = session.items.some(
        (item) => item.paymentOrder.status === 'REFUND_PENDING',
      );
      await markProcessed(tx, eventRowId, 'IDEMPOTENT_SUCCESS');
      return {
        processingStatus: 'PROCESSED',
        reason: 'IDEMPOTENT_SUCCESS',
        paymentAttemptId: attempt.id,
        checkoutSessionId: session.id,
        paymentOrderId: primaryOrderId,
        paymentOrderIds: orderIds,
        postCommitAutoRefund: anyRefundPending,
        postCommitAutoRefundOrderIds: anyRefundPending
          ? session.items
              .filter((item) => item.paymentOrder.status === 'REFUND_PENDING')
              .map((item) => item.paymentOrderId)
          : undefined,
      };
    }

    // Snapshot integrity for every item (amounts/purposes immutable).
    let itemsMinorSum = 0;
    for (const item of session.items) {
      itemsMinorSum += item.amountMinor;
      const order = item.paymentOrder;
      if (moneyDecimalToMinorUnits(order.amount) !== item.amountMinor) {
        await markRejected(tx, eventRowId, 'ITEM_AMOUNT_SNAPSHOT_MISMATCH');
        return {
          processingStatus: 'REJECTED',
          reason: 'ITEM_AMOUNT_SNAPSHOT_MISMATCH',
          paymentAttemptId: attempt.id,
          checkoutSessionId: session.id,
          paymentOrderIds: orderIds,
        };
      }
      if (order.currency.toUpperCase() !== item.currency.toUpperCase()) {
        await markRejected(tx, eventRowId, 'ITEM_CURRENCY_SNAPSHOT_MISMATCH');
        return {
          processingStatus: 'REJECTED',
          reason: 'ITEM_CURRENCY_SNAPSHOT_MISMATCH',
          paymentAttemptId: attempt.id,
          checkoutSessionId: session.id,
          paymentOrderIds: orderIds,
        };
      }
      if (order.purpose !== item.purpose) {
        await markRejected(tx, eventRowId, 'ITEM_PURPOSE_SNAPSHOT_MISMATCH');
        return {
          processingStatus: 'REJECTED',
          reason: 'ITEM_PURPOSE_SNAPSHOT_MISMATCH',
          paymentAttemptId: attempt.id,
          checkoutSessionId: session.id,
          paymentOrderIds: orderIds,
        };
      }
    }
    if (itemsMinorSum !== session.totalAmountMinor) {
      await markRejected(tx, eventRowId, 'SESSION_ITEMS_SUM_MISMATCH');
      return {
        processingStatus: 'REJECTED',
        reason: 'SESSION_ITEMS_SUM_MISMATCH',
        paymentAttemptId: attempt.id,
        checkoutSessionId: session.id,
        paymentOrderIds: orderIds,
      };
    }

    // Always record the successful provider charge on the attempt.
    if (attempt.status !== 'SUCCEEDED') {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'SUCCEEDED',
          succeededAt: attempt.succeededAt ?? now,
          failureCode: null,
          failureMessage: null,
          providerRef: attempt.providerRef ?? event.providerRef,
        },
      });
    } else if (!attempt.providerRef && event.providerRef) {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { providerRef: event.providerRef },
      });
    }

    const settledOrderIds: string[] = [];
    const refundOrderIds: string[] = [];
    const duplicateRefundOrderIds: string[] = [];
    let anyAutoRefund = false;
    let resolutionRequired = false;

    for (const item of session.items) {
      const order = item.paymentOrder;

      if (
        order.status === 'REFUNDED' ||
        (order.status === 'REFUND_PENDING' && item.status !== 'PENDING')
      ) {
        if (item.status === 'PENDING') {
          await tx.paymentCheckoutSessionItem.update({
            where: { id: item.id },
            data: {
              status: order.status === 'REFUNDED' ? 'REFUNDED' : 'SETTLED',
            },
          });
        }
        if (order.status === 'REFUND_PENDING') {
          refundOrderIds.push(order.id);
          anyAutoRefund = true;
        }
        continue;
      }

      if (order.status === 'PAID' && item.status === 'SETTLED') {
        settledOrderIds.push(order.id);
        continue;
      }

      // Defense-in-depth: order already PAID by a different successful charge.
      // Do not treat this session allocation as a normal settle — refund it.
      if (order.status === 'PAID' && item.status === 'PENDING') {
        const otherSucceeded = await tx.paymentAttempt.findFirst({
          where: {
            status: 'SUCCEEDED',
            OR: [
              { paymentOrderId: order.id, id: { not: attempt.id } },
              {
                id: { not: attempt.id },
                checkoutSession: {
                  items: {
                    some: {
                      paymentOrderId: order.id,
                      status: 'SETTLED',
                    },
                  },
                },
              },
            ],
          },
        });

        if (otherSucceeded || order.paidAt) {
          await tx.paymentCheckoutSessionItem.update({
            where: { id: item.id },
            data: { status: 'SETTLED' },
          });
          duplicateRefundOrderIds.push(order.id);
          refundOrderIds.push(order.id);
          anyAutoRefund = true;
          continue;
        }
      }

      const needsAutoRefund =
        order.status === 'CANCELLED' ||
        (await isSourceTerminalForLateSuccess(tx, {
          id: order.id,
          purpose: order.purpose,
          reservationId: order.reservationId,
          deliveryGroupId: order.deliveryGroupId,
        }));

      if (needsAutoRefund) {
        await prepareLateSuccessAutoRefundInTransaction(tx, {
          orderId: order.id,
          succeededAttemptId: attempt.id,
          paidAt: now,
        });
        await tx.paymentCheckoutSessionItem.update({
          where: { id: item.id },
          data: { status: 'SETTLED' },
        });
        refundOrderIds.push(order.id);
        anyAutoRefund = true;
        continue;
      }

      if (isPayableOrderStatus(order.status)) {
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paidAt: order.paidAt ?? now,
          },
        });
        await tx.paymentCheckoutSessionItem.update({
          where: { id: item.id },
          data: { status: 'SETTLED' },
        });
        settledOrderIds.push(order.id);
        continue;
      }

      // Unexpected terminal without auto-refund eligibility → resolution.
      resolutionRequired = true;
      await tx.paymentCheckoutSessionItem.update({
        where: { id: item.id },
        data: { status: 'SETTLED' },
      });
      if (order.status !== 'PAID' && order.status !== 'REFUND_PENDING') {
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: 'PAID',
            paidAt: order.paidAt ?? now,
          },
        });
        settledOrderIds.push(order.id);
      }
    }

    await tx.paymentCheckoutSession.update({
      where: { id: session.id },
      data: {
        status: 'SUCCEEDED',
        succeededAt: session.succeededAt ?? now,
      },
    });

    const reason = duplicateRefundOrderIds.length > 0
      ? 'LATE_SUCCESS_DUPLICATE_ALLOCATION_REFUND'
      : anyAutoRefund
        ? refundOrderIds.length === session.items.length
          ? 'LATE_SUCCESS_AFTER_SOURCE_TERMINAL'
          : 'LATE_SUCCESS_MIXED_ALLOCATION_REFUND'
        : resolutionRequired
          ? 'LATE_SUCCESS_RESOLUTION_REQUIRED'
          : undefined;

    await markProcessed(tx, eventRowId, reason);
    return {
      processingStatus: 'PROCESSED',
      reason,
      paymentAttemptId: attempt.id,
      checkoutSessionId: session.id,
      paymentOrderId: primaryOrderId,
      paymentOrderIds: [...new Set([...settledOrderIds, ...refundOrderIds])],
      postCommitAutoRefund: anyAutoRefund,
      postCommitAutoRefundOrderIds: anyAutoRefund
        ? [...new Set(refundOrderIds)]
        : undefined,
      postCommitDuplicateAllocationOrderIds:
        duplicateRefundOrderIds.length > 0
          ? [...new Set(duplicateRefundOrderIds)]
          : undefined,
    };
  }

  if (
    event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_DECLINED ||
    event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_CANCELLED ||
    event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_EXPIRED
  ) {
    if (
      session.status === 'SUCCEEDED' ||
      attempt.status === 'SUCCEEDED' ||
      session.items.some(
        (item) =>
          item.paymentOrder.status === 'PAID' ||
          item.paymentOrder.status === 'REFUND_PENDING' ||
          item.paymentOrder.status === 'REFUNDED',
      )
    ) {
      await markProcessed(tx, eventRowId, 'LATE_FAILURE_IGNORED');
      return {
        processingStatus: 'PROCESSED',
        reason: 'LATE_FAILURE_IGNORED',
        paymentAttemptId: attempt.id,
        checkoutSessionId: session.id,
        paymentOrderId: primaryOrderId,
        paymentOrderIds: orderIds,
      };
    }

    const attemptStatus =
      event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_CANCELLED
        ? 'CANCELLED'
        : event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_EXPIRED
          ? 'EXPIRED'
          : 'FAILED';

    const sessionStatus =
      event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_CANCELLED
        ? 'CANCELLED'
        : event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_EXPIRED
          ? 'EXPIRED'
          : 'FAILED';

    if (attempt.status === 'CREATED' || attempt.status === 'PENDING') {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: attemptStatus,
          failureCode: attemptStatus,
          failureMessage: `Provider reported ${event.eventType}`,
        },
      });
    }

    if (session.status === 'CREATED' || session.status === 'CHECKOUT_PENDING') {
      await tx.paymentCheckoutSession.update({
        where: { id: session.id },
        data: { status: sessionStatus },
      });

      for (const item of session.items) {
        if (item.status === 'PENDING') {
          await tx.paymentCheckoutSessionItem.update({
            where: { id: item.id },
            data: { status: 'CANCELLED' },
          });
        }
        if (
          item.paymentOrder.status === 'CHECKOUT_PENDING' ||
          item.paymentOrder.status === 'REQUIRES_PAYMENT'
        ) {
          await tx.paymentOrder.update({
            where: { id: item.paymentOrderId },
            data: { status: 'REQUIRES_PAYMENT' },
          });
        }
      }
    }

    await markProcessed(tx, eventRowId);
    return {
      processingStatus: 'PROCESSED',
      paymentAttemptId: attempt.id,
      checkoutSessionId: session.id,
      paymentOrderId: primaryOrderId,
      paymentOrderIds: orderIds,
    };
  }

  if (event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_PENDING) {
    if (attempt.status === 'SUCCEEDED' || session.status === 'SUCCEEDED') {
      await markProcessed(tx, eventRowId, 'LATE_PENDING_SUCCEEDED_ATTEMPT');
      return {
        processingStatus: 'PROCESSED',
        reason: 'LATE_PENDING_SUCCEEDED_ATTEMPT',
        paymentAttemptId: attempt.id,
        checkoutSessionId: session.id,
        paymentOrderId: primaryOrderId,
        paymentOrderIds: orderIds,
      };
    }

    if (attempt.status === 'CREATED' || attempt.status === 'PENDING') {
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'PENDING' },
      });
    }

    await markProcessed(tx, eventRowId);
    return {
      processingStatus: 'PROCESSED',
      paymentAttemptId: attempt.id,
      checkoutSessionId: session.id,
      paymentOrderId: primaryOrderId,
      paymentOrderIds: orderIds,
    };
  }

  return null;
};
