import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { uploadMaterialImagesHandler } from './uploads.controller.js';
import { materialImagesUpload } from './uploads.middleware.js';

export const uploadsRouter = Router();

uploadsRouter.post(
  '/material-images',
  authMiddleware,
  requireRoles('SUPPLIER'),
  materialImagesUpload,
  asyncHandler(uploadMaterialImagesHandler),
);
