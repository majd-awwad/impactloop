import {
  forwardGeocodeLocation as forwardGeocodeLocationWithProvider,
  reverseGeocodeCoordinates,
} from '../../services/reverse-geocoding.service.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { decimalToNumber } from '../../utils/decimal.js';
import { invalidateLearnerHomeCache } from '../learner-home/learner-home.service.js';

import * as locationsRepository from './locations.repository.js';
import type {
  ForwardGeocodeInput,
  ReverseGeocodeInput,
  SavedLocationInput,
  UpdateSavedLocationInput,
} from './locations.validation.js';

export const reverseGeocodeLocation = async (
  userId: string,
  input: ReverseGeocodeInput,
) => {
  return reverseGeocodeCoordinates(input.latitude, input.longitude, {
    userId,
  });
};

export const forwardGeocodeLocation = async (
  userId: string,
  input: ForwardGeocodeInput,
) => {
  return forwardGeocodeLocationWithProvider(input, { userId });
};

const toNullableNumber = (
  value: { toNumber(): number } | number | null,
): number | null => {
  if (value == null) return null;
  return typeof value === 'number' ? value : decimalToNumber(value);
};

const mapSavedLocation = (
  savedLocation: locationsRepository.SavedLocationRecord,
) => ({
  id: savedLocation.id,
  label: savedLocation.label,
  isDefault: savedLocation.isDefault,
  country: savedLocation.location.country,
  city: savedLocation.location.city,
  area: savedLocation.location.area,
  addressLine: savedLocation.location.addressLine,
  latitude: toNullableNumber(savedLocation.location.latitude),
  longitude: toNullableNumber(savedLocation.location.longitude),
  createdAt: savedLocation.createdAt.toISOString(),
  updatedAt: savedLocation.updatedAt.toISOString(),
});

export const listUserSavedLocations = async (userId: string) => {
  const savedLocations = await locationsRepository.listSavedLocations(userId);

  return savedLocations.map(mapSavedLocation);
};

export const createUserSavedLocation = async (
  userId: string,
  input: SavedLocationInput,
) => {
  const savedLocation = await prisma.$transaction(async (tx) => {
    const existingCount = await locationsRepository.countSavedLocations(
      userId,
      tx,
    );
    const shouldSetDefault = input.isDefault || existingCount === 0;

    if (shouldSetDefault) {
      await locationsRepository.unsetDefaultSavedLocations(userId, tx);
    }

    const location = await locationsRepository.createPrivateLocation(input, tx);
    await locationsRepository.updateLocationGeography(
      location.id,
      input.latitude,
      input.longitude,
      tx,
    );

    return locationsRepository.createSavedLocation(
      {
        userId,
        locationId: location.id,
        label: input.label,
        isDefault: shouldSetDefault,
      },
      tx,
    );
  });

  invalidateLearnerHomeCache(userId);
  return mapSavedLocation(savedLocation);
};

export const updateUserSavedLocation = async (
  userId: string,
  id: string,
  input: UpdateSavedLocationInput,
) => {
  const savedLocation = await prisma.$transaction(async (tx) => {
    const existing = await locationsRepository.findSavedLocationForUser(
      userId,
      id,
      tx,
    );

    if (!existing) {
      throw new AppError('Saved location not found', 404, 'NOT_FOUND');
    }

    if (input.isDefault) {
      await locationsRepository.unsetDefaultSavedLocations(userId, tx);
    }

    const locationInput =
      input.country !== undefined ||
      input.city !== undefined ||
      input.area !== undefined ||
      input.addressLine !== undefined ||
      input.latitude !== undefined ||
      input.longitude !== undefined
        ? {
            country: input.country,
            city: input.city,
            area: input.area,
            addressLine: input.addressLine,
            latitude: input.latitude,
            longitude: input.longitude,
          }
        : undefined;

    const updated = await locationsRepository.updateSavedLocation(
      {
        id,
        label: input.label,
        isDefault: input.isDefault,
        location: locationInput,
      },
      tx,
    );

    if (input.latitude !== undefined || input.longitude !== undefined) {
      await locationsRepository.updateLocationGeography(
        updated.locationId,
        updated.location.latitude == null
          ? null
          : toNullableNumber(updated.location.latitude),
        updated.location.longitude == null
          ? null
          : toNullableNumber(updated.location.longitude),
        tx,
      );
    }

    return locationsRepository.findSavedLocationForUser(userId, id, tx);
  });

  if (!savedLocation) {
    throw new AppError('Saved location not found', 404, 'NOT_FOUND');
  }

  if (
    input.isDefault !== undefined ||
    input.country !== undefined ||
    input.city !== undefined ||
    input.area !== undefined ||
    input.addressLine !== undefined ||
    input.latitude !== undefined ||
    input.longitude !== undefined
  ) {
    invalidateLearnerHomeCache(userId);
  }

  return mapSavedLocation(savedLocation);
};

export const deleteUserSavedLocation = async (userId: string, id: string) => {
  await prisma.$transaction(async (tx) => {
    const existing = await locationsRepository.findSavedLocationForUser(
      userId,
      id,
      tx,
    );

    if (!existing) {
      throw new AppError('Saved location not found', 404, 'NOT_FOUND');
    }

    const deleted = await locationsRepository.deleteSavedLocation(id, tx);

    if (deleted.isDefault) {
      const nextDefault = await locationsRepository.findLatestSavedLocation(
        userId,
        tx,
      );

      if (nextDefault) {
        await locationsRepository.updateSavedLocation(
          {
            id: nextDefault.id,
            isDefault: true,
          },
          tx,
        );
      }
    }
  });

  invalidateLearnerHomeCache(userId);
  return { id, deleted: true };
};

export const resolveSavedLocationCoordinates = async (
  userId: string,
  id: string,
) => {
  const savedLocation = await locationsRepository.findSavedLocationForUser(
    userId,
    id,
  );

  if (!savedLocation) {
    throw new AppError('Saved location not found', 404, 'NOT_FOUND');
  }

  const latitude = toNullableNumber(savedLocation.location.latitude);
  const longitude = toNullableNumber(savedLocation.location.longitude);

  if (latitude == null || longitude == null) {
    throw new AppError(
      'Saved location does not have coordinates',
      400,
      'VALIDATION_ERROR',
      { reason: 'SAVED_LOCATION_COORDINATES_REQUIRED' },
    );
  }

  return { latitude, longitude };
};
