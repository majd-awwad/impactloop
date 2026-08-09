import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { PaymentOrderStatus } from '../../generated/prisma/client.js';

import { isPaymentAdminActor } from './payments.actor.js';
import {
  PAYABLE_PAYMENT_ORDER_STATUSES,
  PAYMENT_ORDER_NEW_CYCLE_TERMINAL_STATUSES,
  isPayablePaymentOrderStatus,
  isTerminalPaymentOrderForNewCycle,
} from './payments.status-policy.js';

describe('payment status and actor policy', () => {
  test('defines payable and new-cycle-terminal order statuses', () => {
    assert.deepEqual(PAYABLE_PAYMENT_ORDER_STATUSES, [
      'REQUIRES_PAYMENT',
      'CHECKOUT_PENDING',
    ]);
    assert.deepEqual(PAYMENT_ORDER_NEW_CYCLE_TERMINAL_STATUSES, [
      'CANCELLED',
      'REFUNDED',
    ]);

    for (const status of Object.values(PaymentOrderStatus)) {
      assert.equal(
        isPayablePaymentOrderStatus(status),
        status === 'REQUIRES_PAYMENT' || status === 'CHECKOUT_PENDING',
      );
      assert.equal(
        isTerminalPaymentOrderForNewCycle(status),
        status === 'CANCELLED' || status === 'REFUNDED',
      );
    }
  });

  test('recognizes only ADMIN as a payment admin actor', () => {
    assert.equal(isPaymentAdminActor({ userId: 'admin', roles: ['ADMIN'] }), true);
    assert.equal(
      isPaymentAdminActor({ userId: 'learner', roles: ['LEARNER'] }),
      false,
    );
    assert.equal(
      isPaymentAdminActor({ userId: 'multi-role', roles: ['LEARNER', 'ADMIN'] }),
      true,
    );
  });
});
