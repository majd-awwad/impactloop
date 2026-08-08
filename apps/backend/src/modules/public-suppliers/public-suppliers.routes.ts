import { Router } from 'express';

import {
  authMiddleware,
  optionalAuthMiddleware,
} from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { privateNoStoreMiddleware } from '../../middlewares/cache-control.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  followSupplier,
  getPublicSupplier,
  getPublicSupplierViewerState,
  listPublicSupplierMaterials,
  unfollowSupplier,
} from './public-suppliers.controller.js';
import {
  publicSupplierMaterialsQuerySchema,
  supplierProfileIdParamSchema,
} from './public-suppliers.validation.js';

export const publicSuppliersRouter = Router();

publicSuppliersRouter.get(
  '/:supplierProfileId',
  optionalAuthMiddleware,
  validate(supplierProfileIdParamSchema, 'params'),
  asyncHandler(getPublicSupplier),
);

publicSuppliersRouter.get(
  '/:supplierProfileId/materials',
  optionalAuthMiddleware,
  validate(supplierProfileIdParamSchema, 'params'),
  validate(publicSupplierMaterialsQuerySchema, 'query'),
  asyncHandler(listPublicSupplierMaterials),
);

publicSuppliersRouter.get(
  '/:supplierProfileId/viewer-state',
  privateNoStoreMiddleware,
  authMiddleware,
  validate(supplierProfileIdParamSchema, 'params'),
  asyncHandler(getPublicSupplierViewerState),
);

publicSuppliersRouter.post(
  '/:supplierProfileId/follow',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(supplierProfileIdParamSchema, 'params'),
  asyncHandler(followSupplier),
);

publicSuppliersRouter.delete(
  '/:supplierProfileId/follow',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(supplierProfileIdParamSchema, 'params'),
  asyncHandler(unfollowSupplier),
);
