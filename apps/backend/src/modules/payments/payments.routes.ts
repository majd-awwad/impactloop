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
  getPaymentOrderHandler,
  mockCheckoutActHandler,
  mockWebhookHandler,
  startPaymentCheckoutHandler,
} from './payments.controller.js';
import {
  mockCheckoutActSchema,
  paymentCancelAttemptSchema,
  paymentCheckoutSchema,
} from './payments.validation.js';

export const paymentsRouter = Router();

paymentsRouter.get(
  '/orders/:id',
  authMiddleware,
  requireRoles('LEARNER', 'ADMIN'),
  asyncHandler(getPaymentOrderHandler),
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
