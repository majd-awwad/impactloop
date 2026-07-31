import { Router } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { privateNoStoreMiddleware } from '../../middlewares/cache-control.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { getLearnerProfileSummaryHandler } from './learner-profile-summary.controller.js';

export const learnerProfileSummaryRouter = Router();

learnerProfileSummaryRouter.get(
  '/profile-summary',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  asyncHandler(getLearnerProfileSummaryHandler),
);
