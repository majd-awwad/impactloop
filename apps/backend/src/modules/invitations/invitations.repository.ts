import type {
  RoleInvitation,
  RoleInvitationSendStatus,
  RoleInvitationTargetRole,
  TransportationType,
  UserRole,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

import type { UserWithRoles } from '../auth/auth.repository.js';

export type InvitationRecord = RoleInvitation & {
  invitedByUser: {
    id: string;
    displayName: string;
    email: string;
  } | null;
};

export const listInvitationRecords = async (): Promise<InvitationRecord[]> => {
  return prisma.roleInvitation.findMany({
    include: {
      invitedByUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const findInvitationRecordById = async (
  id: string,
): Promise<InvitationRecord | null> => {
  return prisma.roleInvitation.findUnique({
    where: { id },
    include: {
      invitedByUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
};

export const createInvitationRecord = async (input: {
  targetEmail: string;
  targetRole: RoleInvitationTargetRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
  notes?: string;
}): Promise<InvitationRecord> => {
  return prisma.roleInvitation.create({
    data: {
      targetEmail: input.targetEmail,
      targetRole: input.targetRole,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      expiresAt: input.expiresAt,
      notes: input.notes,
    },
    include: {
      invitedByUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
};

export const updateInvitationSendResult = async (input: {
  id: string;
  sendStatus: RoleInvitationSendStatus;
  sentAt: Date | null;
  sendError: string | null;
  providerMessageId: string | null;
}): Promise<InvitationRecord> => {
  return prisma.roleInvitation.update({
    where: { id: input.id },
    data: {
      sendStatus: input.sendStatus,
      sentAt: input.sentAt,
      sendError: input.sendError,
      providerMessageId: input.providerMessageId,
    },
    include: {
      invitedByUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
};

export const rotateInvitationToken = async (input: {
  id: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<InvitationRecord> => {
  return prisma.roleInvitation.update({
    where: { id: input.id },
    data: {
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      sendStatus: 'PENDING',
      sentAt: null,
      sendError: null,
      providerMessageId: null,
    },
    include: {
      invitedByUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
};

export const revokeInvitationRecord = async (id: string): Promise<InvitationRecord> => {
  return prisma.roleInvitation.update({
    where: { id },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
    include: {
      invitedByUser: {
        select: {
          id: true,
          displayName: true,
          email: true,
        },
      },
    },
  });
};

export const findInvitationByTokenHash = async (
  tokenHash: string,
): Promise<RoleInvitation | null> => {
  return prisma.roleInvitation.findUnique({
    where: { tokenHash },
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
  driverProfile?: {
    phone: string;
    city: string;
    area: string;
    addressLine?: string;
    transportationType: TransportationType;
    availabilityNote?: string;
  };
}): Promise<UserWithRoles> => {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        displayName: input.displayName,
        email: input.email,
        phone: input.phone ?? input.driverProfile?.phone,
        passwordHash: input.passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: {
          create: {
            role: input.targetRole,
            isPrimary: true,
            assignedBy: input.assignedBy,
          },
        },
        ...(input.driverProfile
          ? {
              driverProfile: {
                create: {
                  phone: input.driverProfile.phone,
                  city: input.driverProfile.city,
                  area: input.driverProfile.area,
                  addressLine: input.driverProfile.addressLine,
                  transportationType: input.driverProfile.transportationType,
                  availabilityNote: input.driverProfile.availabilityNote,
                },
              },
            }
          : {}),
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
