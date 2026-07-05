import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  createMySavedDropoffAddressHandler,
  deleteMySavedDropoffAddressHandler,
  listMySavedDropoffAddressesHandler,
  updateMySavedDropoffAddressHandler,
} from './saved-dropoff-addresses.controller.js';
import {
  createSavedDropoffAddressSchema,
  savedDropoffAddressIdParamsSchema,
  updateSavedDropoffAddressSchema,
} from './saved-dropoff-addresses.validation.js';

export const savedDropoffAddressesRouter = Router();

savedDropoffAddressesRouter.get(
  '/',
  authMiddleware,
  requireRoles('LEARNER'),
  asyncHandler(listMySavedDropoffAddressesHandler),
);

savedDropoffAddressesRouter.post(
  '/',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(createSavedDropoffAddressSchema),
  asyncHandler(createMySavedDropoffAddressHandler),
);

savedDropoffAddressesRouter.patch(
  '/:id',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(savedDropoffAddressIdParamsSchema, 'params'),
  validate(updateSavedDropoffAddressSchema),
  asyncHandler(updateMySavedDropoffAddressHandler),
);

savedDropoffAddressesRouter.delete(
  '/:id',
  authMiddleware,
  requireRoles('LEARNER'),
  validate(savedDropoffAddressIdParamsSchema, 'params'),
  asyncHandler(deleteMySavedDropoffAddressHandler),
);
