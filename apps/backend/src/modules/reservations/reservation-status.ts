import type { ReservationStatus } from '../../generated/prisma/client.js';

/** Reservation states shown as active work in learner and supplier journeys. */
export const ACTIVE_RESERVATION_STATUSES = [
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'ACCEPTED',
  'AWAITING_RESOLUTION',
] as const satisfies readonly ReservationStatus[];

export const COMPLETED_RESERVATION_STATUSES = [
  'COMPLETED',
] as const satisfies readonly ReservationStatus[];
