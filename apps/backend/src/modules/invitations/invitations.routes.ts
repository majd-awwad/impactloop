import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';

import { requireRoles } from '../../middlewares/role.middleware.js';

import { validate } from '../../middlewares/validate.middleware.js';

import { asyncHandler } from '../../utils/async-handler.js';

import {
  acceptRoleInvitation,
  createRoleInvitation,
  validateRoleInvitation,
} from './invitations.controller.js';

import {
  acceptInvitationSchema,
  createInvitationSchema,
  invitationTokenParamSchema,
} from './invitations.validation.js';

export const invitationsRouter = Router();

invitationsRouter.post(
  '/',
  authMiddleware,
  requireRoles('ADMIN'),
  validate(createInvitationSchema),
  asyncHandler(createRoleInvitation),
);

invitationsRouter.get(
  '/validate/:token',
  validate(invitationTokenParamSchema, 'params'),
  asyncHandler(validateRoleInvitation),
);

invitationsRouter.post(
  '/accept',
  validate(acceptInvitationSchema),
  asyncHandler(acceptRoleInvitation),
);
