import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  assertRescheduleAllowedOutsideHandover,
  canRequestPickupReschedule,
} from '../reservations/reservation-reschedule.js';

describe('reservation reschedule rules', () => {
  test('reschedule allowed before and after handover window only', () => {
    const start = new Date('2026-06-01T12:00:00.000Z');
    const end = new Date('2026-06-01T13:00:00.000Z');

    const before = new Date('2026-06-01T11:00:00.000Z');
    const during = new Date('2026-06-01T12:30:00.000Z');
    const after = new Date('2026-06-01T14:00:00.000Z');

    assert.equal(
      assertRescheduleAllowedOutsideHandover({
        pickupWindowStart: start,
        pickupWindowEnd: end,
      }).ok,
      true,
    );

    assert.equal(
      canRequestPickupReschedule({
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        deliveryRequested: false,
        deliveryCount: 0,
        pickupWindowStart: start,
        pickupWindowEnd: end,
        hasFinalReport: false,
      }),
      true,
    );

    assert.equal(
      assertRescheduleAllowedOutsideHandover({
        pickupWindowStart: start,
        pickupWindowEnd: end,
      }).ok,
      true,
    );

    assert.equal(
      canRequestPickupReschedule({
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        deliveryRequested: false,
        deliveryCount: 0,
        pickupWindowStart: start,
        pickupWindowEnd: end,
        hasFinalReport: false,
      }),
      true,
    );

    assert.equal(before < start, true);
    assert.equal(during > start && during < end, true);
    assert.equal(after > end, true);
  });

  test('reschedule rejected during handover window', () => {
    const start = new Date(Date.now() - 15 * 60_000);
    const end = new Date(Date.now() + 45 * 60_000);

    const result = assertRescheduleAllowedOutsideHandover({
      pickupWindowStart: start,
      pickupWindowEnd: end,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, 'DURING_HANDOVER');
    }

    assert.equal(
      canRequestPickupReschedule({
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        deliveryRequested: false,
        deliveryCount: 0,
        pickupWindowStart: start,
        pickupWindowEnd: end,
        hasFinalReport: false,
      }),
      false,
    );
  });
});
