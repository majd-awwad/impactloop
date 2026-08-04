import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  archiveLearnerBuild,
  getLearnerBuildsList,
  getLearnerPortfolio,
  pauseLearnerBuild,
  resumeLearnerBuild,
} from '../learner-builds/learner-builds.service.js';
import {
  getMyProjectBuildById,
  startProjectBuildAgainById,
  startProjectBuildById,
} from './learning-projects.service.js';
import {
  archiveProjectBuild,
  pauseProjectBuild,
  resumeProjectBuild,
} from './project-build-lifecycle.js';
import {
  getProjectBuildCompletionStory,
  upsertProjectBuildCompletionStory,
} from './project-build-completion-story.js';
import { createProjectBuildCompletionSnapshot } from './project-build-completion-snapshot.js';
import { findOwnedBuildById } from './project-build-lifecycle.js';
import { projectBuildInclude } from './learning-projects.repository.js';
import { buildContinuableProjectBuildWhere } from './project-build-continuation.js';
import * as learnerHomeRepository from '../learner-home/learner-home.repository.js';

const TEST_MARKER = '[test-project-build-lifecycle]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  reservations: [] as string[],
  materialRequests: [] as string[],
  materials: [] as string[],
  locations: [] as string[],
};

async function createLearner(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: { create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' } },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createAuthor() {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Author`,
      email: `${TEST_MARKER}-author-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createProject(authorId: string) {
  const projectCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Projects`,
      nameAr: `${TEST_MARKER} مشاريع`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(projectCategory.id);

  const materialCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Electronics`,
      nameAr: `${TEST_MARKER} إلكترونيات`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.materialCategories.push(materialCategory.id);

  const project = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: authorId,
      title: `${TEST_MARKER} Lifecycle project`,
      shortDescription: 'short',
      description: 'description',
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName: 'LED',
            materialType: 'LED',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: materialCategory.id,
          },
        ],
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            title: 'Step 1',
            description: 'Do step 1',
            reviewStatus: 'ACCEPTED',
          },
        ],
      },
    },
    include: { steps: true, requiredComponents: true },
  });
  ids.projects.push(project.id);
  return project;
}

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.materialRequests.length) {
    await prisma.learnerMaterialRequest.deleteMany({
      where: { id: { in: ids.materialRequests } },
    });
  }
  if (ids.reservations.length) {
    await prisma.reservation.deleteMany({ where: { id: { in: ids.reservations } } });
  }
  if (ids.builds.length) {
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }
  if (ids.materials.length) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }
  if (ids.locations.length) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }
  if (ids.projects.length) {
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }
  if (ids.categories.length) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  if (ids.materialCategories.length) {
    await prisma.category.deleteMany({ where: { id: { in: ids.materialCategories } } });
  }
  if (ids.users.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('project build lifecycle LH-10–13', () => {
  test('pause preserves build data and is idempotent', async () => {
    const learner = await createLearner('pause');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    const itemCountBefore = build.items.length;
    const paused = await pauseLearnerBuild(build.id, learner.id);
    assert.equal(paused.status, 'PAUSED');
    assert.ok(paused.pausedAt);

    const pausedAgain = await pauseLearnerBuild(build.id, learner.id);
    assert.equal(pausedAgain.status, 'PAUSED');
    assert.equal(pausedAgain.items.length, itemCountBefore);

    const location = await prisma.location.create({
      data: { country: 'PS', city: 'Ramallah', area: 'Center' },
    });
    ids.locations.push(location.id);
    const material = await prisma.material.create({
      data: {
        ownerId: author.id,
        categoryId: ids.materialCategories[0]!,
        locationId: location.id,
        title: `${TEST_MARKER} pause mat`,
        description: 'd',
        materialType: 'LED',
        quantity: 1,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: true,
      },
    });
    ids.materials.push(material.id);

    const reservation = await prisma.reservation.create({
      data: {
        requesterId: learner.id,
        ownerId: author.id,
        materialId: material.id,
        status: 'PENDING',
        quantityRequested: 1,
      },
    });
    ids.reservations.push(reservation.id);

    const afterReservation = await findOwnedBuildById(build.id, learner.id);
    assert.equal(afterReservation?.items.length, itemCountBefore);
    assert.equal(
      (await prisma.reservation.findUnique({ where: { id: reservation.id } }))
        ?.status,
      'PENDING',
    );
  });

  test('resume is idempotent and completed build cannot pause or resume', async () => {
    const learner = await createLearner('resume');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await pauseProjectBuild(build.id, learner.id);
    const resumed = await resumeLearnerBuild(build.id, learner.id);
    assert.equal(resumed.status, 'IN_PROGRESS');
    assert.equal(resumed.pausedAt, null);

    const resumedAgain = await resumeLearnerBuild(build.id, learner.id);
    assert.equal(resumedAgain.status, 'IN_PROGRESS');

    await prisma.projectBuild.update({
      where: { id: build.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await assert.rejects(
      () => pauseProjectBuild(build.id, learner.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_NOT_PAUSABLE',
    );
    await assert.rejects(
      () => resumeProjectBuild(build.id, learner.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_NOT_RESUMABLE',
    );
  });

  test('archive blocked by active reservation and open material request', async () => {
    const learner = await createLearner('archive-block');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    const location = await prisma.location.create({
      data: { country: 'PS', city: 'Ramallah', area: 'Center' },
    });
    ids.locations.push(location.id);
    const material = await prisma.material.create({
      data: {
        ownerId: author.id,
        categoryId: ids.materialCategories[0]!,
        locationId: location.id,
        title: `${TEST_MARKER} block mat`,
        description: 'd',
        materialType: 'LED',
        quantity: 1,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: true,
      },
    });
    ids.materials.push(material.id);

    const reservation = await prisma.reservation.create({
      data: {
        requesterId: learner.id,
        ownerId: author.id,
        materialId: material.id,
        status: 'PENDING',
        quantityRequested: 1,
      },
    });
    ids.reservations.push(reservation.id);

    const buildItem = await prisma.projectBuildItem.findFirstOrThrow({
      where: { buildId: build.id },
    });
    await prisma.projectBuildItem.update({
      where: { id: buildItem.id },
      data: { linkedReservationId: reservation.id, linkedMaterialId: material.id },
    });

    await assert.rejects(
      () => archiveProjectBuild(build.id, learner.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_ARCHIVE_BLOCKED',
    );

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    await assert.rejects(
      () => archiveProjectBuild(build.id, learner.id),
      (error: unknown) => {
        if (!(error instanceof AppError)) return false;
        return (
          error.code === 'BUILD_ARCHIVE_BLOCKED' &&
          Array.isArray((error.details as { blockers?: unknown[] })?.blockers)
        );
      },
    );

    await prisma.projectBuildItem.update({
      where: { id: buildItem.id },
      data: { linkedReservationId: null, linkedMaterialId: null },
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED' },
    });

    const openRequest = await prisma.learnerMaterialRequest.create({
      data: {
        learnerId: learner.id,
        categoryId: ids.materialCategories[0]!,
        projectBuildId: build.id,
        status: 'OPEN',
        requestedItemName: 'LED',
        normalizedRequestedItemName: 'led',
        quantity: 1,
        unit: 'piece',
        locationCountry: 'PS',
        locationCity: 'Ramallah',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        description: 'need led',
      },
    });
    ids.materialRequests.push(openRequest.id);

    await assert.rejects(
      () => archiveProjectBuild(build.id, learner.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_ARCHIVE_BLOCKED',
    );
  });

  test('successful archive preserves history and is idempotent', async () => {
    const learner = await createLearner('archive-ok');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    const archived = await archiveLearnerBuild(build.id, learner.id);
    assert.equal(archived.status, 'ARCHIVED');
    assert.ok(archived.archivedAt);
    assert.equal(archived.isReadOnly, true);

    const archivedAgain = await archiveLearnerBuild(build.id, learner.id);
    assert.equal(archivedAgain.status, 'ARCHIVED');
    assert.ok(archivedAgain.items.length > 0);
  });

  test('start build returns active attempt and build again after completion', async () => {
    const learner = await createLearner('attempts');
    const author = await createAuthor();
    const project = await createProject(author.id);

    const first = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(first.id);
    assert.equal(first.attemptNumber, 1);

    const same = await startProjectBuildById(project.id, learner.id);
    assert.equal(same.id, first.id);

    await pauseProjectBuild(first.id, learner.id);
    const pausedStart = await startProjectBuildById(project.id, learner.id);
    assert.equal(pausedStart.id, first.id);
    assert.equal(pausedStart.status, 'PAUSED');

    await prisma.projectBuild.update({
      where: { id: first.id },
      data: { status: 'COMPLETED', completedAt: new Date(), pausedAt: null },
    });

    const second = await startProjectBuildAgainById(project.id, learner.id);
    ids.builds.push(second.id);
    assert.equal(second.attemptNumber, 2);
    assert.equal(second.status, 'IN_PROGRESS');
    assert.notEqual(second.id, first.id);

    await assert.rejects(
      () => startProjectBuildAgainById(project.id, learner.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_ALREADY_ACTIVE',
    );
  });

  test('completion story and snapshot for completed build', async () => {
    const learner = await createLearner('story');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await prisma.projectBuild.update({
      where: { id: build.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const story = await upsertProjectBuildCompletionStory(build.id, learner.id, {
      reflection: 'Finished my LED project.',
      caption: 'My build',
    });
    assert.equal(story?.reflection, 'Finished my LED project.');

    const otherLearner = await createLearner('other');
    await assert.rejects(
      () =>
        upsertProjectBuildCompletionStory(build.id, otherLearner.id, {
          reflection: 'hack',
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_NOT_FOUND',
    );

    const rawBuild = await prisma.projectBuild.findUniqueOrThrow({
      where: { id: build.id },
      include: projectBuildInclude,
    });
    await createProjectBuildCompletionSnapshot(rawBuild);
    await createProjectBuildCompletionSnapshot(rawBuild);

    const snapshotCount = await prisma.projectBuildCompletionSnapshot.count({
      where: { buildId: build.id },
    });
    assert.equal(snapshotCount, 1);

    const fetched = await getProjectBuildCompletionStory(build.id, learner.id);
    assert.equal(fetched?.reflection, 'Finished my LED project.');
  });

  test('my builds filters and portfolio privacy', async () => {
    const learner = await createLearner('lists');
    const other = await createLearner('lists-other');
    const author = await createAuthor();
    const project = await createProject(author.id);

    const active = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(active.id);

    await pauseProjectBuild(active.id, learner.id);

    await prisma.projectBuild.update({
      where: { id: active.id },
      data: { status: 'ARCHIVED', archivedAt: new Date(), pausedAt: null },
    });

    const completed = await prisma.projectBuild.create({
      data: {
        projectId: project.id,
        learnerId: learner.id,
        attemptNumber: 2,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.builds.push(completed.id);

    const pausedActive = await startProjectBuildAgainById(project.id, learner.id);
    ids.builds.push(pausedActive.id);
    await pauseProjectBuild(pausedActive.id, learner.id);

    const pausedList = await getLearnerBuildsList({
      learnerId: learner.id,
      status: 'PAUSED',
      page: 1,
      limit: 20,
    });
    assert.equal(pausedList.items.length, 1);
    assert.equal(pausedList.items[0]?.status, 'PAUSED');

    const portfolio = await getLearnerPortfolio({
      learnerId: learner.id,
      page: 1,
      limit: 20,
    });
    assert.ok(portfolio.items.every((item) => item.status === 'COMPLETED'));

    const otherPortfolio = await getLearnerPortfolio({
      learnerId: other.id,
      page: 1,
      limit: 20,
    });
    assert.equal(otherPortfolio.items.length, 0);

    const continuable = await prisma.projectBuild.findMany({
      where: buildContinuableProjectBuildWhere(learner.id),
      select: { id: true, status: true },
    });
    assert.ok(
      continuable.some((row) => row.status === 'PAUSED'),
      'paused build appears in continuation query',
    );
    assert.ok(
      !continuable.some((row) => row.status === 'COMPLETED'),
      'completed builds excluded from continuation',
    );

    const completedView = await getMyProjectBuildById(
      project.id,
      learner.id,
      completed.id,
    );
    assert.equal(completedView?.status, 'COMPLETED');
    assert.equal(completedView?.isReadOnly, true);
  });
});
