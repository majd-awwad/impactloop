import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  preflightAdminDeliveriesExport,
  streamAdminDeliveriesExport,
} from './admin-deliveries.export.js';
import {
  getAdminDeliveryById,
  listAdminDeliveries,
  reopenAdminDeliveryDriverAssignment,
  finalizeOperationalReturnedDelivery,
} from './admin-deliveries.service.js';
import type {
  AdminDeliveriesExportDownloadQuery,
  AdminDeliveriesExportFilters,
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

export const preflightAdminDeliveriesExportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const filters = readValidatedQuery<AdminDeliveriesExportFilters>(req);
  const result = await preflightAdminDeliveriesExport(filters);
  res.json(successResponse('Deliveries export preflight loaded.', result));
};

export const exportAdminDeliveriesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminDeliveriesExportDownloadQuery>(req);
  await streamAdminDeliveriesExport({
    res,
    filters: query,
    actorUserId: req.auth!.sub,
  });
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

export const finalizeOperationalReturnedDeliveryHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminDeliveryIdParams>(req);
  const result = await finalizeOperationalReturnedDelivery(id, req.auth!.sub);
  res.json(successResponse('Returned delivery resolved.', result));
};
