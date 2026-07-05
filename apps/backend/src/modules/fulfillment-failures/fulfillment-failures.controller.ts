import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedParams } from '../../middlewares/validate.middleware.js';

import {
  markDriverDeliveryFailed,
  markDriverIssueAfterPickup,
  markDriverPickupFailed,
  markSupplierDeliveryPickupExpired,
  markSupplierDriverNoShow,
  markSupplierLearnerNoShow,
} from './fulfillment-failures.service.js';
import type {
  DeliveryIdParams,
  MarkDriverDeliveryFailedInput,
  MarkDriverIssueAfterPickupInput,
  MarkDriverNoShowInput,
  MarkDriverPickupFailedInput,
  MarkLearnerNoShowInput,
  ReservationIdParams,
} from './fulfillment-failures.validation.js';

export const markSupplierLearnerNoShowHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await markSupplierLearnerNoShow(
    req.auth!.sub,
    id,
    req.body as MarkLearnerNoShowInput,
  );

  res.json(successResponse('Learner no-show recorded.', reservation));
};

export const markSupplierDeliveryPickupExpiredHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const reservation = await markSupplierDeliveryPickupExpired(
    req.auth!.sub,
    id,
  );

  res.json(
    successResponse('Delivery pickup window marked expired.', reservation),
  );
};

export const markSupplierDriverNoShowHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const reservation = await markSupplierDriverNoShow(
    req.auth!.sub,
    id,
    req.body as MarkDriverNoShowInput,
  );

  res.json(successResponse('Driver no-show recorded.', reservation));
};

export const markDriverPickupFailedHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const delivery = await markDriverPickupFailed(
    req.auth!.sub,
    id,
    req.body as MarkDriverPickupFailedInput,
  );

  res.json(successResponse('Pickup failure recorded.', { delivery }));
};

export const markDriverDeliveryFailedHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const delivery = await markDriverDeliveryFailed(
    req.auth!.sub,
    id,
    req.body as MarkDriverDeliveryFailedInput,
  );

  res.json(successResponse('Delivery failure recorded.', { delivery }));
};

export const markDriverIssueAfterPickupHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const delivery = await markDriverIssueAfterPickup(
    req.auth!.sub,
    id,
    req.body as MarkDriverIssueAfterPickupInput,
  );

  res.json(successResponse('Driver issue reported.', { delivery }));
};
