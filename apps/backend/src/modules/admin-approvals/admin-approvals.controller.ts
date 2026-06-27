import type { Request, Response } from 'express';

import { readValidatedQuery, readValidatedParams } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import * as service from './admin-approvals.service.js';
import type {
  ApprovalIdParams,
  ApprovalsListQuery,
  ApproveCategoryRequestInput,
  ApprovePriceRequestInput,
  RejectCategoryRequestInput,
  RejectPriceRequestInput,
} from './admin-approvals.validation.js';

export const getAdminApprovalsSummary = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const result = await service.getApprovalsSummary();
  res.json(successResponse('Approvals summary loaded.', result));
};

export const listAdminCategoryRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<ApprovalsListQuery>(req);
  const result = await service.listCategoryRequestsForAdmin(query);
  res.json(successResponse('Category requests loaded.', result));
};

export const approveAdminCategoryRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ApprovalIdParams>(req);
  const result = await service.approveCategoryRequest(
    req.auth!.sub,
    id,
    req.body as ApproveCategoryRequestInput,
  );

  res.json(successResponse('Category request approved.', result));
};

export const rejectAdminCategoryRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ApprovalIdParams>(req);
  const result = await service.rejectCategoryRequest(
    req.auth!.sub,
    id,
    req.body as RejectCategoryRequestInput,
  );

  res.json(successResponse('Category request rejected.', result));
};

export const listAdminPriceRequests = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<ApprovalsListQuery>(req);
  const result = await service.listPriceRequestsForAdmin(query);
  res.json(successResponse('Price requests loaded.', result));
};

export const approveAdminPriceRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ApprovalIdParams>(req);
  const result = await service.approvePriceRequest(
    req.auth!.sub,
    id,
    req.body as ApprovePriceRequestInput,
  );

  res.json(successResponse('Price request approved.', result));
};

export const rejectAdminPriceRequest = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<ApprovalIdParams>(req);
  const result = await service.rejectPriceRequest(
    req.auth!.sub,
    id,
    req.body as RejectPriceRequestInput,
  );

  res.json(successResponse('Price request rejected.', result));
};

