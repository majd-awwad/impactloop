import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashToken } from '../../utils/token.js';

import { registerUser } from './auth.service.js';

const TEST_MARKER = 'test-auth-register';

const PG_CONCURRENT_QUERY_WARNING =
  'Calling client.query() when the client is already executing a query is deprecated';

const ids = {
  users: [] as string[],
};

async function cleanup() {
  if (ids.users.length === 0) {
    return;
  }

  await prisma.user.deleteMany({
    where: { id: { in: ids.users } },
  });
  ids.users.length = 0;
}

function testEmail(suffix: string): string {
  return `${TEST_MARKER}-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`;
}

describe('auth registration', () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  test('registers a supplier-only account with active supplier role', async () => {
    const session = await registerUser({
      displayName: 'Supplier Registration Test',
      email: testEmail('supplier-only'),
      password: 'TestPassword123!',
      roles: ['SUPPLIER'],
      supplierProfile: {
        supplierType: 'Workshop',
        publicName: 'Registration Workshop',
        pickupArea: 'Nablus, Rafidia',
      },
    });
    ids.users.push(session.user.id);

    assert.deepEqual(session.user.roles, ['SUPPLIER']);
    assert.equal(session.user.activeRole, 'SUPPLIER');
    assert.equal(session.user.learnerProfile, null);
    assert.equal(session.user.supplierProfile?.supplierType, 'WORKSHOP');
    assert.equal(session.user.supplierProfile?.publicName, 'Registration Workshop');
    assert.equal(session.user.supplierProfile?.pickupAreaLabel, 'Nablus, Rafidia');
  });

  test('registers a dual learner and supplier account with learner as active role', async () => {
    const session = await registerUser({
      displayName: 'Dual Registration Test',
      email: testEmail('dual-role'),
      password: 'TestPassword123!',
      roles: ['LEARNER', 'SUPPLIER'],
      learnerProfile: {
        learnerType: 'University student',
        skillLevel: 'Beginner',
        interests: ['Home improvement', 'Recycling'],
      },
      supplierProfile: {
        supplierType: 'Student supplier',
        publicName: 'Student Surplus Shelf',
        pickupArea: 'Ramallah, Al Tireh',
      },
    });
    ids.users.push(session.user.id);

    assert.deepEqual(session.user.roles.sort(), ['LEARNER', 'SUPPLIER']);
    assert.equal(session.user.activeRole, 'LEARNER');
    assert.equal(session.user.learnerProfile?.learnerType, 'University student');
    assert.deepEqual(session.user.learnerProfile?.interests, [
      'home_diy',
      'recycling',
    ]);
    assert.equal(session.user.supplierProfile?.supplierType, 'STUDENT_SUPPLIER');
    assert.equal(session.user.supplierProfile?.verificationStatus, 'NOT_REQUIRED');
    assert.equal(session.user.emailVerificationRequired, true);
    assert.equal(session.user.emailVerifiedAt, null);
  });

  test('duplicate email returns a field-specific conflict', async () => {
    const email = testEmail('duplicate');
    const input = {
      displayName: 'Duplicate Registration Test',
      email,
      password: 'TestPassword123!',
      roles: ['LEARNER'] as const,
      learnerProfile: {
        learnerType: 'University student',
        skillLevel: 'Beginner',
        interests: ['Recycling'],
      },
    };
    const registrationInput = {
      ...input,
      roles: [...input.roles],
    };

    const session = await registerUser(registrationInput);
    ids.users.push(session.user.id);

    await assert.rejects(
      () => registerUser(registrationInput),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'AUTH_EMAIL_ALREADY_REGISTERED');
        assert.equal(error.message, 'Email is already registered');
        return true;
      },
    );
  });

  test('duplicate phone returns a field-specific conflict', async () => {
    const phone = `+97059${Date.now().toString().slice(-7)}`;
    const input = {
      displayName: 'Duplicate Phone Registration Test',
      password: 'TestPassword123!',
      phone,
      roles: ['LEARNER'] as const,
      learnerProfile: {
        learnerType: 'University student',
        skillLevel: 'Beginner',
        interests: ['Recycling'],
      },
    };

    const session = await registerUser({
      ...input,
      email: testEmail('duplicate-phone-first'),
      roles: [...input.roles],
    });
    ids.users.push(session.user.id);

    await assert.rejects(
      () =>
        registerUser({
          ...input,
          email: testEmail('duplicate-phone-second'),
          roles: [...input.roles],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'AUTH_PHONE_ALREADY_REGISTERED');
        assert.equal(error.message, 'Phone number is already registered');
        return true;
      },
    );
  });

  test('registration does not emit pg concurrent client.query deprecation warning', async () => {
    const deprecationWarnings: string[] = [];

    const onWarning = (warning: Error) => {
      if (warning.name === 'DeprecationWarning') {
        deprecationWarnings.push(warning.message);
      }
    };

    process.on('warning', onWarning);

    try {
      const session = await registerUser({
        displayName: 'Registration Warning Test',
        email: testEmail('no-deprecation'),
        password: 'TestPassword123!',
        roles: ['LEARNER'],
        learnerProfile: {
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: ['recycling'],
        },
      });
      ids.users.push(session.user.id);

      assert.ok(session.accessToken);
      assert.ok(session.refreshToken);

      const storedRefreshToken = await prisma.authToken.findFirst({
        where: {
          userId: session.user.id,
          tokenHash: hashToken(session.refreshToken),
          tokenType: 'REFRESH_TOKEN',
          usedAt: null,
        },
      });
      assert.ok(storedRefreshToken);
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
