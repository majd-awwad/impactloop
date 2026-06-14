import { z } from 'zod';

import { bodyEmailSchema } from '../../utils/zod-helpers.js';

export const INVITATION_TARGET_ROLES = ['DRIVER', 'MODERATOR', 'ADMIN'] as const;

export const createInvitationSchema = z.object({
  targetEmail: bodyEmailSchema().optional(),
  targetPhone: z.string().trim().min(5).max(30).optional(),
  targetRole: z.enum(INVITATION_TARGET_ROLES, {
    error: 'Invitation target role must be DRIVER, MODERATOR, or ADMIN',
  }),
  notes: z.string().trim().max(500).optional(),
});

export const invitationTokenParamSchema = z.object({
  token: z.string().min(1),
});

export const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  displayName: z.string().trim().min(2).max(100),
  email: bodyEmailSchema(),
  password: z.string().min(8).max(128),
  phone: z.string().trim().min(5).max(30).optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
