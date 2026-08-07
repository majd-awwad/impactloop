import type {
  AuthTokenType,
  LearnerProfile,
  Location,
  OrganizationProfile,
  Prisma,
  SupplierProfile,
  User,
  UserRole,
  UserRoleAssignment,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

import { DEFAULT_PICKUP_COUNTRY, parsePickupArea } from './pickup-area.js';
import { resolveActiveRoleForRegistration } from './role-capabilities.js';
import { normalizeSupplierTypeInput, resolveInitialVerificationStatus } from './supplier-type.js';

export type UserWithRoles = User & { roles: UserRoleAssignment[] };

export type SupplierProfileWithLocation = SupplierProfile & {
  defaultPickupLocation: Location | null;
  organizationProfile: OrganizationProfile | null;
};

export type UserWithRolesAndProfiles = User & {
  roles: UserRoleAssignment[];
  learnerProfile: LearnerProfile | null;
  supplierProfile: SupplierProfileWithLocation | null;
};

export type UserEmailIdentity = {
  id: string;
  email: string;
};

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  user: {
    email: string;
  };
};

export type RefreshTokenWithUser = {
  id: string;
  user: UserWithRolesAndProfiles;
};

export type RegisterOnboardingInput = {
  displayName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  roles: UserRole[];
  learnerProfile?: {
    learnerType: string;
    skillLevel: string;
    interests?: string[];
    bio?: string;
  };
  supplierProfile?: {
    supplierType: string;
    publicName: string;
    description?: string;
    pickupArea: string;
  };
};

export type BecomeSupplierInput = {
  userId: string;
  supplierType: string;
  publicName: string;
  description?: string;
  pickupArea: string;
  workingHours?: string;
  pickupNotes?: string;
};

export type BecomeLearnerInput = {
  userId: string;
  learnerType: string;
  skillLevel: string;
  interests?: string[];
  bio?: string;
};

const userWithRolesAndProfilesInclude = {
  roles: true,
  learnerProfile: true,
  supplierProfile: {
    include: {
      defaultPickupLocation: true,
      organizationProfile: true,
    },
  },
} as const;

export const findUserIdByEmail = async (
  email: string,
): Promise<{ id: string } | null> => {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
};

export const findUserIdByPhone = async (
  phone: string,
): Promise<{ id: string } | null> => {
  return prisma.user.findUnique({
    where: { phone },
    select: { id: true },
  });
};

export const createUserWithOnboarding = async (
  input: RegisterOnboardingInput,
): Promise<UserWithRolesAndProfiles> => {
  const roleCreates = input.roles.map((role) => ({
    role,
    isPrimary: input.roles.length === 1 || role === 'LEARNER',
  }));

  const parsedPickupArea = input.supplierProfile
    ? parsePickupArea(input.supplierProfile.pickupArea)
    : null;

  const createdUser = await prisma.$transaction(async (tx) => {
    const activeRole = resolveActiveRoleForRegistration(input.roles);

    return tx.user.create({
      data: {
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        activeRole,
        roles: {
          create: roleCreates,
        },
        ...(input.learnerProfile
          ? {
              learnerProfile: {
                create: {
                  learnerType: input.learnerProfile.learnerType,
                  skillLevel: input.learnerProfile.skillLevel,
                  interests: input.learnerProfile.interests ?? [],
                  bio: input.learnerProfile.bio,
                },
              },
            }
          : {}),
        ...(input.supplierProfile && parsedPickupArea
          ? {
              supplierProfile: {
                create: {
                  supplierType: normalizeSupplierTypeInput(
                    input.supplierProfile.supplierType,
                  ),
                  publicName: input.supplierProfile.publicName,
                  description: input.supplierProfile.description,
                  verificationStatus: resolveInitialVerificationStatus(
                    input.supplierProfile.supplierType,
                  ),
                  defaultPickupLocation: {
                    create: {
                      country: DEFAULT_PICKUP_COUNTRY,
                      city: parsedPickupArea.city,
                      area: parsedPickupArea.area,
                      isApproximate: true,
                      visibility: 'PRIVATE',
                    },
                  },
                },
              },
            }
          : {}),
      },
      select: { id: true },
    });
  });

  const user = await findUserByIdWithRoles(createdUser.id);

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

export const findUserByEmailWithRoles = async (
  email: string,
): Promise<UserWithRolesAndProfiles | null> => {
  return prisma.user.findUnique({
    where: { email },
    include: userWithRolesAndProfilesInclude,
  });
};

export const updateLastLoginAt = async (
  userId: string,
  lastLoginAt: Date,
): Promise<Date> => {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt },
    select: { lastLoginAt: true },
  });

  if (!updated.lastLoginAt) {
    throw new Error('User not found');
  }

  return updated.lastLoginAt;
};

