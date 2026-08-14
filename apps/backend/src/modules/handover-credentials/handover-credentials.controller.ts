import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedParams } from '../../middlewares/validate.middleware.js';

import {
  issueHandoverCredential,
  verifyHandoverCredential,
} from './handover-credentials.service.js';
import { confirmHandoverCredential } from '../supplier-reservations/supplier-reservations.service.js';
import type {
  HandoverCredentialReservationParams,
  HandoverCredentialTokenBody,
} from './handover-credentials.validation.js';

export const issueHandoverCredentialHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<HandoverCredentialReservationParams>(req);
  const credential = await issueHandoverCredential(req.auth!.sub, id);

  res.json(successResponse('Handover credential issued.', credential));
};

export const verifyHandoverCredentialHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as HandoverCredentialTokenBody;
  const preview = await verifyHandoverCredential(
    req.auth!.sub,
    body.handoverToken,
  );

  res.json(successResponse('Handover credential verified.', preview));
};

export const confirmHandoverCredentialHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const body = req.body as HandoverCredentialTokenBody;
  const reservation = await confirmHandoverCredential(
    req.auth!.sub,
    body.handoverToken,
    body.cashReceivedConfirmed,
  );

  res.json(successResponse('Reservation handover confirmed.', reservation));
};
