import type { ReservationStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import * as supplierReservationsRepository from './supplier-reservations.repository.js';
import type {
  AcceptSupplierReservationInput,
  DeclineSupplierReservationInput,
  ListSupplierReservationsQuery,
} from './supplier-reservations.validation.js';

const tabToReservationStatus = (
  status: NonNullable<ListSupplierReservationsQuery['status']>,
): ReservationStatus => {
  switch (status) {
    case 'pending':
      return 'PENDING';
    case 'accepted':
      return 'ACCEPTED';
    case 'declined':
      return 'REJECTED';
    case 'completed':
      return 'COMPLETED';
    default:
      return 'PENDING';
  }
};

const pickMaterialImageUrl = (
  images: { imageUrl: string; isCover: boolean; sortOrder: number }[],
): string | null => {
  if (!images.length) {
    return null;
  }

  const cover = images.find((image) => image.isCover);
  if (cover) {
    return cover.imageUrl;
  }

  return images[0]?.imageUrl ?? null;
};

const mapPickupPreference = (
  pickupType: string,
  deliveryRequested: boolean,
): string => {
  if (deliveryRequested) {
    return 'Delivery requested';
  }

  if (pickupType === 'SELF_PICKUP') {
    return 'Self pickup';
  }

  return pickupType;
};

export const mapSupplierReservation = (
  reservation: supplierReservationsRepository.SupplierReservationRecord,
) => ({
  id: reservation.id,
  status: reservation.status,
  material: {
    id: reservation.material.id,
    title: reservation.material.title,
    categoryName: reservation.material.category.nameEn,
    unit: reservation.material.unit,
    imageUrl: pickMaterialImageUrl(reservation.material.images),
  },
  learner: {
    id: reservation.requester.id,
    displayName: reservation.requester.displayName,
    profileImageUrl: reservation.requester.profileImageUrl,
  },
  quantityRequested: Number(reservation.quantityRequested),
  unit: reservation.material.unit,
  message: reservation.message,
  pickupType: reservation.pickupType,
  pickupPreference: mapPickupPreference(
    reservation.pickupType,
    reservation.deliveryRequested,
  ),
  pickupWindowStart: reservation.pickupWindowStart?.toISOString() ?? null,
  pickupWindowEnd: reservation.pickupWindowEnd?.toISOString() ?? null,
  supplierNote: reservation.supplierNote,
  rejectionReason: reservation.rejectionReason,
  createdAt: reservation.createdAt.toISOString(),
});

export const listSupplierReservations = async (
  ownerId: string,
  query: ListSupplierReservationsQuery,
) => {
  const status = query.status
    ? tabToReservationStatus(query.status)
    : undefined;

  const reservations =
    await supplierReservationsRepository.findSupplierReservations(
      ownerId,
      status,
    );

  return reservations.map(mapSupplierReservation);
};

export const acceptSupplierReservation = async (
  ownerId: string,
  reservationId: string,
  input: AcceptSupplierReservationInput,
) => {
  const result = await supplierReservationsRepository.acceptSupplierReservation({
    reservationId,
    ownerId,
    pickupWindowStart: new Date(input.pickupWindowStart),
    pickupWindowEnd: new Date(input.pickupWindowEnd),
    supplierNote: input.supplierNote,
  });

  if (!result) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (result.conflict) {
    throw new AppError(
      'Only pending reservations can be accepted.',
      409,
      'CONFLICT',
    );
  }

  return mapSupplierReservation(result.reservation);
};

export const declineSupplierReservation = async (
  ownerId: string,
  reservationId: string,
  input: DeclineSupplierReservationInput,
) => {
  const result = await supplierReservationsRepository.declineSupplierReservation(
    {
      reservationId,
      ownerId,
      reason: input.reason,
    },
  );

  if (!result) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (result.conflict) {
    throw new AppError(
      'Only pending reservations can be declined.',
      409,
      'CONFLICT',
    );
  }

  return mapSupplierReservation(result.reservation);
};
