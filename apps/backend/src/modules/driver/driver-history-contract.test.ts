import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyDriverAssignmentOutcome,
  driverHistoricalWhere,
  driverHistoryDetailSelect,
  driverHistoryListSelect,
  driverIncidentOutcome,
  getDriverHistoricalDelivery,
  listDriverIncidents,
  mapHistoricalDeliveryDetail,
} from './driver-history.service.js';

const now = new Date('2026-08-02T10:00:00.000Z');
const earlier = new Date('2026-08-02T08:00:00.000Z');
const later = new Date('2026-08-02T09:00:00.000Z');

test('historical ownership requires assignment evidence and excludes only current active ownership', () => {
  assert.deepEqual(driverHistoricalWhere('driver-1'), {
    assignments: { some: { driverProfileId: 'driver-1' } },
    NOT: {
      assignedDriverProfileId: 'driver-1',
      status: {
        in: [
          'DRIVER_ASSIGNED',
          'ARRIVED_PICKUP',
          'PICKED_UP',
          'ON_THE_WAY',
          'ARRIVED_DROPOFF',
        ],
      },
    },
  });
});

test('unrelated Driver receives 404 for historical detail', async () => {
  const database = {
    driverProfile: { findUnique: async () => ({ id: 'driver-1', status: 'ACTIVE' }) },
    delivery: { findFirst: async () => null },
    noShowReport: { findMany: async () => [] },
  } as never;
  await assert.rejects(
    getDriverHistoricalDelivery('user-1', 'delivery-1', database),
    (error: unknown) =>
      typeof error === 'object' &&
      error != null &&
      'statusCode' in error &&
      error.statusCode === 404,
  );
});

test('Driver-relative assignment outcomes cover release, reassignment, completion, and Admin review', () => {
  const own = { driverProfileId: 'driver-1', acceptedAt: earlier, releasedAt: later };
  const replacement = { driverProfileId: 'driver-2', acceptedAt: now, releasedAt: null };
  assert.equal(classifyDriverAssignmentOutcome({ status: 'WAITING_FOR_DRIVER', driverProfileId: 'driver-1', assignments: [own] }), 'RELEASED_TO_POOL');
  assert.equal(classifyDriverAssignmentOutcome({ status: 'DRIVER_ASSIGNED', driverProfileId: 'driver-1', assignments: [replacement, own] }), 'REASSIGNED');
  assert.equal(classifyDriverAssignmentOutcome({ status: 'DELIVERED', driverProfileId: 'driver-1', assignments: [replacement, own] }), 'REASSIGNED');
  assert.equal(classifyDriverAssignmentOutcome({ status: 'DELIVERED', driverProfileId: 'driver-1', assignments: [own] }), 'CLOSED');
  assert.equal(classifyDriverAssignmentOutcome({ status: 'AWAITING_RESOLUTION', driverProfileId: 'driver-1', assignments: [own] }), 'MOVED_TO_ADMIN_REVIEW');
});

for (const reason of [
  'MATERIAL_NOT_READY',
  'MATERIAL_MISSING',
  'WRONG_ITEM',
  'QUANTITY_MISMATCH',
  'DAMAGED_ITEM',
  'SUPPLIER_REFUSED_HANDOVER',
  'OTHER',
]) {
  test(`historical detail preserves audited unpicked reason ${reason}`, () => {
    const mapped = mapHistoricalDeliveryDetail(
      historicalDetail({
        pickupItems: [pickupItem(true), pickupItem(false, reason)],
      }) as never,
      'driver-1',
    );
    assert.equal(mapped.carriedItems.length, 1);
    assert.equal(mapped.unpickedItems.length, 1);
    assert.equal(mapped.unpickedItems[0]?.unpickedReason, reason);
    assert.equal(mapped.unpickedItems[0]?.driverNote, 'Driver-authored note');
    assert.equal(mapped.itemAuditComplete, true);
  });
}

