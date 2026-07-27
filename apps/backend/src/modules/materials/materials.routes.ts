import { Router } from 'express';

import {
  authMiddleware,
  optionalAuthMiddleware,
  strictOptionalAuthMiddleware,
} from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getListingPolicyHandler,
  getMaterial,
  likeMaterial,
  listMaterials,
  priceCheckHandler,
  unlikeMaterial,
} from './materials.controller.js';
import { submitMaterialReport } from '../admin-materials/admin-materials.controller.js';
import {
  materialIdParamSchema,
  materialsQuerySchema,
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
  '/:id',
  strictOptionalAuthMiddleware,
  validate(materialIdParamSchema, 'params'),
  asyncHandler(getMaterial),
);
