import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';
import { prisma } from '../../database/prisma.js';

import {
  isPositiveMoney,
  moneyDecimalToString,
  toMoneyDecimal,
} from './payments.money.js';

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2002';

export type EnsurePaymentOrderResult =
  | {
      outcome: 'CREATED' | 'EXISTING';
      order: {
        id: string;
        payerUserId: string;
        purpose: 'MATERIAL_SUBTOTAL' | 'DELIVERY_FEE';
        cycleNumber: number;
        status: string;
        currency: string;
        amount: string;
        reservationId: string | null;
        deliveryGroupId: string | null;
      };
    }
  | { outcome: 'NOT_REQUIRED' }
  | { outcome: 'NOT_FOUND' };

const mapOrder = (order: {
  id: string;
  payerUserId: string;
  purpose: 'MATERIAL_SUBTOTAL' | 'DELIVERY_FEE';
  cycleNumber: number;
  status: string;
  currency: string;
  amount: Prisma.Decimal;
  reservationId: string | null;
  deliveryGroupId: string | null;
}) => ({
  id: order.id,
  payerUserId: order.payerUserId,
  purpose: order.purpose,
  cycleNumber: order.cycleNumber,
  status: order.status,
  currency: order.currency,
  amount: moneyDecimalToString(order.amount),
  reservationId: order.reservationId,
  deliveryGroupId: order.deliveryGroupId,
});

const findMaterialCycle1 = (
  tx: Prisma.TransactionClient,
  reservationId: string,
) =>
  tx.paymentOrder.findFirst({
    where: {
      purpose: 'MATERIAL_SUBTOTAL',
      reservationId,
      cycleNumber: 1,
    },
  });

const findDeliveryFeeCycle1 = (
  tx: Prisma.TransactionClient,
  deliveryGroupId: string,
) =>
  tx.paymentOrder.findFirst({
    where: {
      purpose: 'DELIVERY_FEE',
      deliveryGroupId,
      cycleNumber: 1,
    },
  });

export const ensureMaterialPaymentOrder = async (
  reservationId: string,
  txClient?: Prisma.TransactionClient,
): Promise<EnsurePaymentOrderResult> => {
  const run = async (tx: Prisma.TransactionClient) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        requesterId: true,
        materialSubtotal: true,
        pricingCurrency: true,
      },
    });

    if (!reservation) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const amount = toMoneyDecimal(reservation.materialSubtotal ?? 0);
    if (!isPositiveMoney(amount)) {
      return { outcome: 'NOT_REQUIRED' as const };
    }

    const existing = await findMaterialCycle1(tx, reservation.id);
    if (existing) {
      return {
        outcome: 'EXISTING' as const,
        order: mapOrder(existing),
      };
    }

    const currency = reservation.pricingCurrency?.trim() || 'NIS';

    try {
      const created = await tx.paymentOrder.create({
        data: {
          payerUserId: reservation.requesterId,
          purpose: 'MATERIAL_SUBTOTAL',
          cycleNumber: 1,
          status: 'REQUIRES_PAYMENT',
          currency,
          amount,
          reservationId: reservation.id,
          deliveryGroupId: null,
        },
      });

      return {
        outcome: 'CREATED' as const,
        order: mapOrder(created),
      };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const winner = await findMaterialCycle1(tx, reservation.id);
      if (!winner) {
        throw error;
      }

      return {
        outcome: 'EXISTING' as const,
        order: mapOrder(winner),
      };
    }
  };

  if (txClient) {
    return run(txClient);
  }

  return runSerializableTransaction(run);
};

export const ensureDeliveryFeePaymentOrder = async (
  deliveryGroupId: string,
  txClient?: Prisma.TransactionClient,
): Promise<EnsurePaymentOrderResult> => {
  const run = async (tx: Prisma.TransactionClient) => {
    const group = await tx.deliveryGroup.findUnique({
      where: { id: deliveryGroupId },
      select: {
        id: true,
        learnerId: true,
        deliveryFee: true,
        currency: true,
        reservations: {
          select: {
            id: true,
            requesterId: true,
          },
        },
      },
    });

    if (!group) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const foreignRequester = group.reservations.find(
      (row) => row.requesterId !== group.learnerId,
    );
    if (foreignRequester) {
      throw new AppError(
        'Delivery group ownership invariant violated.',
        500,
        'PAYMENT_GROUP_OWNERSHIP_INVALID',
        {
          deliveryGroupId: group.id,
          learnerId: group.learnerId,
          reservationId: foreignRequester.id,
        },
      );
    }

    const amount = toMoneyDecimal(group.deliveryFee);
    if (!isPositiveMoney(amount)) {
      return { outcome: 'NOT_REQUIRED' as const };
    }

    const existing = await findDeliveryFeeCycle1(tx, group.id);
    if (existing) {
      return {
        outcome: 'EXISTING' as const,
        order: mapOrder(existing),
      };
    }

    const currency = group.currency?.trim() || 'NIS';

    try {
      const created = await tx.paymentOrder.create({
        data: {
          payerUserId: group.learnerId,
          purpose: 'DELIVERY_FEE',
          cycleNumber: 1,
          status: 'REQUIRES_PAYMENT',
          currency,
          amount,
          reservationId: null,
          deliveryGroupId: group.id,
        },
      });

      return {
        outcome: 'CREATED' as const,
        order: mapOrder(created),
      };
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const winner = await findDeliveryFeeCycle1(tx, group.id);
      if (!winner) {
        throw error;
      }

      return {
        outcome: 'EXISTING' as const,
        order: mapOrder(winner),
      };
    }
  };

  if (txClient) {
    return run(txClient);
  }

  return runSerializableTransaction(run);
};
