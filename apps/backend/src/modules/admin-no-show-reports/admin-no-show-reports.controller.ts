import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedParams, readValidatedQuery } from '../../middlewares/validate.middleware.js';

import {
  getAdminNoShowReportById,
  listAdminNoShowReports,
  rejectAdminNoShowReport,
  verifyAdminNoShowReport,
} from './admin-no-show-reports.service.js';
import type {
  AdminNoShowReportIdParams,
  AdminNoShowReportsListQuery,
  ReviewNoShowReportInput,
} from './admin-no-show-reports.validation.js';

export const listAdminNoShowReportsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listAdminNoShowReports(
    readValidatedQuery<AdminNoShowReportsListQuery>(req),
  );

  res.json(successResponse('No-show reports loaded.', result));
};

export const getAdminNoShowReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminNoShowReportIdParams>(req);
  const report = await getAdminNoShowReportById(id);

  res.json(successResponse('No-show report loaded.', report));
};

export const verifyAdminNoShowReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminNoShowReportIdParams>(req);
  const result = await verifyAdminNoShowReport(
    req.auth!.sub,
    id,
    (req.body as ReviewNoShowReportInput).reviewNote,
  );

  res.json(successResponse('No-show report verified.', result));
};

export const rejectAdminNoShowReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminNoShowReportIdParams>(req);
  const report = await rejectAdminNoShowReport(
    req.auth!.sub,
    id,
    (req.body as ReviewNoShowReportInput).reviewNote,
  );

  res.json(successResponse('No-show report rejected.', report));
};
