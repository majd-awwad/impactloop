import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  acceptSupplierReservationHandler,
  cancelSupplierAcceptedReservationHandler,
  completeSupplierReservationHandler,
  createSupplierReservationMessageHandler,
  declineSupplierReservationHandler,
  listSupplierReservationMessagesHandler,
  listSupplierReservationsHandler,
  rescheduleSupplierReservationHandler,
  submitSupplierNoShowReportHandler,
} from './supplier-reservations.controller.js';
import {
  acceptSupplierReservationSchema,
  cancelSupplierReservationSchema,
  createReservationMessageSchema,
  declineSupplierReservationSchema,
  listSupplierReservationsQuerySchema,
  rescheduleSupplierReservationSchema,
  reservationIdParamsSchema,
  submitNoShowReportSchema,
} from './supplier-reservations.validation.js';

export const supplierReservationsRouter = Router();

supplierReservationsRouter.get(
  '/',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(listSupplierReservationsQuerySchema, 'query'),
  asyncHandler(listSupplierReservationsHandler),
);

supplierReservationsRouter.get(
  '/:id/messages',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(reservationIdParamsSchema, 'params'),
  asyncHandler(listSupplierReservationMessagesHandler),
);

supplierReservationsRouter.post(
  '/:id/messages',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(createReservationMessageSchema),
  asyncHandler(createSupplierReservationMessageHandler),
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

supplierReservationsRouter.patch(
  '/:id/complete',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(reservationIdParamsSchema, 'params'),
  asyncHandler(completeSupplierReservationHandler),
);

supplierReservationsRouter.patch(
  '/:id/reschedule',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(rescheduleSupplierReservationSchema),
  asyncHandler(rescheduleSupplierReservationHandler),
);

supplierReservationsRouter.patch(
  '/:id/cancel',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(cancelSupplierReservationSchema),
  asyncHandler(cancelSupplierAcceptedReservationHandler),
);

supplierReservationsRouter.post(
  '/:id/no-show-report',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(submitNoShowReportSchema),
  asyncHandler(submitSupplierNoShowReportHandler),
);
