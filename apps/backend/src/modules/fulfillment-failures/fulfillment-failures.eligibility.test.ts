import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { HANDOVER_GRACE_MINUTES } from '../../utils/handover-timing.js';

import {
  canSupplierMarkDeliveryPickupExpired,
  resolveSupplierPickupWindowEnd,
} from './fulfillment-failures.eligibility.js';

describe('fulfillment delivery pickup expired eligibility', () => {
  test('allows post-acceptance pickup reservation with active delivery', () => {
    const windowEnd = new Date(
      Date.now() - (HANDOVER_GRACE_MINUTES + 5) * 60_000,
    );

    assert.equal(
      canSupplierMarkDeliveryPickupExpired({
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        supplierPickupWindowEnd: null,
        pickupWindowEnd: windowEnd,
        deliveryStatus: 'WAITING_FOR_DRIVER',
        assignedDriverProfileId: null,
        hasDelivery: true,
      }),
      true,
    );
  });

  test('still requires delivery-at-booking fulfillment when no delivery row', () => {
    const windowEnd = new Date(
      Date.now() - (HANDOVER_GRACE_MINUTES + 5) * 60_000,
    );

    assert.equal(
      canSupplierMarkDeliveryPickupExpired({
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        supplierPickupWindowEnd: null,
        pickupWindowEnd: windowEnd,
        deliveryStatus: 'WAITING_FOR_DRIVER',
        assignedDriverProfileId: null,
        hasDelivery: false,
      }),
      false,
    );
  });

  test('resolveSupplierPickupWindowEnd falls back to pickup window', () => {
    const pickupEnd = new Date('2026-07-01T12:00:00.000Z');

    assert.equal(
      resolveSupplierPickupWindowEnd({
        supplierPickupWindowEnd: null,
        pickupWindowEnd: pickupEnd,
      })?.toISOString(),
      pickupEnd.toISOString(),
    );
  });
});
