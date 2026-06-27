import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { submitPriceRuleRequest } from './price-rule-requests.service.js';
import type { CreatePriceRuleRequestInput } from './price-rule-requests.validation.js';
import {
  getPriceRuleRequestDraft,
  listSupplierPriceRuleRequests,
} from './price-rule-requests.service.js';
import type { PriceRuleRequestIdParams } from './price-rule-requests.validation.js';
import { readValidatedParams } from '../../middlewares/validate.middleware.js';

export const createPriceRuleRequestHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await submitPriceRuleRequest(
    req.auth!.sub,
    req.body as CreatePriceRuleRequestInput,
  );

  if ('activePriceRule' in result) {
    res.json(
      successResponse(result.message, {
        id: result.id,
        status: result.status,
        activePriceRule: result.activePriceRule,
        aiStatus: result.aiStatus,
        message: result.message,
      }),
    );
    return;
  }

  res.status(201).json(
    successResponse(result.message, result),
  );
};

export const listSupplierPriceRuleRequestsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const requests = await listSupplierPriceRuleRequests(req.auth!.sub);

  res.json(successResponse('Price rule requests loaded.', { requests }));
};

export const getPriceRuleRequestDraftHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<PriceRuleRequestIdParams>(req);
  const draft = await getPriceRuleRequestDraft(req.auth!.sub, id);

  res.json(successResponse('Price rule request draft loaded.', draft));
};
