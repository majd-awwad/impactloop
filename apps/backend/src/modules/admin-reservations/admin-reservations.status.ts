import { ReservationStatus } from '../../generated/prisma/client.js';

/** Admin filtering exposes every reservation lifecycle state. */
export const ADMIN_FILTERABLE_RESERVATION_STATUSES = Object.freeze(
  Object.values(ReservationStatus),
);

/** Reservations still waiting for one side to confirm the request. */
export const ADMIN_PENDING_KPI_RESERVATION_STATUSES = [
  ReservationStatus.PENDING,
  ReservationStatus.AWAITING_LEARNER_CONFIRMATION,
  ReservationStatus.AWAITING_SUPPLIER_CONFIRMATION,
] as const satisfies readonly ReservationStatus[];

/** Accepted work, including reservations currently under operational review. */
export const ADMIN_ACCEPTED_ACTIVE_KPI_RESERVATION_STATUSES = [
  ReservationStatus.ACCEPTED,
  ReservationStatus.AWAITING_RESOLUTION,
] as const satisfies readonly ReservationStatus[];

/** Successfully finished reservations. */
export const ADMIN_COMPLETED_KPI_RESERVATION_STATUSES = [
  ReservationStatus.COMPLETED,
] as const satisfies readonly ReservationStatus[];
