import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  getSupplierCandidateMaterialsForRequest,
  getSupplierMaterialRequest,
  listSupplierMaterialRequests,
  suggestMaterialForRequest,
} from './supplier-material-requests.service.js';
import type {
  ListSupplierMaterialRequestsQuery,
  SuggestMaterialForRequestInput,
  SupplierCandidateMaterialsQuery,
} from './supplier-material-requests.validation.js';

export const getSupplierMaterialRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<ListSupplierMaterialRequestsQuery>(req);
  const result = await listSupplierMaterialRequests(req.auth!.sub, query);
  res.json(successResponse('Material requests loaded', result));
};

export const getSupplierMaterialRequestById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const params = readValidatedParams<{ id: string }>(req);
  const result = await getSupplierMaterialRequest(req.auth!.sub, params.id);
  res.json(successResponse('Material request loaded', result));
};

export const getSupplierMaterialRequestCandidateMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const params = readValidatedParams<{ id: string }>(req);
  const query = readValidatedQuery<SupplierCandidateMaterialsQuery>(req);
  const result = await getSupplierCandidateMaterialsForRequest(
    req.auth!.sub,
    params.id,
    query.limit,
  );
  res.json(successResponse('Candidate materials loaded', result));
};

export const postSupplierMaterialRequestSuggestion = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const params = readValidatedParams<{ id: string }>(req);
  const result = await suggestMaterialForRequest(
    req.auth!.sub,
    params.id,
    req.body as SuggestMaterialForRequestInput,
  );
  res.status(201).json(successResponse('Suggestion created', result));
};
