export const PAYMENT_CHECKOUT_IDEMPOTENCY_SCOPE = 'PAYMENT_CHECKOUT';

/** Reservation-scoped checkout (PAY-05D) — one session may settle many orders. */
export const PAYMENT_RESERVATION_CHECKOUT_IDEMPOTENCY_SCOPE =
  'PAYMENT_RESERVATION_CHECKOUT';

export const PAYMENT_CURRENCY_MINOR_UNITS = 100;

/** Max minor units representable in PostgreSQL INTEGER / Prisma Int. */
export const PAYMENT_AMOUNT_MINOR_MAX = 2_147_483_647;

/** Max major units consistent with INTEGER amount_minor (two decimal places). */
export const PAYMENT_AMOUNT_MAJOR_MAX = '21474836.47';

/** Canonical normalized provider event types (provider-agnostic). */
export const PROVIDER_EVENT_TYPES = {
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_DECLINED: 'payment.declined',
  PAYMENT_CANCELLED: 'payment.cancelled',
  PAYMENT_PENDING: 'payment.pending',
  PAYMENT_EXPIRED: 'payment.expired',
  REFUND_PENDING: 'refund.pending',
  REFUND_SUCCEEDED: 'refund.succeeded',
  REFUND_FAILED: 'refund.failed',
} as const;

export type ProviderEventType =
  (typeof PROVIDER_EVENT_TYPES)[keyof typeof PROVIDER_EVENT_TYPES];

/** @deprecated Prefer PROVIDER_EVENT_TYPES — kept for Mock builders during PAY-01. */
export const MOCK_PROVIDER_EVENT_TYPES = PROVIDER_EVENT_TYPES;

export type MockProviderEventType = ProviderEventType;

export const MOCK_CHECKOUT_ACTIONS = [
  'success',
  'decline',
  'cancel',
  'pending',
  'timeout',
] as const;

export type MockCheckoutAction = (typeof MOCK_CHECKOUT_ACTIONS)[number];

export {
  PAYABLE_PAYMENT_ORDER_STATUSES,
  isPayablePaymentOrderStatus,
} from './payments.status-policy.js';

export const isActivePaymentAttemptStatus = (status: string): boolean =>
  status === 'CREATED' || status === 'PENDING';

/**
 * Lease for in-flight provider.createCheckout claims (PAY-05D-R2).
 * Abandoned CREATED attempts become recoverable after this window.
 */
export const PROVIDER_CHECKOUT_CLAIM_LEASE_MS = 60_000;

export const LIFECYCLE_REFUND_REASONS_SESSION = {
  DUPLICATE_ALLOCATION_AFTER_OTHER_CHARGE:
    'DUPLICATE_ALLOCATION_AFTER_OTHER_CHARGE',
} as const;
