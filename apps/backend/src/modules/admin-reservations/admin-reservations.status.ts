import { ReservationStatus } from '../../generated/prisma/client.js';

/** Admin filtering exposes every reservation lifecycle state. */
export const ADMIN_FILTERABLE_RESERVATION_STATUSES = Object.freeze(
  Object.values(ReservationStatus),
);
