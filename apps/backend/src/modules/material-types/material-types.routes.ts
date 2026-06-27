import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  getMaterialTypePriceRule,
  searchMaterialTypesHandler,
} from './material-types.controller.js';
import {
  materialTypeIdParamsSchema,
  searchMaterialTypesQuerySchema,
} from './material-types.validation.js';

export const materialTypesRouter = Router();

materialTypesRouter.get(
  '/',
  validate(searchMaterialTypesQuerySchema, 'query'),
  asyncHandler(searchMaterialTypesHandler),
);

materialTypesRouter.get(
  '/:id/price-rule',
  validate(materialTypeIdParamsSchema, 'params'),
  asyncHandler(getMaterialTypePriceRule),
);
