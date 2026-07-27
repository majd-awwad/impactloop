export const RESERVATION_ATTENTION_STATES = [
  'SUPPLIER_ACTION_REQUIRED',
  'WAITING_FOR_LEARNER',
  'FULFILLMENT_IN_PROGRESS',
  'ADMIN_REVIEW_REQUIRED',
  'TERMINAL',
] as const;

export const RESERVATION_NEXT_ACTORS = [
  'SUPPLIER',
  'LEARNER',
  'DRIVER',
  'ADMIN',
  'SYSTEM',
  'NONE',
] as const;

export const RESERVATION_WORKFLOW_PHASES = [
  'INITIAL_DECISION',
  'SCHEDULING',
  'SELF_PICKUP',
  'DELIVERY',
  'RECOVERY',
  'COMPLETED',
  'CLOSED',
] as const;

export const SUPPLIER_RESERVATION_SUMMARY_BUCKETS = [
  'NEEDS_SUPPLIER_RESPONSE',
  'WAITING_FOR_LEARNER',
  'FULFILLMENT_IN_PROGRESS',
  'ADMIN_REVIEW',
  'COMPLETED',
  'CLOSED',
] as const;

export const SUPPLIER_RESERVATION_ACTIONS = [
  'ACCEPT',
  'DECLINE',
  'SEND_MESSAGE',
  'COMPLETE_SELF_PICKUP',
  'PROPOSE_RESCHEDULE',
  'ACCEPT_LEARNER_RESCHEDULE',
  'CLOSE_RESERVATION',
  'MARK_LEARNER_NO_SHOW',
  'REPORT_INCIDENT',
  'REPORT_NO_DRIVER',
  'MARK_DELIVERY_PICKUP_EXPIRED',
  'REPORT_DRIVER_NO_SHOW',
  'SUBMIT_RECOVERY_PICKUP_WINDOW',
] as const;

export type ReservationAttentionState =
  (typeof RESERVATION_ATTENTION_STATES)[number];
export type ReservationNextActor = (typeof RESERVATION_NEXT_ACTORS)[number];
export type ReservationWorkflowPhase =
  (typeof RESERVATION_WORKFLOW_PHASES)[number];
export type SupplierReservationSummaryBucket =
  (typeof SUPPLIER_RESERVATION_SUMMARY_BUCKETS)[number];
export type SupplierReservationAction =
  (typeof SUPPLIER_RESERVATION_ACTIONS)[number];

/**
 * Pure input assembled by the supplier reservation mapper. Every capability is
 * calculated by existing eligibility code before it reaches this classifier.
 */
export type SupplierReservationClassifierContext = {
  status: string;
  fulfillmentMethod: string;
  deliveryStatus: string | null;
  hasDelivery: boolean;
  canAccept: boolean;
  canDecline: boolean;
  canSendMessage: boolean;
  canSupplierComplete: boolean;
  canSupplierReschedule: boolean;
  canSupplierAcceptLearnerReschedule: boolean;
  canSupplierProposeDifferentTime: boolean;
  canSupplierClose: boolean;
  canMarkLearnerNoShow: boolean;
  canReportIncident: boolean;
  canReportNoDriverAvailable: boolean;
  canMarkDeliveryPickupExpired: boolean;
  canReportDriverNoShow: boolean;
  canSubmitRecoveryPickupWindow: boolean;
};

export type SupplierReservationContract = {
  workflowPhase: ReservationWorkflowPhase;
  attentionState: ReservationAttentionState;
  nextActor: ReservationNextActor;
  summaryBucket: SupplierReservationSummaryBucket;
  availableActions: SupplierReservationAction[];
};

const CLOSED_STATUSES = new Set([
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
]);

const DRIVER_FULFILLMENT_STATUSES = new Set([
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
]);

export const determineAvailableSupplierActions = (
  context: SupplierReservationClassifierContext,
): SupplierReservationAction[] => {
  const actions: SupplierReservationAction[] = [];

  if (context.canAccept) actions.push('ACCEPT');
  if (context.canDecline) actions.push('DECLINE');
  if (context.canSendMessage) actions.push('SEND_MESSAGE');
  if (context.canSupplierComplete) actions.push('COMPLETE_SELF_PICKUP');
  if (context.canSupplierReschedule || context.canSupplierProposeDifferentTime) {
    actions.push('PROPOSE_RESCHEDULE');
  }
  if (context.canSupplierAcceptLearnerReschedule) {
    actions.push('ACCEPT_LEARNER_RESCHEDULE');
  }
  if (context.canSupplierClose) actions.push('CLOSE_RESERVATION');
  if (context.canMarkLearnerNoShow) actions.push('MARK_LEARNER_NO_SHOW');
  if (context.canReportIncident) actions.push('REPORT_INCIDENT');
  if (context.canReportNoDriverAvailable) actions.push('REPORT_NO_DRIVER');
  if (context.canMarkDeliveryPickupExpired) {
    actions.push('MARK_DELIVERY_PICKUP_EXPIRED');
  }
  if (context.canReportDriverNoShow) actions.push('REPORT_DRIVER_NO_SHOW');
  if (context.canSubmitRecoveryPickupWindow) {
    actions.push('SUBMIT_RECOVERY_PICKUP_WINDOW');
  }

  return actions;
};

