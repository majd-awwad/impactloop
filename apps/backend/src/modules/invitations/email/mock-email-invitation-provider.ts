import { canLogMockEmailLinks } from '../../../observability/mock-email-log-policy.js';
import { logger } from '../../../observability/logger.js';
import type {
  EmailInvitationPayload,
  EmailInvitationProvider,
  EmailSendResult,
} from './email-invitation-provider.js';

const formatRoleLabel = (role: string): string =>
  role.charAt(0) + role.slice(1).toLowerCase();

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildPlainText = (payload: EmailInvitationPayload): string => {
  const roleLabel = formatRoleLabel(payload.role);
  const expiresAt = payload.expiresAt.toISOString();

  return [
    'Hello,',
    '',
    `You have been invited to join ImpactLoop as a ${roleLabel}.`,
    '',
    'Complete your registration using this secure link:',
    payload.inviteLink,
    '',
    'This invitation expires at:',
    expiresAt,
    '',
    'If you were not expecting this invitation, you can ignore this email.',
    '',
    'ImpactLoop Team',
  ].join('\n');
};

const buildHtml = (payload: EmailInvitationPayload): string => {
  const roleLabel = escapeHtml(formatRoleLabel(payload.role));
  const expiresAt = escapeHtml(payload.expiresAt.toISOString());
  const inviteLink = escapeHtml(payload.inviteLink);

  return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
    <p>Hello,</p>
    <p>You have been invited to join ImpactLoop as a <strong>${roleLabel}</strong>.</p>
    <p>Complete your registration using this secure link:</p>
    <p><a href="${inviteLink}" style="display: inline-block; padding: 12px 18px; background: #0f766e; color: #ffffff; text-decoration: none; border-radius: 6px;">Accept invitation</a></p>
    <p>This invitation expires at:<br /><strong>${expiresAt}</strong></p>
    <p>If the button does not work, copy and paste this link into your browser:</p>
    <p><a href="${inviteLink}">${inviteLink}</a></p>
    <p>If you were not expecting this invitation, you can ignore this email.</p>
    <p>ImpactLoop Team</p>
  </body>
</html>`;
};

export const buildInvitationEmailContent = (payload: EmailInvitationPayload) => {
  const roleLabel = formatRoleLabel(payload.role);
  return {
    subject: `ImpactLoop invitation: complete your ${roleLabel} registration`,
    text: buildPlainText(payload),
    html: buildHtml(payload),
  };
};

const recipientDomain = (email: string): string => {
  const atIndex = email.lastIndexOf('@');
  return atIndex >= 0 ? email.slice(atIndex + 1) : 'unknown';
};

export class MockEmailInvitationProvider implements EmailInvitationProvider {
  async sendInvitationEmail(payload: EmailInvitationPayload): Promise<EmailSendResult> {
    if (canLogMockEmailLinks()) {
      logger.info(
        {
          operation: 'mock_invitation_email.send',
          emailType: 'invitation',
          recipientDomain: recipientDomain(payload.recipientEmail),
          expiresAt: payload.expiresAt.toISOString(),
          mockDevLink: payload.inviteLink,
        },
        'Mock invitation email generated',
      );
    } else {
      logger.info(
        {
          operation: 'mock_invitation_email.send',
          emailType: 'invitation',
          recipientDomain: recipientDomain(payload.recipientEmail),
          expiresAt: payload.expiresAt.toISOString(),
        },
        'Mock invitation email generated',
      );
    }

    return {
      sendStatus: 'SENT',
      providerMessageId: `mock-${Date.now()}`,
    };
  }
}
