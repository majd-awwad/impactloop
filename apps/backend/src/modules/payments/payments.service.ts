import type { PaymentOrderStatus, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  claimIdempotencyRecord,
  computeIdempotencyRequestHash,
  findIdempotencyRecord,
  isIdempotencyClaimConflict,
  markIdempotencyRecordFailed,
  markIdempotencyRecordSucceeded,
  resolveExistingIdempotencyRecord,
  validateIdempotencyKey,
} from '../../services/idempotency.service.js';
import { AppError } from '../../utils/app-error.js';
import {
  isPrismaCode,
  runSerializableTransaction,
} from '../../utils/transaction-retry.js';

import {
  isPaymentAdminActor,
  type PaymentActor,
} from './payments.actor.js';
import {
  MOCK_CHECKOUT_ACTIONS,
  PAYMENT_CHECKOUT_IDEMPOTENCY_SCOPE,
  isActivePaymentAttemptStatus,
  isPayablePaymentOrderStatus,
  type MockCheckoutAction,
} from './payments.constants.js';
import { mapPaymentOrderDto, type CheckoutResponseDto } from './payments.dto.js';
import { processVerifiedProviderEvent } from './payments.event-processor.js';
import { afterVerifiedPaymentEventProcessed } from './payments.fulfillment.js';
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
import {
  signMockPayload,
  verifyMockCheckoutToken,
} from './providers/mock/mock.hmac.js';

const orderDetailInclude = {
  attempts: {
    orderBy: { createdAt: 'desc' as const },
  },
  refund: true,
} satisfies Prisma.PaymentOrderInclude;

const assertPayerOrAdmin = (
  orderPayerUserId: string,
  actor: PaymentActor,
  adminAllowed: boolean,
) => {
  if (orderPayerUserId === actor.userId) {
    return;
  }

  if (adminAllowed && isPaymentAdminActor(actor)) {
    return;
  }

  throw new AppError('Payment order not found.', 404, 'NOT_FOUND');
};

const rejectCheckoutStatus = (status: PaymentOrderStatus): never => {
  const code =
    status === 'PAID'
      ? 'PAYMENT_ALREADY_PAID'
      : status === 'REFUND_PENDING'
        ? 'REFUND_IN_PROGRESS'
        : status === 'REFUNDED'
          ? 'PAYMENT_REFUNDED'
          : status === 'CANCELLED'
            ? 'PAYMENT_CANCELLED'
            : 'PAYMENT_NOT_PAYABLE';

  throw new AppError('Payment order cannot start checkout.', 409, code, {
    status,
  });
};

const readCheckoutUrlFromMetadata = (
  metadata: Prisma.JsonValue | null | undefined,
): string | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const url = (metadata as Record<string, unknown>).checkoutUrl;
  return typeof url === 'string' && url.length > 0 ? url : null;
};

export const getPaymentOrderForActor = async (
  orderId: string,
  actor: PaymentActor,
) => {
  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
    include: orderDetailInclude,
  });

  if (!order) {
    throw new AppError('Payment order not found.', 404, 'NOT_FOUND');
  }

  assertPayerOrAdmin(order.payerUserId, actor, true);
  return mapPaymentOrderDto(order);
};

const expireStaleActiveAttempts = async (
  tx: Prisma.TransactionClient,
  paymentOrderId: string,
  now: Date,
) => {
  await tx.paymentAttempt.updateMany({
    where: {
      paymentOrderId,
      status: { in: ['CREATED', 'PENDING'] },
      expiresAt: { lte: now },
    },
    data: {
      status: 'EXPIRED',
      failureCode: 'EXPIRED',
      failureMessage: 'Checkout attempt expired before a new attempt started.',
    },
  });

  const remainingActive = await tx.paymentAttempt.count({
    where: {
      paymentOrderId,
      status: { in: ['CREATED', 'PENDING'] },
    },
  });

  if (remainingActive === 0) {
    const order = await tx.paymentOrder.findUnique({
      where: { id: paymentOrderId },
      select: { status: true },
    });
    if (order?.status === 'CHECKOUT_PENDING') {
      await tx.paymentOrder.update({
        where: { id: paymentOrderId },
        data: { status: 'REQUIRES_PAYMENT' },
      });
    }
  }
};

