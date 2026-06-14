import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';

import { validate } from '../../middlewares/validate.middleware.js';

import { asyncHandler } from '../../utils/async-handler.js';

import {
  forgotPassword,
  getMe,
  login,
  logout,
  refresh,
  register,
  resetPassword,
} from './auth.controller.js';

import {
  forgotPasswordSchema,
  loginSchema,
  refreshTokenSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.validation.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(register),
);

authRouter.post('/login', validate(loginSchema), asyncHandler(login));

authRouter.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler(forgotPassword),
);

authRouter.post(
  '/reset-password',
  validate(resetPasswordSchema),
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
