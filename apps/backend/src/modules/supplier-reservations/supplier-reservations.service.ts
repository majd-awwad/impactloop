import type { ReservationStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  expireStalePendingReservationsByIds,
  expireStalePendingReservationsForOwner,
} from '../reservations/reservations.pending-expiry.repository.js';
import {
  expireStaleMissedPickupsByIds,
  expireStaleMissedPickupsForOwner,
} from '../reservations/reservations.missed-pickup-expiry.repository.js';
import {
  escalateStaleNoDriverDeliveriesByIds,
  escalateStaleNoDriverDeliveriesForOwner,
} from '../reservations/reservations.no-driver-auto-escalation.repository.js';
import {
  escalateStaleAssignedDriverPickupsForOwner,
} from '../reservations/reservations.stale-assigned-driver-auto-escalation.repository.js';
import { isAssignedDriverPickupOverdue } from '../reservations/reservation-assigned-driver-pickup-overdue.js';
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
  assertValidPickupWindow,
  validatePickupWindow,
} from '../reservations/pickup-window-validation.js';
import { PICKUP_WINDOW_TOO_CLOSE_MESSAGE, isAdminSupplierPickupReconfirmReason } from '../reservations/reservation-timing-policy.js';
import { submitNoDriverPickupWindowForSupplier } from './no-driver-supplier-pickup.repository.js';
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
import { mapReservationFulfillmentLabel } from '../reservations/reservation-delivery.js';
import {
  canSupplierMarkLearnerPickupNoShow,
  canSupplierMarkDeliveryPickupExpired as isSupplierDeliveryPickupExpiryAllowed,
  canSupplierMarkDriverNoShow as isSupplierDriverNoShowAllowed,
} from '../fulfillment-failures/fulfillment-failures.eligibility.js';
import {
  canReportNoDriverAvailable as isSupplierNoDriverReportAllowed,
  createNoDriverAvailableReport,
} from '../reservations/reservations.incidents.repository.js';
import {
  notifyReservationAccepted,
  notifyReservationDeclined,
} from '../notifications/reservation-notifications.js';
import { notifyNewJobForReservationWaitingDelivery } from '../notifications/driver-notification-events.service.js';
import { invalidateLearnerHomeForReservationTransition } from '../learner-home/learner-home.service.js';
import { classifyAdminReportContract } from '../admin-no-show-reports/admin-no-show-reports.classifier.js';
import {
  composeSupplierReservationContract,
  type ReservationAttentionState,
  type SupplierReservationSummaryBucket,
} from './supplier-reservations.classifier.js';
import type {
  AcceptSupplierReservationInput,
  CancelSupplierReservationInput,
  CompleteSupplierReservationInput,
  DeclineSupplierReservationInput,
  ListSupplierReservationsQuery,
  RescheduleSupplierReservationInput,
  SubmitNoDriverPickupWindowInput,
  SubmitNoShowReportInput,
  CreateReservationMessageInput,
} from './supplier-reservations.validation.js';

const assertPendingReservationForAccept = (status: ReservationStatus) => {
  if (status === 'PENDING') {
    return;
  }

  if (status === 'EXPIRED') {
    throw new AppError(
      'This reservation expired before it could be accepted.',
      409,
      'RESERVATION_EXPIRED',
    );
  }

  if (status === 'ACCEPTED') {
    throw new AppError(
      'This reservation was already accepted.',
      409,
      'RESERVATION_ALREADY_ACCEPTED',
    );
  }

  if (status === 'REJECTED') {
    throw new AppError(
      'This reservation was already declined.',
      409,
      'RESERVATION_ALREADY_DECLINED',
    );
  }

  if (status === 'CANCELLED') {
    throw new AppError(
      'This reservation was cancelled and cannot be accepted.',
      409,
      'RESERVATION_CANCELLED',
    );
  }

  throw new AppError(
    'Only pending reservations can be accepted.',
    409,
    'RESERVATION_NOT_PENDING',
  );
};