type ReservedCheckoutAttempt = {
  orderId: string;
  orderStatus: CheckoutResponseDto['orderStatus'];
  attemptId: string;
  attemptStatus: CheckoutResponseDto['attemptStatus'];
  expiresAt: Date | null;
  providerRef: string | null;
  checkoutUrl: string | null;
  needsProviderCheckout: boolean;
  amountMinor: number;
  currency: string;
};

const loadActiveAttempt = async (
  tx: Prisma.TransactionClient,
  paymentOrderId: string,
) =>
  tx.paymentAttempt.findFirst({
    where: {
      paymentOrderId,
      status: { in: ['CREATED', 'PENDING'] },
    },
    orderBy: { createdAt: 'desc' },
  });

const reserveCheckoutAttempt = async (input: {
  orderId: string;
  payerUserId: string;
}): Promise<ReservedCheckoutAttempt> => {
  const provider = getPaymentProvider();
  const now = new Date();

  try {
    return await runSerializableTransaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({
        where: { id: input.orderId },
      });

      if (!order || order.payerUserId !== input.payerUserId) {
        throw new AppError('Payment order not found.', 404, 'NOT_FOUND');
      }

      if (order.paymentMethod === 'CASH') {
        throw new AppError(
          'Cash obligations are collected at handover and cannot start checkout.',
          409,
          'CASH_PAYMENT_NOT_CHECKOUTABLE',
        );
      }

      if (!isPayablePaymentOrderStatus(order.status)) {
        rejectCheckoutStatus(order.status);
      }

      await expireStaleActiveAttempts(tx, order.id, now);

      const refreshed = await tx.paymentOrder.findUniqueOrThrow({
        where: { id: order.id },
      });

      if (!isPayablePaymentOrderStatus(refreshed.status)) {
        rejectCheckoutStatus(refreshed.status);
      }

      const existing = await loadActiveAttempt(tx, order.id);
      if (
        existing &&
        isActivePaymentAttemptStatus(existing.status) &&
        (!existing.expiresAt || existing.expiresAt.getTime() > now.getTime())
      ) {
        const checkoutUrl = readCheckoutUrlFromMetadata(existing.providerMetadata);
        const needsProviderCheckout =
          !existing.providerRef || !checkoutUrl || existing.status === 'CREATED';

        if (refreshed.status === 'REQUIRES_PAYMENT') {
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: { status: 'CHECKOUT_PENDING' },
          });
        }

        return {
          orderId: order.id,
          orderStatus: 'CHECKOUT_PENDING',
          attemptId: existing.id,
          attemptStatus: existing.status,
          expiresAt: existing.expiresAt,
          providerRef: existing.providerRef,
          checkoutUrl,
          needsProviderCheckout,
          amountMinor: existing.amountMinor,
          currency: existing.currency,
        };
      }

      const amountMinor = moneyDecimalToMinorUnits(refreshed.amount);
      const attempt = await tx.paymentAttempt.create({
        data: {
          paymentOrderId: order.id,
          provider: provider.name,
          providerMode: provider.mode,
          status: 'CREATED',
          amount: refreshed.amount,
          currency: refreshed.currency,
          amountMinor,
        },
      });

      await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'CHECKOUT_PENDING' },
      });

      return {
        orderId: order.id,
        orderStatus: 'CHECKOUT_PENDING',
        attemptId: attempt.id,
        attemptStatus: attempt.status,
        expiresAt: null,
        providerRef: null,
        checkoutUrl: null,
        needsProviderCheckout: true,
        amountMinor,
        currency: refreshed.currency,
      };
    });
  } catch (error) {
    if (!isPrismaCode(error, 'P2002')) {
      throw error;
    }

    // Concurrent create hit one-active-attempt index — return the winner.
    const winning = await prisma.paymentAttempt.findFirst({
      where: {
        paymentOrderId: input.orderId,
        status: { in: ['CREATED', 'PENDING'] },
      },
      orderBy: { createdAt: 'asc' },
      include: { paymentOrder: true },
    });

    if (
      !winning ||
      !winning.paymentOrderId ||
      !winning.paymentOrder ||
      winning.paymentOrder.payerUserId !== input.payerUserId
    ) {
      throw new AppError(
        'Checkout is already in progress for this payment order.',
        409,
        'CHECKOUT_IN_PROGRESS',
      );
    }

    const checkoutUrl = readCheckoutUrlFromMetadata(winning.providerMetadata);
    return {
      orderId: winning.paymentOrderId,
      orderStatus: winning.paymentOrder.status,
      attemptId: winning.id,
      attemptStatus: winning.status,
      expiresAt: winning.expiresAt,
      providerRef: winning.providerRef,
      checkoutUrl,
      needsProviderCheckout:
        !winning.providerRef || !checkoutUrl || winning.status === 'CREATED',
      amountMinor: winning.amountMinor,
      currency: winning.currency,
    };
  }
};

