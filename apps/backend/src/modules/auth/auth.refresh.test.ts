import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { hashToken } from '../../utils/token.js';
import { verifyAccessToken } from '../../utils/jwt.js';

import * as authRepository from './auth.repository.js';
import { loginUser, refreshAuthSession } from './auth.service.js';

const TEST_MARKER = 'test-auth-refresh';

const ids = {
  users: [] as string[],
};

async function cleanup() {
  if (ids.users.length === 0) {
    return;
  }

  await prisma.authToken.deleteMany({
    where: { userId: { in: ids.users } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: ids.users } },
  });
  ids.users.length = 0;
}

async function createLoginTestUser(password = 'RefreshTestPassword123!') {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      displayName: 'Refresh Test User',
      email: `${TEST_MARKER}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: {
        create: [{ role: 'LEARNER', isPrimary: true }],
      },
    },
  });

  ids.users.push(user.id);
  return { user, password };
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

describe('auth refresh', () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  test('successful refresh rotates token and returns new session', async () => {
    const { user, password } = await createLoginTestUser();
    const session = await loginUser({ email: user.email, password });

    const refreshed = await refreshAuthSession(session.refreshToken);

    assert.ok(refreshed.accessToken);
    assert.ok(refreshed.refreshToken);
    assert.notEqual(refreshed.refreshToken, session.refreshToken);

    const accessPayload = verifyAccessToken(refreshed.accessToken);
    assert.equal(accessPayload.sub, user.id);

    const oldStored = await prisma.authToken.findFirst({
      where: { tokenHash: hashToken(session.refreshToken) },
    });
    assert.ok(oldStored?.usedAt);

    const newStored = await prisma.authToken.findFirst({
      where: {
        tokenHash: hashToken(refreshed.refreshToken),
        usedAt: null,
      },
    });
    assert.ok(newStored);

    assert.equal(await countActiveRefreshTokens(user.id), 1);
  });

  test('parallel refresh with same token mints only one successor', async () => {
    const { user, password } = await createLoginTestUser();
    const session = await loginUser({ email: user.email, password });

    const results = await Promise.allSettled([
      refreshAuthSession(session.refreshToken),
      refreshAuthSession(session.refreshToken),
    ]);

    const successes = results.filter((result) => result.status === 'fulfilled');
    const failures = results.filter((result) => result.status === 'rejected');

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);

    const rejected = failures[0] as PromiseRejectedResult;
    assert.ok(rejected.reason instanceof AppError);
    assert.equal(rejected.reason.statusCode, 401);

    assert.equal(await countActiveRefreshTokens(user.id), 1);

    const oldStored = await prisma.authToken.findFirst({
      where: { tokenHash: hashToken(session.refreshToken) },
    });
    assert.ok(oldStored?.usedAt);
  });

  test('rotation transaction does not reload user profiles before creating successor', async () => {
    const originalTransaction = prisma.$transaction.bind(prisma);
    let userReadAttempted = false;
    let createdTarget: string | null = null;

    prisma.$transaction = (async (
      callback: (tx: {
        authToken: {
          updateMany: () => Promise<{ count: number }>;
          create: (input: { data: { target: string } }) => Promise<void>;
        };
        user: { findUnique: () => Promise<never> };
      }) => Promise<unknown>,
    ) => callback({
      authToken: {
        updateMany: async () => ({ count: 1 }),
        create: async (input) => {
          createdTarget = input.data.target;
        },
      },
      user: {
        findUnique: async () => {
          userReadAttempted = true;
          throw new Error('user/profile reload must stay outside token rotation');
        },
      },
    })) as typeof prisma.$transaction;

    try {
      const rotated = await authRepository.rotateRefreshToken({
        userId: 'refresh-user',
        tokenHash: 'old-token-hash',
        successorTokenHash: 'new-token-hash',
        successorExpiresAt: new Date(Date.now() + 60_000),
        target: 'refresh-user@impactloop.test',
      });

      assert.equal(rotated, true);
      assert.equal(userReadAttempted, false);
      assert.equal(createdTarget, 'refresh-user@impactloop.test');
    } finally {
      prisma.$transaction = originalTransaction;
    }
  });

  test('refresh token rotation is atomic on repository failure', async () => {
    const { user, password } = await createLoginTestUser();
    const session = await loginUser({ email: user.email, password });

    const originalTransaction = prisma.$transaction.bind(prisma);
    prisma.$transaction = (async () => {
      throw new Error('simulated transaction failure');
    }) as typeof prisma.$transaction;

    try {
      await assert.rejects(
        () => refreshAuthSession(session.refreshToken),
        /simulated transaction failure/,
      );
    } finally {
      prisma.$transaction = originalTransaction;
    }

    const stored = await prisma.authToken.findFirst({
      where: { tokenHash: hashToken(session.refreshToken) },
    });
    assert.equal(stored?.usedAt, null);
    assert.equal(await countActiveRefreshTokens(user.id), 1);
  });
});