const assertPendingReservationForDecline = (status: ReservationStatus) => {
  if (status === 'PENDING') {
    return;
  }

  if (status === 'EXPIRED') {
    throw new AppError(
      'This reservation expired before it could be declined.',
      409,
      'RESERVATION_EXPIRED',
    );
  }

  if (status === 'ACCEPTED') {
    throw new AppError(
      'Accepted reservations cannot be declined.',
      409,
      'RESERVATION_ALREADY_ACCEPTED',
    );
  }

  if (status === 'REJECTED') {
    throw new AppError(
      'This reservation was already declined.',
      409,
      'RESERVATION_ALREADY_DECLINED',
    );
  }

  if (status === 'CANCELLED') {
    throw new AppError(
      'This reservation was cancelled and cannot be declined.',
      409,
      'RESERVATION_CANCELLED',
    );
  }

  throw new AppError(
    'Only pending reservations can be declined.',
    409,
    'RESERVATION_NOT_PENDING',
  );
};

const tabToReservationStatuses = (status: string): ReservationStatus[] | null => {
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

const mapFulfillmentLabel = (
  fulfillmentMethod: string,
  deliveryCount: number,
): string => mapReservationFulfillmentLabel(fulfillmentMethod, deliveryCount);

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
    note: pending.note,
    createdAt: pending.createdAt.toISOString(),
    reviewedAt: pending.reviewedAt?.toISOString() ?? null,
    reviewNote: pending.reviewNote,
  };
};

