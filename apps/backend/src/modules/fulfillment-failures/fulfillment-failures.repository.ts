import {
  Prisma,
  type DeliveryStatus,
  type ReservationStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  isAfterWindowWithGrace,
  HANDOVER_GRACE_MINUTES,
} from '../../utils/handover-timing.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
} from '../reservations/reservations.quantity.js';
import { applyBuildReservationSyncInTransaction } from '../learning-projects/learning-projects.build-reservation-sync.js';
import {
  flushPostCommitPaymentRefunds,
  handleReservationPaymentLifecycleTransition,
} from '../payments/payments.lifecycle.js';
import { formatReservationHistoryNote } from '../reservations/reservation-status-history.js';
import {
  groupedDeliveryStateConflict,
  loadAndAssertGroupedDeliveryState,
} from '../delivery-groups/grouped-delivery-state.js';
import { reconcileDriverAvailability } from '../driver/driver-availability.js';
import { createNoShowReportOnce } from '../no-show-reports/no-show-report.create.js';

export { isTerminalDeliveryStatus } from '../deliveries/delivery-status.policy.js';

const prePickupDeliveryStatuses = [
  'WAITING_FOR_DRIVER',
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
] as const satisfies readonly DeliveryStatus[];

const postPickupDeliveryStatuses = [
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
] as const satisfies readonly DeliveryStatus[];

export const releaseDriverFromDelivery = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryId: string;
    driverProfileId: string;
    releaseReason: string;
    expectedActiveCount?: number;
  },
) => {
  const released = await tx.deliveryAssignment.updateMany({
    where: {
      deliveryId: input.deliveryId,
      driverProfileId: input.driverProfileId,
      status: 'ACTIVE',
    },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
      releaseReason: input.releaseReason,
    },
  });

  if (
    input.expectedActiveCount != null &&
    released.count !== input.expectedActiveCount
  ) {
    groupedDeliveryStateConflict();
  }

  await reconcileDriverAvailability(tx, input.driverProfileId, {
    excludeDeliveryId: input.deliveryId,
  });
};

const transitionFailureReservations = async (
  tx: Prisma.TransactionClient,
  input: {
    delivery: {
      reservationId: string;
      deliveryGroupId: string | null;
      reservation: { status: ReservationStatus };
    };
    changedByUserId: string;
    note: string;
    groupedState?: Awaited<
      ReturnType<typeof loadAndAssertGroupedDeliveryState>
    >;
  },
) => {
  const reservations = input.delivery.deliveryGroupId
    ? input.groupedState?.reservations ?? groupedDeliveryStateConflict()
    : [
        await tx.reservation.findUniqueOrThrow({
          where: { id: input.delivery.reservationId },
        }),
      ];

  for (const reservation of reservations) {
    const changed = await tx.reservation.updateMany({
      where: {
        id: reservation.id,
        deliveryGroupId: input.delivery.deliveryGroupId,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        ownerId: input.groupedState?.supplierUserId,
      },
      data: { status: 'AWAITING_RESOLUTION' },
    });
    if (changed.count !== 1) {
      groupedDeliveryStateConflict();
    }
    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: reservation.status,
        newStatus: 'AWAITING_RESOLUTION',
        changedBy: input.changedByUserId,
        note: formatReservationHistoryNote('FULFILLMENT_ISSUE_REPORTED', {
          reasonText: input.note,
        }),
      },
    });
    await applyBuildReservationSyncInTransaction(tx, reservation.id);
  }

  if (input.delivery.deliveryGroupId) {
    const cancelled = await tx.deliveryGroup.updateMany({
      where: {
        id: input.delivery.deliveryGroupId,
        status: 'ASSIGNED',
        assignedDriverProfileId:
          input.groupedState?.delivery.assignedDriverProfileId,
      },
      data: {
        status: 'CANCELLED',
        assignedDriverProfileId: null,
      },
    });
    if (cancelled.count !== 1) {
      groupedDeliveryStateConflict();
    }
  }

  return (
    reservations.find(
      (reservation) => reservation.id === input.delivery.reservationId,
    ) ?? reservations[0]
  );
};

