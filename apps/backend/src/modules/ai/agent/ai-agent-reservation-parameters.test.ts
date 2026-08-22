import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { parseReservationParameters } from './ai-agent-turn.service.js';

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
});
