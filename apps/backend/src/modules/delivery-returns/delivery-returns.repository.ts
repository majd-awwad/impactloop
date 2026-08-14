import type { DeliveryReturnReason, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { reconcileDriverAvailability } from '../driver/driver-availability.js';
import {
  recomputeAndUpdateMaterialStatus,
  runSerializableTransaction,
} from '../reservations/reservations.quantity.js';

const stateConflict = () =>
  new AppError(
    'Delivery return state changed. Refresh and try again.',
    409,
    'DELIVERY_RETURN_STATE_CONFLICT',
  );

export const requireAuthoritativeCarriedItems = async (
  tx: Prisma.TransactionClient,
  deliveryId: string,
) => {
  const items = await tx.deliveryPickupItem.findMany({
    where: { deliveryId, wasPicked: true },
    select: {
      reservationId: true,
      materialId: true,
      materialTitle: true,
      quantity: true,
      unit: true,
    },
    orderBy: { recordedAt: 'asc' },
  });
  if (items.length === 0) throw stateConflict();

  const reservationIds = [...new Set(items.map((item) => item.reservationId))];
  if (reservationIds.length !== items.length) throw stateConflict();
  return { items, reservationIds };
};

export const transitionDeliveryToReturnRequired = async (input: {
  deliveryId: string;
  expectedStatuses: Array<'REDELIVERY_PENDING' | 'REDELIVERY_SCHEDULED'>;
  reason: DeliveryReturnReason;
  changedByUserId?: string | null;
  now: Date;
}) =>
  runSerializableTransaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({
      where: { id: input.deliveryId },
      include: {
        reservation: { select: { requesterId: true, ownerId: true } },
        assignedDriverProfile: { select: { id: true, userId: true } },
        assignments: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });
    if (!delivery) return { outcome: 'NOT_FOUND' as const };
    if (delivery.status === 'RETURN_TO_SUPPLIER_REQUIRED') {
      return { outcome: 'ALREADY_REQUIRED' as const, delivery };
    }
    if (!input.expectedStatuses.includes(delivery.status as never)) {
      return { outcome: 'NOT_ELIGIBLE' as const };
    }
    if (
      !delivery.assignedDriverProfile ||
      delivery.assignments.length !== 1
    ) {
      throw stateConflict();
    }
    await requireAuthoritativeCarriedItems(tx, delivery.id);

    const changed = await tx.delivery.updateMany({
      where: {
        id: delivery.id,
        status: { in: input.expectedStatuses },
        assignedDriverProfileId: delivery.assignedDriverProfile.id,
      },
      data: {
        status: 'RETURN_TO_SUPPLIER_REQUIRED',
        failedAt: delivery.failedAt ?? input.now,
        returnRequiredAt: input.now,
        returnReason: input.reason,
        returnCustodyDriverProfileId: delivery.assignedDriverProfile.id,
        failureReason:
          input.reason === 'RETRY_DEADLINE_EXPIRED'
            ? 'RETRY_DEADLINE_EXPIRED'
            : delivery.failureReason,
        learnerDeliveryHandoverTokenHash: null,
        learnerDeliveryHandoverTokenIssuedAt: null,
        learnerDeliveryHandoverTokenExpiresAt: null,
      },
    });
    if (changed.count !== 1) {
      return { outcome: 'RACED' as const };
    }

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: delivery.status,
        newStatus: 'RETURN_TO_SUPPLIER_REQUIRED',
        changedByUserId:
          input.changedByUserId ?? delivery.assignedDriverProfile.userId,
        note:
          input.reason === 'RETRY_DEADLINE_EXPIRED'
            ? 'Retry deadline expired; physical return to supplier required'
            : 'Final delivery attempt failed; physical return to supplier required',
      },
    });

    return {
      outcome: 'UPDATED' as const,
      deliveryId: delivery.id,
      learnerUserId: delivery.reservation.requesterId,
      supplierUserId: delivery.reservation.ownerId,
      driverUserId: delivery.assignedDriverProfile.userId,
    };
  });

