import { AppError } from '../../utils/app-error.js';

import * as notificationsRepository from './notifications.repository.js';
import type { ListNotificationsQuery } from './notifications.validation.js';

const mapNotification = (
  notification: Awaited<
    ReturnType<typeof notificationsRepository.findNotificationsForUser>
  >['items'][number],
) => ({
  id: notification.id,
  notificationType: notification.notificationType,
  title: notification.title,
  body: notification.body,
  relatedEntityType: notification.relatedEntityType,
  relatedEntityId: notification.relatedEntityId,
  isRead: notification.isRead,
  createdAt: notification.createdAt.toISOString(),
});

export const listMyNotifications = async (
  userId: string,
  query: ListNotificationsQuery,
) => {
  const result = await notificationsRepository.findNotificationsForUser({
    userId,
    isRead: query.isRead,
    page: query.page,
    limit: query.limit,
  });

  const totalPages = Math.ceil(result.total / query.limit) || 0;

  return {
    items: result.items.map(mapNotification),
    unreadCount: result.unreadCount,
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages,
    },
  };
};

export const getMyNotificationUnreadCount = async (userId: string) => ({
  unreadCount: await notificationsRepository.countUnreadNotificationsForUser(
    userId,
  ),
});

export const markMyNotificationRead = async (
  userId: string,
  notificationId: string,
) => {
  const result = await notificationsRepository.markNotificationReadForUser({
    userId,
    notificationId,
  });

  if (result.outcome === 'NOT_FOUND') {
    throw new AppError('Notification not found.', 404, 'NOT_FOUND');
  }

  return mapNotification(result.notification);
};

export const markAllMyNotificationsRead = async (userId: string) => {
  const updatedCount =
    await notificationsRepository.markAllNotificationsReadForUser(userId);

  return { updatedCount };
};
