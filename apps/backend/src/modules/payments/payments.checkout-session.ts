import type {
  PaymentAttemptStatus,
  PaymentCheckoutSessionItemStatus,
  PaymentCheckoutSessionStatus,
  PaymentOrderStatus,
  PaymentPurpose,
  Prisma,
} from '../../generated/prisma/client.js';
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
  PAYMENT_RESERVATION_CHECKOUT_IDEMPOTENCY_SCOPE,
  PROVIDER_CHECKOUT_CLAIM_LEASE_MS,
  isActivePaymentAttemptStatus,
  isPayablePaymentOrderStatus,
} from './payments.constants.js';
import {
  moneyDecimalToMinorUnits,
  moneyDecimalToString,
  isPositiveMoney,
  toMoneyDecimal,
} from './payments.money.js';
import { isElectronicPaymentEnforced } from './payments.policy.js';
import { evaluateDeliveryGroupPaymentReadiness } from './payments.readiness.js';
import { getPaymentProvider } from './providers/payment-provider.registry.js';

const readJsonString = (
  metadata: Prisma.JsonValue | null | undefined,
  key: string,
): string | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

const isProviderCheckoutClaimActive = (
  metadata: Prisma.JsonValue | null | undefined,
  now: Date,
): boolean => {
  const claim = readJsonString(metadata, 'providerCheckoutClaim');
  if (claim !== 'in_progress') return false;
  const expiresRaw = readJsonString(metadata, 'providerCheckoutClaimExpiresAt');
  if (!expiresRaw) return true; // fail closed: unknown expiry = still claimed
  const expiresAt = Date.parse(expiresRaw);
  if (Number.isNaN(expiresAt)) return true;
  return expiresAt > now.getTime();
};

/**
 * Reopen a CHECKOUT_PENDING order only when no other active attempt/session owns it
 * and the source remains payable.
 */
const reopenOrderIfSafe = async (
  tx: Prisma.TransactionClient,
  input: {
    paymentOrderId: string;
    excludeSessionId?: string;
    excludeAttemptId?: string;
  },
): Promise<void> => {
  const order = await tx.paymentOrder.findUnique({
    where: { id: input.paymentOrderId },
  });
  if (!order || order.status !== 'CHECKOUT_PENDING') return;

  const pendingItems = await tx.paymentCheckoutSessionItem.count({
    where: {
      paymentOrderId: order.id,
      status: 'PENDING',
      ...(input.excludeSessionId
        ? { checkoutSessionId: { not: input.excludeSessionId } }
        : {}),
      checkoutSession: {
        status: { in: ['CREATED', 'CHECKOUT_PENDING'] },
      },
    },
  });
  const otherActiveAttempts = await tx.paymentAttempt.count({
    where: {
      OR: [
        {
          paymentOrderId: order.id,
          status: { in: ['CREATED', 'PENDING'] },
          ...(input.excludeAttemptId
            ? { id: { not: input.excludeAttemptId } }
            : {}),
        },
        {
          checkoutSessionId: { not: null },
          status: { in: ['CREATED', 'PENDING'] },
          checkoutSession: {
            items: {
              some: {
                paymentOrderId: order.id,
                status: 'PENDING',
              },
            },
          },
          ...(input.excludeAttemptId
            ? { id: { not: input.excludeAttemptId } }
            : {}),
        },
      ],
    },
  });

  if (pendingItems === 0 && otherActiveAttempts === 0) {
    await tx.paymentOrder.update({
      where: { id: order.id },
      data: { status: 'REQUIRES_PAYMENT' },
    });
  }
};

export type ReservationCheckoutItemDto = {
  paymentOrderId: string;
  purpose: PaymentPurpose;
  amount: string;
  amountMinor: number;
  currency: string;
  status: PaymentCheckoutSessionItemStatus;
  reservationId: string | null;
  materialTitle: string | null;
};

export type ReservationCheckoutSessionDto = {
  checkoutSessionId: string;
  reservationId: string;
  deliveryGroupId: string | null;
  status: PaymentCheckoutSessionStatus;
  currency: string;
  totalAmount: string;
  totalAmountMinor: number;
  items: ReservationCheckoutItemDto[];
  attemptId: string | null;
  attemptStatus: PaymentAttemptStatus | null;
  checkoutUrl: string | null;
  expiresAt: string | null;
  orderStatuses: Array<{
    paymentOrderId: string;
    status: PaymentOrderStatus;
  }>;
};

