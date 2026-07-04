import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';

import {
  getLearningProjectById,
  getLearningProjects,
  submitLearningProjectForReview,
} from './learning-projects.service.js';
import { submitLearningProjectSchema } from './learning-projects.validation.js';

const TEST_MARKER = '[test-learning-project-submit]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  projects: [] as string[],
};

const uniqueSuffix = () =>
  `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

async function createLearnerUser() {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner`,
      email: `${TEST_MARKER}-learner-${uniqueSuffix()}@impactloop.test`,
      passwordHash,
      phone: `+97058${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: {
          learnerType: 'STUDENT',
          skillLevel: 'BEGINNER',
        },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createProjectCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Robotics ${uniqueSuffix()}`,
      nameAr: `${TEST_MARKER} Robotics`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
}

const buildValidSubmitInput = (categoryId: string) => ({
  title: `${TEST_MARKER} Solar tracker ${uniqueSuffix()}`,
  shortDescription: 'Build a reusable-material solar tracking classroom model.',
  description: 'Build a reusable-material solar tracking classroom model.',
  categoryId,
  difficulty: 'INTERMEDIATE' as const,
  estimatedDurationMinutes: 180,
  requiredComponents: [
    { name: 'Small solar panel', quantity: 1, unit: 'piece' },
    { name: 'Cardboard base', isRequired: false },
  ],
  steps: [
    {
      title: 'Prepare the base',
      description: 'Cut and reinforce the recycled cardboard base.',
    },
    {
      title: 'Mount the panel',
      description: 'Attach the solar panel and test the tilt range.',
    },
  ],
  links: [{ url: 'https://example.com/solar-tracker', title: 'Reference' }],
});

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  await prisma.idempotencyRecord.deleteMany({
    where: {
      OR: [
        { userId: { in: ids.users } },
        { scope: 'LEARNING_PROJECT_SUBMIT', key: { startsWith: TEST_MARKER } },
      ],
    },
  });

  if (ids.projects.length > 0) {
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
    });
  }

  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.categories } },
    });
  }

  if (ids.users.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: ids.users } },
    });
  }
});

describe('learning project learner submission', () => {
  test('submits a learner project as pending review and keeps it hidden publicly', async () => {
    const learner = await createLearnerUser();
    const category = await createProjectCategory();
    const input = buildValidSubmitInput(category.id);

    const result = await submitLearningProjectForReview(
      learner.id,
      input,
      `${TEST_MARKER}:submit:${uniqueSuffix()}`,
    );

    ids.projects.push(result.response.id);

    assert.equal(result.replayed, false);
    assert.equal(result.response.status, 'PENDING_REVIEW');
    assert.ok(result.response.submittedAt);
    assert.equal(result.response.title, input.title);

    const stored = await prisma.learningProject.findUnique({
      where: { id: result.response.id },
      include: {
        requiredComponents: true,
        steps: true,
        links: true,
      },
    });

    assert.ok(stored);
    assert.equal(stored?.createdBy, learner.id);
    assert.equal(stored?.status, 'PENDING_REVIEW');
    assert.equal(stored?.requiredComponents.length, 2);
    assert.equal(stored?.steps.length, 2);
    assert.equal(stored?.links.length, 1);

    const publicList = await getLearningProjects({ page: 1, limit: 100 });
    assert.equal(
      publicList.items.some((item) => item.id === result.response.id),
      false,
    );

    await assert.rejects(
      () => getLearningProjectById(result.response.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('validates required submit fields before service execution', () => {
    const invalid = submitLearningProjectSchema.safeParse({
      title: 'No',
      shortDescription: 'short',
      description: 'short',
      categoryId: '',
      difficulty: 'EXPERT',
    });

    assert.equal(invalid.success, false);
  });

  test('rejects inactive or missing project categories', async () => {
    const learner = await createLearnerUser();
    const inactive = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Inactive ${uniqueSuffix()}`,
        nameAr: `${TEST_MARKER} Inactive`,
        categoryType: 'PROJECT',
        isActive: false,
      },
    });
    ids.categories.push(inactive.id);

    await assert.rejects(
      () =>
        submitLearningProjectForReview(
          learner.id,
          buildValidSubmitInput(inactive.id),
          `${TEST_MARKER}:inactive:${uniqueSuffix()}`,
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.code === 'INVALID_CATEGORY',
    );
  });

  test('replays duplicate submit requests with the same idempotency key', async () => {
    const learner = await createLearnerUser();
    const category = await createProjectCategory();
    const input = buildValidSubmitInput(category.id);
    const key = `${TEST_MARKER}:replay:${uniqueSuffix()}`;

    const first = await submitLearningProjectForReview(learner.id, input, key);
    ids.projects.push(first.response.id);
    const replay = await submitLearningProjectForReview(learner.id, input, key);

    assert.equal(first.replayed, false);
    assert.equal(replay.replayed, true);
    assert.equal(replay.response.id, first.response.id);

    const count = await prisma.learningProject.count({
      where: {
        createdBy: learner.id,
        title: input.title,
      },
    });
    assert.equal(count, 1);
  });

  test('rejects reusing a submit idempotency key with a different body', async () => {
    const learner = await createLearnerUser();
    const category = await createProjectCategory();
    const input = buildValidSubmitInput(category.id);
    const key = `${TEST_MARKER}:reuse:${uniqueSuffix()}`;

    const first = await submitLearningProjectForReview(learner.id, input, key);
    ids.projects.push(first.response.id);

    await assert.rejects(
      () =>
        submitLearningProjectForReview(
          learner.id,
          {
            ...input,
            title: `${input.title} changed`,
          },
          key,
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'IDEMPOTENCY_KEY_REUSED',
    );
  });
});
