import { Router } from 'express';

import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { getMaterial, listMaterials } from './materials.controller.js';
import {
  materialIdParamSchema,
  materialsQuerySchema,
} from './materials.validation.js';

export const materialsRouter = Router();

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
