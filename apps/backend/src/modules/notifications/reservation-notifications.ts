import { prisma } from '../../database/prisma.js';

import { createNotification } from './notifications.repository.js';

const reservationContextSelect = {
  id: true,
  status: true,
  requesterId: true,
  ownerId: true,
  material: { select: { title: true } },
  requester: { select: { displayName: true } },
} as const;

type ReservationContext = {
  id: string;
  status: string;
  requesterId: string;
  ownerId: string;
  material: { title: string };
  requester: { displayName: string };
};

const loadReservationContext = async (reservationId: string) =>
  prisma.reservation.findUnique({
    where: { id: reservationId },
    select: reservationContextSelect,
  });

const materialLabel = (reservation: ReservationContext) =>
  reservation.material.title.trim() || 'your material';

const learnerLabel = (reservation: ReservationContext) =>
  reservation.requester.displayName.trim() || 'A learner';

const notifySafely = async (task: () => Promise<unknown>) => {
  try {
    await task();
  } catch (error) {
    console.error('[notifications] reservation notification failed', error);
  }
};

export const notifyReservationCreated = async (reservationId: string) =>
  notifySafely(async () => {
    const reservation = await loadReservationContext(reservationId);
    if (!reservation) {
      return;
    }

    await createNotification({
      userId: reservation.ownerId,
      notificationType: 'RESERVATION_REQUESTED',
      title: 'New reservation request',
      body: `${learnerLabel(reservation)} requested ${materialLabel(reservation)}.`,
      relatedEntityType: 'RESERVATION',
      relatedEntityId: reservation.id,
    });
  });

export const notifyReservationAccepted = async (reservationId: string) =>
  notifySafely(async () => {
    const reservation = await loadReservationContext(reservationId);
    if (!reservation) {
      return;
    }

    const awaitingConfirmation =
      reservation.status === 'AWAITING_LEARNER_CONFIRMATION';

    await createNotification({
      userId: reservation.requesterId,
      notificationType: awaitingConfirmation
        ? 'RESERVATION_SCHEDULING_PROPOSAL'
        : 'RESERVATION_ACCEPTED',
      title: awaitingConfirmation
        ? 'Supplier proposed a new time'
        : 'Reservation accepted',
      body: awaitingConfirmation
        ? `Review the supplier proposal for ${materialLabel(reservation)}.`
        : `${materialLabel(reservation)} was accepted. Check your pickup or delivery details.`,
      relatedEntityType: 'RESERVATION',
      relatedEntityId: reservation.id,
    });
  });

export const notifyReservationDeclined = async (reservationId: string) =>
  notifySafely(async () => {
    const reservation = await loadReservationContext(reservationId);
    if (!reservation) {
      return;
    }

    await createNotification({
      userId: reservation.requesterId,
      notificationType: 'RESERVATION_DECLINED',
      title: 'Reservation declined',
      body: `Your request for ${materialLabel(reservation)} was declined.`,
      relatedEntityType: 'RESERVATION',
      relatedEntityId: reservation.id,
    });
  });

export const notifyReservationCancelledByLearner = async (
  reservationId: string,
) =>
  notifySafely(async () => {
    const reservation = await loadReservationContext(reservationId);
    if (!reservation) {
      return;
    }

    await createNotification({
      userId: reservation.ownerId,
      notificationType: 'RESERVATION_CANCELLED',
      title: 'Reservation cancelled',
      body: `${learnerLabel(reservation)} cancelled the request for ${materialLabel(reservation)}.`,
      relatedEntityType: 'RESERVATION',
      relatedEntityId: reservation.id,
    });
  });

export const notifyReservationsExpired = async (reservationIds: string[]) => {
  if (reservationIds.length === 0) {
    return;
  }

  await notifySafely(async () => {
    const reservations = await prisma.reservation.findMany({
      where: { id: { in: reservationIds } },
      select: reservationContextSelect,
    });

    await Promise.all(
      reservations.flatMap((reservation) => [
        createNotification({
          userId: reservation.requesterId,
          notificationType: 'RESERVATION_EXPIRED',
          title: 'Reservation expired',
          body: `Your request for ${materialLabel(reservation)} expired before the supplier responded.`,
          relatedEntityType: 'RESERVATION',
          relatedEntityId: reservation.id,
        }),
        createNotification({
          userId: reservation.ownerId,
          notificationType: 'RESERVATION_EXPIRED',
          title: 'Reservation expired',
          body: `The pending request from ${learnerLabel(reservation)} for ${materialLabel(reservation)} expired.`,
          relatedEntityType: 'RESERVATION',
          relatedEntityId: reservation.id,
        }),
      ]),
    );
  });
};

export const notifyNoDriverSupplierRescheduleRequested = async (
  reservationId: string,
  adminNote?: string,
) =>
  notifySafely(async () => {
    const reservation = await loadReservationContext(reservationId);
    if (!reservation) {
      return;
    }

    const noteSuffix = adminNote?.trim()
      ? ` Admin note: ${adminNote.trim()}`
      : '';

    await createNotification({
      userId: reservation.ownerId,
      notificationType: 'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED',
      title: 'Choose a new pickup window',
      body:
        'No driver was available. Please choose a new pickup window if the material is still available.'
        + noteSuffix,
      relatedEntityType: 'RESERVATION',
      relatedEntityId: reservation.id,
    });
  });
