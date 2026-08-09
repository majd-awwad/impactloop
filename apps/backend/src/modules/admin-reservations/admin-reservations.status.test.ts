import assert from 'node:assert/strict';
import test from 'node:test';

import { ReservationStatus } from '../../generated/prisma/client.js';
import {
  ACTIVE_RESERVATION_STATUSES,
  COMPLETED_RESERVATION_STATUSES,
} from '../reservations/reservation-status.js';

import {
  ADMIN_ACCEPTED_ACTIVE_KPI_RESERVATION_STATUSES,
  ADMIN_COMPLETED_KPI_RESERVATION_STATUSES,
  ADMIN_FILTERABLE_RESERVATION_STATUSES,
  ADMIN_PENDING_KPI_RESERVATION_STATUSES,
} from './admin-reservations.status.js';
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

test('admin KPI groups partition active reservations by operational meaning', () => {
  assert.deepEqual(ADMIN_PENDING_KPI_RESERVATION_STATUSES, [
    'PENDING',
    'AWAITING_LEARNER_CONFIRMATION',
    'AWAITING_SUPPLIER_CONFIRMATION',
  ]);
  assert.deepEqual(ADMIN_ACCEPTED_ACTIVE_KPI_RESERVATION_STATUSES, [
    'ACCEPTED',
    'AWAITING_RESOLUTION',
  ]);
  assert.deepEqual(
    [
      ...ADMIN_PENDING_KPI_RESERVATION_STATUSES,
      ...ADMIN_ACCEPTED_ACTIVE_KPI_RESERVATION_STATUSES,
    ],
    ACTIVE_RESERVATION_STATUSES,
  );
  assert.deepEqual(
    ADMIN_COMPLETED_KPI_RESERVATION_STATUSES,
    COMPLETED_RESERVATION_STATUSES,
  );
});
