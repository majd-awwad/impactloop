export type EmailSendResult = {
  status: 'SENT' | 'FAILED';
  sendError?: string;
};

export type PasswordResetEmailPayload = {
  recipientEmail: string;
  resetLink: string;
  expiresAt: Date;
};

export type PasswordChangedEmailPayload = {
  recipientEmail: string;
};

export type EmailVerificationEmailPayload = {
  recipientEmail: string;
  verificationLink: string;
  expiresAt: Date;
};

export type AuthEmailProvider = {
  sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<EmailSendResult>;
  sendPasswordChangedEmail(
    payload: PasswordChangedEmailPayload,
  ): Promise<EmailSendResult>;
  sendEmailVerificationEmail(
    payload: EmailVerificationEmailPayload,
  ): Promise<EmailSendResult>;
};
