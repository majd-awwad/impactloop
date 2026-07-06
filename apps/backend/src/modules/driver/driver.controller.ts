import type { Request, Response } from 'express';

import { readValidatedParams, readValidatedQuery } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  acceptDelivery,
  createDeliveryLocationPing,
  listActiveDriverDeliveries,
  listAvailableDeliveries,
  updateDriverDeliveryStatus,
} from './driver.service.js';
import type {
  CreateDeliveryLocationPingInput,
  DeliveryIdParams,
  ListAvailableDeliveriesQuery,
  UpdateDriverDeliveryStatusInput,
} from './driver.validation.js';

export const listAvailableDriverDeliveriesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<ListAvailableDeliveriesQuery>(req);
  const result = await listAvailableDeliveries(req.auth!.sub, query);

  res.json(successResponse('Available deliveries loaded.', result));
};

export const listActiveDriverDeliveriesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listActiveDriverDeliveries(req.auth!.sub);

  res.json(successResponse('Active deliveries loaded.', result));
};

export const acceptDriverDeliveryHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const delivery = await acceptDelivery(req.auth!.sub, id);

  res.json(successResponse('Delivery accepted.', delivery));
};

export const updateDriverDeliveryStatusHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const delivery = await updateDriverDeliveryStatus(
    req.auth!.sub,
    id,
    req.body as UpdateDriverDeliveryStatusInput,
  );

  res.json(successResponse('Delivery status updated.', delivery));
};

export const createDriverDeliveryLocationPingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const ping = await createDeliveryLocationPing(
    req.auth!.sub,
    id,
    req.body as CreateDeliveryLocationPingInput,
  );

  res.status(201).json(successResponse('Location ping stored.', ping));
};
