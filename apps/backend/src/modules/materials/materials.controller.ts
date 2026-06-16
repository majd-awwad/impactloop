import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { getMaterialById, getMaterials } from './materials.service.js';
import type { MaterialsQuery } from './materials.validation.js';

export const listMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const materials = await getMaterials(req.query as unknown as MaterialsQuery);

  res.json(successResponse('Materials fetched successfully', materials));
};

export const getMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as unknown as { id: string };
  const material = await getMaterialById(id);

  res.json(successResponse('Material fetched successfully', material));
};
