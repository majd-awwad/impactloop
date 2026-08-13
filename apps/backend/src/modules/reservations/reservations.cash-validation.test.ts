import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createReservationSchema,
  reservationQuoteSchema,
} from './reservations.validation.js';

describe('reservation cash validation', () => {
  test('legacy create and quote payloads default to card', () => {
    const create = createReservationSchema.parse({
      materialId: 'material-id',
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
    });
    const quote = reservationQuoteSchema.parse({
      materialId: 'material-id',
      quantity: 1,
      fulfillmentMethod: 'PICKUP',
    });

    assert.equal(create.paymentMethod, 'CARD');
    assert.equal(quote.paymentMethod, 'CARD');
  });

  test('cash delivery rejects safe drop-off', () => {
    const result = createReservationSchema.safeParse({
      materialId: 'material-id',
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      paymentMethod: 'CASH',
      deliveryAddressText: '12 Learner Street',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: true,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.equal(result.error.issues[0]?.path[0], 'safeDropoffAllowed');
    }
  });
});
