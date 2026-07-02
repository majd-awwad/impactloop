import { AppError } from '../../utils/app-error.js';

import {
  mapReservationMessage,
  findLatestReservationMessagesByReservationIds,
  findReservationMessages,
  createReservationMessage,
} from './reservation-messages.repository.js';
import {
  RESERVATION_MESSAGE_MAX_LENGTH,
  reservationAllowsMessaging,
  resolveReservationFollowUp,
} from './reservation-follow-up.js';
import * as reservationsRepository from './reservations.repository.js';
import { resolveLearnerConfirmation as resolveLearnerConfirmationInRepository } from './reservations.learner-confirmation.repository.js';
import type {
  CreateReservationInput,
  CreateReservationMessageInput,
  LearnerConfirmationInput,
} from './reservations.validation.js';

const PICKUP_LOCATION_REVEAL_STATUSES = new Set(['ACCEPTED', 'COMPLETED']);

type PreferredWindow = {
  start: string;
  end: string;
};

const parsePreferredWindows = (value: unknown): PreferredWindow[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }

    const start = 'start' in entry ? entry.start : null;
    const end = 'end' in entry ? entry.end : null;

    if (typeof start !== 'string' || typeof end !== 'string') {
      return [];
    }

    return [{ start, end }];
  });
};

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
) => {
  if (images.length === 0) {
    return null;
  }

  const cover = images.find((image) => image.isCover);
  return cover?.imageUrl ?? images[0]?.imageUrl ?? null;
};

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
  fulfillmentMethod: reservation.fulfillmentMethod,
  learnerPreferredPickupWindows: parsePreferredWindows(
    reservation.learnerPreferredPickupWindows,
  ),
  learnerPreferredDeliveryWindows: parsePreferredWindows(
    reservation.learnerPreferredDeliveryWindows,
  ),
  deliveryAddressText: reservation.deliveryAddressText,
  safeDropoffAllowed: reservation.safeDropoffAllowed,
  deliveryNote: reservation.deliveryNote,
  createdAt: reservation.createdAt.toISOString(),
});

