import { prisma } from '../../database/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import * as materialsRepository from '../materials/materials.repository.js';
import { buildPublicMaterialWhere } from '../materials/public-material-visibility.js';

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
      ...buildPublicMaterialWhere(),
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
  query: { page: number; limit: number },
) => {
  const where: Prisma.MaterialWhereInput = {
    supplierProfileId,
    ...buildPublicMaterialWhere(),
  };
  const [items, total] = await Promise.all([
    prisma.material.findMany({
      where,
      include: materialsRepository.materialInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.material.count({ where }),
  ]);
  return { items, total };
};
