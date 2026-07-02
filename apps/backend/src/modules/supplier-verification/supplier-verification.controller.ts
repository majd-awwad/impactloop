import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  getSupplierVerificationStatus,
  resubmitSupplierVerification,
  submitSupplierVerification,
} from './supplier-verification.service.js';
import type {
  ResubmitSupplierVerificationInput,
  SubmitSupplierVerificationInput,
} from './supplier-verification.validation.js';

export const getSupplierVerificationStatusHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const status = await getSupplierVerificationStatus(req.auth!.sub);
  res.json(successResponse('Supplier verification status loaded', status));
};

export const submitSupplierVerificationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const status = await submitSupplierVerification(
    req.auth!.sub,
    req.body as SubmitSupplierVerificationInput,
  );

  res
    .status(201)
    .json(successResponse('Supplier verification submitted', status));
};

export const resubmitSupplierVerificationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const status = await resubmitSupplierVerification(
    req.auth!.sub,
    req.body as ResubmitSupplierVerificationInput,
  );

  res.json(successResponse('Supplier verification resubmitted', status));
};
