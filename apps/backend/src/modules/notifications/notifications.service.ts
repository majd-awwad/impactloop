import { AppError } from '../../utils/app-error.js';

import * as notificationsRepository from './notifications.repository.js';
import type { ListNotificationsQuery } from './notifications.validation.js';

type NotificationRow = Awaited<
  ReturnType<typeof notificationsRepository.findNotificationsForUser>
>['items'][number];

const normalizePage = (page: number) =>
  Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

const normalizeLimit = (limit: number) => {
  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(50, Math.max(1, Math.floor(limit)));
};

const safeNotificationType = (value: unknown) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'GENERAL';
  }

  return value.trim();
};

const safeString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') {
    return fallback;
  }

  return value;
};

const safeNullableString = (value: unknown) => {
  if (value == null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const safeCreatedAt = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return new Date(0).toISOString();
};

const mapNotification = (notification: NotificationRow) => ({
  id: safeString(notification.id, 'unknown-notification'),
  notificationType: safeNotificationType(notification.notificationType),
  title: safeString(notification.title, 'Notification').trim() || 'Notification',
  body: safeString(notification.body, ''),
  relatedEntityType: safeNullableString(notification.relatedEntityType),
  relatedEntityId: safeNullableString(notification.relatedEntityId),
  isRead: notification.isRead === true,
  createdAt: safeCreatedAt(notification.createdAt),
});

export const listMyNotifications = async (
  userId: string,
  query: ListNotificationsQuery,
) => {
  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);

  const result = await notificationsRepository.findNotificationsForUser({
    userId,
    isRead: query.isRead,
    page,
    limit,
  });

  const totalPages = Math.ceil(result.total / limit) || 0;

  return {
    items: result.items.map(mapNotification),
    unreadCount: result.unreadCount,
    pagination: {
      page,
      limit,
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