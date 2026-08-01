import type { Prisma } from '../../generated/prisma/client.js';
import {
  ADMIN_SUPPLIER_PICKUP_RECONFIRM_REASONS,
  NO_DRIVER_CANCEL_REASON,
  NO_DRIVER_SUPPLIER_RECONFIRM_REASON,
  STALE_PICKUP_CANCEL_REASON,
  STALE_PICKUP_SUPPLIER_RECONFIRM_REASON,
  isPartialPickupSupplierReconfirmReason,
} from '../reservations/reservation-timing-policy.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
} from '../reservations/reservations.quantity.js';
import { findNoShowReportByIdForAdmin } from './admin-no-show-reports.repository.js';
import {
  classifyAdminReportContract,
  type AdminReportAction,
} from './admin-no-show-reports.classifier.js';
import {
  groupedDeliveryStateConflict,
  loadAndAssertGroupedDeliveryState,
} from '../delivery-groups/grouped-delivery-state.js';

export type PickupRecoveryKind =
  | 'NO_DRIVER'
  | 'STALE_PICKUP'
  | 'PARTIAL_PICKUP';

const pickupRecoveryReportSelect = {
  id: true,
  reasonCode: true,
  targetRole: true,
  targetUserId: true,
  deliveryId: true,
  status: true,
  reservationId: true,
} satisfies Prisma.NoShowReportSelect;

const pickupRecoveryReservationSelect = {
  id: true,
  status: true,
  fulfillmentMethod: true,
  pendingRescheduleRequestedBy: true,
  pendingRescheduleReason: true,
  materialId: true,
  ownerId: true,
  deliveryGroupId: true,
} satisfies Prisma.ReservationSelect;

const pickupRecoveryDeliverySelect = {
  id: true,
  status: true,
  assignedDriverProfileId: true,
  deliveryGroupId: true,
  reservationId: true,
} satisfies Prisma.DeliverySelect;

const reportMutationSelect = {
  id: true,
} satisfies Prisma.NoShowReportSelect;

type PickupRecoveryContext = {
  report: Prisma.NoShowReportGetPayload<{
    select: typeof pickupRecoveryReportSelect;
  }>;
  reservation: Prisma.ReservationGetPayload<{
    select: typeof pickupRecoveryReservationSelect;
  }>;
  delivery: Prisma.DeliveryGetPayload<{
    select: typeof pickupRecoveryDeliverySelect;
  }> | null;
};

export const isNoDriverAvailableSystemReport = (report: {
  reasonCode: string;
  targetRole: string;
}) =>
  report.targetRole === 'SYSTEM' && report.reasonCode === 'NO_DRIVER_AVAILABLE';

export const isStaleAssignedPickupReport = (report: { reasonCode: string }) =>
  report.reasonCode === 'NO_RESPONSE_AFTER_PICKUP_WINDOW' ||
  report.reasonCode === 'DRIVER_DID_NOT_ARRIVE' ||
  report.reasonCode === 'PICKUP_FAILED';

export const isDeliveryPickupRecoveryReport = (report: {
  reasonCode: string;
  targetRole: string;
}) =>
  isNoDriverAvailableSystemReport(report) || isStaleAssignedPickupReport(report);

export const pickupRecoveryKind = (report: {
  reasonCode: string;
  targetRole: string;
}): PickupRecoveryKind =>
  isNoDriverAvailableSystemReport(report) ? 'NO_DRIVER' : 'STALE_PICKUP';

const reconfirmReasonForKind = (kind: PickupRecoveryKind) =>
  kind === 'NO_DRIVER'
    ? NO_DRIVER_SUPPLIER_RECONFIRM_REASON
    : STALE_PICKUP_SUPPLIER_RECONFIRM_REASON;

const cancelReasonForKind = (kind: PickupRecoveryKind) =>
  kind === 'NO_DRIVER' ? NO_DRIVER_CANCEL_REASON : STALE_PICKUP_CANCEL_REASON;

