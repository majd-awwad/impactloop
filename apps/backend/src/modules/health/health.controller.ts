import type { Request, Response } from 'express';
import { successResponse } from '../../utils/api-response.js';
import { getHealthStatus } from './health.service.js';

export const getHealth = (_req: Request, res: Response): void => {
  res.json(successResponse('API is healthy', getHealthStatus()));
};
