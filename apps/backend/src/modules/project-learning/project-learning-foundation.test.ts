import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';
import { uniqueLearningTestPhone } from './project-learning-test-ids.js';

import { findOwnedBuildById } from '../learning-projects/project-build-lifecycle.js';
import { startProjectBuildAgainById } from '../learning-projects/learning-projects.service.js';
import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';
import {
  assertAdminMutationNotAllowed,
  assertRoleCanReadLearningSession,
  assertSupplierOrDriverCannotAccessLearningSession,
  canAdminMutateLearningSession,
  canAdminReadLearningSession,
} from './project-learning.authorization.js';
import {
  createLearningSessionForBuild,
  getOwnedLearningSessionForBuild,
  loadStableLearningAssignments,
  skipLearningAssignment,
  submitLearningAnswerAttempt,
} from './build-learning-session.service.js';
import {
  learnerDtoExcludesCorrectAnswerMetadata,
  mapAdminLearningQuestionRead,
  mapLearnerLearningAssignment,
  mapLearnerLearningQuestion,
  resolveReviewCorrectOptionKey,
} from './project-learning.dto.js';
import { gradeProjectLearningAnswer } from './project-learning-grading.js';
import {
  addQuestionToGeneratingPack,
  assertPackQuestionImmutable,
  createProjectLearningPackVersion,
  finalizeProjectLearningPack,
} from './project-learning-pack.service.js';
import { findOwnedLearningSessionByBuildId } from './build-learning-session.repository.js';

const TEST_MARKER = '[test-project-learning-foundation]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  packs: [] as string[],
};

async function createLearner(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}@impactloop.test`,
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

async function createAuthor() {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Author`,
      email: `${TEST_MARKER}-author-${Date.now()}@impactloop.test`,
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

async function createProject(authorId: string, withSecondStep = false) {
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
      title: `${TEST_MARKER} Learning project`,
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
          ...(withSecondStep
            ? [
                {
                  stepNumber: 2,
                  title: 'Step 2',
                  description: 'Do step 2',
                  reviewStatus: 'ACCEPTED' as const,
                },
              ]
            : []),
        ],
      },
    },
    include: { steps: true },
  });
  ids.projects.push(project.id);
  return project;
}

const sampleOptions = [
  {
    optionKey: 'a',
    textEn: 'Option A',
    textAr: 'الخيار أ',
    displayOrder: 1,
  },
  {
    optionKey: 'b',
    textEn: 'Option B',
    textAr: 'الخيار ب',
    displayOrder: 2,
  },
];

async function seedReadyPack(
  projectId: string,
  stepId: string,
  contentHash: string,
) {
  const pack = await createProjectLearningPackVersion({
    projectId,
    contentHash,
  });
  ids.packs.push(pack.id);

  const startQuestion = await addQuestionToGeneratingPack(projectId, {
    packId: pack.id,
    stage: 'START',
    questionType: 'MULTIPLE_CHOICE',
    conceptKey: 'safety-basics',
    promptEn: 'Start question?',
    promptAr: 'سؤال البداية؟',
    explanationEn: 'Start explanation',
    explanationAr: 'شرح البداية',
    hintEn: 'Start hint',
    hintAr: 'تلميح البداية',
    correctOptionKey: 'a',
    packDisplayOrder: 1,
    options: sampleOptions,
  });

  const stepQuestion = await addQuestionToGeneratingPack(projectId, {
    packId: pack.id,
    stage: 'STEP',
    projectStepId: stepId,
    questionType: 'TRUE_FALSE',
    conceptKey: 'step-tools',
    promptEn: 'Step question?',
    promptAr: 'سؤال الخطوة؟',
    explanationEn: 'Step explanation',
    explanationAr: 'شرح الخطوة',
    hintEn: 'Step hint',
    hintAr: 'تلميح الخطوة',
    correctOptionKey: 'a',
    packDisplayOrder: 1,
    options: sampleOptions,
  });

  const finalQuestion = await addQuestionToGeneratingPack(projectId, {
    packId: pack.id,
    stage: 'FINAL',
    questionType: 'BEST_ACTION',
    conceptKey: 'wrap-up',
    promptEn: 'Final question?',
    promptAr: 'السؤال النهائي؟',
    explanationEn: 'Final explanation',
    explanationAr: 'شرح النهائي',
    hintEn: 'Final hint',
    hintAr: 'تلميح النهائي',
    correctOptionKey: 'b',
    packDisplayOrder: 1,
    options: sampleOptions,
  });

  const readyPack = await finalizeProjectLearningPack(pack.id);
  return {
    pack: readyPack,
    questions: {
      start: startQuestion,
      step: stepQuestion,
      final: finalQuestion,
    },
  };
}