const isDetachedPartialPickupRecovery = (context: PickupRecoveryContext) =>
  context.reservation.deliveryGroupId == null &&
  context.reservation.status === 'AWAITING_RESOLUTION' &&
  isPartialPickupSupplierReconfirmReason(
    context.reservation.pendingRescheduleReason,
  ) &&
  context.report.reasonCode === 'PICKUP_FAILED';

const loadPickupRecoveryContext = async (
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<PickupRecoveryContext | null> => {
  const report = await tx.noShowReport.findUnique({
    where: { id: reportId },
    select: pickupRecoveryReportSelect,
  });

  if (!report) {
    return null;
  }

  const reservation = await tx.reservation.findUnique({
    where: { id: report.reservationId },
    select: pickupRecoveryReservationSelect,
  });

  if (!reservation) {
    return null;
  }

  const delivery = report.deliveryId
    ? await tx.delivery.findUnique({
        where: { id: report.deliveryId },
        select: pickupRecoveryDeliverySelect,
      })
    : null;

  return { report, reservation, delivery };
};

const validatePickupRecoveryContext = (
  context: PickupRecoveryContext | null,
  action: AdminReportAction,
) => {
  if (!context) {
    return { outcome: 'NOT_FOUND' as const };
  }

  const { report, reservation, delivery } = context;

  const contract = classifyAdminReportContract({
    report,
    reservation,
    delivery,
    isGroupedDelivery: delivery?.deliveryGroupId != null,
    isGroupRecoverySupported: true,
  });

  if (!contract.availableActions.includes(action)) {
    return { outcome: 'ACTION_NOT_AVAILABLE' as const };
  }

  if (!delivery) {
    return { outcome: 'ACTION_NOT_AVAILABLE' as const };
  }

  return { outcome: 'OK' as const, report, reservation, delivery, contract };
};

const completeOperationalRecoveryReport = async (
  tx: Prisma.TransactionClient,
  input: {
    reportId: string;
    adminUserId: string;
    reviewNote?: string;
    reportStatus: string;
    workflowType: string;
  },
) => {
  if (
    input.workflowType !== 'SYSTEM_RECOVERY' ||
    input.reportStatus !== 'PENDING_REVIEW'
  ) {
    return { id: input.reportId };
  }

  return tx.noShowReport.update({
    where: { id: input.reportId },
    data: {
      status: 'RESOLVED_NO_STRIKE',
      reviewedById: input.adminUserId,
      reviewedAt: new Date(),
      reviewNote: input.reviewNote?.trim() || null,
    },
    select: reportMutationSelect,
  });
};

export const requestSupplierRescheduleForPickupRecoveryReport = async (input: {
  reportId: string;
  adminUserId: string;
  adminNote?: string;
}) => {
  const outcome = await runSerializableTransaction(async (tx) => {
    const loaded = await loadPickupRecoveryContext(tx, input.reportId);
    const validation = validatePickupRecoveryContext(
      loaded,
      'REQUEST_SUPPLIER_RESCHEDULE',
    );

    if (validation.outcome !== 'OK') {
      return validation;
    }

    const { report, reservation, delivery } = validation;
    const partialRecovery = isDetachedPartialPickupRecovery(validation);
    const kind = partialRecovery
      ? ('PARTIAL_PICKUP' as const)
      : pickupRecoveryKind(report);
    const defaultNote =
      kind === 'NO_DRIVER'
        ? 'Admin asked supplier to choose a new pickup window after no driver was available'
        : 'Admin asked supplier to choose a new pickup window after pickup was not completed';

    const groupedState =
      !partialRecovery && delivery.deliveryGroupId
        ? await loadAndAssertGroupedDeliveryState(tx, {
            deliveryId: delivery.id,
            expectedDeliveryStatuses: [delivery.status],
            expectedGroupStatus: 'CANCELLED',
            expectedReservationStatus: 'AWAITING_RESOLUTION',
            expectedDriverProfileId: null,
            expectedActiveAssignments: 0,
            expectedSupplierUserId: reservation.ownerId,
          })
        : undefined;

    if (!partialRecovery) {
      const deliveryChanged = await tx.delivery.updateMany({
        where: {
          id: delivery.id,
          status: delivery.status,
          assignedDriverProfileId: null,
          deliveryGroupId: delivery.deliveryGroupId,
          reservationId: delivery.reservationId,
        },
        data: { assignedAt: null },
      });
      if (deliveryChanged.count !== 1) {
        groupedDeliveryStateConflict();
      }
    }

    const recoveryReservations =
      !partialRecovery && delivery.deliveryGroupId
      ? groupedState?.reservations ?? groupedDeliveryStateConflict()
      : [
          await tx.reservation.findUniqueOrThrow({
            where: { id: report.reservationId },
          }),
        ];

    for (const affected of recoveryReservations) {
      const reservationChanged = await tx.reservation.updateMany({
        where: {
          id: affected.id,
          status: 'AWAITING_RESOLUTION',
          fulfillmentMethod: 'DELIVERY',
          deliveryGroupId: partialRecovery ? null : delivery.deliveryGroupId,
          ownerId: reservation.ownerId,
        },
        data: {
          status: 'AWAITING_SUPPLIER_CONFIRMATION',
          pendingRescheduleRequestedBy: 'SUPPLIER',
          pendingRescheduleReason: partialRecovery
            ? reservation.pendingRescheduleReason
            : reconfirmReasonForKind(kind),
          pendingRescheduleNote: input.adminNote?.trim() || defaultNote,
          supplierProposedPickupWindowStart: null,
          supplierProposedPickupWindowEnd: null,
          learnerProposedPickupWindowStart: null,
          learnerProposedPickupWindowEnd: null,
        },
      });
      if (reservationChanged.count !== 1) {
        groupedDeliveryStateConflict();
      }

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: affected.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'AWAITING_RESOLUTION',
          newStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
          changedBy: input.adminUserId,
          note: input.adminNote?.trim() || defaultNote,
        },
      });
    }

    const reportId =
      report.status === 'PENDING_REVIEW'
        ? (
            await completeOperationalRecoveryReport(tx, {
              reportId: report.id,
              adminUserId: input.adminUserId,
              reviewNote: input.adminNote,
              reportStatus: report.status,
              workflowType: validation.contract.workflowType,
            })
          ).id
        : report.id;

    return {
      outcome: 'REQUESTED' as const,
      reportId,
      supplierId: reservation.ownerId,
      reservationId: report.reservationId,
      recoveryKind: kind,
    };
  });

  if (outcome.outcome !== 'REQUESTED') {
    return outcome;
  }

  const report = await findNoShowReportByIdForAdmin(outcome.reportId);

  if (!report) {
    return { outcome: 'NOT_FOUND' as const };
  }

  return {
    outcome: 'REQUESTED' as const,
    report,
    supplierId: outcome.supplierId,
    reservationId: outcome.reservationId,
    recoveryKind: outcome.recoveryKind,
  };
};