type PayableOrderRow = {
  id: string;
  purpose: PaymentPurpose;
  amount: Prisma.Decimal;
  currency: string;
  status: PaymentOrderStatus;
  payerUserId: string;
  reservationId: string | null;
  deliveryGroupId: string | null;
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

const assertLearnerOwnerOrAdmin = (
  reservationRequesterId: string,
  actor: PaymentActor,
) => {
  if (reservationRequesterId === actor.userId) return;
  if (isPaymentAdminActor(actor)) return;
  throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
};

/**
 * Authoritative payable set for a reservation-scoped checkout.
 * Never trusts client-supplied order IDs or amounts.
 */
export const resolvePayableOrdersForReservationCheckout = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
  payerUserId: string,
): Promise<{
  reservationId: string;
  deliveryGroupId: string | null;
  currency: string;
  orders: PayableOrderRow[];
}> => {
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      requesterId: true,
      status: true,
      fulfillmentMethod: true,
      deliveryGroupId: true,
      deliveryFee: true,
      pricingCurrency: true,
      materialSubtotal: true,
      paymentMethod: true,
    },
  });

  if (!reservation || reservation.requesterId !== payerUserId) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (reservation.paymentMethod === 'CASH') {
    throw new AppError(
      'Cash obligations are collected at handover and cannot start checkout.',
      409,
      'CASH_PAYMENT_NOT_CHECKOUTABLE',
    );
  }

  if (reservation.status !== 'ACCEPTED') {
    throw new AppError(
      'Checkout is only available for accepted reservations.',
      409,
      'RESERVATION_NOT_ACCEPTED',
      { status: reservation.status },
    );
  }

  const currency = reservation.pricingCurrency ?? 'NIS';
  const orders: PayableOrderRow[] = [];

  if (reservation.fulfillmentMethod === 'PICKUP') {
    const materialAmount = toMoneyDecimal(reservation.materialSubtotal ?? 0);
    const material = await tx.paymentOrder.findFirst({
      where: {
        purpose: 'MATERIAL_SUBTOTAL',
        reservationId: reservation.id,
        payerUserId,
      },
      orderBy: { cycleNumber: 'desc' },
    });

    if (isPositiveMoney(materialAmount) && !material) {
      throw new AppError(
        'Accepted reservation is missing a MATERIAL_SUBTOTAL PaymentOrder.',
        409,
        'PAYMENT_SOURCE_INVARIANT_VIOLATION',
        {
          reservationId: reservation.id,
          reason: 'MISSING_MATERIAL_PAYMENT_ORDER',
        },
      );
    }

    if (material && isPayablePaymentOrderStatus(material.status)) {
      orders.push(material);
    }

    return {
      reservationId: reservation.id,
      deliveryGroupId: null,
      currency: material?.currency ?? currency,
      orders,
    };
  }

  // DELIVERY
  const feeAmount = toMoneyDecimal(reservation.deliveryFee ?? 0);
  if (feeAmount.gt(0) && !reservation.deliveryGroupId) {
    throw new AppError(
      'Accepted delivery is missing a DeliveryGroup for a positive delivery fee.',
      409,
      'PAYMENT_SOURCE_INVARIANT_VIOLATION',
      {
        reservationId: reservation.id,
        reason: 'MISSING_DELIVERY_GROUP',
      },
    );
  }

  if (!reservation.deliveryGroupId) {
    // Zero-fee ungrouped delivery: material only.
    const materialAmount = toMoneyDecimal(reservation.materialSubtotal ?? 0);
    const material = await tx.paymentOrder.findFirst({
      where: {
        purpose: 'MATERIAL_SUBTOTAL',
        reservationId: reservation.id,
        payerUserId,
      },
      orderBy: { cycleNumber: 'desc' },
    });
    if (isPositiveMoney(materialAmount) && !material) {
      throw new AppError(
        'Accepted reservation is missing a MATERIAL_SUBTOTAL PaymentOrder.',
        409,
        'PAYMENT_SOURCE_INVARIANT_VIOLATION',
        {
          reservationId: reservation.id,
          reason: 'MISSING_MATERIAL_PAYMENT_ORDER',
        },
      );
    }
    if (material && isPayablePaymentOrderStatus(material.status)) {
      orders.push(material);
    }
    return {
      reservationId: reservation.id,
      deliveryGroupId: null,
      currency: material?.currency ?? currency,
      orders,
    };
  }

  const readiness = await evaluateDeliveryGroupPaymentReadiness(
    reservation.deliveryGroupId,
    tx,
  );

  if (readiness.invariantViolations.length > 0) {
    throw new AppError(
      'Payment obligations are incomplete for this delivery group.',
      409,
      'PAYMENT_SOURCE_INVARIANT_VIOLATION',
      {
        deliveryGroupId: reservation.deliveryGroupId,
        violations: readiness.invariantViolations,
      },
    );
  }

  // Include every outstanding obligation required for group readiness
  // (all ACCEPTED materials for this payer/group + fee once).
  const outstandingIds = [...new Set(readiness.outstandingPaymentOrderIds)];
  if (outstandingIds.length === 0) {
    return {
      reservationId: reservation.id,
      deliveryGroupId: reservation.deliveryGroupId,
      currency,
      orders: [],
    };
  }

  const loaded = await tx.paymentOrder.findMany({
    where: {
      id: { in: outstandingIds },
      payerUserId,
    },
  });

  if (loaded.length !== outstandingIds.length) {
    throw new AppError(
      'One or more payment obligations are not owned by the payer.',
      403,
      'FORBIDDEN',
    );
  }

  for (const order of loaded) {
    if (!isPayablePaymentOrderStatus(order.status)) {
      continue;
    }
    orders.push(order);
  }

  // Fee must appear at most once.
  const feeOrders = orders.filter((o) => o.purpose === 'DELIVERY_FEE');
  if (feeOrders.length > 1) {
    throw new AppError(
      'Multiple unpaid delivery-fee obligations found for one group.',
      500,
      'PAYMENT_SOURCE_INVARIANT_VIOLATION',
      { deliveryGroupId: reservation.deliveryGroupId },
    );
  }

  const sessionCurrency = orders[0]?.currency ?? currency;
  for (const order of orders) {
    if (order.currency.toUpperCase() !== sessionCurrency.toUpperCase()) {
      throw new AppError(
        'Mixed currencies cannot be combined in one checkout session.',
        409,
        'CURRENCY_MISMATCH',
      );
    }
  }

  return {
    reservationId: reservation.id,
    deliveryGroupId: reservation.deliveryGroupId,
    currency: sessionCurrency,
    orders,
  };
};

