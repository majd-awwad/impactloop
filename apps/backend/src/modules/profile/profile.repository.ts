import { prisma } from '../../database/prisma.js';

import type { UpdateLearnerProfileInput, UpdateProfileInput } from './profile.validation.js';

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

export const findUserProfileContext = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      phoneVerifiedAt: true,
      roles: {
        select: { role: true },
      },
      learnerProfile: {
        select: { id: true },
      },
    },
  });
};

export const findUserIdByPhoneExcludingUser = async (
  phone: string,
  userId: string,
): Promise<{ id: string } | null> => {
  return prisma.user.findFirst({
    where: {
      phone,
      NOT: { id: userId },
    },
    select: { id: true },
  });
};

export const updateUserProfile = async (
  userId: string,
  input: UpdateProfileInput & { clearPhoneVerifiedAt?: boolean },
) => {
  const data: {
    displayName?: string;
    phone?: string | null;
    profileImageUrl?: string | null;
    phoneVerifiedAt?: null;
  } = {};

  if (input.displayName !== undefined) {
    data.displayName = input.displayName;
  }

  if (input.phone !== undefined) {
    data.phone = input.phone;
  }

  if (input.profileImageUrl !== undefined) {
    data.profileImageUrl = input.profileImageUrl;
  }

  if (input.clearPhoneVerifiedAt) {
    data.phoneVerifiedAt = null;
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    include: userWithRolesAndProfilesInclude,
  });
};

export const upsertLearnerProfile = async (
  userId: string,
  input: UpdateLearnerProfileInput,
) => {
  return prisma.learnerProfile.upsert({
    where: { userId },
    create: {
      userId,
      learnerType: input.learnerType,
      skillLevel: input.skillLevel,
      interests: input.interests ?? [],
      bio: input.bio ?? null,
    },
    update: {
      learnerType: input.learnerType,
      skillLevel: input.skillLevel,
      interests: input.interests ?? [],
      bio: input.bio ?? null,
    },
  });
};
