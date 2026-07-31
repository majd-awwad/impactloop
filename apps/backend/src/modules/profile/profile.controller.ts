import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { getLearnerInterestOptionsResponse } from '../learner-home/learner-interest-taxonomy.js';

import {
  updateLearnerProfileForUser,
  updateProfileForUser,
} from './profile.service.js';

import type {
  UpdateLearnerProfileInput,
  UpdateProfileInput,
} from './profile.validation.js';

export const getLearnerInterestOptions = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  res.json(
    successResponse('Learner interest options loaded', getLearnerInterestOptionsResponse()),
  );
};

export const patchProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const user = await updateProfileForUser(
    req.auth!.sub,
    req.body as UpdateProfileInput,
  );

  res.json(successResponse('Profile updated', { user }));
};

export const patchLearnerProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const user = await updateLearnerProfileForUser(
    req.auth!.sub,
    req.body as UpdateLearnerProfileInput,
  );

  res.json(successResponse('Learner profile updated', { user }));
};