export const confirmReturnedDelivery = async (input: {
  supplierUserId: string;
  deliveryId: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const delivery = await tx.delivery.findUnique({
      where: { id: input.deliveryId },
      include: {
        reservation: { select: { ownerId: true, requesterId: true } },
        assignedDriverProfile: { select: { id: true, userId: true } },
        assignments: { where: { status: 'ACTIVE' }, select: { id: true } },
      },
    });
    if (!delivery || delivery.reservation.ownerId !== input.supplierUserId) {
      return { outcome: 'NOT_FOUND' as const };
    }
    if (delivery.status === 'RETURNED_TO_SUPPLIER') {
      if (delivery.returnConfirmedByUserId !== input.supplierUserId) {
        return { outcome: 'NOT_FOUND' as const };
      }
      return { outcome: 'ALREADY_CONFIRMED' as const, deliveryId: delivery.id };
    }
    if (delivery.status !== 'RETURN_TO_SUPPLIER_REQUIRED') {
      return { outcome: 'INVALID_STATUS' as const };
    }
    if (
      !delivery.assignedDriverProfile ||
      delivery.assignments.length !== 1 ||
      delivery.returnCustodyDriverProfileId !== delivery.assignedDriverProfile.id
    ) {
      throw stateConflict();
    }

    const { items, reservationIds } = await requireAuthoritativeCarriedItems(
      tx,
      delivery.id,
    );
    const represented = await tx.reservation.findMany({
      where: {
        id: { in: reservationIds },
        ownerId: input.supplierUserId,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
      },
      select: { id: true, materialId: true },
    });
    if (represented.length !== reservationIds.length) throw stateConflict();

    const now = new Date();
    const changed = await tx.delivery.updateMany({
      where: {
        id: delivery.id,
        status: 'RETURN_TO_SUPPLIER_REQUIRED',
        assignedDriverProfileId: delivery.assignedDriverProfile.id,
      },
      data: {
        status: 'RETURNED_TO_SUPPLIER',
        returnedToSupplierAt: now,
        returnConfirmedByUserId: input.supplierUserId,
        assignedDriverProfileId: null,
      },
    });
    if (changed.count !== 1) throw stateConflict();

    const reservationsChanged = await tx.reservation.updateMany({
      where: { id: { in: reservationIds }, status: 'ACCEPTED' },
      data: { status: 'AWAITING_RESOLUTION' },
    });
    if (reservationsChanged.count !== reservationIds.length) throw stateConflict();

    for (const reservation of represented) {
      await tx.reservationStatusHistory.create({
        data: {
          reservationId: reservation.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'ACCEPTED',
          newStatus: 'AWAITING_RESOLUTION',
          changedBy: input.supplierUserId,
          note: 'Physical return confirmed by supplier; awaiting administrative resolution',
        },
      });
    }
    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: 'RETURN_TO_SUPPLIER_REQUIRED',
        newStatus: 'RETURNED_TO_SUPPLIER',
        changedByUserId: input.supplierUserId,
        note: 'Supplier confirmed physical return of authoritative carried items',
      },
    });

    const released = await tx.deliveryAssignment.updateMany({
      where: {
        deliveryId: delivery.id,
        driverProfileId: delivery.assignedDriverProfile.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'RELEASED',
        releasedAt: now,
        releaseReason: 'Physical return confirmed by supplier',
      },
    });
    if (released.count !== 1) throw stateConflict();

    if (delivery.deliveryGroupId) {
      const groupChanged = await tx.deliveryGroup.updateMany({
        where: {
          id: delivery.deliveryGroupId,
          assignedDriverProfileId: delivery.assignedDriverProfile.id,
          status: 'ASSIGNED',
        },
        data: { status: 'CANCELLED', assignedDriverProfileId: null },
      });
      if (groupChanged.count !== 1) throw stateConflict();
    }

    await reconcileDriverAvailability(tx, delivery.assignedDriverProfile.id, {
      excludeDeliveryId: delivery.id,
    });
    for (const materialId of new Set(represented.map((row) => row.materialId))) {
      await recomputeAndUpdateMaterialStatus(tx, materialId);
    }

    return {
      outcome: 'CONFIRMED' as const,
      deliveryId: delivery.id,
      learnerUserId: delivery.reservation.requesterId,
      supplierUserId: input.supplierUserId,
      driverUserId: delivery.assignedDriverProfile.userId,
      returnedAt: now,
      items,
    };
  });

export const listDueRetryReturnDeliveryIds = async (
  limit: number,
  now: Date,
) =>
  prisma.delivery.findMany({
    where: {
      status: { in: ['REDELIVERY_PENDING', 'REDELIVERY_SCHEDULED'] },
      attempts: {
        some: { attemptNumber: 1, retryDeadline: { lte: now } },
      },
    },
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: limit,
  });
