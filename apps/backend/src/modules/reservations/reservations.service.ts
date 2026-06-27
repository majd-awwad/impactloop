import { AppError } from '../../utils/app-error.js';

import * as reservationsRepository from './reservations.repository.js';
import type { CreateReservationInput } from './reservations.validation.js';

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
  material: {
    id: reservation.material.id,
    title: reservation.material.title,
    materialType:
      reservation.material.customMaterialType ??
      reservation.material.materialType,
    status: reservation.material.status,
    deliveryAllowed: reservation.material.deliveryAllowed,
    imageUrl: pickMaterialCoverImageUrl(reservation.material.images),
    city: reservation.material.location.city,
    area: reservation.material.location.area,
  },
  supplier: {
    id: reservation.owner.id,
    displayName: resolveSupplierDisplayName(reservation.owner),
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
    case 'ACTIVE_RESERVATION_EXISTS':
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
