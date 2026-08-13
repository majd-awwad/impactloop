import type {
  DeliveryStatus,
  ReservationFulfillmentMethod,
  ReservationStatus,
} from '../../generated/prisma/client.js';
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
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
] as const satisfies readonly DeliveryStatus[];

export const canSupplierMarkLearnerPickupNoShow = (input: {
  status: ReservationStatus;
  fulfillmentMethod: ReservationFulfillmentMethod;
  pickupWindowEnd: Date | null;
  now?: Date;
}) =>
  input.status === 'ACCEPTED' &&
  input.fulfillmentMethod === 'PICKUP' &&
  isAfterWindowWithGrace(input.now ?? new Date(), input.pickupWindowEnd);

export const resolveSupplierPickupWindowEnd = (input: {
  supplierPickupWindowEnd: Date | null;
  pickupWindowEnd?: Date | null;
}) => input.supplierPickupWindowEnd ?? input.pickupWindowEnd ?? null;

export const canSupplierMarkDeliveryPickupExpired = (input: {
  status: ReservationStatus;
  fulfillmentMethod: ReservationFulfillmentMethod;
  supplierPickupWindowEnd: Date | null;
  pickupWindowEnd?: Date | null;
  deliveryStatus: DeliveryStatus | null;
  assignedDriverProfileId: string | null;
  hasDelivery?: boolean;
  now?: Date;
}) => {
  if (input.status !== 'ACCEPTED') {
    return false;
  }

  const hasDeliveryContext =
    input.fulfillmentMethod === 'DELIVERY' || input.hasDelivery === true;

  if (!hasDeliveryContext) {
    return false;
  }

  if (input.deliveryStatus !== 'WAITING_FOR_DRIVER') {
    return false;
  }

  if (input.assignedDriverProfileId) {
    return false;
  }

  const windowEnd = resolveSupplierPickupWindowEnd({
    supplierPickupWindowEnd: input.supplierPickupWindowEnd,
    pickupWindowEnd: input.pickupWindowEnd,
  });

  return isAfterWindowWithGrace(input.now ?? new Date(), windowEnd);
};

export const canSupplierMarkDriverNoShow = (input: {
  status: ReservationStatus;
  supplierPickupWindowEnd: Date | null;
  pickupWindowEnd?: Date | null;
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

  const windowEnd = resolveSupplierPickupWindowEnd({
    supplierPickupWindowEnd: input.supplierPickupWindowEnd,
    pickupWindowEnd: input.pickupWindowEnd,
  });

  return isAfterWindowWithGrace(input.now ?? new Date(), windowEnd);
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

  return (
    input.deliveryStatus === 'ARRIVED_DROPOFF' &&
    input.confirmedDeliveryWindowEnd != null
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
