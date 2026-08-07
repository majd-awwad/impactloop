import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import {
  checkRateLimit,
  resetRateLimitersForTests,
} from '../../middlewares/rate-limit.middleware.js';
import { AppError } from '../../utils/app-error.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { generateOpaqueToken, hashToken } from '../../utils/token.js';

import type {
  AuthEmailProvider,
  EmailSendResult,
  PasswordChangedEmailPayload,
  PasswordResetEmailPayload,
} from './email/auth-email-provider.js';
import {
  resetAuthEmailProviderForTests,
  setAuthEmailProviderForTests,
} from './email/index.js';
import {
  requestPasswordReset,
  resetPasswordWithToken,
} from './auth.service.js';

const TEST_MARKER = 'test-password-reset';

const ids = {
  users: [] as string[],
};

class RecordingAuthEmailProvider implements AuthEmailProvider {
  passwordResetEmails: PasswordResetEmailPayload[] = [];
  passwordChangedEmails: PasswordChangedEmailPayload[] = [];

  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<EmailSendResult> {
    this.passwordResetEmails.push(payload);
    return { status: 'SENT' };
  }

  async sendPasswordChangedEmail(
    payload: PasswordChangedEmailPayload,
  ): Promise<EmailSendResult> {
    this.passwordChangedEmails.push(payload);
    return { status: 'SENT' };
  }
}

