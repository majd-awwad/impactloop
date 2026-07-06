import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import { validateIdempotencyKey } from '../../services/idempotency.service.js';

import {
  deleteLearningProjectReviewById,
  followLearningProjectById,
  getFollowedLearningProjects,
  getLearningProjectById,
  getLearningProjects,
  getSavedLearningProjects,
  likeLearningProjectById,
  reviewLearningProjectById,
  saveLearningProjectById,
  submitLearningProjectForReview,
  unlikeLearningProjectById,
  unfollowLearningProjectById,
  unsaveLearningProjectById,
} from './learning-projects.service.js';
import type {
  LearningProjectsQuery,
  ProjectReviewInput,
  SubmitLearningProjectInput,
} from './learning-projects.validation.js';

export const listLearningProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projects = await getLearningProjects(
    readValidatedQuery<LearningProjectsQuery>(req),
    req.auth,
  );

  res.json(successResponse('Learning projects fetched successfully', projects));
};

export const listSavedLearningProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projects = await getSavedLearningProjects(
    readValidatedQuery<LearningProjectsQuery>(req),
    req.auth!,
  );

  res.json(
    successResponse('Saved learning projects fetched successfully', projects),
  );
};

export const listFollowedLearningProjects = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const projects = await getFollowedLearningProjects(
    readValidatedQuery<LearningProjectsQuery>(req),
    req.auth!,
  );

  res.json(
    successResponse('Followed learning projects fetched successfully', projects),
  );
};

export const getLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const project = await getLearningProjectById(id, req.auth);

  res.json(successResponse('Learning project fetched successfully', project));
};

export const likeLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await likeLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project liked successfully', result));
};

export const unlikeLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await unlikeLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project unliked successfully', result));
};

export const saveLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await saveLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project saved successfully', result));
};

export const unsaveLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await unsaveLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project unsaved successfully', result));
};

export const followLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await followLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project followed successfully', result));
};

export const unfollowLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await unfollowLearningProjectById(id, req.auth!.sub);

  res.json(successResponse('Learning project unfollowed successfully', result));
};

export const reviewLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await reviewLearningProjectById(
    id,
    req.auth!.sub,
    req.body as ProjectReviewInput,
  );

  res.json(successResponse('Learning project review saved successfully', result));
};

export const deleteLearningProjectReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await deleteLearningProjectReviewById(id, req.auth!.sub);

  res.json(successResponse('Learning project review deleted successfully', result));
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
