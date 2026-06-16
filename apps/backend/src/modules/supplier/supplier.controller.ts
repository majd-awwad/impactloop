import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { getSupplierDashboard } from './supplier.service.js';

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const dashboard = await getSupplierDashboard(req.auth!.sub);

  res.json(successResponse('Supplier dashboard loaded', dashboard));
};
