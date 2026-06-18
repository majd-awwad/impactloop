import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { checkMaterialPrice, getListingPolicy } from './materials.service.js';
import type { PriceCheckInput } from './materials.validation.js';

export const getListingPolicyHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  res.json(successResponse('Listing policy loaded', getListingPolicy()));
};

export const priceCheckHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await checkMaterialPrice(req.body as PriceCheckInput);

  res.json(successResponse('Price check completed', result));
};
