import type {
  DeliveryStatus,
  NoShowReportStatus,
  ReservationFulfillmentMethod,
  ReservationStatus,
} from '../../generated/prisma/client.js';

export const ADMIN_REPORT_ACTIONS = [
  'VERIFY',
  'REJECT',
  'RESOLVE_WITHOUT_STRIKE',
  'REQUEST_SUPPLIER_RESCHEDULE',
  'CANCEL_AND_RELEASE_HOLD',
] as const;

export type AdminReportAction = (typeof ADMIN_REPORT_ACTIONS)[number];
export type AdminReportWorkflowType =
  | 'ACCOUNTABILITY'
  | 'SYSTEM_RECOVERY'
  | 'ACCOUNTABILITY_AND_RECOVERY';
export type AdminReportOperationalState =
  | 'NOT_REQUIRED'
  | 'REQUIRES_RESOLUTION'
  | 'RESOLVED';
export type AdminReportStrikeImpact = 'NONE' | 'STRIKE_IF_VERIFIED';

export type AdminReportClassifierContext = {
  report: {
    status: NoShowReportStatus;
    reasonCode: string;
    targetRole: string;
    targetUserId: string | null;
    deliveryId: string | null;
  };
  reservation: {
    status: ReservationStatus;
    fulfillmentMethod: ReservationFulfillmentMethod;
    pendingRescheduleRequestedBy?: string | null;
    pendingRescheduleReason?: string | null;
  };
  delivery: {
    id: string;
    status: DeliveryStatus;
    assignedDriverProfileId: string | null;
    deliveryGroupId?: string | null;
  } | null;
  isGroupedDelivery?: boolean;
  isGroupRecoverySupported?: boolean;
};

export type AdminReportContract = {
  workflowType: AdminReportWorkflowType;
  operationalState: AdminReportOperationalState;
  availableActions: AdminReportAction[];
  strikeImpact: AdminReportStrikeImpact;
};

const RECOVERY_REASON_CODES = new Set([
  'NO_DRIVER_AVAILABLE',
  'NO_RESPONSE_AFTER_PICKUP_WINDOW',
  'DRIVER_DID_NOT_ARRIVE',
  'PICKUP_FAILED',
]);

const RECOVERY_DELIVERY_STATUSES = new Set<DeliveryStatus>([
  'AWAITING_RESOLUTION',
  'DRIVER_NO_SHOW',
  'FAILED_PICKUP',
]);

const STRIKE_TARGET_ROLES = new Set(['LEARNER', 'SUPPLIER', 'DRIVER']);

const isPartialPickupRecovery = (context: AdminReportClassifierContext) =>
  context.reservation.pendingRescheduleReason?.startsWith(
    'DRIVER_PARTIAL_PICKUP_',
  ) === true;

const isRecoveryFamily = (context: AdminReportClassifierContext) =>
  context.report.deliveryId != null &&
  context.reservation.fulfillmentMethod === 'DELIVERY' &&
  RECOVERY_REASON_CODES.has(context.report.reasonCode);

export const classifyWorkflowType = (
  context: AdminReportClassifierContext,
): AdminReportWorkflowType => {
  if (!isRecoveryFamily(context)) {
    return 'ACCOUNTABILITY';
  }

  if (context.report.targetRole === 'SYSTEM') {
    return 'SYSTEM_RECOVERY';
  }

  return 'ACCOUNTABILITY_AND_RECOVERY';
};

export const classifyOperationalState = (
  context: AdminReportClassifierContext,
  workflowType: AdminReportWorkflowType = classifyWorkflowType(context),
): AdminReportOperationalState => {
  if (workflowType === 'ACCOUNTABILITY') {
    return 'NOT_REQUIRED';
  }

  const deliveryRequiresResolution =
    context.delivery != null &&
    RECOVERY_DELIVERY_STATUSES.has(context.delivery.status);

  if (
    context.reservation.status === 'AWAITING_RESOLUTION' &&
    (deliveryRequiresResolution || isPartialPickupRecovery(context))
  ) {
    return 'REQUIRES_RESOLUTION';
  }

  // A supplier reschedule handoff remains an active fulfillment workflow, but
  // it no longer requires an admin recovery decision.
  return 'RESOLVED';
};

export const classifyStrikeImpact = (
  context: AdminReportClassifierContext,
): AdminReportStrikeImpact =>
  context.report.targetUserId != null &&
  STRIKE_TARGET_ROLES.has(context.report.targetRole)
    ? 'STRIKE_IF_VERIFIED'
    : 'NONE';

const recoveryActions = (context: AdminReportClassifierContext): AdminReportAction[] => {
  const delivery = context.delivery;

  if (context.isGroupedDelivery && !context.isGroupRecoverySupported) {
    return [];
  }

  if (
    !isPartialPickupRecovery(context) &&
    (delivery == null || !RECOVERY_DELIVERY_STATUSES.has(delivery.status))
  ) {
    return [];
  }

  if (
    context.report.reasonCode === 'NO_DRIVER_AVAILABLE' &&
    delivery?.assignedDriverProfileId
  ) {
    return [];
  }

  return ['REQUEST_SUPPLIER_RESCHEDULE', 'CANCEL_AND_RELEASE_HOLD'];
};

export const determineAvailableActions = (
  context: AdminReportClassifierContext,
  workflowType: AdminReportWorkflowType = classifyWorkflowType(context),
  operationalState: AdminReportOperationalState = classifyOperationalState(
    context,
    workflowType,
  ),
  strikeImpact: AdminReportStrikeImpact = classifyStrikeImpact(context),
): AdminReportAction[] => {
  const isPending = context.report.status === 'PENDING_REVIEW';

  if (workflowType === 'ACCOUNTABILITY') {
    return isPending ? ['VERIFY', 'REJECT', 'RESOLVE_WITHOUT_STRIKE'] : [];
  }

  if (workflowType === 'SYSTEM_RECOVERY') {
    return isPending && operationalState === 'REQUIRES_RESOLUTION'
      ? recoveryActions(context)
      : [];
  }

  if (operationalState === 'REQUIRES_RESOLUTION') {
    if (isPending) {
      return [
        ...(strikeImpact === 'STRIKE_IF_VERIFIED' ? (['VERIFY'] as const) : []),
        ...recoveryActions(context),
      ];
    }

    return context.report.status === 'VERIFIED' ? recoveryActions(context) : [];
  }

  if (isPending) {
    return [
      ...(strikeImpact === 'STRIKE_IF_VERIFIED' ? (['VERIFY'] as const) : []),
      ...(context.report.targetUserId != null ? (['REJECT'] as const) : []),
      'RESOLVE_WITHOUT_STRIKE',
    ];
  }

  return [];
};

export const classifyAdminReportContract = (
  context: AdminReportClassifierContext,
): AdminReportContract => {
  const workflowType = classifyWorkflowType(context);
  const operationalState = classifyOperationalState(context, workflowType);
  const strikeImpact = classifyStrikeImpact(context);

  return {
    workflowType,
    operationalState,
    strikeImpact,
    availableActions: determineAvailableActions(
      context,
      workflowType,
      operationalState,
      strikeImpact,
    ),
  };
};
