import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

export type CreateNotificationInput = {
  userId: string;
  notificationType: string;
  title: string;
  body: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

export const createNotification = async (input: CreateNotificationInput) =>
  prisma.notification.create({
    data: {
      userId: input.userId,
      notificationType: input.notificationType,
      title: input.title,
      body: input.body,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
    },
  });

export const findNotificationsForUser = async (input: {
  userId: string;
  isRead?: boolean;
  page: number;
  limit: number;
}) => {
  const where: Prisma.NotificationWhereInput = {
    userId: input.userId,
    ...(input.isRead === undefined ? {} : { isRead: input.isRead }),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId: input.userId, isRead: false },
    }),
  ]);

  return { items, total, unreadCount };
};

export const countUnreadNotificationsForUser = async (userId: string) =>
  prisma.notification.count({
    where: { userId, isRead: false },
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
    data: { isRead: true },
  });

  return { outcome: 'UPDATED' as const, notification };
};

export const markAllNotificationsReadForUser = async (userId: string) => {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });

  return result.count;
};
