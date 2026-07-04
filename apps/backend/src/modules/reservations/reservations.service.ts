import { AppError } from '../../utils/app-error.js';
import {
  deriveHandoverCode,
  ensureSelfPickupCodeStored,
} from '../../utils/handover-codes.js';
import { prisma } from '../../database/prisma.js';

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
import {
  LEARNER_PICKUP_WINDOW_TOO_CLOSE_MESSAGE,
  MIN_PICKUP_NOTICE_MINUTES,
} from './reservation-timing-policy.js';
import {
  canRequestPickupReschedule,
  mapPendingRescheduleSummary,
  resolveSelfPickupHandoverPhase,
} from './reservation-reschedule.js';
import * as reservationsRescheduleRepository from './reservations.reschedule.repository.js';
import * as reservationsRepository from './reservations.repository.js';
import {
  canLearnerReportSupplierIssue,
  canReportNoDriverAvailable,
  createLearnerSupplierIssueReport,
  createNoDriverAvailableReport,
} from './reservations.incidents.repository.js';
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

const LEARNER_DELIVERY_CODE_VISIBLE_STATUSES = new Set([
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
]);

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
  const deliveryCount = reservation.deliveries.length;
  const pickupHandoverPhase = resolveSelfPickupHandoverPhase({
    status: reservation.status,
    pickupWindowStart: reservation.pickupWindowStart,
    pickupWindowEnd: reservation.pickupWindowEnd,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryRequested: reservation.deliveryRequested,
    deliveryCount,
  });
  const canLearnerReschedule = canRequestPickupReschedule({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryRequested: reservation.deliveryRequested,
    deliveryCount,
    pickupWindowStart: reservation.pickupWindowStart,
    pickupWindowEnd: reservation.pickupWindowEnd,
    hasFinalReport:
      reservation.status === 'AWAITING_RESOLUTION' ||
      reservation.noShowReports.some(
        (report) => report.status === 'PENDING_REVIEW',
      ),
  });
  const hasOpenIncident = reservation.noShowReports.some(
    (report) => report.status === 'PENDING_REVIEW',
  );
  const canLearnerReportSupplier = canLearnerReportSupplierIssue({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryRequested: reservation.deliveryRequested,
    pickupWindowEnd: reservation.pickupWindowEnd,
    hasPendingReport: hasOpenIncident,
  });
  const canReportNoDriverAvailableFlag = canReportNoDriverAvailable({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
    deliveryStatus: latestDelivery?.status ?? null,
    assignedDriverProfileId: latestDelivery?.assignedDriverProfileId ?? null,
    hasPendingReport: hasOpenIncident,
  });

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
    learnerProposedPickupWindowStart:
      reservation.learnerProposedPickupWindowStart?.toISOString() ?? null,
    learnerProposedPickupWindowEnd:
      reservation.learnerProposedPickupWindowEnd?.toISOString() ?? null,
    pendingReschedule: mapPendingRescheduleSummary(reservation),
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
    selfPickupCode:
      reservation.status === 'ACCEPTED' &&
      reservation.fulfillmentMethod === 'PICKUP'
        ? deriveHandoverCode('self-pickup', reservation.id)
        : null,
    activeDelivery: latestDelivery
      ? {
          id: latestDelivery.id,
          status: latestDelivery.status,
          learnerDeliveryCode:
            reservation.status === 'ACCEPTED' &&
            LEARNER_DELIVERY_CODE_VISIBLE_STATUSES.has(latestDelivery.status)
              ? deriveHandoverCode('learner-delivery', latestDelivery.id)
              : null,
        }
      : null,
    pickupWindowStatus: followUp.pickupWindowStatus,
    isOverdue: followUp.isOverdue,
    needsFollowUp: followUp.needsFollowUp,
    pickupHandoverPhase,
    canLearnerReschedule,
    canLearnerReportSupplier,
    canReportNoDriverAvailable: canReportNoDriverAvailableFlag,
    canSendMessage:
      reservationAllowsMessaging(reservation.status) && !hasOpenIncident,
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

  const legacyPickupReservations = reservations.filter(
    (reservation) =>
      reservation.status === 'ACCEPTED' &&
      reservation.fulfillmentMethod === 'PICKUP' &&
      !reservation.selfPickupCodeHash,
  );

  if (legacyPickupReservations.length) {
    await prisma.$transaction(async (tx) => {
      for (const reservation of legacyPickupReservations) {
        await ensureSelfPickupCodeStored(tx, reservation.id);
      }
    });
  }

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

