import { Router, type Request, type Response } from 'express';
import { errorResponse, successResponse } from '../../utils/api-response.js';
import { getHealth } from './health.controller.js';
import { getReadinessStatus } from './health.service.js';

export const healthRouter = Router();

healthRouter.get('/', getHealth);

healthRouter.get('/ready', (_req: Request, res: Response): void => {
  const readiness = getReadinessStatus();

  if (readiness.ready) {
    res.status(200).json(
      successResponse('API is ready', {
        ready: true,
        recommendationOutbox: readiness.recommendationOutbox,
        database: readiness.database,
        reservationLifecycle: readiness.reservationLifecycle,
      }),
    );
    return;
  }

  res.status(503).json(
    errorResponse('API is not ready', 'NOT_READY', {
      ready: false,
      recommendationOutbox: readiness.recommendationOutbox,
      database: readiness.database,
      reservationLifecycle: readiness.reservationLifecycle,
      reasonCodes: readiness.reasonCodes,
    }),
  );
});
