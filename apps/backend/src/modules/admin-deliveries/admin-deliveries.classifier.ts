export type DeliveryScope = 'SINGLE' | 'GROUPED';

export type DeliveryLifecyclePhase =
  | 'WAITING_ASSIGNMENT'
  | 'PRE_PICKUP'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'RECOVERY_REQUIRED'
  | 'RECOVERY_IN_PROGRESS'
  | 'TERMINAL_FAILURE'
  | 'CANCELLED';

export type AdminAttentionState =
  | 'NONE'
  | 'ACTION_REQUIRED'
  | 'WAITING_EXTERNAL_PARTY';

export type DeliveryAssignmentState =
  | 'UNASSIGNED'
  | 'ACTIVE'
  | 'RELEASED'
  | 'HISTORICAL';

export type DeliveryKpiBucket =
  | 'NEEDS_ADMIN_REVIEW'
  | 'WAITING_FOR_DRIVER'
  | 'ACTIVE_IN_PROGRESS'
  | 'DELIVERED'
  | 'FAILED_CANCELLED';

export type DeliveryMutation = 'REOPEN_DRIVER_ASSIGNMENT';
export type DeliveryLink = 'OPEN_INCIDENT' | 'OPEN_RESERVATION' | 'OPEN_GROUP';

export type DeliveryIncidentContract = {
  id: string;
  workflowType:
    | 'ACCOUNTABILITY'
    | 'SYSTEM_RECOVERY'
    | 'ACCOUNTABILITY_AND_RECOVERY';
  operationalState: 'NOT_REQUIRED' | 'REQUIRES_RESOLUTION' | 'RESOLVED';
  availableActions: string[];
};

export type DeliveryAssignmentContract = {
  id: string;
  status: string;
  acceptedAt: Date | null;
  releasedAt?: Date | null;
  driver: { id: string; displayName: string; email: string } | null;
};

export type AdminDeliveryClassifierContext = {
  delivery: {
    id: string;
    status: string;
    deliveryGroupId: string | null;
    assignedDriverProfileId: string | null;
  };
  reservation: {
    id: string;
    status: string;
    pendingRescheduleRequestedBy: string | null;
    pendingRescheduleReason: string | null;
  };
  primaryIncident: DeliveryIncidentContract | null;
  hasExpectedRecoveryIncident: boolean;
  canReopenDriverAssignment: boolean;
  assignments: DeliveryAssignmentContract[];
};

const recoveryStatuses = new Set([
  'AWAITING_RESOLUTION',
  'DRIVER_NO_SHOW',
  'FAILED_PICKUP',
]);
const terminalFailureStatuses = new Set(['FAILED_DELIVERY', 'FAILED_PICKUP', 'DRIVER_NO_SHOW', 'LEARNER_NO_SHOW']);
const prePickupStatuses = new Set(['DRIVER_ASSIGNED', 'ARRIVED_PICKUP']);
const inTransitStatuses = new Set(['PICKED_UP', 'ON_THE_WAY', 'ARRIVED_DROPOFF']);
const incidentDecisionActions = new Set([
  'VERIFY',
  'REJECT',
  'RESOLVE_WITHOUT_STRIKE',
  'REQUEST_SUPPLIER_RESCHEDULE',
  'CANCEL_AND_RELEASE_HOLD',
]);

export const classifyDeliveryScope = (
  context: Pick<AdminDeliveryClassifierContext, 'delivery'>,
): DeliveryScope => (context.delivery.deliveryGroupId ? 'GROUPED' : 'SINGLE');

export const classifyLifecyclePhase = (
  context: Pick<
    AdminDeliveryClassifierContext,
    'delivery' | 'reservation' | 'primaryIncident' | 'hasExpectedRecoveryIncident'
  >,
): DeliveryLifecyclePhase => {
  const { status } = context.delivery;
  const isRecovery = recoveryStatuses.has(status);
  const requiresResolution =
    context.primaryIncident?.operationalState === 'REQUIRES_RESOLUTION';
  const waitingForResubmission =
    context.reservation.status === 'AWAITING_SUPPLIER_CONFIRMATION' ||
    context.reservation.status === 'AWAITING_LEARNER_CONFIRMATION';

  if (isRecovery && (requiresResolution || !context.hasExpectedRecoveryIncident)) {
    return 'RECOVERY_REQUIRED';
  }
  if (isRecovery && waitingForResubmission) return 'RECOVERY_IN_PROGRESS';
  if (status === 'WAITING_FOR_DRIVER') return 'WAITING_ASSIGNMENT';
  if (prePickupStatuses.has(status)) return 'PRE_PICKUP';
  if (inTransitStatuses.has(status)) return 'IN_TRANSIT';
  if (status === 'DELIVERED') return 'COMPLETED';
  if (status === 'CANCELLED') return 'CANCELLED';
  if (terminalFailureStatuses.has(status)) return 'TERMINAL_FAILURE';
  return 'TERMINAL_FAILURE';
};

