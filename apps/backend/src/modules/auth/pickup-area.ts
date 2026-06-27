export type ParsedPickupArea = {
  city: string;
  area: string | null;
};

export const DEFAULT_PICKUP_COUNTRY = 'Palestine';

export const parsePickupArea = (pickupArea: string): ParsedPickupArea => {
  const parts = pickupArea
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error('Pickup area is required');
  }

  if (parts.length === 1) {
    return {
      city: parts[0]!,
      area: null,
    };
  }

  return {
    city: parts[0]!,
    area: parts.slice(1).join(', '),
  };
};

export const formatPickupAreaLabel = (input: {
  city: string;
  area: string | null;
}): string => {
  return input.area ? `${input.city}, ${input.area}` : input.city;
};
