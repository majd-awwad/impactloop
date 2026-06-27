import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import { createPriceRuleRequestHandler } from './price-rule-requests.controller.js';
import { createPriceRuleRequestSchema } from './price-rule-requests.validation.js';

export const priceRuleRequestsRouter = Router();

priceRuleRequestsRouter.post(
  '/',
  authMiddleware,
  validate(createPriceRuleRequestSchema),
  asyncHandler(createPriceRuleRequestHandler),
);
