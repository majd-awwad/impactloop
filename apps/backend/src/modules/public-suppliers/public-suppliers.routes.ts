import { Router } from 'express';
import { z } from 'zod';

import {
  authMiddleware,
  optionalAuthMiddleware,
} from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { privateNoStoreMiddleware } from '../../middlewares/cache-control.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { materialsQuerySchema } from '../materials/materials.validation.js';
import { paginationQuerySchema } from '../../utils/zod-helpers.js';

import {
  followSupplier,
  getPublicSupplier,
  getPublicSupplierViewerState,
  listPublicSupplierMaterials,
  unfollowSupplier,
} from './public-suppliers.controller.js';

export const supplierProfileIdParamSchema = z.object({
  supplierProfileId: z.string().trim().min(1),
});

export type SupplierProfileIdParams = z.infer<
  typeof supplierProfileIdParamSchema
>;

export const publicSupplierMaterialsQuerySchema = paginationQuerySchema;

export type PublicSupplierMaterialsQuery = z.infer<
  typeof publicSupplierMaterialsQuerySchema
>;

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
