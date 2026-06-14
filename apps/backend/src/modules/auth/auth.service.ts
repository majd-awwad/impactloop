import type {
  AccountStatus,
  User,
  UserRole,
  UserRoleAssignment,
} from '../../generated/prisma/client.js';

import { env } from '../../config/env.js';

import { AppError } from '../../utils/app-error.js';

import {
  getRefreshTokenExpiry,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt.js';

import { comparePassword, hashPassword } from '../../utils/password.js';

import { generateOpaqueToken, hashToken } from '../../utils/token.js';

import * as authRepository from './auth.repository.js';

import type { LoginInput, RegisterInput } from './auth.validation.js';

export type UserSummary = {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  accountStatus: AccountStatus;
  profileImageUrl: string | null;
  roles: UserRole[];
  emailVerifiedAt: string | null;
  createdAt: string;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
};

export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
};

export type ForgotPasswordResult = {
  message: string;
  resetToken?: string;
};

const PASSWORD_RESET_SAFE_MESSAGE =
  'If an account with that email exists, password reset instructions have been sent.';

const toUserSummary = (
  user: User,
  roles: Pick<UserRoleAssignment, 'role'>[],
): UserSummary => ({
  id: user.id,
  displayName: user.displayName,
  email: user.email,
  phone: user.phone,
  accountStatus: user.accountStatus,
  profileImageUrl: user.profileImageUrl,
  roles: roles.map((assignment) => assignment.role),
  emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  createdAt: user.createdAt.toISOString(),
});

const assertAccountCanLogin = (accountStatus: AccountStatus): void => {
  if (accountStatus === 'SUSPENDED' || accountStatus === 'DISABLED') {
    throw new AppError('Account is not allowed to sign in', 403, 'FORBIDDEN');
  }
};

const getPasswordResetExpiry = (): Date => {
  const duration = env.passwordResetExpiresIn;
  const match = duration.match(/^(\d+)([smhd])$/);

  if (!match) {
    return new Date(Date.now() + 60 * 60 * 1000);
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

const createAuthSession = async (
  user: authRepository.UserWithRoles,
): Promise<AuthResult> => {
  const roles = user.roles.map((assignment) => assignment.role);
  const tokenId = generateOpaqueToken();

  const accessToken = signAccessToken({
    sub: user.id,
    roles,
  });

  const refreshToken = signRefreshToken({
    sub: user.id,
    jti: tokenId,
  });

  await authRepository.createAuthTokenRecord({
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    tokenType: 'REFRESH_TOKEN',
    target: user.email,
    expiresAt: getRefreshTokenExpiry(),
  });

  return {
    accessToken,
    refreshToken,
    user: toUserSummary(user, user.roles),
  };
};

export const registerUser = async (
  input: RegisterInput,
): Promise<AuthResult> => {
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

  const user = await authRepository.createUserWithRole({
    displayName: input.displayName,
    email: input.email,
    phone: input.phone,
    passwordHash,
    role: input.role,
  });

  return createAuthSession(user);
};

export const loginUser = async (input: LoginInput): Promise<AuthResult> => {
  const user = await authRepository.findUserByEmailWithRoles(input.email);

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'UNAUTHENTICATED');
  }

  assertAccountCanLogin(user.accountStatus);

  const passwordMatches = await comparePassword(
    input.password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AppError('Invalid email or password', 401, 'UNAUTHENTICATED');
  }

  const updatedUser = await authRepository.updateLastLoginAt(user.id);

  return createAuthSession(updatedUser);
};

export const refreshAuthSession = async (
  refreshToken: string,
): Promise<RefreshResult> => {
  let payload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(
      'Invalid or expired refresh token',
      401,
      'UNAUTHENTICATED',
    );
  }

  const storedToken = await authRepository.findActiveRefreshToken(
    payload.sub,
    hashToken(refreshToken),
  );

  if (!storedToken) {
    throw new AppError(
      'Refresh token is invalid or revoked',
      401,
      'UNAUTHENTICATED',
    );
  }

  assertAccountCanLogin(storedToken.user.accountStatus);

  await authRepository.markAuthTokenUsed(storedToken.id);

  const session = await createAuthSession(storedToken.user);

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  };
};

export const logoutUser = async (refreshToken: string): Promise<void> => {
  await authRepository.revokeRefreshTokensByHash(hashToken(refreshToken));
};

export const getAuthenticatedUser = async (
  userId: string,
): Promise<UserSummary> => {
  const user = await authRepository.findUserByIdWithRoles(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  return toUserSummary(user, user.roles);
};

export const requestPasswordReset = async (
  email: string,
): Promise<ForgotPasswordResult> => {
  const user = await authRepository.findUserEmailIdentity(email);

  let resetToken: string | undefined;

  if (user) {
    resetToken = generateOpaqueToken();

    await authRepository.invalidatePasswordResetTokens(user.id);

    await authRepository.createAuthTokenRecord({
      userId: user.id,
      tokenHash: hashToken(resetToken),
      tokenType: 'PASSWORD_RESET',
      target: user.email,
      expiresAt: getPasswordResetExpiry(),
    });
  }

  const result: ForgotPasswordResult = {
    message: PASSWORD_RESET_SAFE_MESSAGE,
  };

  if (env.nodeEnv === 'development' && resetToken) {
    // TODO: Remove dev-only resetToken exposure once email delivery is implemented.
    result.resetToken = resetToken;
  }

  return result;
};

export const resetPasswordWithToken = async (
  token: string,
  newPassword: string,
): Promise<void> => {
  const storedToken = await authRepository.findActivePasswordResetToken(
    hashToken(token),
  );

  if (!storedToken) {
    throw new AppError(
      'Invalid or expired reset token',
      400,
      'VALIDATION_ERROR',
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await authRepository.completePasswordReset({
    tokenId: storedToken.id,
    userId: storedToken.userId,
    passwordHash,
  });
};
