import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  getMyNotificationUnreadCount,
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from './notifications.service.js';
import type { ListNotificationsQuery } from './notifications.validation.js';

export const listMyNotificationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await listMyNotifications(
    req.auth!.sub,
    req.query as unknown as ListNotificationsQuery,
  );

  res.json(successResponse('Notifications loaded.', data));
};

export const getMyNotificationUnreadCountHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await getMyNotificationUnreadCount(req.auth!.sub);

  res.json(successResponse('Unread notification count loaded.', data));
};

export const markMyNotificationReadHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const notification = await markMyNotificationRead(
    req.auth!.sub,
    req.params.id,
  );

  res.json(successResponse('Notification marked as read.', { notification }));
};

export const markAllMyNotificationsReadHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await markAllMyNotificationsRead(req.auth!.sub);

  res.json(successResponse('Notifications marked as read.', data));
};
