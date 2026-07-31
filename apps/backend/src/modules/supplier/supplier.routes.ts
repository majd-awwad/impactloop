import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  deleteMaterial,
  getCategoryDemand,
  getDashboard,
  getMaterial,
  getMaterialRelatedProjects,
  getMaterials,
  getProfile,
  getProfileManagement,
  getProfileFollowers,
  markMaterialUnavailable,
  patchMaterial,
  patchProfile,
  patchProfileImages,
  postMaterial,
  restoreMaterialAvailable,
} from './supplier.controller.js';
import {
  createSupplierMaterialSchema,
  supplierCategoryDemandQuerySchema,
  supplierMaterialIdParamSchema,
  supplierFollowersQuerySchema,
  supplierMaterialsQuerySchema,
  supplierRelatedProjectsQuerySchema,
  updateSupplierMaterialSchema,
  updateSupplierProfileSchema,
  updateSupplierProfileImagesSchema,
} from './supplier.validation.js';
import { categoryRequestsRouter } from '../category-requests/category-requests.routes.js';
import { supplierPriceRuleRequestsRouter } from '../price-rule-requests/price-rule-requests.supplier.routes.js';
import { supplierNotificationsRouter } from '../supplier-notifications/supplier-notifications.routes.js';
import { supplierReservationsRouter } from '../supplier-reservations/supplier-reservations.routes.js';
import { supplierVerificationRouter } from '../supplier-verification/supplier-verification.routes.js';
import { supplierDeliveryFailuresRouter } from '../fulfillment-failures/fulfillment-failures.routes.js';

export const supplierRouter = Router();

supplierRouter.get(
  '/dashboard',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(getDashboard),
);

supplierRouter.get(
  '/insights/category-demand',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierCategoryDemandQuerySchema, 'query'),
  asyncHandler(getCategoryDemand),
);

supplierRouter.get(
  '/profile/manage',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(getProfileManagement),
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

supplierRouter.get(
  '/materials/:id/related-projects',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialIdParamSchema, 'params'),
  validate(supplierRelatedProjectsQuerySchema, 'query'),
  asyncHandler(getMaterialRelatedProjects),
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

supplierRouter.post(
  '/materials/:id/mark-unavailable',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialIdParamSchema, 'params'),
  asyncHandler(markMaterialUnavailable),
);

supplierRouter.post(
  '/materials/:id/restore-available',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialIdParamSchema, 'params'),
  asyncHandler(restoreMaterialAvailable),
);

supplierRouter.use('/category-requests', categoryRequestsRouter);
supplierRouter.use('/price-rule-requests', supplierPriceRuleRequestsRouter);
supplierRouter.use('/notifications', supplierNotificationsRouter);
supplierRouter.use('/reservations', supplierReservationsRouter);
supplierRouter.use('/deliveries', supplierDeliveryFailuresRouter);
supplierRouter.use('/verification', supplierVerificationRouter);
