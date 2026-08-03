import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';
import {
  availableJobMatchesCursorPosition,
  assertAvailableJobsCursorCompatible,
  buildNextAvailableJobsCursor,
  compareAvailableJobs,
  decodeAvailableJobsCursor,
  encodeAvailableJobsCursor,
  isAvailableJobAfterCursor,
  referenceAffectsAvailableJobsQuery,
  rejectStaleAvailableJobsPage,
} from './driver-available-jobs-cursor.js';
import {
  reservationStatusForUnpickedReason,
  validatePartialPickupSelection,
} from './driver-partial-pickup.js';

describe('driver partial pickup selection', () => {
  const members = [
    {
      id: 'r1',
      status: 'ACCEPTED' as const,
      fulfillmentMethod: 'DELIVERY',
      materialId: 'm1',
      quantityRequested: { toString: () => '1' } as never,
    },
    {
      id: 'r2',
      status: 'ACCEPTED' as const,
      fulfillmentMethod: 'DELIVERY',
      materialId: 'm2',
      quantityRequested: { toString: () => '1' } as never,
    },
    {
      id: 'r3',
      status: 'ACCEPTED' as const,
      fulfillmentMethod: 'DELIVERY',
      materialId: 'm3',
      quantityRequested: { toString: () => '1' } as never,
    },
  ];

  test('accepts two picked and one unpicked', () => {
    const result = validatePartialPickupSelection({
      members,
      pickedReservationIds: ['r1', 'r2'],
      unpicked: [{ reservationId: 'r3', reason: 'MATERIAL_NOT_READY' }],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.pickedIds, ['r1', 'r2']);
      assert.equal(result.unpicked.length, 1);
    }
  });

  test('rejects empty picked set', () => {
    const result = validatePartialPickupSelection({
      members,
      pickedReservationIds: [],
      unpicked: [
        { reservationId: 'r1', reason: 'WRONG_ITEM' },
        { reservationId: 'r2', reason: 'WRONG_ITEM' },
        { reservationId: 'r3', reason: 'WRONG_ITEM' },
      ],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'EMPTY_PICKED');
    }
  });

  test('rejects duplicates, missing, and unrelated ids', () => {
    assert.equal(
      validatePartialPickupSelection({
        members,
        pickedReservationIds: ['r1', 'r1'],
        unpicked: [
          { reservationId: 'r2', reason: 'OTHER' },
          { reservationId: 'r3', reason: 'OTHER' },
        ],
      }).ok,
      false,
    );
    assert.equal(
      validatePartialPickupSelection({
        members,
        pickedReservationIds: ['r1'],
        unpicked: [{ reservationId: 'r2', reason: 'OTHER' }],
      }).ok,
      false,
    );
    assert.equal(
      validatePartialPickupSelection({
        members,
        pickedReservationIds: ['r1', 'rX'],
        unpicked: [{ reservationId: 'r2', reason: 'OTHER' }],
      }).ok,
      false,
    );
  });

  test('rejects inactive or already-transitioned group members', () => {
    const result = validatePartialPickupSelection({
      members: [
        members[0]!,
        { ...members[1]!, status: 'AWAITING_RESOLUTION' as const },
      ],
      pickedReservationIds: ['r1'],
      unpicked: [{ reservationId: 'r2', reason: 'OTHER' }],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'SELECTION_INVALID');
    }
  });

  test('maps unpicked reasons to reservation statuses', () => {
    assert.equal(
      reservationStatusForUnpickedReason('MATERIAL_NOT_READY'),
      'AWAITING_SUPPLIER_CONFIRMATION',
    );
    assert.equal(
      reservationStatusForUnpickedReason('MATERIAL_MISSING'),
      'AWAITING_SUPPLIER_CONFIRMATION',
    );
    assert.equal(
      reservationStatusForUnpickedReason('WRONG_ITEM'),
      'AWAITING_RESOLUTION',
    );
    assert.equal(
      reservationStatusForUnpickedReason('SUPPLIER_REFUSED_HANDOVER'),
      'AWAITING_RESOLUTION',
    );
  });
});

