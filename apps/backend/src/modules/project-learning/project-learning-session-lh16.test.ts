import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import { startProjectBuildAgainById, startProjectBuildById } from '../learning-projects/learning-projects.service.js';
import { setProjectLearningPackGeneratorForTests } from './project-learning-pack-generator.factory.js';
import { uniqueLearningTestEmail, uniqueLearningTestPhone } from './project-learning-test-ids.js';
import { MockProjectLearningPackGeneratorProvider } from './project-learning-pack-generator.mock.provider.js';
import {
  setupLearningSessionForBuild,
  resolveLearningSetupMetadataForBuild,
} from './build-learning-session-setup.service.js';
import {
  getOwnedLearningSessionForBuild,
  submitLearningAnswerAttempt,
  updateLearningSessionPreferences,
} from './build-learning-session.service.js';
import { buildDeterministicLearningAssignments } from './project-learning-assignment-selection.js';
import { findProjectLearningPackByProjectAndHash } from './project-learning-pack.repository.js';
import { ensureReadyLearningPackForProject } from './project-learning-pack-ensure.service.js';

const TEST_MARKER = '[test-project-learning-session-lh16]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  packs: [] as string[],
};

async function createAuthor() {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Author`,
      email: uniqueLearningTestEmail(TEST_MARKER, ''),
      passwordHash: await hashPassword('TestPassword123!'),
      phone: uniqueLearningTestPhone(),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createLearner() {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner`,
      email: uniqueLearningTestEmail(TEST_MARKER, ''),
      passwordHash: await hashPassword('TestPassword123!'),
      phone: uniqueLearningTestPhone(),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: { create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' } },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createPublishedProject(authorId: string) {
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
      title: `${TEST_MARKER} Session project`,
      shortDescription: 'Short',
      description: 'Description',
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
    include: { steps: true },
  });
  ids.projects.push(project.id);
  return project;
}

before(() => {
  process.env.NODE_ENV = 'test';
  setProjectLearningPackGeneratorForTests(new MockProjectLearningPackGeneratorProvider());
});

after(async () => {
  setProjectLearningPackGeneratorForTests(null);
  if (ids.builds.length) {
    await prisma.projectBuildLearningSession.deleteMany({
      where: { buildId: { in: ids.builds } },
    });
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }
  if (ids.packs.length) {
    await prisma.projectLearningPack.deleteMany({ where: { id: { in: ids.packs } } });
  }
  if (ids.projects.length) {
    await prisma.projectLearningPack.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
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

describe('project learning session LH-16', () => {
  test('start build succeeds and returns learningSetup metadata', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    assert.ok(build.id);
    assert.ok(build.learningSetup);
    assert.ok(['READY', 'PREPARING', 'UNAVAILABLE', 'NOT_REQUESTED'].includes(build.learningSetup.status));
  });

  test('setupLearningSessionForBuild is idempotent', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    const first = await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      learningGoal: 'Understand LEDs',
      confidenceBefore: 2,
    });
    const second = await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
    });

    assert.equal(first.status, 'READY');
    assert.equal(second.status, 'READY');
    if (first.status === 'READY' && second.status === 'READY') {
      assert.equal(first.session.id, second.session.id);
      assert.equal(first.session.assignments.length, second.session.assignments.length);
    }
  });

  test('deterministic assignments stay stable across reloads', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
    });

    const first = await getOwnedLearningSessionForBuild(build.id, learner.id);
    const second = await getOwnedLearningSessionForBuild(build.id, learner.id);
    assert.deepEqual(
      first?.assignments.map((assignment) => assignment.questionId),
      second?.assignments.map((assignment) => assignment.questionId),
    );
  });

  test('start questions are assigned for the session', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    const result = await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
    });
    assert.equal(result.status, 'READY');
    if (result.status !== 'READY') return;

    const startAssignments = result.session.assignments.filter(
      (assignment) => assignment.stage === 'START',
    );
    assert.ok(startAssignments.length >= 2);
    assert.ok(startAssignments.every((assignment) => assignment.question.promptEn.length > 0));
    assert.ok(startAssignments.every((assignment) => assignment.question.promptAr.length > 0));
  });

  test('learner can update personal goal and confidence before', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
    });

    const updated = await updateLearningSessionPreferences({
      buildId: build.id,
      learnerId: learner.id,
      learningGoal: 'Learn safe wiring',
      confidenceBefore: 4,
    });

    assert.equal(updated.learningGoal, 'Learn safe wiring');
    assert.equal(updated.confidenceBefore, 4);
  });

  test('submit answer grades without exposing correct option key', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    const setup = await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
    });
    assert.equal(setup.status, 'READY');
    if (setup.status !== 'READY') return;

    const assignment = setup.session.assignments.find(
      (item) => item.stage === 'START',
    );
    assert.ok(assignment);

    const result = await submitLearningAnswerAttempt({
      assignmentId: assignment.id,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: assignment.question.options[0]!.optionKey,
    });

    assert.ok(result.attempt);
    assert.ok(result.assignment);
    assert.equal(
      'correctOptionKey' in result.assignment.question,
      false,
    );
  });

  test('build again creates a separate learning session', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const firstBuild = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(firstBuild.id);
    await setupLearningSessionForBuild({
      buildId: firstBuild.id,
      learnerId: learner.id,
    });

    await prisma.projectBuild.update({
      where: { id: firstBuild.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const secondBuild = await startProjectBuildAgainById(project.id, learner.id);
    ids.builds.push(secondBuild.id);
    const secondSetup = await setupLearningSessionForBuild({
      buildId: secondBuild.id,
      learnerId: learner.id,
    });

    assert.equal(secondSetup.status, 'READY');
    if (secondSetup.status !== 'READY') return;

    const firstSession = await getOwnedLearningSessionForBuild(
      firstBuild.id,
      learner.id,
    );
    assert.notEqual(firstSession?.id, secondSetup.session.id);
  });

  test('assignment selection is deterministic for the same build', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    await ensureReadyLearningPackForProject(project.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    const packResult = await ensureReadyLearningPackForProject(project.id);
    assert.equal(packResult.status, 'READY');
    if (packResult.status !== 'READY') return;

    const pack = await findProjectLearningPackByProjectAndHash(
      project.id,
      packResult.contentHash,
    );
    assert.ok(pack);

    const first = await buildDeterministicLearningAssignments({
      pack,
      buildId: build.id,
      projectStepIds: project.steps.map((step) => step.id),
    });
    const second = await buildDeterministicLearningAssignments({
      pack,
      buildId: build.id,
      projectStepIds: project.steps.map((step) => step.id),
    });

    assert.deepEqual(first, second);
  });

  test('resolveLearningSetupMetadataForBuild reports READY when session exists', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
    });

    const metadata = await resolveLearningSetupMetadataForBuild({
      buildId: build.id,
      learnerId: learner.id,
    });

    assert.equal(metadata.status, 'READY');
    assert.ok(metadata.sessionId);
    assert.ok(metadata.startQuestionCount >= 2);
  });

  test('non-owner cannot access learning session setup', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const other = await createLearner();
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await assert.rejects(
      () =>
        setupLearningSessionForBuild({
          buildId: build.id,
          learnerId: other.id,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_NOT_FOUND',
    );
  });
});
