import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { reverseGeocodeLocation } from './locations.service.js';
import type { ReverseGeocodeInput } from './locations.validation.js';

export const reverseGeocodeHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await reverseGeocodeLocation(req.body as ReverseGeocodeInput);

  res.json(successResponse('Address resolved', result));
};
