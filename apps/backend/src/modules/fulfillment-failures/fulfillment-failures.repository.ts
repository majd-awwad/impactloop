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

const terminalDeliveryStatuses = [
  'DELIVERED',
  'CANCELLED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
] as const satisfies readonly DeliveryStatus[];

export const releaseDriverFromDelivery = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryId: string;
    driverProfileId: string;
    releaseReason: string;
  },
) => {
  await tx.deliveryAssignment.updateMany({
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

  await tx.driverProfile.update({
    where: { id: input.driverProfileId },
    data: { availability: 'AVAILABLE' },
  });
};

export const markLearnerPickupNoShow = async (input: {
  ownerId: string;
  reservationId: string;
  reasonCode: 'LEARNER_DID_NOT_ARRIVE' | 'OTHER';
  note?: string;
}) =>
  runSerializableTransaction(async (tx) => {
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

    const duplicate = await tx.noShowReport.findUnique({
      where: {
        reservationId_targetUserId: {
          reservationId: existing.id,
          targetUserId: existing.requesterId,
        },
      },
    });

    if (duplicate) {
      return { outcome: 'DUPLICATE' as const };
    }

    await tx.noShowReport.create({
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
        note: input.note?.trim() || 'Learner no-show after pickup window',
      },
    });

    await recomputeAndUpdateMaterialStatus(tx, existing.materialId);

    return { outcome: 'UPDATED' as const, reservation };
  });

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

    if (!existing.supplierPickupWindowEnd) {
      return { outcome: 'MISSING_WINDOW' as const };
    }

    const now = new Date();

    if (
      !isAfterWindowWithGrace(
        now,
        existing.supplierPickupWindowEnd,
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
        note: 'Delivery pickup window expired',
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
      const duplicate = await tx.noShowReport.findUnique({
        where: {
          reservationId_targetUserId: {
            reservationId: delivery.reservationId,
            targetUserId: driverUserId,
          },
        },
      });

      if (!duplicate) {
        await tx.noShowReport.create({
          data: {
            reservationId: delivery.reservationId,
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
        note: 'Driver no-show at supplier pickup',
      },
    });

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

    await releaseDriverFromDelivery(tx, {
      deliveryId: delivery.id,
      driverProfileId: profile.id,
      releaseReason: 'Pickup failed',
    });

    const updatedDelivery = await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'FAILED_PICKUP',
        assignedDriverProfileId: null,
        failedAt: now,
        failureReason: failureNote,
        driverNote: input.note?.trim() || delivery.driverNote,
      },
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
        changedBy: input.driverUserId,
        note: 'Pickup failed at supplier',
      },
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

    const updatedDelivery = await tx.delivery.update({
      where: { id: delivery.id },
      data: {
        status: newDeliveryStatus,
        failedAt: now,
        failureReason: failureNote,
        driverNote: input.note?.trim() || delivery.driverNote,
      },
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

    const reservation = await tx.reservation.update({
      where: { id: delivery.reservationId },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus: delivery.reservation.status as ReservationStatus,
        newStatus: 'AWAITING_RESOLUTION',
        changedBy: input.driverUserId,
        note: 'Delivery failed after pickup',
      },
    });

    await releaseDriverFromDelivery(tx, {
      deliveryId: delivery.id,
      driverProfileId: profile.id,
      releaseReason: 'Delivery failed',
    });

    return {
      outcome: 'UPDATED' as const,
      reservation,
      delivery: updatedDelivery,
    };
  });

export const isTerminalDeliveryStatus = (status: DeliveryStatus) =>
  (terminalDeliveryStatuses as readonly DeliveryStatus[]).includes(status);
