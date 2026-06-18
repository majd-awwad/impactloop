import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedQuery } from '../../middlewares/validate.middleware.js';

import {
  getActivePriceRuleForMaterialType,
  searchMaterialTypes,
} from './material-types.service.js';
import type { SearchMaterialTypesQuery } from './material-types.validation.js';

export const searchMaterialTypesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<SearchMaterialTypesQuery>(req);
  const result = await searchMaterialTypes({
    categoryId: query.categoryId,
    q: query.q,
  });

  res.json(successResponse('Material types loaded', result));
};

export const getMaterialTypePriceRule = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const materialTypeId = req.params.id;

  if (typeof materialTypeId !== 'string') {
    throw new Error('Invalid material type id');
  }

  const rule = await getActivePriceRuleForMaterialType(materialTypeId);

  res.json(
    successResponse(
      rule ? 'Active price rule loaded' : 'No active price rule found',
      rule,
    ),
  );
};
