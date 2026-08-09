import type { ReservationFulfillmentMethod } from '../../generated/prisma/client.js';

export const isSelfPickupReservation = (input: {
  fulfillmentMethod: ReservationFulfillmentMethod;
  deliveryCount: number;
}) => input.fulfillmentMethod === 'PICKUP' && input.deliveryCount === 0;

export const reservationUsesDelivery = (input: {
  fulfillmentMethod: ReservationFulfillmentMethod;
  deliveryCount: number;
}) => input.fulfillmentMethod === 'DELIVERY' || input.deliveryCount > 0;

export const mapReservationFulfillmentLabel = (
  fulfillmentMethod: ReservationFulfillmentMethod,
  deliveryCount: number,
): string => {
  if (fulfillmentMethod === 'DELIVERY') {
    return 'Delivery selected';
  }

  if (deliveryCount > 0) {
    return 'Delivery requested';
  }

  return 'Pickup selected';
};
