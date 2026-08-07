import { Router, type Request } from 'express';

import {
  createRateLimitMiddleware,
  type RateLimitPolicy,
} from '../../middlewares/rate-limit.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { hashToken } from '../../utils/token.js';

import {
  acceptRoleInvitation,
  validateRoleInvitation,
} from './invitations.controller.js';

import {
  acceptInvitationSchema,
  invitationTokenQuerySchema,
} from './invitations.validation.js';

export const invitationsRouter = Router();

const getRequestIp = (req: Request): string =>
  req.ip ?? req.socket.remoteAddress ?? 'unknown';

const normalizeBodyToken = (value: unknown): string =>
  typeof value === 'string' && value.trim()
    ? hashToken(value.trim())
    : 'missing';

const normalizeQueryToken = (value: unknown): string =>
  typeof value === 'string' && value.trim()
    ? hashToken(value.trim())
    : 'missing';

const validateInvitationIpPolicy: RateLimitPolicy = {
  name: 'invitation-validate-ip',
  windowMs: 15 * 60 * 1000,
  max: 20,
};

const validateInvitationTokenPolicy: RateLimitPolicy = {
  name: 'invitation-validate-token',
  windowMs: 15 * 60 * 1000,
  max: 10,
};

const acceptInvitationIpPolicy: RateLimitPolicy = {
  name: 'invitation-accept-ip',
  windowMs: 15 * 60 * 1000,
  max: 20,
};

const acceptInvitationTokenPolicy: RateLimitPolicy = {
  name: 'invitation-accept-token',
  windowMs: 15 * 60 * 1000,
  max: 5,
};

const validateInvitationIpRateLimit = createRateLimitMiddleware({
  policy: validateInvitationIpPolicy,
  keyGenerator: getRequestIp,
});

const validateInvitationTokenRateLimit = createRateLimitMiddleware({
  policy: validateInvitationTokenPolicy,
  keyGenerator: (req) => normalizeQueryToken(req.query?.token),
});

const acceptInvitationIpRateLimit = createRateLimitMiddleware({
  policy: acceptInvitationIpPolicy,
  keyGenerator: getRequestIp,
});

const acceptInvitationTokenRateLimit = createRateLimitMiddleware({
  policy: acceptInvitationTokenPolicy,
  keyGenerator: (req) => normalizeBodyToken(req.body?.token),
});

invitationsRouter.get(
  '/validate',
  validateInvitationIpRateLimit,
  validate(invitationTokenQuerySchema, 'query'),
  validateInvitationTokenRateLimit,
  asyncHandler(validateRoleInvitation),
);

invitationsRouter.post(
  '/accept',
  acceptInvitationIpRateLimit,
  validate(acceptInvitationSchema),
  acceptInvitationTokenRateLimit,
  asyncHandler(acceptRoleInvitation),
);
