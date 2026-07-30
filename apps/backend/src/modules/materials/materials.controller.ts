import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import { measureRequestStage } from '../../observability/stage-timing.js';
import { getRequestAbortSignal } from '../../middlewares/request-context.middleware.js';

import {
  checkMaterialPrice,
  getListingPolicy,
  getLikedMaterials,
  likeMaterialById,
  getMaterialById,
  getMaterialViewerState,
  getRelatedMaterials,
  recordMaterialViewById,
  getMaterials,
  unlikeMaterialById,
} from './materials.service.js';
import type {
  LikedMaterialsQuery,
  MaterialsQuery,
  PriceCheckInput,
} from './materials.validation.js';

export const getListingPolicyHandler = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  res.json(successResponse('Listing policy loaded', getListingPolicy()));
};

export const priceCheckHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await checkMaterialPrice(req.body as PriceCheckInput);

  res.json(successResponse('Price check completed', result));
};

export const listMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const materials = await getMaterials(
    readValidatedQuery<MaterialsQuery>(req),
    req.auth,
  );

  res.json(successResponse('Materials fetched successfully', materials));
};

export const listLikedMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const materials = await getLikedMaterials(
    req.auth!.sub,
    readValidatedQuery<LikedMaterialsQuery>(req),
  );

  res.json(successResponse('Liked materials fetched successfully', materials));
};

export const getMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const material = await measureRequestStage('materials.public-detail', () =>
    getMaterialById(id, undefined, getRequestAbortSignal(res)),
  );

  res.json(successResponse('Material fetched successfully', material));
};

export const getMaterialViewerStateHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  res.setHeader('Cache-Control', 'private, no-store');
  const state = await measureRequestStage('materials.viewer-state', () =>
    getMaterialViewerState(id, req.auth!, getRequestAbortSignal(res)),
  );
  res.json(successResponse('Material viewer state fetched successfully', state));
};

export const recordMaterialViewHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const operationKey = req.header('Idempotency-Key')?.trim();
  if (!operationKey || operationKey.length > 191) {
    throw new AppError(
      'A valid Idempotency-Key header is required.',
      400,
      'VALIDATION_ERROR',
    );
  }
  const result = await measureRequestStage('materials.record-view', () =>
    recordMaterialViewById(id, operationKey, req.auth),
  );
  res.status(202).json(successResponse('Material view recorded', result));
};

export const getRelatedMaterialsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const { limit } = readValidatedQuery<{ limit: number }>(req);
  const result = await measureRequestStage('materials.related', () =>
    getRelatedMaterials(id, limit, req.auth, getRequestAbortSignal(res)),
  );
  res.json(successResponse('Related materials fetched successfully', result));
};

export const likeMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await likeMaterialById(id, req.auth!.sub);

  res.json(successResponse('Material liked successfully', result));
};

export const unlikeMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await unlikeMaterialById(id, req.auth!.sub);

  res.json(successResponse('Material unliked successfully', result));
};
