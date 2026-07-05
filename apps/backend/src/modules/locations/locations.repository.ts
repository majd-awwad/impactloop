import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export const savedLocationInclude = {
  location: true,
} satisfies Prisma.UserSavedLocationInclude;

export type SavedLocationRecord = Prisma.UserSavedLocationGetPayload<{
  include: typeof savedLocationInclude;
}>;

export const listSavedLocations = (userId: string) => {
  return prisma.userSavedLocation.findMany({
    where: { userId },
    include: savedLocationInclude,
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
};

export const countSavedLocations = (
  userId: string,
  client: PrismaClientLike = prisma,
) => {
  return client.userSavedLocation.count({ where: { userId } });
};

export const unsetDefaultSavedLocations = (
  userId: string,
  client: PrismaClientLike = prisma,
) => {
  return client.userSavedLocation.updateMany({
    where: { userId, isDefault: true },
    data: { isDefault: false },
  });
};

export const createPrivateLocation = (
  input: {
    country: string;
    city: string;
    area?: string | null;
    addressLine?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  },
  client: PrismaClientLike = prisma,
) => {
  return client.location.create({
    data: {
      country: input.country,
      city: input.city,
      area: input.area ?? null,
      addressLine: input.addressLine ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      locationType: 'USER_SAVED',
      visibility: 'PRIVATE',
      isApproximate: false,
    },
    select: { id: true },
  });
};

export const updateLocationGeography = async (
  locationId: string,
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  client: PrismaClientLike = prisma,
) => {
  if (latitude == null || longitude == null) {
    await client.$executeRaw`
      UPDATE "locations"
      SET "location" = NULL
      WHERE "id" = ${locationId}
    `;
    return;
  }

  await client.$executeRaw`
    UPDATE "locations"
    SET "location" = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
    WHERE "id" = ${locationId}
  `;
};

export const createSavedLocation = (
  input: {
    userId: string;
    locationId: string;
    label: string;
    isDefault: boolean;
  },
  client: PrismaClientLike = prisma,
) => {
  return client.userSavedLocation.create({
    data: input,
    include: savedLocationInclude,
  });
};

export const findSavedLocationForUser = (
  userId: string,
  id: string,
  client: PrismaClientLike = prisma,
) => {
  return client.userSavedLocation.findFirst({
    where: { id, userId },
    include: savedLocationInclude,
  });
};

export const updateSavedLocation = (
  input: {
    id: string;
    label?: string;
    isDefault?: boolean;
    location?: {
      country?: string;
      city?: string;
      area?: string | null;
      addressLine?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    };
  },
  client: PrismaClientLike = prisma,
) => {
  return client.userSavedLocation.update({
    where: { id: input.id },
    data: {
      label: input.label,
      isDefault: input.isDefault,
      location: input.location
        ? {
            update: input.location,
          }
        : undefined,
    },
    include: savedLocationInclude,
  });
};

export const deleteSavedLocation = async (
  id: string,
  client: PrismaClientLike = prisma,
) => {
  const savedLocation = await client.userSavedLocation.delete({
    where: { id },
    select: {
      id: true,
      locationId: true,
      isDefault: true,
    },
  });

  await client.location.delete({
    where: { id: savedLocation.locationId },
  });

  return savedLocation;
};

export const findLatestSavedLocation = (
  userId: string,
  client: PrismaClientLike = prisma,
) => {
  return client.userSavedLocation.findFirst({
    where: { userId },
    include: savedLocationInclude,
    orderBy: { createdAt: 'desc' },
  });
};
