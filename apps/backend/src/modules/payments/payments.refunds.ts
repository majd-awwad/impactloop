import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

import { LIFECYCLE_REFUND_REASONS } from './payments.lifecycle.policy.js';
import {
  notifyRefundFailed,
  notifyRefundRequested,
} from './payments.notifications.js';
import {
  moneyDecimalToMinorUnits,
  moneyDecimalToString,
} from './payments.money.js';
import { getPaymentProvider } from './providers/payment-provider.registry.js';
import { MockPaymentProvider } from './providers/mock/mock.provider.js';
import { signMockPayload } from './providers/mock/mock.hmac.js';
import { invokeProcessVerifiedProviderEvent } from './payments.event-processor.registry.js';

export const applyProviderRefundOutcome = async (input: {
  orderId: string;
  refundId: string;
  attemptId: string;
  providerRef: string;
  amountMinor: number;
  currency: string;
  refundRequest: {
    providerRefundRef: string;
    status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
    failureCode?: string;
    failureMessage?: string;
  };
}) => {
  const provider = getPaymentProvider();

  if (input.refundRequest.status === 'FAILED') {
    await prisma.paymentRefund.update({
      where: { id: input.refundId },
      data: {
        status: 'FAILED',
        providerRefundRef: input.refundRequest.providerRefundRef,
        failureCode: input.refundRequest.failureCode ?? 'PROVIDER_REFUND_FAILED',
        failureMessage:
          input.refundRequest.failureMessage ?? 'Provider refund failed',
      },
    });
    await prisma.paymentOrder.update({
      where: { id: input.orderId },
      data: { status: 'PAID' },
    });
    await notifyRefundFailed({
      paymentOrderId: input.orderId,
      refundId: input.refundId,
    });
    return {
      kind: 'CREATED' as const,
      orderId: input.orderId,
      refundId: input.refundId,
      status: 'FAILED' as const,
      amount: moneyDecimalToString(
        (
          await prisma.paymentRefund.findUniqueOrThrow({
            where: { id: input.refundId },
          })
        ).amount,
      ),
    };
  }

  await prisma.paymentRefund.update({
    where: { id: input.refundId },
    data: {
      status: 'PENDING',
      providerRefundRef: input.refundRequest.providerRefundRef,
      failureCode: null,
      failureMessage: null,
    },
  });

  if (provider instanceof MockPaymentProvider) {
    const outcome =
      input.refundRequest.status === 'SUCCEEDED' ? 'succeeded' : 'pending';
    const pendingEvent = provider.buildRefundEvent({
      outcome,
      attemptId: input.attemptId,
      providerRef: input.providerRef,
      providerRefundRef: input.refundRequest.providerRefundRef,
      amountMinor: input.amountMinor,
      currency: input.currency,
    });

    const rawPending = Buffer.from(JSON.stringify(pendingEvent.body), 'utf8');
    const ts = Math.floor(Date.now() / 1000);
    const pendingVerified = await provider.verifyAndNormalizeEvent({
      rawBody: rawPending,
      headers: {
        'x-impactloop-mock-signature': signMockPayload(ts, rawPending),
        'x-impactloop-mock-timestamp': String(ts),
      },
    });
    if (pendingVerified.ok) {
      await invokeProcessVerifiedProviderEvent(
        pendingVerified.event,
        pendingVerified.signatureValid,
      );
    }
  }

  const refund = await prisma.paymentRefund.findUniqueOrThrow({
    where: { id: input.refundId },
  });

  return {
    kind: 'CREATED' as const,
    orderId: input.orderId,
    refundId: input.refundId,
    status: refund.status,
    amount: moneyDecimalToString(refund.amount),
  };
};

