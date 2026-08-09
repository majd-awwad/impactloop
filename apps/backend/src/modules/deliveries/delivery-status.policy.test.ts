import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isTerminalDeliveryStatus,
  TERMINAL_DELIVERY_STATUSES,
} from './delivery-status.policy.js';

test('terminal delivery policy covers completed, failed, and resolution states', () => {
  assert.deepEqual(TERMINAL_DELIVERY_STATUSES, [
    'DELIVERED',
    'CANCELLED',
    'FAILED_PICKUP',
    'FAILED_DELIVERY',
    'DRIVER_NO_SHOW',
    'LEARNER_NO_SHOW',
    'AWAITING_RESOLUTION',
  ]);

  for (const status of TERMINAL_DELIVERY_STATUSES) {
    assert.equal(isTerminalDeliveryStatus(status), true);
  }

  assert.equal(isTerminalDeliveryStatus('WAITING_FOR_DRIVER'), false);
  assert.equal(isTerminalDeliveryStatus('DRIVER_ASSIGNED'), false);
  assert.equal(isTerminalDeliveryStatus('PICKED_UP'), false);
  assert.equal(isTerminalDeliveryStatus('ON_THE_WAY'), false);
});
