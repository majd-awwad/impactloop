import { prisma } from '../../database/prisma.js';

import { createNotification } from './notifications.repository.js';
import {
  safeActorDisplayName,
  sanitizeNotificationPreview,
} from './notification-preview.js';

export const RESERVATION_MESSAGE_NOTIFICATION_TYPE =
  'RESERVATION_MESSAGE_RECEIVED';

const notifySafely = async (task: () => Promise<unknown>) => {
  try {
    await task();
  } catch (error) {
    console.error('[notifications] reservation message notification failed', error);
  }
};

export const notifyReservationMessageReceived = async (input: {
  reservationId: string;
  messageId: string;
  senderUserId: string;
  senderDisplayName: string;
  body: string;
}) =>
  notifySafely(async () => {
    const reservation = await prisma.reservation.findUnique({
      where: { id: input.reservationId },
      select: {
        id: true,
        requesterId: true,
        ownerId: true,
        material: { select: { title: true } },
      },
    });

    if (!reservation) {
      return;
    }

    const recipientId =
      input.senderUserId === reservation.requesterId
        ? reservation.ownerId
        : input.senderUserId === reservation.ownerId
          ? reservation.requesterId
          : null;

    if (!recipientId || recipientId === input.senderUserId) {
      return;
    }

    const preview = sanitizeNotificationPreview(input.body);
    if (!preview) {
      return;
    }

    const actorName = safeActorDisplayName(input.senderDisplayName);
    const materialTitle = reservation.material.title.trim() || 'your material';

    await createNotification({
      userId: recipientId,
      notificationType: RESERVATION_MESSAGE_NOTIFICATION_TYPE,
      title: 'New message about your reservation',
      body: `${actorName}: ${preview}`,
      relatedEntityType: 'RESERVATION',
      relatedEntityId: reservation.id,
      eventKey: `reservation:message:${input.messageId}:${recipientId}`,
      entityType: 'RESERVATION',
      entityId: reservation.id,
      actionType: 'OPEN_RESERVATION',
      actorId: input.senderUserId,
      metadata: {
        materialTitle,
        actorDisplayName: actorName,
        messagePreview: preview,
        messageId: input.messageId,
      },
    });
  });
