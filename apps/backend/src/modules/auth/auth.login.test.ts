import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { hashToken } from '../../utils/token.js';
import { verifyAccessToken } from '../../utils/jwt.js';

import { loginUser } from './auth.service.js';

const TEST_MARKER = 'test-auth-login';

const PG_CONCURRENT_QUERY_WARNING =
  'Calling client.query() when the client is already executing a query is deprecated';

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

async function createLoginTestUser(password = 'LoginTestPassword123!') {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      displayName: 'Login Test User',
      email: `${TEST_MARKER}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: {
        create: [{ role: 'LEARNER', isPrimary: true }],
      },
      learnerProfile: {
        create: {
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: ['recycling'],
        },
      },
    },
  });

  ids.users.push(user.id);
  return { user, password };
}

describe('auth login', () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  test('successful login returns session tokens and updates lastLoginAt', async () => {
    const { user, password } = await createLoginTestUser();
    const beforeLogin = Date.now();

    const session = await loginUser({
      email: user.email,
      password,
    });

    assert.ok(session.accessToken);
    assert.ok(session.refreshToken);
    assert.equal(session.user.id, user.id);
    assert.equal(session.user.email, user.email);
    assert.deepEqual(session.user.roles, ['LEARNER']);
    assert.ok(session.user.lastLoginAt);

    const lastLoginAt = Date.parse(session.user.lastLoginAt!);
    assert.ok(lastLoginAt >= beforeLogin);

    const storedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastLoginAt: true },
    });
    assert.equal(
      storedUser?.lastLoginAt?.toISOString(),
      session.user.lastLoginAt,
    );

    const accessPayload = verifyAccessToken(session.accessToken);
    assert.equal(accessPayload.sub, user.id);
    assert.deepEqual(accessPayload.roles, ['LEARNER']);

    const storedRefreshToken = await prisma.authToken.findFirst({
      where: {
        userId: user.id,
        tokenHash: hashToken(session.refreshToken),
        tokenType: 'REFRESH_TOKEN',
        usedAt: null,
      },
    });
    assert.ok(storedRefreshToken);
  });

  test('invalid password returns UNAUTHENTICATED without creating refresh token', async () => {
    const { user, password } = await createLoginTestUser();
    const refreshTokensBefore = await prisma.authToken.count({
      where: { userId: user.id, tokenType: 'REFRESH_TOKEN' },
    });
    const userBefore = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastLoginAt: true },
    });

    await assert.rejects(
      () =>
        loginUser({
          email: user.email,
          password: `${password}-wrong`,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 401);
        assert.equal(error.code, 'UNAUTHENTICATED');
        assert.equal(error.message, 'Invalid email or password');
        return true;
      },
    );

    const refreshTokensAfter = await prisma.authToken.count({
      where: { userId: user.id, tokenType: 'REFRESH_TOKEN' },
    });
    assert.equal(refreshTokensAfter, refreshTokensBefore);

    const userAfter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { lastLoginAt: true },
    });
    assert.equal(userAfter?.lastLoginAt, userBefore?.lastLoginAt);
  });

  test('successful login does not reload user relations after lastLoginAt update', async () => {
    const { user, password } = await createLoginTestUser();
    const originalFindUnique = prisma.user.findUnique.bind(prisma.user);
    let findUniqueCallCount = 0;

    prisma.user.findUnique = ((...args: Parameters<typeof originalFindUnique>) => {
      findUniqueCallCount += 1;
      return originalFindUnique(...args);
    }) as typeof prisma.user.findUnique;

    try {
      const session = await loginUser({
        email: user.email,
        password,
      });

      assert.equal(findUniqueCallCount, 1);
      assert.ok(session.user.learnerProfile);
      assert.deepEqual(session.user.roles, ['LEARNER']);
    } finally {
      prisma.user.findUnique = originalFindUnique;
    }
  });

  test('login does not emit pg concurrent client.query deprecation warning', async () => {
    const { user, password } = await createLoginTestUser();
    const deprecationWarnings: string[] = [];

    const onWarning = (warning: Error) => {
      if (warning.name === 'DeprecationWarning') {
        deprecationWarnings.push(warning.message);
      }
    };

    process.on('warning', onWarning);

    try {
      await loginUser({
        email: user.email,
        password,
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
