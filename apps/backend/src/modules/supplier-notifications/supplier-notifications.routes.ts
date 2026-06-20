import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { listSupplierActionNotificationsHandler } from './supplier-notifications.controller.js';

export const supplierNotificationsRouter = Router();

supplierNotificationsRouter.get(
  '/',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(listSupplierActionNotificationsHandler),
);
