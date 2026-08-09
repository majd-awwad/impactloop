import type {
  DeliveryStatus,
  ReservationFulfillmentMethod,
  ReservationStatus,
} from '../../generated/prisma/client.js';

import { NO_DRIVER_AUTO_ESCALATION_HOURS } from './reservation-timing-policy.js';

export type NoDriverAutoEscalationRecord = {
  status: ReservationStatus;
  fulfillmentMethod: ReservationFulfillmentMethod;
  supplierPickupWindowEnd: Date | null;
  deliveryStatus: DeliveryStatus | null;
  assignedDriverProfileId: string | null;
  hasNoDriverReport: boolean;
};

export const resolveNoDriverAutoEscalationDeadline = (
  supplierPickupWindowEnd: Date,
): Date =>
  new Date(
    supplierPickupWindowEnd.getTime() +
      NO_DRIVER_AUTO_ESCALATION_HOURS * 60 * 60 * 1000,
  );

export const isNoDriverAutoEscalationDue = (
  reservation: NoDriverAutoEscalationRecord,
  now: Date = new Date(),
): boolean => {
  if (reservation.status !== 'ACCEPTED') {
    return false;
  }

  if (reservation.fulfillmentMethod !== 'DELIVERY') {
    return false;
  }

  if (!reservation.supplierPickupWindowEnd) {
    return false;
  }

  if (reservation.hasNoDriverReport) {
    return false;
  }

  if (
    reservation.deliveryStatus !== 'WAITING_FOR_DRIVER' ||
    reservation.assignedDriverProfileId
  ) {
    return false;
  }

  return (
    now.getTime() >
    resolveNoDriverAutoEscalationDeadline(
      reservation.supplierPickupWindowEnd,
    ).getTime()
  );
};

export const noDriverAutoEscalationNote = () =>
  `Automatically escalated after no driver was assigned within ${NO_DRIVER_AUTO_ESCALATION_HOURS} hours of the supplier pickup window end.`;
