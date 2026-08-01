import type { Request, Response } from 'express';

import {
  readValidatedParams,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  getLearnerDeliveryTracking,
  getMyDelivery,
  listMyDeliveries,
  requestDeliveryForReservation,
} from './deliveries.service.js';
import type {
  DeliveryIdParams,
  RequestDeliveryInput,
  ReservationIdParams,
} from './deliveries.validation.js';

export const requestDeliveryForReservationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const delivery = await requestDeliveryForReservation(
    req.auth!.sub,
    id,
    req.body as RequestDeliveryInput,
  );

  res.status(201).json(successResponse('Delivery requested.', delivery));
};

export const listMyDeliveriesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const deliveries = await listMyDeliveries(req.auth!.sub);

  res.json(successResponse('Deliveries loaded.', { deliveries }));
};

export const getLearnerDeliveryTrackingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const tracking = await getLearnerDeliveryTracking(req.auth!.sub, id);

  res.json(successResponse('Delivery tracking loaded.', tracking));
};

export const getMyDeliveryHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const delivery = await getMyDelivery(req.auth!.sub, id);

  res.json(successResponse('Delivery loaded.', delivery));
};
