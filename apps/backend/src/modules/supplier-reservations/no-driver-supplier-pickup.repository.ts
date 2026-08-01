import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { computeEarliestDeliveryStart } from './supplier-reservation-scheduling.js';
import {
  isAdminSupplierPickupReconfirmReason,
} from '../reservations/reservation-timing-policy.js';
import { assertValidPickupWindow } from '../reservations/pickup-window-validation.js';
import { runSerializableTransaction } from '../reservations/reservations.quantity.js';
import {
  reservationInclude,
  type SupplierReservationRecord,
} from './supplier-reservations.repository.js';

const supplierReservationLookupSelect = {
  id: true,
  status: true,
  fulfillmentMethod: true,
  pendingRescheduleReason: true,
  supplierNote: true,
} satisfies Prisma.ReservationSelect;

const deliveryLookupSelect = {
  id: true,
  status: true,
} satisfies Prisma.DeliverySelect;

const reservationMutationSelect = {
  id: true,
} satisfies Prisma.ReservationSelect;

const loadSupplierReservationRecord = async (
  reservationId: string,
): Promise<SupplierReservationRecord> =>
  prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: reservationInclude,
  });

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
    select: { id: true },
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
    select: { id: true },
  });
};

export const submitNoDriverPickupWindowForSupplier = async (input: {
  reservationId: string;
  ownerId: string;
  supplierPickupWindowStart: Date;
  supplierPickupWindowEnd: Date;
  supplierNote?: string;
}) => {
  const outcome = await runSerializableTransaction(async (tx) => {
    const existing = await tx.reservation.findFirst({
      where: {
        id: input.reservationId,
        ownerId: input.ownerId,
      },
      select: supplierReservationLookupSelect,
    });

    if (!existing) {
      return { outcome: 'NOT_FOUND' as const };
    }

    if (existing.fulfillmentMethod !== 'DELIVERY') {
      return { outcome: 'NOT_DELIVERY' as const };
    }

    if (existing.status !== 'AWAITING_SUPPLIER_CONFIRMATION') {
      return { outcome: 'INVALID_RESERVATION_STATUS' as const };
    }

    if (!isAdminSupplierPickupReconfirmReason(existing.pendingRescheduleReason)) {
      return { outcome: 'NOT_ELIGIBLE' as const };
    }

    const delivery = await tx.delivery.findFirst({
      where: { reservationId: existing.id },
      orderBy: { createdAt: 'desc' },
      select: deliveryLookupSelect,
    });

    if (!delivery || delivery.status !== 'AWAITING_RESOLUTION') {
      return { outcome: 'INVALID_DELIVERY_STATUS' as const };
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

    const updated = await tx.reservation.update({
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
      select: reservationMutationSelect,
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

    return { outcome: 'SUBMITTED' as const, reservationId: updated.id };
  });

  if (outcome.outcome !== 'SUBMITTED') {
    return outcome;
  }

  const reservation = await loadSupplierReservationRecord(outcome.reservationId);

  return { outcome: 'SUBMITTED' as const, reservation };
};
