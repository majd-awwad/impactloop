import { Router, type Request } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';

import {
  createRateLimitMiddleware,
  type RateLimitPolicy,
} from '../../middlewares/rate-limit.middleware.js';

import { validate } from '../../middlewares/validate.middleware.js';

import { asyncHandler } from '../../utils/async-handler.js';
import { hashToken } from '../../utils/token.js';

import {
  forgotPassword,
  getMe,
  login,
  logout,
  refresh,
  register,
  resetPassword,
  changePassword,
  postBecomeSupplier,
  postBecomeLearner,
  postSwitchRole,
} from './auth.controller.js';

import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
  becomeSupplierSchema,
  becomeLearnerSchema,
  switchRoleSchema,
} from './auth.validation.js';

export const authRouter = Router();

const getRequestIp = (req: Request): string =>
  req.ip ?? req.socket.remoteAddress ?? 'unknown';

const normalizeBodyEmail = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : 'missing';

const normalizeBodyToken = (value: unknown): string =>
  typeof value === 'string' && value.trim()
    ? hashToken(value.trim())
    : 'missing';

const forgotPasswordIpPolicy: RateLimitPolicy = {
  name: 'forgot-password-ip',
  windowMs: 15 * 60 * 1000,
  max: 10,
};

const forgotPasswordEmailPolicy: RateLimitPolicy = {
  name: 'forgot-password-email',
  windowMs: 15 * 60 * 1000,
  max: 3,
};

const resetPasswordIpPolicy: RateLimitPolicy = {
  name: 'reset-password-ip',
  windowMs: 15 * 60 * 1000,
  max: 20,
};

const resetPasswordTokenPolicy: RateLimitPolicy = {
  name: 'reset-password-token',
  windowMs: 15 * 60 * 1000,
  max: 5,
};

const forgotPasswordIpRateLimit = createRateLimitMiddleware({
  policy: forgotPasswordIpPolicy,
  keyGenerator: getRequestIp,
});

const forgotPasswordEmailRateLimit = createRateLimitMiddleware({
  policy: forgotPasswordEmailPolicy,
  keyGenerator: (req) => normalizeBodyEmail(req.body?.email),
});

const resetPasswordIpRateLimit = createRateLimitMiddleware({
  policy: resetPasswordIpPolicy,
  keyGenerator: getRequestIp,
});

const resetPasswordTokenRateLimit = createRateLimitMiddleware({
  policy: resetPasswordTokenPolicy,
  keyGenerator: (req) => normalizeBodyToken(req.body?.token),
});

authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(register),
);

authRouter.post('/login', validate(loginSchema), asyncHandler(login));

authRouter.post(
  '/forgot-password',
  forgotPasswordIpRateLimit,
  validate(forgotPasswordSchema),
  forgotPasswordEmailRateLimit,
  asyncHandler(forgotPassword),
);

authRouter.post(
  '/reset-password',
  resetPasswordIpRateLimit,
  validate(resetPasswordSchema),
  resetPasswordTokenRateLimit,
  asyncHandler(resetPassword),
);

authRouter.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(refresh),
);

authRouter.post(
  '/logout',
  validate(refreshTokenSchema),
  asyncHandler(logout),
);

authRouter.get('/me', authMiddleware, asyncHandler(getMe));

authRouter.patch(
  '/change-password',
  authMiddleware,
  validate(changePasswordSchema),
  asyncHandler(changePassword),
);

authRouter.post(
  '/become-supplier',
  authMiddleware,
  validate(becomeSupplierSchema),
  asyncHandler(postBecomeSupplier),
);

authRouter.post(
  '/become-learner',
  authMiddleware,
  validate(becomeLearnerSchema),
  asyncHandler(postBecomeLearner),
);

authRouter.post(
  '/switch-role',
  authMiddleware,
  validate(switchRoleSchema),
  asyncHandler(postSwitchRole),
);
