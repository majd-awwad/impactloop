import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import { getAuthenticatedUser, type UserSummary } from '../auth/auth.service.js';
import { invalidateLearnerHomeCache } from '../learner-home/learner-home.service.js';
import { deleteReplacedProfileUpload } from '../uploads/local-upload-cleanup.js';

import * as profileRepository from './profile.repository.js';

import type {
  UpdateLearnerProfileInput,
  UpdateProfileInput,
} from './profile.validation.js';
import {
  updateLearnerProfileSchema,
  updateProfileSchema,
} from './profile.validation.js';

const normalizePhone = (phone: string | null | undefined): string | null => {
  if (phone == null) {
    return null;
  }

  const trimmed = phone.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const updateProfileForUser = async (
  userId: string,
  input: UpdateProfileInput,
): Promise<UserSummary> => {
  const parsed = updateProfileSchema.parse(input);
  const existing = await profileRepository.findUserProfileContext(userId);

  if (!existing) {
    throw new AppError('User not found', 404, COMMON_ERROR_CODES.notFound);
  }

  const nextPhone =
    parsed.phone === undefined ? undefined : normalizePhone(parsed.phone);

  if (nextPhone) {
    const conflictingUser =
      await profileRepository.findUserIdByPhoneExcludingUser(nextPhone, userId);

    if (conflictingUser) {
      throw new AppError(
        'Phone number is already registered',
        409,
        COMMON_ERROR_CODES.conflict,
      );
    }
  }

  const currentPhone = normalizePhone(existing.phone);
  const phoneChanged =
    nextPhone !== undefined && nextPhone !== currentPhone;

  await profileRepository.updateUserProfile(userId, {
    ...parsed,
    phone: nextPhone,
    clearPhoneVerifiedAt: phoneChanged,
  });

  if (parsed.profileImageUrl !== undefined) {
    deleteReplacedProfileUpload(
      existing.profileImageUrl,
      parsed.profileImageUrl,
    );
  }

  return getAuthenticatedUser(userId);
};

export const updateLearnerProfileForUser = async (
  userId: string,
  input: UpdateLearnerProfileInput,
): Promise<UserSummary> => {
  const parsed = updateLearnerProfileSchema.parse(input);
  const existing = await profileRepository.findUserProfileContext(userId);

  if (!existing) {
    throw new AppError('User not found', 404, COMMON_ERROR_CODES.notFound);
  }

  const hasLearnerRole = existing.roles.some(
    (assignment) => assignment.role === 'LEARNER',
  );

  if (!hasLearnerRole) {
    throw new AppError(
      'Learner profile updates require the LEARNER role',
      403,
      COMMON_ERROR_CODES.forbidden,
    );
  }

  await profileRepository.upsertLearnerProfile(userId, parsed);
  invalidateLearnerHomeCache(userId);

  return getAuthenticatedUser(userId);
};
