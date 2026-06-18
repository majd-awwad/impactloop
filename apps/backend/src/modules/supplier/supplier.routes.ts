import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getDashboard,
  getProfile,
  patchProfile,
  postMaterial,
} from './supplier.controller.js';
import {
  createSupplierMaterialSchema,
  updateSupplierProfileSchema,
} from './supplier.validation.js';
import { categoryRequestsRouter } from '../category-requests/category-requests.routes.js';
import { supplierReservationsRouter } from '../supplier-reservations/supplier-reservations.routes.js';

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

supplierRouter.post(
  '/materials',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(createSupplierMaterialSchema),
  asyncHandler(postMaterial),
);

supplierRouter.use('/category-requests', categoryRequestsRouter);
supplierRouter.use('/reservations', supplierReservationsRouter);
