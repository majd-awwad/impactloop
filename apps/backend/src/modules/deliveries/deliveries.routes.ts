import { Router } from 'express';
import { privateNoStoreMiddleware } from '../../middlewares/cache-control.middleware.js';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getLearnerDeliveryTrackingHandler,
  getMyDeliveryHandler,
  listMyDeliveriesHandler,
} from './deliveries.controller.js';
import { deliveryIdParamsSchema } from './deliveries.validation.js';
import { issueDeliveryHandoverCredentialHandler } from '../delivery-handover-credentials/delivery-handover-credentials.controller.js';

export const deliveriesRouter = Router();
deliveriesRouter.use(privateNoStoreMiddleware);

deliveriesRouter.get(
  '/my',
  authMiddleware,
  requireRoles('LEARNER'),
  asyncHandler(listMyDeliveriesHandler),
);

deliveriesRouter.get(
  '/:id/tracking',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(deliveryIdParamsSchema, 'params'),
  asyncHandler(getLearnerDeliveryTrackingHandler),
);

deliveriesRouter.get(
  '/:id',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(deliveryIdParamsSchema, 'params'),
  asyncHandler(getMyDeliveryHandler),
);

deliveriesRouter.post(
  '/:id/handover-credential',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(deliveryIdParamsSchema, 'params'),
  asyncHandler(issueDeliveryHandoverCredentialHandler),
);
