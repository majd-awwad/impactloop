export const isSelfPickupReservation = (input: {
  fulfillmentMethod: string;
  deliveryCount: number;
}) => input.fulfillmentMethod === 'PICKUP' && input.deliveryCount === 0;

export const reservationUsesDelivery = (input: {
  fulfillmentMethod: string;
  deliveryCount: number;
}) => input.fulfillmentMethod === 'DELIVERY' || input.deliveryCount > 0;

export const mapReservationFulfillmentLabel = (
  fulfillmentMethod: string,
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
