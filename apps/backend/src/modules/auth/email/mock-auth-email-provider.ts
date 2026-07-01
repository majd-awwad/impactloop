import type {
  AuthEmailProvider,
  EmailSendResult,
  PasswordChangedEmailPayload,
  PasswordResetEmailPayload,
} from './auth-email-provider.js';

export class MockAuthEmailProvider implements AuthEmailProvider {
  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<EmailSendResult> {
    console.log('[Mock auth email] Password reset');
    console.log(`  To: ${payload.recipientEmail}`);
    console.log(`  Expires at: ${payload.expiresAt.toISOString()}`);
    console.log(`  Reset link: ${payload.resetLink}`);

    return { status: 'SENT' };
  }

  async sendPasswordChangedEmail(
    payload: PasswordChangedEmailPayload,
  ): Promise<EmailSendResult> {
    console.log('[Mock auth email] Password changed');
    console.log(`  To: ${payload.recipientEmail}`);

    return { status: 'SENT' };
  }
}
