import type { ReservationFulfillmentMethod } from '../../generated/prisma/client.js';

import { PENDING_RESERVATION_FALLBACK_HOURS } from './reservation-timing-policy.js';

type PreferredWindow = {
  start: string;
  end: string;
};

export type PendingReservationExpiryRecord = {
  status: string;
  fulfillmentMethod: ReservationFulfillmentMethod;
  learnerPreferredPickupWindows: unknown;
  learnerPreferredDeliveryWindows: unknown;
  createdAt: Date;
};

const parsePreferredWindows = (value: unknown): PreferredWindow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }

    const start = 'start' in entry ? entry.start : null;
    const end = 'end' in entry ? entry.end : null;

    if (typeof start !== 'string' || typeof end !== 'string') {
      return [];
    }

    const endDate = new Date(end);
    if (Number.isNaN(endDate.getTime())) {
      return [];
    }

    return [{ start, end }];
  });
};

export const resolvePendingReservationDeadline = (
  reservation: PendingReservationExpiryRecord,
): Date => {
  const windows =
    reservation.fulfillmentMethod === 'DELIVERY'
      ? parsePreferredWindows(reservation.learnerPreferredDeliveryWindows)
      : parsePreferredWindows(reservation.learnerPreferredPickupWindows);

  if (windows.length > 0) {
    const latestEndMs = Math.max(
      ...windows.map((window) => new Date(window.end).getTime()),
    );

    return new Date(latestEndMs);
  }

  return new Date(
    reservation.createdAt.getTime() +
      PENDING_RESERVATION_FALLBACK_HOURS * 60 * 60 * 1000,
  );
};

export const isPendingReservationExpired = (
  reservation: PendingReservationExpiryRecord,
  now: Date = new Date(),
): boolean => {
  if (reservation.status !== 'PENDING') {
    return false;
  }

  return now.getTime() > resolvePendingReservationDeadline(reservation).getTime();
};

export const pendingReservationExpiredNote = (
  reservation: PendingReservationExpiryRecord,
): string => {
  const windows =
    reservation.fulfillmentMethod === 'DELIVERY'
      ? parsePreferredWindows(reservation.learnerPreferredDeliveryWindows)
      : parsePreferredWindows(reservation.learnerPreferredPickupWindows);

  if (windows.length > 0) {
    return 'Expired automatically after the last preferred scheduling window passed without supplier response.';
  }

  return `Expired automatically after ${PENDING_RESERVATION_FALLBACK_HOURS} hours without supplier response.`;
};
