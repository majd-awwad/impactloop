import {
  classifySupplierScheduleEntry,
  type SupplierScheduleClassification,
  type SupplierScheduleSource,
} from './supplier-reservations-schedule.classifier.js';
import {
  forEachSupplierScheduleReservationBatch,
} from './supplier-reservations-schedule.repository.js';
import type { ListSupplierScheduleQuery } from './supplier-reservations-schedule.validation.js';
import {
  mapSupplierReservation,
  runSupplierReservationLazyCleanup,
} from './supplier-reservations.service.js';
import type { SupplierReservationListRecord } from './supplier-reservations.repository.js';

const MAX_GROUP_RESERVATION_IDS = 50;

type MappedSupplierReservation = ReturnType<typeof mapSupplierReservation>;

type ScheduleMember = {
  raw: SupplierReservationListRecord;
  mapped: MappedSupplierReservation;
  source: SupplierScheduleSource;
};

type ProjectedScheduleEntry = {
  id: string;
  representative: ScheduleMember;
  members: ScheduleMember[];
  classification: SupplierScheduleClassification;
};

const toIso = (value: Date | null | undefined) => value?.toISOString() ?? null;

const toScheduleSource = (
  raw: SupplierReservationListRecord,
  mapped: MappedSupplierReservation,
): SupplierScheduleSource => ({
  id: mapped.id,
  status: mapped.status,
  fulfillmentMethod: mapped.fulfillmentMethod,
  quantityRequested: mapped.quantityRequested,
  unit: mapped.unit,
  material: {
    id: mapped.material.id,
    title: mapped.material.title,
    imageUrl: mapped.material.imageUrl ?? null,
  },
  learner: {
    id: mapped.learner.id,
    displayName: mapped.learner.displayName,
  },
  scheduleSummary: {
    activeWindowType: mapped.scheduleSummary.activeWindowType,
    effectiveWindowStart: mapped.scheduleSummary.effectiveWindowStart,
    effectiveWindowEnd: mapped.scheduleSummary.effectiveWindowEnd,
  },
  deliverySummary: mapped.deliverySummary
    ? {
        deliveryId: mapped.deliverySummary.deliveryId,
        status: mapped.deliverySummary.status,
        pickedUpAt: mapped.deliverySummary.pickedUpAt,
        deliveredAt: mapped.deliverySummary.deliveredAt,
        recoveryRequired: mapped.deliverySummary.recoveryRequired,
      }
    : null,
  groupSummary: mapped.groupSummary
    ? {
        groupId: mapped.groupSummary.groupId,
        status: mapped.groupSummary.status,
        itemCount: mapped.groupSummary.itemCount,
        grouped: mapped.groupSummary.grouped,
      }
    : null,
  incidentSummary: mapped.incidentSummary
    ? {
        id: mapped.incidentSummary.id,
        status: mapped.incidentSummary.status,
        targetRole: mapped.incidentSummary.targetRole,
        reasonCode: mapped.incidentSummary.reasonCode,
      }
    : null,
  workflowPhase: mapped.workflowPhase,
  attentionState: mapped.attentionState,
  nextActor: mapped.nextActor,
  availableActions: [...mapped.availableActions],
  completedAt: mapped.completedAt,
  createdAt: raw.createdAt.toISOString(),
  updatedAt: raw.updatedAt.toISOString(),
  acceptedAt: toIso(raw.acceptedAt),
  rejectedAt: toIso(raw.rejectedAt),
  cancelledAt: toIso(raw.cancelledAt),
});

const parseDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const inRange = (value: string | null, start: Date, end: Date) => {
  const parsed = parseDate(value);
  return parsed != null && parsed >= start && parsed < end;
};

const overlapsRange = (
  window: { start: string; end: string } | null,
  start: Date,
  end: Date,
) => {
  const windowStart = parseDate(window?.start ?? null);
  const windowEnd = parseDate(window?.end ?? null);
  return (
    windowStart != null &&
    windowEnd != null &&
    windowStart < end &&
    windowEnd > start
  );
};

