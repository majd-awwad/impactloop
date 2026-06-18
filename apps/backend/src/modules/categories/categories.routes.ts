import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler.js';

import { getCategories } from './categories.controller.js';

export const categoriesRouter = Router();

categoriesRouter.get('/', asyncHandler(getCategories));
