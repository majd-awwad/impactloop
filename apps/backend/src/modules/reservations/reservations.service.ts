import { AppError } from '../../utils/app-error.js';

import * as reservationsRepository from './reservations.repository.js';
import type { CreateReservationInput } from './reservations.validation.js';

const PICKUP_LOCATION_REVEAL_STATUSES = new Set(['ACCEPTED', 'COMPLETED']);

type MaterialPickupLocation =
  reservationsRepository.LearnerReservationListRecord['material']['location'];

const mapPickupLocationFull = (location: MaterialPickupLocation) => ({
  country: location.country,
  city: location.city,
  area: location.area,
  addressLine: location.addressLine,
  latitude:
    location.latitude == null
      ? null
      : typeof location.latitude === 'number'
        ? location.latitude
        : location.latitude.toNumber(),
  longitude:
    location.longitude == null
      ? null
      : typeof location.longitude === 'number'
        ? location.longitude
        : location.longitude.toNumber(),
  isApproximate: location.isApproximate,
});

const pickMaterialCoverImageUrl = (
  images: { imageUrl: string; isCover: boolean; sortOrder: number }[],
) => images[0]?.imageUrl ?? null;

const resolveSupplierDisplayName = (
  owner: reservationsRepository.LearnerReservationListRecord['owner'],
) =>
  owner.supplierProfile?.organizationProfile?.organizationName ??
  owner.supplierProfile?.publicName ??
  owner.displayName;

const mapReservation = (
  reservation: reservationsRepository.LearnerReservationRecord,
) => ({
  id: reservation.id,
  status: reservation.status,
  material: {
    id: reservation.material.id,
    title: reservation.material.title,
    status: reservation.material.status,
    quantity: Number(reservation.material.quantity),
    unit: reservation.material.unit,
  },
  requester: {
    id: reservation.requester.id,
    displayName: reservation.requester.displayName,
  },
  owner: {
    id: reservation.owner.id,
    displayName: reservation.owner.displayName,
  },
  quantityRequested: Number(reservation.quantityRequested),
  message: reservation.message,
  createdAt: reservation.createdAt.toISOString(),
});

const mapLearnerReservation = (
  reservation: reservationsRepository.LearnerReservationListRecord,
) => ({
  id: reservation.id,
  status: reservation.status,
  quantityRequested: Number(reservation.quantityRequested),
  message: reservation.message,
  createdAt: reservation.createdAt.toISOString(),
  updatedAt: reservation.updatedAt.toISOString(),
  pickupWindowStart: reservation.pickupWindowStart?.toISOString() ?? null,
  pickupWindowEnd: reservation.pickupWindowEnd?.toISOString() ?? null,
  supplierNote: reservation.supplierNote,
  rejectionReason: reservation.rejectionReason,
  deliveryRequested: reservation.deliveryRequested,
  material: {
    id: reservation.material.id,
    title: reservation.material.title,
    materialType:
      reservation.material.customMaterialType ??
      reservation.material.materialType,
    status: reservation.material.status,
    unit: reservation.material.unit,
    deliveryAllowed: reservation.material.deliveryAllowed,
    imageUrl: pickMaterialCoverImageUrl(reservation.material.images),
    city: reservation.material.location.city,
    area: reservation.material.location.area,
  },
  supplier: {
    id: reservation.owner.id,
    displayName: resolveSupplierDisplayName(reservation.owner),
  },
  pickupLocationFull: PICKUP_LOCATION_REVEAL_STATUSES.has(reservation.status)
    ? mapPickupLocationFull(reservation.material.location)
    : null,
});

const mapCancelledReservation = (
  reservation: reservationsRepository.LearnerCancelledReservationRecord,
) => ({
  id: reservation.id,
  status: reservation.status,
  quantityRequested: Number(reservation.quantityRequested),
  cancelledAt: reservation.cancelledAt?.toISOString() ?? null,
  material: {
    id: reservation.material.id,
    title: reservation.material.title,
    status: reservation.material.status,
    quantity: Number(reservation.material.quantity),
    unit: reservation.material.unit,
  },
});

export const listMyReservations = async (requesterId: string) => {
  const reservations =
    await reservationsRepository.findLearnerReservations(requesterId);

  return reservations.map(mapLearnerReservation);
};

export const createReservation = async (
  requesterId: string,
  input: CreateReservationInput,
) => {
  const result = await reservationsRepository.createLearnerReservation({
    requesterId,
    materialId: input.materialId,
    quantityRequested: input.quantityRequested,
    message: input.message,
  });

  switch (result.outcome) {
    case 'CREATED':
      return mapReservation(result.reservation);
    case 'NOT_FOUND':
      throw new AppError('Material not found.', 404, 'NOT_FOUND');
    case 'SELF_RESERVATION':
      throw new AppError(
        'You cannot reserve your own material.',
        400,
        'VALIDATION_ERROR',
      );
    case 'INVALID_QUANTITY':
      throw new AppError(
        'Requested quantity must be positive and no more than the available quantity.',
        400,
        'VALIDATION_ERROR',
        { availableQuantity: result.availableQuantity },
      );
    case 'OPEN_RESERVATION_EXISTS':
      throw new AppError(
        'You already have an open reservation for this material.',
        409,
        'CONFLICT',
      );
    case 'UNAVAILABLE':
      throw new AppError(
        'This material is no longer available.',
        409,
        'CONFLICT',
      );
    default:
      throw new AppError('Unable to create reservation.', 500, 'INTERNAL_ERROR');
  }
};

export const cancelReservation = async (
  requesterId: string,
  reservationId: string,
) => {
  const result = await reservationsRepository.cancelLearnerReservation({
    requesterId,
    reservationId,
  });

  switch (result.outcome) {
    case 'CANCELLED':
      return mapCancelledReservation(result.reservation);
    case 'NOT_FOUND':
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    case 'INVALID_STATUS':
      throw new AppError(
        'Only pending reservations can be cancelled.',
        409,
        'CONFLICT',
      );
    case 'DELIVERY_EXISTS':
      throw new AppError(
        'This reservation cannot be cancelled because a delivery exists.',
        409,
        'CONFLICT',
      );
    default:
      throw new AppError('Unable to cancel reservation.', 500, 'INTERNAL_ERROR');
  }
};
