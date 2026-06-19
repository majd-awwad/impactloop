import { Router } from 'express';

import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getLearningProject,
  listLearningProjects,
} from './learning-projects.controller.js';
import {
  learningProjectIdParamSchema,
  learningProjectsQuerySchema,
} from './learning-projects.validation.js';

export const learningProjectsRouter = Router();

learningProjectsRouter.get(
  '/',
  validate(learningProjectsQuerySchema, 'query'),
  asyncHandler(listLearningProjects),
);

learningProjectsRouter.get(
  '/:id',
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getLearningProject),
);