const mapSessionDto = (input: {
  session: {
    id: string;
    reservationId: string;
    deliveryGroupId: string | null;
    status: PaymentCheckoutSessionStatus;
    currency: string;
    totalAmount: Prisma.Decimal;
    totalAmountMinor: number;
    expiresAt: Date | null;
    items: Array<{
      paymentOrderId: string;
      purpose: PaymentPurpose;
      amount: Prisma.Decimal;
      amountMinor: number;
      currency: string;
      status: PaymentCheckoutSessionItemStatus;
      paymentOrder: {
        status: PaymentOrderStatus;
        reservationId: string | null;
        reservation?: {
          id: string;
          material?: { title: string } | null;
        } | null;
      };
    }>;
  };
  attempt: {
    id: string;
    status: PaymentAttemptStatus;
    expiresAt: Date | null;
    providerMetadata: Prisma.JsonValue | null;
  } | null;
}): ReservationCheckoutSessionDto => ({
  checkoutSessionId: input.session.id,
  reservationId: input.session.reservationId,
  deliveryGroupId: input.session.deliveryGroupId,
  status: input.session.status,
  currency: input.session.currency,
  totalAmount: moneyDecimalToString(input.session.totalAmount),
  totalAmountMinor: input.session.totalAmountMinor,
  items: input.session.items.map((item) => ({
    paymentOrderId: item.paymentOrderId,
    purpose: item.purpose,
    amount: moneyDecimalToString(item.amount),
    amountMinor: item.amountMinor,
    currency: item.currency,
    status: item.status,
    reservationId:
      item.paymentOrder.reservationId ??
      item.paymentOrder.reservation?.id ??
      null,
    materialTitle: item.paymentOrder.reservation?.material?.title ?? null,
  })),
  attemptId: input.attempt?.id ?? null,
  attemptStatus: input.attempt?.status ?? null,
  checkoutUrl: input.attempt
    ? readCheckoutUrlFromMetadata(input.attempt.providerMetadata)
    : null,
  expiresAt: input.attempt?.expiresAt?.toISOString() ?? null,
  orderStatuses: input.session.items.map((item) => ({
    paymentOrderId: item.paymentOrderId,
    status: item.paymentOrder.status,
  })),
});

const checkoutSessionDetailInclude = {
  items: {
    include: {
      paymentOrder: {
        include: {
          reservation: {
            select: {
              id: true,
              material: { select: { title: true } },
            },
          },
        },
      },
    },
  },
  attempts: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.PaymentCheckoutSessionInclude;

const expireStaleSessionAttempts = async (
  tx: Prisma.TransactionClient,
  sessionId: string,
  now: Date,
) => {
  const candidates = await tx.paymentAttempt.findMany({
    where: {
      checkoutSessionId: sessionId,
      status: { in: ['CREATED', 'PENDING'] },
    },
  });

  const stale = candidates.filter((attempt) => {
    // Provider checkout was finalized (PENDING) and TTL elapsed → expire.
    if (
      attempt.status === 'PENDING' &&
      attempt.expiresAt &&
      attempt.expiresAt.getTime() <= now.getTime()
    ) {
      return true;
    }
    // CREATED with expired claim/provisional TTL: do not expire here — claim
    // recovery in finalizeSessionCheckoutWithProvider retakes the lease.
    // Only expire CREATED attempts that are abandoned far beyond the lease
    // without an active recovery path (no longer CREATED owned by active session
    // handled below via double-lease grace).
    if (attempt.status === 'CREATED' && attempt.providerRef == null) {
      const abandonedBeyond =
        attempt.createdAt.getTime() + PROVIDER_CHECKOUT_CLAIM_LEASE_MS * 2 <=
        now.getTime();
      if (abandonedBeyond) {
        return true;
      }
    }
    return false;
  });

  for (const attempt of stale) {
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'EXPIRED',
        failureCode: 'EXPIRED',
        failureMessage: 'Checkout attempt expired.',
        providerMetadata: {
          ...((attempt.providerMetadata &&
          typeof attempt.providerMetadata === 'object' &&
          !Array.isArray(attempt.providerMetadata)
            ? attempt.providerMetadata
            : {}) as Record<string, unknown>),
          providerCheckoutClaim: 'expired',
        } as Prisma.InputJsonValue,
      },
    });
  }

  if (stale.length === 0) {
    return;
  }

  const session = await tx.paymentCheckoutSession.findUnique({
    where: { id: sessionId },
    include: { items: true },
  });
  if (
    !session ||
    (session.status !== 'CREATED' && session.status !== 'CHECKOUT_PENDING')
  ) {
    return;
  }

  await tx.paymentCheckoutSession.update({
    where: { id: sessionId },
    data: { status: 'EXPIRED' },
  });

  for (const item of session.items) {
    if (item.status !== 'PENDING') continue;

    await tx.paymentCheckoutSessionItem.update({
      where: { id: item.id },
      data: { status: 'CANCELLED' },
    });

    await reopenOrderIfSafe(tx, {
      paymentOrderId: item.paymentOrderId,
      excludeSessionId: sessionId,
    });
  }
};