async function createLearnerUser() {
  const passwordHash = await hashPassword('OldPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: 'Password Reset Test User',
      email: `${TEST_MARKER}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: {
        create: [{ role: 'LEARNER', isPrimary: true }],
      },
    },
  });

  ids.users.push(user.id);
  return user;
}

function latestResetToken(provider: RecordingAuthEmailProvider): string {
  const latest = provider.passwordResetEmails.at(-1);
  assert.ok(latest);

  const token = new URL(latest.resetLink).searchParams.get('token');
  assert.ok(token);
  return token;
}

async function createPasswordResetToken(input: {
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt?: Date | null;
}) {
  return prisma.authToken.create({
    data: {
      userId: input.userId,
      tokenHash: hashToken(input.token),
      tokenType: 'PASSWORD_RESET',
      target: `${TEST_MARKER}@impactloop.test`,
      expiresAt: input.expiresAt,
      usedAt: input.usedAt ?? null,
    },
  });
}

before(() => {
  env.appPublicBaseUrl = 'http://localhost:53077';
  env.passwordResetExpiresIn = '30m';
});

beforeEach(() => {
  resetRateLimitersForTests();
  setAuthEmailProviderForTests(new RecordingAuthEmailProvider());
});

after(async () => {
  resetAuthEmailProviderForTests();
  resetRateLimitersForTests();

  if (ids.users.length > 0) {
    await prisma.authToken.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('password reset security', () => {
  test('forgot password returns generic response for existing and missing emails', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerUser();

    const existing = await requestPasswordReset(user.email);
    const missing = await requestPasswordReset(
      `${TEST_MARKER}-missing@impactloop.test`,
    );

    assert.deepEqual(existing, missing);
    assert.equal(
      existing.message,
      'If an account with that email exists, password reset instructions have been sent.',
    );
    assert.equal(provider.passwordResetEmails.length, 1);
    assert.equal(provider.passwordResetEmails[0]!.recipientEmail, user.email);
  });

  test('reset token is stored hashed and not returned by the service', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerUser();

    const response = await requestPasswordReset(user.email);
    const token = latestResetToken(provider);

    assert.equal(Object.hasOwn(response, 'resetToken'), false);

    const stored = await prisma.authToken.findFirstOrThrow({
      where: { userId: user.id, tokenType: 'PASSWORD_RESET' },
      orderBy: { createdAt: 'desc' },
    });

    assert.equal(stored.tokenHash, hashToken(token));
    assert.notEqual(stored.tokenHash, token);
  });

  test('requesting a new reset invalidates older reset tokens', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerUser();

    await requestPasswordReset(user.email);
    const firstToken = latestResetToken(provider);
    await requestPasswordReset(user.email);
    const secondToken = latestResetToken(provider);

    const first = await prisma.authToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(firstToken) },
    });
    const second = await prisma.authToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(secondToken) },
    });

    assert.ok(first.usedAt);
    assert.equal(second.usedAt, null);
  });

  test('expired and used reset tokens are rejected safely', async () => {
    const user = await createLearnerUser();
    const expiredToken = generateOpaqueToken();
    const usedToken = generateOpaqueToken();

    await createPasswordResetToken({
      userId: user.id,
      token: expiredToken,
      expiresAt: new Date(Date.now() - 60_000),
    });
    await createPasswordResetToken({
      userId: user.id,
      token: usedToken,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
    });

    await assert.rejects(
      () => resetPasswordWithToken(expiredToken, 'NewPassword123!'),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.code === 'VALIDATION_ERROR',
    );
    await assert.rejects(
      () => resetPasswordWithToken(usedToken, 'NewPassword123!'),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.code === 'VALIDATION_ERROR',
    );
  });

  test('parallel reset with same token applies only one password change', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerUser();

    await requestPasswordReset(user.email);
    const resetToken = latestResetToken(provider);

    const results = await Promise.allSettled([
      resetPasswordWithToken(resetToken, 'NewPassword123!'),
      resetPasswordWithToken(resetToken, 'DifferentPassword123!'),
    ]);

    const successes = results.filter((result) => result.status === 'fulfilled');
    const failures = results.filter((result) => result.status === 'rejected');

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);

    const rejected = failures[0] as PromiseRejectedResult;
    assert.ok(rejected.reason instanceof AppError);
    assert.equal(rejected.reason.statusCode, 400);
    assert.equal(rejected.reason.code, 'VALIDATION_ERROR');

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    const matchesNew = await comparePassword(
      'NewPassword123!',
      updatedUser.passwordHash,
    );
    const matchesDifferent = await comparePassword(
      'DifferentPassword123!',
      updatedUser.passwordHash,
    );
    assert.equal(matchesNew || matchesDifferent, true);
    assert.equal(matchesNew && matchesDifferent, false);

    assert.equal(provider.passwordChangedEmails.length, 1);
  });

  test('successful reset marks token used, updates password, revokes refresh tokens, and sends notification', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerUser();
    const activeRefreshToken = generateOpaqueToken();

    await prisma.authToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(activeRefreshToken),
        tokenType: 'REFRESH_TOKEN',
        target: user.email,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await requestPasswordReset(user.email);
    const resetToken = latestResetToken(provider);

    const result = await resetPasswordWithToken(
      resetToken,
      'NewPassword123!',
    );

    assert.equal(result, undefined);

    const storedResetToken = await prisma.authToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(resetToken) },
    });
    assert.ok(storedResetToken.usedAt);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    assert.equal(
      await comparePassword('NewPassword123!', updatedUser.passwordHash),
      true,
    );

    const storedRefreshToken = await prisma.authToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(activeRefreshToken) },
    });
    assert.ok(storedRefreshToken.usedAt);
    assert.equal(provider.passwordChangedEmails.length, 1);
    assert.equal(provider.passwordChangedEmails[0]!.recipientEmail, user.email);
  });

  test('rate limiter blocks repeated requests for the same IP or account key', () => {
    const policy = { name: 'test-password-reset', windowMs: 60_000, max: 1 };

    checkRateLimit('ip:127.0.0.1', policy);
    assert.throws(
      () => checkRateLimit('ip:127.0.0.1', policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );

    checkRateLimit('email:user@example.com', policy);
    assert.throws(
      () => checkRateLimit('email:user@example.com', policy),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 429 &&
        error.code === 'RATE_LIMITED',
    );
  });
});
