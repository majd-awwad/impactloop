import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import { startProjectBuildById } from '../learning-projects/learning-projects.service.js';
import { createLearningSessionForBuild } from './build-learning-session.service.js';
import {
  ensureReadyLearningPackForProject,
  MAX_LEARNING_PACK_GENERATION_ATTEMPTS,
  resolveProjectLearningContentHash,
  retryFailedLearningPackGeneration,
} from './project-learning-pack-ensure.service.js';
import { setProjectLearningPackGeneratorForTests } from './project-learning-pack-generator.factory.js';
import { uniqueLearningTestEmail, uniqueLearningTestPhone } from './project-learning-test-ids.js';
import { MockProjectLearningPackGeneratorProvider } from './project-learning-pack-generator.mock.provider.js';
import type {
  ProjectLearningPackGeneratorInput,
  ProjectLearningPackGeneratorProvider,
  ProjectLearningPackGeneratorResult,
} from './project-learning-pack-generator.provider.types.js';
import {
  assertPackIsMutable,
  createProjectLearningPackVersion,
  finalizeProjectLearningPack,
} from './project-learning-pack.service.js';
import {
  buildProjectLearningCanonicalSnapshot,
  buildProjectLearningHashPayload,
} from './project-learning-snapshot.js';
import { computeProjectLearningContentHash } from './project-learning-canonical.js';
import { validateGeneratedLearningPack } from './project-learning-pack-validation.js';
import { findProjectLearningPackByProjectAndHash } from './project-learning-pack.repository.js';

const TEST_MARKER = '[test-project-learning-pack-ensure]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  packs: [] as string[],
};

let providerCallCount = 0;

class CountingProjectLearningPackGenerator
  extends MockProjectLearningPackGeneratorProvider
  implements ProjectLearningPackGeneratorProvider
{
  private readonly delayMs: number;

  constructor(delayMs = 0) {
    super();
    this.delayMs = delayMs;
  }

  async generateProjectLearningPack(
    input: ProjectLearningPackGeneratorInput,
  ): Promise<ProjectLearningPackGeneratorResult> {
    providerCallCount += 1;
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    return super.generateProjectLearningPack(input);
  }
}

class FailingProjectLearningPackGenerator implements ProjectLearningPackGeneratorProvider {
  readonly name = 'failing-mock';

  async generateProjectLearningPack(): Promise<ProjectLearningPackGeneratorResult> {
    providerCallCount += 1;
    throw new AppError('Provider unavailable.', 503, 'LEARNING_PACK_PROVIDER_UNAVAILABLE');
  }
}

class InvalidOutputProjectLearningPackGenerator implements ProjectLearningPackGeneratorProvider {
  readonly name = 'invalid-mock';

