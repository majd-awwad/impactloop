import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

import { PROVIDER_EVENT_TYPES } from './payments.constants.js';
import { moneyDecimalToMinorUnits } from './payments.money.js';
import type { NormalizedProviderEvent } from './providers/payment-provider.js';
import {
  evaluateMaterialLateSuccessAction,
  evaluateDeliveryFeeRefundEligibility,
  isSourceTerminalForLateSuccess,
  prepareLateSuccessAutoRefundInTransaction,
} from './payments.lifecycle.js';
import { LIFECYCLE_REFUND_REASONS } from './payments.lifecycle.policy.js';
import { processSessionOwnedPaymentEvent } from './payments.session-settlement.js';

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

const decideLateSuccessAutoRefund = async (
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    purpose: string;
    reservationId: string | null;
    deliveryGroupId: string | null;
  },
): Promise<{
  autoRefund: boolean;
  reason: string;
}> => {
  if (order.purpose === 'MATERIAL_SUBTOTAL' && order.reservationId) {
    const action = await evaluateMaterialLateSuccessAction(
      tx,
      order.reservationId,
      order.id,
    );
    if (action === 'AUTO_REFUND') {
      return {
        autoRefund: true,
        reason: LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_AFTER_SOURCE_TERMINAL,
      };
    }
    if (action === 'FULFILLED_NO_REFUND') {
      return {
        autoRefund: false,
        reason: 'LATE_SUCCESS_AFTER_FULFILLED_NO_REFUND',
      };
    }
    if (action === 'RESOLUTION_REQUIRED') {
      return {
        autoRefund: false,
        reason: LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_RESOLUTION_REQUIRED,
      };
    }
    return { autoRefund: false, reason: 'LATE_SUCCESS_SOURCE_ACTIVE' };
  }

  if (order.purpose === 'DELIVERY_FEE' && order.deliveryGroupId) {
    const eligibility = await evaluateDeliveryFeeRefundEligibility(
      tx,
      order.deliveryGroupId,
    );
    if (
      eligibility.eligibility === 'GROUP_EMPTY_CANCEL_UNPAID' ||
      eligibility.eligibility === 'GROUP_EMPTY_REFUND_PAID' ||
      eligibility.eligibility === 'FEE_ALREADY_CANCELLED' ||
      eligibility.eligibility === 'NO_FEE_ORDER'
    ) {
      return {
        autoRefund: true,
        reason: LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_AFTER_SOURCE_TERMINAL,
      };
    }
    if (
      eligibility.eligibility === 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED'
    ) {
      return {
        autoRefund: false,
        reason: LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_RESOLUTION_REQUIRED,
      };
    }
    return { autoRefund: false, reason: 'LATE_SUCCESS_FEE_STILL_REQUIRED' };
  }

  return { autoRefund: false, reason: 'LATE_SUCCESS_UNKNOWN_PURPOSE' };
};

const applyLateSuccessOutcome = async (
  tx: Prisma.TransactionClient,
  input: {
    eventRowId: string;
    order: {
      id: string;
      purpose: string;
      reservationId: string | null;
      deliveryGroupId: string | null;
    };
    attempt: { id: string; providerRef: string | null };
    eventProviderRef: string | null;
    now: Date;
  },
): Promise<ProcessProviderEventResult> => {
  await tx.paymentAttempt.update({
    where: { id: input.attempt.id },
    data: {
      status: 'SUCCEEDED',
      succeededAt: input.now,
      failureCode: null,
      failureMessage: null,
      providerRef: input.attempt.providerRef ?? input.eventProviderRef,
    },
  });

  const decision = await decideLateSuccessAutoRefund(tx, input.order);
  if (decision.autoRefund) {
    await prepareLateSuccessAutoRefundInTransaction(tx, {
      orderId: input.order.id,
      succeededAttemptId: input.attempt.id,
      paidAt: input.now,
    });
  }

  await markProcessed(tx, input.eventRowId, decision.reason);
  return {
    processingStatus: 'PROCESSED',
    reason: decision.reason,
    paymentOrderId: input.order.id,
    paymentAttemptId: input.attempt.id,
    postCommitAutoRefund: decision.autoRefund,
  };
};

