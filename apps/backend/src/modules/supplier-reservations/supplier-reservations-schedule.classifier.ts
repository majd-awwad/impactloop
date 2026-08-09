import type {
  DeliveryGroupStatus,
  DeliveryStatus,
  NoShowReportStatus,
  ReservationFulfillmentMethod,
  ReservationStatus,
} from '../../generated/prisma/client.js';

import {
  isAfterAllowedEnd,
  isWithinAllowedHandoverRange,
} from '../../utils/handover-timing.js';

export const SUPPLIER_SCHEDULE_ENTRY_TYPES = [
  'SELF_PICKUP',
  'DRIVER_PICKUP',
  'GROUPED_DRIVER_PICKUP',
  'SUPPLIER_ACTION',
  'RECOVERY',
  'COMPLETED_HANDOVER',
  'CLOSED_HISTORY',
  'UNKNOWN',
] as const;

export const SUPPLIER_SCHEDULE_CATEGORIES = [
  'UNSCHEDULED_ACTION',
  'ADMIN_REVIEW',
  'OVERDUE',
  'IN_PROGRESS',
  'TODAY',
  'UPCOMING',
  'COMPLETED',
  'CLOSED',
] as const;

export type SupplierScheduleEntryType =
  (typeof SUPPLIER_SCHEDULE_ENTRY_TYPES)[number];
export type SupplierScheduleCategory =
  (typeof SUPPLIER_SCHEDULE_CATEGORIES)[number];

export type SupplierScheduleSource = {
  id: string;
  status: ReservationStatus;
  fulfillmentMethod: ReservationFulfillmentMethod;
  quantityRequested: number;
  unit: string;
  material: {
    id: string;
    title: string;
    imageUrl: string | null;
  };
  learner: {
    id: string;
    displayName: string;
  };
  scheduleSummary: {
    activeWindowType: string | null;
    effectiveWindowStart: string | null;
    effectiveWindowEnd: string | null;
  };
  deliverySummary: {
    deliveryId: string;
    status: DeliveryStatus;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    recoveryRequired: boolean;
  } | null;
  groupSummary: {
    groupId: string;
    status: DeliveryGroupStatus;
    itemCount: number;
    grouped: boolean;
  } | null;
  incidentSummary: {
    id: string;
    status: NoShowReportStatus;
    targetRole: string;
    reasonCode: string;
  } | null;
  workflowPhase: string;
  attentionState: string;
  nextActor: string;
  availableActions: string[];
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
};

export type SupplierScheduleEffectiveWindow = {
  start: string;
  end: string;
  type: 'CONFIRMED_PICKUP' | 'SUPPLIER_DELIVERY_PICKUP';
};

export type SupplierScheduleClassification = {
  entryType: SupplierScheduleEntryType;
  category: SupplierScheduleCategory;
  needsAttention: boolean;
  effectiveWindow: SupplierScheduleEffectiveWindow | null;
  historyTimestamp: string | null;
  historyTimestampSource:
    | 'COMPLETED_AT'
    | 'SUPPLIER_PICKED_UP_AT'
    | 'CANCELLED_AT'
    | 'REJECTED_AT'
    | 'UPDATED_AT_FALLBACK'
    | null;
  projectionInconsistent: boolean;
  urgencyTimestamp: string;
};

export type SupplierScheduleClassifierInput = {
  representative: SupplierScheduleSource;
  members: SupplierScheduleSource[];
  now: Date;
  dayStart: Date;
  dayEnd: Date;
};

const CLOSED_STATUSES = new Set<ReservationStatus>([
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
]);

const ACTIVE_DRIVER_STATUSES = new Set<DeliveryStatus>([
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
]);

const SCHEDULE_ACTIONS = new Set([
  'ACCEPT_LEARNER_RESCHEDULE',
  'SUBMIT_RECOVERY_PICKUP_WINDOW',
  'PROPOSE_RESCHEDULE',
  'REPORT_NO_DRIVER',
  'REPORT_DRIVER_NO_SHOW',
  'MARK_DELIVERY_PICKUP_EXPIRED',
  'MARK_LEARNER_NO_SHOW',
  'REPORT_INCIDENT',
  'CLOSE_RESERVATION',
]);

