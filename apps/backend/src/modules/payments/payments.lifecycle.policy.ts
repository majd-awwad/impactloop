import type {
  DeliveryStatus,
  ReservationStatus,
} from '../../generated/prisma/client.js';

/**
 * PAY-03 reservation status → payment action classification.
 * Based on actual repository writers, not aspirational semantics.
 */

export type ReservationPaymentLifecycleClass =
  | 'PRE_FULFILLMENT_TERMINAL'
  | 'FULFILLED'
  | 'RESOLUTION_REQUIRED'
  | 'RECOVERABLE'
  | 'PAYMENT_UNAFFECTED';

/**
 * Classify a Reservation status for payment lifecycle coupling.
 *
 * Deferred dispute policy: `FULFILLMENT_FAILED` and `AWAITING_RESOLUTION`
 * do not auto-refund — existing incident/admin recovery decides outcomes.
 */
export const classifyReservationPaymentLifecycle = (
  status: ReservationStatus,
): ReservationPaymentLifecycleClass => {
  switch (status) {
    case 'CANCELLED':
    case 'REJECTED':
    case 'EXPIRED':
    case 'NO_SHOW':
      // NO_SHOW writers mark ACCEPTED pickup/delivery as not completed.
      return 'PRE_FULFILLMENT_TERMINAL';
    case 'COMPLETED':
      return 'FULFILLED';
    case 'FULFILLMENT_FAILED':
    case 'AWAITING_RESOLUTION':
      return 'RESOLUTION_REQUIRED';
    case 'ACCEPTED':
    case 'AWAITING_SUPPLIER_CONFIRMATION':
    case 'AWAITING_LEARNER_CONFIRMATION':
      return 'RECOVERABLE';
    case 'PENDING':
      return 'PAYMENT_UNAFFECTED';
  }
};

/**
 * Material PaymentOrder refund/cancel eligibility.
 * Combines Reservation status with Delivery custody / fulfillment state.
 *
 * NO_SHOW: the only production Reservation writer is `markLearnerPickupNoShow`
 * (self-pickup ACCEPTED, window expired, no Delivery). That is pre-handover,
 * so status classification remains PRE_FULFILLMENT_TERMINAL; eligibility still
 * re-checks Delivery state so a future writer cannot silently refund in custody.
 */
export type MaterialRefundEligibility =
  | 'CANCEL_UNPAID'
  | 'REFUND_PAID'
  | 'FULFILLED_NO_REFUND'
  | 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED'
  | 'SOURCE_RESOLUTION_REQUIRED'
  | 'ORDER_ALREADY_TERMINAL'
  | 'NO_MATERIAL_PAYMENT_REQUIRED'
  | 'NO_ORDER'
  | 'SOURCE_NOT_TERMINAL';

export type DeliveryFeeEligibility =
  | 'FEE_STILL_REQUIRED'
  | 'GROUP_EMPTY_CANCEL_UNPAID'
  | 'GROUP_EMPTY_REFUND_PAID'
  | 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED'
  | 'FEE_ALREADY_REFUNDED'
  | 'FEE_ALREADY_CANCELLED'
  | 'NO_FEE_REQUIRED'
  | 'NO_FEE_ORDER';

/**
 * Members that still obligate the shared delivery fee.
 * Includes confirmation and resolution holds so fee is not refunded while
 * siblings remain under incident/admin recovery.
 */
export const ACTIVE_DELIVERY_GROUP_RESERVATION_STATUSES = [
  'ACCEPTED',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'AWAITING_RESOLUTION',
  'FULFILLMENT_FAILED',
] as const satisfies readonly ReservationStatus[];

export const FULFILLMENT_STARTED_DELIVERY_STATUSES = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
  'DELIVERED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
] as const satisfies readonly DeliveryStatus[];

export const COMPLETED_DELIVERY_STATUSES = [
  'DELIVERED',
] as const satisfies readonly DeliveryStatus[];

export const UNASSIGNED_CLOSEABLE_DELIVERY_STATUSES = [
  'WAITING_FOR_DRIVER',
] as const satisfies readonly DeliveryStatus[];

export {
  PAYMENT_ORDER_NEW_CYCLE_TERMINAL_STATUSES as TERMINAL_PAYMENT_ORDER_FOR_CYCLE,
  isTerminalPaymentOrderForNewCycle,
} from './payments.status-policy.js';

export const LIFECYCLE_REFUND_REASONS = {
  SOURCE_PRE_FULFILLMENT_TERMINAL: 'SOURCE_PRE_FULFILLMENT_TERMINAL',
  LATE_SUCCESS_AFTER_SOURCE_TERMINAL: 'LATE_SUCCESS_AFTER_SOURCE_TERMINAL',
  LATE_SUCCESS_RESOLUTION_REQUIRED: 'LATE_SUCCESS_RESOLUTION_REQUIRED',
  GROUP_EMPTY_BEFORE_FULFILLMENT: 'GROUP_EMPTY_BEFORE_FULFILLMENT',
} as const;
