import type { RoleInvitationTargetRole } from '../../generated/prisma/client.js';

import { env } from '../../config/env.js';

import { AppError } from '../../utils/app-error.js';

import { hashPassword } from '../../utils/password.js';

import { generateOpaqueToken, hashToken } from '../../utils/token.js';

import { createAuthSessionForUser } from '../auth/auth.service.js';

import * as authRepository from '../auth/auth.repository.js';

import * as invitationsRepository from './invitations.repository.js';

import type {
  AcceptInvitationInput,
  CreateInvitationInput,
} from './invitations.validation.js';

export type InvitationSummary = {
  id: string;
  targetEmail: string | null;
  targetPhone: string | null;
  targetRole: RoleInvitationTargetRole;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviteToken?: string;
};

export type ValidateInvitationResult = {
  valid: boolean;
  targetRole?: RoleInvitationTargetRole;
  targetEmail?: string | null;
  expiresAt?: string;
};

const getInvitationExpiry = (): Date => {
  const duration = env.invitationExpiresIn;
  const match = duration.match(/^(\d+)([smhd])$/);

  if (!match) {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return new Date(Date.now() + amount * multipliers[unit]!);
};

const toInvitationSummary = (
  invitation: invitationsRepository.InvitationRecord,
  inviteToken?: string,
): InvitationSummary => ({
  id: invitation.id,
  targetEmail: invitation.targetEmail,
  targetPhone: invitation.targetPhone,
  targetRole: invitation.targetRole,
  status: invitation.status,
  expiresAt: invitation.expiresAt.toISOString(),
  createdAt: invitation.createdAt.toISOString(),
  ...(inviteToken ? { inviteToken } : {}),
});

export const createInvitation = async (
  adminUserId: string,
  input: CreateInvitationInput,
): Promise<InvitationSummary> => {
  const rawToken = generateOpaqueToken();

  const invitation = await invitationsRepository.createInvitationRecord({
    targetEmail: input.targetEmail,
    targetPhone: input.targetPhone,
    targetRole: input.targetRole,
    tokenHash: hashToken(rawToken),
    invitedBy: adminUserId,
    expiresAt: getInvitationExpiry(),
    notes: input.notes,
  });

  if (env.nodeEnv === 'development') {
    // TODO: Remove dev-only inviteToken exposure once email delivery is implemented.
    return toInvitationSummary(invitation, rawToken);
  }

  return toInvitationSummary(invitation);
};

export const validateInvitationToken = async (
  token: string,
): Promise<ValidateInvitationResult> => {
  const invitation = await invitationsRepository.findPendingInvitationByTokenHash(
    hashToken(token),
  );

  if (!invitation) {
    return { valid: false };
  }

  return {
    valid: true,
    targetRole: invitation.targetRole,
    targetEmail: invitation.targetEmail,
    expiresAt: invitation.expiresAt.toISOString(),
  };
};

export const acceptInvitation = async (input: AcceptInvitationInput) => {
  const invitation = await invitationsRepository.findPendingInvitationByTokenHash(
    hashToken(input.token),
  );

  if (!invitation) {
    throw new AppError('Invalid or expired invitation token', 400, 'VALIDATION_ERROR');
  }

  if (invitation.targetEmail && invitation.targetEmail !== input.email) {
    throw new AppError(
      'Email does not match the invitation target',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (invitation.targetPhone && input.phone && invitation.targetPhone !== input.phone) {
    throw new AppError(
      'Phone number does not match the invitation target',
      400,
      'VALIDATION_ERROR',
    );
  }

  const existingUser = await authRepository.findUserIdByEmail(input.email);

  if (existingUser) {
    throw new AppError('Email is already registered', 409, 'CONFLICT');
  }

  if (input.phone) {
    const existingPhone = await authRepository.findUserIdByPhone(input.phone);

    if (existingPhone) {
      throw new AppError('Phone number is already registered', 409, 'CONFLICT');
    }
  }

  const passwordHash = await hashPassword(input.password);

  const user = await invitationsRepository.acceptInvitationTransaction({
    invitationId: invitation.id,
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    passwordHash,
    targetRole: invitation.targetRole,
    assignedBy: invitation.invitedBy,
  });

  const session = await createAuthSessionForUser(user);

  return session;
};