export const mapSupplierReservation = (
  reservation: supplierReservationsRepository.SupplierReservationListRecord,
  latestMessage?: ReturnType<typeof mapReservationMessage> | null,
) => {
  const directDelivery = reservation.deliveries[0] ?? null;
  const groupDelivery = reservation.deliveryGroup?.delivery ?? null;
  const latestDelivery = directDelivery ?? groupDelivery;
  const hasDelivery = latestDelivery != null;
  const deliveryCount = hasDelivery ? 1 : 0;
  const groupItemCount = reservation.deliveryGroup?._count.reservations ?? 0;
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
    deliveryCount: deliveryCount,
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
  const hasLearnerProposedPickupWindow =
    reservation.learnerProposedPickupWindowStart != null &&
    reservation.learnerProposedPickupWindowEnd != null;
  const canReschedule = canRequestPickupReschedule({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryCount,
    pickupWindowStart: reservation.pickupWindowStart,
    pickupWindowEnd: reservation.pickupWindowEnd,
    hasFinalReport: hasOpenIncident,
  });
  const canCompleteBase =
    supplierReservationsRepository.supplierCanCompleteReservation({
      status: reservation.status,
      fulfillmentMethod: reservation.fulfillmentMethod,
      hasDelivery,
    });
  const canSupplierComplete =
    canCompleteBase && pickupHandoverPhase === 'DURING_ALLOWED';
  const canSupplierCloseOverduePickup =
    pickupHandoverPhase === 'AFTER_ALLOWED' && isSelfPickup && !hasOpenIncident;
  const canSupplierReportAndCloseOverduePickup =
    pickupHandoverPhase === 'AFTER_ALLOWED' && isSelfPickup && !hasOpenIncident;
  const canSupplierAcceptLearnerReschedule =
    awaitingLearnerReschedule && isSelfPickup && hasLearnerProposedPickupWindow;
  const canSupplierProposeDifferentTime = awaitingLearnerReschedule && isSelfPickup;
  const canSupplierCloseAwaitingLearnerRequest =
    awaitingLearnerReschedule && isSelfPickup && !hasOpenIncident;
  const canSupplierReportAwaitingLearnerRequest =
    awaitingLearnerReschedule && isSelfPickup && !hasOpenIncident;
  const canReportNoDriverAvailable = isSupplierNoDriverReportAllowed({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
    pickupWindowEnd: reservation.pickupWindowEnd,
    deliveryStatus: latestDelivery?.status ?? null,
    assignedDriverProfileId: latestDelivery?.assignedDriverProfileId ?? null,
    hasDelivery,
    hasPendingReport: hasOpenIncident,
  });
  const canSubmitNoDriverPickupWindow =
    reservation.status === 'AWAITING_SUPPLIER_CONFIRMATION' &&
    reservation.fulfillmentMethod === 'DELIVERY' &&
    isAdminSupplierPickupReconfirmReason(reservation.pendingRescheduleReason) &&
    latestDelivery?.status === 'AWAITING_RESOLUTION';
  const canSupplierMarkDeliveryPickupExpired =
    !hasOpenIncident &&
    isSupplierDeliveryPickupExpiryAllowed({
      status: reservation.status,
      fulfillmentMethod: reservation.fulfillmentMethod,
      supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
      pickupWindowEnd: reservation.pickupWindowEnd,
      deliveryStatus: latestDelivery?.status ?? null,
      assignedDriverProfileId: latestDelivery?.assignedDriverProfileId ?? null,
      hasDelivery,
    });
  const canSupplierReportDriverNoShow =
    !hasOpenIncident &&
    isSupplierDriverNoShowAllowed({
      status: reservation.status,
      supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
      pickupWindowEnd: reservation.pickupWindowEnd,
      deliveryStatus: latestDelivery?.status ?? null,
      assignedDriverProfileId: latestDelivery?.assignedDriverProfileId ?? null,
    });
  const canMarkLearnerNoShow =
    !hasOpenIncident &&
    canSupplierMarkLearnerPickupNoShow({
      status: reservation.status,
      fulfillmentMethod: reservation.fulfillmentMethod,
      pickupWindowEnd: reservation.pickupWindowEnd,
    });
  const canSendMessage =
    reservationAllowsMessaging(reservation.status) && !hasOpenIncident;
  const contract = composeSupplierReservationContract({
    status: reservation.status,
    fulfillmentMethod: reservation.fulfillmentMethod,
    deliveryStatus: latestDelivery?.status ?? null,
    hasDelivery,
    canAccept: reservation.status === 'PENDING',
    canDecline: reservation.status === 'PENDING',
    canSendMessage,
    canSupplierComplete,
    canSupplierReschedule: canReschedule,
    canSupplierAcceptLearnerReschedule,
    canSupplierProposeDifferentTime,
    canSupplierClose:
      canSupplierCloseOverduePickup || canSupplierCloseAwaitingLearnerRequest,
    canMarkLearnerNoShow,
    canReportIncident:
      canSupplierReportAndCloseOverduePickup ||
      canSupplierReportAwaitingLearnerRequest,
    canReportNoDriverAvailable,
    canMarkDeliveryPickupExpired: canSupplierMarkDeliveryPickupExpired,
    canReportDriverNoShow: canSupplierReportDriverNoShow,
    canSubmitRecoveryPickupWindow: canSubmitNoDriverPickupWindow,
  });
  const driver =
    latestDelivery?.assignedDriverProfile ??
    reservation.deliveryGroup?.assignedDriverProfile ??
    null;
  const deliverySummary = latestDelivery
    ? {
        deliveryId: latestDelivery.id,
        status: latestDelivery.status,
        driver: driver
          ? {
              id: driver.id,
              displayName: driver.displayName,
              userId: driver.user.id,
              profileImageUrl: driver.user.profileImageUrl,
            }
          : null,
        requestedAt: latestDelivery.requestedAt.toISOString(),
        assignedAt: latestDelivery.assignedAt?.toISOString() ?? null,
        pickedUpAt: latestDelivery.pickedUpAt?.toISOString() ?? null,
        deliveredAt: latestDelivery.deliveredAt?.toISOString() ?? null,
        failedAt: latestDelivery.failedAt?.toISOString() ?? null,
        failureReason: latestDelivery.failureReason,
        recoveryRequired:
          reservation.status === 'AWAITING_RESOLUTION' ||
          latestDelivery.status === 'AWAITING_RESOLUTION',
      }
    : null;
  const groupSummary = reservation.deliveryGroup
    ? {
        groupId: reservation.deliveryGroup.id,
        status: reservation.deliveryGroup.status,
        itemCount: groupItemCount,
        grouped: groupItemCount > 1,
    }
    : null;
  const primaryIncident = reservation.noShowReports.find(
    (report) => report.status === 'PENDING_REVIEW',
  ) ?? reservation.noShowReports[0] ?? null;
  const incidentContract = primaryIncident
    ? classifyAdminReportContract({
        report: {
          status: primaryIncident.status,
          reasonCode: primaryIncident.reasonCode,
          targetRole: primaryIncident.targetRole,
          targetUserId: primaryIncident.targetUserId,
          deliveryId: latestDelivery?.id ?? null,
        },
        reservation: {
          status: reservation.status,
          fulfillmentMethod: reservation.fulfillmentMethod,
          pendingRescheduleRequestedBy: reservation.pendingRescheduleRequestedBy,
          pendingRescheduleReason: reservation.pendingRescheduleReason,
        },
        delivery: latestDelivery
          ? {
              id: latestDelivery.id,
              status: latestDelivery.status,
              assignedDriverProfileId: latestDelivery.assignedDriverProfileId,
              deliveryGroupId: reservation.deliveryGroup?.id ?? null,
            }
          : null,
        isGroupedDelivery: groupItemCount > 1,
        isGroupRecoverySupported: false,
      })
    : null;
  const incidentSummary = primaryIncident && incidentContract
    ? {
        id: primaryIncident.id,
        targetUserId: primaryIncident.targetUserId,
        targetRole: primaryIncident.targetRole,
        status: primaryIncident.status,
        reasonCode: primaryIncident.reasonCode,
        note: primaryIncident.note,
        createdAt: primaryIncident.createdAt.toISOString(),
        reviewedAt: primaryIncident.reviewedAt?.toISOString() ?? null,
        reviewNote: primaryIncident.reviewNote,
        workflowType: incidentContract.workflowType,
        operationalState: incidentContract.operationalState,
        strikeImpact: incidentContract.strikeImpact,
      }
    : null;
  const pendingReschedule = mapPendingRescheduleSummary(reservation);
  const recoveryContext =
    reservation.status === 'AWAITING_SUPPLIER_CONFIRMATION' &&
    reservation.fulfillmentMethod === 'DELIVERY' &&
    isAdminSupplierPickupReconfirmReason(reservation.pendingRescheduleReason) &&
    latestDelivery?.status === 'AWAITING_RESOLUTION'
      ? {
          initiatedBy: 'ADMIN' as const,
          reason: reservation.pendingRescheduleReason,
          note: reservation.pendingRescheduleNote,
        }
      : null;
  const latestSenderRole = latestMessage
    ? latestMessage.sender.id === reservation.requester.id
      ? 'LEARNER'
      : latestMessage.sender.id === reservation.ownerId
        ? 'SUPPLIER'
        : 'SYSTEM'
    : null;

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
    fulfillmentMethod: reservation.fulfillmentMethod,
    fulfillmentLabel: mapFulfillmentLabel(
      reservation.fulfillmentMethod,
      deliveryCount,
    ),
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
    pendingReschedule,
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
    activeDelivery: latestDelivery
      ? {
          id: latestDelivery.id,
          status: latestDelivery.status,
        }
      : null,
    deliveryGroupId: reservation.deliveryGroup?.id ?? null,
    groupedDelivery: groupItemCount > 1,
    groupItemCount: groupItemCount > 0 ? groupItemCount : null,
    combinedDeliveryLabel:
      groupItemCount > 0 ? 'Combined delivery' : null,
    supplierHandoverCode:
      reservation.status === 'ACCEPTED' &&
      reservation.fulfillmentMethod === 'DELIVERY' &&
      latestDelivery != null
        ? deriveHandoverCode('supplier-handover', latestDelivery.id)
        : null,
    canSupplierComplete,
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
    canSupplierCloseOverduePickup,
    canSupplierReportAndCloseOverduePickup,
    canSupplierReschedule: canReschedule,
    canSupplierAcceptLearnerReschedule,
    canSupplierProposeDifferentTime,
    canSupplierCloseAwaitingLearnerRequest,
    canSupplierReportAwaitingLearnerRequest,
    canReportNoDriverAvailable,
    canSubmitNoDriverPickupWindow,
    canSupplierMarkDeliveryPickupExpired,
    canSupplierReportDriverNoShow,
    canMarkLearnerNoShow,
    assignedDriverPickupOverdue: isAssignedDriverPickupOverdue({
      supplierPickupWindowEnd: reservation.supplierPickupWindowEnd,
      pickupWindowEnd: reservation.pickupWindowEnd,
      deliveryStatus: latestDelivery?.status ?? null,
    }),
    canSendMessage,
    noShowReport: mapNoShowReportSummary(reservation.noShowReports),
    latestMessage: latestMessage ?? null,
    workflowPhase: contract.workflowPhase,
    attentionState: contract.attentionState,
    nextActor: contract.nextActor,
    summaryBucket: contract.summaryBucket,
    availableActions: contract.availableActions,
    fulfillmentSummary: {
      fulfillmentMethod: reservation.fulfillmentMethod,
      pickupAllowed: reservation.material.pickupAllowed,
      deliverySelected: reservation.fulfillmentMethod === 'DELIVERY' || hasDelivery,
      label: mapFulfillmentLabel(reservation.fulfillmentMethod, deliveryCount),
    },
    scheduleSummary: {
      activeWindowType:
        reservation.fulfillmentMethod === 'DELIVERY'
          ? 'SUPPLIER_DELIVERY_PICKUP'
          : reservation.pickupWindowStart
            ? 'CONFIRMED_PICKUP'
            : null,
      effectiveWindowStart:
        (reservation.fulfillmentMethod === 'DELIVERY'
          ? reservation.supplierPickupWindowStart
          : reservation.pickupWindowStart)?.toISOString() ?? null,
      effectiveWindowEnd:
        (reservation.fulfillmentMethod === 'DELIVERY'
          ? reservation.supplierPickupWindowEnd
          : reservation.pickupWindowEnd)?.toISOString() ?? null,
      pendingProposalSource: pendingReschedule?.requestedBy ?? null,
      pendingReschedule,
      recoveryContext,
      schedulingConflictReason: reservation.schedulingConflictReason,
      earliestDeliveryStart: reservation.earliestDeliveryStart?.toISOString() ?? null,
    },
    deliverySummary,
    incidentSummary,
    groupSummary,
    messageSummary: {
      latestMessage: latestMessage ?? null,
      latestSenderRole,
      latestTimestamp: latestMessage?.createdAt ?? null,
      messageCount: reservation._count.messages,
      matchesOriginalLearnerNote:
        latestMessage?.sender.id === reservation.requester.id &&
        latestMessage.body.trim() === (reservation.message?.trim() ?? ''),
    },
  };
};

