import {
  Prisma,
  type DeliveryStatus,
  type ReservationStatus,
} from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { upsertNoShowReportByIncidentKey } from '../no-show-reports/no-show-report.create.js';
import { PARTIAL_PICKUP_HOLD_REASON_PREFIX } from '../reservations/reservations.quantity.js';

export const PARTIAL_PICKUP_UNPICKED_REASONS = [
  'MATERIAL_NOT_READY',
  'MATERIAL_MISSING',
  'WRONG_ITEM',
  'QUANTITY_MISMATCH',
  'DAMAGED_ITEM',
  'SUPPLIER_REFUSED_HANDOVER',
  'OTHER',
] as const;

export type PartialPickupUnpickedReason =
  (typeof PARTIAL_PICKUP_UNPICKED_REASONS)[number];

export type PartialPickupUnpickedItem = {
  reservationId: string;
  reason: PartialPickupUnpickedReason;
  note?: string | null;
};

export const reservationStatusForUnpickedReason = (
  reason: PartialPickupUnpickedReason,
): Extract<
  ReservationStatus,
  'AWAITING_SUPPLIER_CONFIRMATION' | 'AWAITING_RESOLUTION'
> => {
  if (reason === 'MATERIAL_NOT_READY' || reason === 'MATERIAL_MISSING') {
    return 'AWAITING_SUPPLIER_CONFIRMATION';
  }

  return 'AWAITING_RESOLUTION';
};

export type GroupMemberReservation = {
  id: string;
  status: ReservationStatus;
  fulfillmentMethod: string;
  materialId: string;
  quantityRequested: Prisma.Decimal;
  ownerId?: string;
  supplierPickupWindowStart?: Date | null;
  supplierPickupWindowEnd?: Date | null;
};

const splitConflict = () =>
  new AppError(
    'Grouped delivery state changed during partial pickup.',
    409,
    'DRIVER_GROUPED_DELIVERY_SPLIT_CONFLICT',
  );

/**
 * Validates a partial-pickup selection against the current group membership.
 * Returns a stable outcome code when the selection is invalid.
 */
export const validatePartialPickupSelection = (input: {
  members: GroupMemberReservation[];
  pickedReservationIds: string[];
  unpicked: PartialPickupUnpickedItem[];
}):
  | { ok: true; pickedIds: string[]; unpicked: PartialPickupUnpickedItem[] }
  | { ok: false; code: 'EMPTY_PICKED' | 'SELECTION_INVALID' } => {
  const memberIds = input.members.map((member) => member.id);
  const memberIdSet = new Set(memberIds);

  if (
    input.members.some(
      (member) =>
        member.status !== 'ACCEPTED' || member.fulfillmentMethod !== 'DELIVERY',
    )
  ) {
    return { ok: false, code: 'SELECTION_INVALID' };
  }

  if (input.pickedReservationIds.length === 0) {
    return { ok: false, code: 'EMPTY_PICKED' };
  }

  const pickedSeen = new Set<string>();
  for (const id of input.pickedReservationIds) {
    const trimmed = id.trim();
    if (!trimmed || pickedSeen.has(trimmed) || !memberIdSet.has(trimmed)) {
      return { ok: false, code: 'SELECTION_INVALID' };
    }
    pickedSeen.add(trimmed);
  }

  const unpickedSeen = new Set<string>();
  for (const item of input.unpicked) {
    const trimmed = item.reservationId.trim();
    if (
      !trimmed ||
      unpickedSeen.has(trimmed) ||
      !memberIdSet.has(trimmed) ||
      pickedSeen.has(trimmed)
    ) {
      return { ok: false, code: 'SELECTION_INVALID' };
    }
    if (
      !(PARTIAL_PICKUP_UNPICKED_REASONS as readonly string[]).includes(
        item.reason,
      )
    ) {
      return { ok: false, code: 'SELECTION_INVALID' };
    }
    unpickedSeen.add(trimmed);
  }

  if (pickedSeen.size + unpickedSeen.size !== memberIdSet.size) {
    return { ok: false, code: 'SELECTION_INVALID' };
  }

  for (const id of memberIdSet) {
    if (!pickedSeen.has(id) && !unpickedSeen.has(id)) {
      return { ok: false, code: 'SELECTION_INVALID' };
    }
  }

  return {
    ok: true,
    pickedIds: [...pickedSeen],
    unpicked: input.unpicked.map((item) => ({
      reservationId: item.reservationId.trim(),
      reason: item.reason,
      note: item.note?.trim() || null,
    })),
  };
};