const finalizeCheckoutWithProvider = async (
  reserved: ReservedCheckoutAttempt,
  payerUserId: string,
): Promise<CheckoutResponseDto> => {
  if (
    !reserved.needsProviderCheckout &&
    reserved.checkoutUrl &&
    reserved.providerRef
  ) {
    return {
      orderId: reserved.orderId,
      orderStatus: reserved.orderStatus,
      attemptId: reserved.attemptId,
      attemptStatus: reserved.attemptStatus,
      checkoutUrl: reserved.checkoutUrl,
      expiresAt: reserved.expiresAt?.toISOString() ?? null,
    };
  }

  const provider = getPaymentProvider();

  // Atomic claim: only one caller may invoke provider.createCheckout for this attempt.
  const claimRows = await prisma.$executeRaw`
    UPDATE "payment_attempts"
    SET
      "provider_metadata" = COALESCE("provider_metadata", '{}'::jsonb)
        || jsonb_build_object('providerCheckoutClaim', 'in_progress'),
      "updated_at" = NOW()
    WHERE "id" = ${reserved.attemptId}
      AND "status" = 'CREATED'
      AND "provider_ref" IS NULL
      AND COALESCE("provider_metadata"->>'providerCheckoutClaim', '') NOT IN ('in_progress', 'finalized')
  `;

  if (claimRows === 0) {
    const current = await prisma.paymentAttempt.findUnique({
      where: { id: reserved.attemptId },
      include: { paymentOrder: true },
    });

    if (
      current?.providerRef &&
      current.paymentOrderId &&
      current.paymentOrder &&
      readCheckoutUrlFromMetadata(current.providerMetadata)
    ) {
      return {
        orderId: current.paymentOrderId,
        orderStatus: current.paymentOrder.status,
        attemptId: current.id,
        attemptStatus: current.status,
        checkoutUrl: readCheckoutUrlFromMetadata(current.providerMetadata)!,
        expiresAt: current.expiresAt?.toISOString() ?? null,
      };
    }

    throw new AppError(
      'Checkout provider creation is already in progress for this payment attempt.',
      409,
      'CHECKOUT_IN_PROGRESS',
      { reason: 'PROVIDER_CHECKOUT_IN_PROGRESS' },
    );
  }

  // Non-Mock providers must not share this orchestration until a stronger
  // outbox/claim model exists. Mock createCheckout is deterministic and local.
  if (provider.name !== 'MOCK') {
    throw new AppError(
      'Provider checkout orchestration is Mock-only until real-provider claim/outbox lands.',
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
    );
  }

  let checkout;
  try {
    checkout = await provider.createCheckout({
      attemptId: reserved.attemptId,
      paymentOrderId: reserved.orderId,
      payerUserId,
      amountMinor: reserved.amountMinor,
      currency: reserved.currency,
    });
  } catch (error) {
    await runSerializableTransaction(async (tx) => {
      const attempt = await tx.paymentAttempt.findUnique({
        where: { id: reserved.attemptId },
      });
      if (
        attempt &&
        (attempt.status === 'CREATED' || attempt.status === 'PENDING')
      ) {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'FAILED',
            failureCode: 'PROVIDER_CHECKOUT_FAILED',
            failureMessage:
              error instanceof Error
                ? error.message.slice(0, 500)
                : 'Provider checkout failed',
            providerMetadata: {
              providerCheckoutClaim: 'failed',
            } as Prisma.InputJsonValue,
          },
        });
      }

      const remainingActive = await tx.paymentAttempt.count({
        where: {
          paymentOrderId: reserved.orderId,
          status: { in: ['CREATED', 'PENDING'] },
          id: { not: reserved.attemptId },
        },
      });
      if (remainingActive === 0) {
        await tx.paymentOrder.update({
          where: { id: reserved.orderId },
          data: { status: 'REQUIRES_PAYMENT' },
        });
      }
    });
    throw error;
  }

  const updated = await runSerializableTransaction(async (tx) => {
    const attempt = await tx.paymentAttempt.findUnique({
      where: { id: reserved.attemptId },
    });

    if (!attempt) {
      throw new AppError('Payment attempt not found.', 404, 'NOT_FOUND');
    }

    // Another concurrent finalize may have won; prefer existing provider refs.
    if (
      attempt.providerRef &&
      attempt.status === 'PENDING' &&
      readCheckoutUrlFromMetadata(attempt.providerMetadata)
    ) {
      return {
        attempt,
        orderStatus: (
          await tx.paymentOrder.findUniqueOrThrow({
            where: { id: reserved.orderId },
          })
        ).status,
        checkoutUrl: readCheckoutUrlFromMetadata(attempt.providerMetadata)!,
      };
    }

    if (attempt.status !== 'CREATED' && attempt.status !== 'PENDING') {
      throw new AppError(
        'Payment attempt is no longer active.',
        409,
        'ATTEMPT_NOT_ACTIVE',
      );
    }

    const updatedAttempt = await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'PENDING',
        providerRef: checkout.providerRef,
        checkoutRef: checkout.checkoutRef,
        expiresAt: checkout.expiresAt,
        providerMetadata: {
          checkoutUrl: checkout.checkoutUrl,
          providerCheckoutClaim: 'finalized',
          ...(checkout.metadata ?? {}),
        } as Prisma.InputJsonValue,
      },
    });

    const updatedOrder = await tx.paymentOrder.update({
      where: { id: reserved.orderId },
      data: { status: 'CHECKOUT_PENDING' },
    });

    return {
      attempt: updatedAttempt,
      orderStatus: updatedOrder.status,
      checkoutUrl: checkout.checkoutUrl,
    };
  });

  return {
    orderId: reserved.orderId,
    orderStatus: updated.orderStatus,
    attemptId: updated.attempt.id,
    attemptStatus: updated.attempt.status,
    checkoutUrl: updated.checkoutUrl,
    expiresAt: updated.attempt.expiresAt?.toISOString() ?? null,
  };
};

