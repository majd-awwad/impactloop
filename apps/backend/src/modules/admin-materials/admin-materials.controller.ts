import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import * as service from './admin-materials.service.js';
import type {
  AdminMaterialIdParams,
  AdminMaterialReportIdParams,
  AdminMaterialReportsListQuery,
  AdminMaterialsListQuery,
  HideMaterialFromReportInput,
  HideMaterialInput,
  MarkUnavailableInput,
  RejectMaterialReportInput,
  ResolveMaterialReportInput,
  SubmitMaterialReportInput,
} from './admin-materials.validation.js';

export const getAdminMaterialsSummary = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const result = await service.getAdminMaterialsSummary();
  res.json(successResponse('Materials summary loaded.', result));
};

export const listAdminMaterials = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminMaterialsListQuery>(req);
  const result = await service.listAdminMaterials(query);
  res.json(successResponse('Materials loaded.', result));
};

export const getAdminMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminMaterialIdParams>(req);
  const result = await service.getAdminMaterialById(id);
  res.json(successResponse('Material loaded.', result));
};

export const hideAdminMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminMaterialIdParams>(req);
  const result = await service.hideAdminMaterial(
    req.auth!.sub,
    id,
    req.body as HideMaterialInput,
  );
  res.json(successResponse('Material hidden.', result));
};

export const markAdminMaterialUnavailable = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminMaterialIdParams>(req);
  const result = await service.markAdminMaterialUnavailable(
    req.auth!.sub,
    id,
    req.body as MarkUnavailableInput,
  );
  res.json(successResponse('Material marked unavailable.', result));
};

export const restoreAdminMaterial = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminMaterialIdParams>(req);
  const result = await service.restoreAdminMaterial(req.auth!.sub, id);
  res.json(successResponse('Material restored.', result));
};

export const listAdminMaterialReports = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminMaterialReportsListQuery>(req);
  const result = await service.listAdminMaterialReports(query);
  res.json(successResponse('Material reports loaded.', result));
};

export const getAdminMaterialReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminMaterialReportIdParams>(req);
  const result = await service.getAdminMaterialReportById(id);
  res.json(successResponse('Material report loaded.', result));
};

export const resolveAdminMaterialReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminMaterialReportIdParams>(req);
  const result = await service.resolveAdminMaterialReport(
    req.auth!.sub,
    id,
    req.body as ResolveMaterialReportInput,
  );
  res.json(successResponse('Report resolved.', result));
};

export const rejectAdminMaterialReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminMaterialReportIdParams>(req);
  const result = await service.rejectAdminMaterialReport(
    req.auth!.sub,
    id,
    req.body as RejectMaterialReportInput,
  );
  res.json(successResponse('Report rejected.', result));
};

export const hideMaterialFromAdminReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminMaterialReportIdParams>(req);
  const result = await service.hideMaterialFromAdminReport(
    req.auth!.sub,
    id,
    req.body as HideMaterialFromReportInput,
  );
  res.json(successResponse('Material hidden and report resolved.', result));
};

export const submitMaterialReport = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminMaterialIdParams>(req);
  const result = await service.submitMaterialReport(
    req.auth!.sub,
    id,
    req.body as SubmitMaterialReportInput,
  );
  res.json(successResponse(result.message, result));
};
