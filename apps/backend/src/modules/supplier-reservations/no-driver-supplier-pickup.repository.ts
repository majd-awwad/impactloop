import type { Prisma } from '../../generated/prisma/client.js';
import { computeEarliestDeliveryStart } from './supplier-reservation-scheduling.js';
import {
  isAdminSupplierPickupReconfirmReason,
  NO_DRIVER_SUPPLIER_RECONFIRM_REASON,
} from '../reservations/reservation-timing-policy.js';
import { assertValidPickupWindow } from '../reservations/pickup-window-validation.js';
import { runSerializableTransaction } from '../reservations/reservations.quantity.js';
import { reservationInclude } from './supplier-reservations.repository.js';

const resolvePendingNoDriverReport = async (
  tx: Prisma.TransactionClient,
  reservationId: string,
  note: string,
) => {
  const report = await tx.noShowReport.findFirst({
    where: {
      reservationId,
      targetRole: 'SYSTEM',
      reasonCode: 'NO_DRIVER_AVAILABLE',
      status: 'PENDING_REVIEW',
    },
  });

  if (!report) {
    return;
  }

  await tx.noShowReport.update({
    where: { id: report.id },
    data: {
      status: 'RESOLVED_NO_STRIKE',
      reviewedAt: new Date(),
      reviewNote: note,
    },
  });
};

export const submitNoDriverPickupWindowForSupplier = async (input: {
  reservationId: string;
  ownerId: string;
  supplierPickupWindowStart: Date;
  supplierPickupWindowEnd: Date;
  supplierNote?: string;
}) =>
  runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!existing) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (existing.fulfillmentMethod !== 'DELIVERY') {
      return { outcome: 'NOT_DELIVERY' as const, reservation: existing };
    }

    if (existing.status !== 'AWAITING_SUPPLIER_CONFIRMATION') {
      return { outcome: 'INVALID_RESERVATION_STATUS' as const, reservation: existing };
    }

    if (!isAdminSupplierPickupReconfirmReason(existing.pendingRescheduleReason)) {
      return { outcome: 'NOT_ELIGIBLE' as const, reservation: existing };
    }

    const delivery = existing.deliveries[0];

    if (!delivery || delivery.status !== 'AWAITING_RESOLUTION') {
      return { outcome: 'INVALID_DELIVERY_STATUS' as const, reservation: existing };
    }

    assertValidPickupWindow(
      {
        start: input.supplierPickupWindowStart,
        end: input.supplierPickupWindowEnd,
      },
      'supplier_custom_proposal',
    );

    const earliestDeliveryStart = computeEarliestDeliveryStart(
      input.supplierPickupWindowEnd,
    );

    await tx.deliveryAssignment.updateMany({
      where: {
        deliveryId: delivery.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'RELEASED',
        releasedAt: new Date(),
        releaseReason: 'Supplier submitted new pickup window after no driver',
      },
    });

    const reservation = await tx.reservation.update({
      where: { id: existing.id },
      data: {
        status: 'ACCEPTED',
        supplierPickupWindowStart: input.supplierPickupWindowStart,
        supplierPickupWindowEnd: input.supplierPickupWindowEnd,
        pickupWindowStart: input.supplierPickupWindowStart,
        pickupWindowEnd: input.supplierPickupWindowEnd,
        earliestDeliveryStart,
        confirmedDeliveryWindowStart: null,
        confirmedDeliveryWindowEnd: null,
        schedulingConflictReason: null,
        pendingRescheduleRequestedBy: null,
        pendingRescheduleReason: null,
        pendingRescheduleNote: null,
        supplierNote: input.supplierNote?.trim() || existing.supplierNote,
      },
      include: reservationInclude,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: existing.id,
        statusGroup: 'RESERVATION',
        oldStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
        newStatus: 'ACCEPTED',
        changedBy: input.ownerId,
        note: 'Supplier submitted new pickup window after no driver available',
      },
    });

    await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'WAITING_FOR_DRIVER',
        assignedDriverProfileId: null,
        assignedAt: null,
        failedAt: null,
        failureReason: null,
        cancelledAt: null,
      },
    });

    await tx.deliveryStatusHistory.create({
      data: {
        deliveryId: delivery.id,
        oldStatus: 'AWAITING_RESOLUTION',
        newStatus: 'WAITING_FOR_DRIVER',
        changedByUserId: input.ownerId,
        note: 'Supplier submitted new pickup window after no driver available',
      },
    });

    await resolvePendingNoDriverReport(
      tx,
      existing.id,
      'Supplier provided new pickup window after no driver available',
    );

    const refreshed = await tx.reservation.findFirst({
      where: { id: existing.id },
      include: reservationInclude,
    });

    if (!refreshed) {
      return { outcome: 'NOT_FOUND' as const };
    }

    return { outcome: 'SUBMITTED' as const, reservation: refreshed };
  });
