import { z } from 'zod';

import { bodyEmailSchema } from '../../utils/zod-helpers.js';

export const PUBLIC_SIGNUP_ROLES = ['LEARNER', 'SUPPLIER'] as const;

export const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: bodyEmailSchema(),
  password: z.string().min(8).max(128),
  role: z.enum(PUBLIC_SIGNUP_ROLES, {
    error: 'Registration is allowed only for LEARNER or SUPPLIER',
  }),
  phone: z.string().trim().min(5).max(30).optional(),
});

export const loginSchema = z.object({
  email: bodyEmailSchema(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: bodyEmailSchema(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
