import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  createCategoryRequestHandler,
  getCategoryRequestDraftHandler,
  listCategoryRequestsHandler,
} from './category-requests.controller.js';
import { createCategoryRequestSchema } from './category-requests.validation.js';

export const categoryRequestsRouter = Router();

categoryRequestsRouter.post(
  '/',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(createCategoryRequestSchema),
  asyncHandler(createCategoryRequestHandler),
);

categoryRequestsRouter.get(
  '/',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(listCategoryRequestsHandler),
);

categoryRequestsRouter.get(
  '/:id/draft',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(getCategoryRequestDraftHandler),
);
