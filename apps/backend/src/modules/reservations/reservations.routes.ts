import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  cancelReservationHandler,
  createReservationHandler,
  listMyReservationsHandler,
} from './reservations.controller.js';
import {
  createReservationSchema,
  reservationIdParamsSchema,
} from './reservations.validation.js';
import { requestDeliveryForReservationHandler } from '../deliveries/deliveries.controller.js';
import {
  requestDeliverySchema,
} from '../deliveries/deliveries.validation.js';

export const reservationsRouter = Router();

reservationsRouter.get(
  '/my',
  authMiddleware,
  requireRoles('LEARNER'),
  asyncHandler(listMyReservationsHandler),
);

reservationsRouter.post(
  '/',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(createReservationSchema),
  asyncHandler(createReservationHandler),
);

reservationsRouter.patch(
  '/:id/cancel',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  asyncHandler(cancelReservationHandler),
);

reservationsRouter.post(
  '/:id/delivery',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(requestDeliverySchema),
  asyncHandler(requestDeliveryForReservationHandler),
);
