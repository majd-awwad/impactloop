import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getLearnerInterestOptions,
  patchLearnerProfile,
  patchProfile,
} from './profile.controller.js';
import {
  updateLearnerProfileSchema,
  updateProfileSchema,
} from './profile.validation.js';

export const profileRouter = Router();

profileRouter.get(
  '/learner/interests/options',
  asyncHandler(getLearnerInterestOptions),
);

profileRouter.patch(
  '/',
  authMiddleware,
  validate(updateProfileSchema),
  asyncHandler(patchProfile),
);

profileRouter.patch(
  '/learner',
  authMiddleware,
  validate(updateLearnerProfileSchema),
  asyncHandler(patchLearnerProfile),
);
