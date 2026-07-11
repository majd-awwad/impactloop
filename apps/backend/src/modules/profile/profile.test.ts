import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { getAuthenticatedUser } from '../auth/auth.service.js';

import {
  updateLearnerProfileForUser,
  updateProfileForUser,
} from './profile.service.js';

const TEST_MARKER = '[test-profile]';

const ids = {
  users: [] as string[],
};

async function createLearnerUser(input?: {
  phone?: string | null;
  phoneVerifiedAt?: Date | null;
}) {
  const passwordHash = await hashPassword('TestPassword123!');

  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner`,
      email: `${TEST_MARKER}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      phone: input?.phone ?? null,
      phoneVerifiedAt: input?.phoneVerifiedAt ?? null,
      roles: {
        create: [{ role: 'LEARNER', isPrimary: true }],
      },
      learnerProfile: {
        create: {
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: ['Robotics'],
          bio: 'Initial bio',
        },
      },
    },
  });

  ids.users.push(user.id);
  return user;
}

before(() => {
  process.env.JWT_ACCESS_SECRET ??= 'test-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret';
});

after(async () => {
  if (ids.users.length === 0) {
    return;
  }

  await prisma.learnerProfile.deleteMany({
    where: { userId: { in: ids.users } },
  });
  await prisma.userRoleAssignment.deleteMany({
    where: { userId: { in: ids.users } },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
});

describe('profile updates', () => {
  test('updates display name and profile image url', async () => {
    const user = await createLearnerUser();
    const imageUrl = '/uploads/profiles/profile_test.webp';

    const updated = await updateProfileForUser(user.id, {
      displayName: 'Updated Name',
      profileImageUrl: imageUrl,
    });

    assert.equal(updated.displayName, 'Updated Name');
    assert.equal(updated.profileImageUrl, imageUrl);
  });

  test('rejects invalid profile image urls', async () => {
    const user = await createLearnerUser();

    await assert.rejects(
      () =>
        updateProfileForUser(user.id, {
          profileImageUrl: '/uploads/materials/not-allowed.webp',
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        return true;
      },
    );
  });

  test('updates display name when phone is omitted', async () => {
    const user = await createLearnerUser({ phone: '+970599000099' });

    const updated = await updateProfileForUser(user.id, {
      displayName: 'Name Only Update',
    });

    assert.equal(updated.displayName, 'Name Only Update');
    assert.equal(updated.phone, '+970599000099');
  });

  test('clears phone when phone is null', async () => {
    const user = await createLearnerUser({
      phone: '+970599000030',
      phoneVerifiedAt: new Date(),
    });

    const updated = await updateProfileForUser(user.id, {
      phone: null,
    });

    assert.equal(updated.phone, null);
    assert.equal(updated.phoneVerifiedAt, null);
  });

  test('treats empty phone string as null', async () => {
    const user = await createLearnerUser({ phone: '+970599000031' });

    const updated = await updateProfileForUser(user.id, {
      phone: '',
    });

    assert.equal(updated.phone, null);
  });

  test('changing phone clears phoneVerifiedAt', async () => {
    const user = await createLearnerUser({
      phone: '+970599000001',
      phoneVerifiedAt: new Date(),
    });

    const updated = await updateProfileForUser(user.id, {
      phone: '+970599000002',
    });

    assert.equal(updated.phone, '+970599000002');
    assert.equal(updated.phoneVerifiedAt, null);
  });

  test('rejects duplicate phone numbers', async () => {
    const first = await createLearnerUser({ phone: '+970599000010' });
    const second = await createLearnerUser();

    await assert.rejects(
      () =>
        updateProfileForUser(second.id, {
          phone: '+970599000010',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );

    const unchanged = await getAuthenticatedUser(first.id);
    assert.equal(unchanged.phone, '+970599000010');
  });

  test('updates learner profile fields', async () => {
    const user = await createLearnerUser();

    const updated = await updateLearnerProfileForUser(user.id, {
      learnerType: 'Self learner',
      skillLevel: 'Advanced',
      interests: ['electronics', 'circuits'],
      bio: 'Updated learner bio',
    });

    assert.ok(updated.learnerProfile);
    assert.equal(updated.learnerProfile?.learnerType, 'Self learner');
    assert.equal(updated.learnerProfile?.skillLevel, 'Advanced');
    assert.deepEqual(updated.learnerProfile?.interests, [
      'electronics',
      'circuits',
    ]);
    assert.equal(updated.learnerProfile?.bio, 'Updated learner bio');
  });

  test('getAuthenticatedUser includes phoneVerifiedAt and lastLoginAt', async () => {
    const user = await createLearnerUser({
      phone: '+970599000020',
      phoneVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date('2026-02-01T00:00:00.000Z') },
    });

    const loaded = await getAuthenticatedUser(user.id);

    assert.ok(loaded.phoneVerifiedAt);
    assert.ok(loaded.lastLoginAt);
  });
});