const redactedPayload = (
  event: NormalizedProviderEvent,
): Prisma.InputJsonValue => ({
  type: event.eventType,
  attemptId: event.paymentAttemptId,
  providerRef: event.providerRef,
  amountMinor: event.amountMinor,
  currency: event.currency,
  providerRefundRef:
    typeof event.payload.providerRefundRef === 'string'
      ? event.payload.providerRefundRef
      : null,
  failureCode:
    typeof event.payload.failureCode === 'string'
      ? event.payload.failureCode
      : null,
});

export type ProcessProviderEventResult = {
  processingStatus:
    | 'PROCESSED'
    | 'IGNORED_DUPLICATE'
    | 'REJECTED'
    | 'RECEIVED';
  paymentOrderId?: string;
  /** All orders settled by a session-owned attempt (PAY-05D). */
  paymentOrderIds?: string[];
  checkoutSessionId?: string;
  paymentAttemptId?: string | null;
  reason?: string;
  /** When set, post-commit hook must start refund orchestration (not fulfillment). */
  postCommitAutoRefund?: boolean;
  /** Allocation-aware late-success refunds for one or more session items. */
  postCommitAutoRefundOrderIds?: string[];
  /**
   * Orders already PAID by another charge — refund the session allocation only
   * and keep the order PAID (PAY-05D-R2 double-charge defense).
   */
  postCommitDuplicateAllocationOrderIds?: string[];
};

const markRejected = async (
  tx: Prisma.TransactionClient,
  eventRowId: string,
  error: string = 'REJECTED',
) => {
  await tx.paymentProviderEvent.update({
    where: { id: eventRowId },
    data: {
      processingStatus: 'REJECTED',
      processingError: error,
      processedAt: new Date(),
    },
  });
};

const markProcessed = async (
  tx: Prisma.TransactionClient,
  eventRowId: string,
  reason?: string,
) => {
  await tx.paymentProviderEvent.update({
    where: { id: eventRowId },
    data: {
      processingStatus: 'PROCESSED',
      processingError: reason ?? null,
      processedAt: new Date(),
    },
  });
};

const requirePaymentSuccessFields = (
  event: NormalizedProviderEvent,
): string | null => {
  if (!event.paymentAttemptId) return 'MISSING_ATTEMPT_ID';
  if (!event.providerRef) return 'MISSING_PROVIDER_REF';
  if (event.amountMinor == null) return 'MISSING_AMOUNT';
  if (!event.currency) return 'MISSING_CURRENCY';
  return null;
};

const requireRefundSuccessFields = (
  event: NormalizedProviderEvent,
): string | null => {
  if (!event.paymentAttemptId) return 'MISSING_ATTEMPT_ID';
  if (!event.providerRef) return 'MISSING_PROVIDER_REF';
  if (typeof event.payload.providerRefundRef !== 'string') {
    return 'MISSING_PROVIDER_REFUND_REF';
  }
  if (event.amountMinor == null) return 'MISSING_AMOUNT';
  if (!event.currency) return 'MISSING_CURRENCY';
  return null;
};

const requireDeclineIdentity = (
  event: NormalizedProviderEvent,
): string | null => {
  if (!event.paymentAttemptId) return 'MISSING_ATTEMPT_ID';
  return null;
};

const DUPLICATE_PROVIDER_EVENT = 'PAY_DUPLICATE_PROVIDER_EVENT';

