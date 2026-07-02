import type { ReservationStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  mapReservationMessage,
  findLatestReservationMessagesByReservationIds,
  findReservationMessages,
  createReservationMessage,
} from '../reservations/reservation-messages.repository.js';
import {
  RESERVATION_MESSAGE_MAX_LENGTH,
  reservationAllowsMessaging,
  resolveReservationFollowUp,
} from '../reservations/reservation-follow-up.js';
import * as supplierReservationsRepository from './supplier-reservations.repository.js';
import type {
  AcceptSupplierReservationInput,
  CancelSupplierReservationInput,
  DeclineSupplierReservationInput,
  ListSupplierReservationsQuery,
  RescheduleSupplierReservationInput,
  SubmitNoShowReportInput,
  CreateReservationMessageInput,
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

const mapNoShowReportSummary = (
  reports: supplierReservationsRepository.SupplierReservationRecord['noShowReports'],
) => {
  const pending = reports.find((report) => report.status === 'PENDING_REVIEW');
  if (!pending) {
    return null;
  }

  return {
    id: pending.id,
    targetUserId: pending.targetUserId,
    targetRole: pending.targetRole,
    status: pending.status,
    reasonCode: pending.reasonCode,
    createdAt: pending.createdAt.toISOString(),
  };
};

export const mapSupplierReservation = (
  reservation: supplierReservationsRepository.SupplierReservationRecord,
  latestMessage?: ReturnType<typeof mapReservationMessage> | null,
) => {
  const latestDelivery = reservation.deliveries[0] ?? null;
  const hasDelivery = reservation._count.deliveries > 0;
  const followUp = resolveReservationFollowUp({
    status: reservation.status,
    pickupWindowStart: reservation.pickupWindowStart,
    pickupWindowEnd: reservation.pickupWindowEnd,
    completedAt: reservation.completedAt,
  });

  return {
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
    deliveryRequested: reservation.deliveryRequested,
    activeDelivery: latestDelivery
      ? {
          id: latestDelivery.id,
          status: latestDelivery.status,
        }
      : null,
    canSupplierComplete:
      supplierReservationsRepository.supplierCanCompleteReservation({
        status: reservation.status,
        deliveryRequested: reservation.deliveryRequested,
        hasDelivery,
      }),
    pickupWindowStart: reservation.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd: reservation.pickupWindowEnd?.toISOString() ?? null,
    supplierNote: reservation.supplierNote,
    rejectionReason: reservation.rejectionReason,
    completedAt: reservation.completedAt?.toISOString() ?? null,
    createdAt: reservation.createdAt.toISOString(),
    pickupWindowStatus: followUp.pickupWindowStatus,
    isOverdue: followUp.isOverdue,
    needsFollowUp: followUp.needsFollowUp,
    canSupplierCancelOverdue:
      followUp.isOverdue &&
      reservation.status === 'ACCEPTED' &&
      !reservation.deliveryRequested &&
      !hasDelivery,
    canSupplierReportNoShow:
      followUp.isOverdue && reservation.status === 'ACCEPTED',
    canSupplierReschedule: reservation.status === 'ACCEPTED',
    canSendMessage: reservationAllowsMessaging(reservation.status),
    noShowReport: mapNoShowReportSummary(reservation.noShowReports),
    latestMessage: latestMessage ?? null,
  };
};

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

  const latestMessages = await findLatestReservationMessagesByReservationIds(
    reservations.map((reservation) => reservation.id),
  );

  return reservations.map((reservation) =>
    mapSupplierReservation(
      reservation,
      latestMessages.has(reservation.id)
        ? mapReservationMessage(latestMessages.get(reservation.id)!)
        : null,
    ),
  );
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

export const completeSupplierReservation = async (
  ownerId: string,
  reservationId: string,
) => {
  const result = await supplierReservationsRepository.completeSupplierReservation(
    {
      reservationId,
      ownerId,
    },
  );

  if (!result) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (result.conflict) {
    throw new AppError(
      'Only accepted self-pickup reservations can be completed by the supplier.',
      409,
      'CONFLICT',
    );
  }

  return mapSupplierReservation(result.reservation);
};

export const rescheduleSupplierReservation = async (
  ownerId: string,
  reservationId: string,
  input: RescheduleSupplierReservationInput,
) => {
  const end = new Date(input.pickupWindowEnd);
  if (end.getTime() <= Date.now()) {
    throw new AppError(
      'Pickup window end must be in the future.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const result = await supplierReservationsRepository.rescheduleSupplierReservation({
    reservationId,
    ownerId,
    pickupWindowStart: new Date(input.pickupWindowStart),
    pickupWindowEnd: end,
    supplierNote: input.supplierNote,
    followUpMessage: input.messageToLearner,
  });

  if (!result) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (result.conflict) {
    throw new AppError(
      'Only accepted reservations can be rescheduled.',
      409,
      'CONFLICT',
    );
  }

  return mapSupplierReservation(result.reservation);
};

export const cancelSupplierAcceptedReservation = async (
  ownerId: string,
  reservationId: string,
  input: CancelSupplierReservationInput,
) => {
  const result =
    await supplierReservationsRepository.cancelSupplierAcceptedReservation({
      reservationId,
      ownerId,
      reason: input.reason,
    });

  if (!result) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if ('conflict' in result && result.conflict) {
    throw new AppError(
      'Only accepted reservations can be cancelled by the supplier.',
      409,
      'CONFLICT',
    );
  }

  if ('notOverdue' in result && result.notOverdue) {
    throw new AppError(
      'Only overdue accepted reservations can be cancelled by the supplier.',
      409,
      'CONFLICT',
    );
  }

  if ('deliveryBlocked' in result && result.deliveryBlocked) {
    throw new AppError(
      'Delivery reservations must be handled through delivery flow.',
      409,
      'CONFLICT',
    );
  }

  return mapSupplierReservation(result.reservation);
};

export const submitSupplierNoShowReport = async (
  ownerId: string,
  reservationId: string,
  input: SubmitNoShowReportInput,
) => {
  const result = await supplierReservationsRepository.createSupplierNoShowReport({
    reservationId,
    ownerId,
    reasonCode: input.reasonCode,
    note: input.note,
  });

  if (!result) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if ('conflict' in result && result.conflict) {
    throw new AppError(
      'Only accepted reservations can be reported.',
      409,
      'CONFLICT',
    );
  }

  if ('windowNotEnded' in result && result.windowNotEnded) {
    throw new AppError(
      'No-show reports are allowed only after the pickup window ends.',
      409,
      'CONFLICT',
    );
  }

  if ('driverNotAssigned' in result && result.driverNotAssigned) {
    throw new AppError(
      'Driver no-show reports require an assigned driver.',
      409,
      'CONFLICT',
    );
  }

  if ('duplicate' in result && result.duplicate) {
    throw new AppError(
      'No-show report already submitted for this reservation target.',
      409,
      'CONFLICT',
    );
  }

  return {
    id: result.report.id,
    reservationId: result.report.reservationId,
    targetUserId: result.report.targetUserId,
    targetRole: result.report.targetRole,
    reasonCode: result.report.reasonCode,
    note: result.report.note,
    status: result.report.status,
    createdAt: result.report.createdAt.toISOString(),
  };
};

const assertSupplierReservationAccess = async (
  ownerId: string,
  reservationId: string,
) => {
  const reservation =
    await supplierReservationsRepository.findSupplierReservationForOwner(
      ownerId,
      reservationId,
    );

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  return reservation;
};

export const listSupplierReservationMessages = async (
  ownerId: string,
  reservationId: string,
) => {
  await assertSupplierReservationAccess(ownerId, reservationId);
  const messages = await findReservationMessages(reservationId);
  return messages.map(mapReservationMessage);
};

export const createSupplierReservationMessage = async (
  ownerId: string,
  reservationId: string,
  input: CreateReservationMessageInput,
) => {
  const reservation = await assertSupplierReservationAccess(ownerId, reservationId);

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
    senderUserId: ownerId,
    body,
  });

  return mapReservationMessage(message);
};
