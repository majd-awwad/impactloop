import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  getLearnerBuildsList,
  getLearnerPortfolio,
} from '../learner-builds/learner-builds.service.js';
import {
  deriveLearnerBuildLearningListStatus,
  mapMyBuildsLearningSummary,
  mapPortfolioLearningStory,
} from '../learner-builds/learner-build-learning-summary.js';
import {
  completeProjectBuildStepById,
  startProjectBuildById,
  updateProjectBuildItemById,
} from '../learning-projects/learning-projects.service.js';
import { setupLearningSessionForBuild } from '../project-learning/build-learning-session-setup.service.js';
import { setProjectLearningPackGeneratorForTests } from '../project-learning/project-learning-pack-generator.factory.js';
import { uniqueLearningTestEmail, uniqueLearningTestPhone } from '../project-learning/project-learning-test-ids.js';
import { MockProjectLearningPackGeneratorProvider } from '../project-learning/project-learning-pack-generator.mock.provider.js';
import { skipLearningAssignmentForLearner } from '../project-learning/build-learning-session.service.js';
import { persistBuildLearningSummary } from '../project-learning/project-learning-summary.service.js';
import { updateLearningCompletionReflection } from '../project-learning/learning-completion-reflection.service.js';
import {
  getAdminBuildLearningDetail,
  listAdminLearnerBuildsWithLearning,
} from '../admin-people/admin-build-learning.service.js';

const TEST_MARKER = '[test-learner-builds-learning-lh19]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
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

