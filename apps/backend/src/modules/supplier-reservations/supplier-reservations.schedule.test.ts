import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifySupplierScheduleEntry,
  selectCanonicalSupplierWindow,
  type SupplierScheduleSource,
} from './supplier-reservations-schedule.classifier.js';
import {
  listSupplierScheduleQuerySchema,
} from './supplier-reservations-schedule.validation.js';

const now = new Date('2026-07-15T10:00:00.000Z');
const dayStart = new Date('2026-07-15T00:00:00.000Z');
const dayEnd = new Date('2026-07-16T00:00:00.000Z');

const source = (
  overrides: Partial<SupplierScheduleSource> = {},
): SupplierScheduleSource => ({
  id: 'reservation-1',
  status: 'ACCEPTED',
  fulfillmentMethod: 'PICKUP',
  quantityRequested: 2,
  unit: 'pieces',
  material: { id: 'material-1', title: 'Wood', imageUrl: null },
  learner: { id: 'learner-1', displayName: 'Lina' },
  scheduleSummary: {
    activeWindowType: 'CONFIRMED_PICKUP',
    effectiveWindowStart: '2026-07-15T10:00:00.000Z',
    effectiveWindowEnd: '2026-07-15T12:00:00.000Z',
  },
  deliverySummary: null,
  groupSummary: null,
  incidentSummary: null,
  workflowPhase: 'SELF_PICKUP',
  attentionState: 'FULFILLMENT_IN_PROGRESS',
  nextActor: 'LEARNER',
  availableActions: [],
  completedAt: null,
  createdAt: '2026-07-01T08:00:00.000Z',
  updatedAt: '2026-07-15T08:00:00.000Z',
  acceptedAt: '2026-07-01T08:01:00.000Z',
  rejectedAt: null,
  cancelledAt: null,
  ...overrides,
});

const classify = (
  representative: SupplierScheduleSource,
  members = [representative],
  at = now,
) =>
  classifySupplierScheduleEntry({
    representative,
    members,
    now: at,
    dayStart,
    dayEnd,
  });

test('confirmed self pickup today', () => {
  const result = classify(source(), [source()], new Date('2026-07-15T08:00:00.000Z'))!;
  assert.equal(result.category, 'TODAY');
  assert.equal(result.entryType, 'SELF_PICKUP');
});

test('confirmed self pickup upcoming', () => {
  const item = source({
    scheduleSummary: {
      activeWindowType: 'CONFIRMED_PICKUP',
      effectiveWindowStart: '2026-07-17T10:00:00.000Z',
      effectiveWindowEnd: '2026-07-17T12:00:00.000Z',
    },
  });
  assert.equal(classify(item)?.category, 'UPCOMING');
});

test('self pickup is overdue only after the existing grace period', () => {
  const item = source({
    scheduleSummary: {
      activeWindowType: 'CONFIRMED_PICKUP',
      effectiveWindowStart: '2026-07-15T07:00:00.000Z',
      effectiveWindowEnd: '2026-07-15T08:00:00.000Z',
    },
  });
  assert.equal(classify(item)?.category, 'OVERDUE');
  assert.equal(
    classify(item, [item], new Date('2026-07-15T08:29:59.999Z'))?.category,
    'IN_PROGRESS',
  );
});

test('self pickup inside the allowed handover interval is in progress', () => {
  assert.equal(classify(source())?.category, 'IN_PROGRESS');
});

test('delivery waiting for a driver remains a scheduled entry', () => {
  const item = source({
    fulfillmentMethod: 'DELIVERY',
    workflowPhase: 'DELIVERY',
    attentionState: 'FULFILLMENT_IN_PROGRESS',
    nextActor: 'DRIVER',
    scheduleSummary: {
      activeWindowType: 'SUPPLIER_DELIVERY_PICKUP',
      effectiveWindowStart: '2026-07-15T11:00:00.000Z',
      effectiveWindowEnd: '2026-07-15T12:00:00.000Z',
    },
    deliverySummary: {
      deliveryId: 'delivery-1',
      status: 'WAITING_FOR_DRIVER',
      pickedUpAt: null,
      deliveredAt: null,
      recoveryRequired: false,
    },
  });
  assert.equal(classify(item)?.entryType, 'DRIVER_PICKUP');
  assert.equal(classify(item)?.category, 'TODAY');
});

