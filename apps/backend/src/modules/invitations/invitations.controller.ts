import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import { acceptInvitation, validateInvitationToken } from './invitations.service.js';
import type { AcceptInvitationInput } from './invitations.validation.js';

export const validateRoleInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { token } = req.query as { token: string };
  const result = await validateInvitationToken(token);

  res.json(successResponse('Invitation validation completed', result));
};

export const acceptRoleInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const result = await acceptInvitation(req.body as AcceptInvitationInput);

  res.status(201).json(
    successResponse('Invitation accepted successfully', {
      role: result.role,
    }),
  );
};
