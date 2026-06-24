import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { createReservationHandler } from './reservations.controller.js';
import { createReservationSchema } from './reservations.validation.js';

export const reservationsRouter = Router();

reservationsRouter.post(
  '/',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(createReservationSchema),
  asyncHandler(createReservationHandler),
);
