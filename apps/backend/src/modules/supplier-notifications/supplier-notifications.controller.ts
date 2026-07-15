import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';
import { readValidatedQuery } from '../../middlewares/validate.middleware.js';

import * as supplierNotificationsRepository from './supplier-notifications.repository.js';
import {
  listCanonicalSupplierNotifications,
} from './supplier-notifications.service.js';
import type { SupplierNotificationsQuery } from './supplier-notifications.validation.js';

export const listSupplierActionNotificationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listCanonicalSupplierNotifications(
    req.auth!.sub,
    readValidatedQuery<SupplierNotificationsQuery>(req),
  );

  res.json(successResponse('Supplier notifications loaded.', result));
};

export const markSupplierNotificationReadHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const updated = await supplierNotificationsRepository.markSupplierNotificationRead({
    userId: req.auth!.sub,
    notificationId: String(req.params.id),
  });
  if (!updated) throw new AppError('Notification not found.', 404, 'NOT_FOUND');
  res.json(successResponse('Notification marked as read.', { updated: true }));
};

export const markAllSupplierNotificationsReadHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const updatedCount = await supplierNotificationsRepository.markAllSupplierNotificationsRead(req.auth!.sub);
  res.json(successResponse('Supplier notifications marked as read.', { updatedCount }));
};

export const getSupplierNotificationUnreadCountHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const unreadCount = await supplierNotificationsRepository.countUnreadSupplierNotifications(req.auth!.sub);
  res.json(successResponse('Supplier notification unread count loaded.', { unreadCount }));
};
