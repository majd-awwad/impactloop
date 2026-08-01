import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getSupplierMaterialRequestById,
  getSupplierMaterialRequestCandidateMaterials,
  getSupplierMaterialRequests,
  postSupplierMaterialRequestSuggestion,
} from './supplier-material-requests.controller.js';
import {
  listSupplierMaterialRequestsQuerySchema,
  suggestMaterialForRequestSchema,
  supplierCandidateMaterialsQuerySchema,
  supplierMaterialRequestIdParamSchema,
} from './supplier-material-requests.validation.js';

export const supplierMaterialRequestsRouter = Router();

supplierMaterialRequestsRouter.get(
  '/',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(listSupplierMaterialRequestsQuerySchema, 'query'),
  asyncHandler(getSupplierMaterialRequests),
);

supplierMaterialRequestsRouter.get(
  '/:id',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialRequestIdParamSchema, 'params'),
  asyncHandler(getSupplierMaterialRequestById),
);

supplierMaterialRequestsRouter.get(
  '/:id/candidate-materials',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialRequestIdParamSchema, 'params'),
  validate(supplierCandidateMaterialsQuerySchema, 'query'),
  asyncHandler(getSupplierMaterialRequestCandidateMaterials),
);

supplierMaterialRequestsRouter.post(
  '/:id/suggestions',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierMaterialRequestIdParamSchema, 'params'),
  validate(suggestMaterialForRequestSchema),
  asyncHandler(postSupplierMaterialRequestSuggestion),
);
