import { Router } from 'express';

import {
  authMiddleware,
  optionalAuthMiddleware,
} from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  followLearningProject,
  getLearningProject,
  likeLearningProject,
  listLearningProjects,
  saveLearningProject,
  submitLearningProject,
  unlikeLearningProject,
  unfollowLearningProject,
  unsaveLearningProject,
} from './learning-projects.controller.js';
import {
  learningProjectIdParamSchema,
  learningProjectsQuerySchema,
  submitLearningProjectSchema,
} from './learning-projects.validation.js';

export const learningProjectsRouter = Router();

learningProjectsRouter.get(
  '/',
  optionalAuthMiddleware,
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

learningProjectsRouter.post(
  '/:id/like',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(likeLearningProject),
);

learningProjectsRouter.delete(
  '/:id/like',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(unlikeLearningProject),
);

learningProjectsRouter.post(
  '/:id/save',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(saveLearningProject),
);

learningProjectsRouter.delete(
  '/:id/save',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(unsaveLearningProject),
);

learningProjectsRouter.post(
  '/:id/follow',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(followLearningProject),
);

learningProjectsRouter.delete(
  '/:id/follow',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(unfollowLearningProject),
);

learningProjectsRouter.get(
  '/:id',
  optionalAuthMiddleware,
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getLearningProject),
);
