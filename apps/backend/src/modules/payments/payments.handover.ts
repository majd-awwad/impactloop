import type { PaymentCollectionMethod, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { toMoneyDecimal } from './payments.money.js';
import {
  evaluateDeliveryGroupPaymentReadiness,
  evaluatePickupPaymentReadiness,
  type ObligationReadiness,
} from './payments.readiness.js';

type DbClient = Prisma.TransactionClient | typeof prisma;

export type HandoverPaymentSummary = {
  paymentMethod: PaymentCollectionMethod;
  cashDueAtHandover: boolean;
  totalAmount: string | null;
  currency: string | null;
};

type ResolvedHandoverPayment = HandoverPaymentSummary & {
  outstandingCashOrderIds: string[];
};

const invariantError = () =>
  new AppError(
    'The handover payment state is inconsistent and requires review.',
    409,
    'HANDOVER_PAYMENT_INVARIANT_INVALID',
  );

const wrongCollectorError = () =>
  new AppError(
    'This account is not authorized to collect payment for this handover.',
    403,
    'HANDOVER_CASH_COLLECTOR_INVALID',
  );

const confirmationRequiredError = () =>
  new AppError(
    'Confirm that the cash was physically received before completing handover.',
    400,
    'CASH_COLLECTION_CONFIRMATION_REQUIRED',
  );

const resolveObligations = (
  paymentMethod: PaymentCollectionMethod,
  obligations: ObligationReadiness[],
): ResolvedHandoverPayment => {
  const relevant = obligations.filter(
    (row) => row.status !== 'NOT_REQUIRED' && row.status !== 'PAYMENT_DISABLED',
  );

  if (relevant.some((row) => row.paymentMethod !== paymentMethod)) {
    throw invariantError();
  }

  const currencies = new Set(
    relevant.map((row) => row.currency).filter((value): value is string => !!value),
  );
  if (currencies.size > 1) {
    throw invariantError();
  }

  if (paymentMethod === 'CARD') {
    if (relevant.some((row) => !row.ready)) {
      throw new AppError(
        'Electronic payment must be completed before handover.',
        409,
        'PAYMENT_REQUIRED',
      );
    }
    return {
      paymentMethod,
      cashDueAtHandover: false,
      totalAmount: null,
      currency: null,
      outstandingCashOrderIds: [],
    };
  }

  if (
    relevant.some(
      (row) =>
        row.status !== 'REQUIRES_PAYMENT' && row.status !== 'PAID',
    )
  ) {
    throw invariantError();
  }

  const outstanding = relevant.filter(
    (row) => row.status === 'REQUIRES_PAYMENT',
  );
  if (
    outstanding.some(
      (row) => !row.paymentOrderId || !row.amount || !row.currency,
    )
  ) {
    throw invariantError();
  }

  const total = outstanding.reduce(
    (sum, row) => sum.plus(toMoneyDecimal(row.amount ?? 0)),
    toMoneyDecimal(0),
  );

  return {
    paymentMethod,
    cashDueAtHandover: outstanding.length > 0,
    totalAmount: outstanding.length > 0 ? total.toFixed(2) : null,
    currency: outstanding.length > 0 ? [...currencies][0] ?? null : null,
    outstandingCashOrderIds: outstanding
      .map((row) => row.paymentOrderId)
      .filter((id): id is string => !!id),
  };
};

export const resolvePickupHandoverPayment = async (
  reservationId: string,
  collectorUserId: string,
  txClient?: Prisma.TransactionClient,
): Promise<ResolvedHandoverPayment> => {
  const tx: DbClient = txClient ?? prisma;
  const reservation = await tx.reservation.findUnique({
    where: { id: reservationId },
    select: { ownerId: true, paymentMethod: true },
  });
  if (!reservation) throw invariantError();
  if (reservation.ownerId !== collectorUserId) throw wrongCollectorError();

  const readiness = await evaluatePickupPaymentReadiness(reservationId, txClient);
  return resolveObligations(reservation.paymentMethod, [readiness]);
};

export const resolveDeliveryHandoverPayment = async (
  deliveryId: string,
  collectorUserId: string,
  txClient?: Prisma.TransactionClient,
): Promise<ResolvedHandoverPayment> => {
  const tx: DbClient = txClient ?? prisma;
  const delivery = await tx.delivery.findUnique({
    where: { id: deliveryId },
    select: {
      reservationId: true,
      deliveryGroupId: true,
      reservation: { select: { paymentMethod: true } },
      deliveryGroup: {
        select: {
          paymentMethod: true,
          reservations: {
            where: { status: 'ACCEPTED', fulfillmentMethod: 'DELIVERY' },
            select: { id: true },
          },
        },
      },
      pickupItems: { where: { wasPicked: true }, select: { reservationId: true } },
      assignedDriverProfile: {
        select: { userId: true, status: true },
      },
      assignments: {
        where: { status: 'ACTIVE' },
        select: { driverProfile: { select: { userId: true } } },
      },
    },
  });

  if (!delivery) throw invariantError();
  if (
    delivery.assignedDriverProfile?.userId !== collectorUserId ||
    delivery.assignedDriverProfile.status !== 'ACTIVE' ||
    delivery.assignments.length !== 1 ||
    delivery.assignments[0]?.driverProfile.userId !== collectorUserId
  ) {
    throw wrongCollectorError();
  }

  if (!delivery.deliveryGroupId) {
    const carried = new Set(delivery.pickupItems.map((row) => row.reservationId));
    if (carried.size !== 1 || !carried.has(delivery.reservationId)) {
      throw invariantError();
    }
    const readiness = await evaluatePickupPaymentReadiness(
      delivery.reservationId,
      txClient,
    );
    return resolveObligations(delivery.reservation.paymentMethod, [readiness]);
  }

  if (!delivery.deliveryGroup) throw invariantError();
  const represented = new Set(
    delivery.deliveryGroup.reservations.map((row) => row.id),
  );
  const carried = new Set(delivery.pickupItems.map((row) => row.reservationId));
  if (
    represented.size === 0 ||
    represented.size !== carried.size ||
    [...represented].some((id) => !carried.has(id))
  ) {
    throw invariantError();
  }

  const readiness = await evaluateDeliveryGroupPaymentReadiness(
    delivery.deliveryGroupId,
    txClient,
  );
  if (
    readiness.awaitingConfirmationReservationIds.length > 0 ||
    readiness.invariantViolations.length > 0 ||
    readiness.materials.some((row) => !represented.has(row.reservationId))
  ) {
    throw invariantError();
  }
  return resolveObligations(delivery.deliveryGroup.paymentMethod, [
    readiness.fee,
    ...readiness.materials,
  ]);
};

const collectResolvedCash = async (
  tx: Prisma.TransactionClient,
  resolved: ResolvedHandoverPayment,
  collectorUserId: string,
  cashReceivedConfirmed: boolean | undefined,
  now: Date,
) => {
  if (!resolved.cashDueAtHandover) return resolved;
  if (cashReceivedConfirmed !== true) throw confirmationRequiredError();

  const updated = await tx.paymentOrder.updateMany({
    where: {
      id: { in: resolved.outstandingCashOrderIds },
      paymentMethod: 'CASH',
      status: 'REQUIRES_PAYMENT',
      paidAt: null,
      cashCollectedByUserId: null,
    },
    data: {
      status: 'PAID',
      paidAt: now,
      cashCollectedByUserId: collectorUserId,
    },
  });
  if (updated.count !== resolved.outstandingCashOrderIds.length) {
    throw invariantError();
  }
  return resolved;
};

export const collectPickupCashForHandover = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    collectorUserId: string;
    cashReceivedConfirmed?: boolean;
    now: Date;
  },
) =>
  collectResolvedCash(
    tx,
    await resolvePickupHandoverPayment(
      input.reservationId,
      input.collectorUserId,
      tx,
    ),
    input.collectorUserId,
    input.cashReceivedConfirmed,
    input.now,
  );

export const collectDeliveryCashForHandover = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryId: string;
    collectorUserId: string;
    cashReceivedConfirmed?: boolean;
    now: Date;
  },
) =>
  collectResolvedCash(
    tx,
    await resolveDeliveryHandoverPayment(
      input.deliveryId,
      input.collectorUserId,
      tx,
    ),
    input.collectorUserId,
    input.cashReceivedConfirmed,
    input.now,
  );
