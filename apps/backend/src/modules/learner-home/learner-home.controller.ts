import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { getLearnerHome, getLearnerHomeSection } from './learner-home.service.js';
import {
  parseLearnerHomeSectionKey,
  parseLearnerHomeSectionQuery,
} from './learner-home.validation.js';

export const getLearnerHomeHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await getLearnerHome(req.auth!.sub);

  res.json(successResponse('Learner home loaded.', data));
};

export const getLearnerHomeSectionHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const sectionKey = parseLearnerHomeSectionKey(String(req.params.sectionKey));
  const { limit, offset } = parseLearnerHomeSectionQuery(req.query);
  const data = await getLearnerHomeSection(
    req.auth!.sub,
    sectionKey,
    limit,
    offset,
  );

  res.json(successResponse('Learner home section loaded.', data));
};
