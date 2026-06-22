import { reverseGeocodeCoordinates } from '../../services/reverse-geocoding.service.js';

import type { ReverseGeocodeInput } from './locations.validation.js';

export const reverseGeocodeLocation = async (input: ReverseGeocodeInput) => {
  return reverseGeocodeCoordinates(input.latitude, input.longitude);
};
