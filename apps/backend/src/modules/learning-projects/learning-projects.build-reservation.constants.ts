import type { ReservationStatus } from '../../generated/prisma/client.js';

export const ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES = [
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'ACCEPTED',
  'AWAITING_RESOLUTION',
] as const satisfies readonly ReservationStatus[];
