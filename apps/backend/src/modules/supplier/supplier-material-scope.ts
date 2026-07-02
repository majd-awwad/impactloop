import type { Prisma, SupplierProfile } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

export type SupplierMaterialScope = {
  userId: string;
  supplierProfileId: string | null;
};

export type ResolvedSupplierContext = SupplierMaterialScope & {
  profile: SupplierProfile | null;
};

export const buildSupplierMaterialWhere = (
  scope: SupplierMaterialScope,
): Prisma.MaterialWhereInput => {
  if (scope.supplierProfileId) {
    return {
      OR: [
        { ownerId: scope.userId },
        { supplierProfileId: scope.supplierProfileId },
      ],
    };
  }

  return { ownerId: scope.userId };
};

const scoreSupplierProfiles = async (
  userId: string,
  profiles: SupplierProfile[],
): Promise<SupplierProfile | null> => {
  if (profiles.length === 0) {
    return null;
  }

  if (profiles.length === 1) {
    return profiles[0] ?? null;
  }

  const scored = await Promise.all(
    profiles.map(async (profile) => {
      const [materialCount, reservationCount] = await Promise.all([
        prisma.material.count({
          where: {
            OR: [
              { ownerId: userId },
              { supplierProfileId: profile.id },
            ],
          },
        }),
        prisma.reservation.count({ where: { ownerId: userId } }),
      ]);

      return { profile, materialCount, reservationCount };
    }),
  );

  scored.sort((left, right) => {
    if (right.materialCount !== left.materialCount) {
      return right.materialCount - left.materialCount;
    }

    if (right.reservationCount !== left.reservationCount) {
      return right.reservationCount - left.reservationCount;
    }

    return left.profile.createdAt.getTime() - right.profile.createdAt.getTime();
  });

  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[supplier] multiple supplier profiles for user; selected profile with activity',
      {
        userId,
        profileIds: scored.map((entry) => ({
          id: entry.profile.id,
          materialCount: entry.materialCount,
          reservationCount: entry.reservationCount,
        })),
      },
    );
  }

  return scored[0]?.profile ?? null;
};

export const resolveSupplierProfileForUser = async (
  userId: string,
): Promise<SupplierProfile | null> => {
  const profiles = await prisma.supplierProfile.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });

  return scoreSupplierProfiles(userId, profiles);
};

export const resolveSupplierContext = async (
  userId: string,
): Promise<ResolvedSupplierContext> => {
  const profile = await resolveSupplierProfileForUser(userId);

  return {
    userId,
    supplierProfileId: profile?.id ?? null,
    profile,
  };
};