export const applyPartialPickupSplit = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryId: string;
    deliveryGroupId: string;
    currentReservationId: string;
    driverUserId: string;
    driverProfileId: string;
    pickedIds: string[];
    unpicked: PartialPickupUnpickedItem[];
    members: GroupMemberReservation[];
  },
) => {
  if (!input.pickedIds.includes(input.currentReservationId)) {
    const primaryMove = await tx.delivery.updateMany({
      where: {
        id: input.deliveryId,
        reservationId: input.currentReservationId,
        deliveryGroupId: input.deliveryGroupId,
        assignedDriverProfileId: input.driverProfileId,
        status: 'ARRIVED_PICKUP',
      },
      data: { reservationId: input.pickedIds[0]! },
    });

    if (primaryMove.count !== 1) {
      throw splitConflict();
    }
  }

  for (const item of input.unpicked) {
    const member = input.members.find((row) => row.id === item.reservationId);
    if (!member) {
      throw splitConflict();
    }
    if (
      member.status !== 'ACCEPTED' ||
      member.fulfillmentMethod !== 'DELIVERY'
    ) {
      throw splitConflict();
    }

    const nextStatus = reservationStatusForUnpickedReason(item.reason);
    const noteParts = [
      'Not handed over at grouped pickup',
      item.reason,
      item.note || null,
    ].filter(Boolean);

    const detached = await tx.reservation.updateMany({
      where: {
        id: member.id,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: input.deliveryGroupId,
      },
      data: {
        status: nextStatus,
        deliveryGroupId: null,
        pendingRescheduleReason: `${PARTIAL_PICKUP_HOLD_REASON_PREFIX}${item.reason}`,
        pendingRescheduleNote: item.note?.trim() || null,
      },
    });

    if (detached.count !== 1) {
      throw splitConflict();
    }

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: member.id,
        statusGroup: 'RESERVATION',
        oldStatus: member.status,
        newStatus: nextStatus,
        changedBy: input.driverUserId,
        note: noteParts.join(': '),
      },
    });

    if (nextStatus === 'AWAITING_RESOLUTION') {
      if (!member.ownerId) {
        throw splitConflict();
      }
      const structuredNote = [
        'PARTIAL_PICKUP_INCIDENT',
        `originalDeliveryId=${input.deliveryId}`,
        `originalDeliveryGroupId=${input.deliveryGroupId}`,
        `reason=${item.reason}`,
        item.note ? `driverNote=${item.note}` : null,
      ]
        .filter(Boolean)
        .join('; ');

      const reportData = {
        reservationId: member.id,
        deliveryId: input.deliveryId,
        reporterUserId: input.driverUserId,
        targetUserId: member.ownerId,
        targetRole: 'SUPPLIER' as const,
        reasonCode: 'PICKUP_FAILED' as const,
        note: structuredNote,
        reporterReasonDetail: item.reason,
        reporterNote: item.note?.trim() || null,
        pickupWindowStart: member.supplierPickupWindowStart,
        pickupWindowEnd: member.supplierPickupWindowEnd,
      };
      await upsertNoShowReportByIncidentKey(tx, {
        key: {
          reservationId: member.id,
          deliveryId: input.deliveryId,
          targetRole: 'SUPPLIER',
          targetUserId: member.ownerId,
          reasonCode: 'PICKUP_FAILED',
        },
        create: reportData,
        update: {
          deliveryId: input.deliveryId,
          reporterUserId: input.driverUserId,
          targetRole: 'SUPPLIER',
          reasonCode: 'PICKUP_FAILED',
          note: structuredNote,
          reporterReasonDetail: item.reason,
          reporterNote: item.note?.trim() || null,
          pickupWindowStart: member.supplierPickupWindowStart,
          pickupWindowEnd: member.supplierPickupWindowEnd,
          status: 'PENDING_REVIEW',
          reviewedById: null,
          reviewedAt: null,
          reviewNote: null,
        },
      });
    }
  }

  // Group stays ASSIGNED to the same driver with only picked members remaining.
  const remaining = await tx.reservation.findMany({
    where: {
      deliveryGroupId: input.deliveryGroupId,
    },
    select: { id: true, status: true, fulfillmentMethod: true },
  });

  const pickedIdSet = new Set(input.pickedIds);
  if (
    remaining.length !== pickedIdSet.size ||
    remaining.some(
      (reservation) =>
        reservation.status !== 'ACCEPTED' ||
        reservation.fulfillmentMethod !== 'DELIVERY' ||
        !pickedIdSet.has(reservation.id),
    )
  ) {
    throw splitConflict();
  }

  const groupUpdate = await tx.deliveryGroup.updateMany({
    where: {
      id: input.deliveryGroupId,
      status: 'ASSIGNED',
      assignedDriverProfileId: input.driverProfileId,
    },
    data: {
      status: 'ASSIGNED',
      assignedDriverProfileId: input.driverProfileId,
    },
  });

  if (groupUpdate.count !== 1) {
    throw splitConflict();
  }
};

export const assertDeliveryAssignableForPartialPickup = (input: {
  deliveryStatus: DeliveryStatus;
  assignedDriverProfileId: string | null;
  expectedDriverProfileId: string;
  deliveryGroupId: string | null;
  deliveryGroupAssignedDriverProfileId: string | null;
}) => {
  if (input.deliveryStatus !== 'ARRIVED_PICKUP') {
    return 'INVALID_TRANSITION' as const;
  }

  if (input.assignedDriverProfileId !== input.expectedDriverProfileId) {
    return 'SPLIT_CONFLICT' as const;
  }

  if (!input.deliveryGroupId) {
    return 'SELECTION_INVALID' as const;
  }

  if (
    input.deliveryGroupAssignedDriverProfileId !== input.expectedDriverProfileId
  ) {
    return 'SPLIT_CONFLICT' as const;
  }

  return null;
};
