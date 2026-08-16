import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler.js';
import {
  authMiddleware,
} from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';

import {
  getPaymentOrderHandler,
  getReservationPaymentRequirementHandler,
} from './payments.controller.js';

/**
 * Current MVP payment API surface: read-only payment data for audit/history.
 * Learner-initiated card checkout routes live in payments.checkout-routes.ts
 * and are not mounted while card checkout is product-disabled.
 */
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
