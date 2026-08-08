import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import type { PublicSupplierMaterialsQuery } from './public-suppliers.validation.js';

import {
  followSupplierById,
  getPublicSupplierById,
  getPublicSupplierViewerStateById,
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
  const supplier = await getPublicSupplierById(supplierProfileId);

  res.json(successResponse('Supplier profile fetched successfully', supplier));
};

export const getPublicSupplierViewerState = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { supplierProfileId } = readValidatedParams<{
    supplierProfileId: string;
  }>(req);
  res.setHeader('Cache-Control', 'private, no-store');
  const state = await getPublicSupplierViewerStateById(
    supplierProfileId,
    req.auth!,
  );
  res.json(successResponse('Supplier viewer state fetched successfully', state));
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
    readValidatedQuery<PublicSupplierMaterialsQuery>(req),
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
