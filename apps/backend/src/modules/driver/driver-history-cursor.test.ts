import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeDriverArchiveCursor,
  encodeDriverArchiveCursor,
  listDriverDeliveryHistory,
  listDriverIncidents,
} from './driver-history.service.js';

const at = new Date('2026-08-02T09:10:11.123Z');

const activeProfileDatabase = (overrides: Record<string, unknown> = {}) =>
  ({
    driverProfile: {
      findUnique: async () => ({ id: 'driver-profile-1', status: 'ACTIVE' }),
    },
    delivery: { findMany: async () => [] },
    noShowReport: { findMany: async () => [] },
    ...overrides,
  }) as never;

test('resource-specific archive cursors round-trip timestamp and id', () => {
  for (const kind of ['DRIVER_HISTORY', 'DRIVER_INCIDENTS'] as const) {
    const cursor = encodeDriverArchiveCursor(kind, at, 'record_002');
    assert.deepEqual(decodeDriverArchiveCursor(cursor, kind), {
      at,
      id: 'record_002',
    });
  }
});

test('history rejects an incident cursor with its stable error', async () => {
  const cursor = encodeDriverArchiveCursor('DRIVER_INCIDENTS', at, 'report-1');
  await assert.rejects(
    listDriverDeliveryHistory('driver-user-1', { limit: 20, cursor }, activeProfileDatabase()),
    (error: unknown) =>
      typeof error === 'object' &&
      error != null &&
      'code' in error &&
      error.code === 'DRIVER_HISTORY_CURSOR_INVALID',
  );
});

test('incidents reject a history cursor with its stable error', async () => {
  const cursor = encodeDriverArchiveCursor('DRIVER_HISTORY', at, 'delivery-1');
  await assert.rejects(
    listDriverIncidents('driver-user-1', { limit: 20, cursor }, activeProfileDatabase()),
    (error: unknown) =>
      typeof error === 'object' &&
      error != null &&
      'code' in error &&
      error.code === 'DRIVER_INCIDENTS_CURSOR_INVALID',
  );
});

test('archive cursors reject malformed, legacy, invalid-date, and unsupported payloads', () => {
  const invalid = [
    'not-base64-json',
    Buffer.from(JSON.stringify({ v: 1, at: at.toISOString(), id: 'x' })).toString('base64url'),
    Buffer.from(JSON.stringify({ v: 2, kind: 'DRIVER_HISTORY', at: at.toISOString(), id: 'x' })).toString('base64url'),
    Buffer.from(JSON.stringify({ v: 1, kind: 'DRIVER_HISTORY', at: 'not-a-date', id: 'x' })).toString('base64url'),
  ];
  for (const cursor of invalid) {
    assert.equal(decodeDriverArchiveCursor(cursor, 'DRIVER_HISTORY'), null);
  }
});

test('history uses limit plus one and timestamp/id boundary ordering', async () => {
  let captured: Record<string, unknown> | undefined;
  const database = activeProfileDatabase({
    delivery: {
      findMany: async (query: Record<string, unknown>) => {
        captured = query;
        return [
          historicalRow('delivery-c', at),
          historicalRow('delivery-b', at),
          historicalRow('delivery-a', at),
        ];
      },
    },
  });
  const result = await listDriverDeliveryHistory(
    'driver-user-1',
    { limit: 2 },
    database,
  );

  assert.equal(captured?.take, 3);
  assert.deepEqual(result.deliveries.map((item) => item.id), [
    'delivery-c',
    'delivery-b',
  ]);
  assert.equal(result.pagination.hasMore, true);
  assert.deepEqual(
    decodeDriverArchiveCursor(result.pagination.nextCursor!, 'DRIVER_HISTORY'),
    { at, id: 'delivery-b' },
  );

  await listDriverDeliveryHistory(
    'driver-user-1',
    { limit: 2, cursor: result.pagination.nextCursor! },
    database,
  );
  assert.deepEqual(
    (captured?.where as { AND: Array<{ OR: unknown[] }> }).AND[0]?.OR,
    [
      { updatedAt: { lt: at } },
      { updatedAt: at, id: { lt: 'delivery-b' } },
    ],
  );
});

function historicalRow(id: string, updatedAt: Date) {
  return {
    id,
    reservationId: `reservation-${id}`,
    deliveryGroupId: null,
    assignedDriverProfileId: null,
    status: 'DELIVERED',
    requestedAt: at,
    assignedAt: at,
    arrivedPickupAt: at,
    pickedUpAt: at,
    onTheWayAt: at,
    arrivedDropoffAt: at,
    deliveredAt: at,
    cancelledAt: null,
    failedAt: null,
    failureReason: null,
    updatedAt,
    reservation: {
      id: `reservation-${id}`,
      status: 'COMPLETED',
      quantityRequested: 1,
      material: { id: 'material-1', title: 'Wood', unit: 'kg', condition: null },
      owner: { displayName: 'Supplier', supplierProfile: null },
    },
    deliveryGroup: null,
    pickupLocation: { country: 'PS', city: 'Hebron', area: 'North' },
    dropoffLocation: { country: 'PS', city: 'Hebron', area: 'South' },
    pickupItems: [],
    assignments: [
      { driverProfileId: 'driver-profile-1', status: 'RELEASED', acceptedAt: at, releasedAt: at },
    ],
    incidentReports: [],
    _count: { incidentReports: 0 },
  };
}
