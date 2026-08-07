import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { privateNoStoreMiddleware } from '../../middlewares/cache-control.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { learningProjectIdParamSchema } from '../learning-projects/learning-projects.validation.js';

import {
  getAuthorHelpSessionSettingsHandler,
  getProjectHelpSessionAvailabilityHandler,
  updateAuthorHelpSessionSettingsHandler,
} from './project-help-session.controller.js';
import { updateProjectHelpSessionSettingsSchema } from './project-help-session.validation.js';

export const projectHelpSessionAvailabilityRouter = Router({ mergeParams: true });

projectHelpSessionAvailabilityRouter.get(
  '/availability',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getProjectHelpSessionAvailabilityHandler),
);

export const projectHelpSessionAuthorRouter = Router({ mergeParams: true });

projectHelpSessionAuthorRouter.get(
  '/settings',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  asyncHandler(getAuthorHelpSessionSettingsHandler),
);

projectHelpSessionAuthorRouter.put(
  '/settings',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learningProjectIdParamSchema, 'params'),
  validate(updateProjectHelpSessionSettingsSchema),
  asyncHandler(updateAuthorHelpSessionSettingsHandler),
);