const mapLearnerReservation = (
  reservation: reservationsRepository.LearnerReservationListRecord,
  latestMessage?: ReturnType<typeof mapReservationMessage> | null,
) => {
  const followUp = resolveReservationFollowUp({
    status: reservation.status,
    pickupWindowStart: reservation.pickupWindowStart,
    pickupWindowEnd: reservation.pickupWindowEnd,
  });
  const latestDelivery = reservation.deliveries[0] ?? null;

  return {
    id: reservation.id,
    status: reservation.status,
    quantityRequested: Number(reservation.quantityRequested),
    message: reservation.message,
    fulfillmentMethod: reservation.fulfillmentMethod,
    learnerPreferredPickupWindows: parsePreferredWindows(
      reservation.learnerPreferredPickupWindows,
    ),
    learnerPreferredDeliveryWindows: parsePreferredWindows(
      reservation.learnerPreferredDeliveryWindows,
    ),
    deliveryAddressText: reservation.deliveryAddressText,
    safeDropoffAllowed: reservation.safeDropoffAllowed,
    deliveryNote: reservation.deliveryNote,
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: reservation.updatedAt.toISOString(),
    pickupWindowStart: reservation.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd: reservation.pickupWindowEnd?.toISOString() ?? null,
    supplierProposedPickupWindowStart:
      reservation.supplierProposedPickupWindowStart?.toISOString() ?? null,
    supplierProposedPickupWindowEnd:
      reservation.supplierProposedPickupWindowEnd?.toISOString() ?? null,
    supplierPickupWindowStart:
      reservation.supplierPickupWindowStart?.toISOString() ?? null,
    supplierPickupWindowEnd:
      reservation.supplierPickupWindowEnd?.toISOString() ?? null,
    confirmedDeliveryWindowStart:
      reservation.confirmedDeliveryWindowStart?.toISOString() ?? null,
    confirmedDeliveryWindowEnd:
      reservation.confirmedDeliveryWindowEnd?.toISOString() ?? null,
    earliestDeliveryStart:
      reservation.earliestDeliveryStart?.toISOString() ?? null,
    schedulingConflictReason: reservation.schedulingConflictReason,
    supplierNote: reservation.supplierNote,
    rejectionReason: reservation.rejectionReason,
    deliveryRequested: reservation.deliveryRequested,
    activeDelivery: latestDelivery
      ? {
          id: latestDelivery.id,
          status: latestDelivery.status,
        }
      : null,
    pickupWindowStatus: followUp.pickupWindowStatus,
    isOverdue: followUp.isOverdue,
    needsFollowUp: followUp.needsFollowUp,
    canSendMessage: reservationAllowsMessaging(reservation.status),
    latestMessage: latestMessage ?? null,
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
  };
};

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

  const latestMessages = await findLatestReservationMessagesByReservationIds(
    reservations.map((reservation) => reservation.id),
  );

  return reservations.map((reservation) =>
    mapLearnerReservation(
      reservation,
      latestMessages.has(reservation.id)
        ? mapReservationMessage(latestMessages.get(reservation.id)!)
        : null,
    ),
  );
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
    fulfillmentMethod: input.fulfillmentMethod,
    learnerPreferredPickupWindows: input.learnerPreferredPickupWindows,
    learnerPreferredDeliveryWindows: input.learnerPreferredDeliveryWindows,
    deliveryAddressText: input.deliveryAddressText,
    safeDropoffAllowed: input.safeDropoffAllowed,
    deliveryNote: input.deliveryNote,
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
    case 'PICKUP_NOT_ALLOWED':
      throw new AppError(
        'Pickup is not available for this material.',
        400,
        'VALIDATION_ERROR',
      );
    case 'DELIVERY_NOT_ALLOWED':
      throw new AppError(
        'Delivery is not available for this material.',
        400,
        'VALIDATION_ERROR',
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
        'Only pending or awaiting-confirmation reservations can be cancelled.',
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

export const listLearnerReservationMessages = async (
  requesterId: string,
  reservationId: string,
) => {
  const reservation = await reservationsRepository.findLearnerReservationById(
    requesterId,
    reservationId,
  );

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  const messages = await findReservationMessages(reservationId);
  return messages.map(mapReservationMessage);
};

export const createLearnerReservationMessage = async (
  requesterId: string,
  reservationId: string,
  input: CreateReservationMessageInput,
) => {
  const reservation = await reservationsRepository.findLearnerReservationById(
    requesterId,
    reservationId,
  );

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (!reservationAllowsMessaging(reservation.status)) {
    throw new AppError(
      'Messages are not allowed for this reservation status.',
      409,
      'CONFLICT',
    );
  }

  const body = input.body.trim();
  if (!body) {
    throw new AppError('Message cannot be empty.', 400, 'VALIDATION_ERROR');
  }

  if (body.length > RESERVATION_MESSAGE_MAX_LENGTH) {
    throw new AppError(
      `Message must be at most ${RESERVATION_MESSAGE_MAX_LENGTH} characters.`,
      400,
      'VALIDATION_ERROR',
    );
  }

  const message = await createReservationMessage({
    reservationId,
    senderUserId: requesterId,
    body,
  });

  return mapReservationMessage(message);
};

const mapLearnerReservationById = async (
  requesterId: string,
  reservationId: string,
) => {
  const reservation = await reservationsRepository.findLearnerReservationById(
    requesterId,
    reservationId,
  );

  if (!reservation) {
    return null;
  }

  const latestMessages = await findLatestReservationMessagesByReservationIds([
    reservation.id,
  ]);

  return mapLearnerReservation(
    reservation,
    latestMessages.has(reservation.id)
      ? mapReservationMessage(latestMessages.get(reservation.id)!)
      : null,
  );
};

export const resolveLearnerConfirmation = async (
  requesterId: string,
  reservationId: string,
  input: LearnerConfirmationInput,
) => {
  const result = await resolveLearnerConfirmationInRepository({
    requesterId,
    reservationId,
    action: input.action,
    deliveryWindow:
      input.deliveryWindow == null
        ? undefined
        : {
            start: new Date(input.deliveryWindow.start),
            end: new Date(input.deliveryWindow.end),
          },
  });

  switch (result.outcome) {
    case 'ACCEPTED':
    case 'CANCELLED': {
      const reservation = await mapLearnerReservationById(
        requesterId,
        reservationId,
      );

      if (!reservation) {
        throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
      }

      return reservation;
    }
    case 'NOT_FOUND':
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    case 'INVALID_STATUS':
      throw new AppError(
        'Only reservations awaiting learner confirmation can be resolved.',
        409,
        'CONFLICT',
      );
    case 'INVALID_ACTION':
      throw new AppError(
        'This action is not valid for the reservation fulfillment method.',
        400,
        'VALIDATION_ERROR',
      );
    case 'MISSING_PROPOSED_PICKUP':
      throw new AppError(
        'Supplier proposed pickup window is missing.',
        409,
        'CONFLICT',
      );
    case 'MISSING_SUPPLIER_PICKUP':
      throw new AppError(
        'Supplier pickup window is missing.',
        409,
        'CONFLICT',
      );
    case 'MISSING_DELIVERY_ADDRESS':
      throw new AppError('Delivery address is missing.', 409, 'CONFLICT');
    case 'MISSING_DELIVERY_WINDOW':
      throw new AppError(
        'Delivery window is required.',
        400,
        'VALIDATION_ERROR',
      );
    case 'DELIVERY_EXISTS':
      throw new AppError(
        'This reservation already has a delivery record.',
        409,
        'CONFLICT',
      );
    case 'INFEASIBLE_DELIVERY_WINDOW':
      throw new AppError(
        result.reason ??
          'The selected delivery window is not feasible after the supplier pickup window and delivery buffer.',
        422,
        'VALIDATION_ERROR',
      );
    default:
      throw new AppError(
        'Unable to resolve reservation confirmation.',
        500,
        'INTERNAL_ERROR',
      );
  }
};
