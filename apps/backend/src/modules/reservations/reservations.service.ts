import { AppError } from '../../utils/app-error.js';
import { ACTIVE_DELIVERY_STATUSES } from '../deliveries/deliveries.service.js';
import { notifyNewJobForReservationWaitingDelivery } from '../notifications/driver-notification-events.service.js';
import { notifyReservationCancelledByLearner } from '../notifications/reservation-notifications.js';
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
  assertValidPickupWindow,
} from './pickup-window-validation.js';
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
import { resolveIncidentReviewStatus } from './incident-review-status.js';
import { resolveLearnerConfirmation as resolveLearnerConfirmationInRepository } from './reservations.learner-confirmation.repository.js';
import {
  expireStalePendingReservationsByIds,
  expireStalePendingReservationsForMaterialIds,
} from './reservations.pending-expiry.repository.js';
import {
  expireStaleMissedPickupsByIds,
  expireStaleMissedPickupsForMaterialIds,
  expireStaleMissedPickupsForRequester,
} from './reservations.missed-pickup-expiry.repository.js';
import {
  escalateStaleNoDriverDeliveriesByIds,
  escalateStaleNoDriverDeliveriesForRequester,
} from './reservations.no-driver-auto-escalation.repository.js';
import {
  escalateStaleAssignedDriverPickupsByIds,
  escalateStaleAssignedDriverPickupsForRequester,
} from './reservations.stale-assigned-driver-auto-escalation.repository.js';
import { isAssignedDriverPickupOverdue } from './reservation-assigned-driver-pickup-overdue.js';
import { notifyReservationCreated } from '../notifications/reservation-notifications.js';
import {
  buildReservationQuote,
  mapPricingFields,
} from './reservation-pricing.service.js';
import {
  decimalToNumber,
  getMaterialQuantityState,
} from './reservations.quantity.js';
import type {
  CreateReservationInput,
  CreateReservationMessageInput,
  LearnerConfirmationInput,
  ReservationQuoteInput as ReservationQuoteBody,
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
  ...mapPricingFields(reservation),
});

const LEARNER_DELIVERY_CODE_VISIBLE_STATUSES = new Set([
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
]);

const resolveReservationOperationalDelivery = (
  reservation: reservationsRepository.LearnerReservationListRecord,
) => {
  const directDelivery = reservation.deliveries[0] ?? null;
  const groupDelivery = reservation.deliveryGroup?.delivery ?? null;
  const effectiveDelivery = directDelivery ?? groupDelivery;

  return {
    effectiveDelivery,
    deliveryCount: effectiveDelivery ? 1 : 0,
    groupItemCount: reservation.deliveryGroup?.reservations.length ?? 0,
    groupDeliveryFee:
      reservation.deliveryGroup?.deliveryFee != null
        ? Number(reservation.deliveryGroup.deliveryFee)
        : null,
    groupTotal:
      reservation.deliveryGroup != null
        ? Number(
            reservation.deliveryGroup.reservations.reduce(
              (sum, item) =>
                sum + Number(item.materialSubtotal ?? 0),
              Number(reservation.deliveryGroup!.deliveryFee),
            ),
          )
        : null,
  };
};

