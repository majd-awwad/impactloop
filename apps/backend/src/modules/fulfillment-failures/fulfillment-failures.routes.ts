import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { markSupplierDriverNoShowHandler } from './fulfillment-failures.controller.js';
import {
  deliveryIdParamsSchema,
  markDriverNoShowSchema,
} from './fulfillment-failures.validation.js';

export const supplierDeliveryFailuresRouter = Router();

supplierDeliveryFailuresRouter.post(
  '/:id/driver-no-show',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(deliveryIdParamsSchema, 'params'),
  validate(markDriverNoShowSchema),
  asyncHandler(markSupplierDriverNoShowHandler),
);
