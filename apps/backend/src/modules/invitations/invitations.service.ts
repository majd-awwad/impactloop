import type { RoleInvitationTargetRole } from '../../generated/prisma/client.js';

import { env, getAppPublicBaseUrl, getResolvedEmailProvider, isAppPublicBaseUrlConfigured } from '../../config/env.js';
import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { generateOpaqueToken, hashToken } from '../../utils/token.js';
import { isPrismaCode } from '../../utils/transaction-retry.js';

import * as authRepository from '../auth/auth.repository.js';

import { getEmailInvitationProvider } from './email/index.js';
import * as invitationsRepository from './invitations.repository.js';
import {
  ADMIN_ACTIVITY_ACTIONS,
  ADMIN_ACTIVITY_TARGET_TYPES,
  logAdminActivity,
} from '../admin/admin-activity-log.js';
import {
  computeInvitationDisplayStatus,
  isActivePendingInvitation,
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
  acceptedAt: string | null;
  revokedAt: string | null;
  sendError: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  canCopyLink: boolean;
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

const invitationTargetLabel = (email: string, role: string) => `${email} (${role})`;

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
  acceptedAt: invitation.usedAt?.toISOString() ?? null,
  revokedAt: invitation.revokedAt?.toISOString() ?? null,
  sendError: invitation.sendError,
  createdAt: invitation.createdAt.toISOString(),
  createdBy: invitation.invitedByUser,
  canCopyLink: isActivePendingInvitation(invitation),
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

export const getInvitationForAdmin = async (
  invitationId: string,
): Promise<InvitationAdminDto> => {
  const invitation =
    await invitationsRepository.findInvitationRecordById(invitationId);

  if (!invitation) {
    throw new AppError('Invitation not found', 404, COMMON_ERROR_CODES.notFound);
  }

  return toAdminDto(invitation);
};

export const issueInvitationLinkForAdmin = async (
  invitationId: string,
): Promise<{ invitationUrl: string }> => {
  const invitation =
    await invitationsRepository.findInvitationRecordById(invitationId);

  if (!invitation) {
    throw new AppError('Invitation not found', 404, COMMON_ERROR_CODES.notFound);
  }

  if (!isActivePendingInvitation(invitation)) {
    throw new AppError(
      'This invitation is no longer active.',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  const rawToken = generateOpaqueToken();
  await invitationsRepository.rotateInvitationTokenHashOnly({
    id: invitation.id,
    tokenHash: hashToken(rawToken),
  });

  return {
    invitationUrl: buildInviteLink(rawToken),
  };
};

const throwDuplicatePendingInvitation = async (
  recipientEmail: string,
  role: RoleInvitationTargetRole,
): Promise<never> => {
  const existing =
    await invitationsRepository.findActivePendingInvitationByEmailAndRole(
      recipientEmail,
      role,
    );

  throw new AppError(
    'An active pending invitation already exists for this email and role.',
    409,
    'DUPLICATE_PENDING_INVITATION',
    existing
      ? {
          existingInvitation: toAdminDto(existing),
        }
      : undefined,
  );
};

export const createEmailInvitation = async (
  adminUserId: string,
  input: AdminCreateInvitationInput,
): Promise<InvitationCreateResult> => {
  assertInviteLinkConfiguration();

  const recipientEmail = input.recipientEmail.trim().toLowerCase();

  await invitationsRepository.clearInactiveInvitationActiveKeys(
    recipientEmail,
    input.role,
  );

  const existing =
    await invitationsRepository.findActivePendingInvitationByEmailAndRole(
      recipientEmail,
      input.role,
    );

  if (existing) {
    await throwDuplicatePendingInvitation(recipientEmail, input.role);
  }

  const rawToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + input.expiresInMinutes * 60 * 1000);

  let invitation: invitationsRepository.InvitationRecord;
  try {
    invitation = await invitationsRepository.createInvitationRecord({
      targetEmail: recipientEmail,
      targetRole: input.role,
      tokenHash: hashToken(rawToken),
      invitedBy: adminUserId,
      expiresAt,
      notes: input.note,
    });
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) {
      await throwDuplicatePendingInvitation(recipientEmail, input.role);
    }

    throw error;
  }

  const inviteLink = buildInviteLink(rawToken);
  const sent = await sendInvitationEmail({
    invitationId: invitation.id,
    recipientEmail,
    role: input.role,
    inviteLink,
    expiresAt,
  });

  await logAdminActivity({
    actorUserId: adminUserId,
    action: ADMIN_ACTIVITY_ACTIONS.INVITATION_CREATED,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.INVITATION,
    targetId: invitation.id,
    targetLabel: invitationTargetLabel(recipientEmail, input.role),
    metadata: {
      email: recipientEmail,
      role: input.role,
      expiresAt: expiresAt.toISOString(),
      sendStatus: sent.sendStatus,
    },
  });

  return {
    ...sent,
    inviteLink,
    emailProvider: getResolvedEmailProvider(),
  };
};

export const resendEmailInvitation = async (
  invitationId: string,
  adminUserId?: string,
): Promise<InvitationCreateResult> => {
  const invitation = await invitationsRepository.findInvitationRecordById(invitationId);

  if (!invitation) {
    throw new AppError('Invitation not found', 404, COMMON_ERROR_CODES.notFound);
  }

  if (!isInvitationActionable(invitation)) {
    throw new AppError(
      'Invitation cannot be resent',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  if (!invitation.targetEmail) {
    throw new AppError(
      'Invitation has no recipient email',
      400,
      COMMON_ERROR_CODES.validationError,
    );
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

  if (adminUserId) {
    await logAdminActivity({
      actorUserId: adminUserId,
      action: ADMIN_ACTIVITY_ACTIONS.INVITATION_RESENT,
      targetType: ADMIN_ACTIVITY_TARGET_TYPES.INVITATION,
      targetId: rotated.id,
      targetLabel: invitationTargetLabel(
        invitation.targetEmail,
        invitation.targetRole,
      ),
      metadata: {
        role: invitation.targetRole,
        sendStatus: sent.sendStatus,
      },
    });
  }

  return {
    ...sent,
    inviteLink,
    emailProvider: getResolvedEmailProvider(),
  };
};

export const revokeInvitation = async (
  invitationId: string,
  adminUserId?: string,
): Promise<InvitationAdminDto> => {
  const invitation = await invitationsRepository.findInvitationRecordById(invitationId);

  if (!invitation) {
    throw new AppError('Invitation not found', 404, COMMON_ERROR_CODES.notFound);
  }

  if (invitation.usedAt) {
    throw new AppError(
      'Used invitations cannot be revoked',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  if (!isInvitationActionable(invitation)) {
    throw new AppError(
      'Invitation is already revoked',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  const revoked = await invitationsRepository.revokeInvitationRecord(invitationId);
  const dto = toAdminDto(revoked);

  if (adminUserId) {
    await logAdminActivity({
      actorUserId: adminUserId,
      action: ADMIN_ACTIVITY_ACTIONS.INVITATION_REVOKED,
      targetType: ADMIN_ACTIVITY_TARGET_TYPES.INVITATION,
      targetId: dto.id,
      targetLabel: invitationTargetLabel(dto.recipientEmail, dto.role),
      metadata: {
        role: dto.role,
        status: dto.status,
      },
    });
  }

  return dto;
};

const assertInvitationUsable = async (token: string) => {
  const invitation = await invitationsRepository.findInvitationByTokenHash(hashToken(token));

  if (!invitation) {
    throw new AppError(
      'Invalid invitation',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  if (invitation.usedAt || invitation.status === 'ACCEPTED') {
    throw new AppError(
      'Invitation already used',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  if (invitation.revokedAt || invitation.status === 'REVOKED') {
    throw new AppError(
      'Invitation revoked',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  if (invitation.expiresAt <= new Date()) {
    throw new AppError(
      'Invitation expired',
      400,
      COMMON_ERROR_CODES.validationError,
    );
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
        COMMON_ERROR_CODES.validationError,
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
    throw new AppError(
      'Invitation is missing recipient email',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  if (invitation.targetEmail.toLowerCase() !== input.email.toLowerCase()) {
    throw new AppError(
      'Email does not match the invitation target',
      400,
      COMMON_ERROR_CODES.validationError,
    );
  }

  validateAcceptPayloadForRole(invitation.targetRole, input);

  const existingUser = await authRepository.findUserIdByEmail(input.email);

  if (existingUser) {
    throw new AppError(
      'Email is already registered',
      409,
      COMMON_ERROR_CODES.conflict,
    );
  }

  if (input.phone) {
    const existingPhone = await authRepository.findUserIdByPhone(input.phone);

    if (existingPhone) {
      throw new AppError(
        'Phone number is already registered',
        409,
        COMMON_ERROR_CODES.conflict,
      );
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
