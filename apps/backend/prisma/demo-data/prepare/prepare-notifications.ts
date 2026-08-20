import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import { createSupplierReservationMessage } from '../../../src/modules/supplier-reservations/supplier-reservations.service.js';
import { createComment } from '../../../src/modules/comments/comments.service.js';
import { createLearnerMaterialRequest } from '../../../src/modules/learner-material-requests/learner-material-requests.service.js';
import type { AccessTokenPayload } from '../../../src/utils/jwt.js';
import { createNotificationIfMissing } from '../../../src/modules/notifications/notifications.repository.js';
import { reservationAllowsMessaging } from '../../../src/modules/reservations/reservation-follow-up.js';
import { MAJD_LEARNER_EMAIL, redact } from './local-demo-accounts.js';

export const NOTIFICATION_DEMO_TAG = 'fig-3.34';
const MESSAGE_BODY =
  'The motors are packed and ready. Please confirm you can collect them this afternoon.';
const COMMENT_BODY =
  'The obstacle-avoidance steps are really clear — especially the sensor wiring.';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const asMetadata = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

export const notificationHasDemoTag = (metadata: unknown): boolean =>
  asMetadata(metadata).localDemoTag === NOTIFICATION_DEMO_TAG;

const learnerViewer = (userId: string): AccessTokenPayload => ({
  sub: userId,
  roles: ['LEARNER'],
});

async function stampNotification(
  notificationId: string,
  input: { createdAt: Date; isRead: boolean; extraMetadata?: Record<string, unknown> },
) {
  const existing = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { metadata: true },
  });
  if (!existing) {
    return;
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      createdAt: input.createdAt,
      isRead: input.isRead,
      readAt: input.isRead ? input.createdAt : null,
      metadata: {
        ...asMetadata(existing.metadata),
        localDemoTag: NOTIFICATION_DEMO_TAG,
        ...(input.extraMetadata ?? {}),
      },
    },
  });
}

type PreparedRow = {
  id: string;
  type: string;
  read: 'unread' | 'read';
  destination: string;
  tapFor335?: boolean;
  created: boolean;
};

