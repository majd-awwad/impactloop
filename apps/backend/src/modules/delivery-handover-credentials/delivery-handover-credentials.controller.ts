import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedParams } from '../../middlewares/validate.middleware.js';
import { deliveryIdParamsSchema } from '../deliveries/deliveries.validation.js';
import type { z } from 'zod';
import { handoverCredentialTokenBodySchema } from '../handover-credentials/handover-credentials.validation.js';

import {
  confirmDeliveryHandoverCredential,
  issueDeliveryHandoverCredential,
  verifyDeliveryHandoverCredential,
} from './delivery-handover-credentials.service.js';

type DeliveryIdParams = z.infer<typeof deliveryIdParamsSchema>;
type HandoverCredentialTokenBody = z.infer<
  typeof handoverCredentialTokenBodySchema
>;

export const issueDeliveryHandoverCredentialHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<DeliveryIdParams>(req);
  const credential = await issueDeliveryHandoverCredential(req.auth!.sub, id);

  res.json(successResponse('Delivery handover credential issued.', credential));
};

export const verifyDeliveryHandoverCredentialHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as HandoverCredentialTokenBody;
  const preview = await verifyDeliveryHandoverCredential(
    req.auth!.sub,
    body.handoverToken,
  );

  res.json(successResponse('Delivery handover credential verified.', preview));
};

export const confirmDeliveryHandoverCredentialHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as HandoverCredentialTokenBody;
  const delivery = await confirmDeliveryHandoverCredential(
    req.auth!.sub,
    body.handoverToken,
    body.cashReceivedConfirmed,
  );

  res.json(successResponse('Delivery handover confirmed.', delivery));
};
