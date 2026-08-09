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
import {
  assertReservationPaymentAccess,
  cancelReservationCheckoutSession,
  getCheckoutSessionForActor,
  getRelevantCheckoutSessionForReservation,
  reconcileExpiredCheckoutSessions,
  startReservationCheckout,
} from './payments.checkout-session.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';
import type {
  MockCheckoutActInput,
  PaymentCancelAttemptInput,
  ReservationCheckoutCancelInput,
} from './payments.validation.js';
import {
  isPaymentAdminActor,
  type PaymentActor,
} from './payments.actor.js';

const actorFromRequest = (req: Request): PaymentActor => {
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

export const getReservationPaymentRequirementHandler = async (
  req: Request,
  res: Response,
) => {
  const actor = actorFromRequest(req);
  const requirement = await getReservationPaymentRequirement(
    pathParam(req.params.reservationId, 'reservationId'),
    actor,
  );
  res
    .status(200)
    .json(successResponse('Reservation payment requirement retrieved.', requirement));
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

export const startReservationCheckoutHandler = async (
  req: Request,
  res: Response,
) => {
  const actor = actorFromRequest(req);
  const idempotencyKey = validateIdempotencyKey(req.get('Idempotency-Key'));

  const result = await startReservationCheckout({
    reservationId: pathParam(req.params.reservationId, 'reservationId'),
    payerUserId: actor.userId,
    idempotencyKey,
  });

  res
    .status(200)
    .json(successResponse('Reservation checkout session ready.', result));
};

export const getCheckoutSessionHandler = async (req: Request, res: Response) => {
  const actor = actorFromRequest(req);
  const session = await getCheckoutSessionForActor(
    pathParam(req.params.id, 'id'),
    actor,
  );
  res
    .status(200)
    .json(successResponse('Checkout session retrieved.', session));
};

export const getReservationCheckoutSessionHandler = async (
  req: Request,
  res: Response,
) => {
  const actor = actorFromRequest(req);
  const session = await getRelevantCheckoutSessionForReservation(
    pathParam(req.params.reservationId, 'reservationId'),
    actor,
  );
  res.status(200).json(
    successResponse(
      session
        ? 'Reservation checkout session retrieved.'
        : 'No relevant checkout session.',
      session,
    ),
  );
};

export const reconcileExpiredCheckoutSessionsHandler = async (
  req: Request,
  res: Response,
) => {
  const actor = actorFromRequest(req);
  const reservationId =
    typeof req.query.reservationId === 'string'
      ? req.query.reservationId
      : undefined;

  // Learners may only reconcile their own reservation scope.
  if (reservationId) {
    await assertReservationPaymentAccess(reservationId, actor);
  } else if (!isPaymentAdminActor(actor)) {
    throw new AppError(
      'reservationId is required for non-admin reconcile.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const result = await reconcileExpiredCheckoutSessions({
    reservationId,
  });
  res
    .status(200)
    .json(successResponse('Expired checkout sessions reconciled.', result));
};

export const cancelReservationCheckoutHandler = async (
  req: Request,
  res: Response,
) => {
  const actor = actorFromRequest(req);
  const body = req.body as ReservationCheckoutCancelInput;

  const result = await cancelReservationCheckoutSession({
    checkoutSessionId: pathParam(req.params.id, 'id'),
    attemptId: body.attemptId,
    payerUserId: actor.userId,
  });

  res
    .status(200)
    .json(successResponse('Checkout session attempt cancelled.', result));
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
