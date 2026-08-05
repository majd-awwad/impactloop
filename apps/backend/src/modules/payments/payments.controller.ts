import type { Request, Response } from 'express';

import { validateIdempotencyKey } from '../../services/idempotency.service.js';
import { successResponse } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';

import {
  actOnMockCheckout,
  cancelPaymentAttempt,
  getPaymentOrderForActor,
  handleMockWebhook,
  startPaymentCheckout,
} from './payments.service.js';
import type {
  MockCheckoutActInput,
  PaymentCancelAttemptInput,
} from './payments.validation.js';

const actorFromRequest = (req: Request) => {
  if (!req.auth) {
    throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
  }

  return {
    userId: req.auth.sub,
    roles: req.auth.roles,
  };
};

const pathParam = (
  value: string | string[] | undefined,
  name: string,
): string => {
  const resolved = Array.isArray(value) ? value[0] : value;
  if (!resolved) {
    throw new AppError(
      `Missing path parameter: ${name}`,
      400,
      'VALIDATION_ERROR',
    );
  }
  return resolved;
};

export const getPaymentOrderHandler = async (req: Request, res: Response) => {
  const actor = actorFromRequest(req);
  const order = await getPaymentOrderForActor(
    pathParam(req.params.id, 'id'),
    actor,
  );
  res.status(200).json(successResponse('Payment order retrieved.', order));
};

export const startPaymentCheckoutHandler = async (
  req: Request,
  res: Response,
) => {
  const actor = actorFromRequest(req);
  const idempotencyKey = validateIdempotencyKey(req.get('Idempotency-Key'));

  const result = await startPaymentCheckout({
    orderId: pathParam(req.params.id, 'id'),
    payerUserId: actor.userId,
    idempotencyKey,
  });

  res.status(200).json(successResponse('Checkout attempt ready.', result));
};

export const cancelPaymentAttemptHandler = async (
  req: Request,
  res: Response,
) => {
  const actor = actorFromRequest(req);
  const body = req.body as PaymentCancelAttemptInput;

  const result = await cancelPaymentAttempt({
    orderId: pathParam(req.params.id, 'id'),
    attemptId: body.attemptId,
    payerUserId: actor.userId,
  });

  res.status(200).json(successResponse('Payment attempt cancelled.', result));
};

export const mockCheckoutActHandler = async (req: Request, res: Response) => {
  const body = req.body as MockCheckoutActInput;
  const token =
    body.token ??
    (typeof req.query.token === 'string' ? req.query.token : undefined);

  const result = await actOnMockCheckout({
    attemptId: pathParam(req.params.attemptId, 'attemptId'),
    action: body.action,
    actorUserId: req.auth?.sub,
    mockToken: token,
  });

  res
    .status(200)
    .json(successResponse('Mock checkout action processed.', result));
};

export const mockWebhookHandler = async (req: Request, res: Response) => {
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
        'utf8',
      );

  const result = await handleMockWebhook({
    rawBody,
    headers: req.headers,
  });

  res.status(200).json(successResponse('Webhook processed.', result));
};
