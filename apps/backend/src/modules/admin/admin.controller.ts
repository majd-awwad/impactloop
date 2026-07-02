import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { buildAdminDashboard } from './admin.service.js';

export const getAdminDashboard = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const dashboard = await buildAdminDashboard();
  res.json(successResponse('Admin dashboard loaded', dashboard));
};


