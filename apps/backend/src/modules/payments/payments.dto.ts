import type {
  PaymentAttemptStatus,
  PaymentOrderStatus,
  PaymentProviderMode,
  PaymentProviderType,
  PaymentRefundStatus,
  Prisma,
} from '../../generated/prisma/client.js';

import {
  moneyDecimalToMinorUnits,
  moneyDecimalToString,
} from './payments.money.js';

export type PaymentAttemptSummaryDto = {
  id: string;
  status: PaymentAttemptStatus;
  provider: PaymentProviderType;
  providerMode: PaymentProviderMode;
  amount: string;
  amountMinor: number;
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  expiresAt: string | null;
  createdAt: string;
  succeededAt: string | null;
};

export type PaymentRefundSummaryDto = {
  id: string;
  status: PaymentRefundStatus;
  amount: string;
  currency: string;
  reason: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  requestedAt: string;
  succeededAt: string | null;
};

export type PaymentOrderDto = {
  id: string;
  purpose: 'MATERIAL_SUBTOTAL' | 'DELIVERY_FEE';
  cycleNumber: number;
  status: PaymentOrderStatus;
  amount: string;
  amountMinor: number;
  currency: string;
  reservationId: string | null;
  deliveryGroupId: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  attempts: PaymentAttemptSummaryDto[];
  refund: PaymentRefundSummaryDto | null;
};

export type CheckoutResponseDto = {
  orderId: string;
  orderStatus: PaymentOrderStatus;
  attemptId: string;
  attemptStatus: PaymentAttemptStatus;
  checkoutUrl: string;
  expiresAt: string | null;
};

const mapAttempt = (attempt: {
  id: string;
  status: PaymentAttemptStatus;
  provider: PaymentProviderType;
  providerMode: PaymentProviderMode;
  amount: Prisma.Decimal;
  amountMinor: number;
  currency: string;
  failureCode: string | null;
  failureMessage: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  succeededAt: Date | null;
}): PaymentAttemptSummaryDto => ({
  id: attempt.id,
  status: attempt.status,
  provider: attempt.provider,
  providerMode: attempt.providerMode,
  amount: moneyDecimalToString(attempt.amount),
  amountMinor: attempt.amountMinor,
  currency: attempt.currency,
  failureCode: attempt.failureCode,
  failureMessage: attempt.failureMessage,
  expiresAt: attempt.expiresAt?.toISOString() ?? null,
  createdAt: attempt.createdAt.toISOString(),
  succeededAt: attempt.succeededAt?.toISOString() ?? null,
});

const mapRefund = (refund: {
  id: string;
  status: PaymentRefundStatus;
  amount: Prisma.Decimal;
  currency: string;
  reason: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  requestedAt: Date;
  succeededAt: Date | null;
}): PaymentRefundSummaryDto => ({
  id: refund.id,
  status: refund.status,
  amount: moneyDecimalToString(refund.amount),
  currency: refund.currency,
  reason: refund.reason,
  failureCode: refund.failureCode,
  failureMessage: refund.failureMessage,
  requestedAt: refund.requestedAt.toISOString(),
  succeededAt: refund.succeededAt?.toISOString() ?? null,
});

export const mapPaymentOrderDto = (order: {
  id: string;
  purpose: 'MATERIAL_SUBTOTAL' | 'DELIVERY_FEE';
  cycleNumber: number;
  status: PaymentOrderStatus;
  amount: Prisma.Decimal;
  currency: string;
  reservationId: string | null;
  deliveryGroupId: string | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attempts: Array<{
    id: string;
    status: PaymentAttemptStatus;
    provider: PaymentProviderType;
    providerMode: PaymentProviderMode;
    amount: Prisma.Decimal;
    amountMinor: number;
    currency: string;
    failureCode: string | null;
    failureMessage: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    succeededAt: Date | null;
  }>;
  refund: {
    id: string;
    status: PaymentRefundStatus;
    amount: Prisma.Decimal;
    currency: string;
    reason: string | null;
    failureCode: string | null;
    failureMessage: string | null;
    requestedAt: Date;
    succeededAt: Date | null;
  } | null;
}): PaymentOrderDto => ({
  id: order.id,
  purpose: order.purpose,
  cycleNumber: order.cycleNumber,
  status: order.status,
  amount: moneyDecimalToString(order.amount),
  amountMinor: moneyDecimalToMinorUnits(order.amount),
  currency: order.currency,
  reservationId: order.reservationId,
  deliveryGroupId: order.deliveryGroupId,
  paidAt: order.paidAt?.toISOString() ?? null,
  cancelledAt: order.cancelledAt?.toISOString() ?? null,
  refundedAt: order.refundedAt?.toISOString() ?? null,
  createdAt: order.createdAt.toISOString(),
  updatedAt: order.updatedAt.toISOString(),
  attempts: order.attempts.map(mapAttempt),
  refund: order.refund ? mapRefund(order.refund) : null,
});
