import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  createSavedLocationHandler,
  deleteSavedLocationHandler,
  forwardGeocodeHandler,
  listSavedLocationsHandler,
  reverseGeocodeHandler,
  updateSavedLocationHandler,
} from './locations.controller.js';
import {
  forwardGeocodeSchema,
  reverseGeocodeSchema,
  savedLocationIdParamSchema,
  savedLocationSchema,
  updateSavedLocationSchema,
} from './locations.validation.js';

export const locationsRouter = Router();

locationsRouter.post(
  '/reverse-geocode',
  authMiddleware,
  validate(reverseGeocodeSchema),
  asyncHandler(reverseGeocodeHandler),
);

locationsRouter.post(
  '/geocode',
  authMiddleware,
  validate(forwardGeocodeSchema),
  asyncHandler(forwardGeocodeHandler),
);

locationsRouter.get(
  '/saved',
  authMiddleware,
  asyncHandler(listSavedLocationsHandler),
);

locationsRouter.post(
  '/saved',
  authMiddleware,
  validate(savedLocationSchema),
  asyncHandler(createSavedLocationHandler),
);

locationsRouter.patch(
  '/saved/:id',
  authMiddleware,
  validate(savedLocationIdParamSchema, 'params'),
  validate(updateSavedLocationSchema),
  asyncHandler(updateSavedLocationHandler),
);

locationsRouter.delete(
  '/saved/:id',
  authMiddleware,
  validate(savedLocationIdParamSchema, 'params'),
  asyncHandler(deleteSavedLocationHandler),
);
