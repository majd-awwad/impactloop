import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { computeEarliestDeliveryStart } from './supplier-reservation-scheduling.js';
import {
  isPartialPickupSupplierReconfirmReason,
  isSupplierPickupReconfirmReason,
} from '../reservations/reservation-timing-policy.js';
import { assertValidPickupWindow } from '../reservations/pickup-window-validation.js';
import { runSerializableTransaction } from '../reservations/reservations.quantity.js';
import {
  reservationInclude,
  type SupplierReservationRecord,
} from './supplier-reservations.repository.js';
import {
  computeInitialGroupWindow,
  findCompatibleDeliveryGroupCandidate,
} from '../delivery-groups/delivery-groups.repository.js';
import {
  groupedDeliveryStateConflict,
  loadAndAssertGroupedDeliveryState,
} from '../delivery-groups/grouped-delivery-state.js';
import {
  afterFinalAcceptanceInTransaction,
  ensureDeliveryForAcceptedReservationIfPaymentReady,
  ensurePaymentObligationsForAcceptedReservation,
} from '../payments/payments.acceptance.js';
import { isElectronicPaymentEnforced } from '../payments/payments.policy.js';
import {
  evaluateDeliveryGroupPaymentReadiness,
  evaluatePickupPaymentReadiness,
} from '../payments/payments.readiness.js';

const supplierReservationLookupSelect = {
  id: true,
  status: true,
  fulfillmentMethod: true,
  pendingRescheduleReason: true,
  supplierNote: true,
  deliveryGroupId: true,
} satisfies Prisma.ReservationSelect;

const deliveryLookupSelect = {
  id: true,
  status: true,
  deliveryGroupId: true,
} satisfies Prisma.DeliverySelect;

const parsePreferredDeliveryWindows = (
  value: Prisma.JsonValue | null,
): { start: string; end: string }[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (
      typeof entry !== 'object' ||
      entry == null ||
      Array.isArray(entry) ||
      typeof entry.start !== 'string' ||
      typeof entry.end !== 'string'
    ) {
      return [];
    }
    return [{ start: entry.start, end: entry.end }];
  });
};

