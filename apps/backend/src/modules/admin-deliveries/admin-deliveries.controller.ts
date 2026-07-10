import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  getAdminDeliveryById,
  listAdminDeliveries,
  reopenAdminDeliveryDriverAssignment,
} from './admin-deliveries.service.js';
import type {
  AdminDeliveriesListQuery,
  AdminDeliveryIdParams,
} from './admin-deliveries.validation.js';

export const listAdminDeliveriesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminDeliveriesListQuery>(req);
  const result = await listAdminDeliveries(query);
  res.json(successResponse('Admin deliveries loaded', result));
};

export const getAdminDeliveryHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminDeliveryIdParams>(req);
  const result = await getAdminDeliveryById(id);
  res.json(successResponse('Admin delivery loaded', result));
};

export const reopenAdminDeliveryDriverAssignmentHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminDeliveryIdParams>(req);
  const adminUserId = req.auth!.sub;
  const result = await reopenAdminDeliveryDriverAssignment(id, adminUserId);
  res.json(successResponse('Delivery reopened to drivers', result));
};
