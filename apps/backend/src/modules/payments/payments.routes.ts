import { Router } from 'express';

import { env } from '../../config/env.js';
import { asyncHandler } from '../../utils/async-handler.js';
import {
  authMiddleware,
  optionalAuthMiddleware,
} from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  cancelPaymentAttemptHandler,
  getCheckoutSessionHandler,
  getPaymentOrderHandler,
  getReservationCheckoutSessionHandler,
  getReservationPaymentRequirementHandler,
  mockCheckoutActHandler,
  mockWebhookHandler,
  reconcileExpiredCheckoutSessionsHandler,
  startPaymentCheckoutHandler,
  startReservationCheckoutHandler,
  cancelReservationCheckoutHandler,
} from './payments.controller.js';
import {
  mockCheckoutActSchema,
  paymentCancelAttemptSchema,
  paymentCheckoutSchema,
  reservationCheckoutCancelSchema,
} from './payments.validation.js';

export const paymentsRouter = Router();

paymentsRouter.get(
  '/orders/:id',
  authMiddleware,
  requireRoles('LEARNER', 'ADMIN'),
  asyncHandler(getPaymentOrderHandler),
);

paymentsRouter.get(
  '/reservations/:reservationId/requirement',
  authMiddleware,
  requireRoles('LEARNER', 'ADMIN'),
  asyncHandler(getReservationPaymentRequirementHandler),
);

paymentsRouter.get(
  '/reservations/:reservationId/checkout-session',
  authMiddleware,
  requireRoles('LEARNER', 'ADMIN'),
  asyncHandler(getReservationCheckoutSessionHandler),
);

paymentsRouter.post(
  '/reservations/:reservationId/checkout',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(paymentCheckoutSchema),
  asyncHandler(startReservationCheckoutHandler),
);

paymentsRouter.post(
  '/checkout-sessions/reconcile-expired',
  authMiddleware,
  requireRoles('LEARNER', 'ADMIN'),
  asyncHandler(reconcileExpiredCheckoutSessionsHandler),
);

paymentsRouter.get(
  '/checkout-sessions/:id',
  authMiddleware,
  requireRoles('LEARNER', 'ADMIN'),
  asyncHandler(getCheckoutSessionHandler),
);

paymentsRouter.post(
  '/checkout-sessions/:id/cancel-attempt',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationCheckoutCancelSchema),
  asyncHandler(cancelReservationCheckoutHandler),
);

paymentsRouter.post(
  '/orders/:id/checkout',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(paymentCheckoutSchema),
  asyncHandler(startPaymentCheckoutHandler),
);

paymentsRouter.post(
  '/orders/:id/cancel-attempt',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(paymentCancelAttemptSchema),
  asyncHandler(cancelPaymentAttemptHandler),
);

// PAY-01A: public refund route removed. Internal refund service remains for
// tests and will be connected to lifecycle rules in PAY-03.

if (env.paymentMockRoutesEnabled) {
  paymentsRouter.post(
    '/mock/checkout/:attemptId/act',
    optionalAuthMiddleware,
    validate(mockCheckoutActSchema),
    asyncHandler(mockCheckoutActHandler),
  );
}

/** Mounted from app.ts with express.raw for HMAC verification when Mock is enabled. */
export const paymentsMockWebhookRouter = Router();
if (env.paymentMockRoutesEnabled) {
  paymentsMockWebhookRouter.post('/', asyncHandler(mockWebhookHandler));
}
