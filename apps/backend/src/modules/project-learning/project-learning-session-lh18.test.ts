import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  completeProjectBuildStepById,
  startProjectBuildAgainById,
  startProjectBuildById,
  updateProjectBuildItemById,
} from '../learning-projects/learning-projects.service.js';
import { setupLearningSessionForBuild } from './build-learning-session-setup.service.js';
import { setProjectLearningPackGeneratorForTests } from './project-learning-pack-generator.factory.js';
import { uniqueLearningTestEmail, uniqueLearningTestPhone } from './project-learning-test-ids.js';
import { MockProjectLearningPackGeneratorProvider } from './project-learning-pack-generator.mock.provider.js';
import {
  getFinalLearningCheckAiHandoff,
  getFinalLearningCheckForBuild,
  skipFinalLearningCheckAssignment,
  submitFinalLearningCheckAnswer,
  viewFinalLearningCheckHint,
} from './final-learning-check.service.js';
import { updateLearningCompletionReflection } from './learning-completion-reflection.service.js';
import {
  computeBuildLearningSummaryFromAssignments,
  persistBuildLearningSummary,
} from './project-learning-summary.service.js';
import { finalLearningCheckDtoExcludesCorrectAnswerBeforeSubmission } from './project-learning-final-check.dto.js';

const TEST_MARKER = '[test-project-learning-session-lh18]';

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
    input: Parameters<
      MockProjectLearningPackGeneratorProvider['generateProjectLearningPack']
    >[0],
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
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
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
      title: `${TEST_MARKER} Final check project`,
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
    include: { steps: true, requiredComponents: true },
  });
  ids.projects.push(project.id);
  return project;
}

