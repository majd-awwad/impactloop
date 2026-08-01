import { z } from 'zod';

import { bodyEmailSchema } from '../../utils/zod-helpers.js';

export const INVITATION_TARGET_ROLES = ['DRIVER', 'MODERATOR', 'ADMIN'] as const;

export const INVITATION_EXPIRY_MINUTES = [30, 60, 1440] as const;

export const TRANSPORTATION_TYPES = [
  'CAR',
  'MOTORCYCLE',
  'BICYCLE',
  'WALKING',
] as const;

export const adminCreateInvitationSchema = z.object({
  role: z.enum(INVITATION_TARGET_ROLES, {
    error: 'Invitation role must be DRIVER, MODERATOR, or ADMIN',
  }),
  recipientEmail: bodyEmailSchema(),
  expiresInMinutes: z.union([
    z.literal(30),
    z.literal(60),
    z.literal(1440),
  ]),
  note: z.string().trim().max(500).optional(),
});

export const invitationIdParamSchema = z.object({
  id: z.string().min(1),
});

export const invitationTokenQuerySchema = z.object({
  token: z.string().min(1),
});

const passwordSchema = z.string().min(8).max(128);

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(1),
    fullName: z.string().trim().min(2).max(100),
    email: bodyEmailSchema(),
    password: passwordSchema,
    confirmPassword: passwordSchema,
    phone: z.string().trim().min(5).max(30).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    area: z.string().trim().min(2).max(100).optional(),
    addressLine: z.string().trim().max(200).optional(),
    transportationType: z.enum(TRANSPORTATION_TYPES).optional(),
    availabilityNote: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: 'custom',
        message: 'Password confirmation does not match',
        path: ['confirmPassword'],
      });
    }
  });

export type AdminCreateInvitationInput = z.infer<typeof adminCreateInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