export const startPaymentCheckout = async (input: {
  orderId: string;
  payerUserId: string;
  idempotencyKey: string;
}): Promise<CheckoutResponseDto> => {
  const checkoutOrder = await prisma.paymentOrder.findFirst({
    where: { id: input.orderId, payerUserId: input.payerUserId },
    select: { paymentMethod: true },
  });
  if (checkoutOrder?.paymentMethod === 'CASH') {
    throw new AppError(
      'Cash obligations are collected at handover and cannot start checkout.',
      409,
      'CASH_PAYMENT_NOT_CHECKOUTABLE',
    );
  }
  const key = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = computeIdempotencyRequestHash({
    orderId: input.orderId,
  });
  const identity = {
    userId: input.payerUserId,
    scope: PAYMENT_CHECKOUT_IDEMPOTENCY_SCOPE,
    key,
  };

  try {
    await claimIdempotencyRecord(prisma, { ...identity, requestHash });
  } catch (error) {
    if (!isIdempotencyClaimConflict(error)) {
      throw error;
    }

    const existing = await findIdempotencyRecord(prisma, identity);

    if (!existing) {
      throw error;
    }

    return resolveExistingIdempotencyRecord<CheckoutResponseDto>({
      requestHash,
      existing,
      details: { inProgress: { reason: 'REQUEST_IN_PROGRESS' } },
    }).response;
  }

  try {
    // Phase 1: atomic attempt reservation (no provider I/O).
    const reserved = await reserveCheckoutAttempt({
      orderId: input.orderId,
      payerUserId: input.payerUserId,
    });

    // Phase 2: provider checkout outside DB transaction.
    const response = await finalizeCheckoutWithProvider(
      reserved,
      input.payerUserId,
    );

    await markIdempotencyRecordSucceeded(prisma, {
      ...identity,
      resourceType: 'PAYMENT_ATTEMPT',
      resourceId: response.attemptId,
      response,
    });

    return response;
  } catch (error) {
    await markIdempotencyRecordFailed(prisma, identity).catch(() => undefined);
    throw error;
  }
};

