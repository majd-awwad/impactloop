import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  getAdminReservationById,
  listAdminReservations,
} from './admin-reservations.service.js';
import type {
  AdminReservationIdParams,
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

export const getAdminReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminReservationIdParams>(req);
  const result = await getAdminReservationById(id);
  res.json(successResponse('Admin reservation loaded', result));
};