test('legacy pickup history is explicitly incomplete and fabricates no unpicked outcome', () => {
  const mapped = mapHistoricalDeliveryDetail(
    historicalDetail({ pickupItems: [] }) as never,
    'driver-1',
  );
  assert.equal(mapped.itemAuditComplete, false);
  assert.equal(mapped.unpickedItems.length, 0);
  assert.equal(mapped.carriedItems.length, 1);
  assert.equal(mapped.carriedItems[0]?.recordedAt, null);
});

test('historical DTO excludes operational and identity secrets', () => {
  const mapped = mapHistoricalDeliveryDetail(historicalDetail() as never, 'driver-1');
  const serialized = JSON.stringify(mapped);
  for (const forbidden of [
    'phone',
    'addressLine',
    'latitude',
    'longitude',
    'handoverCode',
    'driverProfileId',
    'reviewNote',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('history list projection is compact and historical detail timeline is bounded', () => {
  const list = driverHistoryListSelect('driver-1', 'user-1');
  const detail = driverHistoryDetailSelect('driver-1', 'user-1');
  assert.equal('statusHistory' in list, false);
  assert.equal(list.incidentReports.take, 1);
  assert.equal(list.pickupItems.take, 50);
  assert.equal(detail.statusHistory.take, 50);
  assert.deepEqual(detail.statusHistory.select, {
    oldStatus: true,
    newStatus: true,
    createdAt: true,
  });
});

test('review status remains independent from product-safe recovery outcome', () => {
  const statuses = ['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'RESOLVED_NO_STRIKE'];
  for (const status of statuses) {
    assert.equal(statuses.includes(status), true);
    assert.equal(
      driverIncidentOutcome({
        recoveryAction: 'SUPPLIER_RESCHEDULE_REQUESTED',
        recoveryCompletedAt: null,
        holdReleasedAt: null,
        reservation: { status: 'AWAITING_SUPPLIER_CONFIRMATION' },
      }),
      'SUPPLIER_RESCHEDULE_REQUESTED',
    );
  }
});

test('incident recovery outcomes cover pending, replacement, regrouping, expiry, and hold release', () => {
  assert.equal(outcome(null, null, null, 'AWAITING_RESOLUTION'), 'PENDING_RECOVERY');
  assert.equal(outcome('SUPPLIER_RESCHEDULE_REQUESTED', null, null, 'AWAITING_SUPPLIER_CONFIRMATION'), 'SUPPLIER_RESCHEDULE_REQUESTED');
  assert.equal(outcome('REPLACEMENT_WINDOW_SUBMITTED', now, null, 'ACCEPTED'), 'REPLACEMENT_WINDOW_SUBMITTED');
  assert.equal(outcome('RESERVATION_REGROUPED', now, null, 'ACCEPTED'), 'RESERVATION_REGROUPED');
  assert.equal(outcome('RESERVATION_CANCELLED_OR_EXPIRED', null, now, 'EXPIRED'), 'RESERVATION_CANCELLED_OR_EXPIRED');
});

test('incident list is reporter-owned and suppresses unauthorized recovery identifiers', async () => {
  let reportWhere: unknown;
  const database = {
    driverProfile: { findUnique: async () => ({ id: 'driver-1', status: 'ACTIVE' }) },
    noShowReport: {
      findMany: async (query: { where: unknown }) => {
        reportWhere = query.where;
        return [incidentRow()];
      },
    },
    delivery: { findMany: async () => [] },
  } as never;
  const result = await listDriverIncidents('reporter-user', { limit: 20 }, database);
  assert.deepEqual(reportWhere, { reporterUserId: 'reporter-user' });
  assert.equal(result.incidents[0]?.relatedDelivery, null);
  assert.equal(result.incidents[0]?.recoveryDelivery, null);
  const serialized = JSON.stringify(result.incidents[0]);
  assert.equal(serialized.includes('recovery-secret'), false);
  assert.equal(serialized.includes('group-secret'), false);
});

test('recovery Delivery link is returned only with authenticated Driver assignment evidence', async () => {
  const database = {
    driverProfile: { findUnique: async () => ({ id: 'driver-1', status: 'ACTIVE' }) },
    noShowReport: { findMany: async () => [incidentRow()] },
    delivery: {
      findMany: async () => [
        { id: 'recovery-secret', status: 'DELIVERED', assignedDriverProfileId: null },
      ],
    },
  } as never;
  const result = await listDriverIncidents('reporter-user', { limit: 20 }, database);
  assert.deepEqual(result.incidents[0]?.recoveryDelivery, {
    id: 'recovery-secret',
    status: 'DELIVERED',
    isHistorical: true,
  });
});

function outcome(
  recoveryAction: string | null,
  recoveryCompletedAt: Date | null,
  holdReleasedAt: Date | null,
  reservationStatus: string,
) {
  return driverIncidentOutcome({
    recoveryAction,
    recoveryCompletedAt,
    holdReleasedAt,
    reservation: { status: reservationStatus },
  });
}

function pickupItem(wasPicked: boolean, reason: string | null = null) {
  return {
    reservationId: wasPicked ? 'reservation-picked' : 'reservation-unpicked',
    materialId: wasPicked ? 'material-picked' : 'material-unpicked',
    materialTitle: wasPicked ? 'Wood' : 'Metal',
    quantity: 2,
    unit: 'kg',
    condition: 'USED_GOOD',
    wasPicked,
    unpickedReason: reason,
    driverNote: wasPicked ? null : 'Driver-authored note',
    recordedAt: now,
  };
}

function historicalDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'delivery-1',
    reservationId: 'reservation-1',
    deliveryGroupId: null,
    assignedDriverProfileId: null,
    status: 'DELIVERED',
    requestedAt: earlier,
    assignedAt: earlier,
    arrivedPickupAt: earlier,
    pickedUpAt: earlier,
    onTheWayAt: later,
    arrivedDropoffAt: later,
    deliveredAt: now,
    cancelledAt: null,
    failedAt: null,
    failureReason: null,
    updatedAt: now,
    reservation: {
      id: 'reservation-1',
      status: 'COMPLETED',
      quantityRequested: 1,
      material: { id: 'material-1', title: 'Wood', unit: 'kg', condition: null },
      owner: { displayName: 'Supplier', supplierProfile: null },
    },
    deliveryGroup: null,
    pickupLocation: { country: 'PS', city: 'Hebron', area: 'North' },
    dropoffLocation: { country: 'PS', city: 'Hebron', area: 'South' },
    pickupItems: [pickupItem(true)],
    assignments: [
      { driverProfileId: 'driver-1', status: 'RELEASED', acceptedAt: earlier, releasedAt: now },
    ],
    incidentReports: [],
    _count: { incidentReports: 0 },
    statusHistory: [
      { oldStatus: 'ARRIVED_DROPOFF', newStatus: 'DELIVERED', createdAt: now },
    ],
    ...overrides,
  };
}

function incidentRow() {
  return {
    id: 'report-1',
    deliveryId: 'delivery-not-authorized',
    reasonCode: 'PICKUP_FAILED',
    targetRole: 'SUPPLIER',
    status: 'VERIFIED',
    reporterReasonDetail: 'MATERIAL_MISSING',
    reporterNote: 'Missing',
    createdAt: now,
    reviewedAt: now,
    recoveryAction: 'RESERVATION_REGROUPED',
    recoveryActionAt: now,
    recoveryDeliveryId: 'recovery-secret',
    recoveryCompletedAt: now,
    holdReleasedAt: null,
    reservation: {
      id: 'reservation-1',
      status: 'ACCEPTED',
      material: { id: 'material-1', title: 'Wood', unit: 'kg' },
    },
    delivery: {
      status: 'DELIVERED',
      assignedDriverProfileId: null,
      assignments: [],
    },
    recoveryDeliveryGroupId: 'group-secret',
  };
}
