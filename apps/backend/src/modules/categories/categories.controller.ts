import type { Request, Response } from 'express';

import { readValidatedQuery } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import { getCategories } from './categories.service.js';
import type { CategoriesQuery } from './categories.validation.js';

export const listCategories = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const categories = await getCategories(
    readValidatedQuery<CategoriesQuery>(req),
  );

  res.json(successResponse('Categories fetched successfully', categories));
};
