import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';

import {
  preflightAdminReservationsExport,
  streamAdminReservationsExport,
} from './admin-reservations.export.js';
import {
  getAdminReservationById,
  listAdminReservations,
} from './admin-reservations.service.js';
import type {
  AdminReservationIdParams,
  AdminReservationsExportDownloadQuery,
  AdminReservationsExportFilters,
  AdminReservationsListQuery,
} from './admin-reservations.validation.js';

export const listAdminReservationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminReservationsListQuery>(req);
  const result = await listAdminReservations(query);
  res.json(successResponse('Admin reservations loaded', result));
};

export const preflightAdminReservationsExportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const filters = readValidatedQuery<AdminReservationsExportFilters>(req);
  const result = await preflightAdminReservationsExport(filters);
  res.json(successResponse('Reservation export preflight loaded', result));
};

export const exportAdminReservationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminReservationsExportDownloadQuery>(req);
  await streamAdminReservationsExport({
    res,
    filters: query,
    actorUserId: req.auth!.sub,
  });
};

export const getAdminReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminReservationIdParams>(req);
  const result = await getAdminReservationById(id);
  res.json(successResponse('Admin reservation loaded', result));
};