import type { Request, Response } from 'express';
import { successResponse } from '../../utils/api-response.js';
import { getLearnerProfileSummary } from './learner-profile-summary.service.js';

export const getLearnerProfileSummaryHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const summary = await getLearnerProfileSummary(req.auth!.sub);
  res.json(successResponse('Learner profile summary loaded.', summary));
};
