import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createReservationSchema,
  reservationQuoteSchema,
} from './reservations.validation.js';
import { assertCardPaymentAcceptedForNewReservation } from '../payments/payments.product-policy.js';
import { AppError } from '../../utils/app-error.js';

describe('reservation cash-only product policy', () => {
  test('create and quote payloads default to cash', () => {
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

    assert.equal(create.paymentMethod, 'CASH');
    assert.equal(quote.paymentMethod, 'CASH');
  });

  test('explicit card selection is rejected with CARD_PAYMENT_DISABLED', () => {
    assert.throws(
      () => assertCardPaymentAcceptedForNewReservation('CARD'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'CARD_PAYMENT_DISABLED');
        return true;
      },
    );
  });

  test('cash selection is accepted', () => {
    assert.doesNotThrow(() =>
      assertCardPaymentAcceptedForNewReservation('CASH'),
    );
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
