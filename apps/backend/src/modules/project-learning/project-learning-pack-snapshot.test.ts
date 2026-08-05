import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { uniqueLearningTestPhone } from './project-learning-test-ids.js';
import { AppError } from '../../utils/app-error.js';

import {
  computeProjectLearningContentHash,
  PROJECT_LEARNING_HASH_SCHEMA_VERSION,
} from './project-learning-canonical.js';
import {
  buildProjectLearningCanonicalSnapshot,
  buildProjectLearningHashPayload,
} from './project-learning-snapshot.js';
import { validateGeneratedLearningPack } from './project-learning-pack-validation.js';
import {
  PROJECT_LEARNING_PACK_GENERATOR_SCHEMA_VERSION,
  type GeneratedLearningPack,
} from './project-learning-pack-generation.schema.js';
import { MockProjectLearningPackGeneratorProvider } from './project-learning-pack-generator.mock.provider.js';

const TEST_MARKER = '[test-project-learning-pack-snapshot]';
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  projects: [] as string[],
};

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
      title: `${TEST_MARKER} Hash project`,
      shortDescription: 'Short description',
      description: 'Full description for learning',
      difficulty: 'BEGINNER',
      estimatedDurationMinutes: 45,
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName: 'LED',
            materialType: 'LED',
            quantity: 2,
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
            title: 'Wire the LED',
            description: 'Connect LED safely',
            reviewStatus: 'ACCEPTED',
          },
          {
            stepNumber: 2,
            title: 'Test circuit',
            description: 'Verify the circuit works',
            reviewStatus: 'ACCEPTED',
          },
        ],
      },
    },
    include: {
      requiredComponents: true,
      steps: true,
    },
  });
  ids.projects.push(project.id);
  return project;
}

async function loadProject(projectId: string) {
  return prisma.learningProject.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      requiredComponents: { orderBy: { createdAt: 'asc' } },
      steps: { orderBy: { stepNumber: 'asc' } },
    },
  });
}

const buildValidPack = async (
  snapshot: ReturnType<typeof buildProjectLearningCanonicalSnapshot>,
): Promise<GeneratedLearningPack> => {
  const provider = new MockProjectLearningPackGeneratorProvider();
  const result = await provider.generateProjectLearningPack({
    snapshot,
    contentHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    promptVersion: 'lh15-v1',
    generatorSchemaVersion: PROJECT_LEARNING_PACK_GENERATOR_SCHEMA_VERSION,
  });
  return result.data;
};

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.projects.length) {
    await prisma.learnerMaterialRequest.deleteMany({
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

describe('project learning canonical snapshot and hash LH-15', () => {
  test('1 same project learning content produces the same canonical snapshot', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const loaded = await loadProject(project.id);
    const first = buildProjectLearningCanonicalSnapshot(loaded);
    const second = buildProjectLearningCanonicalSnapshot(loaded);
    assert.deepEqual(first, second);
  });

  test('2 same canonical snapshot produces the same content hash', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const payload = buildProjectLearningHashPayload(snapshot);
    const first = computeProjectLearningContentHash(payload);
    const second = computeProjectLearningContentHash(payload);
    assert.equal(first, second);
  });

  test('3 step description change changes the hash', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const before = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );

    await prisma.projectStep.update({
      where: { id: project.steps[0]!.id },
      data: { description: 'Updated step description' },
    });

    const after = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );
    assert.notEqual(before, after);
  });

  test('4 step order change changes the hash', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const before = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );

    await prisma.projectStep.update({
      where: { id: project.steps[0]!.id },
      data: { stepNumber: 3 },
    });
    await prisma.projectStep.update({
      where: { id: project.steps[1]!.id },
      data: { stepNumber: 1 },
    });

    const after = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );
    assert.notEqual(before, after);
  });

  test('5 required component change changes the hash', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const before = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );

    await prisma.projectRequiredComponent.update({
      where: { id: project.requiredComponents[0]!.id },
      data: { quantity: 5 },
    });

    const after = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );
    assert.notEqual(before, after);
  });

  test('6 component role change changes the hash when components exist', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const before = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );

    await prisma.projectRequiredComponent.update({
      where: { id: project.requiredComponents[0]!.id },
      data: { componentRole: 'TOOL' },
    });

    const after = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );
    assert.notEqual(before, after);
  });

  test('7 project likes do not change the hash', async () => {
    const author = await createAuthor();
    const learner = await createAuthor();
    const project = await createPublishedProject(author.id);
    const before = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );

    await prisma.projectLike.create({
      data: { projectId: project.id, userId: learner.id },
    });

    const after = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );
    assert.equal(before, after);
  });

  test('8 material availability does not change the hash', async () => {
    const author = await createAuthor();
    const learner = await createAuthor();
    const project = await createPublishedProject(author.id);
    const before = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );

    await prisma.learnerMaterialRequest.create({
      data: {
        projectId: project.id,
        learnerId: learner.id,
        categoryId: ids.materialCategories[0]!,
        requestedItemName: 'LED',
        normalizedRequestedItemName: 'led',
        quantity: 1,
        unit: 'piece',
        locationCountry: 'PS',
        locationCity: 'Ramallah',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const after = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );
    assert.equal(before, after);
  });

  test('9 whitespace normalization behaves deterministically', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const baseline = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );

    await prisma.learningProject.update({
      where: { id: project.id },
      data: {
        title: '  [test-project-learning-pack-snapshot] Hash project  ',
        description: 'Full   description   for learning',
      },
    });

    const normalized = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );
    assert.equal(baseline, normalized);
  });

  test('10 hash format matches sha256 lowercase hex contract', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const hash = computeProjectLearningContentHash(
      buildProjectLearningHashPayload(
        buildProjectLearningCanonicalSnapshot(await loadProject(project.id)),
      ),
    );
    assert.match(hash, HASH_PATTERN);
    assert.equal(PROJECT_LEARNING_HASH_SCHEMA_VERSION, 1);
  });
});

