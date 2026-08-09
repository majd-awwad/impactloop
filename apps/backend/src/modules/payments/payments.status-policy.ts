import type { PaymentOrderStatus } from '../../generated/prisma/client.js';

/** Orders that may enter or continue checkout. */
export const PAYABLE_PAYMENT_ORDER_STATUSES = [
  'REQUIRES_PAYMENT',
  'CHECKOUT_PENDING',
] as const satisfies readonly PaymentOrderStatus[];

/** Closed orders that permit a replacement payment cycle. */
export const PAYMENT_ORDER_NEW_CYCLE_TERMINAL_STATUSES = [
  'CANCELLED',
  'REFUNDED',
] as const satisfies readonly PaymentOrderStatus[];

export const isPayablePaymentOrderStatus = (
  status: PaymentOrderStatus,
): boolean =>
  (PAYABLE_PAYMENT_ORDER_STATUSES as readonly PaymentOrderStatus[]).includes(
    status,
  );

export const isTerminalPaymentOrderForNewCycle = (
  status: PaymentOrderStatus,
): boolean =>
  (
    PAYMENT_ORDER_NEW_CYCLE_TERMINAL_STATUSES as readonly PaymentOrderStatus[]
  ).includes(status);