test('assigned and on-the-way delivery phases are in progress', () => {
  const item = source({
    fulfillmentMethod: 'DELIVERY',
    workflowPhase: 'DELIVERY',
    nextActor: 'DRIVER',
    scheduleSummary: {
      activeWindowType: 'SUPPLIER_DELIVERY_PICKUP',
      effectiveWindowStart: '2026-07-15T11:00:00.000Z',
      effectiveWindowEnd: '2026-07-15T12:00:00.000Z',
    },
    deliverySummary: {
      deliveryId: 'delivery-1',
      status: 'DRIVER_ASSIGNED',
      pickedUpAt: null,
      deliveredAt: null,
      recoveryRequired: false,
    },
  });
  assert.equal(classify(item)?.category, 'IN_PROGRESS');
});

test('delivery canonical window is supplier pickup, never learner dropoff', () => {
  const item = source({
    fulfillmentMethod: 'DELIVERY',
    scheduleSummary: {
      activeWindowType: 'SUPPLIER_DELIVERY_PICKUP',
      effectiveWindowStart: '2026-07-15T11:00:00.000Z',
      effectiveWindowEnd: '2026-07-15T12:00:00.000Z',
    },
  });
  assert.equal(selectCanonicalSupplierWindow(item)?.type, 'SUPPLIER_DELIVERY_PICKUP');
  assert.equal(
    selectCanonicalSupplierWindow({
      ...item,
      scheduleSummary: {
        activeWindowType: 'CONFIRMED_DELIVERY_DROPOFF',
        effectiveWindowStart: '2026-07-15T13:00:00.000Z',
        effectiveWindowEnd: '2026-07-15T14:00:00.000Z',
      },
    }),
    null,
  );
});

test('learner proposal without confirmed window is excluded', () => {
  const item = source({
    status: 'AWAITING_LEARNER_CONFIRMATION',
    attentionState: 'WAITING_FOR_LEARNER',
    availableActions: [],
    scheduleSummary: {
      activeWindowType: null,
      effectiveWindowStart: null,
      effectiveWindowEnd: null,
    },
  });
  assert.equal(classify(item), null);
});

test('supplier reschedule action without window is unscheduled action', () => {
  const item = source({
    attentionState: 'SUPPLIER_ACTION_REQUIRED',
    availableActions: ['PROPOSE_RESCHEDULE'],
    scheduleSummary: {
      activeWindowType: null,
      effectiveWindowStart: null,
      effectiveWindowEnd: null,
    },
  });
  assert.equal(classify(item)?.category, 'UNSCHEDULED_ACTION');
});

test('admin recovery with supplier action is supplier unscheduled action', () => {
  const item = source({
    status: 'AWAITING_RESOLUTION',
    workflowPhase: 'RECOVERY',
    attentionState: 'SUPPLIER_ACTION_REQUIRED',
    nextActor: 'SUPPLIER',
    availableActions: ['SUBMIT_RECOVERY_PICKUP_WINDOW'],
    scheduleSummary: {
      activeWindowType: null,
      effectiveWindowStart: null,
      effectiveWindowEnd: null,
    },
  });
  assert.equal(classify(item)?.category, 'UNSCHEDULED_ACTION');
});

test('admin recovery without supplier action is admin review', () => {
  const item = source({
    status: 'AWAITING_RESOLUTION',
    workflowPhase: 'RECOVERY',
    attentionState: 'ADMIN_REVIEW_REQUIRED',
    nextActor: 'ADMIN',
    scheduleSummary: {
      activeWindowType: null,
      effectiveWindowStart: null,
      effectiveWindowEnd: null,
    },
  });
  assert.equal(classify(item)?.category, 'ADMIN_REVIEW');
  assert.equal(classify(item)?.needsAttention, true);
});

test('completed self pickup uses completedAt', () => {
  const item = source({
    status: 'COMPLETED',
    workflowPhase: 'COMPLETED',
    completedAt: '2026-07-15T13:00:00.000Z',
  });
  const result = classify(item)!;
  assert.equal(result.category, 'COMPLETED');
  assert.equal(result.historyTimestamp, item.completedAt);
  assert.equal(result.historyTimestampSource, 'COMPLETED_AT');
});

