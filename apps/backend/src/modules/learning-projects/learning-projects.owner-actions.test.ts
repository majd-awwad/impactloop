import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import {
  reviewLearningProjectById,
  startProjectBuildById,
} from './learning-projects.service.js';

const TEST_MARKER = '[test-learning-project-owner-actions]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  projects: [] as string[],
};

const createLearner = async (suffix: string) => {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${suffix}`,
      email: `${TEST_MARKER}-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
    },
  });
  ids.users.push(user.id);
  return user;
};

const createPublishedProject = async (ownerId: string) => {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Projects`,
      nameAr: `${TEST_MARKER} مشاريع`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(category.id);

  const project = await prisma.learningProject.create({
    data: {
      categoryId: category.id,
      createdBy: ownerId,
      title: `${TEST_MARKER} Published project`,
      shortDescription: `${TEST_MARKER} short description`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
    },
  });
  ids.projects.push(project.id);
  return project;
};

const expectForbidden = async (operation: Promise<unknown>) => {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, 403);
    assert.equal(error.code, 'FORBIDDEN');
    return true;
  });
};

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
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
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('learning project owner domain protection', () => {
  test('owner cannot create or update a review for their own project', async () => {
    const owner = await createLearner('review-owner');
    const project = await createPublishedProject(owner.id);

    await expectForbidden(
      reviewLearningProjectById(project.id, owner.id, {
        rating: 5,
        comment: 'Owner review must not be stored.',
      }),
    );

    assert.equal(
      await prisma.projectUserReview.count({
        where: { projectId: project.id, userId: owner.id },
      }),
      0,
    );
  });

  test('non-owner learner can create and update a project review normally', async () => {
    const owner = await createLearner('learner-review-owner');
    const learner = await createLearner('reviewer');
    const project = await createPublishedProject(owner.id);

    const created = await reviewLearningProjectById(project.id, learner.id, {
      rating: 4,
      comment: 'Useful project.',
    });
    assert.equal(created.review.rating, 4);
    assert.equal(created.ratingSummary?.count, 1);

    const updated = await reviewLearningProjectById(project.id, learner.id, {
      rating: 5,
      comment: 'Even better after another look.',
    });
    assert.equal(updated.review.rating, 5);
    assert.equal(updated.ratingSummary?.count, 1);
    assert.equal(
      await prisma.projectUserReview.count({
        where: { projectId: project.id, userId: learner.id },
      }),
      1,
    );
  });

  test('owner cannot start a learner build for their own project', async () => {
    const owner = await createLearner('build-owner');
    const project = await createPublishedProject(owner.id);

    await expectForbidden(startProjectBuildById(project.id, owner.id));

    assert.equal(
      await prisma.projectBuild.count({
        where: { projectId: project.id, learnerId: owner.id },
      }),
      0,
    );
  });
});
