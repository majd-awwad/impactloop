import type { ReservationStatus } from '../../generated/prisma/client.js';

import { isAcceptedMissedPickupExpired } from './reservation-missed-pickup-expiry.js';
import {
  isPendingReservationExpired,
  type PendingReservationExpiryRecord,
} from './reservation-pending-expiry.js';
import { MISSED_PICKUP_EXPIRY_REASON } from './reservation-timing-policy.js';

export type EffectiveReservationViewInput = PendingReservationExpiryRecord & {
  pickupWindowEnd: Date | null;
  rejectionReason: string | null;
};

export type EffectiveReservationView = {
  status: ReservationStatus;
  rejectionReason: string | null;
};

/**
 * Read-only view of reservation lifecycle state for list/detail responses.
 * Does not mutate persistence; workers and write paths reconcile stale rows.
 */
export const deriveEffectiveReservationView = (
  reservation: EffectiveReservationViewInput,
  deliveryCount: number,
  now: Date = new Date(),
): EffectiveReservationView => {
  if (isPendingReservationExpired(reservation, now)) {
    return {
      status: 'EXPIRED',
      rejectionReason: reservation.rejectionReason,
    };
  }

  if (
    isAcceptedMissedPickupExpired(
      {
        status: reservation.status,
        fulfillmentMethod: reservation.fulfillmentMethod,
        pickupWindowEnd: reservation.pickupWindowEnd,
        deliveryCount,
      },
      now,
    )
  ) {
    return {
      status: 'EXPIRED',
      rejectionReason: MISSED_PICKUP_EXPIRY_REASON,
    };
  }

  return {
    status: reservation.status,
    rejectionReason: reservation.rejectionReason,
  };
};
