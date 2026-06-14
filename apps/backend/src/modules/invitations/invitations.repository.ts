import type {
  RoleInvitation,
  RoleInvitationTargetRole,
  UserRole,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

import type { UserWithRoles } from '../auth/auth.repository.js';

export type InvitationRecord = RoleInvitation;

export type PendingInvitationRecord = RoleInvitation;

export const createInvitationRecord = async (input: {
  targetEmail?: string;
  targetPhone?: string;
  targetRole: RoleInvitationTargetRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
  notes?: string;
}): Promise<InvitationRecord> => {
  return prisma.roleInvitation.create({
    data: {
      targetEmail: input.targetEmail,
      targetPhone: input.targetPhone,
      targetRole: input.targetRole,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      expiresAt: input.expiresAt,
      notes: input.notes,
    },
  });
};

export const findPendingInvitationByTokenHash = async (
  tokenHash: string,
): Promise<PendingInvitationRecord | null> => {
  return prisma.roleInvitation.findFirst({
    where: {
      tokenHash,
      status: 'PENDING',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
};

export const acceptInvitationTransaction = async (input: {
  invitationId: string;
  displayName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  targetRole: UserRole;
  assignedBy: string | null;
}): Promise<UserWithRoles> => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        accountStatus: 'ACTIVE',
        roles: {
          create: {
            role: input.targetRole,
            isPrimary: true,
            assignedBy: input.assignedBy,
          },
        },
      },
      include: {
        roles: true,
      },
    });

    await tx.roleInvitation.update({
      where: { id: input.invitationId },
      data: {
        status: 'ACCEPTED',
        usedAt: new Date(),
        usedByUserId: user.id,
      },
    });

    return user;
  });
};
