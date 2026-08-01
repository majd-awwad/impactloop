import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  getCategoryRequestDraft,
  listSupplierCategoryRequests,
  submitCategoryRequest,
} from './category-requests.service.js';
import type { CreateCategoryRequestInput } from './category-requests.validation.js';

export const createCategoryRequestHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await submitCategoryRequest(
    req.auth!.sub,
    req.body as CreateCategoryRequestInput,
  );

  res.status(201).json(
    successResponse(result.message, {
      id: result.id,
      requestedName: result.requestedName,
      status: result.status,
    }),
  );
};

export const listCategoryRequestsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const requests = await listSupplierCategoryRequests(req.auth!.sub);

  res.json(successResponse('Category requests loaded', requests));
};

export const getCategoryRequestDraftHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const draft = await getCategoryRequestDraft(req.auth!.sub, String(req.params.id));

  res.json(successResponse('Category request draft loaded', draft));
};
