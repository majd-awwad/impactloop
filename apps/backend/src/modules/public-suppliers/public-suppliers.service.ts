import { AppError } from '../../utils/app-error.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';
import { normalizeSupplierVerificationStatus } from '../supplier/supplier-verification.status.js';
import {
  getMaterials,
  getMaterialById,
} from '../materials/materials.service.js';
import type { MaterialsQuery } from '../materials/materials.validation.js';

import * as publicSuppliersRepository from './public-suppliers.repository.js';

export type PublicSupplierProfileDto = {
  id: string;
  displayName: string;
  supplierType: string | null;
  description: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  city: string | null;
  area: string | null;
  isVerified: boolean;
  materialsCount: number;
  followersCount: number;
  isFollowedByViewer: boolean;
};

export type SupplierFollowMutationDto = {
  supplierProfileId: string;
  followersCount: number;
  isFollowedByViewer: boolean;
};

type PublicSupplierProfileRecord = NonNullable<
  Awaited<ReturnType<typeof publicSuppliersRepository.findPublicSupplierProfileById>>
>;

const resolvePublicSupplierVerified = (
  verificationStatus: string | null | undefined,
) => {
  if (!verificationStatus) {
    return false;
  }

  const status = normalizeSupplierVerificationStatus(verificationStatus);
  return status === 'APPROVED' || status === 'NOT_REQUIRED';
};

const resolvePublicSupplierDisplayName = (
  profile: PublicSupplierProfileRecord,
) => {
  return (
    profile.publicName?.trim() ||
    profile.user.displayName?.trim() ||
    'ImpactLoop supplier'
  );
};

const resolvePublicSupplierAvatarUrl = (
  profile: PublicSupplierProfileRecord,
) => {
  return profile.avatarImageUrl ?? profile.user.profileImageUrl ?? null;
};

const resolvePublicSupplierCity = (profile: PublicSupplierProfileRecord) => {
  return (
    profile.defaultPickupLocation?.city ??
    profile.organizationProfile?.businessLocation?.city ??
    null
  );
};

const resolvePublicSupplierArea = (profile: PublicSupplierProfileRecord) => {
  return (
    profile.defaultPickupLocation?.area ??
    profile.organizationProfile?.businessLocation?.area ??
    null
  );
};

const mapPublicSupplierProfile = (
  profile: PublicSupplierProfileRecord,
  engagement: {
    materialsCount: number;
    followersCount: number;
    isFollowedByViewer: boolean;
  },
): PublicSupplierProfileDto => ({
  id: profile.id,
  displayName: resolvePublicSupplierDisplayName(profile),
  supplierType: profile.supplierType,
  description: profile.description,
  avatarUrl: resolvePublicSupplierAvatarUrl(profile),
  coverImageUrl: profile.coverImageUrl,
  city: resolvePublicSupplierCity(profile),
  area: resolvePublicSupplierArea(profile),
  isVerified: resolvePublicSupplierVerified(profile.verificationStatus),
  materialsCount: engagement.materialsCount,
  followersCount: engagement.followersCount,
  isFollowedByViewer: engagement.isFollowedByViewer,
});

const assertSupplierProfileExists = async (supplierProfileId: string) => {
  const profile =
    await publicSuppliersRepository.findPublicSupplierProfileById(
      supplierProfileId,
    );

  if (!profile) {
    throw new AppError('Supplier profile not found', 404, 'NOT_FOUND');
  }

  return profile;
};

const resolveIsFollowedByViewer = async (
  supplierProfileId: string,
  viewer?: AccessTokenPayload,
) => {
  if (!viewer?.roles.includes('LEARNER')) {
    return false;
  }

  const followedIds = await publicSuppliersRepository.findFollowedSupplierIds(
    viewer.sub,
    [supplierProfileId],
  );

  return followedIds.has(supplierProfileId);
};

export const getPublicSupplierById = async (
  supplierProfileId: string,
  viewer?: AccessTokenPayload,
) => {
  const profile = await assertSupplierProfileExists(supplierProfileId);

  const [materialsCount, followersCount, isFollowedByViewer] =
    await Promise.all([
      publicSuppliersRepository.countPublicMaterialsForSupplier(profile.id),
      publicSuppliersRepository.countSupplierFollowers(profile.id),
      resolveIsFollowedByViewer(profile.id, viewer),
    ]);

  return mapPublicSupplierProfile(profile, {
    materialsCount,
    followersCount,
    isFollowedByViewer,
  });
};

export const getPublicSupplierMaterials = async (
  supplierProfileId: string,
  query: MaterialsQuery,
  viewer?: AccessTokenPayload,
) => {
  await assertSupplierProfileExists(supplierProfileId);

  return getMaterials(query, viewer, { supplierProfileId });
};

export const followSupplierById = async (
  supplierProfileId: string,
  userId: string,
) => {
  const profile = await assertSupplierProfileExists(supplierProfileId);

  if (profile.userId === userId) {
    throw new AppError(
      'You cannot follow your own supplier profile',
      409,
      'SELF_FOLLOW_NOT_ALLOWED',
    );
  }

  await publicSuppliersRepository.setSupplierFollowed(supplierProfileId, userId);
  const followersCount =
    await publicSuppliersRepository.countSupplierFollowers(supplierProfileId);

  return {
    supplierProfileId,
    followersCount,
    isFollowedByViewer: true,
  } satisfies SupplierFollowMutationDto;
};

export const unfollowSupplierById = async (
  supplierProfileId: string,
  userId: string,
) => {
  await assertSupplierProfileExists(supplierProfileId);

  await publicSuppliersRepository.unsetSupplierFollowed(
    supplierProfileId,
    userId,
  );
  const followersCount =
    await publicSuppliersRepository.countSupplierFollowers(supplierProfileId);

  return {
    supplierProfileId,
    followersCount,
    isFollowedByViewer: false,
  } satisfies SupplierFollowMutationDto;
};
