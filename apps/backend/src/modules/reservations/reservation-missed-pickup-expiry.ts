import type {
  ReservationFulfillmentMethod,
  ReservationStatus,
} from '../../generated/prisma/client.js';

import {
  MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS,
} from './reservation-timing-policy.js';
import { formatReservationHistoryNote } from './reservation-status-history.js';

export type AcceptedMissedPickupExpiryRecord = {
  status: ReservationStatus;
  fulfillmentMethod: ReservationFulfillmentMethod;
  pickupWindowEnd: Date | null;
  deliveryCount: number;
};

export const resolveMissedPickupAutoCloseDeadline = (
  pickupWindowEnd: Date,
): Date =>
  new Date(
    pickupWindowEnd.getTime() +
      MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS * 60 * 60 * 1000,
  );

export const isAcceptedMissedPickupExpired = (
  reservation: AcceptedMissedPickupExpiryRecord,
  now: Date = new Date(),
): boolean => {
  if (reservation.status !== 'ACCEPTED') {
    return false;
  }

  if (reservation.fulfillmentMethod !== 'PICKUP') {
    return false;
  }

  if (!reservation.pickupWindowEnd) {
    return false;
  }

  if (reservation.deliveryCount > 0) {
    return false;
  }

  return (
    now.getTime() >
    resolveMissedPickupAutoCloseDeadline(reservation.pickupWindowEnd).getTime()
  );
};

export const missedPickupExpiredNote = () =>
  formatReservationHistoryNote('MISSED_PICKUP_AUTO_EXPIRED');
