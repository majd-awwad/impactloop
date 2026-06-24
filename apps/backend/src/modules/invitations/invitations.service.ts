import type { RoleInvitationTargetRole } from '../../generated/prisma/client.js';

import { env, getAppPublicBaseUrl, getResolvedEmailProvider, isAppPublicBaseUrlConfigured } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { generateOpaqueToken, hashToken } from '../../utils/token.js';

import * as authRepository from '../auth/auth.repository.js';

import { getEmailInvitationProvider } from './email/index.js';
import * as invitationsRepository from './invitations.repository.js';
import {
  computeInvitationDisplayStatus,
  isInvitationActionable,
  type InvitationDisplayStatus,
} from './invitations.status.js';
import type {
  AcceptInvitationInput,
  AdminCreateInvitationInput,
} from './invitations.validation.js';

export type InvitationAdminDto = {
  id: string;
  recipientEmail: string;
  role: RoleInvitationTargetRole;
  status: InvitationDisplayStatus;
  expiresAt: string;
  sentAt: string | null;
  usedAt: string | null;
  sendError: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
};

export type InvitationCreateResult = InvitationAdminDto & {
  sendStatus: 'PENDING' | 'SENT' | 'FAILED';
  inviteLink: string;
  emailProvider: 'mock' | 'smtp';
};

export type ValidateInvitationResult = {
  valid: boolean;
  role?: RoleInvitationTargetRole;
  recipientEmail?: string;
  expiresAt?: string;
  reason?: string;
};

export type AcceptInvitationResult = {
  role: RoleInvitationTargetRole;
  userId: string;
};

const assertInviteLinkConfiguration = (): void => {
  if (!isAppPublicBaseUrlConfigured()) {
    throw new AppError('APP_PUBLIC_BASE_URL is not configured', 500, 'CONFIG_ERROR');
  }
};

const buildInviteLink = (rawToken: string): string => {
  assertInviteLinkConfiguration();
  const base = getAppPublicBaseUrl().replace(/\/$/, '');
  return `${base}/invite/accept?token=${encodeURIComponent(rawToken)}`;
};

const toAdminDto = (
  invitation: invitationsRepository.InvitationRecord,
): InvitationAdminDto => ({
  id: invitation.id,
  recipientEmail: invitation.targetEmail ?? '',
  role: invitation.targetRole,
  status: computeInvitationDisplayStatus(invitation),
  expiresAt: invitation.expiresAt.toISOString(),
  sentAt: invitation.sentAt?.toISOString() ?? null,
  usedAt: invitation.usedAt?.toISOString() ?? null,
  sendError: invitation.sendError,
  createdAt: invitation.createdAt.toISOString(),
  createdBy: invitation.invitedByUser,
});

const sendInvitationEmail = async (input: {
  invitationId: string;
  recipientEmail: string;
  role: RoleInvitationTargetRole;
  inviteLink: string;
  expiresAt: Date;
}): Promise<InvitationAdminDto & { sendStatus: 'SENT' | 'FAILED' }> => {
  const provider = getEmailInvitationProvider();
  const result = await provider.sendInvitationEmail({
    recipientEmail: input.recipientEmail,
    role: input.role,
    inviteLink: input.inviteLink,
    expiresAt: input.expiresAt,
  });

  const updated = await invitationsRepository.updateInvitationSendResult({
    id: input.invitationId,
    sendStatus: result.sendStatus,
    sentAt: result.sendStatus === 'SENT' ? new Date() : null,
    sendError: result.sendError ?? null,
    providerMessageId: result.providerMessageId ?? null,
  });

  return {
    ...toAdminDto(updated),
    sendStatus: result.sendStatus,
  };
};

export const listInvitationsForAdmin = async (): Promise<InvitationAdminDto[]> => {
  const invitations = await invitationsRepository.listInvitationRecords();
  return invitations.map(toAdminDto);
};

export const createEmailInvitation = async (
  adminUserId: string,
  input: AdminCreateInvitationInput,
): Promise<InvitationCreateResult> => {
  const rawToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60 * 1000);

  const invitation = await invitationsRepository.createInvitationRecord({
    targetEmail: input.recipientEmail,
    targetRole: input.role,
    tokenHash: hashToken(rawToken),
    invitedBy: adminUserId,
    expiresAt,
    notes: input.note,
  });

  const inviteLink = buildInviteLink(rawToken);
  const sent = await sendInvitationEmail({
    invitationId: invitation.id,
    recipientEmail: input.recipientEmail,
    role: input.role,
    inviteLink,
    expiresAt,
  });

  return {
    ...sent,
    inviteLink,
    emailProvider: getResolvedEmailProvider(),
  };
};