export const processVerifiedProviderEvent = async (
  event: NormalizedProviderEvent,
  signatureValid: boolean,
): Promise<ProcessProviderEventResult> => {
  try {
    return await runSerializableTransaction(async (tx) => {
    let eventRow;
    try {
      // Never insert untrusted attempt IDs as FKs before resolution.
      eventRow = await tx.paymentProviderEvent.create({
        data: {
          provider: event.provider,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          paymentAttemptId: null,
          payloadJson: redactedPayload(event),
          signatureValid,
          processingStatus: 'RECEIVED',
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        // PostgreSQL aborts the transaction after a unique conflict; resolve
        // the existing row outside this transaction (see outer catch).
        const duplicate = new Error(DUPLICATE_PROVIDER_EVENT);
        (duplicate as { code?: string }).code = DUPLICATE_PROVIDER_EVENT;
        throw duplicate;
      }
      throw error;
    }

    if (!signatureValid) {
      await markRejected(tx, eventRow.id, 'INVALID_SIGNATURE');
      return { processingStatus: 'REJECTED', reason: 'INVALID_SIGNATURE' };
    }

    const externalAttemptId = event.paymentAttemptId;
    if (!externalAttemptId) {
      await markRejected(tx, eventRow.id, 'MISSING_ATTEMPT_ID');
      return { processingStatus: 'REJECTED', reason: 'MISSING_ATTEMPT_ID' };
    }

    const attempt = await tx.paymentAttempt.findUnique({
      where: { id: externalAttemptId },
      include: {
        paymentOrder: true,
        checkoutSession: {
          include: {
            items: { include: { paymentOrder: true } },
          },
        },
      },
    });

    if (!attempt) {
      await markRejected(tx, eventRow.id, 'ATTEMPT_NOT_FOUND');
      return { processingStatus: 'REJECTED', reason: 'ATTEMPT_NOT_FOUND' };
    }

    await tx.paymentProviderEvent.update({
      where: { id: eventRow.id },
      data: { paymentAttemptId: attempt.id },
    });

    // PAY-05D: session-owned attempts settle all included orders atomically.
    if (attempt.checkoutSessionId) {
      const isRefundEvent =
        event.eventType === PROVIDER_EVENT_TYPES.REFUND_PENDING ||
        event.eventType === PROVIDER_EVENT_TYPES.REFUND_SUCCEEDED ||
        event.eventType === PROVIDER_EVENT_TYPES.REFUND_FAILED;

      if (!isRefundEvent) {
        const sessionResult = await processSessionOwnedPaymentEvent({
          tx,
          event,
          eventRowId: eventRow.id,
          attempt: {
            id: attempt.id,
            status: attempt.status,
            provider: attempt.provider,
            providerRef: attempt.providerRef,
            amountMinor: attempt.amountMinor,
            currency: attempt.currency,
            checkoutSessionId: attempt.checkoutSessionId,
            succeededAt: attempt.succeededAt,
          },
          markProcessed,
          markRejected,
        });
        if (sessionResult) {
          return sessionResult;
        }
      }
    }

    // Resolve order: legacy order-owned attempt, or refund target for session attempt.
    let order = attempt.paymentOrder;
    if (!order) {
      const refundRows = await tx.paymentRefund.findMany({
        where: { paymentAttemptId: attempt.id },
        include: { paymentOrder: true },
        orderBy: { requestedAt: 'desc' },
      });
      const providerRefundRef =
        typeof event.payload.providerRefundRef === 'string'
          ? event.payload.providerRefundRef
          : null;
      const byRef = providerRefundRef
        ? refundRows.find((row) => row.providerRefundRef === providerRefundRef)
        : null;
      const byAmount =
        event.amountMinor != null
          ? refundRows.find(
              (row) =>
                moneyDecimalToMinorUnits(row.amount) === event.amountMinor,
            )
          : null;
      order =
        byRef?.paymentOrder ??
        byAmount?.paymentOrder ??
        refundRows[0]?.paymentOrder ??
        null;
    }

    if (!order) {
      await markRejected(tx, eventRow.id, 'ORDER_NOT_FOUND_FOR_ATTEMPT');
      return {
        processingStatus: 'REJECTED',
        reason: 'ORDER_NOT_FOUND_FOR_ATTEMPT',
        paymentAttemptId: attempt.id,
        checkoutSessionId: attempt.checkoutSessionId ?? undefined,
      };
    }

    const orderAmountMinor = moneyDecimalToMinorUnits(order.amount);
    const now = new Date();

    if (event.provider !== attempt.provider) {
      await markRejected(tx, eventRow.id, 'PROVIDER_MISMATCH');
      return {
        processingStatus: 'REJECTED',
        reason: 'PROVIDER_MISMATCH',
        paymentOrderId: order.id,
        paymentAttemptId: attempt.id,
      };
    }

    if (event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_SUCCEEDED) {
      // Session-owned attempts never reach this branch for payment events.
      if (attempt.checkoutSessionId) {
        await markRejected(tx, eventRow.id, 'SESSION_PAYMENT_PATH_REQUIRED');
        return {
          processingStatus: 'REJECTED',
          reason: 'SESSION_PAYMENT_PATH_REQUIRED',
          paymentAttemptId: attempt.id,
          checkoutSessionId: attempt.checkoutSessionId,
        };
      }

      const missing = requirePaymentSuccessFields(event);
      if (missing) {
        await markRejected(tx, eventRow.id, missing);
        return {
          processingStatus: 'REJECTED',
          reason: missing,
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (event.amountMinor !== attempt.amountMinor) {
        await markRejected(tx, eventRow.id, 'AMOUNT_MISMATCH');
        return {
          processingStatus: 'REJECTED',
          reason: 'AMOUNT_MISMATCH',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (event.amountMinor !== orderAmountMinor) {
        await markRejected(tx, eventRow.id, 'ORDER_AMOUNT_MISMATCH');
        return {
          processingStatus: 'REJECTED',
          reason: 'ORDER_AMOUNT_MISMATCH',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (event.currency!.toUpperCase() !== attempt.currency.toUpperCase()) {
        await markRejected(tx, eventRow.id, 'CURRENCY_MISMATCH');
        return {
          processingStatus: 'REJECTED',
          reason: 'CURRENCY_MISMATCH',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (event.currency!.toUpperCase() !== order.currency.toUpperCase()) {
        await markRejected(tx, eventRow.id, 'ORDER_CURRENCY_MISMATCH');
        return {
          processingStatus: 'REJECTED',
          reason: 'ORDER_CURRENCY_MISMATCH',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (
        attempt.providerRef != null &&
        event.providerRef !== attempt.providerRef
      ) {
        await markRejected(tx, eventRow.id, 'PROVIDER_REF_MISMATCH');
        return {
          processingStatus: 'REJECTED',
          reason: 'PROVIDER_REF_MISMATCH',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (attempt.status === 'SUCCEEDED' && order.status === 'PAID') {
        await markProcessed(tx, eventRow.id, 'IDEMPOTENT_SUCCESS');
        return {
          processingStatus: 'PROCESSED',
          reason: 'IDEMPOTENT_SUCCESS',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (
        order.status === 'PAID' ||
        order.status === 'REFUND_PENDING' ||
        order.status === 'REFUNDED'
      ) {
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
        }

        await markProcessed(tx, eventRow.id, 'DUPLICATE_SUCCESS_DIFFERENT_ATTEMPT');
        return {
          processingStatus: 'PROCESSED',
          reason: 'DUPLICATE_SUCCESS_DIFFERENT_ATTEMPT',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (order.status === 'CANCELLED') {
        return applyLateSuccessOutcome(tx, {
          eventRowId: eventRow.id,
          order: {
            id: order.id,
            purpose: order.purpose,
            reservationId: order.reservationId,
            deliveryGroupId: order.deliveryGroupId,
          },
          attempt: {
            id: attempt.id,
            providerRef: attempt.providerRef,
          },
          eventProviderRef: event.providerRef,
          now,
        });
      }

      if (attempt.status !== 'CREATED' && attempt.status !== 'PENDING') {
        await markProcessed(tx, eventRow.id, 'LATE_SUCCESS_INACTIVE_ATTEMPT');
        return {
          processingStatus: 'PROCESSED',
          reason: 'LATE_SUCCESS_INACTIVE_ATTEMPT',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      // Source already terminal / resolution while order still unpaid.
      if (
        await isSourceTerminalForLateSuccess(tx, {
          id: order.id,
          purpose: order.purpose,
          reservationId: order.reservationId,
          deliveryGroupId: order.deliveryGroupId,
        })
      ) {
        return applyLateSuccessOutcome(tx, {
          eventRowId: eventRow.id,
          order: {
            id: order.id,
            purpose: order.purpose,
            reservationId: order.reservationId,
            deliveryGroupId: order.deliveryGroupId,
          },
          attempt: {
            id: attempt.id,
            providerRef: attempt.providerRef,
          },
          eventProviderRef: event.providerRef,
          now,
        });
      }

      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'SUCCEEDED',
          succeededAt: now,
          failureCode: null,
          failureMessage: null,
          providerRef: attempt.providerRef ?? event.providerRef,
        },
      });

      await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      });

      await markProcessed(tx, eventRow.id);
      return {
        processingStatus: 'PROCESSED',
        paymentOrderId: order.id,
        paymentAttemptId: attempt.id,
      };
    }

    if (
      event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_DECLINED ||
      event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_CANCELLED ||
      event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_EXPIRED
    ) {
      if (attempt.checkoutSessionId) {
        await markRejected(tx, eventRow.id, 'SESSION_PAYMENT_PATH_REQUIRED');
        return {
          processingStatus: 'REJECTED',
          reason: 'SESSION_PAYMENT_PATH_REQUIRED',
          paymentAttemptId: attempt.id,
          checkoutSessionId: attempt.checkoutSessionId,
        };
      }

      const missing = requireDeclineIdentity(event);
      if (missing) {
        await markRejected(tx, eventRow.id, missing);
        return { processingStatus: 'REJECTED', reason: missing };
      }

      if (
        order.status === 'PAID' ||
        order.status === 'REFUND_PENDING' ||
        order.status === 'REFUNDED'
      ) {
        await markProcessed(tx, eventRow.id, 'LATE_FAILURE_IGNORED');
        return {
          processingStatus: 'PROCESSED',
          reason: 'LATE_FAILURE_IGNORED',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (attempt.status === 'SUCCEEDED') {
        await markProcessed(tx, eventRow.id, 'LATE_FAILURE_SUCCEEDED_ATTEMPT');
        return {
          processingStatus: 'PROCESSED',
          reason: 'LATE_FAILURE_SUCCEEDED_ATTEMPT',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      const attemptStatus =
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

      if (
        order.status === 'CHECKOUT_PENDING' ||
        order.status === 'REQUIRES_PAYMENT'
      ) {
        const activePending = await tx.paymentAttempt.count({
          where: {
            paymentOrderId: order.id,
            status: { in: ['CREATED', 'PENDING'] },
            id: { not: attempt.id },
          },
        });

        if (activePending === 0) {
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: 'REQUIRES_PAYMENT' },
          });
        }
      }

      await markProcessed(tx, eventRow.id);
      return {
        processingStatus: 'PROCESSED',
        paymentOrderId: order.id,
        paymentAttemptId: attempt.id,
      };
    }

    if (event.eventType === PROVIDER_EVENT_TYPES.PAYMENT_PENDING) {
      if (attempt.checkoutSessionId) {
        await markRejected(tx, eventRow.id, 'SESSION_PAYMENT_PATH_REQUIRED');
        return {
          processingStatus: 'REJECTED',
          reason: 'SESSION_PAYMENT_PATH_REQUIRED',
          paymentAttemptId: attempt.id,
          checkoutSessionId: attempt.checkoutSessionId,
        };
      }

      if (attempt.status === 'SUCCEEDED') {
        await markProcessed(tx, eventRow.id, 'LATE_PENDING_SUCCEEDED_ATTEMPT');
        return {
          processingStatus: 'PROCESSED',
          reason: 'LATE_PENDING_SUCCEEDED_ATTEMPT',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (
        order.status === 'PAID' ||
        order.status === 'REFUND_PENDING' ||
        order.status === 'REFUNDED'
      ) {
        await markProcessed(tx, eventRow.id, 'LATE_PENDING_IGNORED');
        return {
          processingStatus: 'PROCESSED',
          reason: 'LATE_PENDING_IGNORED',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (attempt.status === 'CREATED' || attempt.status === 'PENDING') {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'PENDING' },
        });
      }

      await markProcessed(tx, eventRow.id);
      return {
        processingStatus: 'PROCESSED',
        paymentOrderId: order.id,
        paymentAttemptId: attempt.id,
      };
    }

    if (
      event.eventType === PROVIDER_EVENT_TYPES.REFUND_PENDING ||
      event.eventType === PROVIDER_EVENT_TYPES.REFUND_SUCCEEDED ||
      event.eventType === PROVIDER_EVENT_TYPES.REFUND_FAILED
    ) {
      // Prefer refund tied to this order; for session attempts, match by order.
      const refund = await tx.paymentRefund.findUnique({
        where: { paymentOrderId: order.id },
      });

      if (!refund) {
        await markRejected(tx, eventRow.id, 'REFUND_NOT_FOUND');
        return {
          processingStatus: 'REJECTED',
          reason: 'REFUND_NOT_FOUND',
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (
        refund.status === 'SUCCEEDED' ||
        order.status === 'REFUNDED'
      ) {
        const reason =
          event.eventType === PROVIDER_EVENT_TYPES.REFUND_PENDING
            ? 'LATE_REFUND_PENDING_IGNORED'
            : event.eventType === PROVIDER_EVENT_TYPES.REFUND_FAILED
              ? 'LATE_REFUND_FAILED_IGNORED'
              : 'IDEMPOTENT_REFUND_SUCCESS';
        await markProcessed(tx, eventRow.id, reason);
        return {
          processingStatus: 'PROCESSED',
          reason,
          paymentOrderId: order.id,
          paymentAttemptId: attempt.id,
        };
      }

      if (event.eventType === PROVIDER_EVENT_TYPES.REFUND_PENDING) {
        await tx.paymentRefund.update({
          where: { id: refund.id },
          data: { status: 'PENDING' },
        });
        if (order.status === 'PAID' || order.status === 'REFUND_PENDING') {
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: 'REFUND_PENDING' },
          });
        }
      } else if (event.eventType === PROVIDER_EVENT_TYPES.REFUND_SUCCEEDED) {
        const missing = requireRefundSuccessFields(event);
        if (missing) {
          await markRejected(tx, eventRow.id, missing);
          return {
            processingStatus: 'REJECTED',
            reason: missing,
            paymentOrderId: order.id,
            paymentAttemptId: attempt.id,
          };
        }

        const refundAmountMinor = moneyDecimalToMinorUnits(refund.amount);

        // Allocation-aware: refund amount must match the obligation, not the
        // combined session charge when the attempt is session-owned.
        if (event.amountMinor !== refundAmountMinor) {
          await markRejected(tx, eventRow.id, 'AMOUNT_MISMATCH');
          return {
            processingStatus: 'REJECTED',
            reason: 'AMOUNT_MISMATCH',
            paymentOrderId: order.id,
            paymentAttemptId: attempt.id,
          };
        }

        if (event.amountMinor !== orderAmountMinor) {
          await markRejected(tx, eventRow.id, 'ORDER_AMOUNT_MISMATCH');
          return {
            processingStatus: 'REJECTED',
            reason: 'ORDER_AMOUNT_MISMATCH',
            paymentOrderId: order.id,
            paymentAttemptId: attempt.id,
          };
        }

        if (!attempt.checkoutSessionId && event.amountMinor !== attempt.amountMinor) {
          await markRejected(tx, eventRow.id, 'ATTEMPT_AMOUNT_MISMATCH');
          return {
            processingStatus: 'REJECTED',
            reason: 'ATTEMPT_AMOUNT_MISMATCH',
            paymentOrderId: order.id,
            paymentAttemptId: attempt.id,
          };
        }

        if (event.currency!.toUpperCase() !== order.currency.toUpperCase()) {
          await markRejected(tx, eventRow.id, 'CURRENCY_MISMATCH');
          return {
            processingStatus: 'REJECTED',
            reason: 'CURRENCY_MISMATCH',
            paymentOrderId: order.id,
            paymentAttemptId: attempt.id,
          };
        }

        // Track allocation on session item when present.
        if (attempt.checkoutSessionId) {
          const item = await tx.paymentCheckoutSessionItem.findFirst({
            where: {
              checkoutSessionId: attempt.checkoutSessionId,
              paymentOrderId: order.id,
            },
          });
          if (item) {
            const nextRefunded = item.refundedAmountMinor + refundAmountMinor;
            if (nextRefunded > item.amountMinor) {
              await markRejected(tx, eventRow.id, 'REFUND_EXCEEDS_ALLOCATION');
              return {
                processingStatus: 'REJECTED',
                reason: 'REFUND_EXCEEDS_ALLOCATION',
                paymentOrderId: order.id,
                paymentAttemptId: attempt.id,
                checkoutSessionId: attempt.checkoutSessionId,
              };
            }
            await tx.paymentCheckoutSessionItem.update({
              where: { id: item.id },
              data: {
                refundedAmountMinor: nextRefunded,
                status:
                  nextRefunded >= item.amountMinor ? 'REFUNDED' : item.status,
              },
            });
          }
        }

        await tx.paymentRefund.update({
          where: { id: refund.id },
          data: {
            status: 'SUCCEEDED',
            succeededAt: now,
            providerRefundRef:
              typeof event.payload.providerRefundRef === 'string'
                ? event.payload.providerRefundRef
                : refund.providerRefundRef,
            failureCode: null,
            failureMessage: null,
          },
        });

        await tx.paymentOrder.update({
          where: { id: order.id },
          data: {
            status: 'REFUNDED',
            refundedAt: now,
          },
        });
      } else {
        // REFUND_FAILED
        await tx.paymentRefund.update({
          where: { id: refund.id },
          data: {
            status: 'FAILED',
            failureCode:
              typeof event.payload.failureCode === 'string'
                ? event.payload.failureCode
                : 'REFUND_FAILED',
            failureMessage:
              typeof event.payload.failureMessage === 'string'
                ? event.payload.failureMessage
                : 'Provider refund failed',
          },
        });
        if (order.status === 'REFUND_PENDING') {
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: 'PAID' },
          });
        }
      }

      await markProcessed(tx, eventRow.id);
      return {
        processingStatus: 'PROCESSED',
        paymentOrderId: order.id,
        paymentAttemptId: attempt.id,
        checkoutSessionId: attempt.checkoutSessionId ?? undefined,
      };
    }

    await markRejected(tx, eventRow.id, 'UNSUPPORTED_EVENT_TYPE');
    return {
      processingStatus: 'REJECTED',
      reason: 'UNSUPPORTED_EVENT_TYPE',
      paymentOrderId: order.id,
      paymentAttemptId: attempt.id,
    };
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === DUPLICATE_PROVIDER_EVENT
    ) {
      const existingEvent = await prisma.paymentProviderEvent.findUnique({
        where: {
          provider_providerEventId: {
            provider: event.provider,
            providerEventId: event.providerEventId,
          },
        },
        select: {
          paymentAttemptId: true,
          paymentAttempt: {
            select: {
              paymentOrderId: true,
              checkoutSessionId: true,
              checkoutSession: {
                select: {
                  items: {
                    select: { paymentOrderId: true },
                    take: 1,
                    orderBy: { createdAt: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      let paymentOrderId =
        existingEvent?.paymentAttempt?.paymentOrderId ?? undefined;
      if (
        !paymentOrderId &&
        existingEvent?.paymentAttempt?.checkoutSession?.items[0]
      ) {
        paymentOrderId =
          existingEvent.paymentAttempt.checkoutSession.items[0].paymentOrderId;
      }

      if (!paymentOrderId && event.paymentAttemptId) {
        const attempt = await prisma.paymentAttempt.findUnique({
          where: { id: event.paymentAttemptId },
          select: {
            paymentOrderId: true,
            checkoutSessionId: true,
            checkoutSession: {
              select: {
                items: {
                  select: { paymentOrderId: true },
                  take: 1,
                  orderBy: { createdAt: 'asc' },
                },
              },
            },
          },
        });
        paymentOrderId =
          attempt?.paymentOrderId ??
          attempt?.checkoutSession?.items[0]?.paymentOrderId ??
          undefined;
      }

      return {
        processingStatus: 'IGNORED_DUPLICATE',
        paymentOrderId,
        paymentAttemptId:
          existingEvent?.paymentAttemptId ?? event.paymentAttemptId ?? null,
        checkoutSessionId:
          existingEvent?.paymentAttempt?.checkoutSessionId ?? undefined,
        reason: 'DUPLICATE_PROVIDER_EVENT',
      };
    }
    throw error;
  }
};
