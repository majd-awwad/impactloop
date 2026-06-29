import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  cancelReservation,
  createReservation,
  listMyReservations,
} from './reservations.service.js';
import type { CreateReservationInput } from './reservations.validation.js';

export const createReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservation = await createReservation(
    req.auth!.sub,
    req.body as CreateReservationInput,
  );

  res
    .status(201)
    .json(successResponse('Reservation requested.', reservation));
};

export const listMyReservationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservations = await listMyReservations(req.auth!.sub);

  res.json(successResponse('Reservations loaded.', { reservations }));
};

export const cancelReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const reservation = await cancelReservation(
    req.auth!.sub,
    req.params.id as string,
  );

  res.json(successResponse('Reservation cancelled.', reservation));
};