const mapLearnerReservation = (
  reservation: reservationsRepository.LearnerReservationListRecord,
  latestMessage?: ReturnType<typeof mapReservationMessage> | null,
) => {
  const followUp = resolveReservationFollowUp({
    status: reservation.status,
    pickupWindowStart: reservation.pickupWindowStart,
    pickupWindowEnd: reservation.pickupWindowEnd,
  });
  const {
    effectiveDelivery: latestDelivery,
    deliveryCount,
    groupItemCount,
    groupDeliveryFee,
    groupTotal,
  } = resolveReservationOperationalDelivery(reservation);
  const pickupHandoverPhase = resolveSelfPickupHandoverPhase({
    status: reservation.status,
    pickupWindowStart: reservation.pickupWindowStart,
    pickupWindowEnd: reservation.pickupWindowEnd,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryCount,
  });
  const canLearnerReschedule = canRequestPickupReschedule({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
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
  const incidentReviewStatus = resolveIncidentReviewStatus(
    reservation.noShowReports,
  );
  const pendingIncidentReasonCode =
    reservation.noShowReports.find((report) => report.status === 'PENDING_REVIEW')
      ?.reasonCode ?? null;
  const canLearnerReportSupplier = canLearnerReportSupplierIssue({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryCount,
    pickupWindowEnd: reservation.pickupWindowEnd,
    hasPendingReport: hasOpenIncident,
  });
  const canReportNoDriverAvailableFlag = canReportNoDriverAvailable({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
    pickupWindowEnd: reservation.pickupWindowEnd,
    deliveryStatus: latestDelivery?.status ?? null,
    assignedDriverProfileId: latestDelivery?.assignedDriverProfileId ?? null,
    hasDelivery: deliveryCount > 0,
    hasPendingReport: hasOpenIncident,
  });
  const assignedDriverPickupOverdue = isAssignedDriverPickupOverdue({
    supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
    pickupWindowEnd: reservation.pickupWindowEnd,
    deliveryStatus: latestDelivery?.status ?? null,
  });
  const canLearnerRequestDelivery =
    reservation.status === 'ACCEPTED' &&
    reservation.fulfillmentMethod === 'PICKUP' &&
    reservation.material.deliveryAllowed &&
    (!latestDelivery ||
      !(ACTIVE_DELIVERY_STATUSES as readonly string[]).includes(
        latestDelivery.status,
      ));

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
    assignedDriverPickupOverdue,
    canLearnerRequestDelivery,
    canSendMessage:
      reservationAllowsMessaging(reservation.status) && !hasOpenIncident,
    incidentReviewStatus,
    pendingIncidentReasonCode,
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
    groupItemCount: groupItemCount > 0 ? groupItemCount : null,
    groupDeliveryFee,
    groupTotal,
    ...mapPricingFields(reservation),
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
  let reservations =
    await reservationsRepository.findLearnerReservations(requesterId);

  const pendingIds = reservations
    .filter((reservation) => reservation.status === 'PENDING')
    .map((reservation) => reservation.id);

  if (pendingIds.length > 0) {
    await expireStalePendingReservationsByIds(pendingIds, requesterId);
    reservations =
      await reservationsRepository.findLearnerReservations(requesterId);
  }

  await expireStaleMissedPickupsForRequester(requesterId);
  await escalateStaleNoDriverDeliveriesForRequester(requesterId);
  await escalateStaleAssignedDriverPickupsForRequester(requesterId);
  reservations =
    await reservationsRepository.findLearnerReservations(requesterId);

  const legacyPickupReservations = reservations.filter(
    (reservation) =>
      reservation.status === 'ACCEPTED' &&
      reservation.fulfillmentMethod === 'PICKUP' &&
      !reservation.selfPickupCodeHash,
  );

  if (legacyPickupReservations.length) {
    await prisma.$transaction(
      async (tx) => {
        for (const reservation of legacyPickupReservations) {
          await ensureSelfPickupCodeStored(tx, reservation.id);
        }
      },
      { timeout: 15_000 },
    );
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

  if (reservation.status === 'PENDING') {
    await expireStalePendingReservationsByIds([reservationId], requesterId);
    reservation = await reservationsRepository.findLearnerReservationById(
      requesterId,
      reservationId,
    );

    if (!reservation) {
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    }
  }

  if (reservation.status === 'ACCEPTED') {
    await expireStaleMissedPickupsByIds([reservationId], requesterId);
    await escalateStaleNoDriverDeliveriesByIds([reservationId]);
    await escalateStaleAssignedDriverPickupsByIds([reservationId]);
    reservation = await reservationsRepository.findLearnerReservationById(
      requesterId,
      reservationId,
    );

    if (!reservation) {
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    }
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

export const expireStalePendingReservationsForMaterials = async (
  materialIds: string[],
) => {
  await expireStalePendingReservationsForMaterialIds(materialIds);
  await expireStaleMissedPickupsForMaterialIds(materialIds);
};

export const createReservation = async (
  requesterId: string,
  input: CreateReservationInput,
) => {
  if (input.fulfillmentMethod === 'PICKUP') {
    for (const window of input.learnerPreferredPickupWindows ?? []) {
      assertValidPickupWindow(
        {
          start: new Date(window.start),
          end: new Date(window.end),
        },
        'learner_preferred',
      );
    }
  }

  const result = await reservationsRepository.createLearnerReservation({
    requesterId,
    materialId: input.materialId,
    quantityRequested: input.quantityRequested,
    message: input.message,
    fulfillmentMethod: input.fulfillmentMethod,
    learnerPreferredPickupWindows: input.learnerPreferredPickupWindows,
    learnerPreferredDeliveryWindows: input.learnerPreferredDeliveryWindows,
    deliveryAddressText: input.deliveryAddressText,
    dropoffCity: input.dropoffCity,
    dropoffArea: input.dropoffArea,
    safeDropoffAllowed: input.safeDropoffAllowed,
    deliveryNote: input.deliveryNote,
    buildItemId: input.buildItemId,
    combineWithDeliveryGroupId: input.combineWithDeliveryGroupId,
  });

  switch (result.outcome) {
    case 'CREATED':
      void notifyReservationCreated(result.reservation.id);
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
    case 'BUILD_ITEM_NOT_FOUND':
      throw new AppError('Project build item not found', 404, 'NOT_FOUND');
    case 'BUILD_ITEM_MATERIAL_MISMATCH':
      throw new AppError(
        'Reservation material does not match the linked build item material',
        400,
        'BUILD_ITEM_MATERIAL_MISMATCH',
      );
    case 'ACTIVE_BUILD_ITEM_RESERVATION':
      throw new AppError(
        'This build checklist item already has an active linked reservation',
        409,
        'ACTIVE_BUILD_ITEM_RESERVATION',
      );
    case 'DELIVERY_PRICING_ERROR':
      throw new AppError(
        result.message ?? 'Delivery fee could not be calculated for this location.',
        400,
        'DELIVERY_PRICING_ERROR',
      );
    case 'GROUP_NOT_AVAILABLE':
      throw new AppError(
        result.message ?? 'Combined delivery is no longer available.',
        409,
        'GROUP_NOT_AVAILABLE',
      );
    case 'VALIDATION_ERROR':
      throw new AppError(
        result.message ?? 'Invalid reservation request.',
        400,
        'VALIDATION_ERROR',
      );
    default:
      throw new AppError('Unable to create reservation.', 500, 'INTERNAL_ERROR');
  }
};

export const quoteReservation = async (
  requesterId: string,
  input: ReservationQuoteBody,
) => {
  const material = await reservationsRepository.findMaterialForReservationQuote(
    input.materialId,
  );

  if (!material) {
    throw new AppError('Material not found.', 404, 'NOT_FOUND');
  }

  if (material.ownerId === requesterId) {
    throw new AppError(
      'You cannot reserve your own material.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (material.status === 'UNAVAILABLE' || material.status === 'REUSED') {
    throw new AppError(
      'This material is no longer available.',
      409,
      'CONFLICT',
    );
  }

  const quantityState = await getMaterialQuantityState(prisma, material.id);

  if (!quantityState) {
    throw new AppError('Material not found.', 404, 'NOT_FOUND');
  }

  const availableQuantity = decimalToNumber(quantityState.availableQuantity);

  const result = await buildReservationQuote(
    {
      id: material.id,
      isFree: material.isFree,
      price: material.price,
      currency: material.currency,
      pickupCity: material.location.city,
      supplierProfileId: material.supplierProfileId,
      deliveryAllowed: material.deliveryAllowed,
      pickupAllowed: material.pickupAllowed,
      status: material.status,
    },
    availableQuantity,
    {
      learnerId: requesterId,
      materialId: input.materialId,
      quantity: input.quantity,
      fulfillmentMethod: input.fulfillmentMethod,
      dropoffCity: input.dropoffCity,
      dropoffArea: input.dropoffArea,
      learnerPreferredDeliveryWindows: input.learnerPreferredDeliveryWindows,
      combineWithDeliveryGroupId: input.combineWithDeliveryGroupId,
    },
  );

  if (!result.ok) {
    const status =
      result.code === 'INVALID_QUANTITY'
        ? 400
        : result.code === 'GROUP_NOT_AVAILABLE'
          ? 409
          : 400;

    throw new AppError(result.message, status, result.code, result.details);
  }

  return result.quote;
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
      void notifyReservationCancelledByLearner(result.reservation.id);
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
  const startRaw = input.pickupWindowStart?.trim();
  const endRaw = input.pickupWindowEnd?.trim();

  if (!startRaw || !endRaw) {
    throw new AppError(
      'A new pickup window is required for reschedule requests.',
      400,
      'PICKUP_WINDOW_REQUIRED',
    );
  }

  assertValidPickupWindow(
    {
      start: new Date(startRaw),
      end: new Date(endRaw),
    },
    'learner_preferred',
  );

  const end = new Date(endRaw);

  const result = await reservationsRescheduleRepository.requestLearnerPickupReschedule({
    requesterId,
    reservationId,
    pickupWindowStart: new Date(startRaw),
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
      if (result.outcome === 'ACCEPTED') {
        await notifyNewJobForReservationWaitingDelivery(reservationId);
      }

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
