import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  acceptDriverDeliveryHandler,
  createDriverDeliveryLocationPingHandler,
  listActiveDriverDeliveriesHandler,
  listAvailableDriverDeliveriesHandler,
  updateDriverDeliveryStatusHandler,
} from './driver.controller.js';
import {
  markDriverDeliveryFailedHandler,
  markDriverIssueAfterPickupHandler,
  markDriverPickupFailedHandler,
} from '../fulfillment-failures/fulfillment-failures.controller.js';
import {
  createDeliveryLocationPingSchema,
  deliveryIdParamsSchema,
  listAvailableDeliveriesQuerySchema,
  updateDriverDeliveryStatusSchema,
} from './driver.validation.js';
import {
  markDriverDeliveryFailedSchema,
  markDriverIssueAfterPickupSchema,
  markDriverPickupFailedSchema,
} from '../fulfillment-failures/fulfillment-failures.validation.js';

export const driverRouter = Router();

driverRouter.use(authMiddleware, requireRoles('DRIVER'));

driverRouter.get(
  '/deliveries/available',
  validate(listAvailableDeliveriesQuerySchema, 'query'),
  asyncHandler(listAvailableDriverDeliveriesHandler),
);

driverRouter.get(
  '/deliveries/active',
  asyncHandler(listActiveDriverDeliveriesHandler),
);

driverRouter.post(
  '/deliveries/:id/accept',
  validate(deliveryIdParamsSchema, 'params'),
  asyncHandler(acceptDriverDeliveryHandler),
);

driverRouter.patch(
  '/deliveries/:id/status',
  validate(deliveryIdParamsSchema, 'params'),
  validate(updateDriverDeliveryStatusSchema),
  asyncHandler(updateDriverDeliveryStatusHandler),
);

driverRouter.post(
  '/deliveries/:id/location-pings',
  validate(deliveryIdParamsSchema, 'params'),
  validate(createDeliveryLocationPingSchema),
  asyncHandler(createDriverDeliveryLocationPingHandler),
);

driverRouter.post(
  '/deliveries/:id/pickup-failed',
  validate(deliveryIdParamsSchema, 'params'),
  validate(markDriverPickupFailedSchema),
  asyncHandler(markDriverPickupFailedHandler),
);

driverRouter.post(
  '/deliveries/:id/delivery-failed',
  validate(deliveryIdParamsSchema, 'params'),
  validate(markDriverDeliveryFailedSchema),
  asyncHandler(markDriverDeliveryFailedHandler),
);

driverRouter.post(
  '/deliveries/:id/driver-issue',
  validate(deliveryIdParamsSchema, 'params'),
  validate(markDriverIssueAfterPickupSchema),
  asyncHandler(markDriverIssueAfterPickupHandler),
);