export const createAuthTokenRecord = async (input: {
  userId: string;
  tokenHash: string;
  tokenType: AuthTokenType;
  target: string;
  expiresAt: Date;
}): Promise<void> => {
  await prisma.authToken.create({
    data: {
      userId: input.userId,
      tokenHash: input.tokenHash,
      tokenType: input.tokenType,
      target: input.target,
      expiresAt: input.expiresAt,
    },
  });
};

export const findActiveRefreshToken = async (
  userId: string,
  tokenHash: string,
): Promise<RefreshTokenWithUser | null> => {
  return prisma.authToken.findFirst({
    where: {
      userId,
      tokenHash,
      tokenType: 'REFRESH_TOKEN',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      user: {
        include: userWithRolesAndProfilesInclude,
      },
    },
  });
};

export const rotateRefreshToken = async (input: {
  userId: string;
  tokenHash: string;
  successorTokenHash: string;
  successorExpiresAt: Date;
}): Promise<UserWithRolesAndProfiles | null> => {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.authToken.updateMany({
      where: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        tokenType: 'REFRESH_TOKEN',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (claim.count !== 1) {
      return null;
    }

    const user = await tx.user.findUnique({
      where: { id: input.userId },
      include: userWithRolesAndProfilesInclude,
    });

    if (!user) {
      throw new Error('User not found');
    }

    await tx.authToken.create({
      data: {
        userId: input.userId,
        tokenHash: input.successorTokenHash,
        tokenType: 'REFRESH_TOKEN',
        target: user.email,
        expiresAt: input.successorExpiresAt,
      },
    });

    return user;
  });
};

export const revokeRefreshTokensByHash = async (
  tokenHash: string,
): Promise<void> => {
  await prisma.authToken.updateMany({
    where: {
      tokenHash,
      tokenType: 'REFRESH_TOKEN',
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });
};

export const revokeAllRefreshTokensForUser = async (
  userId: string,
  client: typeof prisma | Prisma.TransactionClient = prisma,
): Promise<void> => {
  await client.authToken.updateMany({
    where: {
      userId,
      tokenType: 'REFRESH_TOKEN',
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });
};

export const findUserByIdWithRoles = async (
  userId: string,
): Promise<UserWithRolesAndProfiles | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: userWithRolesAndProfilesInclude,
  });
};

export const findUserEmailIdentity = async (
  email: string,
): Promise<UserEmailIdentity | null> => {
  return prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
};

export const invalidatePasswordResetTokens = async (
  userId: string,
): Promise<void> => {
  await prisma.authToken.updateMany({
    where: {
      userId,
      tokenType: 'PASSWORD_RESET',
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });
};

export const findActivePasswordResetToken = async (
  tokenHash: string,
): Promise<PasswordResetTokenRecord | null> => {
  return prisma.authToken.findFirst({
    where: {
      tokenHash,
      tokenType: 'PASSWORD_RESET',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });
};

export const completePasswordReset = async (input: {
  tokenId: string;
  userId: string;
  passwordHash: string;
}): Promise<boolean> => {
  return prisma.$transaction(async (tx) => {
    const usedAt = new Date();

    const claim = await tx.authToken.updateMany({
      where: {
        id: input.tokenId,
        userId: input.userId,
        tokenType: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt },
    });

    if (claim.count !== 1) {
      return false;
    }

    await tx.user.update({
      where: { id: input.userId },
      data: { passwordHash: input.passwordHash },
    });

    await tx.authToken.updateMany({
      where: {
        userId: input.userId,
        tokenType: 'REFRESH_TOKEN',
        usedAt: null,
      },
      data: { usedAt },
    });

    return true;
  });
};

export const findUserPasswordHashById = async (
  userId: string,
): Promise<{ id: string; passwordHash: string } | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
    },
  });
};

export const updateUserPasswordHash = async (input: {
  userId: string;
  passwordHash: string;
}): Promise<void> => {
  await prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash: input.passwordHash },
  });
};