export const markLearnerPickupNoShow = async (input: {
  ownerId: string;
  reservationId: string;
  reasonCode: 'LEARNER_DID_NOT_ARRIVE' | 'OTHER';
  note?: string;
}) => {
  const result = await runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
    });

    if (!existing) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (existing.status !== 'ACCEPTED') {
      return { outcome: 'INVALID_STATUS' as const };
    }

    if (existing.fulfillmentMethod !== 'PICKUP') {
      return { outcome: 'NOT_PICKUP' as const };
    }

    if (!existing.pickupWindowEnd) {
      return { outcome: 'MISSING_WINDOW' as const };
    }

    const now = new Date();

    if (
      !isAfterWindowWithGrace(
        now,
        existing.pickupWindowEnd,
        HANDOVER_GRACE_MINUTES,
      )
    ) {
      return { outcome: 'WINDOW_NOT_EXPIRED' as const };
    }

    const reportResult = await createNoShowReportOnce(tx, {
      key: {
        reservationId: existing.id,
        deliveryId: null,
        targetRole: 'LEARNER',
        targetUserId: existing.requesterId,
        reasonCode: input.reasonCode,
      },
      data: {
        reservationId: existing.id,
        reporterUserId: input.ownerId,
        targetUserId: existing.requesterId,
        targetRole: 'LEARNER',
        reasonCode: input.reasonCode,
        note: input.note?.trim() || null,
        pickupWindowStart: existing.pickupWindowStart,
        pickupWindowEnd: existing.pickupWindowEnd,
      },
    });

    if (!reportResult.created) {
      return { outcome: 'DUPLICATE' as const };
    }

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'NO_SHOW',
        cancelledAt: now,
      },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'NO_SHOW',
        changedBy: input.ownerId,
        note: formatReservationHistoryNote('LEARNER_NO_SHOW_AFTER_PICKUP', {
          reasonText: input.note,
        }),
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);
    await applyBuildReservationSyncInTransaction(tx, reservation.id);

    const payment = await handleReservationPaymentLifecycleTransition(tx, {
      reservationId: reservation.id,
      newStatus: 'NO_SHOW',
      actorUserId: input.ownerId,
      reason: input.note?.trim() || 'Learner no-show after pickup window',
    });

    return {
      outcome: 'UPDATED' as const,
      reservation,
      postCommitRefunds: payment.postCommitRefunds,
      postCommitResolution: payment.postCommitResolution ?? null,
    };
  });

  if (
    result &&
    typeof result === 'object' &&
    'postCommitRefunds' in result &&
    Array.isArray(result.postCommitRefunds)
  ) {
    await flushPostCommitPaymentRefunds(
      result.postCommitRefunds,
      'postCommitResolution' in result
        ? (result.postCommitResolution as
            | import('../payments/payments.lifecycle.js').PostCommitResolutionTask
            | null
            | undefined)
        : null,
    );
  }

  return result;
};

export const markDeliveryPickupWindowExpired = async (input: {
  ownerId: string;
  reservationId: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
      include: {
        deliveries: {
          orderBy: { requestedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!existing) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (existing.status !== 'ACCEPTED') {
      return { outcome: 'INVALID_STATUS' as const };
    }

    const delivery = existing.deliveries[0];
    if (!delivery) {
      return { outcome: 'NO_DELIVERY' as const };
    }

    if (delivery.status !== 'WAITING_FOR_DRIVER') {
      return { outcome: 'INVALID_DELIVERY_STATUS' as const };
    }

    if (delivery.assignedDriverProfileId) {
      return { outcome: 'DRIVER_ASSIGNED' as const };
    }

    const supplierPickupWindowEnd =
      existing.supplierPickupWindowEnd ?? existing.pickupWindowEnd;

    if (!supplierPickupWindowEnd) {
      return { outcome: 'MISSING_WINDOW' as const };
    }

    const now = new Date();

    if (
      !isAfterWindowWithGrace(
        now,
        supplierPickupWindowEnd,
        HANDOVER_GRACE_MINUTES,
      )
    ) {
      return { outcome: 'WINDOW_NOT_EXPIRED' as const };
    }

    const updatedDelivery = await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'AWAITING_RESOLUTION',
        failedAt: now,
        failureReason: 'Supplier pickup window expired with no driver assigned',
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: 'AWAITING_RESOLUTION',
        changedByUserId: input.ownerId,
        note: 'Supplier marked pickup window expired',
      },
    });

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'AWAITING_RESOLUTION',
        changedBy: input.ownerId,
        note: formatReservationHistoryNote('DELIVERY_PICKUP_WINDOW_EXPIRED'),
      },
    });
    await applyBuildReservationSyncInTransaction(tx, reservation.id);

    await createNoShowReportOnce(tx, {
      key: {
        reservationId: existing.id,
        deliveryId: null,
        targetRole: 'SYSTEM',
        targetUserId: null,
        reasonCode: 'NO_DRIVER_AVAILABLE',
      },
      data: {
        reservationId: existing.id,
        deliveryId: delivery.id,
        reporterUserId: input.ownerId,
        targetUserId: null,
        targetRole: 'SYSTEM',
        reasonCode: 'NO_DRIVER_AVAILABLE',
        note: 'Supplier pickup window expired with no driver assigned',
        pickupWindowStart: existing.supplierPickupWindowStart,
        pickupWindowEnd: existing.supplierPickupWindowEnd,
      },
    });

    return {
      outcome: 'UPDATED' as const,
      reservation,
      delivery: updatedDelivery,
    };
  });

