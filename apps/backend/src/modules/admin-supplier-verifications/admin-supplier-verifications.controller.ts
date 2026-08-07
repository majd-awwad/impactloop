import type { Request, Response } from 'express';

import { readValidatedQuery } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import { buildInlineContentDisposition } from '../uploads/verification-uploads.storage.js';

import {
  approveSupplierVerification,
  getSupplierVerificationDocumentForAdmin,
  getSupplierVerificationForAdmin,
  listSupplierVerificationsForAdmin,
  rejectSupplierVerification,
  requestChangesForSupplierVerification,
} from './admin-supplier-verifications.service.js';
import type {
  ApproveSupplierVerificationInput,
  ListSupplierVerificationsQuery,
  RejectSupplierVerificationInput,
  RequestChangesSupplierVerificationInput,
} from './admin-supplier-verifications.validation.js';

export const listAdminSupplierVerifications = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listSupplierVerificationsForAdmin(
    readValidatedQuery<ListSupplierVerificationsQuery>(req),
  );

  res.json(successResponse('Supplier verifications loaded', result));
};

export const getAdminSupplierVerification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const detail = await getSupplierVerificationForAdmin(id);

  res.json(successResponse('Supplier verification loaded', detail));
};

export const downloadAdminSupplierVerificationDocument = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const { document, downloadName } =
    await getSupplierVerificationDocumentForAdmin(id);

  res.setHeader('Content-Type', document.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader(
    'Content-Disposition',
    buildInlineContentDisposition(downloadName?.trim() || document.filename),
  );
  res.sendFile(document.absolutePath);
};

export const approveAdminSupplierVerification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const detail = await approveSupplierVerification(
    req.auth!.sub,
    id,
    req.body as ApproveSupplierVerificationInput,
  );

  res.json(successResponse('Supplier verification approved', detail));
};

export const rejectAdminSupplierVerification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const detail = await rejectSupplierVerification(
    req.auth!.sub,
    id,
    req.body as RejectSupplierVerificationInput,
  );

  res.json(successResponse('Supplier verification rejected', detail));
};

export const requestChangesAdminSupplierVerification = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const detail = await requestChangesForSupplierVerification(
    req.auth!.sub,
    id,
    req.body as RequestChangesSupplierVerificationInput,
  );

  res.json(
    successResponse('Supplier verification changes requested', detail),
  );
};
