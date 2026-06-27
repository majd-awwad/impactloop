import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';

import {
  createEmailInvitation,
  listInvitationsForAdmin,
  resendEmailInvitation,
  revokeInvitation,
} from '../invitations/invitations.service.js';
import type { AdminCreateInvitationInput } from '../invitations/invitations.validation.js';

export const listAdminInvitations = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const invitations = await listInvitationsForAdmin();
  res.json(successResponse('Invitations loaded', invitations));
};

export const createAdminInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const invitation = await createEmailInvitation(
    req.auth!.sub,
    req.body as AdminCreateInvitationInput,
  );

  res.status(201).json(successResponse('Invitation created', invitation));
};

export const resendAdminInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const invitation = await resendEmailInvitation(id);

  res.json(successResponse('Invitation resent', invitation));
};

export const revokeAdminInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const invitation = await revokeInvitation(id);

  res.json(successResponse('Invitation revoked', invitation));
};
