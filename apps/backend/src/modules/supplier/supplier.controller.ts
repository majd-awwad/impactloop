import type { Request, Response } from 'express';

import { readValidatedQuery } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  createSupplierMaterial,
  deleteSupplierMaterial,
  getSupplierDashboard,
  getSupplierMaterial,
  getSupplierMaterials,
  getSupplierProfile,
  updateSupplierMaterial,
  updateSupplierProfile,
} from './supplier.service.js';
import type {
  CreateSupplierMaterialInput,
  SupplierMaterialsQuery,
  UpdateSupplierMaterialInput,
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

export const getMaterial = async (req: Request, res: Response): Promise<void> => {
  const material = await getSupplierMaterial(
    req.auth!.sub,
    req.params.id as string,
  );

  res.json(successResponse('Supplier material loaded', material));
};

export const patchMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const material = await updateSupplierMaterial(
    req.auth!.sub,
    req.params.id as string,
    req.body as UpdateSupplierMaterialInput,
  );

  res.json(successResponse('Material updated successfully.', material));
};

export const deleteMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  await deleteSupplierMaterial(req.auth!.sub, req.params.id as string);

  res.json(successResponse('Material deleted successfully.', null));
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
