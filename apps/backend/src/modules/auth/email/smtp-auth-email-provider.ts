import nodemailer from 'nodemailer';

import { env, getSmtpConfigurationErrors } from '../../../config/env.js';
import { sanitizeSmtpError } from '../../invitations/email/smtp-utils.js';

import type {
  AuthEmailProvider,
  EmailSendResult,
  EmailVerificationEmailPayload,
  PasswordChangedEmailPayload,
  PasswordResetEmailPayload,
} from './auth-email-provider.js';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export class SmtpAuthEmailProvider implements AuthEmailProvider {
  private readonly transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });

  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<EmailSendResult> {
    const configurationErrors = getSmtpConfigurationErrors();

    if (configurationErrors.length > 0) {
      return {
        status: 'FAILED',
        sendError: configurationErrors.join('; '),
      };
    }

    const resetLink = escapeHtml(payload.resetLink);
    const expiresAt = escapeHtml(payload.expiresAt.toISOString());

    try {
      await this.transporter.sendMail({
        from: env.smtpFrom,
        to: payload.recipientEmail,
        subject: 'Reset your ImpactLoop password',
        text:
          'Use this link to reset your ImpactLoop password. ' +
          `It expires at ${payload.expiresAt.toISOString()}.\n\n` +
          `${payload.resetLink}\n\n` +
          'If you did not request this reset, you can ignore this email.',
        html:
          '<p>Use this link to reset your ImpactLoop password.</p>' +
          `<p><a href="${resetLink}">Reset your password</a></p>` +
          `<p>This link expires at ${expiresAt}.</p>` +
          '<p>If you did not request this reset, you can ignore this email.</p>',
      });

      return { status: 'SENT' };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Password reset email failed';
      return {
        status: 'FAILED',
        sendError: sanitizeSmtpError(message),
      };
    }
  }

  async sendPasswordChangedEmail(
    payload: PasswordChangedEmailPayload,
  ): Promise<EmailSendResult> {
    const configurationErrors = getSmtpConfigurationErrors();

    if (configurationErrors.length > 0) {
      return {
        status: 'FAILED',
        sendError: configurationErrors.join('; '),
      };
    }

    try {
      await this.transporter.sendMail({
        from: env.smtpFrom,
        to: payload.recipientEmail,
        subject: 'Your ImpactLoop password was changed',
        text:
          'Your ImpactLoop password was changed. ' +
          'If this was not you, contact support immediately.',
        html:
          '<p>Your ImpactLoop password was changed.</p>' +
          '<p>If this was not you, contact support immediately.</p>',
      });

      return { status: 'SENT' };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Password changed email failed';
      return {
        status: 'FAILED',
        sendError: sanitizeSmtpError(message),
      };
    }
  }

  async sendEmailVerificationEmail(
    payload: EmailVerificationEmailPayload,
  ): Promise<EmailSendResult> {
    const configurationErrors = getSmtpConfigurationErrors();

    if (configurationErrors.length > 0) {
      return {
        status: 'FAILED',
        sendError: configurationErrors.join('; '),
      };
    }

    const verificationLink = escapeHtml(payload.verificationLink);
    const expiresAt = escapeHtml(payload.expiresAt.toISOString());

    try {
      await this.transporter.sendMail({
        from: env.smtpFrom,
        to: payload.recipientEmail,
        subject: 'Verify your ImpactLoop email',
        text:
          'Use this link to verify your ImpactLoop email address. ' +
          `It expires at ${payload.expiresAt.toISOString()}.\n\n` +
          `${payload.verificationLink}\n\n` +
          'If you did not create this account, you can ignore this email.',
        html:
          '<p>Use this link to verify your ImpactLoop email address.</p>' +
          `<p><a href="${verificationLink}">Verify your email</a></p>` +
          `<p>This link expires at ${expiresAt}.</p>` +
          '<p>If you did not create this account, you can ignore this email.</p>',
      });

      return { status: 'SENT' };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Email verification email failed';
      return {
        status: 'FAILED',
        sendError: sanitizeSmtpError(message),
      };
    }
  }
}