async function createAdmin() {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Admin`,
      email: uniqueLearningTestEmail(TEST_MARKER, ''),
      passwordHash: await hashPassword('TestPassword123!'),
      phone: uniqueLearningTestPhone(),
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
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
      title: `${TEST_MARKER} LH-19 project`,
      shortDescription: 'Short',
      description: 'Description for LH-19 learning progress surfaces.',
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
  });
  ids.projects.push(project.id);
  return project;
}

async function prepareOwnedMaterials(
  projectId: string,
  learnerId: string,
  buildId: string,
) {
  const build = await prisma.projectBuild.findUniqueOrThrow({
    where: { id: buildId },
    include: { items: true },
  });
  for (const item of build.items) {
    await updateProjectBuildItemById(projectId, learnerId, item.id, {
      status: 'ALREADY_OWNED',
      learnerNote: null,
    });
  }
}

describe('learner builds learning LH-19', () => {
  before(() => {
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
    const categoryIds = [...ids.categories, ...ids.materialCategories];
    if (categoryIds.length) {
      await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    }
    if (ids.users.length) {
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    }
  });

  test('mapper derives NOT_AVAILABLE without session', () => {
    const learning = mapMyBuildsLearningSummary({
      buildStatus: 'IN_PROGRESS',
      session: null,
    });
    assert.equal(learning.status, 'NOT_AVAILABLE');
    assert.equal(learning.hasLearningGoal, false);
  });

  test('mapper derives NOT_STARTED for empty session', () => {
    const learning = mapMyBuildsLearningSummary({
      buildStatus: 'IN_PROGRESS',
      session: {
        id: 's1',
        learningGoal: null,
        confidenceBefore: null,
        confidenceAfter: null,
        goalOutcome: null,
        finalReflection: null,
        learningSummary: null,
      },
    });
    assert.equal(learning.status, 'NOT_STARTED');
  });

  test('mapper derives REVIEW_RECOMMENDED from persisted summary', () => {
    const status = deriveLearnerBuildLearningListStatus({
      buildStatus: 'IN_PROGRESS',
      session: {
        id: 's1',
        learningGoal: 'goal',
        confidenceBefore: 2,
        confidenceAfter: null,
        goalOutcome: null,
        finalReflection: null,
        learningSummary: {
          schemaVersion: 1,
          generatedAt: new Date().toISOString(),
          startCheck: {
            total: 1,
            answered: 1,
            correct: 0,
            skipped: 0,
            remaining: 0,
            handled: 1,
          },
          stepChecks: {
            total: 1,
            answered: 1,
            correct: 0,
            skipped: 0,
            remaining: 0,
            handled: 1,
          },
          finalCheck: {
            total: 1,
            answered: 0,
            correct: 0,
            skipped: 0,
            remaining: 1,
            handled: 0,
          },
          understoodConcepts: [],
          reviewConcepts: [
            {
              conceptKey: 'motor',
              labelEn: 'Motor',
              labelAr: 'محرك',
            },
          ],
          uncheckedConceptCount: 0,
          confidenceBefore: 2,
          confidenceAfter: null,
          goalOutcome: null,
        },
      },
      summary: {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        startCheck: {
          total: 1,
          answered: 1,
          correct: 0,
          skipped: 0,
          remaining: 0,
          handled: 1,
        },
        stepChecks: {
          total: 1,
          answered: 1,
          correct: 0,
          skipped: 0,
          remaining: 0,
          handled: 1,
        },
        finalCheck: {
          total: 1,
          answered: 0,
          correct: 0,
          skipped: 0,
          remaining: 1,
          handled: 0,
        },
        understoodConcepts: [],
        reviewConcepts: [
          { conceptKey: 'motor', labelEn: 'Motor', labelAr: 'محرك' },
        ],
        uncheckedConceptCount: 0,
        confidenceBefore: 2,
        confidenceAfter: null,
        goalOutcome: null,
      },
    });
    assert.equal(status, 'REVIEW_RECOMMENDED');
  });

  test('portfolio mapper omits empty learning block', () => {
    const story = mapPortfolioLearningStory({
      session: {
        id: 's1',
        learningGoal: null,
        confidenceBefore: null,
        confidenceAfter: null,
        goalOutcome: null,
        finalReflection: null,
        learningSummary: null,
      },
    });
    assert.equal(story, null);
  });

  test('my builds learning statuses and privacy for list items', async () => {
    const author = await createAuthor();
    const learner = await createLearner('list');
    const other = await createLearner('other');
    const project = await createPublishedProject(author.id);

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    await prepareOwnedMaterials(project.id, learner.id, build.id);

    const callsBefore = providerCallCount;
    const withoutSession = await getLearnerBuildsList({
      learnerId: learner.id,
      status: 'ACTIVE',
      page: 1,
      limit: 20,
    });
    assert.equal(providerCallCount, callsBefore);
    assert.equal(withoutSession.items[0]?.learning.status, 'NOT_AVAILABLE');
    assert.ok(!('questions' in (withoutSession.items[0] as object)));
    assert.ok(!JSON.stringify(withoutSession).includes('correctOptionKey'));

    const setup = await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      learningGoal: null,
      confidenceBefore: null,
    });
    assert.equal(setup.status, 'READY');
    const callsAfterSetup = providerCallCount;

    const notStarted = await getLearnerBuildsList({
      learnerId: learner.id,
      status: 'ACTIVE',
      page: 1,
      limit: 20,
    });
    assert.equal(notStarted.items[0]?.learning.status, 'NOT_STARTED');

    const session = await prisma.projectBuildLearningSession.findUniqueOrThrow({
      where: { buildId: build.id },
      include: {
        assignments: {
          where: { stage: 'START' },
          orderBy: { displayOrder: 'asc' },
          take: 1,
        },
      },
    });
    const assignment = session.assignments[0];
    assert.ok(assignment);

    await skipLearningAssignmentForLearner({
      assignmentId: assignment.id,
      learnerId: learner.id,
      role: 'LEARNER',
    });
    await persistBuildLearningSummary(session.id);

    const inProgress = await getLearnerBuildsList({
      learnerId: learner.id,
      status: 'ACTIVE',
      page: 1,
      limit: 20,
    });
    assert.ok(
      ['IN_PROGRESS', 'REVIEW_RECOMMENDED'].includes(
        inProgress.items[0]?.learning.status ?? '',
      ),
    );
    assert.ok((inProgress.items[0]?.learning.startCheck.handled ?? 0) >= 1);

    const otherList = await getLearnerBuildsList({
      learnerId: other.id,
      status: 'ACTIVE',
      page: 1,
      limit: 20,
    });
    assert.equal(otherList.items.length, 0);
    assert.equal(providerCallCount, callsAfterSetup);
  });

  test('portfolio learning story remains private and attempt-scoped', async () => {
    const author = await createAuthor();
    const learner = await createLearner('portfolio');
    const other = await createLearner('portfolio-other');
    const project = await createPublishedProject(author.id);

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    await prepareOwnedMaterials(project.id, learner.id, build.id);

    const setup = await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      learningGoal: 'Learn LED safety',
      confidenceBefore: 2,
    });
    assert.equal(setup.status, 'READY');

    const projectRow = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      include: { steps: true },
    });
    await completeProjectBuildStepById(
      project.id,
      learner.id,
      projectRow.steps[0]!.id,
    );

    await updateLearningCompletionReflection({
      projectId: project.id,
      learnerId: learner.id,
      goalOutcome: 'ACHIEVED',
      confidenceAfter: 4,
      finalReflection: 'I learned polarity.',
    });

    const callsBefore = providerCallCount;
    const portfolio = await getLearnerPortfolio({
      learnerId: learner.id,
      page: 1,
      limit: 20,
    });
    assert.equal(providerCallCount, callsBefore);
    assert.equal(portfolio.items.length, 1);
    assert.ok(portfolio.items[0]?.learning);
    assert.equal(portfolio.items[0]?.learning?.goal, 'Learn LED safety');
    assert.equal(portfolio.items[0]?.learning?.goalOutcome, 'ACHIEVED');
    assert.equal(portfolio.items[0]?.learning?.confidenceBefore, 2);
    assert.equal(portfolio.items[0]?.learning?.confidenceAfter, 4);
    assert.equal(portfolio.items[0]?.learning?.reflection, 'I learned polarity.');
    assert.ok(!JSON.stringify(portfolio).includes('correctOptionKey'));
    assert.ok(!JSON.stringify(portfolio).includes('isCorrect'));

    const emptyOther = await getLearnerPortfolio({
      learnerId: other.id,
      page: 1,
      limit: 20,
    });
    assert.equal(emptyOther.items.length, 0);

    const emptyLearningBuild = await prisma.projectBuild.create({
      data: {
        projectId: project.id,
        learnerId: learner.id,
        attemptNumber: 2,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.builds.push(emptyLearningBuild.id);

    const multi = await getLearnerPortfolio({
      learnerId: learner.id,
      page: 1,
      limit: 20,
    });
    assert.equal(multi.items.length, 2);
    const withStory = multi.items.find((item) => item.id === build.id);
    const withoutStory = multi.items.find(
      (item) => item.id === emptyLearningBuild.id,
    );
    assert.ok(withStory?.learning);
    assert.equal(withoutStory?.learning, undefined);
  });

  test('admin read-only learning detail without provider calls', async () => {
    const author = await createAuthor();
    const learner = await createLearner('admin');
    await createAdmin();
    const project = await createPublishedProject(author.id);

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build.id);
    await prepareOwnedMaterials(project.id, learner.id, build.id);

    const setup = await setupLearningSessionForBuild({
      buildId: build.id,
      learnerId: learner.id,
      learningGoal: 'Admin inspect goal',
      confidenceBefore: 1,
    });
    assert.equal(setup.status, 'READY');

    const callsBefore = providerCallCount;
    const list = await listAdminLearnerBuildsWithLearning({
      learnerUserId: learner.id,
      page: 1,
      limit: 20,
    });
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0]?.hasLearningSession, true);

    const detail = await getAdminBuildLearningDetail({
      learnerUserId: learner.id,
      buildId: build.id,
    });
    assert.equal(providerCallCount, callsBefore);
    assert.equal(detail.buildId, build.id);
    assert.equal(detail.learningGoal, 'Admin inspect goal');
    assert.equal(detail.confidenceBefore, 1);
    assert.ok(detail.packVersion != null);
    assert.ok(!('providerName' in detail));
    assert.ok(!('correctOptionKey' in detail));

    await assert.rejects(
      () =>
        getAdminBuildLearningDetail({
          learnerUserId: learner.id,
          buildId: 'missing-build',
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'BUILD_NOT_FOUND',
    );
  });

  test('list loading does not query sessions per build after include', async () => {
    const author = await createAuthor();
    const learner = await createLearner('nplusone');
    const project = await createPublishedProject(author.id);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const build = await prisma.projectBuild.create({
        data: {
          projectId: project.id,
          learnerId: learner.id,
          attemptNumber: attempt,
          status: attempt === 3 ? 'IN_PROGRESS' : 'COMPLETED',
          completedAt: attempt === 3 ? null : new Date(),
        },
      });
      ids.builds.push(build.id);
    }

    const originalFindUnique = prisma.projectBuildLearningSession.findUnique;
    let findUniqueCalls = 0;
    prisma.projectBuildLearningSession.findUnique = ((...args: unknown[]) => {
      findUniqueCalls += 1;
      return (originalFindUnique as (...inner: unknown[]) => unknown).apply(
        prisma.projectBuildLearningSession,
        args,
      );
    }) as typeof originalFindUnique;

    try {
      const list = await getLearnerBuildsList({
        learnerId: learner.id,
        page: 1,
        limit: 20,
      });
      assert.equal(list.items.length, 3);
      assert.equal(findUniqueCalls, 0);
      assert.ok(list.items.every((item) => item.learning != null));
    } finally {
      prisma.projectBuildLearningSession.findUnique = originalFindUnique;
    }
  });
});
