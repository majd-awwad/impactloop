import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import { MAX_SAVED_DROPOFF_ADDRESSES } from './saved-dropoff-addresses.constants.js';
import * as savedDropoffAddressesRepository from './saved-dropoff-addresses.repository.js';
import type {
  CreateSavedDropoffAddressInput,
  UpdateSavedDropoffAddressInput,
} from './saved-dropoff-addresses.validation.js';

const mapSavedDropoffAddress = (
  savedAddress: savedDropoffAddressesRepository.SavedDropoffAddressRecord,
) => ({
  id: savedAddress.id,
  label: savedAddress.label,
  isDefault: savedAddress.isDefault,
  location: {
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
  },
  createdAt: savedAddress.createdAt.toISOString(),
  updatedAt: savedAddress.updatedAt.toISOString(),
});

export const listMySavedDropoffAddresses = async (userId: string) => {
  const items =
    await savedDropoffAddressesRepository.listSavedDropoffAddressesForUser(
      userId,
    );

  return {
    items: items.map(mapSavedDropoffAddress),
  };
};

export const createMySavedDropoffAddress = async (
  userId: string,
  input: CreateSavedDropoffAddressInput,
) => {
  const count =
    await savedDropoffAddressesRepository.countSavedDropoffAddressesForUser(
      userId,
    );

  if (count >= MAX_SAVED_DROPOFF_ADDRESSES) {
    throw new AppError(
      `You can save up to ${MAX_SAVED_DROPOFF_ADDRESSES} dropoff addresses.`,
      409,
      COMMON_ERROR_CODES.conflict,
    );
  }

  const savedAddress =
    await savedDropoffAddressesRepository.createSavedDropoffAddressForUser(
      userId,
      input,
    );

  return mapSavedDropoffAddress(savedAddress);
};

export const updateMySavedDropoffAddress = async (
  userId: string,
  savedAddressId: string,
  input: UpdateSavedDropoffAddressInput,
) => {
  const savedAddress =
    await savedDropoffAddressesRepository.updateSavedDropoffAddressForUser(
      userId,
      savedAddressId,
      input,
    );

  if (!savedAddress) {
    throw new AppError(
      'Saved dropoff address not found.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  return mapSavedDropoffAddress(savedAddress);
};

export const deleteMySavedDropoffAddress = async (
  userId: string,
  savedAddressId: string,
) => {
  const savedAddress =
    await savedDropoffAddressesRepository.deleteSavedDropoffAddressForUser(
      userId,
      savedAddressId,
    );

  if (!savedAddress) {
    throw new AppError(
      'Saved dropoff address not found.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  return {
    id: savedAddress.id,
  };
};

export const resolveSavedDropoffAddressForDelivery = async (
  userId: string,
  savedAddressId: string,
) => {
  const savedAddress =
    await savedDropoffAddressesRepository.findSavedDropoffAddressForUser(
      userId,
      savedAddressId,
    );

  if (!savedAddress) {
    throw new AppError(
      'Saved dropoff address not found.',
      404,
      COMMON_ERROR_CODES.notFound,
    );
  }

  return savedDropoffAddressesRepository.copySavedDropoffLocationForDelivery(
    savedAddress,
  );
};

export const maybeSaveDropoffAddressAfterDeliveryRequest = async (
  userId: string,
  input: {
    label: string;
    location: CreateSavedDropoffAddressInput['location'];
  },
) => {
  const count =
    await savedDropoffAddressesRepository.countSavedDropoffAddressesForUser(
      userId,
    );

  if (count >= MAX_SAVED_DROPOFF_ADDRESSES) {
    return null;
  }

  const savedAddress =
    await savedDropoffAddressesRepository.createSavedDropoffAddressForUser(
      userId,
      {
        label: input.label,
        location: input.location,
        isDefault: count === 0,
      },
    );

  return mapSavedDropoffAddress(savedAddress);
};
