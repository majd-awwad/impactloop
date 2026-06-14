import type {
  AuthTokenType,
  User,
  UserRole,
  UserRoleAssignment,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

export type UserWithRoles = User & { roles: UserRoleAssignment[] };

export type UserEmailIdentity = {
  id: string;
  email: string;
};

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
};

export type RefreshTokenWithUser = {
  id: string;
  user: UserWithRoles;
};

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

export const createUserWithRole = async (input: {
  displayName: string;
  email: string;
  phone?: string;
  passwordHash: string;
  role: UserRole;
}): Promise<UserWithRoles> => {
  return prisma.user.create({
    data: {
      displayName: input.displayName,
      email: input.email,
      phone: input.phone,
      passwordHash: input.passwordHash,
      roles: {
        create: {
          role: input.role,
          isPrimary: true,
        },
      },
    },
    include: {
      roles: true,
    },
  });
};

export const findUserByEmailWithRoles = async (
  email: string,
): Promise<UserWithRoles | null> => {
  return prisma.user.findUnique({
    where: { email },
    include: {
      roles: true,
    },
  });
};

export const updateLastLoginAt = async (
  userId: string,
): Promise<UserWithRoles> => {
  return prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
    include: {
      roles: true,
    },
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
        include: {
          roles: true,
        },
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
): Promise<UserWithRoles | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      roles: true,
    },
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
    },
  });
};

export const completePasswordReset = async (input: {
  tokenId: string;
  userId: string;
  passwordHash: string;
}): Promise<void> => {
  await prisma.$transaction([
    prisma.authToken.update({
      where: { id: input.tokenId },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: input.userId },
      data: { passwordHash: input.passwordHash },
    }),
  ]);
};
