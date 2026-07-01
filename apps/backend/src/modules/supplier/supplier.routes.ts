import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  deleteMaterial,
  getDashboard,
  getMaterial,
  getMaterials,
  getProfile,
  getProfileFollowers,
  patchMaterial,
  patchProfile,
  patchProfileImages,
  postMaterial,
} from './supplier.controller.js';
import {
  createSupplierMaterialSchema,
  supplierMaterialIdParamSchema,
  supplierFollowersQuerySchema,
  supplierMaterialsQuerySchema,
  updateSupplierMaterialSchema,
  updateSupplierProfileSchema,
  updateSupplierProfileImagesSchema,
} from './supplier.validation.js';
import { categoryRequestsRouter } from '../category-requests/category-requests.routes.js';
import { supplierPriceRuleRequestsRouter } from '../price-rule-requests/price-rule-requests.supplier.routes.js';
import { supplierNotificationsRouter } from '../supplier-notifications/supplier-notifications.routes.js';
import { supplierReservationsRouter } from '../supplier-reservations/supplier-reservations.routes.js';
import { supplierVerificationRouter } from '../supplier-verification/supplier-verification.routes.js';

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

supplierRouter.patch(
  '/profile/images',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(updateSupplierProfileImagesSchema),
  asyncHandler(patchProfileImages),
);

supplierRouter.get(
  '/profile/followers',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierFollowersQuerySchema, 'query'),
  asyncHandler(getProfileFollowers),
);

supplierRouter.get(
  '/materials',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialsQuerySchema, 'query'),
  asyncHandler(getMaterials),
);

supplierRouter.post(
  '/materials',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(createSupplierMaterialSchema),
  asyncHandler(postMaterial),
);

supplierRouter.get(
  '/materials/:id',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialIdParamSchema, 'params'),
  asyncHandler(getMaterial),
);

supplierRouter.patch(
  '/materials/:id',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialIdParamSchema, 'params'),
  validate(updateSupplierMaterialSchema),
  asyncHandler(patchMaterial),
);

supplierRouter.delete(
  '/materials/:id',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialIdParamSchema, 'params'),
  asyncHandler(deleteMaterial),
);

supplierRouter.use('/category-requests', categoryRequestsRouter);
supplierRouter.use('/price-rule-requests', supplierPriceRuleRequestsRouter);
supplierRouter.use('/notifications', supplierNotificationsRouter);
supplierRouter.use('/reservations', supplierReservationsRouter);
supplierRouter.use('/verification', supplierVerificationRouter);
