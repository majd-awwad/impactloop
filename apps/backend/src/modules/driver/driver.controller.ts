import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  acceptDelivery,
  createDeliveryLocationPing,
  getDriverProfile,
  getDriverDeliveryDetail,
  getDriverDeliveryInactiveContext,
  listActiveDriverDeliveries,
  listAvailableDeliveries,
  updateDriverAvailability,
  updateDriverDeliveryStatus,
  updateDriverProfile,
} from './driver.service.js';
import {
  getDriverHistoricalDelivery,
  listDriverDeliveryHistory,
  listDriverIncidents,
} from './driver-history.service.js';
import type {
  CreateDeliveryLocationPingInput,
  DeliveryIdParams,
  ListAvailableDeliveriesQuery,
  UpdateDriverAvailabilityInput,
  UpdateDriverDeliveryStatusInput,
  UpdateDriverProfileInput,
  ListDriverArchiveQuery,
} from './driver.validation.js';

export const getDriverProfileHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const profile = await getDriverProfile(req.auth!.sub);
  res.json(successResponse('Driver profile loaded.', profile));
};

export const updateDriverProfileHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const profile = await updateDriverProfile(
    req.auth!.sub,
    req.body as UpdateDriverProfileInput,
  );
  res.json(successResponse('Driver profile updated.', profile));
};

export const updateDriverAvailabilityHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const profile = await updateDriverAvailability(
    req.auth!.sub,
    req.body as UpdateDriverAvailabilityInput,
  );
  res.json(successResponse('Driver availability updated.', profile));
};

export const listDriverDeliveryHistoryHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<ListDriverArchiveQuery>(req);
  const result = await listDriverDeliveryHistory(req.auth!.sub, query);
  res.json(successResponse('Driver delivery history loaded.', result));
};

export const getDriverHistoricalDeliveryHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const result = await getDriverHistoricalDelivery(req.auth!.sub, id);
  res.json(successResponse('Historical delivery loaded.', result));
};

export const listDriverIncidentsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<ListDriverArchiveQuery>(req);
  const result = await listDriverIncidents(req.auth!.sub, query);
  res.json(successResponse('Driver incidents loaded.', result));
};

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

export const getDriverDeliveryDetailHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const result = await getDriverDeliveryDetail(req.auth!.sub, id);

  res.json(successResponse('Delivery detail loaded.', result));
};

export const getDriverDeliveryInactiveContextHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const context = await getDriverDeliveryInactiveContext(req.auth!.sub, id);

  res.json(successResponse('Delivery context loaded.', context));
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
