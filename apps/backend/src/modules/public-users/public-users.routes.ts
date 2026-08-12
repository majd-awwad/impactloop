import { Router } from 'express';

import { optionalAuthMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  getPublicUserProfileHandler,
  getPublicUserProjectsHandler,
} from './public-users.controller.js';
import {
  publicUserIdParamSchema,
  publicUserProjectsQuerySchema,
} from './public-users.validation.js';

export const publicUsersRouter = Router();

publicUsersRouter.get(
  '/:userId',
  optionalAuthMiddleware,
  validate(publicUserIdParamSchema, 'params'),
  asyncHandler(getPublicUserProfileHandler),
);

publicUsersRouter.get(
  '/:userId/projects',
  optionalAuthMiddleware,
  validate(publicUserIdParamSchema, 'params'),
  validate(publicUserProjectsQuerySchema, 'query'),
  asyncHandler(getPublicUserProjectsHandler),
);
