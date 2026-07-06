import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getMyNotificationUnreadCountHandler,
  listMyNotificationsHandler,
  markAllMyNotificationsReadHandler,
  markMyNotificationReadHandler,
} from './notifications.controller.js';
import {
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
} from './notifications.validation.js';

export const notificationsRouter = Router();

notificationsRouter.get(
  '/',
  authMiddleware,
  validate(listNotificationsQuerySchema, 'query'),
  asyncHandler(listMyNotificationsHandler),
);

notificationsRouter.get(
  '/unread-count',
  authMiddleware,
  asyncHandler(getMyNotificationUnreadCountHandler),
);

notificationsRouter.patch(
  '/read-all',
  authMiddleware,
  asyncHandler(markAllMyNotificationsReadHandler),
);

notificationsRouter.patch(
  '/:id/read',
  authMiddleware,
  validate(notificationIdParamsSchema, 'params'),
  asyncHandler(markMyNotificationReadHandler),
);
