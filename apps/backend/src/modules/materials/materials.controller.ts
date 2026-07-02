import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  checkMaterialPrice,
  getListingPolicy,
  likeMaterialById,
  getMaterialById,
  getMaterials,
  unlikeMaterialById,
} from './materials.service.js';
import type {
  MaterialsQuery,
  PriceCheckInput,
} from './materials.validation.js';

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

export const listMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const materials = await getMaterials(
    readValidatedQuery<MaterialsQuery>(req),
    req.auth,
  );

  res.json(successResponse('Materials fetched successfully', materials));
};

export const getMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const material = await getMaterialById(id, req.auth);

  res.json(successResponse('Material fetched successfully', material));
};

export const likeMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await likeMaterialById(id, req.auth!.sub);

  res.json(successResponse('Material liked successfully', result));
};

export const unlikeMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await unlikeMaterialById(id, req.auth!.sub);

  res.json(successResponse('Material unliked successfully', result));
};
