import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { buildAdminImpactAnalytics } from './admin-impact.service.js';
import { buildAdminDashboard } from './admin.service.js';

export const getAdminDashboard = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const dashboard = await buildAdminDashboard();
  res.json(successResponse('Admin dashboard loaded', dashboard));
};

export const getAdminImpactAnalytics = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const impact = await buildAdminImpactAnalytics();
  res.json(successResponse('Admin impact analytics loaded', impact));
};


