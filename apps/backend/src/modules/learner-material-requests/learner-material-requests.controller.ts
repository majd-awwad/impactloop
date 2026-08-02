import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  cancelLearnerMaterialRequest,
  createLearnerMaterialRequestIdempotent,
  dismissLearnerMaterialRequestMatch,
  duplicateLearnerMaterialRequest,
  fulfillLearnerMaterialRequest,
  getLearnerMaterialRequest,
  listLearnerMaterialRequests,
  updateLearnerMaterialRequest,
} from './learner-material-requests.service.js';
import type {
  CreateLearnerMaterialRequestInput,
  ListLearnerMaterialRequestsQuery,
  UpdateLearnerMaterialRequestInput,
} from './learner-material-requests.validation.js';

export const postLearnerMaterialRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await createLearnerMaterialRequestIdempotent(
    req.auth!.sub,
    req.body as CreateLearnerMaterialRequestInput,
    req.get('Idempotency-Key') ?? '',
  );
  res
    .status(result.replayed ? 200 : 201)
    .json(successResponse('Material request created', result.response));
};

export const getLearnerMaterialRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<ListLearnerMaterialRequestsQuery>(req);
  const result = await listLearnerMaterialRequests(req.auth!.sub, query);
  res.json(successResponse('Material requests loaded', result));
};

export const getLearnerMaterialRequestById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const params = readValidatedParams<{ id: string }>(req);
  const result = await getLearnerMaterialRequest(req.auth!.sub, params.id);
  res.json(successResponse('Material request loaded', result));
};

export const patchLearnerMaterialRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const params = readValidatedParams<{ id: string }>(req);
  const result = await updateLearnerMaterialRequest(
    req.auth!.sub,
    params.id,
    req.body as UpdateLearnerMaterialRequestInput,
  );
  res.json(successResponse('Material request updated', result));
};

export const postCancelLearnerMaterialRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const params = readValidatedParams<{ id: string }>(req);
  const result = await cancelLearnerMaterialRequest(req.auth!.sub, params.id);
  res.json(successResponse('Material request cancelled', result));
};

export const postFulfillLearnerMaterialRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const params = readValidatedParams<{ id: string }>(req);
  const result = await fulfillLearnerMaterialRequest(req.auth!.sub, params.id);
  res.json(successResponse('Material request fulfilled', result));
};

export const postDuplicateLearnerMaterialRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const params = readValidatedParams<{ id: string }>(req);
  const result = await duplicateLearnerMaterialRequest(
    req.auth!.sub,
    params.id,
  );
  res.status(201).json(successResponse('Material request duplicated', result));
};

export const postDismissLearnerMaterialRequestMatch = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const params = readValidatedParams<{ matchId: string }>(req);
  const result = await dismissLearnerMaterialRequestMatch(
    req.auth!.sub,
    params.matchId,
  );
  res.json(successResponse('Suggestion dismissed', result));
};