export const markDriverNoShow = async (input: {
  ownerId: string;
  deliveryId: string;
  note?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const delivery = await tx.delivery.findFirst({
      where: { id: input.deliveryId },
      include: {
        reservation: true,
        assignedDriverProfile: {
          select: { id: true, userId: true },
        },
      },
    });

    if (!delivery) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (delivery.reservation.ownerId !== input.ownerId) {
      return { outcome: 'FORBIDDEN' as const };
    }

    if (delivery.reservation.status !== 'ACCEPTED') {
      return { outcome: 'INVALID_RESERVATION_STATUS' as const };
    }

    if (!delivery.assignedDriverProfileId) {
      return { outcome: 'NOT_ASSIGNED' as const };
    }

    if (
      !(prePickupDeliveryStatuses as readonly DeliveryStatus[]).includes(
        delivery.status,
      )
    ) {
      return { outcome: 'INVALID_DELIVERY_STATUS' as const };
    }

    if (!delivery.reservation.supplierPickupWindowEnd) {
      return { outcome: 'MISSING_WINDOW' as const };
    }

    const now = new Date();

    if (
      !isAfterWindowWithGrace(
        now,
        delivery.reservation.supplierPickupWindowEnd,
        HANDOVER_GRACE_MINUTES,
      )
    ) {
      return { outcome: 'WINDOW_NOT_EXPIRED' as const };
    }

    const driverUserId = delivery.assignedDriverProfile?.userId;
    if (driverUserId) {
      await createNoShowReportOnce(tx, {
        key: {
          reservationId: delivery.reservationId,
          deliveryId: delivery.id,
          targetRole: 'DRIVER',
          targetUserId: driverUserId,
          reasonCode: 'DRIVER_DID_NOT_ARRIVE',
        },
        data: {
          reservationId: delivery.reservationId,
          deliveryId: delivery.id,
          reporterUserId: input.ownerId,
          targetUserId: driverUserId,
          targetRole: 'DRIVER',
          reasonCode: 'DRIVER_DID_NOT_ARRIVE',
          note: input.note?.trim() || null,
          pickupWindowStart: delivery.reservation.supplierPickupWindowStart,
          pickupWindowEnd: delivery.reservation.supplierPickupWindowEnd,
        },
      });
    }

    await releaseDriverFromDelivery(tx, {
      deliveryId: delivery.id,
      driverProfileId: delivery.assignedDriverProfileId,
      releaseReason: 'Driver no-show',
    });

    const updatedDelivery = await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'DRIVER_NO_SHOW',
        assignedDriverProfileId: null,
        failedAt: now,
        failureReason: input.note?.trim() || 'Driver no-show at supplier pickup',
        driverNote: input.note?.trim() || delivery.driverNote,
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: 'DRIVER_NO_SHOW',
        changedByUserId: input.ownerId,
        note: input.note?.trim() || 'Driver no-show reported by supplier',
      },
    });

    const reservation = await tx.reservation.update({
      where: { id: delivery.reservationId },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'ACCEPTED',
        newStatus: 'AWAITING_RESOLUTION',
        changedBy: input.ownerId,
        note: formatReservationHistoryNote('DRIVER_NO_SHOW_AT_SUPPLIER'),
      },
    });
    await applyBuildReservationSyncInTransaction(tx, reservation.id);

    return {
      outcome: 'UPDATED' as const,
      reservation,
      delivery: updatedDelivery,
    };
  });

