import type { Request, Response } from 'express';

import { readValidatedParams } from '../../middlewares/validate.middleware.js';
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
  UpdateDriverDeliveryStatusInput,
} from './driver.validation.js';

export const listAvailableDriverDeliveriesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const deliveries = await listAvailableDeliveries(req.auth!.sub);

  res.json(successResponse('Available deliveries loaded.', { deliveries }));
};

export const listActiveDriverDeliveriesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const deliveries = await listActiveDriverDeliveries(req.auth!.sub);

  res.json(successResponse('Active deliveries loaded.', { deliveries }));
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