export const cancelPaymentAttempt = async (input: {
  orderId: string;
  attemptId: string;
  payerUserId: string;
}) => {
  return runSerializableTransaction(async (tx) => {
    const order = await tx.paymentOrder.findUnique({
      where: { id: input.orderId },
    });

    if (!order || order.payerUserId !== input.payerUserId) {
      throw new AppError('Payment order not found.', 404, 'NOT_FOUND');
    }

    const attempt = await tx.paymentAttempt.findFirst({
      where: {
        id: input.attemptId,
        paymentOrderId: order.id,
      },
    });

    if (!attempt) {
      throw new AppError('Payment attempt not found.', 404, 'NOT_FOUND');
    }

    if (attempt.status === 'SUCCEEDED') {
      throw new AppError(
        'Succeeded payment attempts cannot be cancelled.',
        409,
        'ATTEMPT_ALREADY_SUCCEEDED',
      );
    }

    if (
      attempt.status === 'CANCELLED' ||
      attempt.status === 'FAILED' ||
      attempt.status === 'EXPIRED'
    ) {
      return {
        orderId: order.id,
        attemptId: attempt.id,
        attemptStatus: attempt.status,
        orderStatus: order.status,
      };
    }

    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'CANCELLED',
        failureCode: 'USER_CANCELLED',
        failureMessage: 'Checkout attempt cancelled by payer.',
      },
    });

    const remainingActive = await tx.paymentAttempt.count({
      where: {
        paymentOrderId: order.id,
        status: { in: ['CREATED', 'PENDING'] },
        id: { not: attempt.id },
      },
    });

    let orderStatus = order.status;
    if (
      remainingActive === 0 &&
      isPayablePaymentOrderStatus(order.status)
    ) {
      const updated = await tx.paymentOrder.update({
        where: { id: order.id },
        data: { status: 'REQUIRES_PAYMENT' },
      });
      orderStatus = updated.status;
    }

    return {
      orderId: order.id,
      attemptId: attempt.id,
      attemptStatus: 'CANCELLED' as const,
      orderStatus,
    };
  });
};

const assertMockProvider = (): MockPaymentProvider => {
  const provider = getPaymentProvider();
  if (!(provider instanceof MockPaymentProvider)) {
    throw new AppError(
      'Mock payment endpoints require the mock provider.',
      500,
      'PAYMENT_PROVIDER_MISCONFIGURED',
    );
  }
  return provider;
};

export const actOnMockCheckout = async (input: {
  attemptId: string;
  action: string;
  actorUserId?: string;
  mockToken?: string;
}) => {
  if (!MOCK_CHECKOUT_ACTIONS.includes(input.action as MockCheckoutAction)) {
    throw new AppError('Unsupported mock checkout action.', 400, 'VALIDATION_ERROR', {
      field: 'action',
      allowed: MOCK_CHECKOUT_ACTIONS,
    });
  }

  const action = input.action as MockCheckoutAction;

  const attempt = await prisma.paymentAttempt.findUnique({
    where: { id: input.attemptId },
    include: {
      paymentOrder: true,
      checkoutSession: true,
    },
  });

  if (!attempt) {
    throw new AppError('Payment attempt not found.', 404, 'NOT_FOUND');
  }

  const payerUserId =
    attempt.paymentOrder?.payerUserId ??
    attempt.checkoutSession?.payerUserId ??
    null;

  if (!payerUserId) {
    throw new AppError(
      'Payment attempt is missing payer ownership.',
      500,
      'INTERNAL_ERROR',
    );
  }

  const tokenAuth = verifyMockCheckoutToken(input.mockToken, attempt.id);
  const isPayer = input.actorUserId === payerUserId;
  if (!isPayer && !tokenAuth.ok) {
    throw new AppError('Not authorized for mock checkout action.', 403, 'FORBIDDEN');
  }

  if (tokenAuth.ok && tokenAuth.payerUserId !== payerUserId) {
    throw new AppError('Not authorized for mock checkout action.', 403, 'FORBIDDEN');
  }

  const provider = assertMockProvider();

  if (!attempt.providerRef) {
    throw new AppError(
      'Payment attempt is missing provider reference.',
      409,
      'ATTEMPT_NOT_READY',
    );
  }

  const built = provider.buildActionEvent({
    action,
    attemptId: attempt.id,
    providerRef: attempt.providerRef,
    amountMinor: attempt.amountMinor,
    currency: attempt.currency,
  });

  const rawBody = Buffer.from(JSON.stringify(built.body), 'utf8');
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const signature = signMockPayload(timestampSeconds, rawBody);

  const verified = await provider.verifyAndNormalizeEvent({
    rawBody,
    headers: {
      'x-impactloop-mock-signature': signature,
      'x-impactloop-mock-timestamp': String(timestampSeconds),
    },
  });

  if (!verified.ok) {
    throw new AppError(verified.message, 400, verified.code);
  }

  const result = await processVerifiedProviderEvent(
    verified.event,
    verified.signatureValid,
  );

  await afterVerifiedPaymentEventProcessed(result);

  if (attempt.checkoutSessionId) {
    const { getCheckoutSessionForActor } = await import(
      './payments.checkout-session.js'
    );
    const session = await getCheckoutSessionForActor(attempt.checkoutSessionId, {
      userId: payerUserId,
      roles: ['LEARNER'],
    });
    return {
      processing: result,
      checkoutSession: session,
      order: null,
    };
  }

  const order = await prisma.paymentOrder.findUniqueOrThrow({
    where: { id: attempt.paymentOrderId! },
    include: orderDetailInclude,
  });

  return {
    processing: result,
    order: mapPaymentOrderDto(order),
  };
};

