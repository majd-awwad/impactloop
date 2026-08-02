import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getLearnerMaterialRequestById,
  getLearnerMaterialRequests,
  patchLearnerMaterialRequest,
  postCancelLearnerMaterialRequest,
  postDismissLearnerMaterialRequestMatch,
  postDuplicateLearnerMaterialRequest,
  postFulfillLearnerMaterialRequest,
  postLearnerMaterialRequest,
} from './learner-material-requests.controller.js';
import {
  createLearnerMaterialRequestSchema,
  learnerMaterialRequestIdParamSchema,
  learnerMaterialRequestMatchIdParamSchema,
  listLearnerMaterialRequestsQuerySchema,
  updateLearnerMaterialRequestSchema,
} from './learner-material-requests.validation.js';

export const learnerMaterialRequestsRouter = Router();

learnerMaterialRequestsRouter.post(
  '/',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(createLearnerMaterialRequestSchema),
  asyncHandler(postLearnerMaterialRequest),
);

learnerMaterialRequestsRouter.get(
  '/',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(listLearnerMaterialRequestsQuerySchema, 'query'),
  asyncHandler(getLearnerMaterialRequests),
);

learnerMaterialRequestsRouter.get(
  '/:id',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerMaterialRequestIdParamSchema, 'params'),
  asyncHandler(getLearnerMaterialRequestById),
);

learnerMaterialRequestsRouter.patch(
  '/:id',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerMaterialRequestIdParamSchema, 'params'),
  validate(updateLearnerMaterialRequestSchema),
  asyncHandler(patchLearnerMaterialRequest),
);

learnerMaterialRequestsRouter.post(
  '/:id/cancel',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerMaterialRequestIdParamSchema, 'params'),
  asyncHandler(postCancelLearnerMaterialRequest),
);

learnerMaterialRequestsRouter.post(
  '/:id/fulfill',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerMaterialRequestIdParamSchema, 'params'),
  asyncHandler(postFulfillLearnerMaterialRequest),
);

learnerMaterialRequestsRouter.post(
  '/:id/duplicate',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerMaterialRequestIdParamSchema, 'params'),
  asyncHandler(postDuplicateLearnerMaterialRequest),
);

learnerMaterialRequestsRouter.post(
  '/matches/:matchId/dismiss',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(learnerMaterialRequestMatchIdParamSchema, 'params'),
  asyncHandler(postDismissLearnerMaterialRequestMatch),
);