test('completed delivery uses supplier picked-up timestamp', () => {
  const item = source({
    status: 'COMPLETED',
    fulfillmentMethod: 'DELIVERY',
    workflowPhase: 'COMPLETED',
    deliverySummary: {
      deliveryId: 'delivery-1',
      status: 'DELIVERED',
      pickedUpAt: '2026-07-15T13:00:00.000Z',
      deliveredAt: '2026-07-15T15:00:00.000Z',
      recoveryRequired: false,
    },
  });
  const result = classify(item)!;
  assert.equal(result.historyTimestamp, '2026-07-15T13:00:00.000Z');
  assert.equal(result.historyTimestampSource, 'SUPPLIER_PICKED_UP_AT');
});

test('terminal unsuccessful statuses remain distinct closed history', () => {
  for (const status of [
    'CANCELLED',
    'EXPIRED',
    'NO_SHOW',
    'FULFILLMENT_FAILED',
    'REJECTED',
  ]) {
    assert.equal(classify(source({ status }))?.category, 'CLOSED');
  }
});

test('grouped delivery is one grouped entry and inconsistent windows fail closed', () => {
  const first = source({
    fulfillmentMethod: 'DELIVERY',
    attentionState: 'SUPPLIER_ACTION_REQUIRED',
    groupSummary: {
      groupId: 'group-1',
      status: 'ASSIGNED',
      itemCount: 2,
      grouped: true,
    },
    scheduleSummary: {
      activeWindowType: 'SUPPLIER_DELIVERY_PICKUP',
      effectiveWindowStart: '2026-07-15T11:00:00.000Z',
      effectiveWindowEnd: '2026-07-15T12:00:00.000Z',
    },
  });
  const second = source({
    id: 'reservation-2',
    fulfillmentMethod: 'DELIVERY',
    groupSummary: first.groupSummary,
    scheduleSummary: first.scheduleSummary,
  });
  assert.equal(classify(first, [first, second])?.entryType, 'GROUPED_DRIVER_PICKUP');

  const inconsistent = source({
    attentionState: 'SUPPLIER_ACTION_REQUIRED',
    groupSummary: first.groupSummary,
    scheduleSummary: {
      activeWindowType: 'SUPPLIER_DELIVERY_PICKUP',
      effectiveWindowStart: '2026-07-15T12:00:00.000Z',
      effectiveWindowEnd: '2026-07-15T13:00:00.000Z',
    },
  });
  assert.equal(
    classify(first, [first, inconsistent])?.projectionInconsistent,
    true,
  );
  assert.equal(
    classify(first, [first, inconsistent])?.effectiveWindow,
    null,
  );
});

test('needsAttention is orthogonal to category', () => {
  const item = source({
    availableActions: ['REPORT_DRIVER_NO_SHOW'],
  });
  const result = classify(item)!;
  assert.equal(result.category, 'IN_PROGRESS');
  assert.equal(result.needsAttention, true);
});

test('UTC day boundaries classify an absolute instant without offsets', () => {
  const item = source({
    scheduleSummary: {
      activeWindowType: 'CONFIRMED_PICKUP',
      effectiveWindowStart: '2026-07-16T00:00:00.000Z',
      effectiveWindowEnd: '2026-07-16T01:00:00.000Z',
    },
  });
  assert.equal(
    classify(item, [item], new Date('2026-07-15T23:00:00.000Z'))?.category,
    'UPCOMING',
  );
});

test('schedule query validation requires bounded absolute day boundaries', () => {
  assert.equal(
    listSupplierScheduleQuerySchema.safeParse({
      scope: 'ACTIVE',
      dayStart: '2026-07-15T00:00:00.000Z',
      dayEnd: '2026-07-16T00:00:00.000Z',
      needsAttention: 'false',
      search: 'wood',
      fulfillmentMethod: 'PICKUP',
    }).success,
    true,
  );
  assert.equal(
    listSupplierScheduleQuerySchema.safeParse({ scope: 'ACTIVE' }).success,
    false,
  );
  assert.equal(
    listSupplierScheduleQuerySchema.safeParse({
      scope: 'HISTORY',
      rangeStart: '2026-07-01T00:00:00.000Z',
      rangeEnd: '2026-08-15T00:00:00.000Z',
    }).success,
    false,
  );
});