describe('project learning pack validation LH-15', () => {
  test('23 valid bilingual pack is accepted', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    assert.doesNotThrow(() => validateGeneratedLearningPack(pack, snapshot));
  });

  test('24 missing Arabic prompt is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.promptAr = '';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('25 missing English prompt is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.promptEn = '';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('26 unknown step ID is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    const stepQuestion = pack.questions.find((question) => question.stage === 'STEP');
    stepQuestion!.projectStepId = 'unknown-step-id';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('27 missing STEP question for one project step is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions = pack.questions.filter(
      (question) =>
        !(question.stage === 'STEP' && question.projectStepId === project.steps[1]!.id),
    );
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('28 START count outside 2-3 is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions = pack.questions.filter((question) => question.stage !== 'START');
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('29 STEP count outside 1-2 is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    const stepId = project.steps[0]!.id;
    const stepQuestion = pack.questions.find(
      (question) => question.stage === 'STEP' && question.projectStepId === stepId,
    )!;
    pack.questions.push(
      { ...stepQuestion, packDisplayOrder: 2 },
      { ...stepQuestion, packDisplayOrder: 3 },
    );
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('30 FINAL count outside 3-5 is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions = pack.questions.filter((question) => question.stage !== 'FINAL');
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('31 unsupported question type is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    (pack.questions[0] as { questionType: string }).questionType = 'ESSAY';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('32 invalid option count is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    const mcQuestion = pack.questions.find(
      (question) => question.questionType === 'MULTIPLE_CHOICE',
    );
    mcQuestion!.options = mcQuestion!.options.slice(0, 2);
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('33 duplicate option keys are rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.options[1]!.optionKey = pack.questions[0]!.options[0]!.optionKey;
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('34 duplicate option text is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.options[1]!.textEn = pack.questions[0]!.options[0]!.textEn;
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('35 missing correct option is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.correctOptionKey = 'missing';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('36 unknown correctOptionKey is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.correctOptionKey = 'z';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('37 multiple effective correct answers are rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    const question = pack.questions[0]!;
    question.options[1]!.textEn = question.options[0]!.textEn;
    question.options[1]!.textAr = question.options[0]!.textAr;
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('38 invalid relativeDifficulty is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.relativeDifficulty = 9;
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('39 invalid conceptKey is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.conceptKey = 'Invalid Key!';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('40 HTML or script-like content is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.promptEn = '<script>alert(1)</script>What is safety?';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('41 overlong content is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.promptEn = 'x'.repeat(600);
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('42 START question with step ID is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions.find((question) => question.stage === 'START')!.projectStepId =
      project.steps[0]!.id;
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('43 STEP question without step ID is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions.find((question) => question.stage === 'STEP')!.projectStepId = null;
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('44 forbidden distractor pattern is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    const question = pack.questions.find((item) => item.stage === 'START')!;
    const distractor = question.options.find(
      (option) => option.optionKey !== question.correctOptionKey,
    )!;
    distractor.textEn = 'Skip all steps and ignore materials';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('45 STEP correct answer that only repeats the step title is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    const step = snapshot.steps[0]!;
    const question = pack.questions.find(
      (item) => item.stage === 'STEP' && item.projectStepId === step.id,
    )!;
    const correct = question.options.find(
      (option) => option.optionKey === question.correctOptionKey,
    )!;
    correct.textEn = step.title;
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });

  test('46 generic conceptKey is rejected', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const snapshot = buildProjectLearningCanonicalSnapshot(await loadProject(project.id));
    const pack = await buildValidPack(snapshot);
    pack.questions[0]!.conceptKey = 'concept';
    assert.throws(
      () => validateGeneratedLearningPack(pack, snapshot),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_VALIDATION_FAILED',
    );
  });
});
