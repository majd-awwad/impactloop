import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  acceptSupplierReservation,
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
    req.query as ListSupplierReservationsQuery,
  );

  res.json(successResponse('Supplier reservations loaded.', { reservations }));
};

export const acceptSupplierReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as ReservationIdParams;
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
  const { id } = req.params as ReservationIdParams;
  const reservation = await declineSupplierReservation(
    req.auth!.sub,
    id,
    req.body as DeclineSupplierReservationInput,
  );

  res.json(successResponse('Reservation declined.', reservation));
};
