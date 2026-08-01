import { Router } from 'express';

import { authMiddleware } from '../../middlewares/auth.middleware.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { asyncHandler } from '../../utils/async-handler.js';

import {
  getPriceRuleRequestDraftHandler,
  listSupplierPriceRuleRequestsHandler,
} from '../price-rule-requests/price-rule-requests.controller.js';
import { priceRuleRequestIdParamsSchema } from '../price-rule-requests/price-rule-requests.validation.js';

export const supplierPriceRuleRequestsRouter = Router();

supplierPriceRuleRequestsRouter.get(
  '/',
  authMiddleware,
  requireRoles('SUPPLIER'),
  asyncHandler(listSupplierPriceRuleRequestsHandler),
);

supplierPriceRuleRequestsRouter.get(
  '/:id/draft',
  authMiddleware,
  requireRoles('SUPPLIER'),
  validate(priceRuleRequestIdParamsSchema, 'params'),
  asyncHandler(getPriceRuleRequestDraftHandler),
);
