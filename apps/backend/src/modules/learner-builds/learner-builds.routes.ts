import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { privateNoStoreMiddleware } from '../../middlewares/cache-control.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { buildCompletionPhotoUploadMiddleware } from './build-completion-uploads.middleware.js';
import {
  archiveLearnerBuildHandler,
  deleteCompletionPhotoHandler,
  getCompletionStoryHandler,
  getLearnerBuildHandler,
  getLearnerPortfolioHandler,
  listLearnerBuildsHandler,
  pauseLearnerBuildHandler,
  resumeLearnerBuildHandler,
  updateCompletionStoryHandler,
  uploadCompletionPhotoHandler,
} from './learner-builds.controller.js';
import {
  completionPhotoCaptionSchema,
  learnerBuildIdParamSchema,
  learnerBuildPhotoIdParamSchema,
  listLearnerBuildsQuerySchema,
  updateCompletionStorySchema,
} from './learner-builds.validation.js';

export const learnerBuildsRouter = Router();

learnerBuildsRouter.get(
  '/builds',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(listLearnerBuildsQuerySchema, 'query'),
  asyncHandler(listLearnerBuildsHandler),
);

learnerBuildsRouter.get(
  '/portfolio',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(listLearnerBuildsQuerySchema, 'query'),
  asyncHandler(getLearnerPortfolioHandler),
);

learnerBuildsRouter.get(
  '/builds/:buildId',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerBuildIdParamSchema, 'params'),
  asyncHandler(getLearnerBuildHandler),
);

learnerBuildsRouter.post(
  '/builds/:buildId/pause',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerBuildIdParamSchema, 'params'),
  asyncHandler(pauseLearnerBuildHandler),
);

learnerBuildsRouter.post(
  '/builds/:buildId/resume',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerBuildIdParamSchema, 'params'),
  asyncHandler(resumeLearnerBuildHandler),
);

learnerBuildsRouter.post(
  '/builds/:buildId/archive',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerBuildIdParamSchema, 'params'),
  asyncHandler(archiveLearnerBuildHandler),
);

learnerBuildsRouter.get(
  '/builds/:buildId/completion-story',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerBuildIdParamSchema, 'params'),
  asyncHandler(getCompletionStoryHandler),
);

learnerBuildsRouter.patch(
  '/builds/:buildId/completion-story',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerBuildIdParamSchema, 'params'),
  validate(updateCompletionStorySchema),
  asyncHandler(updateCompletionStoryHandler),
);

learnerBuildsRouter.post(
  '/builds/:buildId/completion-story/photos',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerBuildIdParamSchema, 'params'),
  buildCompletionPhotoUploadMiddleware,
  validate(completionPhotoCaptionSchema),
  asyncHandler(uploadCompletionPhotoHandler),
);

learnerBuildsRouter.delete(
  '/builds/:buildId/completion-story/photos/:photoId',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerBuildPhotoIdParamSchema, 'params'),
  asyncHandler(deleteCompletionPhotoHandler),
);
