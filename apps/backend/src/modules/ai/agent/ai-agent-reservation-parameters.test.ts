import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  computeReservationMissing,
  parseReservationParameters,
} from './ai-agent-turn.service.js';

describe('AI reservation parameter parsing', () => {
  test('accepts Arabic pickup windows with explicit UTC offsets', () => {
    const parsed = parseReservationParameters(
      'استلام من 2026-08-27T10:00:00+03:00 إلى 2026-08-27T11:00:00+03:00',
    );

    assert.equal(parsed.fulfillmentMethod, 'PICKUP');
    assert.deepEqual(parsed.pickupWindows, [
      {
        start: '2026-08-27T07:00:00.000Z',
        end: '2026-08-27T08:00:00.000Z',
      },
    ]);
  });

  test('does not accept a reversed offset pickup window', () => {
    const parsed = parseReservationParameters(
      'استلام من 2026-08-27T11:00:00+03:00 إلى 2026-08-27T10:00:00+03:00',
    );

    assert.equal(parsed.fulfillmentMethod, 'PICKUP');
    assert.equal(parsed.pickupWindows, undefined);
  });

  test('pickup reservation no longer requires a learner-selected window', () => {
    assert.deepEqual(
      computeReservationMissing({
        quantity: 1,
        fulfillmentMethod: 'PICKUP',
      }),
      [],
    );
  });

  test('rejects a zero quantity without persisting it as a valid draft value', () => {
    const parsed = parseReservationParameters('احجزلي الثانية بكمية 0');
    assert.equal(parsed.quantity, 0);
    assert.deepEqual(
      computeReservationMissing({
        quantity: parsed.quantity,
        fulfillmentMethod: 'DELIVERY',
        deliveryAddressText: 'رفيديا - شارع الجامعة',
        dropoffCity: 'نابلس',
      }),
      ['invalidQuantity'],
    );
  });

  test('parses labelled Arabic delivery address details', () => {
    const parsed = parseReservationParameters(
      'توصيل، المدينة: نابلس، العنوان: رفيديا - شارع الجامعة، المنطقة: رفيديا',
    );

    assert.equal(parsed.fulfillmentMethod, 'DELIVERY');
    assert.equal(parsed.dropoffCity, 'نابلس');
    assert.equal(parsed.deliveryAddressText, 'رفيديا - شارع الجامعة');
    assert.equal(parsed.dropoffArea, 'رفيديا');
  });

  test('delivery requires an address and city, not a preferred time window', () => {
    assert.deepEqual(
      computeReservationMissing({
        quantity: 1,
        fulfillmentMethod: 'DELIVERY',
        deliveryAddressText: 'رفيديا - شارع الجامعة',
        dropoffCity: 'نابلس',
      }),
      [],
    );
    assert.deepEqual(
      computeReservationMissing({
        quantity: 1,
        fulfillmentMethod: 'DELIVERY',
      }),
      ['deliveryAddress', 'dropoffCity'],
    );
  });
});
