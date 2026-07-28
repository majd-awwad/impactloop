import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import type { MaterialsQuery } from '../materials/materials.validation.js';

import {
  followSupplierById,
  getPublicSupplierById,
  getPublicSupplierMaterials,
  unfollowSupplierById,
} from './public-suppliers.service.js';

export const getPublicSupplier = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { supplierProfileId } = readValidatedParams<{
    supplierProfileId: string;
  }>(req);
  const supplier = await getPublicSupplierById(supplierProfileId, req.auth);

  res.json(successResponse('Supplier profile fetched successfully', supplier));
};

export const listPublicSupplierMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { supplierProfileId } = readValidatedParams<{
    supplierProfileId: string;
  }>(req);
  const materials = await getPublicSupplierMaterials(
    supplierProfileId,
    readValidatedQuery<MaterialsQuery>(req),
    req.auth,
  );

  res.json(
    successResponse('Supplier materials fetched successfully', materials),
  );
};

export const followSupplier = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { supplierProfileId } = readValidatedParams<{
    supplierProfileId: string;
  }>(req);
  const result = await followSupplierById(supplierProfileId, req.auth!.sub);

  res.json(successResponse('Supplier followed successfully', result));
};

export const unfollowSupplier = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { supplierProfileId } = readValidatedParams<{
    supplierProfileId: string;
  }>(req);
  const result = await unfollowSupplierById(supplierProfileId, req.auth!.sub);

  res.json(successResponse('Supplier unfollowed successfully', result));
};
