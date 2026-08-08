import type { Request, Response } from 'express';

import {
  readValidatedParams,
} from '../../middlewares/validate.middleware.js';
import { successResponse } from '../../utils/api-response.js';

import {
  createUserSavedLocation,
  deleteUserSavedLocation,
  forwardGeocodeLocation,
  listUserSavedLocations,
  reverseGeocodeLocation,
  updateUserSavedLocation,
} from './locations.service.js';
import type {
  ForwardGeocodeInput,
  ReverseGeocodeInput,
  SavedLocationInput,
  UpdateSavedLocationInput,
} from './locations.validation.js';

export const reverseGeocodeHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await reverseGeocodeLocation(
    req.auth!.sub,
    req.body as ReverseGeocodeInput,
  );

  res.json(successResponse('Address resolved', result));
};

export const forwardGeocodeHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await forwardGeocodeLocation(
    req.auth!.sub,
    req.body as ForwardGeocodeInput,
  );

  res.json(successResponse('Coordinates resolved', result));
};

export const listSavedLocationsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await listUserSavedLocations(req.auth!.sub);

  res.json(successResponse('Saved locations fetched', result));
};

export const createSavedLocationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await createUserSavedLocation(
    req.auth!.sub,
    req.body as SavedLocationInput,
  );

  res.status(201).json(successResponse('Saved location created', result));
};

export const updateSavedLocationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await updateUserSavedLocation(
    req.auth!.sub,
    id,
    req.body as UpdateSavedLocationInput,
  );

  res.json(successResponse('Saved location updated', result));
};

export const deleteSavedLocationHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = readValidatedParams<{ id: string }>(req);
  const result = await deleteUserSavedLocation(req.auth!.sub, id);

  res.json(successResponse('Saved location deleted', result));
};