type ReservedSessionCheckout = {
  sessionId: string;
  attemptId: string;
  attemptStatus: PaymentAttemptStatus;
  needsProviderCheckout: boolean;
  amountMinor: number;
  currency: string;
  checkoutUrl: string | null;
  providerRef: string | null;
  expiresAt: Date | null;
  payerUserId: string;
};

const reserveReservationCheckoutSession = async (input: {
  reservationId: string;
  payerUserId: string;
}): Promise<ReservedSessionCheckout & { dtoSeed: ReservationCheckoutSessionDto }> => {
  const provider = getPaymentProvider();
  const now = new Date();

  try {
    return await runSerializableTransaction(async (tx) => {
      const resolved = await resolvePayableOrdersForReservationCheckout(
        tx,
        input.reservationId,
        input.payerUserId,
      );

      if (resolved.orders.length === 0) {
        throw new AppError(
          'No payable payment obligations remain for this reservation.',
          409,
          'NOTHING_TO_PAY',
        );
      }

      const orderIds = resolved.orders.map((o) => o.id);

      // Block concurrent active charges for any included obligation.
      const blockingItems = await tx.paymentCheckoutSessionItem.findMany({
        where: {
          paymentOrderId: { in: orderIds },
          status: 'PENDING',
          checkoutSession: {
            status: { in: ['CREATED', 'CHECKOUT_PENDING'] },
          },
        },
        include: {
          checkoutSession: {
            include: {
              items: { include: { paymentOrder: true } },
              attempts: {
                where: { status: { in: ['CREATED', 'PENDING'] } },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (blockingItems.length > 0) {
        const existingSession = blockingItems[0]!.checkoutSession;
        await expireStaleSessionAttempts(tx, existingSession.id, now);

        const refreshed = await tx.paymentCheckoutSession.findUniqueOrThrow({
          where: { id: existingSession.id },
          include: {
            items: { include: { paymentOrder: true } },
            attempts: {
              where: { status: { in: ['CREATED', 'PENDING'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        });

        if (
          refreshed.status === 'CREATED' ||
          refreshed.status === 'CHECKOUT_PENDING'
        ) {
          // Reuse only when the payable set matches exactly.
          const existingOrderIds = refreshed.items
            .map((i) => i.paymentOrderId)
            .sort()
            .join(',');
          const wanted = [...orderIds].sort().join(',');
          if (existingOrderIds === wanted) {
            const attempt = refreshed.attempts[0] ?? null;
            const checkoutUrl = attempt
              ? readCheckoutUrlFromMetadata(attempt.providerMetadata)
              : null;
            const dto = mapSessionDto({ session: refreshed, attempt });
            return {
              sessionId: refreshed.id,
              attemptId: attempt?.id ?? '',
              attemptStatus: attempt?.status ?? 'CREATED',
              needsProviderCheckout:
                !attempt ||
                !attempt.providerRef ||
                !checkoutUrl ||
                attempt.status === 'CREATED',
              amountMinor: refreshed.totalAmountMinor,
              currency: refreshed.currency,
              checkoutUrl,
              providerRef: attempt?.providerRef ?? null,
              expiresAt: attempt?.expiresAt ?? null,
              payerUserId: input.payerUserId,
              dtoSeed: dto,
            };
          }

          throw new AppError(
            'Checkout is already in progress for one or more payment obligations.',
            409,
            'CHECKOUT_IN_PROGRESS',
          );
        }
      }

      // Legacy order-scoped attempts: never silently supersede a provider checkout.
      for (const order of resolved.orders) {
        const active = await tx.paymentAttempt.findMany({
          where: {
            paymentOrderId: order.id,
            status: { in: ['CREATED', 'PENDING'] },
          },
        });
        for (const attempt of active) {
          const hasProviderCheckout =
            Boolean(attempt.providerRef) ||
            Boolean(readCheckoutUrlFromMetadata(attempt.providerMetadata)) ||
            attempt.status === 'PENDING' ||
            isProviderCheckoutClaimActive(attempt.providerMetadata, now);

          if (hasProviderCheckout) {
            throw new AppError(
              'Checkout is already in progress for one or more payment obligations.',
              409,
              'CHECKOUT_IN_PROGRESS',
              {
                reason: 'LEGACY_ATTEMPT_ACTIVE',
                paymentOrderId: order.id,
                paymentAttemptId: attempt.id,
              },
            );
          }

          // CREATED with no provider checkout — safe conditional cancel.
          await tx.paymentAttempt.updateMany({
            where: {
              id: attempt.id,
              status: 'CREATED',
              providerRef: null,
            },
            data: {
              status: 'CANCELLED',
              failureCode: 'SUPERSEDED_BY_SESSION',
              failureMessage:
                'Superseded by reservation-scoped checkout session.',
            },
          });
        }
      }

      let totalMinor = 0;
      let totalAmount = toMoneyDecimal(0);
      for (const order of resolved.orders) {
        const minor = moneyDecimalToMinorUnits(order.amount);
        totalMinor += minor;
        totalAmount = totalAmount.add(order.amount);
      }

      const claimLeaseExpiresAt = new Date(
        now.getTime() + PROVIDER_CHECKOUT_CLAIM_LEASE_MS,
      );

      const session = await tx.paymentCheckoutSession.create({
        data: {
          payerUserId: input.payerUserId,
          reservationId: resolved.reservationId,
          deliveryGroupId: resolved.deliveryGroupId,
          status: 'CREATED',
          currency: resolved.currency,
          totalAmount,
          totalAmountMinor: totalMinor,
          expiresAt: claimLeaseExpiresAt,
          items: {
            create: resolved.orders.map((order) => ({
              paymentOrderId: order.id,
              purpose: order.purpose,
              amount: order.amount,
              amountMinor: moneyDecimalToMinorUnits(order.amount),
              currency: order.currency,
              status: 'PENDING',
            })),
          },
        },
        include: {
          items: { include: { paymentOrder: true } },
        },
      });

      const attempt = await tx.paymentAttempt.create({
        data: {
          checkoutSessionId: session.id,
          paymentOrderId: null,
          provider: provider.name,
          providerMode: provider.mode,
          status: 'CREATED',
          amount: totalAmount,
          currency: resolved.currency,
          amountMinor: totalMinor,
          // Provisional TTL so abandoned claims are recoverable via reconcile.
          expiresAt: claimLeaseExpiresAt,
        },
      });

      for (const order of resolved.orders) {
        await tx.paymentOrder.update({
          where: { id: order.id },
          data: { status: 'CHECKOUT_PENDING' },
        });
      }

      const dto = mapSessionDto({
        session: {
          ...session,
          items: session.items.map((item) => ({
            ...item,
            paymentOrder: {
              status: 'CHECKOUT_PENDING' as PaymentOrderStatus,
              reservationId: null,
            },
          })),
        },
        attempt,
      });

      return {
        sessionId: session.id,
        attemptId: attempt.id,
        attemptStatus: attempt.status,
        needsProviderCheckout: true,
        amountMinor: totalMinor,
        currency: resolved.currency,
        checkoutUrl: null,
        providerRef: null,
        expiresAt: claimLeaseExpiresAt,
        payerUserId: input.payerUserId,
        dtoSeed: dto,
      };
    });
  } catch (error) {
    if (!isPrismaCode(error, 'P2002')) {
      throw error;
    }
    throw new AppError(
      'Checkout is already in progress for one or more payment obligations.',
      409,
      'CHECKOUT_IN_PROGRESS',
    );
  }
};

const finalizeSessionCheckoutWithProvider = async (
  reserved: ReservedSessionCheckout,
): Promise<ReservationCheckoutSessionDto> => {
  if (
    !reserved.needsProviderCheckout &&
    reserved.checkoutUrl &&
    reserved.providerRef &&
    reserved.attemptId
  ) {
    const session = await prisma.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: reserved.sessionId },
      include: {
        items: { include: { paymentOrder: true } },
        attempts: { where: { id: reserved.attemptId }, take: 1 },
      },
    });
    return mapSessionDto({
      session,
      attempt: session.attempts[0] ?? null,
    });
  }

  const provider = getPaymentProvider();
  const now = new Date();
  const claimExpiresAt = new Date(
    now.getTime() + PROVIDER_CHECKOUT_CLAIM_LEASE_MS,
  );

  // Atomic claim with recoverable lease (expired in_progress claims may be retaken).
  const claimRows = await prisma.$executeRaw`
    UPDATE "payment_attempts"
    SET
      "provider_metadata" = COALESCE("provider_metadata", '{}'::jsonb)
        || jsonb_build_object(
          'providerCheckoutClaim', 'in_progress',
          'providerCheckoutClaimedAt', ${now.toISOString()}::text,
          'providerCheckoutClaimExpiresAt', ${claimExpiresAt.toISOString()}::text
        ),
      "expires_at" = COALESCE("expires_at", ${claimExpiresAt}),
      "updated_at" = NOW()
    WHERE "id" = ${reserved.attemptId}
      AND "status" = 'CREATED'
      AND "provider_ref" IS NULL
      AND "checkout_session_id" = ${reserved.sessionId}
      AND (
        COALESCE("provider_metadata"->>'providerCheckoutClaim', '') NOT IN ('in_progress', 'finalized')
        OR (
          COALESCE("provider_metadata"->>'providerCheckoutClaim', '') = 'in_progress'
          AND COALESCE("provider_metadata"->>'providerCheckoutClaimExpiresAt', '') <> ''
          AND ("provider_metadata"->>'providerCheckoutClaimExpiresAt')::timestamptz <= NOW()
        )
      )
  `;

  if (claimRows === 0) {
    const current = await prisma.paymentAttempt.findUnique({
      where: { id: reserved.attemptId },
    });
    if (
      current?.providerRef &&
      readCheckoutUrlFromMetadata(current.providerMetadata)
    ) {
      const session = await prisma.paymentCheckoutSession.findUniqueOrThrow({
        where: { id: reserved.sessionId },
        include: {
          items: { include: { paymentOrder: true } },
        },
      });
      return mapSessionDto({ session, attempt: current });
    }
    throw new AppError(
      'Checkout provider creation is already in progress for this payment attempt.',
      409,
      'CHECKOUT_IN_PROGRESS',
      { reason: 'PROVIDER_CHECKOUT_IN_PROGRESS' },
    );
  }

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
      paymentOrderId: reserved.sessionId,
      payerUserId: reserved.payerUserId,
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
        attempt.status === 'CREATED' &&
        attempt.checkoutSessionId === reserved.sessionId
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

      const session = await tx.paymentCheckoutSession.findUnique({
        where: { id: reserved.sessionId },
        include: { items: true },
      });
      if (
        session &&
        (session.status === 'CREATED' || session.status === 'CHECKOUT_PENDING')
      ) {
        await tx.paymentCheckoutSession.update({
          where: { id: session.id },
          data: { status: 'FAILED' },
        });
        for (const item of session.items) {
          if (item.status !== 'PENDING') continue;
          await tx.paymentCheckoutSessionItem.update({
            where: { id: item.id },
            data: { status: 'CANCELLED' },
          });
          await reopenOrderIfSafe(tx, {
            paymentOrderId: item.paymentOrderId,
            excludeSessionId: session.id,
            excludeAttemptId: reserved.attemptId,
          });
        }
      }
    });
    throw error;
  }

  const updated = await runSerializableTransaction(async (tx) => {
    const attempt = await tx.paymentAttempt.findUnique({
      where: { id: reserved.attemptId },
    });
    const session = await tx.paymentCheckoutSession.findUnique({
      where: { id: reserved.sessionId },
      include: { items: { include: { paymentOrder: true } } },
    });

    if (!attempt || !session) {
      throw new AppError('Checkout session not found.', 404, 'NOT_FOUND');
    }

    const itemsActive = session.items.every((item) => item.status === 'PENDING');
    const sessionActive =
      session.status === 'CREATED' || session.status === 'CHECKOUT_PENDING';
    const attemptStillClaimable =
      attempt.status === 'CREATED' &&
      attempt.checkoutSessionId === reserved.sessionId;

    if (!attemptStillClaimable || !sessionActive || !itemsActive) {
      // Lifecycle cancelled/expired during provider handoff — do not resurrect.
      // Persist provider refs for late-success correlation only when terminal.
      if (
        attempt.status === 'CANCELLED' ||
        attempt.status === 'EXPIRED' ||
        attempt.status === 'FAILED'
      ) {
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            providerRef: attempt.providerRef ?? checkout.providerRef,
            checkoutRef: attempt.checkoutRef ?? checkout.checkoutRef,
            providerMetadata: {
              checkoutUrl: checkout.checkoutUrl,
              providerCheckoutClaim: 'abandoned_after_lifecycle',
              checkoutSessionId: reserved.sessionId,
              ...(checkout.metadata ?? {}),
            } as Prisma.InputJsonValue,
          },
        });
      }
      const refreshed = await tx.paymentCheckoutSession.findUniqueOrThrow({
        where: { id: reserved.sessionId },
        include: { items: { include: { paymentOrder: true } } },
      });
      const refreshedAttempt = await tx.paymentAttempt.findUniqueOrThrow({
        where: { id: reserved.attemptId },
      });
      return { attempt: refreshedAttempt, session: refreshed, abandoned: true };
    }

    const casAttempt = await tx.paymentAttempt.updateMany({
      where: {
        id: reserved.attemptId,
        status: 'CREATED',
        checkoutSessionId: reserved.sessionId,
      },
      data: {
        status: 'PENDING',
        providerRef: checkout.providerRef,
        checkoutRef: checkout.checkoutRef,
        expiresAt: checkout.expiresAt,
        providerMetadata: {
          checkoutUrl: checkout.checkoutUrl,
          providerCheckoutClaim: 'finalized',
          checkoutSessionId: reserved.sessionId,
          ...(checkout.metadata ?? {}),
        } as Prisma.InputJsonValue,
      },
    });

    if (casAttempt.count === 0) {
      const refreshed = await tx.paymentCheckoutSession.findUniqueOrThrow({
        where: { id: reserved.sessionId },
        include: { items: { include: { paymentOrder: true } } },
      });
      const refreshedAttempt = await tx.paymentAttempt.findUniqueOrThrow({
        where: { id: reserved.attemptId },
      });
      return { attempt: refreshedAttempt, session: refreshed, abandoned: true };
    }

    await tx.paymentCheckoutSession.updateMany({
      where: {
        id: reserved.sessionId,
        status: { in: ['CREATED', 'CHECKOUT_PENDING'] },
      },
      data: {
        status: 'CHECKOUT_PENDING',
        expiresAt: checkout.expiresAt,
      },
    });

    const finalizedSession = await tx.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: reserved.sessionId },
      include: { items: { include: { paymentOrder: true } } },
    });
    const finalizedAttempt = await tx.paymentAttempt.findUniqueOrThrow({
      where: { id: reserved.attemptId },
    });

    return {
      attempt: finalizedAttempt,
      session: finalizedSession,
      abandoned: false,
    };
  });

  return mapSessionDto({
    session: updated.session,
    attempt: updated.attempt,
  });
};

