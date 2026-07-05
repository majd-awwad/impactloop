import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import { validateIdempotencyKey } from '../../services/idempotency.service.js';

import {
  getLearningProjectById,
  getLearningProjects,
  submitLearningProjectForReview,
} from './learning-projects.service.js';
import type {
  LearningProjectsQuery,
  SubmitLearningProjectInput,
} from './learning-projects.validation.js';

export const listLearningProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projects = await getLearningProjects(
    readValidatedQuery<LearningProjectsQuery>(req),
  );

  res.json(successResponse('Learning projects fetched successfully', projects));
};

export const getLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const project = await getLearningProjectById(id);

  res.json(successResponse('Learning project fetched successfully', project));
};

export const submitLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as SubmitLearningProjectInput;
  const userId = req.auth!.sub;
  const idempotencyKey = validateIdempotencyKey(req.get('Idempotency-Key'));
  const result = await submitLearningProjectForReview(
    userId,
    body,
    idempotencyKey,
  );
  res
    .status(result.replayed ? 200 : 201)
    .json(successResponse(result.response.message, result.response));
};
