import { Router } from 'express';

import { env } from '../../config/env.js';import { asyncHandler } from '../../utils/async-handler.js';
import {
  authMiddleware,
  optionalAuthMiddleware,
} from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  cancelPaymentAttemptHandler,
  getCheckoutSessionHandler,
  getReservationCheckoutSessionHandler,
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

/**
 * Dormant card/electronic checkout routes — retained for future reactivation.
 * Mounted from app.ts only when isCardCheckoutProductEnabled() is true.
 */
export const paymentsCheckoutRouter = Router();

paymentsCheckoutRouter.get(  '/reservations/:reservationId/checkout-session',
  authMiddleware,
  requireRoles('LEARNER', 'ADMIN'),
  asyncHandler(getReservationCheckoutSessionHandler),
);

paymentsCheckoutRouter.post(
  '/reservations/:reservationId/checkout',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(paymentCheckoutSchema),
  asyncHandler(startReservationCheckoutHandler),
);

paymentsCheckoutRouter.post(
  '/checkout-sessions/reconcile-expired',
  authMiddleware,
  requireRoles('LEARNER', 'ADMIN'),
  asyncHandler(reconcileExpiredCheckoutSessionsHandler),
);

paymentsCheckoutRouter.get(
  '/checkout-sessions/:id',
  authMiddleware,
  requireRoles('LEARNER', 'ADMIN'),
  asyncHandler(getCheckoutSessionHandler),
);

paymentsCheckoutRouter.post(
  '/checkout-sessions/:id/cancel-attempt',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(reservationCheckoutCancelSchema),
  asyncHandler(cancelReservationCheckoutHandler),
);

paymentsCheckoutRouter.post(
  '/orders/:id/checkout',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(paymentCheckoutSchema),
  asyncHandler(startPaymentCheckoutHandler),
);

paymentsCheckoutRouter.post(
  '/orders/:id/cancel-attempt',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(paymentCancelAttemptSchema),
  asyncHandler(cancelPaymentAttemptHandler),
);

if (env.paymentMockRoutesEnabled) {
  paymentsCheckoutRouter.post(
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
