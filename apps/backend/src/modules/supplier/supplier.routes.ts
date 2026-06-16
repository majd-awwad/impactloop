import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { getDashboard, getProfile, patchProfile } from './supplier.controller.js';
import { updateSupplierProfileSchema } from './supplier.validation.js';

export const supplierRouter = Router();

supplierRouter.get(
  '/dashboard',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(getDashboard),
);

supplierRouter.get(
  '/profile',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(getProfile),
);

supplierRouter.patch(
  '/profile',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(updateSupplierProfileSchema),
  asyncHandler(patchProfile),
);