const includeInFilteredUniverse = (input: {
  projected: ProjectedScheduleEntry;
  query: ListSupplierScheduleQuery;
}) => {
  const { projected, query } = input;
  const { classification, representative } = projected;

  if (
    query.category != null &&
    classification.category !== query.category
  ) {
    return false;
  }
  if (
    query.needsAttention != null &&
    classification.needsAttention !== query.needsAttention
  ) {
    return false;
  }

  const rangeStart = parseDate(query.rangeStart ?? null);
  const rangeEnd = parseDate(query.rangeEnd ?? null);
  if (rangeStart && rangeEnd) {
    const isHistory =
      classification.category === 'COMPLETED' ||
      classification.category === 'CLOSED';
    if (isHistory) {
      if (!inRange(classification.historyTimestamp, rangeStart, rangeEnd)) {
        return false;
      }
    } else if (
      !overlapsRange(classification.effectiveWindow, rangeStart, rangeEnd)
    ) {
      if (
        classification.effectiveWindow == null &&
        query.category !== 'UNSCHEDULED_ACTION' &&
        query.category !== 'ADMIN_REVIEW' &&
        query.needsAttention !== true
      ) {
        return false;
      }
    }
  }

  if (
    classification.effectiveWindow == null &&
    query.category !== 'UNSCHEDULED_ACTION' &&
    query.category !== 'ADMIN_REVIEW' &&
    query.needsAttention !== true
  ) {
    return false;
  }

  // The representative source is deliberately referenced here so future
  // filters cannot accidentally use createdAt as a schedule timestamp.
  void representative.source.createdAt;
  return true;
};

const categoryOrder = new Map<string, number>([
  ['UNSCHEDULED_ACTION', 0],
  ['ADMIN_REVIEW', 1],
  ['OVERDUE', 2],
  ['IN_PROGRESS', 3],
  ['TODAY', 4],
  ['UPCOMING', 5],
  ['COMPLETED', 6],
  ['CLOSED', 7],
]);

const sortProjectedEntries = (entries: ProjectedScheduleEntry[]) => {
  entries.sort((left, right) => {
    const categoryCompare =
      (categoryOrder.get(left.classification.category) ?? 99) -
      (categoryOrder.get(right.classification.category) ?? 99);
    if (categoryCompare !== 0) return categoryCompare;

    const leftHistory = left.classification.category === 'COMPLETED' ||
      left.classification.category === 'CLOSED';
    if (leftHistory) {
      const leftTime = parseDate(left.classification.historyTimestamp)?.getTime() ?? 0;
      const rightTime = parseDate(right.classification.historyTimestamp)?.getTime() ?? 0;
      if (leftTime !== rightTime) return rightTime - leftTime;
    } else {
      const leftTime = parseDate(left.classification.effectiveWindow?.start ?? null)?.getTime() ?? 0;
      const rightTime = parseDate(right.classification.effectiveWindow?.start ?? null)?.getTime() ?? 0;
      if (leftTime !== rightTime) return leftTime - rightTime;
    }

    return left.id.localeCompare(right.id);
  });
};

