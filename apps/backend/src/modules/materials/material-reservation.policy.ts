import type { ReservationStatus } from '../../generated/prisma/client.js';
import {
  ACTIVE_RESERVATION_STATUSES,
  COMPLETED_RESERVATION_STATUSES,
} from '../reservations/reservation-status.js';

/**
 * Reservation states that prevent destructive material mutations.
 * Completed reservations remain blocking because their reuse history must survive.
 */
export const MATERIAL_MUTATION_BLOCKING_RESERVATION_STATUSES = [
  ...ACTIVE_RESERVATION_STATUSES,
  ...COMPLETED_RESERVATION_STATUSES,
] as const satisfies readonly ReservationStatus[];