export const markDriverPickupFailed = async (input: {
  driverUserId: string;
  deliveryId: string;
  reason:
    | 'SUPPLIER_UNAVAILABLE'
    | 'MATERIAL_NOT_READY'
    | 'LOCATION_ISSUE'
    | 'OTHER';
  note?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const profile = await tx.driverProfile.findFirst({
      where: { userId: input.driverUserId, status: 'ACTIVE' },
    });

    if (!profile) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const delivery = await tx.delivery.findFirst({
      where: {
        id: input.deliveryId,
        assignedDriverProfileId: profile.id,
      },
      include: { reservation: true },
    });

    if (!delivery) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (delivery.reservation.status !== 'ACCEPTED') {
      return { outcome: 'INVALID_RESERVATION_STATUS' as const };
    }

    if (
      !(prePickupDeliveryStatuses as readonly DeliveryStatus[]).includes(
        delivery.status,
      )
    ) {
      return { outcome: 'INVALID_DELIVERY_STATUS' as const };
    }

    const groupedState = delivery.deliveryGroupId
      ? await loadAndAssertGroupedDeliveryState(tx, {
          deliveryId: delivery.id,
          expectedDeliveryStatuses: [delivery.status],
          expectedGroupStatus: 'ASSIGNED',
          expectedReservationStatus: 'ACCEPTED',
          expectedDriverProfileId: profile.id,
          expectedActiveAssignments: 1,
          expectedSupplierUserId: delivery.reservation.ownerId,
        })
      : undefined;

    if (!delivery.reservation.supplierPickupWindowEnd) {
      return { outcome: 'MISSING_WINDOW' as const };
    }

    const now = new Date();

    if (
      !isAfterWindowWithGrace(
        now,
        delivery.reservation.supplierPickupWindowEnd,
        HANDOVER_GRACE_MINUTES,
      )
    ) {
      return { outcome: 'WINDOW_NOT_EXPIRED' as const };
    }

    const failureNote = [
      input.reason,
      input.note?.trim() || null,
    ]
      .filter(Boolean)
      .join(': ');

    const supplierUserId = delivery.reservation.ownerId;
    await createNoShowReportOnce(tx, {
      key: {
        reservationId: delivery.reservationId,
        deliveryId: null,
        targetRole: 'SUPPLIER',
        targetUserId: supplierUserId,
        reasonCode: 'PICKUP_FAILED',
        includeReasonCode: false,
      },
      data: {
        reservationId: delivery.reservationId,
        deliveryId: delivery.id,
        reporterUserId: input.driverUserId,
        targetUserId: supplierUserId,
        targetRole: 'SUPPLIER',
        reasonCode: 'PICKUP_FAILED',
        note: failureNote,
        reporterReasonDetail: input.reason,
        reporterNote: input.note?.trim() || null,
        pickupWindowStart: delivery.reservation.supplierPickupWindowStart,
        pickupWindowEnd: delivery.reservation.supplierPickupWindowEnd,
      },
    });

    await releaseDriverFromDelivery(tx, {
      deliveryId: delivery.id,
      driverProfileId: profile.id,
      releaseReason: 'Pickup failed',
      expectedActiveCount: groupedState ? 1 : undefined,
    });

    const deliveryChanged = await tx.delivery.updateMany({
      where: {
        id: delivery.id,
        status: delivery.status,
        assignedDriverProfileId: profile.id,
        deliveryGroupId: delivery.deliveryGroupId,
        reservationId: delivery.reservationId,
      },
      data: {
        status: 'FAILED_PICKUP',
        assignedDriverProfileId: null,
        failedAt: now,
        failureReason: failureNote,
        driverNote: input.note?.trim() || delivery.driverNote,
      },
    });
    if (deliveryChanged.count !== 1) {
      groupedDeliveryStateConflict();
    }
    const updatedDelivery = await tx.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: 'FAILED_PICKUP',
        changedByUserId: input.driverUserId,
        note: failureNote,
      },
    });

    const reservation = await transitionFailureReservations(tx, {
      delivery,
      changedByUserId: input.driverUserId,
      note: delivery.deliveryGroupId
        ? 'Grouped pickup failed at supplier'
        : 'Pickup failed at supplier',
      groupedState,
    });

    return {
      outcome: 'UPDATED' as const,
      reservation,
      delivery: updatedDelivery,
    };
  });

