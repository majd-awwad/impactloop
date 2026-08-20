import { Router } from 'express';

import { asyncHandler } from '../../utils/async-handler.js';
import { getPublicLandingHandler } from './public-landing.controller.js';

export const publicLandingRouter = Router();

publicLandingRouter.get('/', asyncHandler(getPublicLandingHandler));
