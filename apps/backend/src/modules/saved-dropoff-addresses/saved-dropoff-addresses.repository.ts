import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import { LEARNER_SAVED_DROPOFF_LOCATION_TYPE } from './saved-dropoff-addresses.constants.js';
import type { SavedDropoffLocationInput } from './saved-dropoff-addresses.validation.js';

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

const savedDropoffInclude = {
  location: true,
} as const;

export type SavedDropoffAddressRecord = Prisma.UserSavedLocationGetPayload<{
  include: typeof savedDropoffInclude;
}>;

const buildLocationData = (input: SavedDropoffLocationInput) => ({
  country: input.country,
  city: input.city,
  area: input.area ?? null,
  addressLine: input.addressLine ?? null,
  latitude: input.latitude ?? null,
  longitude: input.longitude ?? null,
  visibility: 'PRIVATE',
  isApproximate: input.isApproximate,
  locationType: LEARNER_SAVED_DROPOFF_LOCATION_TYPE,
});

export const countSavedDropoffAddressesForUser = async (
  userId: string,
  client: PrismaClientLike = prisma,
) =>
  client.userSavedLocation.count({
    where: { userId },
  });

export const listSavedDropoffAddressesForUser = async (userId: string) =>
  prisma.userSavedLocation.findMany({
    where: { userId },
    include: savedDropoffInclude,
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  });

export const findSavedDropoffAddressForUser = async (
  userId: string,
  savedAddressId: string,
  client: PrismaClientLike = prisma,
) =>
  client.userSavedLocation.findFirst({
    where: {
      id: savedAddressId,
      userId,
    },
    include: savedDropoffInclude,
  });

export const clearDefaultSavedDropoffAddresses = async (
  userId: string,
  client: PrismaClientLike = prisma,
) =>
  client.userSavedLocation.updateMany({
    where: {
      userId,
      isDefault: true,
    },
    data: {
      isDefault: false,
    },
  });

export const createSavedDropoffAddressForUser = async (
  userId: string,
  input: {
    label: string;
    location: SavedDropoffLocationInput;
    isDefault?: boolean;
  },
  client: PrismaClientLike = prisma,
) => {
  if (input.isDefault) {
    await clearDefaultSavedDropoffAddresses(userId, client);
  }

  const location = await client.location.create({
    data: buildLocationData(input.location),
  });

  return client.userSavedLocation.create({
    data: {
      userId,
      label: input.label,
      locationId: location.id,
      isDefault: input.isDefault ?? false,
    },
    include: savedDropoffInclude,
  });
};

export const updateSavedDropoffAddressForUser = async (
  userId: string,
  savedAddressId: string,
  input: {
    label?: string;
    location?: SavedDropoffLocationInput;
    isDefault?: boolean;
  },
) =>
  prisma.$transaction(async (tx) => {
    const existing = await findSavedDropoffAddressForUser(
      userId,
      savedAddressId,
      tx,
    );

    if (!existing) {
      return null;
    }

    if (input.isDefault === true) {
      await clearDefaultSavedDropoffAddresses(userId, tx);
    }

    if (input.location) {
      await tx.location.update({
        where: { id: existing.locationId },
        data: buildLocationData(input.location),
      });
    }

    return tx.userSavedLocation.update({
      where: { id: existing.id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
      include: savedDropoffInclude,
    });
  });

export const deleteSavedDropoffAddressForUser = async (
  userId: string,
  savedAddressId: string,
) =>
  prisma.$transaction(async (tx) => {
    const existing = await findSavedDropoffAddressForUser(
      userId,
      savedAddressId,
      tx,
    );

    if (!existing) {
      return null;
    }

    await tx.userSavedLocation.delete({
      where: { id: existing.id },
    });

    await tx.location.delete({
      where: { id: existing.locationId },
    });

    return existing;
  });

export const copySavedDropoffLocationForDelivery = (
  savedAddress: SavedDropoffAddressRecord,
): SavedDropoffLocationInput => ({
  country: savedAddress.location.country,
  city: savedAddress.location.city,
  area: savedAddress.location.area,
  addressLine: savedAddress.location.addressLine,
  latitude:
    savedAddress.location.latitude === null
      ? null
      : Number(savedAddress.location.latitude),
  longitude:
    savedAddress.location.longitude === null
      ? null
      : Number(savedAddress.location.longitude),
  isApproximate: savedAddress.location.isApproximate,
});