const resolveSupplierReservationStatuses = (status?: string) => {
  if (!status) return null;
  const legacy = tabToReservationStatuses(status);
  if (legacy) return legacy;
  return [status as ReservationStatus];
};

export const runSupplierReservationLazyCleanup = async (ownerId: string) => {
  await expireStalePendingReservationsForOwner(ownerId);
  await expireStaleMissedPickupsForOwner(ownerId);
  await escalateStaleNoDriverDeliveriesForOwner(ownerId);
  await escalateStaleAssignedDriverPickupsForOwner(ownerId);
};

/** Legacy service shape retained for existing callers and mutation suites. */
export const listSupplierReservations = async (
  ownerId: string,
  query: Partial<ListSupplierReservationsQuery>,
) => {
  await runSupplierReservationLazyCleanup(ownerId);

  const statuses = resolveSupplierReservationStatuses(query.status);

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

const emptySummary = () => ({
  total: 0,
  needsSupplierResponse: 0,
  waitingForLearner: 0,
  fulfillmentInProgress: 0,
  adminReview: 0,
  completed: 0,
  closed: 0,
});

const incrementSummary = (
  summary: ReturnType<typeof emptySummary>,
  bucket: SupplierReservationSummaryBucket,
) => {
  summary.total += 1;
  const summaryKey: Record<SupplierReservationSummaryBucket, keyof typeof summary> = {
    NEEDS_SUPPLIER_RESPONSE: 'needsSupplierResponse',
    WAITING_FOR_LEARNER: 'waitingForLearner',
    FULFILLMENT_IN_PROGRESS: 'fulfillmentInProgress',
    ADMIN_REVIEW: 'adminReview',
    COMPLETED: 'completed',
    CLOSED: 'closed',
  };
  summary[summaryKey[bucket]] += 1;
};

export const listSupplierReservationsPage = async (
  ownerId: string,
  query: ListSupplierReservationsQuery,
) => {
  await runSupplierReservationLazyCleanup(ownerId);

  const page = query.page;
  const limit = query.limit;
  const offset = (page - 1) * limit;
  const pageRecords: supplierReservationsRepository.SupplierReservationListRecord[] = [];
  const summary = emptySummary();
  let filteredIndex = 0;

  await supplierReservationsRepository.forEachSupplierReservationBatch({
    ownerId,
    filter: {
      statuses: resolveSupplierReservationStatuses(query.status) ?? undefined,
      fulfillmentMethod: query.fulfillmentMethod,
      historyScope: query.historyScope,
      materialId: query.materialId,
      search: query.search,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
    },
    batchSize: 100,
    onBatch: (records) => {
      for (const reservation of records) {
        const mapped = mapSupplierReservation(reservation, null);
        if (
          query.attentionState &&
          mapped.attentionState !== query.attentionState
        ) {
          continue;
        }

        incrementSummary(summary, mapped.summaryBucket);
        if (filteredIndex >= offset && pageRecords.length < limit) {
          pageRecords.push(reservation);
        }
        filteredIndex += 1;
      }
    },
  });

  const latestMessages = await findLatestReservationMessagesByReservationIds(
    pageRecords.map((reservation) => reservation.id),
  );
  const items = pageRecords.map((reservation) =>
    mapSupplierReservation(
      reservation,
      latestMessages.has(reservation.id)
        ? mapReservationMessage(latestMessages.get(reservation.id)!)
        : null,
    ),
  );

  return {
    items,
    pagination: {
      page,
      limit,
      total: summary.total,
      totalPages: Math.ceil(summary.total / limit),
    },
    summary,
  };
};

export const getSupplierReservationDetail = async (
  ownerId: string,
  reservationId: string,
) => {
  await runSupplierReservationLazyCleanup(ownerId);
  const reservation =
    await supplierReservationsRepository.findSupplierReservationDetailForOwner(
      ownerId,
      reservationId,
    );

  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  const latest = reservation.messages[0]
    ? mapReservationMessage(reservation.messages[0])
    : null;
  const common = mapSupplierReservation(reservation, latest);

  return {
    ...common,
    identity: {
      reservationId: reservation.id,
      material: common.material,
      learner: common.learner,
      quantityRequested: common.quantityRequested,
      createdAt: common.createdAt,
      updatedAt: reservation.updatedAt.toISOString(),
    },
    canonicalState: {
      workflowPhase: common.workflowPhase,
      attentionState: common.attentionState,
      nextActor: common.nextActor,
      summaryBucket: common.summaryBucket,
      availableActions: common.availableActions,
    },
    request: {
      originalLearnerNote: reservation.message,
      fulfillmentMethod: reservation.fulfillmentMethod,
      learnerPreferredPickupWindows: common.learnerPreferredPickupWindows,
      learnerPreferredDeliveryWindows: common.learnerPreferredDeliveryWindows,
      deliveryAddressText: reservation.deliveryAddressText,
      safeDropoffAllowed: reservation.safeDropoffAllowed,
      deliveryNote: reservation.deliveryNote,
    },
    schedule: {
      ...common.scheduleSummary,
      supplierProposal: {
        start: common.supplierProposedPickupWindowStart,
        end: common.supplierProposedPickupWindowEnd,
      },
      learnerProposal: {
        start: common.learnerProposedPickupWindowStart,
        end: common.learnerProposedPickupWindowEnd,
      },
      confirmedPickupWindow: {
        start: common.pickupWindowStart,
        end: common.pickupWindowEnd,
      },
      supplierDeliveryPickupWindow: {
        start: common.supplierPickupWindowStart,
        end: common.supplierPickupWindowEnd,
      },
      confirmedDeliveryWindow: {
        start: common.confirmedDeliveryWindowStart,
        end: common.confirmedDeliveryWindowEnd,
      },
    },
    messages: {
      latest: latest,
      count: reservation._count.messages,
      items: reservation.messages.map(mapReservationMessage),
      truncated: reservation._count.messages > reservation.messages.length,
    },
    delivery: common.deliverySummary,
    group: common.groupSummary,
    incident: common.incidentSummary,
    history: reservation.statusHistory.map((entry) => ({
      id: entry.id,
      statusGroup: entry.statusGroup,
      oldStatus: entry.oldStatus,
      newStatus: entry.newStatus,
      note: entry.note,
      createdAt: entry.createdAt.toISOString(),
      actor: entry.changedByUser
        ? {
            id: entry.changedByUser.id,
            displayName: entry.changedByUser.displayName,
          }
        : null,
    })),
  };
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
  await expireStaleMissedPickupsByIds([reservationId], ownerId);

  existing =
    await supplierReservationsRepository.findSupplierReservationForOwner(
      ownerId,
      reservationId,
    );

  if (!existing) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  assertPendingReservationForAccept(existing.status);

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

  assertValidPickupWindow(
    { start: pickupWindowStart, end: pickupWindowEnd },
    isSelectedLearnerPickupWindow
      ? 'supplier_selected_preferred'
      : 'supplier_custom_proposal',
    now,
  );

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
    assertPendingReservationForAccept(result.reservation.status);
    throw new AppError(
      'Only pending reservations can be accepted.',
      409,
      'RESERVATION_NOT_PENDING',
    );
  }

  void notifyReservationAccepted(result.reservation.id);
  await notifyNewJobForReservationWaitingDelivery(result.reservation.id);

  return mapSupplierReservation(result.reservation);
};

