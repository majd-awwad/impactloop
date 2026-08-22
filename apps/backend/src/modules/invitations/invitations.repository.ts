import type {
  RoleInvitation,
  RoleInvitationSendStatus,
  RoleInvitationTargetRole,
  TransportationType,
  UserRole,
} from '../../generated/prisma/client.js';

import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  buildRoleInvitationActiveKey,
  clearRoleInvitationActiveKey,
} from './invitations.active-key.js';
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

export const findActivePendingInvitationByEmailAndRole = async (
  targetEmail: string,
  targetRole: RoleInvitationTargetRole,
): Promise<InvitationRecord | null> => {
  const normalizedEmail = targetEmail.trim().toLowerCase();

  return prisma.roleInvitation.findFirst({
    where: {
      targetEmail: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
      targetRole,
      status: 'PENDING',
      usedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
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
    orderBy: { createdAt: 'desc' },
  });
};

export const clearInactiveInvitationActiveKeys = async (
  targetEmail: string,
  targetRole: RoleInvitationTargetRole,
): Promise<void> => {
  const normalizedEmail = targetEmail.trim().toLowerCase();

  await prisma.roleInvitation.updateMany({
    where: {
      targetEmail: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
      targetRole,
      activeKey: { not: null },
      OR: [
        { expiresAt: { lte: new Date() } },
        { status: { not: 'PENDING' } },
        { usedAt: { not: null } },
        { revokedAt: { not: null } },
      ],
    },
    data: clearRoleInvitationActiveKey,
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
  const targetEmail = input.targetEmail.trim().toLowerCase();

  return prisma.roleInvitation.create({
    data: {
      targetEmail,
      targetRole: input.targetRole,
      tokenHash: input.tokenHash,
      invitedBy: input.invitedBy,
      expiresAt: input.expiresAt,
      notes: input.notes,
      activeKey: buildRoleInvitationActiveKey(targetEmail, input.targetRole),
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

export const rotateInvitationTokenHashOnly = async (input: {
  id: string;
  tokenHash: string;
}): Promise<InvitationRecord> => {
  return prisma.roleInvitation.update({
    where: { id: input.id },
    data: {
      tokenHash: input.tokenHash,
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
      ...clearRoleInvitationActiveKey,
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
        ...(input.targetRole === 'DRIVER'
          ? {
              driverProfile: {
                create: input.driverProfile
                  ? {
                      displayName: input.displayName,
                      phone: input.driverProfile.phone,
                      city: input.driverProfile.city,
                      area: input.driverProfile.area,
                      addressLine: input.driverProfile.addressLine,
                      transportationType: input.driverProfile.transportationType,
                      availabilityNote: input.driverProfile.availabilityNote,
                      vehicleType: input.driverProfile.transportationType,
                      status: 'ACTIVE',
                      availability: 'OFFLINE',
                      acceptingNewJobs: false,
                    }
                  : {
                      displayName: input.displayName,
                      phone: input.phone ?? '',
                      city: 'Unknown',
                      area: 'Unknown',
                      transportationType: 'CAR',
                      vehicleType: 'UNSPECIFIED',
                      status: 'ACTIVE',
                      availability: 'OFFLINE',
                      acceptingNewJobs: false,
                    },
              },
            }
          : {}),
      },
      include: {
        roles: true,
      },
    });

    const invitationUpdate = await tx.roleInvitation.updateMany({
      where: {
        id: input.invitationId,
        status: 'PENDING',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: 'ACCEPTED',
        usedAt: new Date(),
        usedByUserId: user.id,
        ...clearRoleInvitationActiveKey,
      },
    });

    if (invitationUpdate.count !== 1) {
      throw new AppError(
        'Invalid or expired invitation token',
        400,
        COMMON_ERROR_CODES.validationError,
      );
    }

    return user;
  });
};

export const acceptInvitationForExistingUserTransaction = async (input: {
  invitationId: string;
  userId: string;
  driverProfile?: {
    phone: string;
    city: string;
    area: string;
    addressLine?: string;
    transportationType: TransportationType;
    availabilityNote?: string;
  };
}): Promise<{
  role: RoleInvitationTargetRole;
  alreadyHadRole: boolean;
  driverProfileCreated: boolean;
}> => {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.roleInvitation.findUnique({
      where: { id: input.invitationId },
    });

    if (
      !invitation ||
      invitation.status !== 'PENDING' ||
      invitation.usedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date() ||
      !invitation.targetEmail
    ) {
      throw new AppError(
        'Invitation is no longer active',
        409,
        'INVITATION_NOT_ACTIVE',
      );
    }

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      include: {
        roles: true,
        driverProfile: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404, COMMON_ERROR_CODES.notFound);
    }

    if (user.email.trim().toLowerCase() !== invitation.targetEmail.trim().toLowerCase()) {
      throw new AppError(
        'This invitation belongs to a different account',
        403,
        'INVITATION_ACCOUNT_MISMATCH',
      );
    }

    const alreadyHadRole = user.roles.some(
      (assignment) => assignment.role === invitation.targetRole,
    );
    let driverProfileCreated = false;

    if (invitation.targetRole === 'DRIVER' && !user.driverProfile) {
      if (!input.driverProfile) {
        throw new AppError(
          'Driver profile information is required',
          400,
          'INVITATION_DRIVER_PROFILE_REQUIRED',
        );
      }

      await tx.driverProfile.create({
        data: {
          userId: user.id,
          displayName: user.displayName,
          phone: input.driverProfile.phone,
          city: input.driverProfile.city,
          area: input.driverProfile.area,
          addressLine: input.driverProfile.addressLine,
          transportationType: input.driverProfile.transportationType,
          availabilityNote: input.driverProfile.availabilityNote,
          vehicleType: input.driverProfile.transportationType,
          status: 'ACTIVE',
          availability: 'OFFLINE',
          acceptingNewJobs: false,
        },
      });
      driverProfileCreated = true;
    }

    if (!alreadyHadRole) {
      await tx.userRoleAssignment.upsert({
        where: {
          userId_role: {
            userId: user.id,
            role: invitation.targetRole,
          },
        },
        create: {
          userId: user.id,
          role: invitation.targetRole,
          isPrimary: false,
          assignedBy: invitation.invitedBy,
        },
        update: {},
      });
    }

    const invitationUpdate = await tx.roleInvitation.updateMany({
      where: {
        id: invitation.id,
        status: 'PENDING',
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: 'ACCEPTED',
        usedAt: new Date(),
        usedByUserId: user.id,
        ...clearRoleInvitationActiveKey,
      },
    });

    if (invitationUpdate.count !== 1) {
      throw new AppError(
        'Invitation is no longer active',
        409,
        'INVITATION_NOT_ACTIVE',
      );
    }

    return {
      role: invitation.targetRole,
      alreadyHadRole,
      driverProfileCreated,
    };
  });
};
