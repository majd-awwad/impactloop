import type { Request, Response } from 'express';

import { readValidatedQuery } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  createSupplierMaterial,
  getSupplierDashboard,
  getSupplierMaterials,
  getSupplierProfile,
  updateSupplierProfile,
} from './supplier.service.js';
import type {
  CreateSupplierMaterialInput,
  SupplierMaterialsQuery,
  UpdateSupplierProfileInput,
} from './supplier.validation.js';

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

export const getMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const materials = await getSupplierMaterials(
    req.auth!.sub,
    readValidatedQuery<SupplierMaterialsQuery>(req),
  );

  res.json(successResponse('Supplier materials loaded', materials));
};

export const postMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const material = await createSupplierMaterial(
    req.auth!.sub,
    req.body as CreateSupplierMaterialInput,
  );

  res.status(201).json(successResponse('Material listed successfully.', material));
};
