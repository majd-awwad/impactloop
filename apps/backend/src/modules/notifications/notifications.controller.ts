import type { Request, Response } from 'express';

import { readValidatedParams, readValidatedQuery } from '../../middlewares/validate.middleware.js';
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
  const query = readValidatedQuery<ListNotificationsQuery>(req);
  const data = await listMyNotifications(req.auth!.sub, query);

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
  const { id } = readValidatedParams<{ id: string }>(req);
  const notification = await markMyNotificationRead(req.auth!.sub, id);

  res.json(successResponse('Notification marked as read.', { notification }));
};

export const markAllMyNotificationsReadHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await markAllMyNotificationsRead(req.auth!.sub);

  res.json(successResponse('Notifications marked as read.', data));
};
