export type EmailInvitationPayload = {
  recipientEmail: string;
  role: string;
  inviteLink: string;
  expiresAt: Date;
};

export type EmailSendResult = {
  sendStatus: 'SENT' | 'FAILED';
  providerMessageId?: string;
  sendError?: string;
};

export interface EmailInvitationProvider {
  sendInvitationEmail(payload: EmailInvitationPayload): Promise<EmailSendResult>;
}
