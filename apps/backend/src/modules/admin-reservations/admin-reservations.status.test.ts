import assert from 'node:assert/strict';
import test from 'node:test';

import { ReservationStatus } from '../../generated/prisma/client.js';

import { ADMIN_FILTERABLE_RESERVATION_STATUSES } from './admin-reservations.status.js';
import { adminReservationsListQuerySchema } from './admin-reservations.validation.js';

test('admin reservation filters expose every Prisma reservation status', () => {
  assert.deepEqual(
    ADMIN_FILTERABLE_RESERVATION_STATUSES,
    Object.values(ReservationStatus),
  );

  for (const status of ADMIN_FILTERABLE_RESERVATION_STATUSES) {
    const parsed = adminReservationsListQuerySchema.parse({ status });
    assert.equal(parsed.status, status);
  }
});

test('admin reservation filters reject unknown statuses', () => {
  assert.equal(
    adminReservationsListQuerySchema.safeParse({ status: 'UNKNOWN_STATUS' })
      .success,
    false,
  );
});