export const markDriverDeliveryFailed = async (input: {
  driverUserId: string;
  deliveryId: string;
  reason:
    | 'LEARNER_UNAVAILABLE'
    | 'ADDRESS_ISSUE'
    | 'ACCESS_ISSUE'
    | 'OTHER';
  note?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const profile = await tx.driverProfile.findFirst({
      where: { userId: input.driverUserId, status: 'ACTIVE' },
    });

    if (!profile) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const delivery = await tx.delivery.findFirst({
      where: {
        id: input.deliveryId,
        assignedDriverProfileId: profile.id,
      },
      include: { reservation: true },
    });

    if (!delivery) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (delivery.reservation.status === 'COMPLETED') {
      return { outcome: 'INVALID_RESERVATION_STATUS' as const };
    }

    if (
      !(postPickupDeliveryStatuses as readonly DeliveryStatus[]).includes(
        delivery.status,
      )
    ) {
      return { outcome: 'INVALID_DELIVERY_STATUS' as const };
    }

    const groupedState = delivery.deliveryGroupId
      ? await loadAndAssertGroupedDeliveryState(tx, {
          deliveryId: delivery.id,
          expectedDeliveryStatuses: [delivery.status],
          expectedGroupStatus: 'ASSIGNED',
          expectedReservationStatus: 'ACCEPTED',
          expectedDriverProfileId: profile.id,
          expectedActiveAssignments: 1,
          expectedSupplierUserId: delivery.reservation.ownerId,
        })
      : undefined;

    if (!delivery.reservation.confirmedDeliveryWindowEnd) {
      return { outcome: 'MISSING_WINDOW' as const };
    }

    const now = new Date();

    if (
      !isAfterWindowWithGrace(
        now,
        delivery.reservation.confirmedDeliveryWindowEnd,
        HANDOVER_GRACE_MINUTES,
      )
    ) {
      return { outcome: 'WINDOW_NOT_EXPIRED' as const };
    }

    const failureNote = [
      input.reason,
      input.note?.trim() || null,
    ]
      .filter(Boolean)
      .join(': ');

    const newDeliveryStatus: DeliveryStatus =
      input.reason === 'LEARNER_UNAVAILABLE'
        ? 'LEARNER_NO_SHOW'
        : 'FAILED_DELIVERY';

    if (input.reason === 'LEARNER_UNAVAILABLE') {
      await createNoShowReportOnce(tx, {
        key: {
          reservationId: delivery.reservationId,
          deliveryId: null,
          targetRole: 'LEARNER',
          targetUserId: delivery.reservation.requesterId,
          reasonCode: 'DELIVERY_FAILED',
          includeReasonCode: false,
        },
        data: {
          reservationId: delivery.reservationId,
          deliveryId: delivery.id,
          reporterUserId: input.driverUserId,
          targetUserId: delivery.reservation.requesterId,
          targetRole: 'LEARNER',
          reasonCode: 'DELIVERY_FAILED',
          note: failureNote,
          reporterReasonDetail: input.reason,
          reporterNote: input.note?.trim() || null,
          pickupWindowStart: delivery.reservation.confirmedDeliveryWindowStart,
          pickupWindowEnd: delivery.reservation.confirmedDeliveryWindowEnd,
        },
      });
    }

    const deliveryChanged = await tx.delivery.updateMany({
      where: {
        id: delivery.id,
        status: delivery.status,
        assignedDriverProfileId: profile.id,
        deliveryGroupId: delivery.deliveryGroupId,
        reservationId: delivery.reservationId,
      },
      data: {
        status: newDeliveryStatus,
        assignedDriverProfileId: null,
        failedAt: now,
        failureReason: failureNote,
        driverNote: input.note?.trim() || delivery.driverNote,
      },
    });
    if (deliveryChanged.count !== 1) {
      groupedDeliveryStateConflict();
    }
    const updatedDelivery = await tx.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: newDeliveryStatus,
        changedByUserId: input.driverUserId,
        note: failureNote,
      },
    });

    const reservation = await transitionFailureReservations(tx, {
      delivery,
      changedByUserId: input.driverUserId,
      note: delivery.deliveryGroupId
        ? 'Grouped delivery failed after pickup'
        : 'Delivery failed after pickup',
      groupedState,
    });

    await releaseDriverFromDelivery(tx, {
      deliveryId: delivery.id,
      driverProfileId: profile.id,
      releaseReason: 'Delivery failed',
      expectedActiveCount: groupedState ? 1 : undefined,
    });

    return {
      outcome: 'UPDATED' as const,
      reservation,
      delivery: updatedDelivery,
    };
  });

