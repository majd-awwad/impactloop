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
  getListingPolicyHandler,
  getMaterial,
  getMaterialViewerStateHandler,
  getRelatedMaterialsHandler,
  recordMaterialViewHandler,
  likeMaterial,
  listLikedMaterials,
  listMaterials,
  priceCheckHandler,
  unlikeMaterial,
} from './materials.controller.js';
import { submitMaterialReport } from '../admin-materials/admin-materials.controller.js';
import {
  materialIdParamSchema,
  likedMaterialsQuerySchema,
  materialsQuerySchema,
  relatedMaterialsQuerySchema,
  priceCheckSchema,
} from './materials.validation.js';
import { submitMaterialReportSchema } from '../admin-materials/admin-materials.validation.js';
import { attachCommentRoutes } from '../comments/comments.routes.js';

export const materialsRouter = Router();

materialsRouter.get('/listing-policy', asyncHandler(getListingPolicyHandler));

materialsRouter.post(
  '/price-check',
  authMiddleware,
  validate(priceCheckSchema),
  asyncHandler(priceCheckHandler),
);

materialsRouter.get(
  '/',
  optionalAuthMiddleware,
  validate(materialsQuerySchema, 'query'),
  asyncHandler(listMaterials),
);

materialsRouter.get(
  '/me/liked',
  privateNoStoreMiddleware,
  authMiddleware,
  requireRoles('LEARNER'),
  validate(likedMaterialsQuerySchema, 'query'),
  asyncHandler(listLikedMaterials),
);

materialsRouter.post(
  '/:id/like',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(materialIdParamSchema, 'params'),
  asyncHandler(likeMaterial),
);

materialsRouter.delete(
  '/:id/like',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(materialIdParamSchema, 'params'),
  asyncHandler(unlikeMaterial),
);

materialsRouter.post(
  '/:id/reports',
  authMiddleware,
  validate(materialIdParamSchema, 'params'),
  validate(submitMaterialReportSchema),
  asyncHandler(submitMaterialReport),
);

attachCommentRoutes(materialsRouter);

materialsRouter.get(
  '/:id/viewer-state',
  privateNoStoreMiddleware,
  authMiddleware,
  validate(materialIdParamSchema, 'params'),
  asyncHandler(getMaterialViewerStateHandler),
);

materialsRouter.post(
  '/:id/view',
  optionalAuthMiddleware,
  validate(materialIdParamSchema, 'params'),
  asyncHandler(recordMaterialViewHandler),
);

materialsRouter.get(
  '/:id/related',
  optionalAuthMiddleware,
  validate(materialIdParamSchema, 'params'),
  validate(relatedMaterialsQuerySchema, 'query'),
  asyncHandler(getRelatedMaterialsHandler),
);

materialsRouter.get(
  '/:id',
  optionalAuthMiddleware,
  validate(materialIdParamSchema, 'params'),
  asyncHandler(getMaterial),
);
