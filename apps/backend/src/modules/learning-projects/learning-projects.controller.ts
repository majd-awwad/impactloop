import type { Request, Response } from 'express';

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
    req.query as unknown as LearningProjectsQuery,
  );

  res.json(successResponse('Learning projects fetched successfully', projects));
};

export const getLearningProject = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as unknown as { id: string };
  const project = await getLearningProjectById(id);

  res.json(successResponse('Learning project fetched successfully', project));
};
