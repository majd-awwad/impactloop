import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  acceptDriverDeliveryHandler,
  confirmDeliveryHandoverCredentialHandler,
  createDriverDeliveryLocationPingHandler,
  getDriverProfileHandler,
  getDriverDeliveryDetailHandler,
  getDriverDeliveryInactiveContextHandler,
  listActiveDriverDeliveriesHandler,
  listAvailableDriverDeliveriesHandler,
  updateDriverDeliveryStatusHandler,
  verifyDeliveryHandoverCredentialHandler,
  verifySupplierPickupHandoverCredentialHandler,
  confirmSupplierPickupHandoverCredentialHandler,
  getDriverHistoricalDeliveryHandler,
  listDriverDeliveryHistoryHandler,
  listDriverIncidentsHandler,
  updateDriverAvailabilityHandler,
  updateDriverProfileHandler,
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
  updateDriverAvailabilitySchema,
  updateDriverDeliveryStatusSchema,
  updateDriverProfileSchema,
  listDriverArchiveQuerySchema,
} from './driver.validation.js';
import {
  markDriverDeliveryFailedSchema,
  markDriverIssueAfterPickupSchema,
  markDriverPickupFailedSchema,
} from '../fulfillment-failures/fulfillment-failures.validation.js';
import { handoverCredentialTokenBodySchema } from '../handover-credentials/handover-credentials.validation.js';

export const driverRouter = Router();

driverRouter.use(authMiddleware, requireRoles('DRIVER'));

driverRouter.get('/profile', asyncHandler(getDriverProfileHandler));

driverRouter.patch(
  '/profile',
  validate(updateDriverProfileSchema),
  asyncHandler(updateDriverProfileHandler),
);

driverRouter.patch(
  '/profile/availability',
  validate(updateDriverAvailabilitySchema),
  asyncHandler(updateDriverAvailabilityHandler),
);

driverRouter.get(
  '/deliveries/available',
  validate(listAvailableDeliveriesQuerySchema, 'query'),
  asyncHandler(listAvailableDriverDeliveriesHandler),
);

driverRouter.get(
  '/deliveries/active',
  asyncHandler(listActiveDriverDeliveriesHandler),
);

driverRouter.get(
  '/deliveries/history',
  validate(listDriverArchiveQuerySchema, 'query'),
  asyncHandler(listDriverDeliveryHistoryHandler),
);

driverRouter.get(
  '/deliveries/history/:id',
  validate(deliveryIdParamsSchema, 'params'),
  asyncHandler(getDriverHistoricalDeliveryHandler),
);

driverRouter.get(
  '/incidents',
  validate(listDriverArchiveQuerySchema, 'query'),
  asyncHandler(listDriverIncidentsHandler),
);

driverRouter.get(
  '/deliveries/:id',
  validate(deliveryIdParamsSchema, 'params'),
  asyncHandler(getDriverDeliveryDetailHandler),
);

driverRouter.get(
  '/deliveries/:id/inactive-context',
  validate(deliveryIdParamsSchema, 'params'),
  asyncHandler(getDriverDeliveryInactiveContextHandler),
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
  '/deliveries/handover/verify',
  validate(handoverCredentialTokenBodySchema),
  asyncHandler(verifyDeliveryHandoverCredentialHandler),
);

driverRouter.post(
  '/deliveries/handover/confirm',
  validate(handoverCredentialTokenBodySchema),
  asyncHandler(confirmDeliveryHandoverCredentialHandler),
);

driverRouter.post(
  '/deliveries/pickup-handover/verify',
  validate(handoverCredentialTokenBodySchema),
  asyncHandler(verifySupplierPickupHandoverCredentialHandler),
);

driverRouter.post(
  '/deliveries/pickup-handover/confirm',
  validate(handoverCredentialTokenBodySchema),
  asyncHandler(confirmSupplierPickupHandoverCredentialHandler),
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
