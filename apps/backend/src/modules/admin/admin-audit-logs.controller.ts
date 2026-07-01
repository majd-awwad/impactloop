import type { Request, Response } from 'express';

import { readValidatedQuery } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import { listAdminActivityLogs } from './admin-activity-log.js';
import type { AdminAuditLogsListQuery } from './admin-audit-logs.validation.js';

export const listAdminAuditLogs = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminAuditLogsListQuery>(req);
  const result = await listAdminActivityLogs(query);
  res.json(successResponse('Admin audit logs loaded', result));
};
