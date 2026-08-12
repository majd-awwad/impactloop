import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import {
  getPublicUserProfile,
  getPublicUserProjects,
} from './public-users.service.js';
import type { PublicUserProjectsQuery } from './public-users.validation.js';

export const getPublicUserProfileHandler = async (
  req: Request,
  res: Response,
) => {
  const { userId } = readValidatedParams<{ userId: string }>(req);
  const profile = await getPublicUserProfile(userId);
  res.json(successResponse('Public user profile fetched successfully', profile));
};

export const getPublicUserProjectsHandler = async (
  req: Request,
  res: Response,
) => {
  const { userId } = readValidatedParams<{ userId: string }>(req);
  const result = await getPublicUserProjects(
    userId,
    readValidatedQuery<PublicUserProjectsQuery>(req),
  );
  res.json(successResponse('Public user projects fetched successfully', result));
};
