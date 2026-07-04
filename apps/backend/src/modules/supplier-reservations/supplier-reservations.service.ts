import type { ReservationStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  expireStalePendingReservationsByIds,
  expireStalePendingReservationsForOwner,
} from '../reservations/reservations.pending-expiry.repository.js';
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
import {
  mapPreferredWindowsForResponse,
  resolvePreferredWindowByIndex,
} from './supplier-reservation-scheduling.js';
import {
  MIN_CUSTOM_PICKUP_START_NOTICE_MINUTES,
  MIN_PICKUP_NOTICE_MINUTES,
  PICKUP_WINDOW_TOO_CLOSE_MESSAGE,
  PROPOSED_PICKUP_START_TOO_SOON_MESSAGE,
} from '../reservations/reservation-timing-policy.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import {
  evaluateHandoverWindow,
  pickupWindowNotStartedMessage,
  pickupWindowPassedMessage,
} from '../../utils/handover-timing.js';
import {
  canRequestPickupReschedule,
  mapPendingRescheduleSummary,
  resolveSelfPickupHandoverPhase,
} from '../reservations/reservation-reschedule.js';
import {
  canSupplierMarkDriverNoShow,
} from '../fulfillment-failures/fulfillment-failures.eligibility.js';
import {
  canReportNoDriverAvailable,
  createNoDriverAvailableReport,
} from '../reservations/reservations.incidents.repository.js';
import type {
  AcceptSupplierReservationInput,
  CancelSupplierReservationInput,
  CompleteSupplierReservationInput,
  DeclineSupplierReservationInput,
  ListSupplierReservationsQuery,
  RescheduleSupplierReservationInput,
  SubmitNoShowReportInput,
  CreateReservationMessageInput,
} from './supplier-reservations.validation.js';

const tabToReservationStatuses = (
  status: NonNullable<ListSupplierReservationsQuery['status']>,
): ReservationStatus[] | null => {
  switch (status) {
    case 'all':
      return null;
    case 'pending':
      return ['PENDING'];
    case 'needs_learner':
      return ['AWAITING_LEARNER_CONFIRMATION'];
    case 'needs_supplier':
      return ['AWAITING_SUPPLIER_CONFIRMATION'];
    case 'accepted':
      return ['ACCEPTED'];
    case 'declined':
      return ['REJECTED'];
    case 'completed':
      return ['COMPLETED'];
    case 'cancelled':
      return ['CANCELLED', 'EXPIRED'];
    default:
      return null;
  }
};

