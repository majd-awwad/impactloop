import { z } from 'zod';

import { bodyEmailSchema } from '../../utils/zod-helpers.js';
import { isKnownBecomeSupplierType } from './role-capabilities.js';

export const PUBLIC_SIGNUP_ROLES = ['LEARNER', 'SUPPLIER'] as const;

const learnerProfileSchema = z.object({
  learnerType: z.string().trim().min(1).max(100),
  skillLevel: z.string().trim().min(1).max(100),
  interests: z.array(z.string().trim().min(1).max(100)).optional(),
  bio: z.string().trim().max(2000).optional(),
});

const supplierProfileSchema = z.object({
  supplierType: z.string().trim().min(1).max(100),
  publicName: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
  pickupArea: z.string().trim().min(1).max(200),
});

export const registerSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100),
    email: bodyEmailSchema(),
    password: z.string().min(8).max(128),
    phone: z.string().trim().min(5).max(30).optional(),
    roles: z
      .array(
        z.enum(PUBLIC_SIGNUP_ROLES, {
          error: 'Registration is allowed only for LEARNER or SUPPLIER',
        }),
      )
      .min(1)
      .max(2)
      .refine(
        (roles) => new Set(roles).size === roles.length,
        'Duplicate roles are not allowed',
      ),
    learnerProfile: learnerProfileSchema.optional(),
    supplierProfile: supplierProfileSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const hasLearner = data.roles.includes('LEARNER');
    const hasSupplier = data.roles.includes('SUPPLIER');

    if (hasLearner && !data.learnerProfile) {
      ctx.addIssue({
        code: 'custom',
        message: 'learnerProfile is required when registering as LEARNER',
        path: ['learnerProfile'],
      });
    }

    if (!hasLearner && data.learnerProfile) {
      ctx.addIssue({
        code: 'custom',
        message: 'learnerProfile is not allowed for SUPPLIER-only registration',
        path: ['learnerProfile'],
      });
    }

    if (hasSupplier && !data.supplierProfile) {
      ctx.addIssue({
        code: 'custom',
        message: 'supplierProfile is required when registering as SUPPLIER',
        path: ['supplierProfile'],
      });
    }

    if (!hasSupplier && data.supplierProfile) {
      ctx.addIssue({
        code: 'custom',
        message: 'supplierProfile is not allowed for LEARNER-only registration',
        path: ['supplierProfile'],
      });
    }
  });

export const loginSchema = z.object({
  email: bodyEmailSchema(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: bodyEmailSchema(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmNewPassword: z.string().min(1),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Passwords do not match.',
        path: ['confirmNewPassword'],
      });
    }

    if (data.newPassword === data.currentPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'New password must be different from your current password.',
        path: ['newPassword'],
      });
    }
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

const becomeSupplierProfileSchema = z
  .object({
    supplierType: z.string().trim().min(1).max(100),
    publicName: z.string().trim().min(1).max(100),
    description: z.string().trim().max(2000).optional(),
    pickupArea: z.string().trim().min(1).max(200),
    workingHours: z.string().trim().max(200).optional(),
    pickupNotes: z.string().trim().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (!isKnownBecomeSupplierType(data.supplierType)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Unsupported supplier type for this flow.',
        path: ['supplierType'],
      });
    }
  });

export const becomeSupplierSchema = becomeSupplierProfileSchema;

export const switchRoleSchema = z.object({
  activeRole: z.enum(['LEARNER', 'SUPPLIER'], {
    error: 'activeRole must be LEARNER or SUPPLIER',
  }),
});

export type BecomeSupplierInput = z.infer<typeof becomeSupplierSchema>;
export type SwitchRoleInput = z.infer<typeof switchRoleSchema>;