export const handleMockWebhook = async (input: {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
}) => {
  const provider = assertMockProvider();
  const verified = await provider.verifyAndNormalizeEvent(input);

  if (!verified.ok) {
    throw new AppError(verified.message, 401, verified.code);
  }

  const result = await processVerifiedProviderEvent(
    verified.event,
    verified.signatureValid,
  );

  await afterVerifiedPaymentEventProcessed(result);

  return {
    received: true,
    processingStatus: result.processingStatus,
    reason: result.reason ?? null,
  };
};

export {
  applyProviderRefundOutcome,
  requestFullRefundForPaidOrder,
  refundDuplicateSessionAllocationsKeepingOrdersPaid,
} from './payments.refunds.js';


/** Test/helper: complete mock refund asynchronously through event processor. */
export const completeMockRefundViaEvent = async (input: {
  orderId: string;
  outcome: 'succeeded' | 'failed';
  failureCode?: string;
  failureMessage?: string;
}) => {
  const provider = assertMockProvider();

  const order = await prisma.paymentOrder.findUnique({
    where: { id: input.orderId },
    include: {
      refund: true,
      attempts: {
        where: { status: 'SUCCEEDED' },
        take: 1,
      },
    },
  });

  if (!order?.refund) {
    throw new AppError('Refundable paid order not found.', 404, 'NOT_FOUND');
  }

  let succeededAttempt: (typeof order.attempts)[number] | null =
    order.attempts[0] ?? null;
  if (!succeededAttempt?.providerRef) {
    const item = await prisma.paymentCheckoutSessionItem.findFirst({
      where: {
        paymentOrderId: order.id,
        status: { in: ['SETTLED', 'REFUNDED'] },
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
    succeededAttempt = item?.checkoutSession.attempts[0] ?? null;
  }

  if (!succeededAttempt?.providerRef) {
    throw new AppError('Refundable paid order not found.', 404, 'NOT_FOUND');
  }

  const built = provider.buildRefundEvent({
    outcome: input.outcome,
    attemptId: succeededAttempt.id,
    providerRef: succeededAttempt.providerRef,
    providerRefundRef:
      order.refund.providerRefundRef ?? `mock_rfnd_${order.id}`,
    amountMinor: moneyDecimalToMinorUnits(order.amount),
    currency: order.currency,
    failureCode: input.failureCode,
    failureMessage: input.failureMessage,
  });

  const rawBody = Buffer.from(JSON.stringify(built.body), 'utf8');
  const timestampSeconds = Math.floor(Date.now() / 1000);
  const verified = await provider.verifyAndNormalizeEvent({
    rawBody,
    headers: {
      'x-impactloop-mock-signature': signMockPayload(timestampSeconds, rawBody),
      'x-impactloop-mock-timestamp': String(timestampSeconds),
    },
  });

  if (!verified.ok) {
    throw new AppError(verified.message, 400, verified.code);
  }

  const result = await processVerifiedProviderEvent(
    verified.event,
    verified.signatureValid,
  );
  await afterVerifiedPaymentEventProcessed(result);
  return result;
};
