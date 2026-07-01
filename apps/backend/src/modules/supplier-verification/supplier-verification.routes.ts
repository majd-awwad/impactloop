import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getSupplierVerificationStatusHandler,
  resubmitSupplierVerificationHandler,
  submitSupplierVerificationHandler,
} from './supplier-verification.controller.js';
import {
  resubmitSupplierVerificationSchema,
  submitSupplierVerificationSchema,
} from './supplier-verification.validation.js';

export const supplierVerificationRouter = Router();

supplierVerificationRouter.get(
  '/status',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(getSupplierVerificationStatusHandler),
);

supplierVerificationRouter.post(
  '/submit',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(submitSupplierVerificationSchema),
  asyncHandler(submitSupplierVerificationHandler),
);

supplierVerificationRouter.post(
  '/resubmit',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(resubmitSupplierVerificationSchema),
  asyncHandler(resubmitSupplierVerificationHandler),
);
