import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { getDashboard } from './supplier.controller.js';

export const supplierRouter = Router();

supplierRouter.get(
  '/dashboard',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(getDashboard),
);
