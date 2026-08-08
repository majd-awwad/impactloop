import { Router } from 'express';
import { privateNoStoreMiddleware } from '../../middlewares/cache-control.middleware.js';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  cancelReservationHandler,
  createReservationHandler,
  createLearnerReservationMessageHandler,
  getMyReservationByIdHandler,
  listLearnerReservationMessagesHandler,
  listMyReservationsHandler,
  quoteReservationHandler,
  reportLearnerSupplierIssueHandler,
  reportNoDriverAvailableHandler,
  requestLearnerPickupRescheduleHandler,
  resolveLearnerConfirmationHandler,
  upsertReservationReviewHandler,
  deleteReservationReviewHandler,
} from './reservations.controller.js';
import {
  createReservationSchema,
  createReservationMessageSchema,
  learnerConfirmationSchema,
  reportNoDriverSchema,
  reportSupplierIssueSchema,
  requestPickupRescheduleSchema,
  reservationIdParamsSchema,
  reservationQuoteSchema,
  reservationReviewSchema,
  reservationReviewTargetParamsSchema,
} from './reservations.validation.js';
import { requestDeliveryForReservationHandler } from '../deliveries/deliveries.controller.js';
import {
  requestDeliverySchema,
} from '../deliveries/deliveries.validation.js';

export const reservationsRouter = Router();
reservationsRouter.use(privateNoStoreMiddleware);

reservationsRouter.get(
  '/my',
  authMiddleware,
  requireRoles('LEARNER'),
  asyncHandler(listMyReservationsHandler),
);

reservationsRouter.get(
  '/:id',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  asyncHandler(getMyReservationByIdHandler),
);

reservationsRouter.post(
  '/quote',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationQuoteSchema),
  asyncHandler(quoteReservationHandler),
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

reservationsRouter.patch(
  '/:id/learner-confirmation',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(learnerConfirmationSchema),
  asyncHandler(resolveLearnerConfirmationHandler),
);

reservationsRouter.get(
  '/:id/messages',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  asyncHandler(listLearnerReservationMessagesHandler),
);

reservationsRouter.post(
  '/:id/messages',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(createReservationMessageSchema),
  asyncHandler(createLearnerReservationMessageHandler),
);

reservationsRouter.post(
  '/:id/request-reschedule',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(requestPickupRescheduleSchema),
  asyncHandler(requestLearnerPickupRescheduleHandler),
);

reservationsRouter.post(
  '/:id/report-supplier-issue',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(reportSupplierIssueSchema),
  asyncHandler(reportLearnerSupplierIssueHandler),
);

reservationsRouter.post(
  '/:id/report-no-driver',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(reportNoDriverSchema),
  asyncHandler(reportNoDriverAvailableHandler),
);

reservationsRouter.post(
  '/:id/delivery',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(requestDeliverySchema),
  asyncHandler(requestDeliveryForReservationHandler),
);

reservationsRouter.put(
  '/:id/review',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationIdParamsSchema, 'params'),
  validate(reservationReviewSchema),
  asyncHandler(upsertReservationReviewHandler),
);

reservationsRouter.delete(
  '/:id/review/:targetType',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationReviewTargetParamsSchema, 'params'),
  asyncHandler(deleteReservationReviewHandler),
);
