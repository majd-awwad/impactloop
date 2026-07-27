import type { Request, Response } from 'express';

import {
  readValidatedQuery,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';
import {
  listSupplierSchedulePage,
} from './supplier-reservations-schedule.service.js';
import type {
  ListSupplierScheduleQuery,
} from './supplier-reservations-schedule.validation.js';

export const listSupplierScheduleHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const query = readValidatedQuery<ListSupplierScheduleQuery>(req);
  const result = await listSupplierSchedulePage(req.auth!.sub, query);

  res.json(successResponse('Supplier schedule loaded.', result));
};