export const changePasswordAndRevokeRefreshTokens = async (input: {
  userId: string;
  passwordHash: string;
}): Promise<void> => {
  const usedAt = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: input.userId },
      data: { passwordHash: input.passwordHash },
    }),
    prisma.authToken.updateMany({
      where: {
        userId: input.userId,
        tokenType: 'REFRESH_TOKEN',
        usedAt: null,
      },
      data: { usedAt },
    }),
  ]);
};

export const setUserActiveRole = async (
  userId: string,
  activeRole: UserRole,
): Promise<UserRole> => {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { activeRole },
    select: { activeRole: true },
  });

  if (!updated.activeRole) {
    throw new Error('User not found');
  }

  return updated.activeRole;
};

export const ensureUserRole = async (
  userId: string,
  role: UserRole,
): Promise<void> => {
  await prisma.userRoleAssignment.upsert({
    where: {
      userId_role: {
        userId,
        role,
      },
    },
    create: {
      userId,
      role,
      isPrimary: false,
    },
    update: {},
  });
};

export const becomeSupplierForUser = async (
  input: BecomeSupplierInput,
): Promise<UserWithRolesAndProfiles> => {
  const parsedPickupArea = parsePickupArea(input.pickupArea);
  const normalizedSupplierType = normalizeSupplierTypeInput(input.supplierType);

  const userId = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: input.userId },
      select: {
        id: true,
        supplierProfile: {
          select: { id: true },
        },
      },
    });

    if (!existing) {
      throw new Error('User not found');
    }

    const existingProfiles = await tx.supplierProfile.findMany({
      where: { userId: input.userId },
      select: { id: true },
    });

    if (existing.supplierProfile || existingProfiles.length > 0) {
      await tx.userRoleAssignment.upsert({
        where: {
          userId_role: {
            userId: input.userId,
            role: 'SUPPLIER',
          },
        },
        create: {
          userId: input.userId,
          role: 'SUPPLIER',
          isPrimary: false,
        },
        update: {},
      });

      await tx.user.update({
        where: { id: input.userId },
        data: { activeRole: 'SUPPLIER' },
        select: { id: true },
      });

      return input.userId;
    }

    await tx.userRoleAssignment.upsert({
      where: {
        userId_role: {
          userId: input.userId,
          role: 'SUPPLIER',
        },
      },
      create: {
        userId: input.userId,
        role: 'SUPPLIER',
        isPrimary: false,
      },
      update: {},
    });

    const pickupLocation = await tx.location.create({
      data: {
        country: DEFAULT_PICKUP_COUNTRY,
        city: parsedPickupArea.city,
        area: parsedPickupArea.area,
        isApproximate: true,
        visibility: 'PRIVATE',
      },
    });

    await tx.supplierProfile.create({
      data: {
        userId: input.userId,
        supplierType: normalizedSupplierType,
        publicName: input.publicName,
        description: input.description,
        verificationStatus: resolveInitialVerificationStatus(
          input.supplierType,
        ),
        defaultPickupLocationId: pickupLocation.id,
      },
    });

    await tx.user.update({
      where: { id: input.userId },
      data: { activeRole: 'SUPPLIER' },
      select: { id: true },
    });

    return input.userId;
  });

  const user = await findUserByIdWithRoles(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};

export const becomeLearnerForUser = async (
  input: BecomeLearnerInput,
): Promise<UserWithRolesAndProfiles> => {
  const userId = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true },
    });

    if (!existing) {
      throw new Error('User not found');
    }

    await tx.userRoleAssignment.upsert({
      where: {
        userId_role: {
          userId: input.userId,
          role: 'LEARNER',
        },
      },
      create: {
        userId: input.userId,
        role: 'LEARNER',
        isPrimary: false,
      },
      update: {},
    });

    await tx.learnerProfile.create({
      data: {
        userId: input.userId,
        learnerType: input.learnerType,
        skillLevel: input.skillLevel,
        interests: input.interests ?? [],
        bio: input.bio,
      },
    });

    await tx.user.update({
      where: { id: input.userId },
      data: { activeRole: 'LEARNER' },
      select: { id: true },
    });

    return input.userId;
  });

  const user = await findUserByIdWithRoles(userId);

  if (!user) {
    throw new Error('User not found');
  }

  return user;
};
