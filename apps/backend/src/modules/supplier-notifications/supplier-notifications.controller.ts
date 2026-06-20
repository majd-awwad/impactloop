import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { listSupplierActionNotifications } from './supplier-notifications.service.js';

export const listSupplierActionNotificationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { notifications, summary } = await listSupplierActionNotifications(
    req.auth!.sub,
  );

  res.json(
    successResponse('Supplier notifications loaded.', {
      notifications,
      summary,
    }),
  );
};
