import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { after, beforeEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { generateOpaqueToken, hashToken } from '../../utils/token.js';
import { verifyAccessToken } from '../../utils/jwt.js';

import type {
  AuthEmailProvider,
  EmailSendResult,
  EmailVerificationEmailPayload,
  PasswordChangedEmailPayload,
  PasswordResetEmailPayload,
} from './email/auth-email-provider.js';
import {
  resetAuthEmailProviderForTests,
  setAuthEmailProviderForTests,
} from './email/index.js';
import {
  CLIENT_PLATFORM_HEADER,
  sendAuthSessionResponse,
} from './auth-token-delivery.js';
import {
  changePasswordForUser,
  refreshAuthSession,
} from './auth.service.js';
import { changePasswordSchema } from './auth.validation.js';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';

const TEST_MARKER = 'test-change-password';

const PG_CONCURRENT_QUERY_WARNING =
  'Calling client.query() when the client is already executing a query is deprecated';

const ids = {
  users: [] as string[],
};

class RecordingAuthEmailProvider implements AuthEmailProvider {
  passwordResetEmails: PasswordResetEmailPayload[] = [];
  passwordChangedEmails: PasswordChangedEmailPayload[] = [];
  mode: 'success' | 'failure' = 'success';

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
    if (this.mode === 'failure') {
      return { status: 'FAILED', sendError: 'SMTP unavailable' };
    }
    return { status: 'SENT' };
  }

  async sendEmailVerificationEmail(
    _payload: EmailVerificationEmailPayload,
  ): Promise<EmailSendResult> {
    return { status: 'SENT' };
  }
}

async function createLearnerUser(password = 'OldPassword123!') {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      displayName: 'Change Password Test User',
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

async function createRefreshTokenForUser(userId: string, email: string) {
  const refreshToken = generateOpaqueToken();
  await prisma.authToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      tokenType: 'REFRESH_TOKEN',
      target: email,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return refreshToken;
}

async function countActiveRefreshTokens(userId: string): Promise<number> {
  return prisma.authToken.count({
    where: {
      userId,
      tokenType: 'REFRESH_TOKEN',
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

beforeEach(() => {
  resetAuthEmailProviderForTests();
  setAuthEmailProviderForTests(new RecordingAuthEmailProvider());
});

after(async () => {
  resetAuthEmailProviderForTests();

  if (ids.users.length > 0) {
    await prisma.authToken.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('change password session revocation', () => {
  test('correct current password changes hash and returns fresh session', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerUser();
    const oldRefresh = await createRefreshTokenForUser(user.id, user.email);

    const session = await changePasswordForUser(user.id, {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    });

    assert.equal(session.user.id, user.id);
    assert.deepEqual(session.user.roles, ['LEARNER']);
    assert.notEqual(session.accessToken, '');
    assert.notEqual(session.refreshToken, oldRefresh);

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    assert.equal(
      await comparePassword('NewPassword123!', updatedUser.passwordHash),
      true,
    );

    const oldStored = await prisma.authToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(oldRefresh) },
    });
    assert.ok(oldStored.usedAt);

    assert.equal(await countActiveRefreshTokens(user.id), 1);
    assert.equal(provider.passwordChangedEmails.length, 1);
    assert.equal(provider.passwordChangedEmails[0]!.recipientEmail, user.email);
  });

  test('incorrect current password is rejected and sessions stay active', async () => {
    const user = await createLearnerUser();
    const oldRefresh = await createRefreshTokenForUser(user.id, user.email);

    await assert.rejects(
      () =>
        changePasswordForUser(user.id, {
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!',
          confirmNewPassword: 'NewPassword123!',
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.code === 'VALIDATION_ERROR',
    );

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    assert.equal(
      await comparePassword('OldPassword123!', updatedUser.passwordHash),
      true,
    );

    const oldStored = await prisma.authToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(oldRefresh) },
    });
    assert.equal(oldStored.usedAt, null);
    assert.equal(await countActiveRefreshTokens(user.id), 1);
  });

  test('new password equal to current password is rejected by validation schema', () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: 'SamePassword123!',
      newPassword: 'SamePassword123!',
      confirmNewPassword: 'SamePassword123!',
    });

    assert.equal(parsed.success, false);
  });

  test('all pre-existing refresh tokens are revoked and exactly one remains', async () => {
    const user = await createLearnerUser();
    const deviceA = await createRefreshTokenForUser(user.id, user.email);
    const deviceB = await createRefreshTokenForUser(user.id, user.email);

    const session = await changePasswordForUser(user.id, {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    });

    for (const token of [deviceA, deviceB]) {
      const stored = await prisma.authToken.findUniqueOrThrow({
        where: { tokenHash: hashToken(token) },
      });
      assert.ok(stored.usedAt);
    }

    assert.equal(await countActiveRefreshTokens(user.id), 1);

    const activeTokens = await prisma.authToken.findMany({
      where: {
        userId: user.id,
        tokenType: 'REFRESH_TOKEN',
        usedAt: null,
      },
    });
    assert.equal(activeTokens.length, 1);
    assert.equal(activeTokens[0]!.tokenHash, hashToken(session.refreshToken));
  });

  test('returned access token matches current user roles', async () => {
    const user = await createLearnerUser();

    const session = await changePasswordForUser(user.id, {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    });

    const payload = verifyAccessToken(session.accessToken);
    assert.equal(payload.sub, user.id);
    assert.deepEqual(payload.roles, ['LEARNER']);
  });

  test('old refresh token from another device is rejected after password change', async () => {
    const user = await createLearnerUser();
    const oldRefresh = await createRefreshTokenForUser(user.id, user.email);

    const session = await changePasswordForUser(user.id, {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    });

    await assert.rejects(
      () => refreshAuthSession(oldRefresh),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 401 &&
        error.code === 'UNAUTHENTICATED',
    );

    const rotated = await refreshAuthSession(session.refreshToken);
    assert.ok(rotated.accessToken);
    assert.ok(rotated.refreshToken);
  });

  test('password hash update and refresh revocation are atomic on repository failure', async () => {
    const user = await createLearnerUser();
    const oldRefresh = await createRefreshTokenForUser(user.id, user.email);

    const originalTransaction = prisma.$transaction.bind(prisma);
    prisma.$transaction = (async () => {
      throw new Error('simulated transaction failure');
    }) as typeof prisma.$transaction;

    try {
      await assert.rejects(
        () =>
          changePasswordForUser(user.id, {
            currentPassword: 'OldPassword123!',
            newPassword: 'NewPassword123!',
            confirmNewPassword: 'NewPassword123!',
          }),
        /simulated transaction failure/,
      );
    } finally {
      prisma.$transaction = originalTransaction;
    }

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    assert.equal(
      await comparePassword('OldPassword123!', updatedUser.passwordHash),
      true,
    );

    const oldStored = await prisma.authToken.findUniqueOrThrow({
      where: { tokenHash: hashToken(oldRefresh) },
    });
    assert.equal(oldStored.usedAt, null);
    assert.equal(await countActiveRefreshTokens(user.id), 1);
  });

  test('password-changed email failure does not roll back password or session change', async () => {
    const provider = new RecordingAuthEmailProvider();
    provider.mode = 'failure';
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerUser();

    const session = await changePasswordForUser(user.id, {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    });

    const updatedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    assert.equal(
      await comparePassword('NewPassword123!', updatedUser.passwordHash),
      true,
    );
    assert.equal(await countActiveRefreshTokens(user.id), 1);
    assert.ok(session.accessToken);
    assert.equal(provider.passwordChangedEmails.length, 1);
  });

  test('change password does not emit pg concurrent client.query deprecation warning', async () => {
    const user = await createLearnerUser();
    const deprecationWarnings: string[] = [];

    const onWarning = (warning: Error) => {
      if (warning.name === 'DeprecationWarning') {
        deprecationWarnings.push(warning.message);
      }
    };

    process.on('warning', onWarning);

    try {
      await changePasswordForUser(user.id, {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        confirmNewPassword: 'NewPassword123!',
      });
    } finally {
      process.off('warning', onWarning);
    }

    assert.equal(
      deprecationWarnings.some((message) =>
        message.includes(PG_CONCURRENT_QUERY_WARNING),
      ),
      false,
      `Unexpected deprecation warnings: ${deprecationWarnings.join('; ')}`,
    );
  });
});