export const declineSupplierReservation = async (
  ownerId: string,
  reservationId: string,
  input: DeclineSupplierReservationInput,
) => {
  const existing =
    await supplierReservationsRepository.findSupplierReservationForOwner(
      ownerId,
      reservationId,
    );

  if (!existing) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  await expireStalePendingReservationsByIds([reservationId], ownerId);
  await expireStaleMissedPickupsByIds([reservationId], ownerId);

  const refreshed =
    await supplierReservationsRepository.findSupplierReservationForOwner(
      ownerId,
      reservationId,
    );

  if (!refreshed) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  assertPendingReservationForDecline(refreshed.status);

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
    assertPendingReservationForDecline(result.reservation.status);
    throw new AppError(
      'Only pending reservations can be declined.',
      409,
      'RESERVATION_NOT_PENDING',
    );
  }

  invalidateLearnerHomeForReservationTransition('PENDING', 'REJECTED');
  void notifyReservationDeclined(result.reservation.id);

  return mapSupplierReservation(result.reservation);
};

export const completeSupplierReservation = async (
  ownerId: string,
  reservationId: string,
  input: CompleteSupplierReservationInput = { confirmationCode: '' },
) => {
  await expireStaleMissedPickupsByIds([reservationId], ownerId);

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

  invalidateLearnerHomeForReservationTransition('ACCEPTED', 'COMPLETED');
  const { fulfillRequestFromCompletedReservation } = await import(
    '../learner-material-requests/learner-material-requests.service.js'
  );
  const { createNotificationIfMissing } = await import(
    '../notifications/notifications.repository.js'
  );
  const fulfilled = await fulfillRequestFromCompletedReservation(
    result.reservation.id,
  );
  if (fulfilled) {
    await createNotificationIfMissing({
      userId: fulfilled.learnerId,
      notificationType: 'MATERIAL_REQUEST_FULFILLED',
      title: 'Material request fulfilled',
      body: `Your request “${fulfilled.requestedItemName}” was marked fulfilled after a completed reservation.`,
      relatedEntityType: 'MATERIAL_REQUEST',
      relatedEntityId: fulfilled.id,
      eventKey: `mr:fulfilled:${fulfilled.id}`,
      entityType: 'MATERIAL_REQUEST',
      entityId: fulfilled.id,
      actionType: 'OPEN_ENTITY',
    });
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

  assertValidPickupWindow(
    { start, end },
    'supplier_custom_proposal',
  );

  await expireStaleMissedPickupsByIds([reservationId], ownerId);

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
    const failure = validatePickupWindow(
      {
        start: result.reservation.learnerProposedPickupWindowStart!,
        end: result.reservation.learnerProposedPickupWindowEnd!,
      },
      'supplier_selected_preferred',
    );

    throw new AppError(
      failure?.message ?? PICKUP_WINDOW_TOO_CLOSE_MESSAGE,
      400,
      failure?.code ?? 'PICKUP_WINDOW_TOO_CLOSE_TO_ENDING',
    );
  }

  return mapSupplierReservation(result.reservation);
};

