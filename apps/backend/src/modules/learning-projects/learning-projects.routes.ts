import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getLearningProject,
  listLearningProjects,
  submitLearningProject,
} from './learning-projects.controller.js';
import {
  learningProjectIdParamSchema,
  learningProjectsQuerySchema,
  submitLearningProjectSchema,
} from './learning-projects.validation.js';

export const learningProjectsRouter = Router();

learningProjectsRouter.get(
  '/',
  validate(learningProjectsQuerySchema, 'query'),
  asyncHandler(listLearningProjects),
);

learningProjectsRouter.post(
  '/submit',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(submitLearningProjectSchema),
  asyncHandler(submitLearningProject),
);

learningProjectsRouter.get(
  '/:id',
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getLearningProject),
);
