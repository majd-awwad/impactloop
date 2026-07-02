import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

import { env, getSmtpConfigurationErrors } from '../../../config/env.js';

import type {
  EmailInvitationPayload,
  EmailInvitationProvider,
  EmailSendResult,
} from './email-invitation-provider.js';
import { buildInvitationEmailContent } from './mock-email-invitation-provider.js';
import { sanitizeSmtpError } from './smtp-utils.js';

const buildSmtpTransportOptions = (): SMTPTransport.Options => ({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpSecure,
  requireTLS: !env.smtpSecure && env.smtpPort === 587,
  auth: {
    user: env.smtpUser,
    pass: env.smtpPass,
  },
});

export const verifySmtpInvitationTransport = async (): Promise<{
  ok: boolean;
  error?: string;
}> => {
  const configurationErrors = getSmtpConfigurationErrors();
  if (configurationErrors.length > 0) {
    return {
      ok: false,
      error: configurationErrors.join('; '),
    };
  }

  const transporter = nodemailer.createTransport(buildSmtpTransportOptions());

  try {
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'SMTP verify failed';
    return {
      ok: false,
      error: sanitizeSmtpError(message),
    };
  } finally {
    transporter.close();
  }
};

export class SmtpEmailInvitationProvider implements EmailInvitationProvider {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport(buildSmtpTransportOptions());
    }

    return this.transporter;
  }

  async sendInvitationEmail(payload: EmailInvitationPayload): Promise<EmailSendResult> {
    const configurationErrors = getSmtpConfigurationErrors();
    if (configurationErrors.length > 0) {
      return {
        sendStatus: 'FAILED',
        sendError: configurationErrors.join('; '),
      };
    }

    const content = buildInvitationEmailContent(payload);

    try {
      const info = await this.getTransporter().sendMail({
        from: env.smtpFrom,
        to: payload.recipientEmail,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });

      if (!info.messageId) {
        return {
          sendStatus: 'FAILED',
          sendError: 'SMTP send completed without a message id',
        };
      }

      return {
        sendStatus: 'SENT',
        providerMessageId: info.messageId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Email send failed';
      return {
        sendStatus: 'FAILED',
        sendError: sanitizeSmtpError(message),
      };
    }
  }
}