describe('driver available jobs cursor', () => {
  test('encodes and decodes v2 keyset cursor with meters', () => {
    const encoded = encodeAvailableJobsCursor({
      v: 2,
      sortBy: 'newest',
      city: 'Nablus',
      area: null,
      maxDistanceKm: null,
      requestedAt: '2026-08-01T10:00:00.000Z',
      distanceMeters: null,
      distanceKm: null,
      id: 'delivery-1',
      refLat: null,
      refLng: null,
    });
    const decoded = decodeAvailableJobsCursor(encoded);
    assert.ok(decoded);
    assert.equal(decoded?.v, 2);
    assert.equal(decoded?.id, 'delivery-1');
    assert.equal(decoded?.sortBy, 'newest');
  });

  test('rejects v1 cursors fail-closed', () => {
    const v1 = Buffer.from(
      JSON.stringify({
        v: 1,
        sortBy: 'nearest',
        city: null,
        area: null,
        maxDistanceKm: null,
        requestedAt: '2026-08-01T10:00:00.000Z',
        distanceKm: 1.5,
        id: 'delivery-1',
      }),
      'utf8',
    ).toString('base64url');
    assert.equal(decodeAvailableJobsCursor(v1), null);
  });

  test('rejects incompatible cursor filters', () => {
    const cursor = decodeAvailableJobsCursor(
      encodeAvailableJobsCursor({
        v: 2,
        sortBy: 'newest',
        city: 'Nablus',
        area: null,
        maxDistanceKm: null,
        requestedAt: '2026-08-01T10:00:00.000Z',
        distanceMeters: null,
        distanceKm: null,
        id: 'delivery-1',
        refLat: null,
        refLng: null,
      }),
    )!;

    assert.throws(
      () =>
        assertAvailableJobsCursorCompatible(cursor, {
          sortBy: 'nearest',
          city: 'Nablus',
          refLat: 32.22,
          refLng: 35.26,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
    );
  });

  test('tie-breaks equal timestamps by delivery id', () => {
    const stamp = new Date('2026-08-01T10:00:00.000Z');
    const left = {
      delivery: { id: 'a', requestedAt: stamp },
      distanceMeters: null as number | null,
    };
    const right = {
      delivery: { id: 'b', requestedAt: stamp },
      distanceMeters: null as number | null,
    };
    assert.ok(compareAvailableJobs(left, right, 'newest') > 0);
    assert.equal(
      isAvailableJobAfterCursor(
        left,
        {
          v: 2,
          sortBy: 'newest',
          city: null,
          area: null,
          maxDistanceKm: null,
          requestedAt: stamp.toISOString(),
          distanceMeters: null,
          distanceKm: null,
          id: 'b',
          refLat: null,
          refLng: null,
        },
        'newest',
      ),
      true,
    );
  });

  test('tie-breaks equal nearest distances by timestamp then id', () => {
    const stamp = new Date('2026-08-01T10:00:00.000Z');
    const left = {
      delivery: { id: 'a', requestedAt: stamp },
      distanceMeters: 1500,
    };
    const right = {
      delivery: { id: 'b', requestedAt: stamp },
      distanceMeters: 1500,
    };
    assert.ok(compareAvailableJobs(left, right, 'nearest') > 0);
    const cursor = {
      v: 2 as const,
      sortBy: 'nearest' as const,
      city: null,
      area: null,
      maxDistanceKm: null,
      requestedAt: stamp.toISOString(),
      distanceMeters: 1500,
      distanceKm: 1.5,
      id: 'b',
      refLat: 32.22,
      refLng: 35.26,
    };
    assert.equal(isAvailableJobAfterCursor(left, cursor, 'nearest'), true);
    assert.equal(
      buildNextAvailableJobsCursor(left, {
        sortBy: 'nearest',
        refLat: 32.22,
        refLng: 35.26,
      }).length > 0,
      true,
    );
  });

  test('rejects a cursor whose ordering position became stale', () => {
    const stamp = new Date('2026-08-01T10:00:00.000Z');
    const cursor = {
      v: 2 as const,
      sortBy: 'nearest' as const,
      city: null,
      area: null,
      maxDistanceKm: null,
      requestedAt: stamp.toISOString(),
      distanceMeters: 1500,
      distanceKm: 1.5,
      id: 'delivery-1',
      refLat: 32.22,
      refLng: 35.26,
    };

    assert.equal(
      availableJobMatchesCursorPosition(
        {
          delivery: { id: 'delivery-1', requestedAt: stamp },
          distanceMeters: 1600,
        },
        cursor,
      ),
      false,
    );
    assert.equal(
      availableJobMatchesCursorPosition(
        {
          delivery: {
            id: 'delivery-1',
            requestedAt: new Date(stamp.getTime() + 1),
          },
          distanceMeters: 1500,
        },
        cursor,
      ),
      false,
    );
  });

  test('rejects malformed cursor payloads', () => {
    assert.equal(decodeAvailableJobsCursor('not-a-cursor'), null);
    assert.equal(decodeAvailableJobsCursor(''), null);
  });

  test('referenceAffectsAvailableJobsQuery covers nearest and radius', () => {
    assert.equal(
      referenceAffectsAvailableJobsQuery({ sortBy: 'nearest' }),
      true,
    );
    assert.equal(
      referenceAffectsAvailableJobsQuery({
        sortBy: 'newest',
        maxDistanceKm: 10,
      }),
      true,
    );
    assert.equal(
      referenceAffectsAvailableJobsQuery({ sortBy: 'newest' }),
      false,
    );
  });

  test('nearest without reference allows null/null pagination', () => {
    const cursor = decodeAvailableJobsCursor(
      encodeAvailableJobsCursor({
        v: 2,
        sortBy: 'nearest',
        city: 'Nablus',
        area: null,
        maxDistanceKm: null,
        requestedAt: '2026-08-01T10:00:00.000Z',
        distanceMeters: null,
        distanceKm: null,
        id: 'delivery-1',
        refLat: null,
        refLng: null,
      }),
    )!;

    assert.doesNotThrow(() =>
      assertAvailableJobsCursorCompatible(cursor, {
        sortBy: 'nearest',
        city: 'Nablus',
        refLat: null,
        refLng: null,
      }),
    );
  });

  test('newest with radius requires matching reference', () => {
    const cursor = decodeAvailableJobsCursor(
      encodeAvailableJobsCursor({
        v: 2,
        sortBy: 'newest',
        city: null,
        area: null,
        maxDistanceKm: 10,
        requestedAt: '2026-08-01T10:00:00.000Z',
        distanceMeters: null,
        distanceKm: null,
        id: 'delivery-1',
        refLat: 32.22,
        refLng: 35.26,
      }),
    )!;

    assert.throws(
      () =>
        assertAvailableJobsCursorCompatible(cursor, {
          sortBy: 'newest',
          maxDistanceKm: 10,
          refLat: 32.23,
          refLng: 35.26,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
    );

    assert.doesNotThrow(() =>
      assertAvailableJobsCursorCompatible(cursor, {
        sortBy: 'newest',
        maxDistanceKm: 10,
        refLat: 32.22,
        refLng: 35.26,
      }),
    );
  });

  test('newest without radius ignores driver reference movement', () => {
    const cursor = decodeAvailableJobsCursor(
      encodeAvailableJobsCursor({
        v: 2,
        sortBy: 'newest',
        city: 'Nablus',
        area: null,
        maxDistanceKm: null,
        requestedAt: '2026-08-01T10:00:00.000Z',
        distanceMeters: null,
        distanceKm: null,
        id: 'delivery-1',
        refLat: null,
        refLng: null,
      }),
    )!;

    assert.doesNotThrow(() =>
      assertAvailableJobsCursorCompatible(cursor, {
        sortBy: 'newest',
        city: 'Nablus',
        refLat: 32.22,
        refLng: 35.26,
      }),
    );
  });

  test('null-to-valid reference conflicts when reference affects the query', () => {
    const cursor = decodeAvailableJobsCursor(
      encodeAvailableJobsCursor({
        v: 2,
        sortBy: 'nearest',
        city: null,
        area: null,
        maxDistanceKm: null,
        requestedAt: '2026-08-01T10:00:00.000Z',
        distanceMeters: null,
        distanceKm: null,
        id: 'delivery-1',
        refLat: null,
        refLng: null,
      }),
    )!;

    assert.throws(
      () =>
        assertAvailableJobsCursorCompatible(cursor, {
          sortBy: 'nearest',
          refLat: 32.22,
          refLng: 35.26,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
    );
  });

  test('stale emptied page rejects with refreshable conflict code', () => {
    assert.throws(
      () => rejectStaleAvailableJobsPage(),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'DRIVER_AVAILABLE_JOBS_CURSOR_INVALID',
    );
  });
});
