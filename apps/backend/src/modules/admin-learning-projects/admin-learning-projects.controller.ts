import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  approveAdminLearningProject,
  archiveAdminLearningProject,
  getAdminLearningProjectById,
  hideAdminLearningProject,
  listAdminLearningProjects,
  rejectAdminLearningProject,
  requestChangesAdminLearningProject,
  restoreAdminLearningProject,
} from './admin-learning-projects.service.js';
import type {
  AdminLearningProjectIdParams,
  AdminLearningProjectsListQuery,
  ModerationReasonInput,
} from './admin-learning-projects.validation.js';

export const listAdminLearningProjectsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminLearningProjectsListQuery>(req);
  const result = await listAdminLearningProjects(query);
  res.json(successResponse('Admin learning projects loaded', result));
};

export const getAdminLearningProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminLearningProjectIdParams>(req);
  const result = await getAdminLearningProjectById(id);
  res.json(successResponse('Admin learning project loaded', result));
};

export const approveAdminLearningProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminLearningProjectIdParams>(req);
  const actorUserId = req.auth!.sub;
  const result = await approveAdminLearningProject(actorUserId, id);
  res.json(successResponse('Learning project approved', result));
};

export const requestChangesAdminLearningProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminLearningProjectIdParams>(req);
  const body = req.body as ModerationReasonInput;
  const actorUserId = req.auth!.sub;
  const result = await requestChangesAdminLearningProject(actorUserId, id, body);
  res.json(successResponse('Changes requested', result));
};

export const rejectAdminLearningProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminLearningProjectIdParams>(req);
  const body = req.body as ModerationReasonInput;
  const actorUserId = req.auth!.sub;
  const result = await rejectAdminLearningProject(actorUserId, id, body);
  res.json(successResponse('Learning project rejected', result));
};

export const hideAdminLearningProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminLearningProjectIdParams>(req);
  const body = req.body as ModerationReasonInput;
  const actorUserId = req.auth!.sub;
  const result = await hideAdminLearningProject(actorUserId, id, body);
  res.json(successResponse('Learning project hidden', result));
};

export const restoreAdminLearningProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminLearningProjectIdParams>(req);
  const actorUserId = req.auth!.sub;
  const result = await restoreAdminLearningProject(actorUserId, id);
  res.json(successResponse('Learning project restored', result));
};

export const archiveAdminLearningProjectHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminLearningProjectIdParams>(req);
  const body = req.body as ModerationReasonInput;
  const actorUserId = req.auth!.sub;
  const result = await archiveAdminLearningProject(actorUserId, id, body);
  res.json(successResponse('Learning project archived', result));
};
