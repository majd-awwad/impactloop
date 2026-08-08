import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { normalizeSearchText } from '../../utils/normalize-search-text.js';
import {
  buildLearnerMaterialRequestOpenBusinessKey,
} from '../material-requests/material-requests.open-business-key.js';
import { MAX_OPEN_LEARNER_MATERIAL_REQUESTS } from '../material-requests/material-requests.lifecycle.js';
import { createLearnerMaterialRequest } from './learner-material-requests.service.js';

const TEST_MARKER = '[test-learner-material-requests-concurrency]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  requests: [] as string[],
};

const createUser = async (suffix: string) => {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${suffix}`,
      email: `${TEST_MARKER}-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      activeRole: 'LEARNER',
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
    },
  });
  ids.users.push(user.id);
  return user;
};

const createCategory = async (suffix: string) => {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} ${suffix}`,
      nameAr: `${TEST_MARKER} ${suffix}`,
      categoryType: 'MATERIAL',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
};

const defaultCreateInput = (categoryId: string, itemName: string) => ({
  requestedItemName: itemName,
  categoryId,
  description: null,
  quantity: 1,
  unit: 'piece',
  alternativesAllowed: true,
  locationCity: 'Ramallah',
  locationArea: null,
});

before(async () => {
  process.env.NODE_ENV = 'test';
  await prisma.$connect();
});

after(async () => {
  if (ids.requests.length) {
    await prisma.learnerMaterialRequest.deleteMany({
      where: { id: { in: ids.requests } },
    });
  }
  if (ids.users.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  if (ids.categories.length) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  await prisma.$disconnect();
});

describe('learner material request create concurrency', () => {
  test('openBusinessKey uniqueness prevents duplicate OPEN requests', async () => {
    const learner = await createUser('duplicate');
    const category = await createCategory('duplicate');

    const [first, second] = await Promise.allSettled([
      createLearnerMaterialRequest(
        learner.id,
        defaultCreateInput(category.id, 'DC motor'),
      ),
      createLearnerMaterialRequest(
        learner.id,
        defaultCreateInput(category.id, 'DC motor'),
      ),
    ]);

    const successes = [first, second].filter(
      (result) => result.status === 'fulfilled',
    );
    const failures = [first, second].filter(
      (result) => result.status === 'rejected',
    );

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    const failure = failures[0];
    assert.equal(failure.status, 'rejected');
    assert.ok(failure.reason instanceof AppError);
    assert.equal(failure.reason.code, 'DUPLICATE_OPEN_REQUEST');

    const success = successes[0] as PromiseFulfilledResult<{ id: string }>;
    ids.requests.push(success.value.id);
  });

  test('per-learner lock enforces open request limit under concurrency', async () => {
    const learner = await createUser('limit');
    const category = await createCategory('limit');

    for (let index = 0; index < MAX_OPEN_LEARNER_MATERIAL_REQUESTS; index += 1) {
      const created = await createLearnerMaterialRequest(
        learner.id,
        defaultCreateInput(category.id, `Item ${index}`),
      );
      ids.requests.push(created.id);
    }

    const [allowed, blocked] = await Promise.allSettled([
      createLearnerMaterialRequest(
        learner.id,
        defaultCreateInput(category.id, 'Overflow A'),
      ),
      createLearnerMaterialRequest(
        learner.id,
        defaultCreateInput(category.id, 'Overflow B'),
      ),
    ]);

    const successes = [allowed, blocked].filter(
      (result) => result.status === 'fulfilled',
    );
    const failures = [allowed, blocked].filter(
      (result) => result.status === 'rejected',
    );

    assert.equal(successes.length, 0);
    assert.equal(failures.length, 2);
    for (const failure of failures) {
      assert.equal(failure.status, 'rejected');
      assert.ok(failure.reason instanceof AppError);
      assert.equal(failure.reason.code, 'ACTIVE_REQUEST_LIMIT');
    }
  });

  test('openBusinessKey is cleared when request leaves OPEN', async () => {
    const learner = await createUser('clear-key');
    const category = await createCategory('clear-key');
    const created = await createLearnerMaterialRequest(
      learner.id,
      defaultCreateInput(category.id, 'Breadboard'),
    );
    ids.requests.push(created.id);

    const expectedKey = buildLearnerMaterialRequestOpenBusinessKey(
      learner.id,
      category.id,
      normalizeSearchText('Breadboard'),
    );

    const stored = await prisma.learnerMaterialRequest.findUnique({
      where: { id: created.id },
      select: { openBusinessKey: true },
    });
    assert.equal(stored?.openBusinessKey, expectedKey);

    await prisma.learnerMaterialRequest.update({
      where: { id: created.id },
      data: { status: 'CANCELLED', openBusinessKey: null, cancelledAt: new Date() },
    });

    const reopened = await createLearnerMaterialRequest(
      learner.id,
      defaultCreateInput(category.id, 'Breadboard'),
    );
    ids.requests.push(reopened.id);
    assert.notEqual(reopened.id, created.id);

    const reopenedStored = await prisma.learnerMaterialRequest.findUnique({
      where: { id: reopened.id },
      select: { openBusinessKey: true },
    });
    assert.equal(reopenedStored?.openBusinessKey, expectedKey);
  });
});