/** @internal Exported for PAY-05D-R2 handoff/claim tests. */
export const finalizeSessionCheckoutWithProviderForTests =
  finalizeSessionCheckoutWithProvider;

export const startReservationCheckout = async (input: {
  reservationId: string;
  payerUserId: string;
  idempotencyKey: string;
}): Promise<ReservationCheckoutSessionDto> => {
  const reservationMethod = await prisma.reservation.findFirst({
    where: { id: input.reservationId, requesterId: input.payerUserId },
    select: { paymentMethod: true },
  });
  if (reservationMethod?.paymentMethod === 'CASH') {
    throw new AppError(
      'Cash obligations are collected at handover and cannot start checkout.',
      409,
      'CASH_PAYMENT_NOT_CHECKOUTABLE',
    );
  }
  if (!isElectronicPaymentEnforced()) {
    throw new AppError(
      'Electronic payment is not enforced in this environment.',
      409,
      'PAYMENT_ENFORCEMENT_DISABLED',
    );
  }

  const key = validateIdempotencyKey(input.idempotencyKey);
  const requestHash = computeIdempotencyRequestHash({
    reservationId: input.reservationId,
  });
  const identity = {
    userId: input.payerUserId,
    scope: PAYMENT_RESERVATION_CHECKOUT_IDEMPOTENCY_SCOPE,
    key,
  };

  try {
    await claimIdempotencyRecord(prisma, { ...identity, requestHash });
  } catch (error) {
    if (!isIdempotencyClaimConflict(error)) {
      throw error;
    }

    const existing = await findIdempotencyRecord(prisma, identity);

    if (!existing) throw error;

    return resolveExistingIdempotencyRecord<ReservationCheckoutSessionDto>({
      requestHash,
      existing,
      details: { inProgress: { reason: 'REQUEST_IN_PROGRESS' } },
    }).response;
  }

  try {
    const reserved = await reserveReservationCheckoutSession({
      reservationId: input.reservationId,
      payerUserId: input.payerUserId,
    });

    if (!reserved.attemptId) {
      throw new AppError(
        'Checkout session is missing an attempt.',
        500,
        'INTERNAL_ERROR',
      );
    }

    const response = await finalizeSessionCheckoutWithProvider(reserved);

    await markIdempotencyRecordSucceeded(prisma, {
      ...identity,
      resourceType: 'PAYMENT_CHECKOUT_SESSION',
      resourceId: response.checkoutSessionId,
      response,
    });

    return response;
  } catch (error) {
    await markIdempotencyRecordFailed(prisma, identity).catch(() => undefined);
    throw error;
  }
};

