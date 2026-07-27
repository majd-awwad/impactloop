import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { validate } from '../../middlewares/validate.middleware.js';

import {
  getSupplierNotificationUnreadCountHandler,
  listSupplierActionNotificationsHandler,
  markAllSupplierNotificationsReadHandler,
  markSupplierNotificationReadHandler,
} from './supplier-notifications.controller.js';
import { supplierNotificationsQuerySchema } from './supplier-notifications.validation.js';

export const supplierNotificationsRouter = Router();

supplierNotificationsRouter.get(
  '/',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(supplierNotificationsQuerySchema, 'query'),
  asyncHandler(listSupplierActionNotificationsHandler),
);

supplierNotificationsRouter.get(
  '/unread-count',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(getSupplierNotificationUnreadCountHandler),
);

supplierNotificationsRouter.patch(
  '/read-all',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(markAllSupplierNotificationsReadHandler),
);

supplierNotificationsRouter.patch(
  '/:id/read',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(markSupplierNotificationReadHandler),
);
