import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  uploadMaterialImagesHandler,
  uploadSupplierVerificationDocumentHandler,
} from './uploads.controller.js';
import { materialImagesUpload } from './uploads.middleware.js';
import { supplierVerificationDocumentUpload } from './verification-uploads.middleware.js';

export const uploadsRouter = Router();

uploadsRouter.post(
  '/material-images',
  authMiddleware,
  requireRoles('SUPPLIER'),
  materialImagesUpload,
  asyncHandler(uploadMaterialImagesHandler),
);

uploadsRouter.post(
  '/supplier-verification-document',
  authMiddleware,
  requireRoles('SUPPLIER'),
  supplierVerificationDocumentUpload,
  asyncHandler(uploadSupplierVerificationDocumentHandler),
);