export const getMyReservationById = async (
  requesterId: string,
  reservationId: string,
) => {
  let reservation = await reservationsRepository.findLearnerReservationById(
    requesterId,
    reservationId,
  );

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (
    reservation.status === 'ACCEPTED' &&
    reservation.fulfillmentMethod === 'PICKUP' &&
    !reservation.selfPickupCodeHash
  ) {
    await prisma.$transaction(async (tx) => {
      await ensureSelfPickupCodeStored(tx, reservation!.id);
    });

    reservation = await reservationsRepository.findLearnerReservationById(
      requesterId,
      reservationId,
    );

    if (!reservation) {
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    }
  }

  const latestMessages = await findLatestReservationMessagesByReservationIds([
    reservationId,
  ]);

  return mapLearnerReservation(
    reservation,
    latestMessages.has(reservation.id)
      ? mapReservationMessage(latestMessages.get(reservation.id)!)
      : null,
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

export const requestLearnerPickupReschedule = async (
  requesterId: string,
  reservationId: string,
  input: import('./reservations.validation.js').RequestPickupRescheduleInput,
) => {
  const end = new Date(input.pickupWindowEnd);
  const now = Date.now();
  if (end.getTime() <= Date.now()) {
    throw new AppError(
      'Pickup window end must be in the future.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (end.getTime() < now + MIN_PICKUP_NOTICE_MINUTES * 60_000) {
    throw new AppError(
      LEARNER_PICKUP_WINDOW_TOO_CLOSE_MESSAGE,
      400,
      'VALIDATION_ERROR',
    );
  }

  const result = await reservationsRescheduleRepository.requestLearnerPickupReschedule({
    requesterId,
    reservationId,
    pickupWindowStart: new Date(input.pickupWindowStart),
    pickupWindowEnd: end,
    reason: input.reason,
    note: input.note,
  });

  if (!result) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if ('duringHandover' in result && result.duringHandover) {
    throw new AppError(
      'Reschedule requests are not allowed during the pickup handover window.',
      409,
      'CONFLICT',
    );
  }

  if (result.conflict) {
    throw new AppError(
      'Only accepted pickup reservations can be rescheduled.',
      409,
      'CONFLICT',
    );
  }

  const mapped = await mapLearnerReservationById(requesterId, reservationId);
  if (!mapped) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  return mapped;
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

export const reportLearnerSupplierIssue = async (
  requesterId: string,
  reservationId: string,
  input: import('./reservations.validation.js').ReportSupplierIssueInput,
) => {
  const result = await createLearnerSupplierIssueReport({
    learnerId: requesterId,
    reservationId,
    reason: input.reason,
    note: input.note,
  });

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    case 'INVALID_STATUS':
    case 'NOT_SELF_PICKUP':
      throw new AppError(
        'Supplier issue reports are allowed only for accepted self-pickup reservations.',
        409,
        'CONFLICT',
      );
    case 'MISSING_WINDOW':
    case 'WINDOW_NOT_EXPIRED':
      throw new AppError(
        'Supplier issue reports are allowed only after the pickup window and grace period.',
        409,
        'CONFLICT',
      );
    case 'DUPLICATE':
      throw new AppError(
        'A supplier issue report already exists for this reservation.',
        409,
        'CONFLICT',
      );
    case 'CREATED': {
      const mapped = await mapLearnerReservationById(requesterId, reservationId);
      if (!mapped) {
        throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
      }
      return mapped;
    }
    default:
      throw new AppError('Unable to submit supplier issue report.', 500, 'INTERNAL_ERROR');
  }
};

export const reportNoDriverAvailable = async (
  reporterUserId: string,
  reservationId: string,
  input: import('./reservations.validation.js').ReportNoDriverInput,
) => {
  const result = await createNoDriverAvailableReport({
    reporterUserId,
    reservationId,
    note: input.note,
  });

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    case 'FORBIDDEN':
      throw new AppError('You cannot report this reservation.', 403, 'FORBIDDEN');
    case 'INVALID_STATUS':
    case 'INVALID_DELIVERY_STATE':
      throw new AppError(
        'No-driver reports are allowed only when delivery is waiting for a driver.',
        409,
        'CONFLICT',
      );
    case 'WINDOW_NOT_EXPIRED':
      throw new AppError(
        'No-driver reports are allowed only after the supplier pickup window and grace period.',
        409,
        'CONFLICT',
      );
    case 'DUPLICATE':
      throw new AppError(
        'A no-driver report already exists for this reservation.',
        409,
        'CONFLICT',
      );
    case 'CREATED': {
      const mapped = await mapLearnerReservationById(reporterUserId, reservationId);
      if (!mapped) {
        throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
      }
      return mapped;
    }
    default:
      throw new AppError('Unable to submit no-driver report.', 500, 'INTERNAL_ERROR');
  }
};