export const resendEmailInvitation = async (
  invitationId: string,
): Promise<InvitationCreateResult> => {
  const invitation = await invitationsRepository.findInvitationRecordById(invitationId);

  if (!invitation) {
    throw new AppError('Invitation not found', 404, 'NOT_FOUND');
  }

  if (!isInvitationActionable(invitation)) {
    throw new AppError('Invitation cannot be resent', 400, 'VALIDATION_ERROR');
  }

  if (!invitation.targetEmail) {
    throw new AppError('Invitation has no recipient email', 400, 'VALIDATION_ERROR');
  }

  const rawToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const rotated = await invitationsRepository.rotateInvitationToken({
    id: invitation.id,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });

  const inviteLink = buildInviteLink(rawToken);
  const sent = await sendInvitationEmail({
    invitationId: rotated.id,
    recipientEmail: invitation.targetEmail,
    role: invitation.targetRole,
    inviteLink,
    expiresAt,
  });

  return {
    ...sent,
    inviteLink,
    emailProvider: getResolvedEmailProvider(),
  };
};

export const revokeInvitation = async (invitationId: string): Promise<InvitationAdminDto> => {
  const invitation = await invitationsRepository.findInvitationRecordById(invitationId);

  if (!invitation) {
    throw new AppError('Invitation not found', 404, 'NOT_FOUND');
  }

  if (invitation.usedAt) {
    throw new AppError('Used invitations cannot be revoked', 400, 'VALIDATION_ERROR');
  }

  if (!isInvitationActionable(invitation)) {
    throw new AppError('Invitation is already revoked', 400, 'VALIDATION_ERROR');
  }

  const revoked = await invitationsRepository.revokeInvitationRecord(invitationId);
  return toAdminDto(revoked);
};

const assertInvitationUsable = async (token: string) => {
  const invitation = await invitationsRepository.findInvitationByTokenHash(hashToken(token));

  if (!invitation) {
    throw new AppError('Invalid invitation', 400, 'VALIDATION_ERROR');
  }

  if (invitation.usedAt || invitation.status === 'ACCEPTED') {
    throw new AppError('Invitation already used', 400, 'VALIDATION_ERROR');
  }

  if (invitation.revokedAt || invitation.status === 'REVOKED') {
    throw new AppError('Invitation revoked', 400, 'VALIDATION_ERROR');
  }

  if (invitation.expiresAt <= new Date()) {
    throw new AppError('Invitation expired', 400, 'VALIDATION_ERROR');
  }

  return invitation;
};

export const validateInvitationToken = async (
  token: string,
): Promise<ValidateInvitationResult> => {
  try {
    const invitation = await assertInvitationUsable(token);

    return {
      valid: true,
      role: invitation.targetRole,
      recipientEmail: invitation.targetEmail ?? undefined,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof AppError) {
      return {
        valid: false,
        reason: error.message,
      };
    }

    throw error;
  }
};

const validateAcceptPayloadForRole = (
  invitationRole: RoleInvitationTargetRole,
  input: AcceptInvitationInput,
): void => {
  if (invitationRole === 'DRIVER') {
    if (!input.phone || !input.city || !input.area || !input.transportationType) {
      throw new AppError(
        'Driver invitations require phone, city, area, and transportation type',
        400,
        'VALIDATION_ERROR',
      );
    }
    return;
  }

  if (!input.phone) {
    return;
  }
};

export const acceptInvitation = async (
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> => {
  const invitation = await assertInvitationUsable(input.token);

  if (!invitation.targetEmail) {
    throw new AppError('Invitation is missing recipient email', 400, 'VALIDATION_ERROR');
  }

  if (invitation.targetEmail.toLowerCase() !== input.email.toLowerCase()) {
    throw new AppError(
      'Email does not match the invitation target',
      400,
      'VALIDATION_ERROR',
    );
  }

  validateAcceptPayloadForRole(invitation.targetRole, input);

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
    displayName: input.fullName,
    email: input.email,
    phone: input.phone,
    passwordHash,
    targetRole: invitation.targetRole,
    assignedBy: invitation.invitedBy,
    driverProfile:
      invitation.targetRole === 'DRIVER'
        ? {
            phone: input.phone!,
            city: input.city!,
            area: input.area!,
            addressLine: input.addressLine,
            transportationType: input.transportationType!,
            availabilityNote: input.availabilityNote,
          }
        : undefined,
  });

  return {
    role: invitation.targetRole,
    userId: user.id,
  };
};
