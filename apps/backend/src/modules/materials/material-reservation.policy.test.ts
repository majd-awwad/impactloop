import assert from 'node:assert/strict';
import test from 'node:test';

import { MATERIAL_MUTATION_BLOCKING_RESERVATION_STATUSES } from './material-reservation.policy.js';
import {
  ACTIVE_RESERVATION_STATUSES,
  COMPLETED_RESERVATION_STATUSES,
} from '../reservations/reservation-status.js';

test('material mutation blocking preserves completed reservation history', () => {
  assert.deepEqual(MATERIAL_MUTATION_BLOCKING_RESERVATION_STATUSES, [
    ...ACTIVE_RESERVATION_STATUSES,
    ...COMPLETED_RESERVATION_STATUSES,
  ]);
});
