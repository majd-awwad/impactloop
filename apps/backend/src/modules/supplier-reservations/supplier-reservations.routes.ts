import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  acceptSupplierReservationHandler,
  declineSupplierReservationHandler,
  listSupplierReservationsHandler,
} from './supplier-reservations.controller.js';
import {
  acceptSupplierReservationSchema,
  declineSupplierReservationSchema,
  listSupplierReservationsQuerySchema,
  reservationIdParamsSchema,
} from './supplier-reservations.validation.js';

export const supplierReservationsRouter = Router();

supplierReservationsRouter.get(
  '/',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(listSupplierReservationsQuerySchema, 'query'),
  asyncHandler(listSupplierReservationsHandler),
);

supplierReservationsRouter.patch(
  '/:id/accept',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(acceptSupplierReservationSchema),
  asyncHandler(acceptSupplierReservationHandler),
);

supplierReservationsRouter.patch(
  '/:id/decline',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(declineSupplierReservationSchema),
  asyncHandler(declineSupplierReservationHandler),
);
