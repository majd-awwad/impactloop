import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  computeIdempotencyRequestHash,
  validateIdempotencyKey,
} from '../../services/idempotency.service.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

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

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

const assertPayerOrAdmin = (
  orderPayerUserId: string,
  actor: { userId: string; roles: string[] },
  adminAllowed: boolean,
) => {
  if (orderPayerUserId === actor.userId) {
    return;
  }

  if (adminAllowed && actor.roles.includes('ADMIN')) {
    return;
  }

  throw new AppError('Payment order not found.', 404, 'NOT_FOUND');
};

const rejectCheckoutStatus = (status: string): never => {
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
  actor: { userId: string; roles: string[] },
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
    if (!isUniqueConstraintError(error)) {
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

    if (!winning || winning.paymentOrder.payerUserId !== input.payerUserId) {
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

const markIdempotencySucceeded = async (input: {
  userId: string;
  key: string;
  response: CheckoutResponseDto;
}) => {
  await prisma.idempotencyRecord.update({
    where: {
      userId_scope_key: {
        userId: input.userId,
        scope: PAYMENT_CHECKOUT_IDEMPOTENCY_SCOPE,
        key: input.key,
      },
    },
    data: {
      status: 'SUCCEEDED',
      resourceType: 'PAYMENT_ATTEMPT',
      resourceId: input.response.attemptId,
      responseJson: input.response,
    },
  });
};

const markIdempotencyFailed = async (userId: string, key: string) => {
  await prisma.idempotencyRecord
    .update({
      where: {
        userId_scope_key: {
          userId,
          scope: PAYMENT_CHECKOUT_IDEMPOTENCY_SCOPE,
          key,
        },
      },
      data: { status: 'FAILED' },
    })
    .catch(() => undefined);
};

export const startPaymentCheckout = async (input: {
  orderId: string;
  payerUserId: string;
  idempotencyKey: string;
}): Promise<CheckoutResponseDto> => {
  const key = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = computeIdempotencyRequestHash({
    orderId: input.orderId,
  });

  try {
    await prisma.idempotencyRecord.create({
      data: {
        userId: input.payerUserId,
        scope: PAYMENT_CHECKOUT_IDEMPOTENCY_SCOPE,
        key,
        requestHash,
        status: 'IN_PROGRESS',
      },
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await prisma.idempotencyRecord.findUnique({
      where: {
        userId_scope_key: {
          userId: input.payerUserId,
          scope: PAYMENT_CHECKOUT_IDEMPOTENCY_SCOPE,
          key,
        },
      },
    });

    if (!existing) {
      throw error;
    }

    if (existing.requestHash !== requestHash) {
      throw new AppError(
        'Idempotency key was already used with a different request.',
        409,
        'IDEMPOTENCY_KEY_REUSED',
      );
    }

    if (existing.status === 'SUCCEEDED' && existing.responseJson) {
      return existing.responseJson as CheckoutResponseDto;
    }

    if (existing.status === 'IN_PROGRESS') {
      throw new AppError(
        'Request is already being processed.',
        409,
        'IDEMPOTENCY_IN_PROGRESS',
        { reason: 'REQUEST_IN_PROGRESS' },
      );
    }

    throw new AppError(
      'Previous request with this idempotency key failed. Start a new request with a new key.',
      409,
      'IDEMPOTENCY_PREVIOUSLY_FAILED',
    );
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

    await markIdempotencySucceeded({
      userId: input.payerUserId,
      key,
      response,
    });

    return response;
  } catch (error) {
    await markIdempotencyFailed(input.payerUserId, key);
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
      (order.status === 'CHECKOUT_PENDING' || order.status === 'REQUIRES_PAYMENT')
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
    include: { paymentOrder: true },
  });

  if (!attempt) {
    throw new AppError('Payment attempt not found.', 404, 'NOT_FOUND');
  }

  const tokenAuth = verifyMockCheckoutToken(input.mockToken, attempt.id);
  const isPayer = input.actorUserId === attempt.paymentOrder.payerUserId;
  if (!isPayer && !tokenAuth.ok) {
    throw new AppError('Not authorized for mock checkout action.', 403, 'FORBIDDEN');
  }

  if (tokenAuth.ok && tokenAuth.payerUserId !== attempt.paymentOrder.payerUserId) {
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

  const order = await prisma.paymentOrder.findUniqueOrThrow({
    where: { id: attempt.paymentOrderId },
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

const applyProviderRefundOutcome = async (input: {
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
      await processVerifiedProviderEvent(
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

    // REQUESTED under REFUND_PENDING means prior provider call never completed — retry.
    if (
      order.status === 'REFUND_PENDING' &&
      order.refund &&
      order.refund.status === 'REQUESTED'
    ) {
      const succeededAttempt = order.attempts[0];
      if (!succeededAttempt?.providerRef) {
        throw new AppError(
          'Paid order is missing a succeeded payment attempt.',
          500,
          'INTERNAL_ERROR',
        );
      }

      return {
        kind: 'CREATED' as const,
        orderId: order.id,
        refundId: order.refund.id,
        attemptId: succeededAttempt.id,
        providerRef: succeededAttempt.providerRef,
        amountMinor: succeededAttempt.amountMinor,
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

    const succeededAttempt = order.attempts[0];
    if (!succeededAttempt?.providerRef) {
      throw new AppError(
        'Paid order is missing a succeeded payment attempt.',
        500,
        'INTERNAL_ERROR',
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
        attemptId: succeededAttempt.id,
        providerRef: succeededAttempt.providerRef,
        amountMinor: succeededAttempt.amountMinor,
        currency: order.currency,
        reason: retryRefund.reason ?? undefined,
      };
    }

    const refund = await tx.paymentRefund.create({
      data: {
        paymentOrderId: order.id,
        paymentAttemptId: succeededAttempt.id,
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
      attemptId: succeededAttempt.id,
      providerRef: succeededAttempt.providerRef,
      amountMinor: succeededAttempt.amountMinor,
      currency: order.currency,
      reason: refund.reason ?? undefined,
    };
  });

  if (prepared.kind === 'EXISTING') {
    return prepared;
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

  if (!order?.refund || !order.attempts[0]?.providerRef) {
    throw new AppError('Refundable paid order not found.', 404, 'NOT_FOUND');
  }

  const built = provider.buildRefundEvent({
    outcome: input.outcome,
    attemptId: order.attempts[0].id,
    providerRef: order.attempts[0].providerRef,
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