const SUPPLIER_RECOVERY_ACTIONS = new Set([
  'ACCEPT_LEARNER_RESCHEDULE',
  'SUBMIT_RECOVERY_PICKUP_WINDOW',
  'PROPOSE_RESCHEDULE',
  'REPORT_NO_DRIVER',
  'REPORT_DRIVER_NO_SHOW',
  'MARK_DELIVERY_PICKUP_EXPIRED',
  'MARK_LEARNER_NO_SHOW',
  'REPORT_INCIDENT',
  'CLOSE_RESERVATION',
]);

const parseDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const sameWindow = (
  left: SupplierScheduleEffectiveWindow | null,
  right: SupplierScheduleEffectiveWindow | null,
) =>
  left?.type === right?.type &&
  left?.start === right?.start &&
  left?.end === right?.end;

export const selectCanonicalSupplierWindow = (
  source: SupplierScheduleSource,
): SupplierScheduleEffectiveWindow | null => {
  const isDelivery = source.fulfillmentMethod === 'DELIVERY';
  const expectedType = isDelivery
    ? 'SUPPLIER_DELIVERY_PICKUP'
    : 'CONFIRMED_PICKUP';
  const start = source.scheduleSummary.effectiveWindowStart;
  const end = source.scheduleSummary.effectiveWindowEnd;
  const parsedStart = parseDate(start);
  const parsedEnd = parseDate(end);

  if (
    source.scheduleSummary.activeWindowType !== expectedType ||
    !start ||
    !end ||
    !parsedStart ||
    !parsedEnd ||
    parsedEnd <= parsedStart
  ) {
    return null;
  }

  return {
    start,
    end,
    type: expectedType,
  };
};

const historyTimestampFor = (
  source: SupplierScheduleSource,
): Pick<
  SupplierScheduleClassification,
  'historyTimestamp' | 'historyTimestampSource'
> => {
  if (source.status === 'COMPLETED') {
    if (source.fulfillmentMethod === 'DELIVERY') {
      return source.deliverySummary?.pickedUpAt
        ? {
            historyTimestamp: source.deliverySummary.pickedUpAt,
            historyTimestampSource: 'SUPPLIER_PICKED_UP_AT',
          }
        : {
            historyTimestamp: source.completedAt,
            historyTimestampSource: source.completedAt ? 'COMPLETED_AT' : null,
          };
    }
    return {
      historyTimestamp: source.completedAt,
      historyTimestampSource: source.completedAt ? 'COMPLETED_AT' : null,
    };
  }

  if (source.status === 'CANCELLED' && source.cancelledAt) {
    return {
      historyTimestamp: source.cancelledAt,
      historyTimestampSource: 'CANCELLED_AT',
    };
  }
  if (source.status === 'REJECTED' && source.rejectedAt) {
    return {
      historyTimestamp: source.rejectedAt,
      historyTimestampSource: 'REJECTED_AT',
    };
  }

  return {
    historyTimestamp: source.updatedAt,
    historyTimestampSource: 'UPDATED_AT_FALLBACK',
  };
};

const hasScheduleAction = (source: SupplierScheduleSource) =>
  source.availableActions.some((action) => SCHEDULE_ACTIONS.has(action));

const hasSupplierRecoveryAction = (source: SupplierScheduleSource) =>
  source.availableActions.some((action) =>
    SUPPLIER_RECOVERY_ACTIONS.has(action),
  );

const categoryForScheduledEntry = (input: {
  source: SupplierScheduleSource;
  window: SupplierScheduleEffectiveWindow;
  now: Date;
  dayStart: Date;
  dayEnd: Date;
}): SupplierScheduleCategory => {
  const { source, window, now, dayStart, dayEnd } = input;
  const start = parseDate(window.start)!;
  const end = parseDate(window.end)!;
  const deliveryStatus = source.deliverySummary?.status ?? null;

  if (isAfterAllowedEnd(now, end)) return 'OVERDUE';

  const inProgress = source.fulfillmentMethod === 'DELIVERY'
    ? deliveryStatus != null && ACTIVE_DRIVER_STATUSES.has(deliveryStatus)
    : isWithinAllowedHandoverRange(now, start, end);
  if (inProgress) return 'IN_PROGRESS';
  if (start >= dayEnd) return 'UPCOMING';
  if (start >= dayStart && start < dayEnd) return 'TODAY';

  // A selected day is a classification frame, not a reason to manufacture a
  // new state. A valid active window before dayEnd remains in TODAY when it
  // is not overdue or in progress.
  return 'TODAY';
};