export const markDriverIssueAfterPickup = async (input: {
  driverUserId: string;
  deliveryId: string;
  note: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const profile = await tx.driverProfile.findFirst({
      where: { userId: input.driverUserId, status: 'ACTIVE' },
    });

    if (!profile) {
      return { outcome: 'NOT_FOUND' as const };
    }

    const delivery = await tx.delivery.findFirst({
      where: {
        id: input.deliveryId,
        assignedDriverProfileId: profile.id,
      },
      include: { reservation: true },
    });

    if (!delivery) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (delivery.reservation.status === 'COMPLETED') {
      return { outcome: 'INVALID_RESERVATION_STATUS' as const };
    }

    if (
      !(postPickupDeliveryStatuses as readonly DeliveryStatus[]).includes(
        delivery.status,
      )
    ) {
      return { outcome: 'INVALID_DELIVERY_STATUS' as const };
    }

    const groupedState = delivery.deliveryGroupId
      ? await loadAndAssertGroupedDeliveryState(tx, {
          deliveryId: delivery.id,
          expectedDeliveryStatuses: [delivery.status],
          expectedGroupStatus: 'ASSIGNED',
          expectedReservationStatus: 'ACCEPTED',
          expectedDriverProfileId: profile.id,
          expectedActiveAssignments: 1,
          expectedSupplierUserId: delivery.reservation.ownerId,
        })
      : undefined;

    await createNoShowReportOnce(tx, {
      key: {
        reservationId: delivery.reservationId,
        deliveryId: null,
        targetRole: 'DRIVER',
        targetUserId: input.driverUserId,
        reasonCode: 'DRIVER_ISSUE',
      },
      data: {
        reservationId: delivery.reservationId,
        deliveryId: delivery.id,
        reporterUserId: input.driverUserId,
        targetUserId: input.driverUserId,
        targetRole: 'DRIVER',
        reasonCode: 'DRIVER_ISSUE',
        note: input.note.trim(),
        reporterReasonDetail: 'DRIVER_ISSUE',
        reporterNote: input.note.trim(),
        pickupWindowStart: delivery.reservation.confirmedDeliveryWindowStart,
        pickupWindowEnd: delivery.reservation.confirmedDeliveryWindowEnd,
      },
    });

    const now = new Date();
    const deliveryChanged = await tx.delivery.updateMany({
      where: {
        id: delivery.id,
        status: delivery.status,
        assignedDriverProfileId: profile.id,
        deliveryGroupId: delivery.deliveryGroupId,
        reservationId: delivery.reservationId,
      },
      data: {
        status: 'AWAITING_RESOLUTION',
        assignedDriverProfileId: null,
        failedAt: now,
        failureReason: input.note.trim(),
        driverNote: input.note.trim(),
      },
    });
    if (deliveryChanged.count !== 1) {
      groupedDeliveryStateConflict();
    }
    const updatedDelivery = await tx.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: 'AWAITING_RESOLUTION',
        changedByUserId: input.driverUserId,
        note: 'Driver reported issue after pickup',
      },
    });

    const reservation = await transitionFailureReservations(tx, {
      delivery,
      changedByUserId: input.driverUserId,
      note: delivery.deliveryGroupId
        ? 'Driver issue after grouped pickup'
        : 'Driver issue after pickup',
      groupedState,
    });

    await releaseDriverFromDelivery(tx, {
      deliveryId: delivery.id,
      driverProfileId: profile.id,
      releaseReason: 'Driver issue after pickup',
      expectedActiveCount: groupedState ? 1 : undefined,
    });

    return {
      outcome: 'UPDATED' as const,
      reservation,
      delivery: updatedDelivery,
    };
  });
