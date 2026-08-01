import type { Request, Response } from 'express';

import { readValidatedParams } from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  createMySavedDropoffAddress,
  deleteMySavedDropoffAddress,
  listMySavedDropoffAddresses,
  updateMySavedDropoffAddress,
} from './saved-dropoff-addresses.service.js';

export const listMySavedDropoffAddressesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const data = await listMySavedDropoffAddresses(req.auth!.sub);

  res.json(successResponse('Saved dropoff addresses loaded.', data));
};

export const createMySavedDropoffAddressHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const savedAddress = await createMySavedDropoffAddress(
    req.auth!.sub,
    req.body,
  );

  res.status(201).json(
    successResponse('Saved dropoff address created.', { savedAddress }),
  );
};

export const updateMySavedDropoffAddressHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const savedAddress = await updateMySavedDropoffAddress(
    req.auth!.sub,
    id,
    req.body,
  );

  res.json(
    successResponse('Saved dropoff address updated.', { savedAddress }),
  );
};

export const deleteMySavedDropoffAddressHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const data = await deleteMySavedDropoffAddress(req.auth!.sub, id);

  res.json(successResponse('Saved dropoff address deleted.', data));
};
