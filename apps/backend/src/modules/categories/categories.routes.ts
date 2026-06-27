import { Router } from 'express';

import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { listCategories } from './categories.controller.js';
import { categoriesQuerySchema } from './categories.validation.js';

export const categoriesRouter = Router();

categoriesRouter.get(
  '/',
  validate(categoriesQuerySchema, 'query'),
  asyncHandler(listCategories),
);
