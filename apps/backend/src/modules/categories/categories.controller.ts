import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { getCategories } from './categories.service.js';

export const listCategories = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const categories = await getCategories();

  res.json(successResponse('Categories fetched successfully', categories));
};
