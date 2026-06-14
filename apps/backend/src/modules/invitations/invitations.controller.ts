import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  acceptInvitation,
  createInvitation,
  validateInvitationToken,
} from './invitations.service.js';

import type {
  AcceptInvitationInput,
  CreateInvitationInput,
} from './invitations.validation.js';

export const createRoleInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const invitation = await createInvitation(req.auth!.sub, req.body as CreateInvitationInput);

  res.status(201).json(successResponse('Invitation created', invitation));
};

export const validateRoleInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { token } = req.params as { token: string };
  const result = await validateInvitationToken(token);

  res.json(successResponse('Invitation validation completed', result));
};

export const acceptRoleInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await acceptInvitation(req.body as AcceptInvitationInput);

  res.status(201).json(successResponse('Invitation accepted', result));
};
