import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { readValidatedParams, readValidatedQuery } from '../../middlewares/validate.middleware.js';

import {
  cancelReleaseHoldAdminNoShowReport,
  getAdminNoShowReportById,
  listAdminNoShowReports,
  rejectAdminNoShowReport,
  requestSupplierRescheduleAdminNoShowReport,
  resolveAdminNoShowReport,
  verifyAdminNoShowReport,
} from './admin-no-show-reports.service.js';
import type {
  AdminNoShowReportIdParams,
  AdminNoShowReportsListQuery,
  CancelReleaseHoldInput,
  RequestSupplierRescheduleInput,
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

export const resolveAdminNoShowReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminNoShowReportIdParams>(req);
  const report = await resolveAdminNoShowReport(
    req.auth!.sub,
    id,
    (req.body as ReviewNoShowReportInput).reviewNote,
  );

  res.json(successResponse('Report resolved without strike.', report));
};

export const requestSupplierRescheduleAdminNoShowReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminNoShowReportIdParams>(req);
  const report = await requestSupplierRescheduleAdminNoShowReport(
    req.auth!.sub,
    id,
    req.body as RequestSupplierRescheduleInput,
  );

  res.json(
    successResponse('Supplier asked to choose a new pickup window.', report),
  );
};

export const cancelReleaseHoldAdminNoShowReportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminNoShowReportIdParams>(req);
  const report = await cancelReleaseHoldAdminNoShowReport(
    req.auth!.sub,
    id,
    req.body as CancelReleaseHoldInput,
  );

  res.json(successResponse('Reservation cancelled and hold released.', report));
};
