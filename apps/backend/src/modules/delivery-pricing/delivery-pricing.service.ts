import type { DeliveryZone } from '../../generated/prisma/client.js';

import {
  citiesMatch,
  isInside48City,
  isJerusalemCity,
  isWestBankCity,
  normalizeCityName,
} from './delivery-zone-cities.js';

export const DELIVERY_FEE_BY_ZONE: Record<
  Exclude<DeliveryZone, 'UNKNOWN'>,
  number
> = {
  SAME_CITY: 10,
  WEST_BANK: 20,
  JERUSALEM: 40,
  INSIDE_48: 60,
};

export const DELIVERY_PRICING_CURRENCY = 'NIS';

export const DELIVERY_ZONE_UNKNOWN_MESSAGE =
  'Delivery fee could not be calculated for this location.';

export type DeliveryPricingInput = {
  supplierPickupCity: string;
  dropoffCity: string;
  dropoffArea?: string | null;
};

export type DeliveryPricingResult =
  | {
      ok: true;
      zone: Exclude<DeliveryZone, 'UNKNOWN'>;
      deliveryFee: number;
      currency: typeof DELIVERY_PRICING_CURRENCY;
    }
  | {
      ok: false;
      zone: 'UNKNOWN';
      message: string;
    };

export const classifyDeliveryZone = (
  input: DeliveryPricingInput,
): Exclude<DeliveryZone, 'UNKNOWN'> | 'UNKNOWN' => {
  const dropoffCity = input.dropoffCity.trim();
  const supplierCity = input.supplierPickupCity.trim();

  if (!dropoffCity || !supplierCity) {
    return 'UNKNOWN';
  }

  if (isInside48City(dropoffCity)) {
    return 'INSIDE_48';
  }

  if (isJerusalemCity(dropoffCity)) {
    return 'JERUSALEM';
  }

  if (citiesMatch(supplierCity, dropoffCity)) {
    return 'SAME_CITY';
  }

  if (isWestBankCity(supplierCity) && isWestBankCity(dropoffCity)) {
    return 'WEST_BANK';
  }

  return 'UNKNOWN';
};

export const calculateDeliveryPricing = (
  input: DeliveryPricingInput,
): DeliveryPricingResult => {
  const zone = classifyDeliveryZone(input);

  if (zone === 'UNKNOWN') {
    return {
      ok: false,
      zone: 'UNKNOWN',
      message: DELIVERY_ZONE_UNKNOWN_MESSAGE,
    };
  }

  return {
    ok: true,
    zone,
    deliveryFee: DELIVERY_FEE_BY_ZONE[zone],
    currency: DELIVERY_PRICING_CURRENCY,
  };
};

export const formatNormalizedDropoffCity = (city: string): string =>
  normalizeCityName(city);