const createPartialPickupReplacementDelivery = async (
  tx: Prisma.TransactionClient,
  input: { reservationId: string; supplierUserId: string },
): Promise<{
  deliveryId: string | null;
  deliveryGroupId: string | null;
  deferredForPayment: boolean;
}> => {
  const reservation = await tx.reservation.findUniqueOrThrow({
    where: { id: input.reservationId },
    include: {
      material: {
        select: {
          supplierProfileId: true,
          location: {
            select: {
              country: true,
              city: true,
              area: true,
              addressLine: true,
              latitude: true,
              longitude: true,
              isApproximate: true,
            },
          },
        },
      },
    },
  });

  const preferredDeliveryWindows = parsePreferredDeliveryWindows(
    reservation.learnerPreferredDeliveryWindows,
  );
  const supplierProfileId = reservation.material.supplierProfileId;
  const dropoffCity = reservation.dropoffCity?.trim();
  const deliveryZone = reservation.deliveryZone;
  let deliveryGroupId: string | null = null;

  if (
    supplierProfileId &&
    dropoffCity &&
    deliveryZone &&
    preferredDeliveryWindows.length > 0
  ) {
    const candidate = await findCompatibleDeliveryGroupCandidate({
      learnerId: reservation.requesterId,
      supplierProfileId,
      dropoffCity,
      dropoffArea: reservation.dropoffArea,
      preferredDeliveryWindows,
      deliveryZone,
      tx,
    });

    if (candidate) {
      deliveryGroupId = candidate.id;
      await tx.deliveryGroup.update({
        where: { id: candidate.id },
        data: {
          windowStart: new Date(candidate.sharedWindowStart),
          windowEnd: new Date(candidate.sharedWindowEnd),
        },
      });
    } else {
      const window = computeInitialGroupWindow(preferredDeliveryWindows);
      if (window) {
        const group = await tx.deliveryGroup.create({
          data: {
            learnerId: reservation.requesterId,
            supplierProfileId,
            dropoffCity,
            dropoffArea: reservation.dropoffArea,
            deliveryAddressText: reservation.deliveryAddressText,
            deliveryFee: reservation.deliveryFee ?? new Prisma.Decimal(0),
            currency: reservation.pricingCurrency ?? 'NIS',
            deliveryZone,
            status: 'OPEN',
            windowStart: window.start,
            windowEnd: window.end,
          },
        });
        deliveryGroupId = group.id;
      }
    }
  }

  if (deliveryGroupId) {
    await tx.reservation.update({
      where: { id: reservation.id },
      data: { deliveryGroupId },
    });
    // Group may be newly assigned after acceptance — ensure fee obligation now.
    await ensurePaymentObligationsForAcceptedReservation(tx, reservation.id);
  }

  const deliveryInput = {
    reservation: {
      id: reservation.id,
      requesterId: reservation.requesterId,
      deliveryGroupId,
      deliveryAddressText: reservation.deliveryAddressText,
      dropoffCity: reservation.dropoffCity,
      dropoffArea: reservation.dropoffArea,
      deliveryNote: reservation.deliveryNote,
      material: { location: reservation.material.location },
    },
    changedByUserId: input.supplierUserId,
    statusHistoryNote: 'New delivery created after partial pickup replacement window',
  };

  const gated = await ensureDeliveryForAcceptedReservationIfPaymentReady(
    tx,
    deliveryInput,
  );

  if (gated.deferred) {
    return {
      deliveryId: null,
      deliveryGroupId,
      deferredForPayment: true,
    };
  }

  const delivery = deliveryGroupId
    ? await tx.delivery.findFirstOrThrow({
        where: { deliveryGroupId },
        select: { id: true, deliveryGroupId: true },
      })
    : await tx.delivery.findFirstOrThrow({
        where: { reservationId: reservation.id },
        select: { id: true, deliveryGroupId: true },
      });

  return {
    deliveryId: delivery.id,
    deliveryGroupId: delivery.deliveryGroupId,
    deferredForPayment: false,
  };
};

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

    if (!isSupplierPickupReconfirmReason(existing.pendingRescheduleReason)) {
      return { outcome: 'NOT_ELIGIBLE' as const };
    }

    const isPartialPickupRecovery = isPartialPickupSupplierReconfirmReason(
      existing.pendingRescheduleReason,
    );

    // A detached partial-pickup reservation deliberately has no current
    // delivery. Historical deliveries are audit records and must be immutable.
    const delivery = isPartialPickupRecovery
      ? null
      : await tx.delivery.findFirst({
          where: existing.deliveryGroupId
            ? { deliveryGroupId: existing.deliveryGroupId }
            : { reservationId: existing.id },
          orderBy: { createdAt: 'desc' },
          select: deliveryLookupSelect,
        });

    if (
      (!delivery && !isPartialPickupRecovery) ||
      (delivery &&
        !['AWAITING_RESOLUTION', 'FAILED_PICKUP', 'DRIVER_NO_SHOW'].includes(
          delivery.status,
        ))
    ) {
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
      input.supplierPickupWindowStart,
    );

    const groupedState =
      delivery?.deliveryGroupId && existing.deliveryGroupId
        ? await loadAndAssertGroupedDeliveryState(tx, {
            deliveryId: delivery.id,
            expectedDeliveryStatuses: [delivery.status],
            expectedGroupStatus: 'CANCELLED',
            expectedReservationStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
            expectedDriverProfileId: null,
            expectedActiveAssignments: 0,
            expectedSupplierUserId: input.ownerId,
          })
        : undefined;

    const affectedReservations = existing.deliveryGroupId
      ? groupedState?.reservations ?? groupedDeliveryStateConflict()
      : [existing];

    for (const affected of affectedReservations) {
      const reservationChanged = await tx.reservation.updateMany({
        where: {
          id: affected.id,
          status: 'AWAITING_SUPPLIER_CONFIRMATION',
          fulfillmentMethod: 'DELIVERY',
          deliveryGroupId: existing.deliveryGroupId,
          ownerId: input.ownerId,
        },
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
          supplierNote:
            input.supplierNote?.trim() || affected.supplierNote,
        },
      });
      if (reservationChanged.count !== 1) {
        groupedDeliveryStateConflict();
      }

      await tx.reservationStatusHistory.create({
        data: {
          reservationId: affected.id,
          statusGroup: 'RESERVATION',
          oldStatus: 'AWAITING_SUPPLIER_CONFIRMATION',
          newStatus: 'ACCEPTED',
          changedBy: input.ownerId,
          note: isPartialPickupRecovery
            ? 'Supplier submitted replacement pickup window after partial pickup'
            : 'Supplier submitted new pickup window after admin recovery',
        },
      });

      await afterFinalAcceptanceInTransaction(tx, {
        reservationId: affected.id,
      });
    }

    let recoveryDeliveryId: string | null = null;
    let recoveryDeliveryGroupId: string | null = null;

    if (delivery) {
      let paymentReady = true;
      if (isElectronicPaymentEnforced()) {
        if (existing.deliveryGroupId) {
          const readiness = await evaluateDeliveryGroupPaymentReadiness(
            existing.deliveryGroupId,
            tx,
          );
          paymentReady = readiness.overallReady;
        } else {
          const material = await evaluatePickupPaymentReadiness(existing.id, tx);
          paymentReady = material.ready;
        }
      }

      if (paymentReady) {
        const deliveryChanged = await tx.delivery.updateMany({
          where: {
            id: delivery.id,
            status: delivery.status,
            assignedDriverProfileId: null,
            deliveryGroupId: delivery.deliveryGroupId,
          },
          data: {
            status: 'WAITING_FOR_DRIVER',
            assignedDriverProfileId: null,
            assignedAt: null,
            failedAt: null,
            failureReason: null,
            cancelledAt: null,
          },
        });
        if (deliveryChanged.count !== 1) {
          groupedDeliveryStateConflict();
        }

        await tx.deliveryStatusHistory.create({
          data: {
            deliveryId: delivery.id,
            oldStatus: delivery.status,
            newStatus: 'WAITING_FOR_DRIVER',
            changedByUserId: input.ownerId,
            note: 'Supplier submitted new pickup window after no driver available',
          },
        });

        if (delivery.deliveryGroupId) {
          const groupChanged = await tx.deliveryGroup.updateMany({
            where: {
              id: delivery.deliveryGroupId,
              status: 'CANCELLED',
              assignedDriverProfileId: null,
            },
            data: { status: 'OPEN', assignedDriverProfileId: null },
          });
          if (groupChanged.count !== 1) {
            groupedDeliveryStateConflict();
          }
        }

        recoveryDeliveryId = delivery.id;
        recoveryDeliveryGroupId = delivery.deliveryGroupId;

        await resolvePendingNoDriverReport(
          tx,
          existing.id,
          'Supplier provided new pickup window after no driver available',
        );
      } else {
        // Keep report pending until payment success reopens Delivery.
        recoveryDeliveryGroupId = delivery.deliveryGroupId;
      }
    } else {
      const replacement = await createPartialPickupReplacementDelivery(tx, {
        reservationId: existing.id,
        supplierUserId: input.ownerId,
      });
      recoveryDeliveryId = replacement.deliveryId;
      recoveryDeliveryGroupId = replacement.deliveryGroupId;
      if (!replacement.deferredForPayment) {
        await resolvePendingNoDriverReport(
          tx,
          existing.id,
          'Supplier provided replacement pickup window after partial pickup',
        );
      }
    }

    const recoveryReport = await tx.noShowReport.findFirst({
      where: {
        reservationId: existing.id,
        recoveryAction: 'SUPPLIER_RESCHEDULE_REQUESTED',
      },
      orderBy: [{ recoveryActionAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (recoveryReport) {
      await tx.noShowReport.update({
        where: { id: recoveryReport.id },
        data: {
          recoveryAction: recoveryDeliveryGroupId
            ? 'RESERVATION_REGROUPED'
            : 'REPLACEMENT_WINDOW_SUBMITTED',
          recoveryDeliveryId,
          recoveryDeliveryGroupId,
          recoveryCompletedAt: new Date(),
        },
      });
    }

    return { outcome: 'SUBMITTED' as const, reservationId: existing.id };
  });

  if (outcome.outcome !== 'SUBMITTED') {
    return outcome;
  }

  const reservation = await loadSupplierReservationRecord(outcome.reservationId);

  return { outcome: 'SUBMITTED' as const, reservation };
};