export async function prepareNotificationDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'notification demo prep');

  const learner = await prisma.user.findUnique({
    where: { email: MAJD_LEARNER_EMAIL },
    select: { id: true, displayName: true, email: true },
  });
  if (!learner) {
    throw new Error(`Primary screenshot account ${MAJD_LEARNER_EMAIL} was not found.`);
  }

  const commenter = await prisma.user.findFirst({
    where: {
      email: { not: MAJD_LEARNER_EMAIL },
      roles: { some: { role: 'LEARNER' } },
      accountStatus: 'ACTIVE',
    },
    select: { id: true, displayName: true, email: true },
    orderBy: { createdAt: 'asc' },
  });

  const prepared: PreparedRow[] = [];

  const reservation = await prisma.reservation.findFirst({
    where: {
      requesterId: learner.id,
      status: { in: ['ACCEPTED', 'PENDING', 'AWAITING_LEARNER_CONFIRMATION'] },
    },
    include: {
      owner: { select: { id: true, displayName: true } },
      material: { select: { title: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!reservation || !reservationAllowsMessaging(reservation.status)) {
    throw new Error('No messageable reservation found for Majd Learner.');
  }

  const existingMessageNote = await prisma.notification.findFirst({
    where: {
      userId: learner.id,
      notificationType: 'RESERVATION_MESSAGE_RECEIVED',
      relatedEntityId: reservation.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  let messageNotificationId = existingMessageNote?.id ?? null;
  let createdMessage = false;
  if (!messageNotificationId) {
    await createSupplierReservationMessage(reservation.ownerId, reservation.id, {
      body: MESSAGE_BODY,
    });
    const created = await prisma.notification.findFirst({
      where: {
        userId: learner.id,
        notificationType: 'RESERVATION_MESSAGE_RECEIVED',
        relatedEntityId: reservation.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    messageNotificationId = created?.id ?? null;
    createdMessage = true;
  }
  if (!messageNotificationId) {
    throw new Error('Reservation message notification was not created.');
  }
  await stampNotification(messageNotificationId, {
    createdAt: minutesAgo(8),
    isRead: false,
  });
  prepared.push({
    id: messageNotificationId,
    type: 'RESERVATION_MESSAGE_RECEIVED',
    read: 'unread',
    destination: `/learner/reservations/${reservation.id}?focus=messages`,
    tapFor335: true,
    created: createdMessage,
  });

  const project = await prisma.learningProject.findFirst({
    where: {
      createdBy: learner.id,
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
    },
    select: { id: true, title: true },
    orderBy: { createdAt: 'desc' },
  });
  if (project && commenter) {
    const existingCommentNote = await prisma.notification.findFirst({
      where: {
        userId: learner.id,
        notificationType: 'PROJECT_COMMENT_RECEIVED',
        relatedEntityId: project.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    let commentNotificationId = existingCommentNote?.id ?? null;
    let createdComment = false;
    if (!commentNotificationId) {
      await createComment(
        'learningProject',
        project.id,
        { body: COMMENT_BODY },
        learnerViewer(commenter.id),
      );
      const created = await prisma.notification.findFirst({
        where: {
          userId: learner.id,
          notificationType: 'PROJECT_COMMENT_RECEIVED',
          relatedEntityId: project.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      commentNotificationId = created?.id ?? null;
      createdComment = true;
    }
    if (commentNotificationId) {
      await stampNotification(commentNotificationId, {
        createdAt: minutesAgo(22),
        isRead: false,
      });
      prepared.push({
        id: commentNotificationId,
        type: 'PROJECT_COMMENT_RECEIVED',
        read: 'unread',
        destination: `/learning/${project.id}?focus=comments`,
        created: createdComment,
      });
    }
  }

  let materialRequest = await prisma.learnerMaterialRequest.findFirst({
    where: { learnerId: learner.id },
    select: { id: true, requestedItemName: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!materialRequest) {
    const category = await prisma.category.findFirst({
      where: { isActive: true, categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    if (category) {
      const createdRequest = await createLearnerMaterialRequest(learner.id, {
        requestedItemName: 'Ultrasonic distance sensor',
        categoryId: category.id,
        description:
          'Need an HC-SR04 or similar sensor for the obstacle-avoidance robot.',
        quantity: 1,
        unit: 'pcs',
        alternativesAllowed: true,
        locationCountry: 'Palestine',
        locationCity: 'Nablus',
        locationArea: null,
      });
      materialRequest = {
        id: createdRequest.id,
        requestedItemName: createdRequest.requestedItemName,
      };
    }
  }
  if (materialRequest) {
    const existingSuggestion = await prisma.notification.findFirst({
      where: {
        userId: learner.id,
        notificationType: 'MATERIAL_REQUEST_SUGGESTION',
        relatedEntityId: materialRequest.id,
      },
    });
    const suggestion =
      existingSuggestion ??
      (await createNotificationIfMissing({
        userId: learner.id,
        notificationType: 'MATERIAL_REQUEST_SUGGESTION',
        title: 'New material suggestion',
        body: `A supplier suggested a material for your request "${materialRequest.requestedItemName}".`,
        relatedEntityType: 'MATERIAL_REQUEST',
        relatedEntityId: materialRequest.id,
        eventKey: `mr:suggest:local-demo:${materialRequest.id}`,
        entityType: 'MATERIAL_REQUEST',
        entityId: materialRequest.id,
        actionType: 'OPEN_ENTITY',
        metadata: { requestedItemName: materialRequest.requestedItemName },
      }));
    if (suggestion) {
      await stampNotification(suggestion.id, {
        createdAt: minutesAgo(45),
        isRead: false,
        extraMetadata: { requestedItemName: materialRequest.requestedItemName },
      });
      prepared.push({
        id: suggestion.id,
        type: 'MATERIAL_REQUEST_SUGGESTION',
        read: 'unread',
        destination: `/learner/material-requests/${materialRequest.id}`,
        created: !existingSuggestion,
      });
    }
  }

  const delivery = await prisma.delivery.findFirst({
    where: { reservation: { requesterId: learner.id } },
    select: { id: true, scheduleOccurrence: true },
    orderBy: { requestedAt: 'desc' },
  });
  if (delivery) {
    const existingDelivery = await prisma.notification.findFirst({
      where: {
        userId: learner.id,
        notificationType: {
          in: ['DELIVERY_WINDOW_SCHEDULED', 'DELIVERY_WINDOW_RESCHEDULED'],
        },
        relatedEntityId: delivery.id,
      },
    });
    const deliveryNote =
      existingDelivery ??
      (await createNotificationIfMissing({
        userId: learner.id,
        notificationType: 'DELIVERY_WINDOW_SCHEDULED',
        title: 'Delivery scheduled',
        body: 'Your delivery window has been scheduled.',
        relatedEntityType: 'DELIVERY',
        relatedEntityId: delivery.id,
        eventKey: `delivery-window:${delivery.id}:${delivery.scheduleOccurrence}:${learner.id}`,
        entityType: 'DELIVERY',
        entityId: delivery.id,
        metadata: { scheduleOccurrence: delivery.scheduleOccurrence },
      }));
    if (deliveryNote) {
      await stampNotification(deliveryNote.id, {
        createdAt: minutesAgo(80),
        isRead: false,
      });
      prepared.push({
        id: deliveryNote.id,
        type: deliveryNote.notificationType,
        read: 'unread',
        destination: `/learner/deliveries/${delivery.id}`,
        created: !existingDelivery,
      });
    }
  }

  const accepted = await prisma.notification.findFirst({
    where: {
      userId: learner.id,
      notificationType: 'RESERVATION_ACCEPTED',
    },
    orderBy: { createdAt: 'desc' },
  });
  if (accepted?.relatedEntityId) {
    await stampNotification(accepted.id, {
      createdAt: minutesAgo(180),
      isRead: true,
    });
    prepared.push({
      id: accepted.id,
      type: 'RESERVATION_ACCEPTED',
      read: 'read',
      destination: `/learner/reservations/${accepted.relatedEntityId}`,
      created: false,
    });
  } else if (reservation) {
    const created = await createNotificationIfMissing({
      userId: learner.id,
      notificationType: 'RESERVATION_ACCEPTED',
      title: 'Reservation accepted',
      body: `${reservation.material.title} was accepted. Check your pickup or delivery details.`,
      relatedEntityType: 'RESERVATION',
      relatedEntityId: reservation.id,
      eventKey: `reservation:accepted:${reservation.id}:${learner.id}`,
      entityType: 'RESERVATION',
      entityId: reservation.id,
      actionType: 'OPEN_RESERVATION',
      metadata: { materialTitle: reservation.material.title },
    });
    if (created) {
      await stampNotification(created.id, {
        createdAt: minutesAgo(180),
        isRead: true,
      });
      prepared.push({
        id: created.id,
        type: 'RESERVATION_ACCEPTED',
        read: 'read',
        destination: `/learner/reservations/${reservation.id}`,
        created: true,
      });
    }
  }

  if (project) {
    const existingModeration = await prisma.notification.findFirst({
      where: {
        userId: learner.id,
        notificationType: 'LEARNING_PROJECT_MODERATION',
        relatedEntityId: project.id,
      },
    });
    const moderation =
      existingModeration ??
      (await prisma.notification.create({
        data: {
          userId: learner.id,
          notificationType: 'LEARNING_PROJECT_MODERATION',
          title: 'Project approved',
          body: `${project.title} was approved and is now visible in the Learning Hub.`,
          relatedEntityType: 'LEARNING_PROJECT',
          relatedEntityId: project.id,
          entityType: 'LEARNING_PROJECT',
          entityId: project.id,
          actionType: 'OPEN_LEARNING_PROJECT_SUBMISSION',
          eventKey: `local-demo:project-moderation:${project.id}`,
          metadata: {
            projectTitle: project.title,
            moderationEvent: 'APPROVED',
            localDemoTag: NOTIFICATION_DEMO_TAG,
          },
        },
      }));
    await stampNotification(moderation.id, {
      createdAt: minutesAgo(360),
      isRead: true,
      extraMetadata: {
        projectTitle: project.title,
        moderationEvent: 'APPROVED',
      },
    });
    prepared.push({
      id: moderation.id,
      type: 'LEARNING_PROJECT_MODERATION',
      read: 'read',
      destination: `/learning/submissions/${project.id}`,
      created: !existingModeration,
    });
  }

  const existingRetry = await prisma.notification.findFirst({
    where: {
      userId: learner.id,
      notificationType: 'DELIVERY_RETRY_PENDING',
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existingRetry?.relatedEntityId) {
    await stampNotification(existingRetry.id, {
      createdAt: minutesAgo(520),
      isRead: true,
    });
    prepared.push({
      id: existingRetry.id,
      type: 'DELIVERY_RETRY_PENDING',
      read: 'read',
      destination: `/learner/deliveries/${existingRetry.relatedEntityId}`,
      created: false,
    });
  }

  const keepUnreadIds = prepared
    .filter((row) => row.read === 'unread')
    .map((row) => row.id);
  if (keepUnreadIds.length > 0) {
    await prisma.notification.updateMany({
      where: {
        userId: learner.id,
        isRead: false,
        id: { notIn: keepUnreadIds },
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  const unreadCount = prepared.filter((row) => row.read === 'unread').length;
  const figure335 = prepared.find((row) => row.tapFor335);

  console.log('\nNotification demo prep complete for Majd Learner.');
  console.log(`Account: ${learner.displayName} <${learner.email}> (${redact(learner.id)})`);
  console.log(`Prepared ${prepared.length} showcase notifications (${unreadCount} unread).`);
  for (const row of prepared) {
    const flag = row.tapFor335 ? '  ← TAP THIS FOR FIGURE 3.35' : '';
    console.log(`- ${row.type} [${row.read}] → ${row.destination}${flag}`);
  }
  if (figure335) {
    console.log('Figure 3.35: open Notifications, tap the unread reservation message');
    console.log(`Destination: ${figure335.destination}`);
    console.log(`Reservation: ${reservation.material.title} (${redact(reservation.id)})`);
  }

  return {
    prepared,
    createdCount: prepared.filter((row) => row.created).length,
    reusedCount: prepared.filter((row) => !row.created).length,
  };
}