export const classifyWorkflowPhase = (
  context: SupplierReservationClassifierContext,
): ReservationWorkflowPhase => {
  if (context.status === 'COMPLETED') return 'COMPLETED';
  if (CLOSED_STATUSES.has(context.status)) return 'CLOSED';
  if (context.status === 'AWAITING_RESOLUTION') return 'RECOVERY';
  if (
    context.status === 'AWAITING_LEARNER_CONFIRMATION' ||
    context.status === 'AWAITING_SUPPLIER_CONFIRMATION'
  ) {
    return 'SCHEDULING';
  }
  if (context.status === 'PENDING') return 'INITIAL_DECISION';
  if (context.fulfillmentMethod === 'DELIVERY' || context.hasDelivery) {
    return 'DELIVERY';
  }
  return 'SELF_PICKUP';
};

export const classifyAttentionState = (input: {
  context: SupplierReservationClassifierContext;
  availableActions: SupplierReservationAction[];
}): ReservationAttentionState => {
  if (input.availableActions.some((action) => action !== 'SEND_MESSAGE')) {
    return 'SUPPLIER_ACTION_REQUIRED';
  }
  if (input.context.status === 'AWAITING_LEARNER_CONFIRMATION') {
    return 'WAITING_FOR_LEARNER';
  }
  if (input.context.status === 'AWAITING_RESOLUTION') {
    return 'ADMIN_REVIEW_REQUIRED';
  }
  if (
    input.context.status === 'COMPLETED' ||
    CLOSED_STATUSES.has(input.context.status)
  ) {
    return 'TERMINAL';
  }
  return 'FULFILLMENT_IN_PROGRESS';
};

export const classifyNextActor = (input: {
  context: SupplierReservationClassifierContext;
  attentionState: ReservationAttentionState;
}): ReservationNextActor => {
  if (input.attentionState === 'SUPPLIER_ACTION_REQUIRED') return 'SUPPLIER';
  if (input.attentionState === 'WAITING_FOR_LEARNER') return 'LEARNER';
  if (input.attentionState === 'ADMIN_REVIEW_REQUIRED') return 'ADMIN';
  if (input.attentionState === 'TERMINAL') return 'NONE';

  if (DRIVER_FULFILLMENT_STATUSES.has(input.context.deliveryStatus ?? '')) {
    return 'DRIVER';
  }
  if (input.context.status === 'AWAITING_SUPPLIER_CONFIRMATION') {
    // Fail closed: a malformed/non-actionable supplier-confirmation row must
    // not tell Flutter to expose an unsupported supplier action.
    return 'SYSTEM';
  }
  if (contextIsSelfPickup(input.context)) return 'LEARNER';
  return 'SYSTEM';
};

const contextIsSelfPickup = (context: SupplierReservationClassifierContext) =>
  context.fulfillmentMethod === 'PICKUP' && !context.hasDelivery;

export const classifySummaryBucket = (input: {
  attentionState: ReservationAttentionState;
  workflowPhase: ReservationWorkflowPhase;
}): SupplierReservationSummaryBucket => {
  if (input.attentionState === 'SUPPLIER_ACTION_REQUIRED') {
    return 'NEEDS_SUPPLIER_RESPONSE';
  }
  if (input.attentionState === 'WAITING_FOR_LEARNER') {
    return 'WAITING_FOR_LEARNER';
  }
  if (input.attentionState === 'ADMIN_REVIEW_REQUIRED') return 'ADMIN_REVIEW';
  if (input.workflowPhase === 'COMPLETED') return 'COMPLETED';
  if (input.workflowPhase === 'CLOSED') return 'CLOSED';
  return 'FULFILLMENT_IN_PROGRESS';
};

export const composeSupplierReservationContract = (
  context: SupplierReservationClassifierContext,
): SupplierReservationContract => {
  const availableActions = determineAvailableSupplierActions(context);
  const workflowPhase = classifyWorkflowPhase(context);
  const attentionState = classifyAttentionState({ context, availableActions });

  return {
    workflowPhase,
    attentionState,
    nextActor: classifyNextActor({ context, attentionState }),
    summaryBucket: classifySummaryBucket({ attentionState, workflowPhase }),
    availableActions,
  };
};