export const expireStaleCheckoutSessionsForReservation = async (
  reservationId: string,
  now: Date = new Date(),
): Promise<number> => {
  const sessions = await prisma.paymentCheckoutSession.findMany({
    where: {
      reservationId,
      status: { in: ['CREATED', 'CHECKOUT_PENDING'] },
    },
    select: { id: true },
  });

  let expired = 0;
  for (const session of sessions) {
    await runSerializableTransaction(async (tx) => {
      const before = await tx.paymentCheckoutSession.findUnique({
        where: { id: session.id },
        select: { status: true },
      });
      await expireStaleSessionAttempts(tx, session.id, now);
      const after = await tx.paymentCheckoutSession.findUnique({
        where: { id: session.id },
        select: { status: true },
      });
      if (
        before &&
        before.status !== 'EXPIRED' &&
        after?.status === 'EXPIRED'
      ) {
        expired += 1;
      }
    });
  }
  return expired;
};

/**
 * Server-owned expiry reconciliation (not a list/detail GET mutation).
 * Call from Flutter resume/polling or ops jobs.
 */
export const reconcileExpiredCheckoutSessions = async (input?: {
  reservationId?: string;
  limit?: number;
}): Promise<{ expiredSessionCount: number }> => {
  const now = new Date();

  if (input?.reservationId) {
    const expiredSessionCount = await expireStaleCheckoutSessionsForReservation(
      input.reservationId,
      now,
    );
    return { expiredSessionCount };
  }

  const sessions = await prisma.paymentCheckoutSession.findMany({
    where: {
      status: { in: ['CREATED', 'CHECKOUT_PENDING'] },
      attempts: {
        some: {
          status: { in: ['CREATED', 'PENDING'] },
          expiresAt: { lte: now },
        },
      },
    },
    select: { reservationId: true },
    take: input?.limit ?? 100,
    orderBy: { createdAt: 'asc' },
    distinct: ['reservationId'],
  });

  let expiredSessionCount = 0;
  for (const session of sessions) {
    expiredSessionCount += await expireStaleCheckoutSessionsForReservation(
      session.reservationId,
      now,
    );
  }
  return { expiredSessionCount };
};

