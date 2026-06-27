import { Router } from 'express';

import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  acceptRoleInvitation,
  validateRoleInvitation,
} from './invitations.controller.js';

import {
  acceptInvitationSchema,
  invitationTokenQuerySchema,
} from './invitations.validation.js';

export const invitationsRouter = Router();

invitationsRouter.get(
  '/validate',
  validate(invitationTokenQuerySchema, 'query'),
  asyncHandler(validateRoleInvitation),
);

invitationsRouter.post(
  '/accept',
  validate(acceptInvitationSchema),
  asyncHandler(acceptRoleInvitation),
);