const buildScheduleEntry = (projected: ProjectedScheduleEntry) => {
  const { representative, members, classification } = projected;
  const { mapped, raw, source } = representative;
  const groupSummary = source.groupSummary;
  const isGrouped = groupSummary?.grouped === true;
  const reservationIds = members
    .map((member) => member.raw.id)
    .slice(0, MAX_GROUP_RESERVATION_IDS);
  const itemCount = Math.max(
    groupSummary?.itemCount ?? 0,
    members.length,
  );

  return {
    id: projected.id,
    type: classification.entryType,
    category: classification.category,
    needsAttention: classification.needsAttention,
    representativeReservationId: raw.id,
    reservationIds,
    group: groupSummary
      ? {
          groupId: groupSummary.groupId,
          grouped: isGrouped,
          itemCount,
          status: groupSummary.status,
          hasMoreItems: itemCount > reservationIds.length,
        }
      : null,
    material: {
      id: mapped.material.id,
      title: mapped.material.title,
      imageUrl: mapped.material.imageUrl,
    },
    learner: {
      id: mapped.learner.id,
      displayName: mapped.learner.displayName,
    },
    quantity: {
      value: mapped.quantityRequested,
      unit: mapped.unit,
    },
    fulfillmentMethod:
      source.fulfillmentMethod === 'DELIVERY' ? 'DELIVERY' : 'SELF_PICKUP',
    effectiveWindow: classification.effectiveWindow,
    scheduledDate: classification.effectiveWindow?.start ?? null,
    workflowPhase: mapped.workflowPhase,
    attentionState: mapped.attentionState,
    nextActor: mapped.nextActor,
    reservationStatus: mapped.status,
    availableActions: isGrouped ? [] : mapped.availableActions,
    delivery: mapped.deliverySummary,
    incident: mapped.incidentSummary,
    historyTimestamp: classification.historyTimestamp,
    historyTimestampSource: classification.historyTimestampSource,
    projectionInconsistent: classification.projectionInconsistent,
  };
};

export const listSupplierSchedulePage = async (
  ownerId: string,
  query: ListSupplierScheduleQuery,
) => {
  await runSupplierReservationLazyCleanup(ownerId);

  const now = new Date();
  const dayStart = new Date(query.dayStart ?? now.toISOString());
  const dayEnd = new Date(query.dayEnd ?? new Date(now.getTime() + 86_400_000).toISOString());
  const groups = new Map<string, ScheduleMember[]>();

  await forEachSupplierScheduleReservationBatch({
    ownerId,
    query,
    onBatch: (records) => {
      for (const raw of records) {
        const mapped = mapSupplierReservation(raw, null);
        const source = toScheduleSource(raw, mapped);
        const key =
          source.groupSummary?.grouped === true
            ? `group:${source.groupSummary.groupId}`
            : `reservation:${raw.id}`;
        const member = { raw, mapped, source };
        groups.set(key, [...(groups.get(key) ?? []), member]);
      }
    },
  });

  const projected: ProjectedScheduleEntry[] = [];
  for (const [key, members] of groups) {
    const representative = members[0];
    const source = representative.source;
    const classifierSource =
      source.groupSummary?.grouped === true
        ? { ...source, availableActions: [] }
        : source;
    const classification = classifySupplierScheduleEntry({
      representative: classifierSource,
      members: members.map((member) => member.source),
      now,
      dayStart,
      dayEnd,
    });
    if (!classification) continue;

    const item = {
      ...representative,
      source: classifierSource,
    };
    const candidate = {
      id: key,
      representative: item,
      members,
      classification,
    };
    if (includeInFilteredUniverse({ projected: candidate, query })) {
      projected.push(candidate);
    }
  }

  sortProjectedEntries(projected);

  const summary = {
    total: projected.length,
    unscheduledAction: projected.filter(
      (item) => item.classification.category === 'UNSCHEDULED_ACTION',
    ).length,
    adminReview: projected.filter(
      (item) => item.classification.category === 'ADMIN_REVIEW',
    ).length,
    overdue: projected.filter(
      (item) => item.classification.category === 'OVERDUE',
    ).length,
    inProgress: projected.filter(
      (item) => item.classification.category === 'IN_PROGRESS',
    ).length,
    today: projected.filter((item) => item.classification.category === 'TODAY')
      .length,
    upcoming: projected.filter(
      (item) => item.classification.category === 'UPCOMING',
    ).length,
    completed: projected.filter(
      (item) => item.classification.category === 'COMPLETED',
    ).length,
    closed: projected.filter((item) => item.classification.category === 'CLOSED')
      .length,
    needsAttention: projected.filter(
      (item) => item.classification.needsAttention,
    ).length,
  };

  const offset = (query.page - 1) * query.limit;
  const pageItems = projected
    .slice(offset, offset + query.limit)
    .map(buildScheduleEntry);

  return {
    items: pageItems,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: summary.total,
      totalPages: Math.ceil(summary.total / query.limit),
    },
    summary,
  };
};
