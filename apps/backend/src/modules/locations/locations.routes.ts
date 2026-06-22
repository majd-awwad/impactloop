import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { reverseGeocodeHandler } from './locations.controller.js';
import { reverseGeocodeSchema } from './locations.validation.js';

export const locationsRouter = Router();

locationsRouter.post(
  '/reverse-geocode',
  authMiddleware,
  validate(reverseGeocodeSchema),
  asyncHandler(reverseGeocodeHandler),
);
