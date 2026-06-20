import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getListingPolicyHandler,
  getMaterial,
  listMaterials,
  priceCheckHandler,
} from './materials.controller.js';
import {
  materialIdParamSchema,
  materialsQuerySchema,
  priceCheckSchema,
} from './materials.validation.js';

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
  validate(materialsQuerySchema, 'query'),
  asyncHandler(listMaterials),
);

materialsRouter.get(
  '/:id',
  validate(materialIdParamSchema, 'params'),
  asyncHandler(getMaterial),
);
