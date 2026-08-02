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
  test('encodes and decodes keyset cursor', () => {
    const encoded = encodeAvailableJobsCursor({
      v: 1,
      sortBy: 'newest',
      city: 'Nablus',
      area: null,
      maxDistanceKm: null,
      requestedAt: '2026-08-01T10:00:00.000Z',
      distanceKm: null,
      id: 'delivery-1',
    });
    const decoded = decodeAvailableJobsCursor(encoded);
    assert.ok(decoded);
    assert.equal(decoded?.id, 'delivery-1');
    assert.equal(decoded?.sortBy, 'newest');
  });

  test('rejects incompatible cursor filters', () => {
    const cursor = decodeAvailableJobsCursor(
      encodeAvailableJobsCursor({
        v: 1,
        sortBy: 'newest',
        city: 'Nablus',
        area: null,
        maxDistanceKm: null,
        requestedAt: '2026-08-01T10:00:00.000Z',
        distanceKm: null,
        id: 'delivery-1',
      }),
    )!;

    assert.throws(
      () =>
        assertAvailableJobsCursorCompatible(cursor, {
          sortBy: 'nearest',
          city: 'Nablus',
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
      distanceKm: null as number | null,
    };
    const right = {
      delivery: { id: 'b', requestedAt: stamp },
      distanceKm: null as number | null,
    };
    assert.ok(compareAvailableJobs(left, right, 'newest') > 0);
    assert.equal(
      isAvailableJobAfterCursor(
        left,
        {
          v: 1,
          sortBy: 'newest',
          city: null,
          area: null,
          maxDistanceKm: null,
          requestedAt: stamp.toISOString(),
          distanceKm: null,
          id: 'b',
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
      distanceKm: 1.5,
    };
    const right = {
      delivery: { id: 'b', requestedAt: stamp },
      distanceKm: 1.5,
    };
    assert.ok(compareAvailableJobs(left, right, 'nearest') > 0);
    const cursor = {
      v: 1 as const,
      sortBy: 'nearest' as const,
      city: null,
      area: null,
      maxDistanceKm: null,
      requestedAt: stamp.toISOString(),
      distanceKm: 1.5,
      id: 'b',
    };
    assert.equal(isAvailableJobAfterCursor(left, cursor, 'nearest'), true);
    assert.equal(
      buildNextAvailableJobsCursor(left, { sortBy: 'nearest' }).length > 0,
      true,
    );
  });

  test('rejects a cursor whose ordering position became stale', () => {
    const stamp = new Date('2026-08-01T10:00:00.000Z');
    const cursor = {
      v: 1 as const,
      sortBy: 'nearest' as const,
      city: null,
      area: null,
      maxDistanceKm: null,
      requestedAt: stamp.toISOString(),
      distanceKm: 1.5,
      id: 'delivery-1',
    };

    assert.equal(
      availableJobMatchesCursorPosition(
        {
          delivery: { id: 'delivery-1', requestedAt: stamp },
          distanceKm: 1.6,
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
          distanceKm: 1.5,
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
});