export const cancelSupplierAcceptedReservation = async (
  ownerId: string,
  reservationId: string,
  input: CancelSupplierReservationInput,
) => {
  await expireStaleMissedPickupsByIds([reservationId], ownerId);

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

  invalidateLearnerHomeForReservationTransition('ACCEPTED', 'CANCELLED');
  return mapSupplierReservation(result.reservation);
};

export const submitSupplierNoShowReport = async (
  ownerId: string,
  reservationId: string,
  input: SubmitNoShowReportInput,
) => {
  await expireStaleMissedPickupsByIds([reservationId], ownerId);

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

  invalidateLearnerHomeForReservationTransition('ACCEPTED', 'NO_SHOW');
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
      invalidateLearnerHomeForReservationTransition(
        'ACCEPTED',
        'AWAITING_RESOLUTION',
      );
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

export const submitNoDriverPickupWindow = async (
  ownerId: string,
  reservationId: string,
  input: SubmitNoDriverPickupWindowInput,
) => {
  const result = await submitNoDriverPickupWindowForSupplier({
    reservationId,
    ownerId,
    supplierPickupWindowStart: new Date(input.pickupWindowStart),
    supplierPickupWindowEnd: new Date(input.pickupWindowEnd),
    supplierNote: input.supplierNote,
  });

  if (result.outcome === 'NOT_FOUND') {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  if (result.outcome === 'NOT_DELIVERY') {
    throw new AppError(
      'This action is only available for delivery reservations.',
      409,
      'NOT_ELIGIBLE',
    );
  }

  if (result.outcome === 'NOT_ELIGIBLE') {
    throw new AppError(
      'Supplier pickup reconfirmation is not requested for this reservation.',
      409,
      'NOT_ELIGIBLE',
    );
  }

  if (
    result.outcome === 'INVALID_RESERVATION_STATUS' ||
    result.outcome === 'INVALID_DELIVERY_STATUS'
  ) {
    throw new AppError(
      'Reservation or delivery is not in the expected state.',
      409,
      'INVALID_STATE',
    );
  }

  await notifyNewJobForReservationWaitingDelivery(reservationId);

  return mapSupplierReservation(result.reservation);
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
