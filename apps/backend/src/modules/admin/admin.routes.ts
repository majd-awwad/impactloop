import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { getAdminDashboard } from './admin.controller.js';

export const adminRouter = Router();

adminRouter.get(
  '/dashboard',
  authMiddleware,
  requireRoles('ADMIN'),
  asyncHandler(getAdminDashboard),
);

