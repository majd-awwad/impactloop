import type {
  AccountStatus,
  UserRole,
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

import { checkRateLimit } from '../../middlewares/rate-limit.middleware.js';

import * as authRepository from './auth.repository.js';

import { formatPickupAreaLabel } from './pickup-area.js';
import {
  canBecomeLearner,
  canBecomeSupplier,
  canSwitchToLearner,
  canSwitchToSupplier,
  isBlockedBecomeSupplierType,
  isBlockedLearnerPortalSwitch,
  isPersonalBecomeSupplierType,
  ORGANIZATION_BECOME_SUPPLIER_MESSAGE,
  PERSONAL_SUPPLIER_CANNOT_BECOME_LEARNER_MESSAGE,
  resolveDefaultActiveRole,
  resolveDefaultPortalRoute,
  userHasRole as roleCapabilityUserHasRole,
  type PortalRole,
} from './role-capabilities.js';
import {
  isIndividualSupplierType,
  normalizeSupplierVerificationStatus,
} from '../supplier/supplier-verification.status.js';
import { getAuthEmailProvider } from './email/index.js';

import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.validation.js';
import { registerSchema } from './auth.validation.js';

export type LearnerProfileSummary = {
  learnerType: string;
  skillLevel: string;
  interests: string[];
  bio: string | null;
};

export type SupplierProfileSummary = {
  id: string;
  supplierType: string;
  publicName: string;
  description: string | null;
  pickupAreaLabel: string | null;
  verificationStatus: string;
  verificationAdminNote: string | null;
  verificationSubmittedAt: string | null;
  verificationDocumentName: string | null;
};

export type UserSummary = {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  accountStatus: AccountStatus;
  profileImageUrl: string | null;
  roles: UserRole[];
  activeRole: UserRole;
  canSwitchToLearner: boolean;
  canSwitchToSupplier: boolean;
  canBecomeLearner: boolean;
  defaultPortalRoute: string;
  learnerProfile: LearnerProfileSummary | null;
  supplierProfile: SupplierProfileSummary | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
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
};

const PASSWORD_RESET_SAFE_MESSAGE =
  'If an account with that email exists, password reset instructions have been sent.';

const PASSWORD_RESET_ACCOUNT_RATE_LIMIT = {
  name: 'password-reset-account',
  windowMs: 15 * 60 * 1000,
  max: 5,
};

const toUserSummary = (
  user: {
    id: string;
    displayName: string;
    email: string;
    phone: string | null;
    accountStatus: AccountStatus;
    profileImageUrl: string | null;
    activeRole: UserRole | null;
    emailVerifiedAt: Date | null;
    phoneVerifiedAt: Date | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    roles: { role: UserRole }[];
    learnerProfile?: authRepository.UserWithRolesAndProfiles['learnerProfile'];
    supplierProfile?: authRepository.UserWithRolesAndProfiles['supplierProfile'];
  },
): UserSummary => {
  const roles = user.roles.map((assignment) => assignment.role);
  const supplierType = user.supplierProfile?.supplierType ?? null;
  const capabilityInput = {
    roles,
    supplierType,
    hasSupplierProfile: user.supplierProfile != null,
    hasLearnerProfile: user.learnerProfile != null,
  };
  const activeRole = resolveDefaultActiveRole({
    roles,
    storedActiveRole: user.activeRole,
  });

  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    phone: user.phone,
    accountStatus: user.accountStatus,
    profileImageUrl: user.profileImageUrl,
    roles,
    activeRole,
    canSwitchToLearner: canSwitchToLearner(capabilityInput),
    canSwitchToSupplier: canSwitchToSupplier(capabilityInput),
    canBecomeLearner: canBecomeLearner(capabilityInput),
    defaultPortalRoute: resolveDefaultPortalRoute(activeRole),
    learnerProfile: user.learnerProfile
      ? {
          learnerType: user.learnerProfile.learnerType ?? '',
          skillLevel: user.learnerProfile.skillLevel ?? '',
          interests: user.learnerProfile.interests,
          bio: user.learnerProfile.bio,
        }
      : null,
    supplierProfile: user.supplierProfile
      ? {
          id: user.supplierProfile.id,
          supplierType: user.supplierProfile.supplierType ?? '',
          publicName: user.supplierProfile.publicName ?? '',
          description: user.supplierProfile.description,
          pickupAreaLabel: user.supplierProfile.defaultPickupLocation
            ? formatPickupAreaLabel({
                city: user.supplierProfile.defaultPickupLocation.city,
                area: user.supplierProfile.defaultPickupLocation.area,
              })
            : null,
          verificationStatus: normalizeSupplierVerificationStatus(
            user.supplierProfile.verificationStatus,
          ),
          verificationAdminNote:
            normalizeSupplierVerificationStatus(
              user.supplierProfile.verificationStatus,
            ) === 'REJECTED' ||
            normalizeSupplierVerificationStatus(
              user.supplierProfile.verificationStatus,
            ) === 'CHANGES_REQUESTED'
              ? user.supplierProfile.verificationAdminNote
              : null,
          verificationSubmittedAt:
            user.supplierProfile.verificationSubmittedAt?.toISOString() ?? null,
          verificationDocumentName:
            user.supplierProfile.organizationProfile?.verificationDocumentName ??
            null,
        }
      : null,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
};

const assertAccountCanLogin = (accountStatus: AccountStatus): void => {
  if (accountStatus === 'SUSPENDED' || accountStatus === 'DISABLED') {
    throw new AppError(
      'Your account has been suspended after repeated verified reports. Contact admin.',
      403,
      'ACCOUNT_SUSPENDED',
    );
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

const assertPasswordResetLinkConfig = (): void => {
  if (!env.appPublicBaseUrl) {
    throw new AppError(
      'Password reset links are not configured.',
      500,
      'CONFIGURATION_ERROR',
    );
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(env.appPublicBaseUrl);
  } catch {
    throw new AppError(
      'Password reset links are not configured.',
      500,
      'CONFIGURATION_ERROR',
    );
  }

  if (env.nodeEnv === 'production' && parsedUrl.protocol !== 'https:') {
    throw new AppError(
      'Password reset links must use HTTPS in production.',
      500,
      'CONFIGURATION_ERROR',
    );
  }
};

const buildPasswordResetLink = (token: string): string => {
  assertPasswordResetLinkConfig();

  const resetUrl = new URL('/reset-password', `${env.appPublicBaseUrl}/`);
  resetUrl.searchParams.set('token', token);

  return resetUrl.toString();
};

const logAuthEmailFailure = (event: string, error?: string): void => {
  console.error(`[Auth email] ${event} failed`, error ?? 'Unknown email error');
};

const createAuthSession = async (
  user: Parameters<typeof toUserSummary>[0],
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
    user: toUserSummary(user),
  };
};

export const createAuthSessionForUser = createAuthSession;

export const registerUser = async (
  input: RegisterInput,
): Promise<AuthResult> => {
  const parsed = registerSchema.parse(input);
  const existingUser = await authRepository.findUserIdByEmail(parsed.email);

  if (existingUser) {
    throw new AppError('Email is already registered', 409, 'CONFLICT');
  }

  if (parsed.phone) {
    const existingPhone = await authRepository.findUserIdByPhone(parsed.phone);

    if (existingPhone) {
      throw new AppError('Phone number is already registered', 409, 'CONFLICT');
    }
  }

  const passwordHash = await hashPassword(parsed.password);

  const user = await authRepository.createUserWithOnboarding({
    displayName: parsed.displayName,
    email: parsed.email,
    phone: parsed.phone,
    passwordHash,
    roles: parsed.roles,
    learnerProfile: parsed.learnerProfile,
    supplierProfile: parsed.supplierProfile,
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

  return toUserSummary(user);
};

export const requestPasswordReset = async (
  email: string,
): Promise<ForgotPasswordResult> => {
  assertPasswordResetLinkConfig();

  const user = await authRepository.findUserEmailIdentity(email);

  if (user) {
    const resetToken = generateOpaqueToken();
    const expiresAt = getPasswordResetExpiry();
    const resetLink = buildPasswordResetLink(resetToken);

    await authRepository.invalidatePasswordResetTokens(user.id);

    await authRepository.createAuthTokenRecord({
      userId: user.id,
      tokenHash: hashToken(resetToken),
      tokenType: 'PASSWORD_RESET',
      target: user.email,
      expiresAt,
    });

    const emailResult = await getAuthEmailProvider().sendPasswordResetEmail({
      recipientEmail: user.email,
      resetLink,
      expiresAt,
    });

    if (emailResult.status === 'FAILED') {
      logAuthEmailFailure('Password reset email', emailResult.sendError);
    }
  }

  return {
    message: PASSWORD_RESET_SAFE_MESSAGE,
  };
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

  checkRateLimit(
    storedToken.userId,
    PASSWORD_RESET_ACCOUNT_RATE_LIMIT,
  );

  const passwordHash = await hashPassword(newPassword);

  await authRepository.completePasswordReset({
    tokenId: storedToken.id,
    userId: storedToken.userId,
    passwordHash,
  });

  const emailResult = await getAuthEmailProvider().sendPasswordChangedEmail({
    recipientEmail: storedToken.user.email,
  });

  if (emailResult.status === 'FAILED') {
    logAuthEmailFailure('Password changed email', emailResult.sendError);
  }
};

export const changePasswordForUser = async (
  userId: string,
  input: ChangePasswordInput,
): Promise<AuthResult> => {
  const user = await authRepository.findUserPasswordHashById(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const passwordMatches = await comparePassword(
    input.currentPassword,
    user.passwordHash,
  );

  if (!passwordMatches) {
    throw new AppError(
      'Current password is incorrect.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const passwordHash = await hashPassword(input.newPassword);

  await authRepository.changePasswordAndRevokeRefreshTokens({
    userId: user.id,
    passwordHash,
  });

  const freshUser = await authRepository.findUserByIdWithRoles(user.id);

  if (!freshUser) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const session = await createAuthSession(freshUser);

  const emailResult = await getAuthEmailProvider().sendPasswordChangedEmail({
    recipientEmail: freshUser.email,
  });

  if (emailResult.status === 'FAILED') {
    logAuthEmailFailure('Password changed email', emailResult.sendError);
  }

  return session;
};

export const becomeSupplier = async (
  userId: string,
  input: authRepository.BecomeSupplierInput,
): Promise<AuthResult> => {
  const user = await authRepository.findUserByIdWithRoles(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const roles = user.roles.map((assignment) => assignment.role);
  const capabilityInput = {
    roles,
    supplierType: user.supplierProfile?.supplierType ?? null,
    hasSupplierProfile: user.supplierProfile != null,
    hasLearnerProfile: user.learnerProfile != null,
  };

  if (!canBecomeSupplier(capabilityInput)) {
    if (
      roleCapabilityUserHasRole(roles, 'SUPPLIER') ||
      user.supplierProfile != null
    ) {
      throw new AppError(
        'You already have a supplier profile.',
        409,
        'CONFLICT',
      );
    }

    throw new AppError(
      'This account cannot use the become-supplier flow',
      403,
      'FORBIDDEN',
    );
  }

  if (isBlockedBecomeSupplierType(input.supplierType)) {
    throw new AppError(
      ORGANIZATION_BECOME_SUPPLIER_MESSAGE,
      400,
      'VALIDATION_ERROR',
    );
  }

  if (!isPersonalBecomeSupplierType(input.supplierType)) {
    throw new AppError(
      'Unsupported supplier type for this flow.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const descriptionParts = [
    input.description?.trim(),
    input.workingHours?.trim()
      ? `Working hours: ${input.workingHours.trim()}`
      : null,
    input.pickupNotes?.trim()
      ? `Pickup notes: ${input.pickupNotes.trim()}`
      : null,
  ].filter((part): part is string => Boolean(part && part.length > 0));

  const updatedUser = await authRepository.becomeSupplierForUser({
    userId,
    supplierType: input.supplierType,
    publicName: input.publicName,
    description:
      descriptionParts.length > 0 ? descriptionParts.join('\n\n') : undefined,
    pickupArea: input.pickupArea,
  });

  return createAuthSession(updatedUser);
};

export const becomeLearner = async (
  userId: string,
  input: authRepository.BecomeLearnerInput,
): Promise<AuthResult> => {
  const user = await authRepository.findUserByIdWithRoles(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const roles = user.roles.map((assignment) => assignment.role);
  const supplierType = user.supplierProfile?.supplierType ?? null;
  const capabilityInput = {
    roles,
    supplierType,
    hasSupplierProfile: user.supplierProfile != null,
    hasLearnerProfile: user.learnerProfile != null,
  };

  if (!isIndividualSupplierType(supplierType)) {
    throw new AppError(
      PERSONAL_SUPPLIER_CANNOT_BECOME_LEARNER_MESSAGE,
      403,
      'FORBIDDEN',
    );
  }

  if (!canBecomeLearner(capabilityInput)) {
    if (
      roleCapabilityUserHasRole(roles, 'LEARNER') ||
      user.learnerProfile != null
    ) {
      throw new AppError(
        'You already have learner access on this account.',
        409,
        'CONFLICT',
      );
    }

    throw new AppError(
      PERSONAL_SUPPLIER_CANNOT_BECOME_LEARNER_MESSAGE,
      403,
      'FORBIDDEN',
    );
  }

  const updatedUser = await authRepository.becomeLearnerForUser({
    userId,
    learnerType: input.learnerType,
    skillLevel: input.skillLevel,
    interests: input.interests,
    bio: input.bio,
  });

  return createAuthSession(updatedUser);
};

export const switchActiveRole = async (
  userId: string,
  requestedRole: PortalRole,
): Promise<AuthResult> => {
  const user = await authRepository.findUserByIdWithRoles(userId);

  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  const roles = user.roles.map((assignment) => assignment.role);
  const supplierType = user.supplierProfile?.supplierType ?? null;
  const capabilityInput = {
    roles,
    supplierType,
    hasSupplierProfile: user.supplierProfile != null,
    hasLearnerProfile: user.learnerProfile != null,
  };

  if (requestedRole === 'SUPPLIER') {
    if (!canSwitchToSupplier(capabilityInput)) {
      throw new AppError(
        'Supplier portal is not available for this account',
        403,
        'FORBIDDEN',
      );
    }
  } else if (requestedRole === 'LEARNER') {
    if (
      capabilityInput.hasSupplierProfile &&
      isBlockedLearnerPortalSwitch(supplierType)
    ) {
      throw new AppError(
        'Organization supplier accounts cannot switch to learner mode.',
        403,
        'FORBIDDEN',
      );
    }

    if (!canSwitchToLearner(capabilityInput)) {
      throw new AppError(
        'Learner portal is not available for this account',
        403,
        'FORBIDDEN',
      );
    }
  } else {
    throw new AppError('Invalid active role', 400, 'VALIDATION_ERROR');
  }

  await authRepository.setUserActiveRole(userId, requestedRole);

  const freshUser = await authRepository.findUserByIdWithRoles(userId);

  if (!freshUser) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  return createAuthSession(freshUser);
};