/** Internal service — not exposed as a learner-facing PAY-01 HTTP route. */
export const requestFullRefundForPaidOrder = async (input: {
  orderId: string;
  reason?: string;
  actorUserId: string;
}) => {
  const provider = getPaymentProvider();

  const resolveSucceededAttemptForOrder = async (
    tx: Prisma.TransactionClient,
    orderId: string,
  ) => {
    const direct = await tx.paymentAttempt.findFirst({
      where: {
        paymentOrderId: orderId,
        status: 'SUCCEEDED',
      },
      orderBy: { succeededAt: 'desc' },
    });
    if (direct?.providerRef) {
      return {
        attempt: direct,
        amountMinor: moneyDecimalToMinorUnits(
          (
            await tx.paymentOrder.findUniqueOrThrow({ where: { id: orderId } })
          ).amount,
        ),
      };
    }

    const item = await tx.paymentCheckoutSessionItem.findFirst({
      where: {
        paymentOrderId: orderId,
        status: { in: ['SETTLED', 'REFUNDED'] },
        checkoutSession: { status: 'SUCCEEDED' },
      },
      include: {
        checkoutSession: {
          include: {
            attempts: {
              where: { status: 'SUCCEEDED' },
              orderBy: { succeededAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sessionAttempt = item?.checkoutSession.attempts[0];
    if (!sessionAttempt?.providerRef || !item) {
      return null;
    }

    const remaining = item.amountMinor - item.refundedAmountMinor;
    if (remaining <= 0) {
      throw new AppError(
        'Checkout allocation for this payment order is already fully refunded.',
        409,
        'REFUND_ALREADY_EXISTS',
      );
    }

    // Cumulative session refunds must not exceed the successful charge.
    const sessionItems = await tx.paymentCheckoutSessionItem.findMany({
      where: { checkoutSessionId: item.checkoutSessionId },
    });
    const alreadyRefunded = sessionItems.reduce(
      (sum, row) => sum + row.refundedAmountMinor,
      0,
    );
    if (alreadyRefunded + remaining > item.checkoutSession.totalAmountMinor) {
      throw new AppError(
        'Refund would exceed the successful checkout session charge.',
        409,
        'REFUND_EXCEEDS_SESSION_CHARGE',
      );
    }

    return {
      attempt: sessionAttempt,
      amountMinor: item.amountMinor,
    };
  };

  const prepared = await runSerializableTransaction(async (tx) => {
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

    if (order.status === 'REFUNDED' && order.refund) {
      return {
        kind: 'EXISTING' as const,
        orderId: order.id,
        refundId: order.refund.id,
        status: order.refund.status,
      };
    }

    // In-flight provider refund (PENDING): do not re-call provider.
    if (
      order.status === 'REFUND_PENDING' &&
      order.refund &&
      order.refund.status === 'PENDING'
    ) {
      return {
        kind: 'EXISTING' as const,
        orderId: order.id,
        refundId: order.refund.id,
        status: order.refund.status,
      };
    }

    const resolved = await resolveSucceededAttemptForOrder(tx, order.id);
    if (!resolved?.attempt.providerRef) {
      throw new AppError(
        'Paid order is missing a succeeded payment attempt.',
        500,
        'INTERNAL_ERROR',
      );
    }

    const allocationMinor = resolved.amountMinor;

    // REQUESTED under REFUND_PENDING means prior provider call never completed — retry.
    if (
      order.status === 'REFUND_PENDING' &&
      order.refund &&
      order.refund.status === 'REQUESTED'
    ) {
      return {
        kind: 'CREATED' as const,
        orderId: order.id,
        refundId: order.refund.id,
        attemptId: resolved.attempt.id,
        providerRef: resolved.attempt.providerRef,
        amountMinor: allocationMinor,
        currency: order.currency,
        reason: order.refund.reason ?? undefined,
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

    if (order.refund) {
      if (order.refund.status === 'SUCCEEDED') {
        throw new AppError(
          'A refund already exists for this payment order.',
          409,
          'REFUND_ALREADY_EXISTS',
        );
      }

      const retryRefund = await tx.paymentRefund.update({
        where: { id: order.refund.id },
        data: {
          status: 'REQUESTED',
          failureCode: null,
          failureMessage: null,
          reason:
            input.reason?.trim() ||
            order.refund.reason ||
            'Full refund requested',
        },
      });

      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'REFUND_PENDING' },
      });

      return {
        kind: 'CREATED' as const,
        orderId: order.id,
        refundId: retryRefund.id,
        attemptId: resolved.attempt.id,
        providerRef: resolved.attempt.providerRef,
        amountMinor: allocationMinor,
        currency: order.currency,
        reason: retryRefund.reason ?? undefined,
      };
    }

    const refund = await tx.paymentRefund.create({
      data: {
        paymentOrderId: order.id,
        paymentAttemptId: resolved.attempt.id,
        status: 'REQUESTED',
        amount: order.amount,
        currency: order.currency,
        reason: input.reason?.trim() || 'Full refund requested',
      },
    });

    await tx.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'REFUND_PENDING' },
    });

    return {
      kind: 'CREATED' as const,
      orderId: order.id,
      refundId: refund.id,
      attemptId: resolved.attempt.id,
      providerRef: resolved.attempt.providerRef,
      amountMinor: allocationMinor,
      currency: order.currency,
      reason: refund.reason ?? undefined,
    };
  });

  if (prepared.kind === 'EXISTING') {
    return prepared;
  }

  const isLateSuccess =
    prepared.reason ===
      LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_AFTER_SOURCE_TERMINAL ||
    prepared.reason ===
      LIFECYCLE_REFUND_REASONS.LATE_SUCCESS_RESOLUTION_REQUIRED;

  if (!isLateSuccess) {
    await notifyRefundRequested(prepared.orderId);
  }

  let refundRequest;
  try {
    refundRequest = await provider.requestRefund({
      paymentOrderId: prepared.orderId,
      paymentAttemptId: prepared.attemptId,
      providerRef: prepared.providerRef,
      amountMinor: prepared.amountMinor,
      currency: prepared.currency,
      reason: prepared.reason,
    });
  } catch (error) {
    await prisma.paymentRefund.update({
      where: { id: prepared.refundId },
      data: {
        status: 'FAILED',
        failureCode: 'PROVIDER_REFUND_EXCEPTION',
        failureMessage:
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'Provider refund threw',
      },
    });
    await prisma.paymentOrder.update({
      where: { id: prepared.orderId },
      data: { status: 'PAID' },
    });

    await notifyRefundFailed({
      paymentOrderId: prepared.orderId,
      refundId: prepared.refundId,
    });

    return {
      kind: 'CREATED' as const,
      orderId: prepared.orderId,
      refundId: prepared.refundId,
      status: 'FAILED' as const,
      amount: moneyDecimalToString(
        (
          await prisma.paymentRefund.findUniqueOrThrow({
            where: { id: prepared.refundId },
          })
        ).amount,
      ),
    };
  }

  return applyProviderRefundOutcome({
    orderId: prepared.orderId,
    refundId: prepared.refundId,
    attemptId: prepared.attemptId,
    providerRef: prepared.providerRef,
    amountMinor: prepared.amountMinor,
    currency: prepared.currency,
    refundRequest,
  });
};

/**
 * PAY-05D-R2: refund a session allocation that duplicated an already-PAID order
 * without flipping the order out of PAID (legacy/other charge remains authoritative).
 */
export const refundDuplicateSessionAllocationsKeepingOrdersPaid = async (input: {
  checkoutSessionId: string;
  paymentOrderIds: string[];
}): Promise<void> => {
  const provider = getPaymentProvider();
  const session = await prisma.paymentCheckoutSession.findUnique({
    where: { id: input.checkoutSessionId },
    include: {
      items: true,
      attempts: {
        where: { status: 'SUCCEEDED' },
        orderBy: { succeededAt: 'desc' },
        take: 1,
      },
    },
  });

  const attempt = session?.attempts[0];
  if (!session || !attempt?.providerRef) {
    return;
  }

  for (const orderId of input.paymentOrderIds) {
    const item = session.items.find((row) => row.paymentOrderId === orderId);
    if (!item) continue;
    const remaining = item.amountMinor - item.refundedAmountMinor;
    if (remaining <= 0) continue;

    const refundResult = await provider.requestRefund({
      paymentOrderId: orderId,
      paymentAttemptId: attempt.id,
      providerRef: attempt.providerRef,
      amountMinor: remaining,
      currency: item.currency,
      reason: 'DUPLICATE_ALLOCATION_AFTER_OTHER_CHARGE',
    });

    if (refundResult.status === 'FAILED') {
      continue;
    }

    // Provider accepted — mark allocation refunded; order stays PAID.
    await prisma.paymentCheckoutSessionItem.update({
      where: { id: item.id },
      data: {
        refundedAmountMinor: item.amountMinor,
        status: 'REFUNDED',
      },
    });

    const order = await prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: { status: true },
    });
    if (order?.status === 'PAID') {
      // Keep PAID — no PaymentRefund row / no status flip.
      continue;
    }
  }
};