export const getCheckoutSessionForActor = async (
  checkoutSessionId: string,
  actor: PaymentActor,
): Promise<ReservationCheckoutSessionDto> => {
  const session = await prisma.paymentCheckoutSession.findUnique({
    where: { id: checkoutSessionId },
    include: checkoutSessionDetailInclude,
  });

  if (!session) {
    throw new AppError('Checkout session not found.', 404, 'NOT_FOUND');
  }

  if (
    session.payerUserId !== actor.userId &&
    !isPaymentAdminActor(actor)
  ) {
    throw new AppError('Checkout session not found.', 404, 'NOT_FOUND');
  }

  return mapSessionDto({
    session,
    attempt: session.attempts[0] ?? null,
  });
};

/**
 * Authz helper for reservation-scoped payment commands (no DB mutation).
 */
export const assertReservationPaymentAccess = async (
  reservationId: string,
  actor: PaymentActor,
): Promise<{ id: string; requesterId: string }> => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, requesterId: true },
  });
  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }
  assertLearnerOwnerOrAdmin(reservation.requesterId, actor);
  return reservation;
};

/**
 * Resume helper: return the CheckoutSession that matches the current payable set.
 * Shared-group sessions are discoverable from any included Reservation, not only
 * the primary session.reservationId. Never restores an old SUCCEEDED session when
 * new unpaid obligations exist. Does not mutate TTL state.
 */
