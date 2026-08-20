import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { getPublicLanding } from './public-landing.service.js';

export const getPublicLandingHandler = async (_req: Request, res: Response) => {
  const landing = await getPublicLanding();
  res.json(successResponse('Public landing content fetched successfully', landing));
};
