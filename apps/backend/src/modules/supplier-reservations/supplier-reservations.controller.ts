import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedParams, readValidatedQuery } from '../../middlewares/validate.middleware.js';

import {
  acceptSupplierReservation,
  completeSupplierReservation,
  declineSupplierReservation,
  listSupplierReservations,
} from './supplier-reservations.service.js';
import type {
  AcceptSupplierReservationInput,
  DeclineSupplierReservationInput,
  ListSupplierReservationsQuery,
  ReservationIdParams,
} from './supplier-reservations.validation.js';

export const listSupplierReservationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservations = await listSupplierReservations(
    req.auth!.sub,
    readValidatedQuery<ListSupplierReservationsQuery>(req),
  );

  res.json(successResponse('Supplier reservations loaded.', { reservations }));
};

export const acceptSupplierReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await acceptSupplierReservation(
    req.auth!.sub,
    id,
    req.body as AcceptSupplierReservationInput,
  );

  res.json(successResponse('Reservation accepted.', reservation));
};

export const declineSupplierReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await declineSupplierReservation(
    req.auth!.sub,
    id,
    req.body as DeclineSupplierReservationInput,
  );

  res.json(successResponse('Reservation declined.', reservation));
};

export const completeSupplierReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await completeSupplierReservation(req.auth!.sub, id);

  res.json(successResponse('Reservation completed.', reservation));
};
