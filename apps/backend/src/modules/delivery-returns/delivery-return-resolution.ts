import type {
  DeliveryResolutionOutcome,
  Prisma,
} from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import {
  cancelUnpaidPaymentOrder,
  prepareFullRefundForPaidOrderInTransaction,
  type PostCommitRefundTask,
} from '../payments/payments.lifecycle.js';
import { isPayablePaymentOrderStatus } from '../payments/payments.status-policy.js';
import { recomputeAndUpdateMaterialStatus } from '../reservations/reservations.quantity.js';
import { requireAuthoritativeCarriedItems } from './delivery-returns.repository.js';

const resolutionReason = (outcome: DeliveryResolutionOutcome) =>
  outcome === 'VERIFIED_LEARNER_RESPONSIBILITY'
    ? 'Verified learner responsibility after returned delivery'
    : 'Learner not responsible after returned delivery';

export const deliveryReturnFinancialPolicy = (
  outcome: DeliveryResolutionOutcome,
) => ({
  materialSubtotal: {
    refundPaidCard: true,
    cancelUnpaidCash: true,
  },
  deliveryFee: {
    refundPaidCard: outcome === 'LEARNER_NOT_RESPONSIBLE',
    cancelUnpaidCash: true,
  },
});

const resolveOrder = async (
  tx: Prisma.TransactionClient,
  order: {
    id: string;
    status: string;
    paymentMethod: string;
  },
  input: {
    refundCard: boolean;
    reason: string;
    adminUserId: string;
    refunds: PostCommitRefundTask[];
  },
) => {
  if (order.paymentMethod === 'CASH') {
    if (isPayablePaymentOrderStatus(order.status as never)) {
      await cancelUnpaidPaymentOrder(tx, {
        orderId: order.id,
        reason: input.reason,
      });
    }
    return;
  }
  if (!input.refundCard) return;
  if (order.status === 'PAID' || order.status === 'REFUND_PENDING') {
    const prepared = await prepareFullRefundForPaidOrderInTransaction(tx, {
      orderId: order.id,
      reason: input.reason,
    });
    if (prepared.postCommit) {
      input.refunds.push({
        ...prepared.postCommit,
        actorUserId: input.adminUserId,
      });
    }
  }
};

export const finalizeReturnedDeliveryInTransaction = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryId: string;
    adminUserId: string;
    outcome: DeliveryResolutionOutcome;
  },
) => {
  const delivery = await tx.delivery.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      status: true,
      deliveryGroupId: true,
      administrativelyResolvedAt: true,
      resolutionOutcome: true,
    },
  });
  if (!delivery) throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  if (delivery.status !== 'RETURNED_TO_SUPPLIER') {
    throw new AppError(
      'Physical return must be confirmed before administrative resolution.',
      409,
      'DELIVERY_RETURN_CONFIRMATION_REQUIRED',
    );
  }
  if (delivery.administrativelyResolvedAt) {
    if (delivery.resolutionOutcome !== input.outcome) {
      throw new AppError(
        'Delivery was already resolved with a different outcome.',
        409,
        'DELIVERY_ALREADY_RESOLVED',
      );
    }
    return { postCommitRefunds: [] as PostCommitRefundTask[], alreadyResolved: true };
  }

  const { reservationIds } = await requireAuthoritativeCarriedItems(
    tx,
    delivery.id,
  );
  const reservations = await tx.reservation.findMany({
    where: {
      id: { in: reservationIds },
      status: 'AWAITING_RESOLUTION',
      fulfillmentMethod: 'DELIVERY',
    },
    select: { id: true, materialId: true },
  });
  if (reservations.length !== reservationIds.length) {
    throw new AppError(
      'Returned delivery reservation state is inconsistent.',
      409,
      'DELIVERY_RETURN_STATE_CONFLICT',
    );
  }

  const reason = resolutionReason(input.outcome);
  const financialPolicy = deliveryReturnFinancialPolicy(input.outcome);
  const postCommitRefunds: PostCommitRefundTask[] = [];
  for (const reservation of reservations) {
    const materialOrder = await tx.paymentOrder.findFirst({
      where: {
        reservationId: reservation.id,
        purpose: 'MATERIAL_SUBTOTAL',
      },
      orderBy: { cycleNumber: 'desc' },
      select: { id: true, status: true, paymentMethod: true },
    });
    if (materialOrder) {
      await resolveOrder(tx, materialOrder, {
        refundCard: financialPolicy.materialSubtotal.refundPaidCard,
        reason,
        adminUserId: input.adminUserId,
        refunds: postCommitRefunds,
      });
    }
  }

  const feeOrder = await tx.paymentOrder.findFirst({
    where: {
      purpose: 'DELIVERY_FEE',
      ...(delivery.deliveryGroupId
        ? { deliveryGroupId: delivery.deliveryGroupId }
        : { reservationId: { in: reservationIds } }),
    },
    orderBy: { cycleNumber: 'desc' },
    select: { id: true, status: true, paymentMethod: true },
  });
  if (feeOrder) {
    await resolveOrder(tx, feeOrder, {
      refundCard: financialPolicy.deliveryFee.refundPaidCard,
      reason,
      adminUserId: input.adminUserId,
      refunds: postCommitRefunds,
    });
  }

  const changed = await tx.reservation.updateMany({
    where: { id: { in: reservationIds }, status: 'AWAITING_RESOLUTION' },
    data: { status: 'FULFILLMENT_FAILED' },
  });
  if (changed.count !== reservationIds.length) {
    throw new AppError(
      'Returned delivery resolution raced another transition.',
      409,
      'DELIVERY_RETURN_STATE_CONFLICT',
    );
  }
  for (const reservation of reservations) {
    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_RESOLUTION',
        newStatus: 'FULFILLMENT_FAILED',
        changedBy: input.adminUserId,
        note: reason,
      },
    });
  }
  await tx.delivery.update({
    where: { id: delivery.id },
    data: {
      resolutionOutcome: input.outcome,
      administrativelyResolvedAt: new Date(),
      administrativelyResolvedByUserId: input.adminUserId,
    },
  });
  for (const materialId of new Set(reservations.map((row) => row.materialId))) {
    await recomputeAndUpdateMaterialStatus(tx, materialId);
  }

  return { postCommitRefunds, alreadyResolved: false };
};
