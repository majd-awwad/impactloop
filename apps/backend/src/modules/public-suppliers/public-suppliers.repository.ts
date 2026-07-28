import { prisma } from '../../database/prisma.js';
import type { MaterialsQuery } from '../materials/materials.validation.js';
import * as materialsRepository from '../materials/materials.repository.js';

const publicSupplierProfileSelect = {
  id: true,
  userId: true,
  supplierType: true,
  publicName: true,
  description: true,
  coverImageUrl: true,
  avatarImageUrl: true,
  verificationStatus: true,
  user: {
    select: {
      displayName: true,
      profileImageUrl: true,
    },
  },
  defaultPickupLocation: {
    select: {
      city: true,
      area: true,
    },
  },
  organizationProfile: {
    select: {
      businessLocation: {
        select: {
          city: true,
          area: true,
        },
      },
    },
  },
} as const;

export const findPublicSupplierProfileById = async (supplierProfileId: string) => {
  return prisma.supplierProfile.findUnique({
    where: { id: supplierProfileId },
    select: publicSupplierProfileSelect,
  });
};

export const countPublicMaterialsForSupplier = async (supplierProfileId: string) => {
  return prisma.material.count({
    where: {
      supplierProfileId,
      status: {
        in: ['AVAILABLE', 'PENDING_RESERVATION', 'RESERVED'],
      },
      category: {
        isActive: true,
        categoryType: {
          in: ['MATERIAL', 'BOTH'],
        },
      },
    },
  });
};

export const countSupplierFollowers = async (supplierProfileId: string) => {
  return prisma.supplierFollower.count({
    where: { supplierProfileId },
  });
};

export const setSupplierFollowed = async (
  supplierProfileId: string,
  followerUserId: string,
) => {
  await prisma.supplierFollower.upsert({
    where: {
      supplierProfileId_followerUserId: {
        supplierProfileId,
        followerUserId,
      },
    },
    create: {
      supplierProfileId,
      followerUserId,
    },
    update: {},
  });
};

export const unsetSupplierFollowed = async (
  supplierProfileId: string,
  followerUserId: string,
) => {
  await prisma.supplierFollower.deleteMany({
    where: {
      supplierProfileId,
      followerUserId,
    },
  });
};

export const findFollowedSupplierIds = async (
  userId: string | undefined,
  supplierProfileIds: string[],
) => {
  if (!userId || supplierProfileIds.length === 0) {
    return new Set<string>();
  }

  const follows = await prisma.supplierFollower.findMany({
    where: {
      followerUserId: userId,
      supplierProfileId: { in: supplierProfileIds },
    },
    select: {
      supplierProfileId: true,
    },
  });

  return new Set(follows.map((follow) => follow.supplierProfileId));
};

export const findPublicMaterialsBySupplierProfileId = async (
  supplierProfileId: string,
  query: MaterialsQuery,
  coordinates?: materialsRepository.ViewerCoordinates,
) => {
  return materialsRepository.findMaterials(query, coordinates, supplierProfileId);
};
