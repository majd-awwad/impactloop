import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler.js';

import { listCategories } from './categories.controller.js';

export const categoriesRouter = Router();

categoriesRouter.get('/', asyncHandler(listCategories));