export const determineAvailableDeliveryMutations = (
  context: Pick<AdminDeliveryClassifierContext, 'canReopenDriverAssignment'>,
): DeliveryMutation[] =>
  context.canReopenDriverAssignment ? ['REOPEN_DRIVER_ASSIGNMENT'] : [];

export const determineAvailableDeliveryLinks = (
  context: Pick<AdminDeliveryClassifierContext, 'delivery' | 'primaryIncident'>,
): DeliveryLink[] => {
  const links: DeliveryLink[] = ['OPEN_RESERVATION'];
  if (context.primaryIncident) links.unshift('OPEN_INCIDENT');
  if (context.delivery.deliveryGroupId) links.push('OPEN_GROUP');
  return links;
};

export const classifyAdminAttentionState = (input: {
  lifecyclePhase: DeliveryLifecyclePhase;
  primaryIncident: DeliveryIncidentContract | null;
  availableMutations: DeliveryMutation[];
}): AdminAttentionState => {
  const hasIncidentDecision = input.primaryIncident?.availableActions.some((action) =>
    incidentDecisionActions.has(action),
  );
  if (hasIncidentDecision || input.availableMutations.length > 0) {
    return 'ACTION_REQUIRED';
  }
  return input.lifecyclePhase === 'RECOVERY_IN_PROGRESS'
    ? 'WAITING_EXTERNAL_PARTY'
    : 'NONE';
};

export const classifyAssignmentState = (input: {
  delivery: AdminDeliveryClassifierContext['delivery'];
  lifecyclePhase: DeliveryLifecyclePhase;
  assignments: DeliveryAssignmentContract[];
}): DeliveryAssignmentState => {
  const active = input.assignments.find(
    (assignment) =>
      assignment.status === 'ACTIVE' &&
      assignment.driver?.id === input.delivery.assignedDriverProfileId,
  );
  if (
    active &&
    (input.lifecyclePhase === 'PRE_PICKUP' || input.lifecyclePhase === 'IN_TRANSIT')
  ) {
    return 'ACTIVE';
  }
  if (
    input.lifecyclePhase === 'COMPLETED' ||
    input.lifecyclePhase === 'CANCELLED' ||
    input.lifecyclePhase === 'TERMINAL_FAILURE'
  ) {
    return input.assignments.length > 0 ? 'HISTORICAL' : 'UNASSIGNED';
  }
  if (
    !active &&
    input.assignments.some((assignment) => assignment.status === 'RELEASED') &&
    (input.lifecyclePhase === 'WAITING_ASSIGNMENT' ||
      input.lifecyclePhase === 'RECOVERY_REQUIRED' ||
      input.lifecyclePhase === 'RECOVERY_IN_PROGRESS')
  ) {
    return 'RELEASED';
  }
  return input.assignments.length > 0 ? 'HISTORICAL' : 'UNASSIGNED';
};

export const classifyDeliveryKpiBucket = (input: {
  lifecyclePhase: DeliveryLifecyclePhase;
  adminAttentionState: AdminAttentionState;
}): DeliveryKpiBucket => {
  if (input.adminAttentionState === 'ACTION_REQUIRED') return 'NEEDS_ADMIN_REVIEW';
  if (input.lifecyclePhase === 'WAITING_ASSIGNMENT') return 'WAITING_FOR_DRIVER';
  if (
    input.lifecyclePhase === 'PRE_PICKUP' ||
    input.lifecyclePhase === 'IN_TRANSIT' ||
    input.lifecyclePhase === 'RECOVERY_IN_PROGRESS'
  ) {
    return 'ACTIVE_IN_PROGRESS';
  }
  if (input.lifecyclePhase === 'COMPLETED') return 'DELIVERED';
  return 'FAILED_CANCELLED';
};

export const composeAdminDeliveryContract = (
  context: AdminDeliveryClassifierContext,
) => {
  const scope = classifyDeliveryScope(context);
  const lifecyclePhase = classifyLifecyclePhase(context);
  const availableMutations = determineAvailableDeliveryMutations(context);
  const availableLinks = determineAvailableDeliveryLinks(context);
  const adminAttentionState = classifyAdminAttentionState({
    lifecyclePhase,
    primaryIncident: context.primaryIncident,
    availableMutations,
  });
  const assignmentState = classifyAssignmentState({
    delivery: context.delivery,
    lifecyclePhase,
    assignments: context.assignments,
  });

  return {
    scope,
    lifecyclePhase,
    adminAttentionState,
    assignmentState,
    kpiBucket: classifyDeliveryKpiBucket({ lifecyclePhase, adminAttentionState }),
    availableMutations,
    availableLinks,
  };
};
