import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { listMaterialCategories } from './categories.service.js';

export const getCategories = async (req: Request, res: Response): Promise<void> => {
  const type = req.query.type;

  if (type !== 'MATERIAL') {
    res.json(successResponse('Categories loaded', []));
    return;
  }

  const categories = await listMaterialCategories();

  res.json(successResponse('Material categories loaded', categories));
};
