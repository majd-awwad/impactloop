import type { Request, Response } from 'express';

import {
  readValidatedParams,
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  preflightAdminPeopleExport,
  streamAdminPeopleExport,
} from './admin-people.export.js';
import * as service from './admin-people.service.js';
import type {
  AdminPeopleExportDownloadQuery,
  AdminPeopleExportFilters,
  AdminPeopleListQuery,
  AdminPeopleUserIdParams,
  SuspendUserInput,
} from './admin-people.validation.js';

export const getAdminPeopleSummary = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const result = await service.getAdminPeopleSummary();
  res.json(successResponse('People summary loaded.', result));
};

export const listAdminPeople = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminPeopleListQuery>(req);
  const result = await service.listAdminPeople(req.auth!.sub, query);
  res.json(successResponse('People loaded.', result));
};

export const preflightAdminPeopleExportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const filters = readValidatedQuery<AdminPeopleExportFilters>(req);
  const result = await preflightAdminPeopleExport(filters);
  res.json(successResponse('Users export preflight loaded.', result));
};

export const exportAdminPeopleHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<AdminPeopleExportDownloadQuery>(req);
  await streamAdminPeopleExport({
    res,
    filters: query,
    actorUserId: req.auth!.sub,
  });
};

export const getAdminPerson = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminPeopleUserIdParams>(req);
  const result = await service.getAdminPersonById(req.auth!.sub, id);
  res.json(successResponse('Person loaded.', result));
};

export const suspendAdminPerson = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminPeopleUserIdParams>(req);
  const result = await service.suspendAdminPerson(
    req.auth!.sub,
    id,
    req.body as SuspendUserInput,
  );
  res.json(successResponse('Account suspended.', result));
};

export const reactivateAdminPerson = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<AdminPeopleUserIdParams>(req);
  const result = await service.reactivateAdminPerson(req.auth!.sub, id);
  res.json(successResponse('Account reactivated.', result));
};
