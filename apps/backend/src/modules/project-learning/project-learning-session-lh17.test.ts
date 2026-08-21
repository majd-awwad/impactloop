import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  completeProjectBuildStepById,
  startProjectBuildById,
  updateProjectBuildItemById,
} from '../learning-projects/learning-projects.service.js';
import { setupLearningSessionForBuild } from './build-learning-session-setup.service.js';
import { getOwnedLearningSessionForBuild } from './build-learning-session.service.js';
import { setProjectLearningPackGeneratorForTests } from './project-learning-pack-generator.factory.js';
import { uniqueLearningTestEmail, uniqueLearningTestPhone } from './project-learning-test-ids.js';
import { MockProjectLearningPackGeneratorProvider } from './project-learning-pack-generator.mock.provider.js';
import {
  getStepLearningCheckAiHandoff,
  getStepLearningCheckForBuild,
  skipStepLearningCheck,
  submitStepLearningCheckAnswer,
  viewStepLearningCheckHint,
} from './step-learning-check.service.js';
import { stepLearningCheckDtoExcludesCorrectAnswerBeforeSubmission } from './project-learning-step-check.dto.js';

const TEST_MARKER = '[test-project-learning-session-lh17]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  packs: [] as string[],
};

let providerCallCount = 0;

class CountingMockProvider extends MockProjectLearningPackGeneratorProvider {
  override async generateProjectLearningPack(
    input: Parameters<MockProjectLearningPackGeneratorProvider['generateProjectLearningPack']>[0],
  ) {
    providerCallCount += 1;
    return super.generateProjectLearningPack(input);
  }
}

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

