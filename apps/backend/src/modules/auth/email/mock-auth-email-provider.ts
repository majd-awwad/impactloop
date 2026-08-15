import { canLogMockEmailLinks } from '../../../observability/mock-email-log-policy.js';
import { logger } from '../../../observability/logger.js';
import type {
  AuthEmailProvider,
  EmailSendResult,
  EmailVerificationEmailPayload,
  PasswordChangedEmailPayload,
  PasswordResetEmailPayload,
} from './auth-email-provider.js';

const recipientDomain = (email: string): string => {
  const atIndex = email.lastIndexOf('@');
  return atIndex >= 0 ? email.slice(atIndex + 1) : 'unknown';
};

export class MockAuthEmailProvider implements AuthEmailProvider {
  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<EmailSendResult> {
    if (canLogMockEmailLinks()) {
      logger.info(
        {
          operation: 'mock_auth_email.password_reset',
          emailType: 'password_reset',
          recipientDomain: recipientDomain(payload.recipientEmail),
          expiresAt: payload.expiresAt.toISOString(),
          mockDevLink: payload.resetLink,
        },
        'Mock auth password reset email generated',
      );
    } else {
      logger.info(
        {
          operation: 'mock_auth_email.password_reset',
          emailType: 'password_reset',
          recipientDomain: recipientDomain(payload.recipientEmail),
          expiresAt: payload.expiresAt.toISOString(),
        },
        'Mock auth password reset email generated',
      );
    }

    return { status: 'SENT' };
  }

  async sendPasswordChangedEmail(
    payload: PasswordChangedEmailPayload,
  ): Promise<EmailSendResult> {
    logger.info(
      {
        operation: 'mock_auth_email.password_changed',
        emailType: 'password_changed',
        recipientDomain: recipientDomain(payload.recipientEmail),
      },
      'Mock auth password changed email generated',
    );

    return { status: 'SENT' };
  }

  async sendEmailVerificationEmail(
    payload: EmailVerificationEmailPayload,
  ): Promise<EmailSendResult> {
    if (canLogMockEmailLinks()) {
      logger.info(
        {
          operation: 'mock_auth_email.email_verification',
          emailType: 'email_verification',
          recipientDomain: recipientDomain(payload.recipientEmail),
          expiresAt: payload.expiresAt.toISOString(),
          mockDevLink: payload.verificationLink,
        },
        'Mock auth email verification email generated',
      );
    } else {
      logger.info(
        {
          operation: 'mock_auth_email.email_verification',
          emailType: 'email_verification',
          recipientDomain: recipientDomain(payload.recipientEmail),
          expiresAt: payload.expiresAt.toISOString(),
        },
        'Mock auth email verification email generated',
      );
    }

    return { status: 'SENT' };
  }
}