const mapFulfillmentLabel = (fulfillmentMethod: string): string => {
  if (fulfillmentMethod === 'DELIVERY') {
    return 'Delivery selected';
  }

  return 'Pickup selected';
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
  const isSelfPickup =
    reservation.fulfillmentMethod === 'PICKUP' && !hasDelivery;
  const pickupHandoverPhase = resolveSelfPickupHandoverPhase({
    status: reservation.status,
    pickupWindowStart: reservation.pickupWindowStart,
    pickupWindowEnd: reservation.pickupWindowEnd,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryRequested: reservation.deliveryRequested,
    deliveryCount: reservation._count.deliveries,
  });
  const hasLearnerNoShowReport = reservation.noShowReports.some(
    (report) => report.targetRole === 'LEARNER',
  );
  const hasOpenIncident =
    reservation.status === 'AWAITING_RESOLUTION' ||
    reservation.noShowReports.some(
      (report) => report.status === 'PENDING_REVIEW',
    );
  const awaitingLearnerReschedule =
    reservation.status === 'AWAITING_SUPPLIER_CONFIRMATION';
  const canReschedule = canRequestPickupReschedule({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryRequested: reservation.deliveryRequested,
    deliveryCount: reservation._count.deliveries,
    pickupWindowStart: reservation.pickupWindowStart,
    pickupWindowEnd: reservation.pickupWindowEnd,
    hasFinalReport: hasOpenIncident,
  });
  const canCompleteBase =
    supplierReservationsRepository.supplierCanCompleteReservation({
      status: reservation.status,
      fulfillmentMethod: reservation.fulfillmentMethod,
      deliveryRequested: reservation.deliveryRequested,
      hasDelivery,
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
    fulfillmentMethod: reservation.fulfillmentMethod,
    fulfillmentLabel: mapFulfillmentLabel(reservation.fulfillmentMethod),
    learnerPreferredPickupWindows: mapPreferredWindowsForResponse(
      reservation.learnerPreferredPickupWindows,
    ),
    learnerPreferredDeliveryWindows: mapPreferredWindowsForResponse(
      reservation.learnerPreferredDeliveryWindows,
    ),
    deliveryAddressText: reservation.deliveryAddressText,
    safeDropoffAllowed: reservation.safeDropoffAllowed,
    deliveryNote: reservation.deliveryNote,
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
    deliveryRequested: reservation.deliveryRequested,
    activeDelivery: latestDelivery
      ? {
          id: latestDelivery.id,
          status: latestDelivery.status,
        }
      : null,
    supplierHandoverCode:
      reservation.status === 'ACCEPTED' &&
      reservation.fulfillmentMethod === 'DELIVERY' &&
      latestDelivery != null
        ? deriveHandoverCode('supplier-handover', latestDelivery.id)
        : null,
    canSupplierComplete:
      canCompleteBase && pickupHandoverPhase === 'DURING_ALLOWED',
    pickupWindowStart: reservation.pickupWindowStart?.toISOString() ?? null,
    pickupWindowEnd: reservation.pickupWindowEnd?.toISOString() ?? null,
    supplierNote: reservation.supplierNote,
    rejectionReason: reservation.rejectionReason,
    completedAt: reservation.completedAt?.toISOString() ?? null,
    createdAt: reservation.createdAt.toISOString(),
    pickupWindowStatus: followUp.pickupWindowStatus,
    isOverdue: followUp.isOverdue,
    needsFollowUp: followUp.needsFollowUp,
    pickupHandoverPhase,
    canSupplierCloseOverduePickup:
      pickupHandoverPhase === 'AFTER_ALLOWED' &&
      isSelfPickup &&
      !hasOpenIncident,
    canSupplierReportAndCloseOverduePickup:
      pickupHandoverPhase === 'AFTER_ALLOWED' &&
      isSelfPickup &&
      !hasOpenIncident,
    canSupplierReschedule: canReschedule,
    canSupplierAcceptLearnerReschedule: awaitingLearnerReschedule && isSelfPickup,
    canSupplierProposeDifferentTime: awaitingLearnerReschedule && isSelfPickup,
    canSupplierCloseAwaitingLearnerRequest:
      awaitingLearnerReschedule && isSelfPickup && !hasOpenIncident,
    canSupplierReportAwaitingLearnerRequest:
      awaitingLearnerReschedule && isSelfPickup && !hasOpenIncident,
    canReportNoDriverAvailable: canReportNoDriverAvailable({
      status: reservation.status,
      fulfillmentMethod: reservation.fulfillmentMethod,
      supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
      deliveryStatus: latestDelivery?.status ?? null,
      assignedDriverProfileId: latestDelivery?.assignedDriverProfileId ?? null,
      hasPendingReport: hasOpenIncident,
    }),
    canSupplierReportDriverNoShow:
      !hasOpenIncident &&
      canSupplierMarkDriverNoShow({
        status: reservation.status,
        supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
        deliveryStatus: latestDelivery?.status ?? null,
        assignedDriverProfileId: latestDelivery?.assignedDriverProfileId ?? null,
      }),
    canSendMessage:
      reservationAllowsMessaging(reservation.status) && !hasOpenIncident,
    noShowReport: mapNoShowReportSummary(reservation.noShowReports),
    latestMessage: latestMessage ?? null,
  };
};

export const listSupplierReservations = async (
  ownerId: string,
  query: ListSupplierReservationsQuery,
) => {
  await expireStalePendingReservationsForOwner(ownerId);

  const statuses = query.status
    ? tabToReservationStatuses(query.status)
    : null;

  const reservations =
    await supplierReservationsRepository.findSupplierReservations(
      ownerId,
      statuses ?? undefined,
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
  let existing =
    await supplierReservationsRepository.findSupplierReservationForOwner(
      ownerId,
      reservationId,
    );

  if (!existing) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  await expireStalePendingReservationsByIds([reservationId], ownerId);

  existing =
    await supplierReservationsRepository.findSupplierReservationForOwner(
      ownerId,
      reservationId,
    );

  if (!existing) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (existing.status === 'EXPIRED') {
    throw new AppError(
      'This reservation expired before it could be accepted.',
      409,
      'CONFLICT',
    );
  }

  if (existing.status !== 'PENDING') {
    throw new AppError(
      'Only pending reservations can be accepted.',
      409,
      'CONFLICT',
    );
  }

  let pickupWindowStart = new Date(input.pickupWindowStart);
  let pickupWindowEnd = new Date(input.pickupWindowEnd);

  if (input.selectedPreferredWindowIndex != null) {
    if (existing.fulfillmentMethod === 'PICKUP') {
      const selectedWindow = resolvePreferredWindowByIndex(
        existing.learnerPreferredPickupWindows,
        input.selectedPreferredWindowIndex,
      );

      if (!selectedWindow) {
        throw new AppError(
          'Selected preferred pickup window is invalid.',
          400,
          'VALIDATION_ERROR',
        );
      }

      pickupWindowStart = selectedWindow.start;
      pickupWindowEnd = selectedWindow.end;
    } else if (existing.fulfillmentMethod === 'DELIVERY') {
      const selectedWindow = resolvePreferredWindowByIndex(
        existing.learnerPreferredDeliveryWindows,
        input.selectedPreferredWindowIndex,
      );

      if (!selectedWindow) {
        throw new AppError(
          'Selected preferred delivery window is invalid.',
          400,
          'VALIDATION_ERROR',
        );
      }
    } else {
      throw new AppError(
        'Preferred window index is only supported for pickup or delivery reservations.',
        400,
        'VALIDATION_ERROR',
      );
    }
  }

  let proposedDeliveryWindow: { start: Date; end: Date } | undefined;
  if (
    input.proposedDeliveryWindowStart &&
    input.proposedDeliveryWindowEnd &&
    existing.fulfillmentMethod === 'DELIVERY'
  ) {
    proposedDeliveryWindow = {
      start: new Date(input.proposedDeliveryWindowStart),
      end: new Date(input.proposedDeliveryWindowEnd),
    };
  }

  const now = Date.now();
  const isSelectedLearnerPickupWindow =
    existing.fulfillmentMethod === 'PICKUP' &&
    input.selectedPreferredWindowIndex != null;

  if (isSelectedLearnerPickupWindow) {
    const latestAcceptableEnd =
      now + MIN_PICKUP_NOTICE_MINUTES * 60_000;
    if (pickupWindowEnd.getTime() < latestAcceptableEnd) {
      throw new AppError(
        PICKUP_WINDOW_TOO_CLOSE_MESSAGE,
        400,
        'VALIDATION_ERROR',
      );
    }
  } else {
    const earliestCustomStart =
      now + MIN_CUSTOM_PICKUP_START_NOTICE_MINUTES * 60_000;
    if (pickupWindowStart.getTime() < earliestCustomStart) {
      throw new AppError(
        PROPOSED_PICKUP_START_TOO_SOON_MESSAGE,
        400,
        'VALIDATION_ERROR',
      );
    }

    if (pickupWindowEnd.getTime() <= now) {
      throw new AppError(
        'Supplier window end must be in the future.',
        400,
        'VALIDATION_ERROR',
      );
    }
  }

  if (
    proposedDeliveryWindow &&
    proposedDeliveryWindow.start.getTime() <= now
  ) {
    throw new AppError(
      'Proposed delivery window start must be in the future.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (existing.fulfillmentMethod === 'DELIVERY') {
    if (!existing.material.deliveryAllowed) {
      throw new AppError(
        'This material does not allow delivery.',
        400,
        'VALIDATION_ERROR',
      );
    }

    if (!existing.deliveryAddressText?.trim()) {
      throw new AppError(
        'Delivery address is required.',
        400,
        'VALIDATION_ERROR',
      );
    }

    const learnerDeliveryWindows = mapPreferredWindowsForResponse(
      existing.learnerPreferredDeliveryWindows,
    );

    if (!learnerDeliveryWindows.length) {
      throw new AppError(
        'Learner delivery windows are required.',
        400,
        'VALIDATION_ERROR',
      );
    }
  }

  const result = await supplierReservationsRepository.acceptSupplierReservation({
    reservationId,
    ownerId,
    pickupWindowStart,
    pickupWindowEnd,
    supplierNote: input.supplierNote,
    selectedPreferredWindowIndex: input.selectedPreferredWindowIndex,
    proposedDeliveryWindow,
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
  input: CompleteSupplierReservationInput = { confirmationCode: '' },
) => {
  const result = await supplierReservationsRepository.completeSupplierReservation(
    {
      reservationId,
      ownerId,
      confirmationCode: input.confirmationCode,
    },
  );

  if (!result) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if ('invalidCode' in result && result.invalidCode) {
    throw new AppError(
      'The pickup confirmation code is incorrect.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if ('windowNotStarted' in result && result.windowNotStarted) {
    throw new AppError(pickupWindowNotStartedMessage(), 400, 'VALIDATION_ERROR');
  }

  if ('windowExpired' in result && result.windowExpired) {
    throw new AppError(pickupWindowPassedMessage(), 400, 'VALIDATION_ERROR');
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
  const start = new Date(input.pickupWindowStart);
  const end = new Date(input.pickupWindowEnd);
  const now = Date.now();

  if (
    start.getTime() <
    now + MIN_CUSTOM_PICKUP_START_NOTICE_MINUTES * 60_000
  ) {
    throw new AppError(
      PROPOSED_PICKUP_START_TOO_SOON_MESSAGE,
      400,
      'VALIDATION_ERROR',
    );
  }

  if (end.getTime() <= now) {
    throw new AppError(
      'Pickup window end must be in the future.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const result = await supplierReservationsRepository.rescheduleSupplierReservation({
    reservationId,
    ownerId,
    pickupWindowStart: start,
    pickupWindowEnd: end,
    supplierNote: input.supplierNote,
    followUpMessage: input.messageToLearner,
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
      'Only accepted reservations can be rescheduled.',
      409,
      'CONFLICT',
    );
  }

  return mapSupplierReservation(result.reservation);
};

export const acceptLearnerRescheduleProposal = async (
  ownerId: string,
  reservationId: string,
) => {
  const result =
    await supplierReservationsRepository.acceptLearnerRescheduleProposal({
      reservationId,
      ownerId,
    });

  if (!result) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if ('conflict' in result && result.conflict) {
    throw new AppError(
      'Only reservations awaiting supplier confirmation can be accepted.',
      409,
      'CONFLICT',
    );
  }

  if ('missingProposal' in result && result.missingProposal) {
    throw new AppError('Learner reschedule proposal is missing.', 409, 'CONFLICT');
  }

  if ('windowTooClose' in result && result.windowTooClose) {
    throw new AppError(
      PICKUP_WINDOW_TOO_CLOSE_MESSAGE,
      400,
      'VALIDATION_ERROR',
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

  const reservation =
    await supplierReservationsRepository.findSupplierReservationForOwner(
      ownerId,
      reservationId,
    );

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  return mapSupplierReservation(reservation);
};

export const reportSupplierNoDriverAvailable = async (
  ownerId: string,
  reservationId: string,
  input: { note?: string },
) => {
  const result = await createNoDriverAvailableReport({
    reporterUserId: ownerId,
    reservationId,
    note: input.note,
  });

  switch (result.outcome) {
    case 'NOT_FOUND':
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    case 'FORBIDDEN':
      throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
    case 'INVALID_STATUS':
    case 'INVALID_DELIVERY_STATE':
      throw new AppError(
        'No-driver reports apply only to accepted deliveries waiting for a driver.',
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
    case 'CREATED':
      break;
    default:
      throw new AppError('Unable to submit no-driver report.', 500, 'INTERNAL_ERROR');
  }

  const reservation =
    await supplierReservationsRepository.findSupplierReservationForOwner(
      ownerId,
      reservationId,
    );

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  return mapSupplierReservation(reservation);
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
