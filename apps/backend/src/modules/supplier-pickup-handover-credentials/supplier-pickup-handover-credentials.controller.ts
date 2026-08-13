import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedParams } from '../../middlewares/validate.middleware.js';
import type { z } from 'zod';
import {
  handoverCredentialReservationParamsSchema,
  handoverCredentialTokenBodySchema,
} from '../handover-credentials/handover-credentials.validation.js';

import {
  confirmSupplierPickupHandoverCredential,
  issueSupplierPickupHandoverCredential,
  verifySupplierPickupHandoverCredential,
} from './supplier-pickup-handover-credentials.service.js';

type ReservationIdParams = z.infer<typeof handoverCredentialReservationParamsSchema>;
type HandoverCredentialTokenBody = z.infer<
  typeof handoverCredentialTokenBodySchema
>;

export const issueSupplierPickupHandoverCredentialHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ReservationIdParams>(req);
  const credential = await issueSupplierPickupHandoverCredential(
    req.auth!.sub,
    id,
  );

  res.json(
    successResponse('Supplier pickup handover credential issued.', credential),
  );
};

export const verifySupplierPickupHandoverCredentialHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as HandoverCredentialTokenBody;
  const preview = await verifySupplierPickupHandoverCredential(
    req.auth!.sub,
    body.handoverToken,
  );

  res.json(
    successResponse('Supplier pickup handover credential verified.', preview),
  );
};

export const confirmSupplierPickupHandoverCredentialHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as HandoverCredentialTokenBody;
  const delivery = await confirmSupplierPickupHandoverCredential(
    req.auth!.sub,
    body.handoverToken,
  );

  res.json(successResponse('Supplier pickup handover confirmed.', delivery));
};
