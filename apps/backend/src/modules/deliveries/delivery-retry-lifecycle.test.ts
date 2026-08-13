import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';
import { DRIVER_IN_PROGRESS_ASSIGNED_STATUSES } from '../driver/driver-availability.js';
import { setDriverDeliveryWindowSchema } from '../driver/driver.validation.js';
import {
  canDriverMarkDeliveryFailed,
  canDriverReportDriverIssue,
} from '../fulfillment-failures/fulfillment-failures.eligibility.js';
import { markDriverDeliveryFailedSchema } from '../fulfillment-failures/fulfillment-failures.validation.js';
import { MATERIAL_IN_CUSTODY_DELIVERY_STATUSES } from '../reservations/reservations.quantity.js';
import {
  assertValidOperationalWindow,
  RETRY_WINDOW_LIMIT_MS,
} from './delivery-operational-window.js';
import { ACTIVE_DELIVERY_STATUSES } from './deliveries.service.js';

describe('delivery retry lifecycle contract', () => {
  test('operational scheduling accepts a real future window without +60 arithmetic', () => {
    const now = new Date('2026-08-13T10:00:00.000Z');
    assert.doesNotThrow(() =>
      assertValidOperationalWindow({
        start: new Date('2026-08-13T10:05:00.000Z'),
        end: new Date('2026-08-13T10:35:00.000Z'),
        now,
      }),
    );
  });

  test('invalid and expired retry windows use typed domain errors', () => {
    const now = new Date('2026-08-13T10:00:00.000Z');
    assert.throws(
      () =>
        assertValidOperationalWindow({
          start: new Date('2026-08-13T11:00:00.000Z'),
          end: new Date('2026-08-13T10:30:00.000Z'),
          now,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'DELIVERY_WINDOW_INVALID',
    );

    const retryDeadline = new Date(now.getTime() + RETRY_WINDOW_LIMIT_MS);
    assert.throws(
      () =>
        assertValidOperationalWindow({
          start: new Date(retryDeadline.getTime() - 30 * 60_000),
          end: new Date(retryDeadline.getTime() + 1),
          now,
          requireFutureStart: true,
          retryDeadline,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'REDELIVERY_DEADLINE_EXCEEDED',
    );
  });

  test('window and failure transport schemas enforce paired retry timing', () => {
    assert.equal(
      setDriverDeliveryWindowSchema.safeParse({
        start: '2026-08-14T10:00:00.000Z',
        end: '2026-08-14T11:00:00.000Z',
      }).success,
      true,
    );
    assert.equal(
      markDriverDeliveryFailedSchema.safeParse({
        reason: 'LEARNER_UNREACHABLE',
        learnerContactAttempted: true,
        retryWindowStart: '2026-08-14T10:00:00.000Z',
      }).success,
      false,
    );
  });

  test('first failure is only available at physical dropoff', () => {
    assert.equal(
      canDriverMarkDeliveryFailed({
        reservationStatus: 'ACCEPTED',
        deliveryStatus: 'ARRIVED_DROPOFF',
        confirmedDeliveryWindowEnd: new Date(),
      }),
      true,
    );
    assert.equal(
      canDriverMarkDeliveryFailed({
        reservationStatus: 'ACCEPTED',
        deliveryStatus: 'ON_THE_WAY',
        confirmedDeliveryWindowEnd: new Date(),
      }),
      false,
    );
  });

  test('retry states retain assignment capacity, custody, and driver issue access', () => {
    for (const status of ['REDELIVERY_PENDING', 'REDELIVERY_SCHEDULED'] as const) {
      assert.equal(ACTIVE_DELIVERY_STATUSES.includes(status), true);
      assert.equal(DRIVER_IN_PROGRESS_ASSIGNED_STATUSES.includes(status), true);
      assert.equal(MATERIAL_IN_CUSTODY_DELIVERY_STATUSES.includes(status), true);
      assert.equal(
        canDriverReportDriverIssue({
          reservationStatus: 'ACCEPTED',
          deliveryStatus: status,
        }),
        true,
      );
    }
  });
});
