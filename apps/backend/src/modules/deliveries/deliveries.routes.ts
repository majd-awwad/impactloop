import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getMyDeliveryHandler,
  listMyDeliveriesHandler,
} from './deliveries.controller.js';
import { deliveryIdParamsSchema } from './deliveries.validation.js';

export const deliveriesRouter = Router();

deliveriesRouter.get(
  '/my',
  authMiddleware,
  requireRoles('LEARNER'),
  asyncHandler(listMyDeliveriesHandler),
);

deliveriesRouter.get(
  '/:id',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(deliveryIdParamsSchema, 'params'),
  asyncHandler(getMyDeliveryHandler),
);
