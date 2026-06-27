import type { RoleInvitation } from '../../generated/prisma/client.js';

export type InvitationDisplayStatus =
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'USED'
  | 'EXPIRED'
  | 'REVOKED';

export const computeInvitationDisplayStatus = (
  invitation: Pick<
    RoleInvitation,
    'usedAt' | 'revokedAt' | 'expiresAt' | 'sendStatus' | 'status'
  >,
  now: Date = new Date(),
): InvitationDisplayStatus => {
  if (invitation.usedAt) {
    return 'USED';
  }

  if (invitation.revokedAt || invitation.status === 'REVOKED') {
    return 'REVOKED';
  }

  if (invitation.expiresAt <= now) {
    return 'EXPIRED';
  }

  if (invitation.sendStatus === 'FAILED') {
    return 'FAILED';
  }

  if (invitation.sendStatus === 'SENT') {
    return 'SENT';
  }

  return 'PENDING';
};

export const isInvitationActionable = (
  invitation: Pick<RoleInvitation, 'usedAt' | 'revokedAt' | 'status'>,
): boolean => {
  return !invitation.usedAt && !invitation.revokedAt && invitation.status !== 'REVOKED';
};
