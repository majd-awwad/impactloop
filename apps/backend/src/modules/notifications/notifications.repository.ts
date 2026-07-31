import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { ALLOWED_DRIVER_NOTIFICATION_TYPES } from './driver-delivery-notification-types.js';

const visibleNotificationWhere = (
  userId: string,
): Prisma.NotificationWhereInput => ({
  userId,
  OR: [
    { notificationType: { not: { startsWith: 'DRIVER_' } } },
    {
      notificationType: { in: [...ALLOWED_DRIVER_NOTIFICATION_TYPES] },
    },
  ],
});

export type CreateNotificationInput = {  userId: string;
  notificationType: string;
  title: string;
  body: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  eventKey?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionType?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  resolvedAt?: Date | null;
  actorId?: string | null;
};

const notificationCreateData = (input: CreateNotificationInput) => ({
  userId: input.userId,
  notificationType: input.notificationType,
  title: input.title,
  body: input.body,
  relatedEntityType: input.relatedEntityType ?? input.entityType ?? null,
  relatedEntityId: input.relatedEntityId ?? input.entityId ?? null,
  eventKey: input.eventKey ?? null,
  entityType: input.entityType ?? input.relatedEntityType ?? null,
  entityId: input.entityId ?? input.relatedEntityId ?? null,
  actionType: input.actionType ?? null,
  metadata: input.metadata ?? undefined,
  resolvedAt: input.resolvedAt ?? null,
  actorId: input.actorId ?? null,
});

export const createNotification = async (input: CreateNotificationInput) => {
  const data = notificationCreateData(input);

  if (input.eventKey) {
    return prisma.notification.upsert({
      where: { eventKey: input.eventKey },
      create: data,
      update: {},
    });
  }

  return prisma.notification.create({ data });
};

export const findNotificationForUser = async (input: {
  userId: string;
  notificationType: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}) =>
  prisma.notification.findFirst({
    where: {
      userId: input.userId,
      notificationType: input.notificationType,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
    },
    select: { id: true },
  });

export const createNotificationIfMissing = async (
  input: CreateNotificationInput,
) => {
  if (input.eventKey) {
    const row = await prisma.notification.upsert({
      where: { eventKey: input.eventKey },
      create: notificationCreateData(input),
      update: {},
    });
    return row;
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.notification.findFirst({
      where: {
        userId: input.userId,
        notificationType: input.notificationType,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
      },
      select: { id: true },
    });

    if (existing) {
      return null;
    }

    return tx.notification.create({ data: notificationCreateData(input) });
  });
};
export const findNotificationsForUser = async (input: {
  userId: string;
  isRead?: boolean;
  page: number;
  limit: number;
}) => {
  const page = Number.isFinite(input.page) ? Math.max(1, Math.floor(input.page)) : 1;
  const limit = Number.isFinite(input.limit)
    ? Math.min(50, Math.max(1, Math.floor(input.limit)))
    : 20;

  const where: Prisma.NotificationWhereInput = {
    ...visibleNotificationWhere(input.userId),
    ...(input.isRead === undefined ? {} : { isRead: input.isRead }),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { ...visibleNotificationWhere(input.userId), isRead: false },
    }),
  ]);

  return { items, total, unreadCount };
};

export const countUnreadNotificationsForUser = async (userId: string) =>
  prisma.notification.count({
    where: { ...visibleNotificationWhere(userId), isRead: false },
  });

export const markNotificationReadForUser = async (input: {
  userId: string;
  notificationId: string;
}) => {
  const existing = await prisma.notification.findFirst({
    where: {
      id: input.notificationId,
      userId: input.userId,
    },
    select: { id: true },
  });

  if (!existing) {
    return { outcome: 'NOT_FOUND' as const };
  }

  const notification = await prisma.notification.update({
    where: { id: existing.id },
    data: { isRead: true, readAt: new Date() },
  });

  return { outcome: 'UPDATED' as const, notification };
};

export const markAllNotificationsReadForUser = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });

  return result.count;
};