describe('change password response delivery', () => {
  test('web response omits refresh token JSON and sets httpOnly cookie', async () => {
    const user = await createLearnerUser();
    const session = await changePasswordForUser(user.id, {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    });

    const req = {
      headers: { [CLIENT_PLATFORM_HEADER]: 'web' },
    } as unknown as Request;

    let statusCode = 0;
    let jsonBody: Record<string, unknown> | undefined;
    const cookies: Record<string, { value: string; options: Record<string, unknown> }> =
      {};

    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: Record<string, unknown>) {
        jsonBody = body;
      },
      cookie(name: string, value: string, options: Record<string, unknown>) {
        cookies[name] = { value, options };
      },
    } as unknown as Response;

    sendAuthSessionResponse(req, res, 'Password updated successfully.', session);

    assert.equal(statusCode, 200);
    assert.ok(jsonBody);
    assert.equal(jsonBody.success, true);
    const data = jsonBody.data as Record<string, unknown>;
    assert.ok(data.accessToken);
    assert.ok(data.user);
    assert.equal(Object.hasOwn(data, 'refreshToken'), false);
    assert.ok(cookies.refreshToken);
    assert.equal(cookies.refreshToken.options.httpOnly, true);
    assert.equal(cookies.refreshToken.options.sameSite, 'lax');
    assert.equal(cookies.refreshToken.options.path, '/api/auth');
  });

  test('mobile response includes refresh token in JSON', async () => {
    const user = await createLearnerUser();
    const session = await changePasswordForUser(user.id, {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    });

    const req = {
      headers: { [CLIENT_PLATFORM_HEADER]: 'mobile' },
    } as unknown as Request;

    let jsonBody: Record<string, unknown> | undefined;
    const res = {
      status() {
        return this;
      },
      json(body: Record<string, unknown>) {
        jsonBody = body;
      },
      cookie() {},
    } as unknown as Response;

    sendAuthSessionResponse(req, res, 'Password updated successfully.', session);

    const data = jsonBody!.data as Record<string, unknown>;
    assert.ok(data.refreshToken);
    assert.ok(data.accessToken);
    assert.ok(data.user);
  });
});

describe('change password route protection', () => {
  test('change-password route is declared behind authMiddleware', () => {
    const routesSource = readFileSync(
      fileURLToPath(new URL('./auth.routes.ts', import.meta.url)),
      'utf8',
    );

    assert.match(
      routesSource,
      /authRouter\.patch\([\s\S]*?\/change-password[\s\S]*?authMiddleware/,
    );
  });
});
