import type { DeliveryStatus, ReservationStatus } from '../../generated/prisma/client.js';
import { isAfterWindowWithGrace } from '../../utils/handover-timing.js';

const prePickupDeliveryStatuses = [
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
] as const satisfies readonly DeliveryStatus[];

const postPickupDeliveryStatuses = [
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
] as const satisfies readonly DeliveryStatus[];

export const canSupplierMarkLearnerPickupNoShow = (input: {
  status: ReservationStatus;
  fulfillmentMethod: string;
  pickupWindowEnd: Date | null;
  now?: Date;
}) =>
  input.status === 'ACCEPTED' &&
  input.fulfillmentMethod === 'PICKUP' &&
  isAfterWindowWithGrace(input.now ?? new Date(), input.pickupWindowEnd);

export const canSupplierMarkDeliveryPickupExpired = (input: {
  status: ReservationStatus;
  fulfillmentMethod: string;
  supplierPickupWindowEnd: Date | null;
  deliveryStatus: DeliveryStatus | null;
  assignedDriverProfileId: string | null;
  now?: Date;
}) =>
  input.status === 'ACCEPTED' &&
  input.fulfillmentMethod === 'DELIVERY' &&
  input.deliveryStatus === 'WAITING_FOR_DRIVER' &&
  !input.assignedDriverProfileId &&
  isAfterWindowWithGrace(
    input.now ?? new Date(),
    input.supplierPickupWindowEnd,
  );

export const canSupplierMarkDriverNoShow = (input: {
  status: ReservationStatus;
  supplierPickupWindowEnd: Date | null;
  deliveryStatus: DeliveryStatus | null;
  assignedDriverProfileId: string | null;
  now?: Date;
}) => {
  if (input.status !== 'ACCEPTED' || !input.assignedDriverProfileId) {
    return false;
  }

  if (
    !input.deliveryStatus ||
    !(prePickupDeliveryStatuses as readonly DeliveryStatus[]).includes(
      input.deliveryStatus,
    )
  ) {
    return false;
  }

  return isAfterWindowWithGrace(
    input.now ?? new Date(),
    input.supplierPickupWindowEnd,
  );
};

export const canDriverMarkPickupFailed = (input: {
  reservationStatus: ReservationStatus;
  deliveryStatus: DeliveryStatus;
  supplierPickupWindowEnd: Date | null;
  now?: Date;
}) => {
  if (input.reservationStatus !== 'ACCEPTED') {
    return false;
  }

  if (
    !(prePickupDeliveryStatuses as readonly DeliveryStatus[]).includes(
      input.deliveryStatus,
    )
  ) {
    return false;
  }

  return isAfterWindowWithGrace(
    input.now ?? new Date(),
    input.supplierPickupWindowEnd,
  );
};

export const canDriverMarkDeliveryFailed = (input: {
  reservationStatus: ReservationStatus;
  deliveryStatus: DeliveryStatus;
  confirmedDeliveryWindowEnd: Date | null;
  now?: Date;
}) => {
  if (input.reservationStatus === 'COMPLETED') {
    return false;
  }

  if (
    !(postPickupDeliveryStatuses as readonly DeliveryStatus[]).includes(
      input.deliveryStatus,
    )
  ) {
    return false;
  }

  return isAfterWindowWithGrace(
    input.now ?? new Date(),
    input.confirmedDeliveryWindowEnd,
  );
};

export const canDriverReportDriverIssue = (input: {
  reservationStatus: ReservationStatus;
  deliveryStatus: DeliveryStatus;
}) =>
  input.reservationStatus === 'ACCEPTED' &&
  (postPickupDeliveryStatuses as readonly DeliveryStatus[]).includes(
    input.deliveryStatus,
  );