async function createLearner(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
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
      title: `${TEST_MARKER} Step check project`,
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
          {
            stepNumber: 2,
            title: 'Step 2',
            description: 'Do step 2',
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

async function prepareReadyBuildWithSession(learnerId: string, projectId: string) {
  const build = await startProjectBuildById(projectId, learnerId);
  ids.builds.push(build.id);

  for (const item of build.items) {
    await updateProjectBuildItemById(projectId, learnerId, item.id, {
      status: 'ALREADY_OWNED',
      learnerNote: null,
    });
  }

  const setup = await setupLearningSessionForBuild({
    buildId: build.id,
    learnerId,
  });
  assert.equal(setup.status, 'READY');

  return { build, projectId };
}

async function completeFirstStep(projectId: string, learnerId: string) {
  const project = await prisma.learningProject.findUniqueOrThrow({
    where: { id: projectId },
    include: { steps: true },
  });
  return completeProjectBuildStepById(
    projectId,
    learnerId,
    project.steps[0]!.id,
  );
}

before(() => {
  process.env.NODE_ENV = 'test';
  providerCallCount = 0;
  setProjectLearningPackGeneratorForTests(new CountingMockProvider());
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
    await prisma.projectLearningQuestion.deleteMany({
      where: { pack: { projectId: { in: ids.projects } } },
    });
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

describe('project learning step checkpoints LH-17', () => {
  test('completed step exposes assigned STEP check', async () => {
    const author = await createAuthor();
    const learner = await createLearner('expose');
    const project = await createPublishedProject(author.id);
    const { build } = await prepareReadyBuildWithSession(learner.id, project.id);
    await completeFirstStep(project.id, learner.id);

    const check = await getStepLearningCheckForBuild({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
    });

    assert.ok(check);
    assert.equal(check.stage, 'STEP');
    assert.equal(check.stepId, project.steps[0]!.id);
    assert.equal(check.uiState, 'NOT_ATTEMPTED');
    assert.equal(stepLearningCheckDtoExcludesCorrectAnswerBeforeSubmission(check), true);
  });

  test('current incomplete step still returns assigned STEP check', async () => {
    const author = await createAuthor();
    const learner = await createLearner('incomplete');
    const project = await createPublishedProject(author.id);
    await prepareReadyBuildWithSession(learner.id, project.id);

    const check = await getStepLearningCheckForBuild({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
    });

    assert.ok(check);
    assert.equal(check.stage, 'STEP');
    assert.equal(check.stepId, project.steps[0]!.id);
    assert.equal(check.uiState, 'NOT_ATTEMPTED');
    assert.ok((check.question.options?.length ?? 0) >= 2);
  });

  test('missing session is recovered without duplicating assignments', async () => {
    const author = await createAuthor();
    const learner = await createLearner('recover');
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    for (const item of build.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const first = await getStepLearningCheckForBuild({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
    });
    assert.ok(first);
    assert.equal(first.stage, 'STEP');
    assert.equal(first.stepId, project.steps[0]!.id);

    const session = await getOwnedLearningSessionForBuild(build.id, learner.id);
    assert.ok(session);
    const startCount = session.assignments.filter((item) => item.stage === 'START').length;
    const stepCount = session.assignments.filter((item) => item.stage === 'STEP').length;
    const finalCount = session.assignments.filter((item) => item.stage === 'FINAL').length;
    assert.ok(startCount >= 1);
    assert.ok(stepCount >= 1);
    assert.ok(finalCount >= 1);
    assert.ok(
      session.assignments.some(
        (item) => item.stage === 'STEP' && item.projectStepId === project.steps[0]!.id,
      ),
    );

    const assignmentIds = session.assignments.map((item) => item.id).sort();
    const second = await getStepLearningCheckForBuild({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
    });
    assert.ok(second);
    assert.equal(second.assignmentId, first.assignmentId);

    const rerun = await getOwnedLearningSessionForBuild(build.id, learner.id);
    assert.equal(rerun?.id, session.id);
    assert.deepEqual(
      rerun?.assignments.map((item) => item.id).sort(),
      assignmentIds,
    );
  });

  test('STEP assignment maps to the requested project step', async () => {
    const author = await createAuthor();
    const learner = await createLearner('step-map');
    const project = await createPublishedProject(author.id);
    await prepareReadyBuildWithSession(learner.id, project.id);

    const first = await getStepLearningCheckForBuild({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
    });
    const second = await getStepLearningCheckForBuild({
      projectId: project.id,
      stepId: project.steps[1]!.id,
      learnerId: learner.id,
    });

    assert.ok(first);
    assert.ok(second);
    assert.equal(first.stepId, project.steps[0]!.id);
    assert.equal(second.stepId, project.steps[1]!.id);
    assert.notEqual(first.assignmentId, second.assignmentId);
  });

  test('STEP hint returns localized hint without answer attempt', async () => {
    const author = await createAuthor();
    const learner = await createLearner('hint');
    const project = await createPublishedProject(author.id);
    await prepareReadyBuildWithSession(learner.id, project.id);
    await completeFirstStep(project.id, learner.id);

    const callsBefore = providerCallCount;
    const check = await viewStepLearningCheckHint({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
      role: 'LEARNER',
    });

    assert.ok(check.hintViewed);
    assert.equal(check.attemptCount, 0);
    assert.equal(providerCallCount, callsBefore);
    assert.ok(check.question.hintEn.length > 0);
    assert.ok(check.question.hintAr.length > 0);
  });

  test('incorrect and correct STEP answers grade server-side', async () => {
    const author = await createAuthor();
    const learner = await createLearner('grade');
    const project = await createPublishedProject(author.id);
    await prepareReadyBuildWithSession(learner.id, project.id);
    await completeFirstStep(project.id, learner.id);

    const wrong = await submitStepLearningCheckAnswer({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'b',
    });
    assert.equal(wrong.attempt.isCorrect, false);
    assert.equal(wrong.check.uiState, 'INCORRECT');
    assert.equal(wrong.check.attemptCount, 1);

    const right = await submitStepLearningCheckAnswer({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'a',
    });
    assert.equal(right.attempt.isCorrect, true);
    assert.equal(right.check.uiState, 'CORRECT');
    assert.equal(right.check.attemptCount, 2);
  });

  test('STEP skip is idempotent and answer after skip is allowed', async () => {
    const author = await createAuthor();
    const learner = await createLearner('skip');
    const project = await createPublishedProject(author.id);
    await prepareReadyBuildWithSession(learner.id, project.id);
    await completeFirstStep(project.id, learner.id);

    const skipped = await skipStepLearningCheck({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
      role: 'LEARNER',
    });
    assert.equal(skipped.uiState, 'SKIPPED');
    assert.equal(skipped.attemptCount, 0);

    const skippedAgain = await skipStepLearningCheck({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
      role: 'LEARNER',
    });
    assert.equal(skippedAgain.uiState, 'SKIPPED');

    const answered = await submitStepLearningCheckAnswer({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'a',
    });
    assert.equal(answered.check.uiState, 'CORRECT');
    assert.equal(answered.check.status, 'ANSWERED');
  });

  test('step completion succeeds without learning session', async () => {
    const author = await createAuthor();
    const learner = await createLearner('no-session');
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    for (const item of build.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const completed = await completeFirstStep(project.id, learner.id);
    assert.equal(completed.stepProgress.completed, 1);
  });

  test('completed build rejects new STEP answer attempts', async () => {
    const author = await createAuthor();
    const learner = await createLearner('completed');
    const project = await createPublishedProject(author.id);
    const { build } = await prepareReadyBuildWithSession(learner.id, project.id);
    await completeFirstStep(project.id, learner.id);

    await prisma.projectBuild.update({
      where: { id: build.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await assert.rejects(
      () =>
        submitStepLearningCheckAnswer({
          projectId: project.id,
          stepId: project.steps[0]!.id,
          learnerId: learner.id,
          role: 'LEARNER',
          selectedOptionKey: 'a',
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_LEARNING_CHECK_LOCKED',
    );
  });

  test('non-owner receives not-found privacy response', async () => {
    const author = await createAuthor();
    const owner = await createLearner('owner');
    const other = await createLearner('other');
    const project = await createPublishedProject(author.id);
    await prepareReadyBuildWithSession(owner.id, project.id);
    await completeFirstStep(project.id, owner.id);

    await assert.rejects(
      () =>
        getStepLearningCheckForBuild({
          projectId: project.id,
          stepId: project.steps[0]!.id,
          learnerId: other.id,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_NOT_FOUND',
    );
  });

  test('AI handoff requires a submitted answer and makes zero provider calls', async () => {
    const author = await createAuthor();
    const learner = await createLearner('handoff');
    const project = await createPublishedProject(author.id);
    await prepareReadyBuildWithSession(learner.id, project.id);
    await completeFirstStep(project.id, learner.id);

    await assert.rejects(
      () =>
        getStepLearningCheckAiHandoff({
          projectId: project.id,
          stepId: project.steps[0]!.id,
          learnerId: learner.id,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'STEP_LEARNING_CHECK_AI_HANDOFF_UNAVAILABLE',
    );

    await submitStepLearningCheckAnswer({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'b',
    });

    const callsBefore = providerCallCount;
    const handoff = await getStepLearningCheckAiHandoff({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
    });

    assert.equal(handoff.context.projectId, project.id);
    assert.equal(handoff.context.stepId, project.steps[0]!.id);
    assert.equal(handoff.context.isCorrect, false);
    assert.ok(handoff.suggestedPromptEn.length > 0);
    assert.equal(providerCallCount, callsBefore);
  });

  test('reload returns the same STEP assignment', async () => {
    const author = await createAuthor();
    const learner = await createLearner('reload');
    const project = await createPublishedProject(author.id);
    await prepareReadyBuildWithSession(learner.id, project.id);
    await completeFirstStep(project.id, learner.id);

    const first = await getStepLearningCheckForBuild({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
    });
    const second = await getStepLearningCheckForBuild({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
    });

    assert.equal(first?.assignmentId, second?.assignmentId);
    assert.equal(first?.question.id, second?.question.id);
  });

  test('ensure is not invoked again when loading STEP check after READY session', async () => {
    const author = await createAuthor();
    const learner = await createLearner('no-extra-ensure');
    const project = await createPublishedProject(author.id);
    await prepareReadyBuildWithSession(learner.id, project.id);
    await completeFirstStep(project.id, learner.id);

    const callsBefore = providerCallCount;
    await getStepLearningCheckForBuild({
      projectId: project.id,
      stepId: project.steps[0]!.id,
      learnerId: learner.id,
    });
    assert.equal(providerCallCount, callsBefore);
  });

  test('step completion succeeds while pack is generating', async () => {
    const author = await createAuthor();
    const learner = await createLearner('generating');
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    for (const item of build.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const completed = await completeFirstStep(project.id, learner.id);
    assert.equal(completed.stepProgress.completed, 1);
    assert.equal(completed.status, 'IN_PROGRESS');
  });
});
