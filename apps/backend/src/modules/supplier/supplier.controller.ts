import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  getSupplierDashboard,
  getSupplierProfile,
  updateSupplierProfile,
} from './supplier.service.js';
import type { UpdateSupplierProfileInput } from './supplier.validation.js';

export const getDashboard = async (req: Request, res: Response): Promise<void> => {
  const dashboard = await getSupplierDashboard(req.auth!.sub);

  res.json(successResponse('Supplier dashboard loaded', dashboard));
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  const profile = await getSupplierProfile(req.auth!.sub);

  res.json(successResponse('Supplier profile loaded', profile));
};

export const patchProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const profile = await updateSupplierProfile(
    req.auth!.sub,
    req.body as UpdateSupplierProfileInput,
  );

  res.json(successResponse('Supplier profile updated', profile));
};