export const getRelevantCheckoutSessionForReservation = async (
  reservationId: string,
  actor: PaymentActor,
): Promise<ReservationCheckoutSessionDto | null> => {
  const reservation = await assertReservationPaymentAccess(reservationId, actor);

  const reservationRow = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { deliveryGroupId: true },
  });

  let payableOrderIds: string[] = [];
  try {
    const resolved = await prisma.$transaction((tx) =>
      resolvePayableOrdersForReservationCheckout(
        tx,
        reservationId,
        reservation.requesterId,
      ),
    );
    payableOrderIds = resolved.orders.map((order) => order.id).sort();
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === 'PAYMENT_SOURCE_INVARIANT_VIOLATION'
    ) {
      throw error;
    }
    if (
      error instanceof AppError &&
      (error.code === 'RESERVATION_NOT_ACCEPTED' || error.code === 'NOT_FOUND')
    ) {
      return null;
    }
    throw error;
  }

  const payableKey = payableOrderIds.join(',');

  const candidates = await prisma.paymentCheckoutSession.findMany({
    where: {
      payerUserId: reservation.requesterId,
      OR: [
        { reservationId },
        {
          items: {
            some: {
              paymentOrder: { reservationId },
            },
          },
        },
        ...(reservationRow?.deliveryGroupId
          ? [{ deliveryGroupId: reservationRow.deliveryGroupId }]
          : []),
      ],
      status: {
        in: [
          'CREATED',
          'CHECKOUT_PENDING',
          'SUCCEEDED',
          'FAILED',
          'CANCELLED',
          'EXPIRED',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: checkoutSessionDetailInclude,
  });

  const itemKey = (session: (typeof candidates)[number]) =>
    session.items
      .map((item) => item.paymentOrderId)
      .sort()
      .join(',');

  const includesReservation = (session: (typeof candidates)[number]) =>
    session.reservationId === reservationId ||
    session.items.some(
      (item) =>
        item.paymentOrder.reservationId === reservationId ||
        item.paymentOrder.reservation?.id === reservationId,
    );

  if (payableOrderIds.length > 0) {
    const active = candidates.find(
      (session) =>
        (session.status === 'CREATED' ||
          session.status === 'CHECKOUT_PENDING') &&
        includesReservation(session) &&
        itemKey(session) === payableKey,
    );
    if (active) {
      return mapSessionDto({
        session: active,
        attempt: active.attempts[0] ?? null,
      });
    }

    // Active session whose items include this reservation's current payable
    // orders (shared group may have a broader exact set matching payableKey).
    const activeOverlapping = candidates.find(
      (session) =>
        (session.status === 'CREATED' ||
          session.status === 'CHECKOUT_PENDING') &&
        includesReservation(session) &&
        payableOrderIds.every((id) =>
          session.items.some((item) => item.paymentOrderId === id),
        ) &&
        itemKey(session) === payableKey,
    );
    if (activeOverlapping) {
      return mapSessionDto({
        session: activeOverlapping,
        attempt: activeOverlapping.attempts[0] ?? null,
      });
    }

    const failedMatching = candidates.find(
      (session) =>
        (session.status === 'FAILED' ||
          session.status === 'CANCELLED' ||
          session.status === 'EXPIRED') &&
        includesReservation(session) &&
        itemKey(session) === payableKey,
    );
    if (failedMatching) {
      return mapSessionDto({
        session: failedMatching,
        attempt: failedMatching.attempts[0] ?? null,
      });
    }

    // New obligations after a prior success — do not restore old SUCCEEDED.
    return null;
  }

  const succeeded = candidates.find(
    (session) =>
      session.status === 'SUCCEEDED' && includesReservation(session),
  );
  if (succeeded) {
    return mapSessionDto({
      session: succeeded,
      attempt: succeeded.attempts[0] ?? null,
    });
  }

  return null;
};

/** @deprecated Prefer getRelevantCheckoutSessionForReservation */
export const getActiveCheckoutSessionForReservation =
  getRelevantCheckoutSessionForReservation;

export const cancelReservationCheckoutSession = async (input: {
  checkoutSessionId: string;
  attemptId: string;
  payerUserId: string;
}): Promise<ReservationCheckoutSessionDto> => {
  return runSerializableTransaction(async (tx) => {
    const session = await tx.paymentCheckoutSession.findUnique({
      where: { id: input.checkoutSessionId },
      include: checkoutSessionDetailInclude,
    });

    if (!session || session.payerUserId !== input.payerUserId) {
      throw new AppError('Checkout session not found.', 404, 'NOT_FOUND');
    }

    const attempt =
      session.attempts.find((row) => row.id === input.attemptId) ??
      (await tx.paymentAttempt.findFirst({
        where: {
          id: input.attemptId,
          checkoutSessionId: session.id,
        },
      }));
    if (!attempt) {
      throw new AppError('Payment attempt not found.', 404, 'NOT_FOUND');
    }

    if (!isActivePaymentAttemptStatus(attempt.status)) {
      throw new AppError(
        'Payment attempt is not active.',
        409,
        'ATTEMPT_NOT_ACTIVE',
      );
    }

    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'CANCELLED',
        failureCode: 'CANCELLED',
        failureMessage: 'Cancelled by payer.',
      },
    });

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

    const refreshed = await tx.paymentCheckoutSession.findUniqueOrThrow({
      where: { id: session.id },
      include: checkoutSessionDetailInclude,
    });

    return mapSessionDto({
      session: refreshed,
      attempt: refreshed.attempts[0] ?? null,
    });
  });
};

