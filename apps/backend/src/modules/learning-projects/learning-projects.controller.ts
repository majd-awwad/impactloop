import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  getLearningProjectById,
  getLearningProjects,
} from './learning-projects.service.js';
import type { LearningProjectsQuery } from './learning-projects.validation.js';

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
