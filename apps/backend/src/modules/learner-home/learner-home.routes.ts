import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { getLearnerHomeHandler, getLearnerHomeSectionHandler } from './learner-home.controller.js';

export const learnerHomeRouter = Router();

learnerHomeRouter.get(
  '/home',
  authMiddleware,
  requireRoles('LEARNER'),
  asyncHandler(getLearnerHomeHandler),
);

learnerHomeRouter.get(
  '/home/sections/:sectionKey',
  authMiddleware,
  requireRoles('LEARNER'),
  asyncHandler(getLearnerHomeSectionHandler),
);