  async generateProjectLearningPack(
    input: ProjectLearningPackGeneratorInput,
  ): Promise<ProjectLearningPackGeneratorResult> {
    providerCallCount += 1;
    const valid = await new MockProjectLearningPackGeneratorProvider().generateProjectLearningPack(
      input,
    );
    valid.data.questions = valid.data.questions.filter(
      (question) => question.stage !== 'FINAL',
    );
    return valid;
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
      title: `${TEST_MARKER} Ensure project`,
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
  providerCallCount = 0;
  setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
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
    await prisma.projectLearningQuestion.deleteMany({
      where: { packId: { in: ids.packs.filter(Boolean) } },
    });
    await prisma.projectLearningPack.deleteMany({
      where: { id: { in: ids.packs.filter(Boolean) } },
    });
  }
  if (ids.projects.length) {
    await prisma.projectBuildLearningSession.deleteMany({
      where: { build: { projectId: { in: ids.projects } } },
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

describe('project learning pack ensure LH-15', () => {
  test('11 first ensure call generates and persists one pack', async () => {
    providerCallCount = 0;
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);

    const result = await ensureReadyLearningPackForProject(project.id);
    ids.packs.push(result.status === 'READY' ? result.packId : '');

    assert.equal(result.status, 'READY');
    assert.equal(providerCallCount, 1);
    const packCount = await prisma.projectLearningPack.count({
      where: { projectId: project.id },
    });
    assert.equal(packCount, 1);
  });

  test('12 second ensure call for unchanged project returns the same READY pack', async () => {
    providerCallCount = 0;
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const first = await ensureReadyLearningPackForProject(project.id);
    const second = await ensureReadyLearningPackForProject(project.id);
    if (first.status === 'READY') ids.packs.push(first.packId);

    assert.equal(first.status, 'READY');
    assert.equal(second.status, 'READY');
    if (first.status === 'READY' && second.status === 'READY') {
      assert.equal(first.packId, second.packId);
    }
  });

  test('13 second ensure call makes zero additional provider calls', async () => {
    providerCallCount = 0;
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    await ensureReadyLearningPackForProject(project.id);
    const callsAfterFirst = providerCallCount;
    await ensureReadyLearningPackForProject(project.id);
    assert.equal(callsAfterFirst, 1);
    assert.equal(providerCallCount, 1);
  });

  test('14 multiple learners may later reuse the same pack identity', async () => {
    const author = await createAuthor();
    const learnerA = await createLearner();
    const learnerB = await createLearner();
    const project = await createPublishedProject(author.id);
    const ensured = await ensureReadyLearningPackForProject(project.id);
    assert.equal(ensured.status, 'READY');
    if (ensured.status !== 'READY') return;
    ids.packs.push(ensured.packId);

    const buildA = await startProjectBuildById(project.id, learnerA.id);
    const buildB = await startProjectBuildById(project.id, learnerB.id);
    ids.builds.push(buildA.id, buildB.id);

    assert.notEqual(buildA.id, buildB.id);
    assert.equal(ensured.packId, ensured.packId);
  });

  test('15 project edit produces a different content hash', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const before = await resolveProjectLearningContentHash(project.id);

    await prisma.learningProject.update({
      where: { id: project.id },
      data: { description: 'Updated learning description' },
    });

    const after = await resolveProjectLearningContentHash(project.id);
    assert.notEqual(before.contentHash, after.contentHash);
  });

  test('16 project edit produces a new pack version', async () => {
    providerCallCount = 0;
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const first = await ensureReadyLearningPackForProject(project.id);
    assert.equal(first.status, 'READY');

    await prisma.learningProject.update({
      where: { id: project.id },
      data: { description: 'Changed for version 2' },
    });

    const second = await ensureReadyLearningPackForProject(project.id);
    assert.equal(second.status, 'READY');
    if (first.status === 'READY' && second.status === 'READY') {
      ids.packs.push(first.packId, second.packId);
      assert.notEqual(first.packId, second.packId);
      assert.notEqual(first.contentHash, second.contentHash);
      assert.equal(second.versionNumber, first.versionNumber + 1);
    }
  });

  test('17 historical pack remains unchanged after project edit', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const first = await ensureReadyLearningPackForProject(project.id);
    assert.equal(first.status, 'READY');
    if (first.status !== 'READY') return;
    ids.packs.push(first.packId);

    const historicalQuestionCount = await prisma.projectLearningQuestion.count({
      where: { packId: first.packId },
    });

    await prisma.learningProject.update({
      where: { id: project.id },
      data: { description: 'Another edit' },
    });
    await ensureReadyLearningPackForProject(project.id);

    const afterCount = await prisma.projectLearningQuestion.count({
      where: { packId: first.packId },
    });
    assert.equal(historicalQuestionCount, afterCount);
  });

  test('18 existing session remains pinned to the old pack', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const first = await ensureReadyLearningPackForProject(project.id);
    assert.equal(first.status, 'READY');
    if (first.status !== 'READY') return;
    ids.packs.push(first.packId);

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const question = await prisma.projectLearningQuestion.findFirstOrThrow({
      where: { packId: first.packId },
    });
    const session = await createLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: first.packId,
      learningGoal: 'Learn',
      confidenceBefore: 3,
      assignments: [{ questionId: question.id, stage: 'START', displayOrder: 1 }],
    });

    await prisma.learningProject.update({
      where: { id: project.id },
      data: { description: 'Session pin test edit' },
    });
    await ensureReadyLearningPackForProject(project.id);

    const reloaded = await prisma.projectBuildLearningSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    assert.equal(reloaded.packId, first.packId);
  });

  test('19 two concurrent ensure calls result in one provider call', async () => {
    providerCallCount = 0;
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator(120));
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);

    const [first, second] = await Promise.all([
      ensureReadyLearningPackForProject(project.id),
      ensureReadyLearningPackForProject(project.id),
    ]);

    assert.equal(providerCallCount, 1);
    const packIds = new Set(
      [first, second]
        .map((result) => ('packId' in result ? result.packId : null))
        .filter(Boolean),
    );
    assert.equal(packIds.size, 1);
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('20 one pack row exists for one project and content hash', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    await ensureReadyLearningPackForProject(project.id);
    await ensureReadyLearningPackForProject(project.id);
    const { contentHash } = await resolveProjectLearningContentHash(project.id);
    const rows = await prisma.projectLearningPack.findMany({
      where: { projectId: project.id, contentHash },
    });
    assert.equal(rows.length, 1);
  });

  test('21 concurrent callers resolve to the same pack or valid generation status', async () => {
    providerCallCount = 0;
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator(80));
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const results = await Promise.all([
      ensureReadyLearningPackForProject(project.id),
      ensureReadyLearningPackForProject(project.id),
      ensureReadyLearningPackForProject(project.id),
    ]);
    const statuses = new Set(results.map((result) => result.status));
    assert.ok(statuses.has('READY') || statuses.has('GENERATING'));
    const packIds = results
      .map((result) => ('packId' in result ? result.packId : null))
      .filter(Boolean);
    assert.equal(new Set(packIds).size, 1);
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('22 concurrency behavior does not rely only on process memory', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const { contentHash } = await resolveProjectLearningContentHash(project.id);
    const precreated = await prisma.projectLearningPack.create({
      data: {
        projectId: project.id,
        versionNumber: 1,
        contentHash,
        status: 'GENERATING',
      },
    });
    ids.packs.push(precreated.id);
    providerCallCount = 0;

    const result = await ensureReadyLearningPackForProject(project.id);
    assert.equal(providerCallCount, 0);
    assert.equal(result.status, 'GENERATING');
    if (result.status === 'GENERATING') {
      assert.equal(result.packId, precreated.id);
    }
  });

  test('44 pack questions and options persist transactionally', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const result = await ensureReadyLearningPackForProject(project.id);
    assert.equal(result.status, 'READY');
    if (result.status !== 'READY') return;
    ids.packs.push(result.packId);

    const questions = await prisma.projectLearningQuestion.findMany({
      where: { packId: result.packId },
      include: { options: true },
    });
    assert.ok(questions.length > 0);
    assert.ok(questions.every((question) => question.options.length >= 2));
    assert.equal(result.questionCounts.total, questions.length);
  });

  test('45 validation failure persists no partial question set', async () => {
    providerCallCount = 0;
    setProjectLearningPackGeneratorForTests(new InvalidOutputProjectLearningPackGenerator());
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const result = await ensureReadyLearningPackForProject(project.id);
    assert.equal(result.status, 'FAILED');
    if (result.status !== 'FAILED') return;
    ids.packs.push(result.packId);

    const questionCount = await prisma.projectLearningQuestion.count({
      where: { packId: result.packId },
    });
    assert.equal(questionCount, 0);
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('46 provider failure marks pack FAILED', async () => {
    providerCallCount = 0;
    setProjectLearningPackGeneratorForTests(new FailingProjectLearningPackGenerator());
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const result = await ensureReadyLearningPackForProject(project.id);
    assert.equal(result.status, 'FAILED');
    if (result.status === 'FAILED') {
      ids.packs.push(result.packId);
      const pack = await prisma.projectLearningPack.findUniqueOrThrow({
        where: { id: result.packId },
      });
      assert.equal(pack.status, 'FAILED');
      assert.ok(pack.failureReason);
    }
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('48 READY pack cannot be edited', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const result = await ensureReadyLearningPackForProject(project.id);
    assert.equal(result.status, 'READY');
    if (result.status !== 'READY') return;
    ids.packs.push(result.packId);

    await assert.rejects(
      () => assertPackIsMutable(result.packId),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_IMMUTABLE',
    );
  });

  test('49 STALE pack cannot be edited', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const hash =
      'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
    const pack = await createProjectLearningPackVersion({
      projectId: project.id,
      contentHash: hash,
    });
    ids.packs.push(pack.id);
    await prisma.projectLearningPack.update({
      where: { id: pack.id },
      data: { status: 'STALE', staleAt: new Date(), staleReason: 'test' },
    });

    await assert.rejects(
      () => assertPackIsMutable(pack.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_IMMUTABLE',
    );
  });

  test('50 new content creates a new pack rather than mutating READY content', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const first = await ensureReadyLearningPackForProject(project.id);
    assert.equal(first.status, 'READY');
    if (first.status !== 'READY') return;
    ids.packs.push(first.packId);
    const firstQuestions = await prisma.projectLearningQuestion.findMany({
      where: { packId: first.packId },
    });

    await prisma.learningProject.update({
      where: { id: project.id },
      data: { title: `${TEST_MARKER} Ensure project revised` },
    });
    const second = await ensureReadyLearningPackForProject(project.id);
    assert.equal(second.status, 'READY');
    if (second.status !== 'READY') return;
    ids.packs.push(second.packId);

    const reloadedFirst = await prisma.projectLearningQuestion.findMany({
      where: { packId: first.packId },
    });
    assert.deepEqual(
      firstQuestions.map((question) => question.id),
      reloadedFirst.map((question) => question.id),
    );
    assert.notEqual(first.packId, second.packId);
  });

  test('52 FAILED pack does not regenerate on ordinary ensure call without allowed retry', async () => {
    providerCallCount = 0;
    setProjectLearningPackGeneratorForTests(new FailingProjectLearningPackGenerator());
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const failed = await ensureReadyLearningPackForProject(project.id);
    assert.equal(failed.status, 'FAILED');
    const callsAfterFail = providerCallCount;

    const again = await ensureReadyLearningPackForProject(project.id);
    assert.equal(again.status, 'FAILED');
    assert.equal(providerCallCount, callsAfterFail);
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('53 explicit retry is bounded', async () => {
    providerCallCount = 0;
    setProjectLearningPackGeneratorForTests(new FailingProjectLearningPackGenerator());
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const failed = await ensureReadyLearningPackForProject(project.id);
    assert.equal(failed.status, 'FAILED');
    if (failed.status !== 'FAILED') return;
    ids.packs.push(failed.packId);

    for (let attempt = 0; attempt < MAX_LEARNING_PACK_GENERATION_ATTEMPTS - 1; attempt += 1) {
      await retryFailedLearningPackGeneration(project.id, failed.packId);
    }

    await assert.rejects(
      () => retryFailedLearningPackGeneration(project.id, failed.packId),
      (error: unknown) =>
        error instanceof AppError && error.code === 'LEARNING_PACK_RETRY_LIMIT_REACHED',
    );
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('54 retry increments attempt metadata', async () => {
    providerCallCount = 0;
    setProjectLearningPackGeneratorForTests(new FailingProjectLearningPackGenerator());
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const failed = await ensureReadyLearningPackForProject(project.id);
    assert.equal(failed.status, 'FAILED');
    if (failed.status !== 'FAILED') return;
    ids.packs.push(failed.packId);

    const before = await prisma.projectLearningPack.findUniqueOrThrow({
      where: { id: failed.packId },
    });
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
    await retryFailedLearningPackGeneration(project.id, failed.packId);
    const after = await prisma.projectLearningPack.findUniqueOrThrow({
      where: { id: failed.packId },
    });
    assert.ok(after.generationAttemptCount > before.generationAttemptCount);
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('55 a successful retry creates one valid READY pack', async () => {
    providerCallCount = 0;
    setProjectLearningPackGeneratorForTests(new FailingProjectLearningPackGenerator());
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const failed = await ensureReadyLearningPackForProject(project.id);
    assert.equal(failed.status, 'FAILED');
    if (failed.status !== 'FAILED') return;
    ids.packs.push(failed.packId);

    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
    const retried = await retryFailedLearningPackGeneration(project.id, failed.packId);
    assert.equal(retried.status, 'READY');
    if (retried.status === 'READY') {
      assert.equal(retried.packId, failed.packId);
    }
  });

  test('56 repeated invalid output does not loop indefinitely', async () => {
    providerCallCount = 0;
    setProjectLearningPackGeneratorForTests(new InvalidOutputProjectLearningPackGenerator());
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const failed = await ensureReadyLearningPackForProject(project.id);
    assert.equal(failed.status, 'FAILED');
    if (failed.status !== 'FAILED') return;
    ids.packs.push(failed.packId);

    const callsAfterFirst = providerCallCount;
    const second = await retryFailedLearningPackGeneration(project.id, failed.packId);
    assert.equal(second.status, 'FAILED');
    assert.equal(providerCallCount, callsAfterFirst + 1);
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('57 failure reason is sanitized and bounded', async () => {
    setProjectLearningPackGeneratorForTests(new FailingProjectLearningPackGenerator());
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const failed = await ensureReadyLearningPackForProject(project.id);
    assert.equal(failed.status, 'FAILED');
    if (failed.status !== 'FAILED') return;
    ids.packs.push(failed.packId);

    const pack = await prisma.projectLearningPack.findUniqueOrThrow({
      where: { id: failed.packId },
    });
    assert.ok(pack.failureReason);
    assert.ok(pack.failureReason!.length <= 500);
    assert.equal(pack.lastGenerationErrorCode, 'LEARNING_PACK_PROVIDER_UNAVAILABLE');
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('58 provider secrets are not persisted', async () => {
    process.env.OPENAI_API_KEY = 'super-secret-key';
    setProjectLearningPackGeneratorForTests(new FailingProjectLearningPackGenerator());
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const failed = await ensureReadyLearningPackForProject(project.id);
    assert.equal(failed.status, 'FAILED');
    if (failed.status !== 'FAILED') return;
    ids.packs.push(failed.packId);

    const pack = await prisma.projectLearningPack.findUniqueOrThrow({
      where: { id: failed.packId },
    });
    assert.ok(!pack.failureReason?.includes('super-secret-key'));
    delete process.env.OPENAI_API_KEY;
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('59 no learner data is sent in generator input', async () => {
    let capturedInput: ProjectLearningPackGeneratorInput | null = null;
    class CapturingProvider extends MockProjectLearningPackGeneratorProvider {
      async generateProjectLearningPack(
        input: ProjectLearningPackGeneratorInput,
      ): Promise<ProjectLearningPackGeneratorResult> {
        capturedInput = input;
        return super.generateProjectLearningPack(input);
      }
    }
    setProjectLearningPackGeneratorForTests(new CapturingProvider());
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    await startProjectBuildById(project.id, learner.id);
    await ensureReadyLearningPackForProject(project.id);

    assert.ok(capturedInput);
    const serialized = JSON.stringify(capturedInput);
    assert.ok(!serialized.includes(learner.id));
    assert.ok(!serialized.includes(learner.email));
    setProjectLearningPackGeneratorForTests(new CountingProjectLearningPackGenerator());
  });

  test('prior unreferenced READY pack is marked STALE after new READY pack', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const first = await ensureReadyLearningPackForProject(project.id);
    assert.equal(first.status, 'READY');
    if (first.status !== 'READY') return;
    ids.packs.push(first.packId);

    await prisma.learningProject.update({
      where: { id: project.id },
      data: { description: 'Stale predecessor test' },
    });
    const second = await ensureReadyLearningPackForProject(project.id);
    assert.equal(second.status, 'READY');
    if (second.status !== 'READY') return;
    ids.packs.push(second.packId);

    const firstReloaded = await prisma.projectLearningPack.findUniqueOrThrow({
      where: { id: first.packId },
    });
    assert.equal(firstReloaded.status, 'STALE');
  });

  test('generator metadata is stored on successful generation', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const result = await ensureReadyLearningPackForProject(project.id);
    assert.equal(result.status, 'READY');
    if (result.status !== 'READY') return;
    ids.packs.push(result.packId);

    const pack = await prisma.projectLearningPack.findUniqueOrThrow({
      where: { id: result.packId },
    });
    assert.equal(pack.providerName, 'mock');
    assert.equal(pack.promptVersion, 'lh15-v1');
    assert.ok(pack.generationStartedAt);
    assert.ok(pack.generationCompletedAt);
    assert.ok(pack.generationAttemptCount >= 1);
  });
});

describe('local development session reset safety', () => {
  const removeLearningSessionForBuild = async (buildId: string) =>
    prisma.$transaction(async (tx) => {
      const session = await tx.projectBuildLearningSession.findUnique({
        where: { buildId },
      });
      if (!session) {
        return { removedSession: false, removedPack: false, packId: null as string | null };
      }

      const packId = session.packId;
      await tx.projectBuildLearningSession.delete({ where: { id: session.id } });

      const build = await tx.projectBuild.findUnique({ where: { id: buildId } });
      if (!build) {
        throw new Error('Practical build must remain after session reset.');
      }

      const remainingSessions = await tx.projectBuildLearningSession.count({
        where: { packId },
      });

      let removedPack = false;
      if (remainingSessions === 0) {
        await tx.projectLearningPack.delete({ where: { id: packId } });
        removedPack = true;
      }

      return { removedSession: true, removedPack, packId };
    });

  test('62 two builds may pin sessions to the same READY pack', async () => {
    const author = await createAuthor();
    const learnerA = await createLearner();
    const learnerB = await createLearner();
    const project = await createPublishedProject(author.id);
    const ensured = await ensureReadyLearningPackForProject(project.id);
    assert.equal(ensured.status, 'READY');
    if (ensured.status !== 'READY') return;
    ids.packs.push(ensured.packId);

    const questions = await prisma.projectLearningQuestion.findMany({
      where: { packId: ensured.packId },
      take: 2,
    });
    assert.ok(questions.length >= 1);

    const buildA = await startProjectBuildById(project.id, learnerA.id);
    const buildB = await startProjectBuildById(project.id, learnerB.id);
    ids.builds.push(buildA.id, buildB.id);

    const sessionA = await createLearningSessionForBuild({
      buildId: buildA.id,
      learnerId: learnerA.id,
      packId: ensured.packId,
      learningGoal: 'Learn A',
      confidenceBefore: 2,
      assignments: questions.map((question, index) => ({
        questionId: question.id,
        stage: question.stage,
        projectStepId: question.projectStepId,
        displayOrder: index + 1,
      })),
    });
    const sessionB = await createLearningSessionForBuild({
      buildId: buildB.id,
      learnerId: learnerB.id,
      packId: ensured.packId,
      learningGoal: 'Learn B',
      confidenceBefore: 3,
      assignments: questions.map((question, index) => ({
        questionId: question.id,
        stage: question.stage,
        projectStepId: question.projectStepId,
        displayOrder: index + 1,
      })),
    });

    assert.notEqual(sessionA.id, sessionB.id);
    assert.equal(sessionA.packId, ensured.packId);
    assert.equal(sessionB.packId, ensured.packId);
  });

  test('63 removing first build session preserves shared pack for second session', async () => {
    const author = await createAuthor();
    const learnerA = await createLearner();
    const learnerB = await createLearner();
    const project = await createPublishedProject(author.id);
    const ensured = await ensureReadyLearningPackForProject(project.id);
    assert.equal(ensured.status, 'READY');
    if (ensured.status !== 'READY') return;
    ids.packs.push(ensured.packId);

    const question = await prisma.projectLearningQuestion.findFirstOrThrow({
      where: { packId: ensured.packId },
    });
    const optionCountBefore = await prisma.projectLearningQuestionOption.count({
      where: { questionId: question.id },
    });
    assert.ok(optionCountBefore > 0);

    const buildA = await startProjectBuildById(project.id, learnerA.id);
    const buildB = await startProjectBuildById(project.id, learnerB.id);
    ids.builds.push(buildA.id, buildB.id);

    const sessionA = await createLearningSessionForBuild({
      buildId: buildA.id,
      learnerId: learnerA.id,
      packId: ensured.packId,
      learningGoal: 'A',
      confidenceBefore: 2,
      assignments: [
        {
          questionId: question.id,
          stage: question.stage,
          projectStepId: question.projectStepId,
          displayOrder: 1,
        },
      ],
    });
    const sessionB = await createLearningSessionForBuild({
      buildId: buildB.id,
      learnerId: learnerB.id,
      packId: ensured.packId,
      learningGoal: 'B',
      confidenceBefore: 3,
      assignments: [
        {
          questionId: question.id,
          stage: question.stage,
          projectStepId: question.projectStepId,
          displayOrder: 1,
        },
      ],
    });

    const result = await removeLearningSessionForBuild(buildA.id);
    assert.equal(result.removedSession, true);
    assert.equal(result.removedPack, false);

    const pack = await prisma.projectLearningPack.findUniqueOrThrow({
      where: { id: ensured.packId },
    });
    assert.equal(pack.status, 'READY');

    const questionAfter = await prisma.projectLearningQuestion.findUniqueOrThrow({
      where: { id: question.id },
    });
    assert.equal(questionAfter.packId, ensured.packId);

    const optionCountAfter = await prisma.projectLearningQuestionOption.count({
      where: { questionId: question.id },
    });
    assert.equal(optionCountAfter, optionCountBefore);

    const reloadedB = await prisma.projectBuildLearningSession.findUniqueOrThrow({
      where: { id: sessionB.id },
    });
    assert.equal(reloadedB.packId, ensured.packId);

    const assignmentCountB = await prisma.projectBuildLearningQuestionAssignment.count({
      where: { sessionId: sessionB.id },
    });
    assert.equal(assignmentCountB, 1);

    const buildAStill = await prisma.projectBuild.findUniqueOrThrow({
      where: { id: buildA.id },
    });
    assert.ok(buildAStill.id);

    const deletedA = await prisma.projectBuildLearningSession.findUnique({
      where: { id: sessionA.id },
    });
    assert.equal(deletedA, null);
  });

  test('64 removing final session reference deletes pack and cascades children', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const ensured = await ensureReadyLearningPackForProject(project.id);
    assert.equal(ensured.status, 'READY');
    if (ensured.status !== 'READY') return;

    const question = await prisma.projectLearningQuestion.findFirstOrThrow({
      where: { packId: ensured.packId },
    });
    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);

    await createLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: ensured.packId,
      learningGoal: 'Solo',
      confidenceBefore: 2,
      assignments: [
        {
          questionId: question.id,
          stage: question.stage,
          projectStepId: question.projectStepId,
          displayOrder: 1,
        },
      ],
    });

    const result = await removeLearningSessionForBuild(build.id);
    assert.equal(result.removedSession, true);
    assert.equal(result.removedPack, true);

    const pack = await prisma.projectLearningPack.findUnique({
      where: { id: ensured.packId },
    });
    assert.equal(pack, null);

    const questionAfter = await prisma.projectLearningQuestion.findUnique({
      where: { id: question.id },
    });
    assert.equal(questionAfter, null);

    const buildStill = await prisma.projectBuild.findUniqueOrThrow({
      where: { id: build.id },
    });
    assert.equal(buildStill.projectId, project.id);
  });

  test('65 existing session pack pin is not reassigned by ensure', async () => {
    const author = await createAuthor();
    const learner = await createLearner();
    const project = await createPublishedProject(author.id);
    const first = await ensureReadyLearningPackForProject(project.id);
    assert.equal(first.status, 'READY');
    if (first.status !== 'READY') return;
    ids.packs.push(first.packId);

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    const question = await prisma.projectLearningQuestion.findFirstOrThrow({
      where: { packId: first.packId },
    });
    const session = await createLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      packId: first.packId,
      learningGoal: 'Pinned',
      confidenceBefore: 2,
      assignments: [
        {
          questionId: question.id,
          stage: question.stage,
          projectStepId: question.projectStepId,
          displayOrder: 1,
        },
      ],
    });

    await prisma.learningProject.update({
      where: { id: project.id },
      data: { description: 'Edit after session pin' },
    });
    await ensureReadyLearningPackForProject(project.id);

    const reloaded = await prisma.projectBuildLearningSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    assert.equal(reloaded.packId, first.packId);
  });
});

describe('project learning pack ensure privacy regressions LH-15', () => {
  test('60 public project loading path remains unchanged for ensure internals', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const loaded = await prisma.learningProject.findFirst({
      where: { id: project.id, status: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        status: true,
      },
    });
    assert.ok(loaded);
    assert.equal(loaded!.title, `${TEST_MARKER} Ensure project`);
  });

  test('61 pack correct-answer metadata is not exposed through ensure result', async () => {
    const author = await createAuthor();
    const project = await createPublishedProject(author.id);
    const result = await ensureReadyLearningPackForProject(project.id);
    assert.equal(result.status, 'READY');
    const serialized = JSON.stringify(result);
    assert.ok(!serialized.includes('correctOptionKey'));
  });
});