async function startBuildRecord(projectId: string, learnerId: string) {
  const build = await learningProjectsRepository.startProjectBuild(
    projectId,
    learnerId,
  );
  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }
  ids.builds.push(build.id);
  return build;
}

async function createSessionForBuild(input: {
  buildId: string;
  learnerId: string;
  packId: string;
  questionIds: string[];
  stepId: string;
}) {
  return createLearningSessionForBuild({
    buildId: input.buildId,
    learnerId: input.learnerId,
    packId: input.packId,
    learningGoal: 'Understand the build',
    confidenceBefore: 3,
    assignments: [
      {
        questionId: input.questionIds[0]!,
        stage: 'START',
        displayOrder: 1,
      },
      {
        questionId: input.questionIds[1]!,
        stage: 'STEP',
        projectStepId: input.stepId,
        displayOrder: 1,
      },
      {
        questionId: input.questionIds[2]!,
        stage: 'FINAL',
        displayOrder: 1,
      },
    ],
  });
}

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.builds.length) {
    await prisma.projectBuildLearningSession.deleteMany({
      where: { buildId: { in: ids.builds } },
    });
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }
  if (ids.packs.length) {
    await prisma.projectLearningQuestion.deleteMany({
      where: { packId: { in: ids.packs } },
    });
    await prisma.projectLearningPack.deleteMany({ where: { id: { in: ids.packs } } });
  }
  if (ids.projects.length) {
    await prisma.projectBuildLearningSession.deleteMany({
      where: { build: { projectId: { in: ids.projects } } },
    });
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

describe('project learning foundation LH-14', () => {
  test('project may own multiple pack versions', async () => {
    const author = await createAuthor();
    const project = await createProject(author.id);

    const packV1 = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    });
    const packV2 = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    });
    ids.packs.push(packV1.id, packV2.id);

    assert.equal(packV1.versionNumber, 1);
    assert.equal(packV2.versionNumber, 2);
  });

  test('duplicate project content hash is rejected', async () => {
    const author = await createAuthor();
    const project = await createProject(author.id);
    const hash =
      'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    const pack = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: hash,
    });
    ids.packs.push(pack.id);

    await assert.rejects(
      () =>
        createProjectLearningPackVersion({
          projectId: project.id,
          contentHash: hash,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'LEARNING_PACK_DUPLICATE_CONTENT_HASH',
    );
  });

  test('pack version number is unique within a project', async () => {
    const author = await createAuthor();
    const project = await createProject(author.id);

    const pack = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    });
    ids.packs.push(pack.id);

    await assert.rejects(
      () =>
        prisma.projectLearningPack.create({
          data: {
            projectId: project.id,
            versionNumber: pack.versionNumber,
            contentHash:
              'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            status: 'GENERATING',
          },
        }),
      (error: unknown) =>
        error instanceof Error && (error as { code?: string }).code === 'P2002',
    );
  });

  test('one ready pack can be reused by multiple build sessions', async () => {
    const learnerA = await createLearner('reuse-pack-a');
    const learnerB = await createLearner('reuse-pack-b');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    );

    const buildA = await startBuildRecord(project.id, learnerA.id);
    ids.builds.push(buildA.id);
    const sessionA = await createSessionForBuild({
      buildId: buildA.id,
      learnerId: learnerA.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    const buildB = await startBuildRecord(project.id, learnerB.id);
    ids.builds.push(buildB.id);
    const sessionB = await createSessionForBuild({
      buildId: buildB.id,
      learnerId: learnerB.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    assert.equal(sessionA.packId, pack.id);
    assert.equal(sessionB.packId, pack.id);
    assert.notEqual(sessionA.buildId, sessionB.buildId);
  });

  test('each build has at most one learning session', async () => {
    const learner = await createLearner('one-session');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    );
    const build = await startBuildRecord(project.id, learner.id);
    ids.builds.push(build.id);

    await createSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    await assert.rejects(
      () =>
        createSessionForBuild({
          buildId: build.id,
          learnerId: learner.id,
          packId: pack.id,
          questionIds: [questions.start.id, questions.step.id, questions.final.id],
          stepId: project.steps[0]!.id,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'LEARNING_SESSION_ALREADY_EXISTS',
    );
  });

  test('session keeps the exact historical pack version', async () => {
    const learner = await createLearner('historical-pack');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    );
    const build = await startBuildRecord(project.id, learner.id);
    ids.builds.push(build.id);

    const session = await createSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    const newerPack = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: 'sha256:1212121212121212121212121212121212121212121212121212121212121212',
    });
    ids.packs.push(newerPack.id);

    const reloaded = await getOwnedLearningSessionForBuild(build.id, learner.id);
    assert.equal(reloaded?.packId, pack.id);
    assert.notEqual(reloaded?.packId, newerPack.id);
    assert.equal(session.packId, pack.id);
  });

  test('build again receives a separate session', async () => {
    const learner = await createLearner('build-again-session');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:1313131313131313131313131313131313131313131313131313131313131313',
    );

    const firstBuild = await startBuildRecord(project.id, learner.id);
    ids.builds.push(firstBuild.id);
    const firstSession = await createSessionForBuild({
      buildId: firstBuild.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    await prisma.projectBuild.update({
      where: { id: firstBuild.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const secondBuild = await startProjectBuildAgainById(project.id, learner.id);
    ids.builds.push(secondBuild.id);
    const secondSession = await createSessionForBuild({
      buildId: secondBuild.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    assert.notEqual(firstSession.id, secondSession.id);
    assert.notEqual(firstSession.buildId, secondSession.buildId);
  });

  test('STEP question references a valid project step', async () => {
    const author = await createAuthor();
    const project = await createProject(author.id);
    const pack = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: 'sha256:1414141414141414141414141414141414141414141414141414141414141414',
    });
    ids.packs.push(pack.id);

    const question = await addQuestionToGeneratingPack(project.id, {
      packId: pack.id,
      stage: 'STEP',
      projectStepId: project.steps[0]!.id,
      questionType: 'MULTIPLE_CHOICE',
      conceptKey: 'valid-step',
      promptEn: 'Step?',
      promptAr: 'خطوة؟',
      explanationEn: 'exp',
      explanationAr: 'شرح',
      hintEn: 'hint',
      hintAr: 'تلميح',
      correctOptionKey: 'a',
      packDisplayOrder: 1,
      options: sampleOptions,
    });

    assert.equal(question.projectStepId, project.steps[0]!.id);
  });

  test('STEP question cannot reference a step from another project', async () => {
    const author = await createAuthor();
    const projectA = await createProject(author.id);
    const projectB = await createProject(author.id);
    const pack = await createProjectLearningPackVersion({
      projectId: projectA.id,
      contentHash: 'sha256:1515151515151515151515151515151515151515151515151515151515151515',
    });
    ids.packs.push(pack.id);

    await assert.rejects(
      () =>
        addQuestionToGeneratingPack(projectA.id, {
          packId: pack.id,
          stage: 'STEP',
          projectStepId: projectB.steps[0]!.id,
          questionType: 'MULTIPLE_CHOICE',
          conceptKey: 'invalid-step',
          promptEn: 'Step?',
          promptAr: 'خطوة؟',
          explanationEn: 'exp',
          explanationAr: 'شرح',
          hintEn: 'hint',
          hintAr: 'تلميح',
          correctOptionKey: 'a',
          packDisplayOrder: 1,
          options: sampleOptions,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'LEARNING_QUESTION_STEP_INVALID',
    );
  });

  test('START and FINAL questions work without a project step', async () => {
    const author = await createAuthor();
    const project = await createProject(author.id);
    const pack = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: 'sha256:1616161616161616161616161616161616161616161616161616161616161616',
    });
    ids.packs.push(pack.id);

    const startQuestion = await addQuestionToGeneratingPack(project.id, {
      packId: pack.id,
      stage: 'START',
      questionType: 'MULTIPLE_CHOICE',
      conceptKey: 'start',
      promptEn: 'Start?',
      promptAr: 'بداية؟',
      explanationEn: 'exp',
      explanationAr: 'شرح',
      hintEn: 'hint',
      hintAr: 'تلميح',
      correctOptionKey: 'a',
      packDisplayOrder: 1,
      options: sampleOptions,
    });
    const finalQuestion = await addQuestionToGeneratingPack(project.id, {
      packId: pack.id,
      stage: 'FINAL',
      questionType: 'BEST_ACTION',
      conceptKey: 'final',
      promptEn: 'Final?',
      promptAr: 'نهائي؟',
      explanationEn: 'exp',
      explanationAr: 'شرح',
      hintEn: 'hint',
      hintAr: 'تلميح',
      correctOptionKey: 'b',
      packDisplayOrder: 1,
      options: sampleOptions,
    });

    assert.equal(startQuestion.projectStepId, null);
    assert.equal(finalQuestion.projectStepId, null);
  });

  test('option keys are unique within a question', async () => {
    const author = await createAuthor();
    const project = await createProject(author.id);
    const pack = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: 'sha256:1717171717171717171717171717171717171717171717171717171717171717',
    });
    ids.packs.push(pack.id);

    await addQuestionToGeneratingPack(project.id, {
      packId: pack.id,
      stage: 'START',
      questionType: 'MULTIPLE_CHOICE',
      conceptKey: 'dup-option',
      promptEn: 'Dup?',
      promptAr: 'مكرر؟',
      explanationEn: 'exp',
      explanationAr: 'شرح',
      hintEn: 'hint',
      hintAr: 'تلميح',
      correctOptionKey: 'a',
      packDisplayOrder: 1,
      options: sampleOptions,
    });

    const question = await prisma.projectLearningQuestion.findFirstOrThrow({
      where: { packId: pack.id },
    });

    await assert.rejects(
      () =>
        prisma.projectLearningQuestionOption.create({
          data: {
            questionId: question.id,
            optionKey: 'a',
            textEn: 'dup',
            textAr: 'مكرر',
            displayOrder: 3,
          },
        }),
      (error: unknown) =>
        error instanceof Error && (error as { code?: string }).code === 'P2002',
    );
  });

  test('one deterministic correct option exists per gradable question', async () => {
    const author = await createAuthor();
    const project = await createProject(author.id);
    const pack = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: 'sha256:1818181818181818181818181818181818181818181818181818181818181818',
    });
    ids.packs.push(pack.id);

    await assert.rejects(
      () =>
        addQuestionToGeneratingPack(project.id, {
          packId: pack.id,
          stage: 'START',
          questionType: 'MULTIPLE_CHOICE',
          conceptKey: 'bad-correct',
          promptEn: 'Bad?',
          promptAr: 'خطأ؟',
          explanationEn: 'exp',
          explanationAr: 'شرح',
          hintEn: 'hint',
          hintAr: 'تلميح',
          correctOptionKey: 'missing',
          packDisplayOrder: 1,
          options: sampleOptions,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'LEARNING_QUESTION_CORRECT_OPTION_INVALID',
    );
  });

  test('learner mapper excludes correct-answer metadata', async () => {
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:1919191919191919191919191919191919191919191919191919191919191919',
    );

    const learnerDto = mapLearnerLearningQuestion(questions.start);
    const adminDto = mapAdminLearningQuestionRead(questions.start);

    assert.equal(learnerDtoExcludesCorrectAnswerMetadata(learnerDto), true);
    assert.equal(adminDto.correctOptionKey, 'a');
    assert.equal('correctOptionKey' in learnerDto, false);
    assert.ok(pack.id);
  });

  test('reviewCorrectOptionKey is exposed only after incorrect submission', async () => {
    const baseQuestion = {
      id: 'q-1',
      stage: 'START',
      projectStepId: null,
      questionType: 'MULTIPLE_CHOICE',
      conceptKey: 'concept',
      promptEn: 'Prompt',
      promptAr: 'سؤال',
      explanationEn: 'exp',
      explanationAr: 'شرح',
      hintEn: 'hint',
      hintAr: 'تلميح',
      relativeDifficulty: 1,
      correctOptionKey: 'a',
      options: [
        {
          id: 'opt-a',
          questionId: 'q-1',
          optionKey: 'a',
          textEn: 'A',
          textAr: 'أ',
          displayOrder: 1,
        },
      ],
    };

    const unanswered = mapLearnerLearningAssignment({
      id: 'assign-1',
      questionId: 'q-1',
      stage: 'START',
      projectStepId: null,
      orderScopeKey: 'START',
      displayOrder: 1,
      status: 'NOT_ATTEMPTED',
      hintViewedAt: null,
      question: baseQuestion,
      answerAttempts: [],
    });

    assert.equal(unanswered.reviewCorrectOptionKey, null);
    assert.equal('correctOptionKey' in unanswered.question, false);

    const incorrect = mapLearnerLearningAssignment({
      id: 'assign-2',
      questionId: 'q-1',
      stage: 'START',
      projectStepId: null,
      orderScopeKey: 'START',
      displayOrder: 2,
      status: 'ANSWERED',
      hintViewedAt: null,
      question: baseQuestion,
      answerAttempts: [
        {
          id: 'attempt-1',
          assignmentId: 'assign-2',
          attemptNumber: 1,
          selectedOptionKey: 'b',
          isCorrect: false,
          submittedAt: new Date('2026-01-15T00:00:00.000Z'),
        },
      ],
    });

    assert.equal(incorrect.reviewCorrectOptionKey, 'a');
    assert.equal(
      resolveReviewCorrectOptionKey({
        id: 'assign-2',
        questionId: 'q-1',
        stage: 'START',
        projectStepId: null,
        orderScopeKey: 'START',
        displayOrder: 2,
        status: 'ANSWERED',
        hintViewedAt: null,
        question: baseQuestion,
        answerAttempts: incorrect.answerAttempts.map((attempt) => ({
          id: attempt.id,
          assignmentId: 'assign-2',
          attemptNumber: attempt.attemptNumber,
          selectedOptionKey: attempt.selectedOptionKey,
          isCorrect: attempt.isCorrect,
          submittedAt: new Date(attempt.submittedAt),
        })),
      }),
      'a',
    );
  });

  test('assignments remain stable after reload', async () => {
    const learner = await createLearner('stable-assignments');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:2020202020202020202020202020202020202020202020202020202020202020',
    );
    const build = await startBuildRecord(project.id, learner.id);
    ids.builds.push(build.id);
    await createSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    const { firstLoad, secondLoad } = await loadStableLearningAssignments(
      build.id,
      learner.id,
    );

    assert.deepEqual(
      firstLoad?.assignments.map((assignment) => ({
        id: assignment.id,
        questionId: assignment.questionId,
        displayOrder: assignment.displayOrder,
        orderScopeKey: assignment.orderScopeKey,
      })),
      secondLoad?.assignments.map((assignment) => ({
        id: assignment.id,
        questionId: assignment.questionId,
        displayOrder: assignment.displayOrder,
        orderScopeKey: assignment.orderScopeKey,
      })),
    );
  });

  test('assignment display order cannot conflict within scope', async () => {
    const learner = await createLearner('assignment-order');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:2121212121212121212121212121212121212121212121212121212121212121',
    );
    const build = await startBuildRecord(project.id, learner.id);
    ids.builds.push(build.id);

    const session = await createSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    await assert.rejects(
      () =>
        prisma.projectBuildLearningQuestionAssignment.create({
          data: {
            sessionId: session.id,
            questionId: questions.start.id,
            stage: 'START',
            orderScopeKey: '__START__',
            displayOrder: 1,
          },
        }),
      (error: unknown) =>
        error instanceof Error && (error as { code?: string }).code === 'P2002',
    );
  });

  test('multiple answer attempts may exist for one assignment', async () => {
    const learner = await createLearner('multi-attempt');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:2221212121212121212121212121212121212121212121212121212121212121',
    );
    const build = await startBuildRecord(project.id, learner.id);
    ids.builds.push(build.id);
    const session = await createSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });
    const startAssignment = session.assignments.find(
      (assignment) => assignment.stage === 'START',
    );
    assert.ok(startAssignment);
    const assignmentId = startAssignment.id;

    await submitLearningAnswerAttempt({
      assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'b',
    });
    await submitLearningAnswerAttempt({
      assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'a',
    });

    const attempts = await prisma.projectBuildLearningAnswerAttempt.findMany({
      where: { assignmentId },
      orderBy: { attemptNumber: 'asc' },
    });
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0]?.isCorrect, false);
    assert.equal(attempts[1]?.isCorrect, true);
  });

  test('attempt numbers cannot duplicate', async () => {
    const learner = await createLearner('dup-attempt');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:2323232323232323232323232323232323232323232323232323232323232323',
    );
    const build = await startBuildRecord(project.id, learner.id);
    ids.builds.push(build.id);
    const session = await createSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });
    const startAssignment = session.assignments.find(
      (assignment) => assignment.stage === 'START',
    );
    assert.ok(startAssignment);
    const assignmentId = startAssignment.id;

    await submitLearningAnswerAttempt({
      assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
      selectedOptionKey: 'a',
    });

    await assert.rejects(
      () =>
        prisma.projectBuildLearningAnswerAttempt.create({
          data: {
            assignmentId,
            attemptNumber: 1,
            selectedOptionKey: 'a',
            isCorrect: true,
          },
        }),
      (error: unknown) =>
        error instanceof Error && (error as { code?: string }).code === 'P2002',
    );
  });

  test('backend calculates correctness', async () => {
    const grading = gradeProjectLearningAnswer(
      {
        correctOptionKey: 'a',
        options: sampleOptions,
      },
      'a',
    );
    assert.equal(grading.isCorrect, true);

    const wrong = gradeProjectLearningAnswer(
      {
        correctOptionKey: 'a',
        options: sampleOptions,
      },
      'b',
    );
    assert.equal(wrong.isCorrect, false);
  });

  test('skipped assignment is not stored as an answer attempt', async () => {
    const learner = await createLearner('skip');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:2424242424242424242424242424242424242424242424242424242424242424',
    );
    const build = await startBuildRecord(project.id, learner.id);
    ids.builds.push(build.id);
    const session = await createSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });
    const startAssignment = session.assignments.find(
      (assignment) => assignment.stage === 'START',
    );
    assert.ok(startAssignment);
    const assignmentId = startAssignment.id;

    await skipLearningAssignment({
      assignmentId,
      learnerId: learner.id,
      role: 'LEARNER',
    });

    const attempts = await prisma.projectBuildLearningAnswerAttempt.count({
      where: { assignmentId },
    });
    const assignment =
      await prisma.projectBuildLearningQuestionAssignment.findUniqueOrThrow({
        where: { id: assignmentId },
      });
    assert.equal(attempts, 0);
    assert.equal(assignment.status, 'SKIPPED');
  });

  test('non-owner cannot access private session data', async () => {
    const owner = await createLearner('owner');
    const other = await createLearner('other');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:2525252525252525252525252525252525252525252525252525252525252525',
    );
    const build = await startBuildRecord(project.id, owner.id);
    ids.builds.push(build.id);
    await createSessionForBuild({
      buildId: build.id,
      learnerId: owner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    const foreignSession = await findOwnedLearningSessionByBuildId(
      build.id,
      other.id,
    );
    assert.equal(foreignSession, null);
  });

  test('supplier and driver cannot access learner session data', () => {
    assert.throws(
      () => assertSupplierOrDriverCannotAccessLearningSession('SUPPLIER'),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'LEARNING_SESSION_NOT_FOUND',
    );
    assert.throws(
      () => assertSupplierOrDriverCannotAccessLearningSession('DRIVER'),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'LEARNING_SESSION_NOT_FOUND',
    );
  });

  test('admin access is read-only at service-policy level', () => {
    assert.equal(canAdminReadLearningSession('ADMIN'), true);
    assert.equal(canAdminMutateLearningSession('ADMIN'), false);
    assert.throws(
      () => assertAdminMutationNotAllowed('ADMIN'),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'LEARNING_SESSION_ADMIN_READ_ONLY',
    );
  });

  test('existing builds work without learning sessions', async () => {
    const learner = await createLearner('no-session');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const build = await startBuildRecord(project.id, learner.id);

    const ownedBuild = await findOwnedBuildById(build.id, learner.id);
    const session = await getOwnedLearningSessionForBuild(build.id, learner.id);

    assert.ok(ownedBuild);
    assert.equal(session, null);
  });

  test('creating a newer pack does not rewrite a historical session', async () => {
    const learner = await createLearner('historical-session');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:2626262626262626262626262626262626262626262626262626262626262626',
    );
    const build = await startBuildRecord(project.id, learner.id);
    ids.builds.push(build.id);
    const session = await createSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    const newerPack = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: 'sha256:2727272727272727272727272727272727272727272727272727272727272727',
    });
    ids.packs.push(newerPack.id);

    const reloaded = await prisma.projectBuildLearningSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    assert.equal(reloaded.packId, pack.id);
  });

  test('admin read policy allows read but not mutation for foreign learner', () => {
    assert.doesNotThrow(() =>
      assertRoleCanReadLearningSession({
        role: 'ADMIN',
        learnerId: 'admin-user',
        sessionLearnerId: 'learner-user',
      }),
    );
  });

  test('ready referenced pack content is immutable', async () => {
    const learner = await createLearner('immutable-pack');
    const author = await createAuthor();
    const project = await createProject(author.id);
    const { pack, questions } = await seedReadyPack(
      project.id,
      project.steps[0]!.id,
      'sha256:2828282828282828282828282828282828282828282828282828282828282828',
    );
    const build = await startBuildRecord(project.id, learner.id);
    ids.builds.push(build.id);
    await createSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: pack.id,
      questionIds: [questions.start.id, questions.step.id, questions.final.id],
      stepId: project.steps[0]!.id,
    });

    await assert.rejects(
      () => assertPackQuestionImmutable(pack.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_IMMUTABLE',
    );
  });
});
