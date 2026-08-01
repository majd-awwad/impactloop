import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { DRIVER_NOTIFICATION_TYPES } from './driver-delivery-notification-types.js';
import { filterNotificationsForDisplay } from './driver-notification-validity.js';

describe('driver notification display filter', () => {
  test('allows only approved driver notification types', () => {
    const items = [
      { notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB },
      { notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME },
      { notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_DROPOFF_TIME },
      { notificationType: 'DRIVER_DELIVERY_AVAILABLE' },
      { notificationType: 'DRIVER_DELIVERY_ACCEPTED' },
      { notificationType: 'DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW' },
      { notificationType: 'RESERVATION_ACCEPTED' },
    ];

    const filtered = filterNotificationsForDisplay(items);
    assert.equal(filtered.length, 5);
    assert.ok(
      filtered.some(
        (item) =>
          item.notificationType ===
          DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW,
      ),
    );
    assert.ok(
      filtered.every(
        (item) =>
          !['DRIVER_DELIVERY_AVAILABLE', 'DRIVER_DELIVERY_ACCEPTED'].includes(
            item.notificationType,
          ),
      ),
    );
  });
});
