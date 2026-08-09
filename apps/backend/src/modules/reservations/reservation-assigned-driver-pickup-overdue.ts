import type {
  DeliveryStatus,
  ReservationFulfillmentMethod,
  ReservationStatus,
} from '../../generated/prisma/client.js';
import { isAfterWindowWithGrace } from '../../utils/handover-timing.js';
import { resolveSupplierPickupWindowEnd } from '../fulfillment-failures/fulfillment-failures.eligibility.js';
import { NO_DRIVER_AUTO_ESCALATION_HOURS } from './reservation-timing-policy.js';

export const PRE_PICKUP_ASSIGNED_DRIVER_DELIVERY_STATUSES = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
] as const satisfies readonly DeliveryStatus[];

export type AssignedDriverPickupOverdueInput = {
  supplierPickupWindowEnd: Date | null;
  pickupWindowEnd?: Date | null;
  deliveryStatus: DeliveryStatus | null;
  now?: Date;
};

export const isPrePickupAssignedDriverDeliveryStatus = (
  status: DeliveryStatus | null | undefined,
): status is (typeof PRE_PICKUP_ASSIGNED_DRIVER_DELIVERY_STATUSES)[number] =>
  status != null &&
  (PRE_PICKUP_ASSIGNED_DRIVER_DELIVERY_STATUSES as readonly DeliveryStatus[]).includes(
    status,
  );

export const isAssignedDriverPickupOverdue = (
  input: AssignedDriverPickupOverdueInput,
): boolean => {
  if (!isPrePickupAssignedDriverDeliveryStatus(input.deliveryStatus)) {
    return false;
  }

  const windowEnd = resolveSupplierPickupWindowEnd({
    supplierPickupWindowEnd: input.supplierPickupWindowEnd,
    pickupWindowEnd: input.pickupWindowEnd,
  });

  if (!windowEnd) {
    return false;
  }

  return isAfterWindowWithGrace(input.now ?? new Date(), windowEnd);
};

export type StaleAssignedDriverAutoEscalationRecord = {
  status: ReservationStatus;
  fulfillmentMethod: ReservationFulfillmentMethod;
  supplierPickupWindowEnd: Date | null;
  deliveryStatus: DeliveryStatus | null;
  assignedDriverProfileId: string | null;
  hasPendingReport: boolean;
};

export const resolveStaleAssignedDriverAutoEscalationDeadline = (
  supplierPickupWindowEnd: Date,
): Date =>
  new Date(
    supplierPickupWindowEnd.getTime() +
      NO_DRIVER_AUTO_ESCALATION_HOURS * 60 * 60 * 1000,
  );

export const isStaleAssignedDriverAutoEscalationDue = (
  reservation: StaleAssignedDriverAutoEscalationRecord,
  now: Date = new Date(),
): boolean => {
  if (reservation.status !== 'ACCEPTED') {
    return false;
  }

  if (reservation.fulfillmentMethod !== 'DELIVERY') {
    return false;
  }

  if (reservation.hasPendingReport) {
    return false;
  }

  if (!reservation.supplierPickupWindowEnd) {
    return false;
  }

  if (!reservation.assignedDriverProfileId) {
    return false;
  }

  if (
    !isPrePickupAssignedDriverDeliveryStatus(reservation.deliveryStatus)
  ) {
    return false;
  }

  return (
    now.getTime() >
    resolveStaleAssignedDriverAutoEscalationDeadline(
      reservation.supplierPickupWindowEnd,
    ).getTime()
  );
};

export const staleAssignedDriverAutoEscalationNote = () =>
  `Automatically escalated after no pickup progress within ${NO_DRIVER_AUTO_ESCALATION_HOURS} hours of the supplier pickup window end.`;
