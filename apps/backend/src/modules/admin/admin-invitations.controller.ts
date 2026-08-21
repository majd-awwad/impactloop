import type { Request, Response } from 'express';

import { successResponse } from '../../utils/api-response.js';
import { AppError } from '../../utils/app-error.js';

import {
  createEmailInvitation,
  getInvitationForAdmin,
  issueInvitationLinkForAdmin,
  listInvitationsForAdmin,
  resendEmailInvitation,
  revokeInvitation,
} from '../invitations/invitations.service.js';
import type { InvitationCreateResult } from '../invitations/invitations.service.js';
import type { AdminCreateInvitationInput } from '../invitations/invitations.validation.js';

const assertInvitationEmailDelivered = (
  invitation: InvitationCreateResult,
): void => {
  if (invitation.sendStatus !== 'FAILED') {
    return;
  }

  // The invitation is deliberately retained in FAILED state so the admin can
  // resend it. Do not return a success response that looks like email delivery.
  throw new AppError(
    'Invitation was saved, but its email could not be delivered. Retry it from the invitations list.',
    424,
    'EMAIL_DELIVERY_FAILED',
    {
      invitationId: invitation.id,
      sendStatus: invitation.sendStatus,
    },
  );
};

const invitationCreateResponse = (
  invitation: InvitationCreateResult,
): Omit<InvitationCreateResult, 'inviteLink'> | InvitationCreateResult => {
  if (invitation.emailProvider === 'mock') {
    return invitation;
  }

  // A real email is the only place a raw invitation token should be delivered.
  const { inviteLink: _inviteLink, ...safeInvitation } = invitation;
  return safeInvitation;
};

export const listAdminInvitations = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const invitations = await listInvitationsForAdmin();
  res.json(successResponse('Invitations loaded', invitations));
};

export const getAdminInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const invitation = await getInvitationForAdmin(id);
  res.json(successResponse('Invitation loaded', invitation));
};

export const issueAdminInvitationLink = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const result = await issueInvitationLinkForAdmin(id);
  res.json(successResponse('Invitation link issued', result));
};

export const createAdminInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const invitation = await createEmailInvitation(
    req.auth!.sub,
    req.body as AdminCreateInvitationInput,
  );

  assertInvitationEmailDelivered(invitation);

  res
    .status(201)
    .json(successResponse('Invitation created', invitationCreateResponse(invitation)));
};

export const resendAdminInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const invitation = await resendEmailInvitation(id, req.auth!.sub);

  assertInvitationEmailDelivered(invitation);

  res.json(successResponse('Invitation resent', invitationCreateResponse(invitation)));
};

export const revokeAdminInvitation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.params as { id: string };
  const invitation = await revokeInvitation(id, req.auth!.sub);

  res.json(successResponse('Invitation revoked', invitation));
};