export const classifySupplierScheduleEntry = (
  input: SupplierScheduleClassifierInput,
): SupplierScheduleClassification | null => {
  const { representative, members, now, dayStart, dayEnd } = input;
  const status = representative.status;
  const supplierActionRequired =
    representative.attentionState === 'SUPPLIER_ACTION_REQUIRED';
  const hasAction = hasScheduleAction(representative);
  const supplierRecoveryAction = hasSupplierRecoveryAction(representative);
  const history = historyTimestampFor(representative);
  const windows = members.map(selectCanonicalSupplierWindow);
  const window = windows[0] ?? null;
  const projectionInconsistent = windows.some(
    (candidate) => !sameWindow(window, candidate),
  );
  const effectiveWindow = projectionInconsistent ? null : window;
  const isDelivery = representative.fulfillmentMethod === 'DELIVERY';
  const isGrouped = representative.groupSummary?.grouped === true;
  const recovery =
    representative.workflowPhase === 'RECOVERY' ||
    representative.status === 'AWAITING_RESOLUTION' ||
    representative.deliverySummary?.recoveryRequired === true;

  if (status === 'COMPLETED') {
    return {
      entryType: 'COMPLETED_HANDOVER',
      category: 'COMPLETED',
      needsAttention: false,
      effectiveWindow,
      ...history,
      projectionInconsistent,
      urgencyTimestamp: history.historyTimestamp ?? representative.updatedAt,
    };
  }

  if (CLOSED_STATUSES.has(status)) {
    return {
      entryType: 'CLOSED_HISTORY',
      category: 'CLOSED',
      needsAttention: false,
      effectiveWindow,
      ...history,
      projectionInconsistent,
      urgencyTimestamp: history.historyTimestamp ?? representative.updatedAt,
    };
  }

  const adminReview =
    (status === 'AWAITING_RESOLUTION' ||
      representative.nextActor === 'ADMIN' ||
      representative.incidentSummary?.status === 'PENDING_REVIEW') &&
    !supplierRecoveryAction;

  if (adminReview) {
    return {
      entryType: 'RECOVERY',
      category: 'ADMIN_REVIEW',
      needsAttention: true,
      effectiveWindow: null,
      ...history,
      projectionInconsistent,
      urgencyTimestamp: representative.updatedAt,
    };
  }

  const unscheduledAction =
    !effectiveWindow &&
    (hasAction && (supplierActionRequired || supplierRecoveryAction) ||
      (projectionInconsistent && supplierActionRequired));

  if (unscheduledAction) {
    return {
      entryType: recovery ? 'RECOVERY' : 'SUPPLIER_ACTION',
      category: 'UNSCHEDULED_ACTION',
      needsAttention: true,
      effectiveWindow: null,
      ...history,
      projectionInconsistent,
      urgencyTimestamp: representative.updatedAt,
    };
  }

  // Ordinary pending decisions and learner-confirmation proposals are owned
  // by Incoming Requests, not the Supplier Pickup Schedule.
  if (!effectiveWindow || status !== 'ACCEPTED' || projectionInconsistent) {
    return null;
  }

  const category = categoryForScheduledEntry({
    source: representative,
    window: effectiveWindow,
    now,
    dayStart,
    dayEnd,
  });
  const needsAttention =
    supplierActionRequired || hasAction || category === 'OVERDUE';

  return {
    entryType: isDelivery
      ? isGrouped
        ? 'GROUPED_DRIVER_PICKUP'
        : 'DRIVER_PICKUP'
      : 'SELF_PICKUP',
    category,
    needsAttention,
    effectiveWindow,
    historyTimestamp: null,
    historyTimestampSource: null,
    projectionInconsistent: false,
    urgencyTimestamp: effectiveWindow.start,
  };
};