async function prepareCompletedBuildWithSession(
  learnerId: string,
  projectId: string,
) {
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
    learningGoal: 'Understand circuits',
    confidenceBefore: 2,
  });
  assert.equal(setup.status, 'READY');

  const project = await prisma.learningProject.findUniqueOrThrow({
    where: { id: projectId },
    include: { steps: true },
  });

  const completed = await completeProjectBuildStepById(
    projectId,
    learnerId,
    project.steps[0]!.id,
  );
  assert.equal(completed.status, 'COMPLETED');

  return { build: completed, project, sessionId: setup.status === 'READY' ? setup.session.id : null };
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
  if (ids.projects.length) {
    await prisma.projectLearningQuestion.deleteMany({
      where: { pack: { projectId: { in: ids.projects } } },
    });
    await prisma.projectLearningPack.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
    });
  }
  if (ids.categories.length) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  if (ids.materialCategories.length) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.materialCategories } },
    });
  }
  if (ids.users.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('project learning final check LH-18', () => {
  test('final check available after required steps complete', async () => {
    const author = await createAuthor();
    const learner = await createLearner('available');
    const project = await createPublishedProject(author.id);
    await prepareCompletedBuildWithSession(learner.id, project.id);

    const check = await getFinalLearningCheckForBuild({
      projectId: project.id,
      learnerId: learner.id,
    });

    assert.ok(check);
    assert.equal(check.available, true);
    assert.ok(check.progress.total >= 3);
    assert.ok(check.assignments.every((item) => item.stage === 'FINAL'));
    assert.ok(
      check.assignments.every((item) =>
        finalLearningCheckDtoExcludesCorrectAnswerBeforeSubmission(item),
      ),
    );
  });

  test('final check unavailable before steps complete', async () => {
    const author = await createAuthor();
    const learner = await createLearner('incomplete');
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    for (const item of build.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
    });

    await assert.rejects(
      () =>
        getFinalLearningCheckForBuild({
          projectId: project.id,
          learnerId: learner.id,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_STEPS_NOT_COMPLETE',
    );
  });

  test('hint answer skip retry work with zero pack provider calls', async () => {
    const author = await createAuthor();
    const learner = await createLearner('mutations');
    const project = await createPublishedProject(author.id);
    await prepareCompletedBuildWithSession(learner.id, project.id);

    const check = await getFinalLearningCheckForBuild({
      projectId: project.id,
      learnerId: learner.id,
    });
    const first = check!.assignments[0]!;
    const callsBefore = providerCallCount;

    const hinted = await viewFinalLearningCheckHint({
      projectId: project.id,
      assignmentId: first.assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
    });
    assert.equal(hinted.hintViewed, true);
    assert.equal(hinted.attemptCount, 0);

    const wrong = await submitFinalLearningCheckAnswer({
      projectId: project.id,
      assignmentId: first.assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'b',
    });
    assert.equal(wrong.attempt.isCorrect, false);
    assert.equal(wrong.progress?.answered, 1);

    const right = await submitFinalLearningCheckAnswer({
      projectId: project.id,
      assignmentId: first.assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'a',
    });
    assert.equal(right.attempt.isCorrect, true);
    assert.ok(right.learningSummary);

    const second = check!.assignments[1]!;
    const skipped = await skipFinalLearningCheckAssignment({
      projectId: project.id,
      assignmentId: second.assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
    });
    assert.equal(skipped.assignment.uiState, 'SKIPPED');

    const afterSkip = await submitFinalLearningCheckAnswer({
      projectId: project.id,
      assignmentId: second.assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'a',
    });
    assert.equal(afterSkip.assignment.status, 'ANSWERED');
    assert.equal(providerCallCount, callsBefore);
  });

  test('completed build final answer does not change completedAt', async () => {
    const author = await createAuthor();
    const learner = await createLearner('completed-at');
    const project = await createPublishedProject(author.id);
    const { build } = await prepareCompletedBuildWithSession(
      learner.id,
      project.id,
    );
    const completedAt = build.completedAt!;
    const check = await getFinalLearningCheckForBuild({
      projectId: project.id,
      learnerId: learner.id,
    });

    await submitFinalLearningCheckAnswer({
      projectId: project.id,
      assignmentId: check!.assignments[0]!.assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'a',
    });

    const reloaded = await prisma.projectBuild.findUniqueOrThrow({
      where: { id: build.id },
    });
    assert.equal(reloaded.status, 'COMPLETED');
    assert.equal(reloaded.completedAt?.toISOString(), completedAt);
  });

  test('archived build rejects final mutations', async () => {
    const author = await createAuthor();
    const learner = await createLearner('archived');
    const project = await createPublishedProject(author.id);
    const { build } = await prepareCompletedBuildWithSession(
      learner.id,
      project.id,
    );
    const check = await getFinalLearningCheckForBuild({
      projectId: project.id,
      learnerId: learner.id,
    });

    await prisma.projectBuild.update({
      where: { id: build.id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });

    await assert.rejects(
      () =>
        submitFinalLearningCheckAnswer({
          projectId: project.id,
          assignmentId: check!.assignments[0]!.assignmentId,
          learnerId: learner.id,
          role: 'LEARNER',
          selectedOptionKey: 'a',
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'BUILD_LEARNING_CHECK_LOCKED',
    );
  });

  test('deterministic summary classifies concepts without AI', async () => {
    const summary = computeBuildLearningSummaryFromAssignments({
      confidenceBefore: 2,
      confidenceAfter: null,
      goalOutcome: null,
      assignments: [
        {
          stage: 'START',
          status: 'ANSWERED',
          answerAttempts: [{ isCorrect: true }],
          question: {
            conceptKey: 'baseline',
            promptEn: 'Baseline',
            promptAr: 'أساس',
          },
        },
        {
          stage: 'STEP',
          status: 'ANSWERED',
          answerAttempts: [{ isCorrect: true }],
          question: {
            conceptKey: 'safe_power',
            promptEn: 'Power safety',
            promptAr: 'سلامة الطاقة',
          },
        },
        {
          stage: 'FINAL',
          status: 'ANSWERED',
          answerAttempts: [{ isCorrect: false }],
          question: {
            conceptKey: 'motor_driver',
            promptEn: 'Motor driver purpose',
            promptAr: 'غرض محرك',
          },
        },
        {
          stage: 'FINAL',
          status: 'NOT_ATTEMPTED',
          answerAttempts: [],
          question: {
            conceptKey: 'unchecked',
            promptEn: 'Unchecked',
            promptAr: 'غير مفحوص',
          },
        },
      ],
    });

    assert.equal(summary.startCheck.correct, 1);
    assert.equal(summary.understoodConcepts[0]?.conceptKey, 'safe_power');
    assert.equal(summary.understoodConcepts[0]?.labelEn, 'Safe Power');
    assert.notEqual(
      summary.understoodConcepts[0]?.labelEn,
      'Power safety',
    );
    assert.equal(summary.reviewConcepts[0]?.conceptKey, 'motor_driver');
    assert.equal(summary.reviewConcepts[0]?.labelEn, 'Motor Driver');
    assert.notEqual(
      summary.reviewConcepts[0]?.labelEn,
      'Motor driver purpose',
    );
    assert.equal(summary.uncheckedConceptCount, 1);
    assert.ok(!summary.understoodConcepts.some((item) => item.conceptKey === 'baseline'));

    const mapped = computeBuildLearningSummaryFromAssignments({
      confidenceBefore: 2,
      confidenceAfter: 4,
      goalOutcome: null,
      assignments: [
        {
          stage: 'STEP',
          status: 'ANSWERED',
          answerAttempts: [{ isCorrect: true }],
          question: {
            conceptKey: 'component_purpose',
            promptEn: 'Why is a resistor connected in series with the LED?',
            promptAr: 'لماذا؟',
          },
        },
      ],
    });
    assert.equal(mapped.understoodConcepts[0]?.labelEn, 'Component purpose');
    assert.notEqual(
      mapped.understoodConcepts[0]?.labelEn,
      'Why is a resistor connected in series with the LED?',
    );
  });

  test('completion reflection requires completed build and refreshes summary', async () => {
    const author = await createAuthor();
    const learner = await createLearner('reflection');
    const project = await createPublishedProject(author.id);
    const { build, sessionId } = await prepareCompletedBuildWithSession(
      learner.id,
      project.id,
    );
    assert.ok(sessionId);

    const result = await updateLearningCompletionReflection({
      projectId: project.id,
      learnerId: learner.id,
      goalOutcome: 'PARTIALLY_ACHIEVED',
      confidenceAfter: 4,
      finalReflection: 'I learned wiring basics.',
    });

    assert.equal(result.session.goalOutcome, 'PARTIALLY_ACHIEVED');
    assert.equal(result.session.confidenceAfter, 4);
    assert.equal(result.learningSummary?.goalOutcome, 'PARTIALLY_ACHIEVED');
    assert.equal(result.learningSummary?.confidenceAfter, 4);

    const reloaded = await prisma.projectBuild.findUniqueOrThrow({
      where: { id: build.id },
    });
    assert.equal(reloaded.completedAt?.toISOString(), build.completedAt);

    await assert.rejects(
      () =>
        updateLearningCompletionReflection({
          projectId: project.id,
          learnerId: learner.id,
          confidenceAfter: 9,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'INVALID_CONFIDENCE',
    );
  });

  test('completion reflection remains bound to its completed attempt after build again', async () => {
    const author = await createAuthor();
    const learner = await createLearner('reflection-attempt-identity');
    const project = await createPublishedProject(author.id);
    const { build: firstAttempt } = await prepareCompletedBuildWithSession(
      learner.id,
      project.id,
    );

    await updateLearningCompletionReflection({
      projectId: project.id,
      buildId: firstAttempt.id,
      learnerId: learner.id,
      finalReflection: 'First completed reflection.',
    });

    const secondAttempt = await startProjectBuildAgainById(
      project.id,
      learner.id,
    );
    ids.builds.push(secondAttempt.id);
    assert.equal(secondAttempt.status, 'IN_PROGRESS');

    const result = await updateLearningCompletionReflection({
      projectId: project.id,
      buildId: firstAttempt.id,
      learnerId: learner.id,
      finalReflection: 'Updated first completed reflection.',
    });
    assert.equal(result.session.buildId, firstAttempt.id);
    assert.equal(
      result.session.finalReflection,
      'Updated first completed reflection.',
    );

    const [firstSession, reloadedSecondAttempt] = await Promise.all([
      prisma.projectBuildLearningSession.findUniqueOrThrow({
        where: { buildId: firstAttempt.id },
        select: { finalReflection: true },
      }),
      prisma.projectBuild.findUniqueOrThrow({
        where: { id: secondAttempt.id },
        select: { status: true, completedAt: true },
      }),
    ]);
    assert.equal(
      firstSession.finalReflection,
      'Updated first completed reflection.',
    );
    assert.equal(reloadedSecondAttempt.status, 'IN_PROGRESS');
    assert.equal(reloadedSecondAttempt.completedAt, null);
  });

  test('reflection rejected for in-progress build', async () => {
    const author = await createAuthor();
    const learner = await createLearner('in-progress-reflection');
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
    });

    await assert.rejects(
      () =>
        updateLearningCompletionReflection({
          projectId: project.id,
          learnerId: learner.id,
          confidenceAfter: 3,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'BUILD_LEARNING_REFLECTION_NOT_AVAILABLE',
    );
  });

  test('AI handoff requires submitted answer and makes zero provider calls', async () => {
    const author = await createAuthor();
    const learner = await createLearner('handoff');
    const project = await createPublishedProject(author.id);
    await prepareCompletedBuildWithSession(learner.id, project.id);
    const check = await getFinalLearningCheckForBuild({
      projectId: project.id,
      learnerId: learner.id,
    });

    await assert.rejects(
      () =>
        getFinalLearningCheckAiHandoff({
          projectId: project.id,
          assignmentId: check!.assignments[0]!.assignmentId,
          learnerId: learner.id,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'FINAL_LEARNING_CHECK_AI_HANDOFF_UNAVAILABLE',
    );

    await submitFinalLearningCheckAnswer({
      projectId: project.id,
      assignmentId: check!.assignments[0]!.assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'b',
    });

    const callsBefore = providerCallCount;
    const handoff = await getFinalLearningCheckAiHandoff({
      projectId: project.id,
      assignmentId: check!.assignments[0]!.assignmentId,
      learnerId: learner.id,
    });
    assert.equal(handoff.context.projectId, project.id);
    assert.equal(providerCallCount, callsBefore);
  });

  test('non-owner cannot access final check', async () => {
    const author = await createAuthor();
    const owner = await createLearner('owner');
    const other = await createLearner('other');
    const project = await createPublishedProject(author.id);
    await prepareCompletedBuildWithSession(owner.id, project.id);

    await assert.rejects(
      () =>
        getFinalLearningCheckForBuild({
          projectId: project.id,
          learnerId: other.id,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_NOT_FOUND',
    );
  });

  test('step completion without session still succeeds', async () => {
    const author = await createAuthor();
    const learner = await createLearner('no-session-complete');
    const project = await createPublishedProject(author.id);
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    for (const item of build.items) {
      await updateProjectBuildItemById(project.id, learner.id, item.id, {
        status: 'ALREADY_OWNED',
        learnerNote: null,
      });
    }

    const completed = await completeProjectBuildStepById(
      project.id,
      learner.id,
      project.steps[0]!.id,
    );
    assert.equal(completed.status, 'COMPLETED');
  });

  test('persist summary stores bounded json', async () => {
    const author = await createAuthor();
    const learner = await createLearner('persist-summary');
    const project = await createPublishedProject(author.id);
    const { sessionId } = await prepareCompletedBuildWithSession(
      learner.id,
      project.id,
    );
    assert.ok(sessionId);

    const summary = await persistBuildLearningSummary(sessionId);
    assert.ok(summary);
    assert.equal(summary.schemaVersion, 1);

    const stored = await prisma.projectBuildLearningSession.findUniqueOrThrow({
      where: { id: sessionId },
    });
    assert.ok(stored.learningSummary);
  });
});