export const cancelAndReleaseHoldForPickupRecoveryReport = async (input: {
  reportId: string;
  adminUserId: string;
  adminNote?: string;
}) => {
  const outcome = await runSerializableTransaction(async (tx) => {
    const loaded = await loadPickupRecoveryContext(tx, input.reportId);
    const validation = validatePickupRecoveryContext(
      loaded,
      'CANCEL_AND_RELEASE_HOLD',
    );

    if (validation.outcome !== 'OK') {
      return validation;
    }

    const { report, reservation, delivery } = validation;
    const partialRecovery = isDetachedPartialPickupRecovery(validation);
    const kind = partialRecovery
      ? ('PARTIAL_PICKUP' as const)
      : pickupRecoveryKind(report);
    const now = new Date();
    const defaultNote =
      kind === 'NO_DRIVER'
        ? 'Admin cancelled and released hold after no driver available'
        : 'Admin cancelled and released hold after pickup was not completed';

    const groupedState =
      !partialRecovery && delivery.deliveryGroupId
        ? await loadAndAssertGroupedDeliveryState(tx, {
            deliveryId: delivery.id,
            expectedDeliveryStatuses: [delivery.status],
            expectedGroupStatus: 'CANCELLED',
            expectedReservationStatus: 'AWAITING_RESOLUTION',
            expectedDriverProfileId: null,
            expectedActiveAssignments: 0,
            expectedSupplierUserId: reservation.ownerId,
          })
        : undefined;

    const recoveryReservations =
      !partialRecovery && delivery.deliveryGroupId
      ? groupedState?.reservations ?? groupedDeliveryStateConflict()
      : [
          await tx.reservation.findUniqueOrThrow({
            where: { id: report.reservationId },
          }),
        ];

    for (const affected of recoveryReservations) {
      const reservationChanged = await tx.reservation.updateMany({
        where: {
          id: affected.id,
          status: 'AWAITING_RESOLUTION',
          fulfillmentMethod: 'DELIVERY',
          deliveryGroupId: partialRecovery ? null : delivery.deliveryGroupId,
          ownerId: reservation.ownerId,
        },
        data: {
          status: 'EXPIRED',
          rejectionReason: cancelReasonForKind(kind),
        },
      });
      if (reservationChanged.count !== 1) {
        groupedDeliveryStateConflict();
      }

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: affected.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'AWAITING_RESOLUTION',
          newStatus: 'EXPIRED',
          changedBy: input.adminUserId,
          note: input.adminNote?.trim() || defaultNote,
        },
      });
      await recomputeAndUpdateMaterialStatus(tx, affected.materialId);
    }

    if (!partialRecovery) {
      const deliveryChanged = await tx.delivery.updateMany({
        where: {
          id: delivery.id,
          status: delivery.status,
          assignedDriverProfileId: null,
          deliveryGroupId: delivery.deliveryGroupId,
          reservationId: delivery.reservationId,
        },
        data: { status: 'CANCELLED', cancelledAt: now, assignedAt: null },
      });
      if (deliveryChanged.count !== 1) {
        groupedDeliveryStateConflict();
      }

      await tx.deliveryStatusHistory.create({
        data: {
          deliveryId: delivery.id,
          oldStatus: delivery.status,
          newStatus: 'CANCELLED',
          changedByUserId: input.adminUserId,
          note:
            input.adminNote?.trim() ||
            'Admin cancelled delivery after pickup recovery review',
        },
      });

      if (delivery.deliveryGroupId) {
        const groupChanged = await tx.deliveryGroup.updateMany({
          where: {
            id: delivery.deliveryGroupId,
            status: 'CANCELLED',
            assignedDriverProfileId: null,
          },
          data: { status: 'CANCELLED', assignedDriverProfileId: null },
        });
        if (groupChanged.count !== 1) {
          groupedDeliveryStateConflict();
        }
      }
    }

    const reportId =
      report.status === 'PENDING_REVIEW'
        ? (
            await completeOperationalRecoveryReport(tx, {
              reportId: report.id,
              adminUserId: input.adminUserId,
              reviewNote: input.adminNote,
              reportStatus: report.status,
              workflowType: validation.contract.workflowType,
            })
          ).id
        : report.id;

    return {
      outcome: 'CANCELLED' as const,
      reportId,
      recoveryKind: kind,
    };
  });

  if (outcome.outcome !== 'CANCELLED') {
    return outcome;
  }

  const report = await findNoShowReportByIdForAdmin(outcome.reportId);

  if (!report) {
    return { outcome: 'NOT_FOUND' as const };
  }

  return {
    outcome: 'CANCELLED' as const,
    report,
    recoveryKind: outcome.recoveryKind,
  };
};

export const requiresPickupRecoveryOperationalAction = (input: {
  report: {
    reasonCode: string;
    targetRole: string;
    status: string;
  };
  reservationStatus: string;
}) => {
  if (!isDeliveryPickupRecoveryReport(input.report)) {
    return false;
  }

  if (input.reservationStatus !== 'AWAITING_RESOLUTION') {
    return false;
  }

  return input.report.status === 'PENDING_REVIEW';
};

export { ADMIN_SUPPLIER_PICKUP_RECONFIRM_REASONS };
