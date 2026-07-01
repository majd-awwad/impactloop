import type {
  AuthTokenType,
  LearnerProfile,
  Location,
  OrganizationProfile,
  SupplierProfile,
  User,
  UserRole,
  UserRoleAssignment,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

import { DEFAULT_PICKUP_COUNTRY, parsePickupArea } from './pickup-area.js';
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

  return prisma.$transaction(async (tx) => {
    return tx.user.create({
      data: {
        displayName: input.displayName,
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
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
      include: userWithRolesAndProfilesInclude,
    });
  });
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
): Promise<UserWithRolesAndProfiles> => {
  return prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
    include: userWithRolesAndProfilesInclude,
  });
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

export const markAuthTokenUsed = async (tokenId: string): Promise<void> => {
  await prisma.authToken.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
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
}): Promise<void> => {
  const usedAt = new Date();

  await prisma.$transaction([
    prisma.authToken.update({
      where: { id: input.tokenId },
      data: { usedAt },
    }),
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
