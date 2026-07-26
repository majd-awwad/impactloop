import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import {
  getOrBuildMaterialFeaturePool,
  resetMaterialFeaturePoolCacheForTests,
} from '../learner-home/learner-home.material-features.js';
import { getLearnerHome } from '../learner-home/learner-home.service.js';
import type { LearnerHomeMaterialCandidate } from '../learner-home/learner-home.types.js';
import {
  resolveProjectConceptAssignments,
  toProjectTopicConceptIds,
} from '../taxonomy/project-concept-assignment.js';

import * as learningProjectsRepository from './learning-projects.repository.js';
import {
  followLearningProjectById,
  getLearningProjectById,
  getMyLearningProjectSubmissionById,
  getMyLearningProjectSubmissions,
  likeLearningProjectById,
  resubmitMyLearningProjectSubmissionById,
  saveLearningProjectById,
  startProjectBuildById,
  submitLearningProjectForReview,
  unfollowLearningProjectById,
  unlikeLearningProjectById,
  unsaveLearningProjectById,
  updateProjectBuildItemById,
  updateMyLearningProjectSubmissionById,
} from './learning-projects.service.js';
import type { ProjectTopicLifecycleDeps } from '../taxonomy/project-concept-assignment.repository.js';
import {
  createComponentConceptLifecycleDeps,
  defaultComponentConceptAssignmentPersistenceDeps,
  defaultComponentConceptLifecycleDeps,
  type ComponentConceptLifecycleDeps,
} from '../taxonomy/component-concept-assignment.repository.js';

const TEST_MARKER = '[test-learning-projects-mine]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  projects: [] as string[],
};

async function createLearnerUser(label: string) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${label}`,
      email: `${TEST_MARKER}-${label}-${Date.now()}@impactloop.test`,
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

async function createCategory(
  categoryType: 'PROJECT' | 'BOTH',
  topicCanonicalKey?: string,
) {
  const topic = await prisma.taxonomyConcept.findFirst({
    where: {
      conceptType: 'PROJECT_TOPIC',
      status: 'ACTIVE',
      ...(topicCanonicalKey ? { canonicalKey: topicCanonicalKey } : {}),
    },
    select: { id: true, canonicalKey: true },
    orderBy: { canonicalKey: 'asc' },
  });
  assert.ok(topic, 'Expected an ACTIVE PROJECT_TOPIC concept in the database');

  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} ${categoryType} ${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      nameAr: `${TEST_MARKER} فئة`,
      categoryType,
      isActive: true,
      projectTopicConceptId: topic.id,
    },
  });
  ids.categories.push(category.id);
  return { ...category, topicConceptId: topic.id, topicCanonicalKey: topic.canonicalKey };
}

async function createProject(input: {
  createdBy: string;
  categoryId: string;
  status?: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'CHANGES_REQUESTED' | 'REJECTED';
  title?: string;
}) {
  const status = input.status ?? 'CHANGES_REQUESTED';
  const project = await prisma.learningProject.create({
    data: {
      createdBy: input.createdBy,
      categoryId: input.categoryId,
      title: input.title ?? `${TEST_MARKER} Submission`,
      shortDescription: `${TEST_MARKER} short description for learner submission.`,
      description: `${TEST_MARKER} full description for learner submission lifecycle.`,
      difficulty: 'BEGINNER',
      estimatedDurationMinutes: 90,
      status,
      submittedAt:
        status === 'DRAFT' ? null : new Date(Date.now() - 60_000),
      reviewedAt: status === 'DRAFT' ? null : new Date(),
      reviewNote: status === 'DRAFT' ? null : 'Please clarify the components.',
      changesRequestedReason:
        status === 'DRAFT' ? null : 'Please clarify the components.',
      rejectionReason:
        status === 'REJECTED' ? 'Not suitable for the hub.' : null,
    },
  });
  ids.projects.push(project.id);
  return project;
}

async function createComponent(input: {
  projectId: string;
  categoryId: string;
  name?: string;
}) {
  return prisma.projectRequiredComponent.create({
    data: {
      projectId: input.projectId,
      categoryId: input.categoryId,
      componentName: input.name ?? 'Arduino Uno',
      materialType: 'Microcontroller',
      quantity: 1,
      unit: 'piece',
      componentRole: 'REQUIRED_MATERIAL',
      isRequired: true,
      canBeSubstituted: true,
      searchKeywords: ['arduino', 'controller'],
      alternativeKeywords: ['compatible board'],
      providedByUser: true,
      confirmedByUser: true,
      reviewStatus: 'ACCEPTED',
      notes: 'Original note',
    },
  });
}

before(async () => {
  await prisma.$connect();
});

after(async () => {
  const projectIds = ids.projects.filter((id): id is string => Boolean(id));
  if (projectIds.length > 0) {
    await prisma.learningProject.deleteMany({
      where: { id: { in: projectIds } },
    });
  }

  if (ids.users.length > 0) {
    await prisma.idempotencyRecord.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }

  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }

  await prisma.$disconnect();
});

describe('learner learning project submissions', () => {
  test('project interactions invalidate only the acting learner home cache', async () => {
    const owner = await createLearnerUser('interaction-owner');
    const learnerA = await createLearnerUser('interaction-a');
    const learnerB = await createLearnerUser('interaction-b');
    const projectCategory = await createCategory('PROJECT');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'PUBLISHED',
      title: `${TEST_MARKER} interaction project`,
    });
    let learnerAHome = await getLearnerHome(learnerA.id);
    const learnerBHome = await getLearnerHome(learnerB.id);
    const featureCandidate: LearnerHomeMaterialCandidate = {
      id: 'project-interaction-feature',
      ownerId: owner.id,
      title: 'Arduino feature fixture',
      description: 'Shared material feature cache fixture',
      materialType: 'Electronics component',
      categoryId: projectCategory.id,
      categoryNameEn: 'Robotics',
      categoryNameAr: 'Robotics',
      status: 'AVAILABLE',
      isFree: true,
      deliveryAllowed: false,
      pickupAllowed: true,
      viewsCount: 0,
      likesCount: 0,
      city: 'Nablus',
      area: null,
      tags: ['arduino'],
      createdAt: new Date(),
      availableQuantity: 1,
      mapped: {},
    };
    resetMaterialFeaturePoolCacheForTests();
    const sharedFeaturesBefore = getOrBuildMaterialFeaturePool([
      featureCandidate,
    ]);

    await saveLearningProjectById(project.id, learnerA.id);
    const sharedFeaturesAfter = getOrBuildMaterialFeaturePool([
      featureCandidate,
    ]);
    let refreshedLearnerAHome = await getLearnerHome(learnerA.id);
    assert.notStrictEqual(refreshedLearnerAHome, learnerAHome);
    assert.strictEqual(await getLearnerHome(learnerB.id), learnerBHome);
    assert.strictEqual(sharedFeaturesAfter.features, sharedFeaturesBefore.features);

    learnerAHome = refreshedLearnerAHome;
    await unsaveLearningProjectById(project.id, learnerA.id);
    refreshedLearnerAHome = await getLearnerHome(learnerA.id);
    assert.notStrictEqual(refreshedLearnerAHome, learnerAHome);

    learnerAHome = refreshedLearnerAHome;
    await likeLearningProjectById(project.id, learnerA.id);
    refreshedLearnerAHome = await getLearnerHome(learnerA.id);
    assert.notStrictEqual(refreshedLearnerAHome, learnerAHome);

    learnerAHome = refreshedLearnerAHome;
    await unlikeLearningProjectById(project.id, learnerA.id);
    refreshedLearnerAHome = await getLearnerHome(learnerA.id);
    assert.notStrictEqual(refreshedLearnerAHome, learnerAHome);

    learnerAHome = refreshedLearnerAHome;
    await followLearningProjectById(project.id, learnerA.id);
    refreshedLearnerAHome = await getLearnerHome(learnerA.id);
    assert.notStrictEqual(refreshedLearnerAHome, learnerAHome);

    learnerAHome = refreshedLearnerAHome;
    await unfollowLearningProjectById(project.id, learnerA.id);
    refreshedLearnerAHome = await getLearnerHome(learnerA.id);
    assert.notStrictEqual(refreshedLearnerAHome, learnerAHome);

    const missingProjectId = `${TEST_MARKER}-missing-interaction-${Date.now()}`;
    for (const operation of [
      () => saveLearningProjectById(missingProjectId, learnerA.id),
      () => unsaveLearningProjectById(missingProjectId, learnerA.id),
      () => likeLearningProjectById(missingProjectId, learnerA.id),
      () => unlikeLearningProjectById(missingProjectId, learnerA.id),
      () => followLearningProjectById(missingProjectId, learnerA.id),
      () => unfollowLearningProjectById(missingProjectId, learnerA.id),
    ]) {
      await assert.rejects(operation);
    }

    assert.strictEqual(await getLearnerHome(learnerA.id), refreshedLearnerAHome);
    assert.strictEqual(await getLearnerHome(learnerB.id), learnerBHome);
    resetMaterialFeaturePoolCacheForTests();
  });

  test('project build start and status changes invalidate only the build owner cache', async () => {
    const owner = await createLearnerUser('build-cache-owner');
    const learnerA = await createLearnerUser('build-cache-a');
    const learnerB = await createLearnerUser('build-cache-b');
    const projectCategory = await createCategory('PROJECT');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'PUBLISHED',
      title: `${TEST_MARKER} build cache project`,
    });
    await createComponent({
      projectId: project.id,
      categoryId: projectCategory.id,
    });

    let learnerAHome = await getLearnerHome(learnerA.id);
    const learnerBHome = await getLearnerHome(learnerB.id);

    const build = await startProjectBuildById(project.id, learnerA.id);
    let refreshedLearnerAHome = await getLearnerHome(learnerA.id);
    assert.notStrictEqual(refreshedLearnerAHome, learnerAHome);
    assert.strictEqual(await getLearnerHome(learnerB.id), learnerBHome);

    learnerAHome = refreshedLearnerAHome;
    const item = build.items[0];
    assert.ok(item);
    await updateProjectBuildItemById(project.id, learnerA.id, item.id, {
      status: 'ALREADY_OWNED',
      learnerNote: null,
    });
    refreshedLearnerAHome = await getLearnerHome(learnerA.id);
    assert.notStrictEqual(refreshedLearnerAHome, learnerAHome);
    assert.strictEqual(await getLearnerHome(learnerB.id), learnerBHome);

    learnerAHome = refreshedLearnerAHome;
    await updateProjectBuildItemById(project.id, learnerA.id, item.id, {
      status: 'ALREADY_OWNED',
      learnerNote: 'This note does not affect learner home.',
    });
    assert.strictEqual(await getLearnerHome(learnerA.id), learnerAHome);

    await assert.rejects(() =>
      updateProjectBuildItemById(project.id, learnerB.id, item.id, {
        status: 'MISSING',
        learnerNote: null,
      }),
    );
    assert.strictEqual(await getLearnerHome(learnerA.id), learnerAHome);
    assert.strictEqual(await getLearnerHome(learnerB.id), learnerBHome);
  });

  test('lists only the current learner submissions', async () => {
    const owner = await createLearnerUser('owner-list');
    const other = await createLearnerUser('other-list');
    const projectCategory = await createCategory('PROJECT');

    const ownProject = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      title: `${TEST_MARKER} own project`,
    });
    await createProject({
      createdBy: other.id,
      categoryId: projectCategory.id,
      title: `${TEST_MARKER} other project`,
    });

    const result = await getMyLearningProjectSubmissions(
      { page: 1, limit: 20 },
      owner.id,
    );

    assert.ok(result.items.some((item) => item.id === ownProject.id));
    assert.ok(result.items.every((item) => item.id !== ids.projects.at(-1)));
  });

  test('returns own changes-requested detail and blocks another learner', async () => {
    const owner = await createLearnerUser('owner-detail');
    const other = await createLearnerUser('other-detail');
    const projectCategory = await createCategory('PROJECT');
    const materialCategory = await createCategory('BOTH');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
    });
    await createComponent({ projectId: project.id, categoryId: materialCategory.id });

    const detail = await getMyLearningProjectSubmissionById(project.id, owner.id);

    assert.equal(detail.status, 'CHANGES_REQUESTED');
    assert.equal(detail.changesRequestedReason, 'Please clarify the components.');
    assert.equal(detail.availableActions.canEdit, true);
    assert.equal(detail.availableActions.canResubmit, true);
    assert.equal(detail.requiredComponents.length, 1);

    await assert.rejects(
      () => getMyLearningProjectSubmissionById(project.id, other.id),
      (error) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('updates changes-requested submissions and preserves component enrichment', async () => {
    const owner = await createLearnerUser('owner-update');
    const projectCategory = await createCategory('PROJECT');
    const materialCategory = await createCategory('BOTH');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
    });
    const component = await createComponent({
      projectId: project.id,
      categoryId: materialCategory.id,
    });

    const updated = await updateMyLearningProjectSubmissionById(
      project.id,
      owner.id,
      {
        title: `${TEST_MARKER} Updated title`,
        shortDescription: `${TEST_MARKER} updated short description.`,
        description: `${TEST_MARKER} updated full description.`,
        categoryId: projectCategory.id,
        difficulty: 'INTERMEDIATE',
        estimatedDurationMinutes: 120,
        requiredComponents: [
          {
            id: component.id,
            name: 'Arduino Nano',
            quantity: 2,
            unit: 'pieces',
            componentRole: 'REQUIRED_MATERIAL',
            materialType: 'Microcontroller',
            categoryId: materialCategory.id,
            searchKeywords: ['arduino', 'nano'],
            canBeSubstituted: true,
            notes: 'Updated learner note',
          },
        ],
        steps: [
          {
            title: 'Wire the board',
            description: 'Connect the jumper wires carefully.',
          },
        ],
        links: [{ url: 'https://example.com/guide', title: 'Guide' }],
      },
    );

    assert.equal(updated.title, `${TEST_MARKER} Updated title`);
    assert.equal(updated.requiredComponents[0]?.id, component.id);
    assert.equal(updated.requiredComponents[0]?.componentName, 'Arduino Nano');

    const stored = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: component.id },
    });
    assert.deepEqual(stored.alternativeKeywords, ['compatible board']);
    assert.equal(stored.reviewStatus, 'PENDING_REVIEW');
  });

  test('allows edit for pending review and keeps status', async () => {
    const owner = await createLearnerUser('owner-pending-edit');
    const projectCategory = await createCategory('PROJECT');
    const materialCategory = await createCategory('BOTH');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'PENDING_REVIEW',
      title: `${TEST_MARKER} pending editable`,
    });
    await createComponent({
      projectId: project.id,
      categoryId: materialCategory.id,
    });

    const updated = await updateMyLearningProjectSubmissionById(
      project.id,
      owner.id,
      {
        title: `${TEST_MARKER} Pending updated title`,
        shortDescription: `${TEST_MARKER} pending updated short description.`,
        description: `${TEST_MARKER} pending updated full description.`,
        categoryId: projectCategory.id,
        difficulty: 'BEGINNER',
      },
    );

    assert.equal(updated.status, 'PENDING_REVIEW');
    assert.equal(updated.title, `${TEST_MARKER} Pending updated title`);
    assert.equal(updated.availableActions.canEdit, true);
    assert.equal(updated.availableActions.canResubmit, false);
  });

  test('rejects edit for published submissions', async () => {
    const owner = await createLearnerUser('owner-published');
    const projectCategory = await createCategory('PROJECT');
    const published = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'PUBLISHED',
    });

    const payload = {
      title: `${TEST_MARKER} cannot edit`,
      shortDescription: `${TEST_MARKER} short description cannot edit.`,
      description: `${TEST_MARKER} full description cannot edit.`,
      categoryId: projectCategory.id,
      difficulty: 'BEGINNER' as const,
    };

    await assert.rejects(
      () => updateMyLearningProjectSubmissionById(published.id, owner.id, payload),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'PROJECT_NOT_EDITABLE',
    );
  });

  test('resubmits changes-requested and keeps unpublished projects private', async () => {
    const owner = await createLearnerUser('owner-resubmit');
    const projectCategory = await createCategory('PROJECT');
    const materialCategory = await createCategory('BOTH');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
    });
    await createComponent({ projectId: project.id, categoryId: materialCategory.id });

    await assert.rejects(
      () => getLearningProjectById(project.id),
      (error) => error instanceof AppError && error.statusCode === 404,
    );

    const resubmitted = await resubmitMyLearningProjectSubmissionById(
      project.id,
      owner.id,
    );

    assert.equal(resubmitted.status, 'PENDING_REVIEW');
    assert.equal(resubmitted.reviewNote, null);
    assert.equal(resubmitted.changesRequestedReason, null);
    assert.equal(resubmitted.rejectionReason, null);
    assert.equal(resubmitted.reviewedAt, null);

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
    });
    assert.equal(stored.status, 'PENDING_REVIEW');
    assert.equal(stored.reviewedBy, null);
    assert.equal(stored.reviewedAt, null);
    assert.ok(stored.submittedAt);
  });

  test('editable learner project can change categoryId', async () => {
    const owner = await createLearnerUser('owner-category-change');
    const originalCategory = await createCategory('PROJECT');
    const nextCategory = await createCategory('PROJECT');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: originalCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} category change`,
    });

    const updated = await updateMyLearningProjectSubmissionById(
      project.id,
      owner.id,
      {
        title: `${TEST_MARKER} category change`,
        shortDescription: `${TEST_MARKER} category change short description.`,
        description: `${TEST_MARKER} category change full description.`,
        categoryId: nextCategory.id,
        difficulty: 'BEGINNER',
      },
    );

    assert.equal(updated.category?.id, nextCategory.id);

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
    });
    assert.equal(stored.categoryId, nextCategory.id);
  });

  test('category and another editable field change together', async () => {
    const owner = await createLearnerUser('owner-category-and-title');
    const originalCategory = await createCategory('PROJECT');
    const nextCategory = await createCategory('PROJECT');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: originalCategory.id,
      status: 'DRAFT',
      title: `${TEST_MARKER} before category title`,
    });

    const updated = await updateMyLearningProjectSubmissionById(
      project.id,
      owner.id,
      {
        title: `${TEST_MARKER} after category title`,
        shortDescription: `${TEST_MARKER} updated short description.`,
        description: `${TEST_MARKER} updated full description.`,
        categoryId: nextCategory.id,
        difficulty: 'ADVANCED',
      },
    );

    assert.equal(updated.category?.id, nextCategory.id);
    assert.equal(updated.title, `${TEST_MARKER} after category title`);
    assert.equal(updated.difficulty, 'ADVANCED');
  });

  test('invalid project category rejects edit before persistence', async () => {
    const owner = await createLearnerUser('owner-invalid-category');
    const projectCategory = await createCategory('PROJECT');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      title: `${TEST_MARKER} invalid category guard`,
    });

    await assert.rejects(
      () =>
        updateMyLearningProjectSubmissionById(project.id, owner.id, {
          title: `${TEST_MARKER} should not persist`,
          shortDescription: `${TEST_MARKER} should not persist short.`,
          description: `${TEST_MARKER} should not persist full.`,
          categoryId: 'missing-project-category-id',
          difficulty: 'BEGINNER',
        }),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.code === 'INVALID_CATEGORY',
    );

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
    });
    assert.equal(stored.title, `${TEST_MARKER} invalid category guard`);
    assert.equal(stored.categoryId, projectCategory.id);
  });

  test('another learner cannot update a submission', async () => {
    const owner = await createLearnerUser('owner-update-guard');
    const other = await createLearnerUser('other-update-guard');
    const projectCategory = await createCategory('PROJECT');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      title: `${TEST_MARKER} owner only update`,
    });

    await assert.rejects(
      () =>
        updateMyLearningProjectSubmissionById(project.id, other.id, {
          title: `${TEST_MARKER} stolen update`,
          shortDescription: `${TEST_MARKER} stolen short.`,
          description: `${TEST_MARKER} stolen full.`,
          categoryId: projectCategory.id,
          difficulty: 'BEGINNER',
        }),
      (error) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('concurrent status change prevents stale learner edit', async () => {
    const owner = await createLearnerUser('owner-concurrent-edit');
    const projectCategory = await createCategory('PROJECT');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} concurrent edit`,
    });

    await prisma.learningProject.update({
      where: { id: project.id },
      data: { status: 'PUBLISHED' },
    });

    await assert.rejects(
      () =>
        updateMyLearningProjectSubmissionById(project.id, owner.id, {
          title: `${TEST_MARKER} stale edit`,
          shortDescription: `${TEST_MARKER} stale short.`,
          description: `${TEST_MARKER} stale full.`,
          categoryId: projectCategory.id,
          difficulty: 'BEGINNER',
        }),
      (error) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'PROJECT_NOT_EDITABLE',
    );

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
    });
    assert.equal(stored.title, `${TEST_MARKER} concurrent edit`);
    assert.equal(stored.status, 'PUBLISHED');
  });

  test('changes-requested save preserves moderation metadata and status', async () => {
    const owner = await createLearnerUser('owner-changes-requested-save');
    const projectCategory = await createCategory('PROJECT');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} moderation preserved`,
    });

    const updated = await updateMyLearningProjectSubmissionById(
      project.id,
      owner.id,
      {
        title: `${TEST_MARKER} moderation preserved updated`,
        shortDescription: `${TEST_MARKER} moderation preserved short.`,
        description: `${TEST_MARKER} moderation preserved full.`,
        categoryId: projectCategory.id,
        difficulty: 'INTERMEDIATE',
      },
    );

    assert.equal(updated.status, 'CHANGES_REQUESTED');
    assert.equal(updated.changesRequestedReason, 'Please clarify the components.');
    assert.equal(updated.reviewNote, 'Please clarify the components.');
    assert.ok(updated.reviewedAt);
    assert.equal(updated.availableActions.canResubmit, true);
  });

  test('editing without changing category still works', async () => {
    const owner = await createLearnerUser('owner-same-category');
    const projectCategory = await createCategory('PROJECT');
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'PENDING_REVIEW',
      title: `${TEST_MARKER} same category`,
    });

    const updated = await updateMyLearningProjectSubmissionById(
      project.id,
      owner.id,
      {
        title: `${TEST_MARKER} same category updated`,
        shortDescription: `${TEST_MARKER} same category short.`,
        description: `${TEST_MARKER} same category full.`,
        categoryId: projectCategory.id,
        difficulty: 'BEGINNER',
      },
    );

    assert.equal(updated.category?.id, projectCategory.id);
    assert.equal(updated.status, 'PENDING_REVIEW');
    assert.equal(updated.reviewNote, null);
    assert.equal(updated.changesRequestedReason, null);
    assert.equal(updated.rejectionReason, null);
  });
});

describe('project topic assignment engine', () => {
  test('READY ownership yields exactly one project-topic assignment', () => {
    const result = resolveProjectConceptAssignments({
      category: {
        id: 'cat-1',
        categoryType: 'PROJECT',
        isActive: true,
        projectTopicConceptId: 'concept-1',
        projectTopicConcept: {
          id: 'concept-1',
          canonicalKey: 'project-topic:robotics',
          conceptType: 'PROJECT_TOPIC',
          status: 'ACTIVE',
        },
      },
    });

    assert.equal(result.status, 'READY');
    assert.deepEqual(toProjectTopicConceptIds(result), ['concept-1']);
    assert.equal(result.assignments[0]?.canonicalKey, 'project-topic:robotics');
  });

  test('missing ownership blocks assignment', () => {
    const result = resolveProjectConceptAssignments({
      category: {
        id: 'cat-1',
        categoryType: 'PROJECT',
        isActive: true,
        projectTopicConceptId: null,
        projectTopicConcept: null,
      },
    });
    assert.equal(result.status, 'BLOCKED_INVALID_CATEGORY_OWNERSHIP');
    assert.equal(result.unmatched[0]?.reason, 'CATEGORY_OWNERSHIP_MISSING');
  });

  test('MATERIAL category type blocks assignment', () => {
    const result = resolveProjectConceptAssignments({
      category: {
        id: 'cat-1',
        categoryType: 'MATERIAL',
        isActive: true,
        projectTopicConceptId: 'concept-1',
        projectTopicConcept: {
          id: 'concept-1',
          canonicalKey: 'project-topic:robotics',
          conceptType: 'PROJECT_TOPIC',
          status: 'ACTIVE',
        },
      },
    });
    assert.equal(result.status, 'BLOCKED_INVALID_CATEGORY_OWNERSHIP');
    assert.ok(
      result.unmatched.some((item) => item.reason === 'CATEGORY_TYPE_MISMATCH'),
    );
  });

  test('inactive concept blocks assignment', () => {
    const result = resolveProjectConceptAssignments({
      category: {
        id: 'cat-1',
        categoryType: 'PROJECT',
        isActive: true,
        projectTopicConceptId: 'concept-1',
        projectTopicConcept: {
          id: 'concept-1',
          canonicalKey: 'project-topic:robotics',
          conceptType: 'PROJECT_TOPIC',
          status: 'INACTIVE',
        },
      },
    });
    assert.equal(result.status, 'BLOCKED_INVALID_CATEGORY_OWNERSHIP');
    assert.ok(result.unmatched.some((item) => item.reason === 'INACTIVE_TARGET'));
  });

  test('wrong concept type blocks assignment', () => {
    const result = resolveProjectConceptAssignments({
      category: {
        id: 'cat-1',
        categoryType: 'PROJECT',
        isActive: true,
        projectTopicConceptId: 'concept-1',
        projectTopicConcept: {
          id: 'concept-1',
          canonicalKey: 'interest:robotics',
          conceptType: 'INTEREST',
          status: 'ACTIVE',
        },
      },
    });
    assert.equal(result.status, 'BLOCKED_INVALID_CATEGORY_OWNERSHIP');
    assert.ok(
      result.unmatched.some((item) => item.reason === 'WRONG_CONCEPT_TYPE'),
    );
  });

  test('malformed canonical key blocks assignment', () => {
    const result = resolveProjectConceptAssignments({
      category: {
        id: 'cat-1',
        categoryType: 'PROJECT',
        isActive: true,
        projectTopicConceptId: 'concept-1',
        projectTopicConcept: {
          id: 'concept-1',
          canonicalKey: 'not-a-valid-key',
          conceptType: 'PROJECT_TOPIC',
          status: 'ACTIVE',
        },
      },
    });
    assert.equal(result.status, 'BLOCKED_INVALID_CATEGORY_OWNERSHIP');
    assert.ok(
      result.unmatched.some(
        (item) => item.reason === 'CATEGORY_OWNERSHIP_INVALID_TARGET',
      ),
    );
  });
});

describe('project topic lifecycle', () => {
  test('submit creates exactly the owned canonical topic', async () => {
    const owner = await createLearnerUser('topic-submit');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );

    const { response } = await submitLearningProjectForReview(
      owner.id,
      {
        title: `${TEST_MARKER} topic submit`,
        shortDescription: `${TEST_MARKER} topic submit short description.`,
        description: `${TEST_MARKER} topic submit full description.`,
        categoryId: projectCategory.id,
        difficulty: 'BEGINNER',
      },
      `idem-topic-submit-${Date.now()}`,
    );
    ids.projects.push(response.id);

    const concepts = await prisma.learningProjectConcept.findMany({
      where: { projectId: response.id },
      include: { concept: { select: { canonicalKey: true, conceptType: true } } },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.conceptId, projectCategory.topicConceptId);
    assert.equal(concepts[0]?.concept.conceptType, 'PROJECT_TOPIC');
    assert.equal(concepts[0]?.concept.canonicalKey, 'project-topic:robotics');
  });

  test('semantic category change replaces stale topic', async () => {
    const owner = await createLearnerUser('topic-category-change');
    const originalCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );
    const nextCategory = await createCategory(
      'PROJECT',
      'project-topic:electronics',
    );
    assert.notEqual(
      originalCategory.topicConceptId,
      nextCategory.topicConceptId,
    );

    const project = await createProject({
      createdBy: owner.id,
      categoryId: originalCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} topic replace`,
    });
    await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: originalCategory.topicConceptId,
      },
    });

    await updateMyLearningProjectSubmissionById(project.id, owner.id, {
      title: `${TEST_MARKER} topic replace`,
      shortDescription: `${TEST_MARKER} topic replace short.`,
      description: `${TEST_MARKER} topic replace full.`,
      categoryId: nextCategory.id,
      difficulty: 'BEGINNER',
    });

    const concepts = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
      select: { conceptId: true },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.conceptId, nextCategory.topicConceptId);
  });

  test('same-category non-semantic update preserves join row identity', async () => {
    const owner = await createLearnerUser('topic-preserve-row');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'PENDING_REVIEW',
      title: `${TEST_MARKER} topic preserve`,
    });
    const existing = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: projectCategory.topicConceptId,
      },
    });

    await updateMyLearningProjectSubmissionById(project.id, owner.id, {
      title: `${TEST_MARKER} topic preserve updated`,
      shortDescription: `${TEST_MARKER} topic preserve short.`,
      description: `${TEST_MARKER} topic preserve full.`,
      categoryId: projectCategory.id,
      difficulty: 'BEGINNER',
    });

    const concepts = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.id, existing.id);
    assert.equal(concepts[0]?.conceptId, projectCategory.topicConceptId);
  });

  test('legacy editable row missing topics self-heals on update', async () => {
    const owner = await createLearnerUser('topic-self-heal');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:woodworking',
    );
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} topic self heal`,
    });

    assert.equal(
      await prisma.learningProjectConcept.count({
        where: { projectId: project.id },
      }),
      0,
    );

    await updateMyLearningProjectSubmissionById(project.id, owner.id, {
      title: `${TEST_MARKER} topic self heal`,
      shortDescription: `${TEST_MARKER} topic self heal short.`,
      description: `${TEST_MARKER} topic self heal full.`,
      categoryId: projectCategory.id,
      difficulty: 'BEGINNER',
    });

    const concepts = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
      select: { conceptId: true },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.conceptId, projectCategory.topicConceptId);
  });

  test('unowned category rejects update', async () => {
    const owner = await createLearnerUser('topic-unowned');
    const owned = await createCategory('PROJECT', 'project-topic:robotics');
    const unowned = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} unowned ${Date.now()}`,
        nameAr: `${TEST_MARKER} unowned`,
        categoryType: 'PROJECT',
        isActive: true,
        projectTopicConceptId: null,
      },
    });
    ids.categories.push(unowned.id);

    const project = await createProject({
      createdBy: owner.id,
      categoryId: owned.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} topic unowned`,
    });

    await assert.rejects(
      () =>
        updateMyLearningProjectSubmissionById(project.id, owner.id, {
          title: `${TEST_MARKER} topic unowned`,
          shortDescription: `${TEST_MARKER} topic unowned short.`,
          description: `${TEST_MARKER} topic unowned full.`,
          categoryId: unowned.id,
          difficulty: 'BEGINNER',
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'CATEGORY_TAXONOMY_NOT_READY',
    );

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      select: { categoryId: true },
    });
    assert.equal(stored.categoryId, owned.id);
  });

  test('create rolls back Project when topic persistence fails after entity write', async () => {
    const owner = await createLearnerUser('topic-create-rollback');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );
    const title = `${TEST_MARKER} create rollback ${Date.now()}`;

    const failingDeps: ProjectTopicLifecycleDeps = {
      reconcileLearningProjectTopics: async (client, projectId) => {
        const row = await client.learningProject.findUnique({
          where: { id: projectId },
          select: { id: true, title: true },
        });
        assert.ok(row);
        assert.equal(row.title, title);
        throw new Error('forced topic persistence failure after entity write');
      },
    };

    await assert.rejects(
      () =>
        prisma.$transaction((tx) =>
          learningProjectsRepository.createLearningProjectForReview({
            createdBy: owner.id,
            categoryId: projectCategory.id,
            title,
            shortDescription: `${TEST_MARKER} create rollback short.`,
            description: `${TEST_MARKER} create rollback full.`,
            difficulty: 'BEGINNER',
            steps: [{ title: 'Step 1', description: 'Do the thing' }],
            client: tx,
            topicLifecycleDeps: failingDeps,
          }),
        ),
      (error: unknown) =>
        error instanceof Error
        && error.message === 'forced topic persistence failure after entity write',
    );

    assert.equal(await prisma.learningProject.count({ where: { title } }), 0);
    assert.equal(
      await prisma.projectStep.count({
        where: { project: { title } },
      }),
      0,
    );
    assert.equal(
      await prisma.learningProjectConcept.count({
        where: { project: { title } },
      }),
      0,
    );
  });

  test('update rolls back Project fields when topic persistence fails after entity write', async () => {
    const owner = await createLearnerUser('topic-update-rollback');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );
    const nextCategory = await createCategory(
      'PROJECT',
      'project-topic:electronics',
    );
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} update rollback original`,
    });
    const existingConcept = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: projectCategory.topicConceptId,
      },
    });

    const failingDeps: ProjectTopicLifecycleDeps = {
      reconcileLearningProjectTopics: async (client, projectId, categoryId) => {
        const row = await client.learningProject.findUnique({
          where: { id: projectId },
          select: { title: true, categoryId: true },
        });
        assert.ok(row);
        assert.equal(row.categoryId, categoryId);
        assert.equal(row.title, `${TEST_MARKER} update rollback mutated`);
        throw new Error('forced topic persistence failure after entity write');
      },
    };

    await assert.rejects(
      () =>
        learningProjectsRepository.updateMyLearningProjectSubmission({
          id: project.id,
          userId: owner.id,
          categoryId: nextCategory.id,
          title: `${TEST_MARKER} update rollback mutated`,
          shortDescription: `${TEST_MARKER} update rollback short.`,
          description: `${TEST_MARKER} update rollback full.`,
          difficulty: 'BEGINNER',
          topicLifecycleDeps: failingDeps,
        }),
      (error: unknown) =>
        error instanceof Error
        && error.message === 'forced topic persistence failure after entity write',
    );

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      select: { title: true, categoryId: true },
    });
    assert.equal(stored.title, `${TEST_MARKER} update rollback original`);
    assert.equal(stored.categoryId, projectCategory.id);

    const concepts = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.id, existingConcept.id);
    assert.equal(concepts[0]?.conceptId, projectCategory.topicConceptId);
  });
});

describe('required component concept lifecycle', () => {
  test('submit create maps reviewed component evidence to one assignment', async () => {
    const owner = await createLearnerUser('component-submit');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );

    const { response } = await submitLearningProjectForReview(
      owner.id,
      {
        title: `${TEST_MARKER} component submit`,
        shortDescription: `${TEST_MARKER} component submit short description.`,
        description: `${TEST_MARKER} component submit full description.`,
        categoryId: projectCategory.id,
        difficulty: 'BEGINNER',
        requiredComponents: [
          {
            name: 'Breadboard',
            materialType: 'Breadboard',
            quantity: 1,
            unit: 'piece',
          },
        ],
      },
      `idem-component-submit-${Date.now()}`,
    );
    ids.projects.push(response.id);

    const components = await prisma.projectRequiredComponent.findMany({
      where: { projectId: response.id },
      select: { id: true },
    });
    assert.equal(components.length, 1);

    const joins = await prisma.projectComponentConcept.findMany({
      where: { componentId: components[0]!.id },
      include: { concept: { select: { canonicalKey: true, conceptType: true } } },
    });
    assert.equal(joins.length, 1);
    assert.equal(joins[0]?.concept.conceptType, 'COMPONENT');
    assert.equal(joins[0]?.concept.canonicalKey, 'component:breadboard');

    const topics = await prisma.learningProjectConcept.findMany({
      where: { projectId: response.id },
    });
    assert.equal(topics.length, 1);
    assert.equal(topics[0]?.conceptId, projectCategory.topicConceptId);
  });

  test('semantic update replaces assignment; non-semantic preserves join row id', async () => {
    const owner = await createLearnerUser('component-semantic');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:electronics',
    );
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} component semantic`,
    });
    const topicJoin = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: projectCategory.topicConceptId,
      },
    });
    const breadboard = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:breadboard', status: 'ACTIVE' },
      select: { id: true },
    });
    const component = await prisma.projectRequiredComponent.create({
      data: {
        projectId: project.id,
        componentName: 'Breadboard',
        materialType: 'Breadboard',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        providedByUser: true,
        reviewStatus: 'PENDING_REVIEW',
      },
    });
    const existingJoin = await prisma.projectComponentConcept.create({
      data: {
        componentId: component.id,
        conceptId: breadboard.id,
      },
    });

    await updateMyLearningProjectSubmissionById(project.id, owner.id, {
      title: `${TEST_MARKER} component semantic`,
      shortDescription: `${TEST_MARKER} component semantic short.`,
      description: `${TEST_MARKER} component semantic full.`,
      categoryId: projectCategory.id,
      difficulty: 'BEGINNER',
      requiredComponents: [
        {
          id: component.id,
          name: 'Breadboard',
          materialType: 'Breadboard',
          quantity: 3,
          unit: 'piece',
          notes: 'quantity-only change',
        },
      ],
    });

    const afterNonSemantic = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
    });
    assert.equal(afterNonSemantic.length, 1);
    assert.equal(afterNonSemantic[0]?.id, existingJoin.id);

    await updateMyLearningProjectSubmissionById(project.id, owner.id, {
      title: `${TEST_MARKER} component semantic`,
      shortDescription: `${TEST_MARKER} component semantic short.`,
      description: `${TEST_MARKER} component semantic full.`,
      categoryId: projectCategory.id,
      difficulty: 'BEGINNER',
      requiredComponents: [
        {
          id: component.id,
          name: 'Arduino board',
          materialType: 'Arduino Uno',
          quantity: 3,
          unit: 'piece',
        },
      ],
    });

    const afterSemantic = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
      include: { concept: { select: { canonicalKey: true } } },
    });
    assert.equal(afterSemantic.length, 1);
    assert.equal(afterSemantic[0]?.concept.canonicalKey, 'component:arduino-board');
    assert.notEqual(afterSemantic[0]?.id, existingJoin.id);

    const topics = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(topics.length, 1);
    assert.equal(topics[0]?.id, topicJoin.id);
    assert.equal(topics[0]?.conceptId, projectCategory.topicConceptId);
  });

  test('replacement and deletion cascade; sibling and other project intact', async () => {
    const owner = await createLearnerUser('component-replace');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );
    const otherCategory = await createCategory(
      'PROJECT',
      'project-topic:woodworking',
    );
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} component replace`,
    });
    const otherProject = await createProject({
      createdBy: owner.id,
      categoryId: otherCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} component other project`,
    });

    const keep = await prisma.projectRequiredComponent.create({
      data: {
        projectId: project.id,
        componentName: 'Breadboard',
        materialType: 'Breadboard',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        providedByUser: true,
        reviewStatus: 'PENDING_REVIEW',
      },
    });
    const remove = await prisma.projectRequiredComponent.create({
      data: {
        projectId: project.id,
        componentName: 'LED',
        materialType: 'LED Pack',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        providedByUser: true,
        reviewStatus: 'PENDING_REVIEW',
      },
    });
    const otherComponent = await prisma.projectRequiredComponent.create({
      data: {
        projectId: otherProject.id,
        componentName: 'Wood glue',
        materialType: 'Wood Glue',
        quantity: 1,
        unit: 'bottle',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        providedByUser: true,
        reviewStatus: 'PENDING_REVIEW',
      },
    });

    const breadboard = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:breadboard' },
      select: { id: true },
    });
    const led = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:led' },
      select: { id: true },
    });
    const woodGlue = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:wood-glue' },
      select: { id: true },
    });

    await prisma.projectComponentConcept.createMany({
      data: [
        { componentId: keep.id, conceptId: breadboard.id },
        { componentId: remove.id, conceptId: led.id },
        { componentId: otherComponent.id, conceptId: woodGlue.id },
      ],
    });

    await updateMyLearningProjectSubmissionById(project.id, owner.id, {
      title: `${TEST_MARKER} component replace`,
      shortDescription: `${TEST_MARKER} component replace short.`,
      description: `${TEST_MARKER} component replace full.`,
      categoryId: projectCategory.id,
      difficulty: 'BEGINNER',
      requiredComponents: [
        {
          id: keep.id,
          name: 'Breadboard',
          materialType: 'Breadboard',
          quantity: 1,
          unit: 'piece',
        },
        {
          name: 'Jumper wires',
          materialType: 'Jumper Wires',
          quantity: 1,
          unit: 'pack',
        },
      ],
    });

    assert.equal(
      await prisma.projectRequiredComponent.count({ where: { id: remove.id } }),
      0,
    );
    assert.equal(
      await prisma.projectComponentConcept.count({
        where: { componentId: remove.id },
      }),
      0,
    );

    const keepJoins = await prisma.projectComponentConcept.findMany({
      where: { componentId: keep.id },
      include: { concept: { select: { canonicalKey: true } } },
    });
    assert.equal(keepJoins.length, 1);
    assert.equal(keepJoins[0]?.concept.canonicalKey, 'component:breadboard');

    const created = await prisma.projectRequiredComponent.findFirstOrThrow({
      where: {
        projectId: project.id,
        componentName: 'Jumper wires',
      },
      select: { id: true },
    });
    const createdJoins = await prisma.projectComponentConcept.findMany({
      where: { componentId: created.id },
      include: { concept: { select: { canonicalKey: true } } },
    });
    assert.equal(createdJoins.length, 1);
    assert.equal(createdJoins[0]?.concept.canonicalKey, 'component:jumper-wires');

    const otherJoins = await prisma.projectComponentConcept.findMany({
      where: { componentId: otherComponent.id },
    });
    assert.equal(otherJoins.length, 1);
    assert.equal(otherJoins[0]?.conceptId, woodGlue.id);
  });

  test('missing and stale assignments self-heal on update; retry stays idempotent', async () => {
    const owner = await createLearnerUser('component-heal');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} component heal`,
    });
    const component = await prisma.projectRequiredComponent.create({
      data: {
        projectId: project.id,
        componentName: 'Breadboard',
        materialType: 'Breadboard',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        providedByUser: true,
        reviewStatus: 'PENDING_REVIEW',
      },
    });
    const wrong = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:led' },
      select: { id: true },
    });
    await prisma.projectComponentConcept.create({
      data: { componentId: component.id, conceptId: wrong.id },
    });

    const payload = {
      title: `${TEST_MARKER} component heal`,
      shortDescription: `${TEST_MARKER} component heal short.`,
      description: `${TEST_MARKER} component heal full.`,
      categoryId: projectCategory.id,
      difficulty: 'BEGINNER' as const,
      requiredComponents: [
        {
          id: component.id,
          name: 'Breadboard',
          materialType: 'Breadboard',
          quantity: 1,
          unit: 'piece',
        },
      ],
    };

    await updateMyLearningProjectSubmissionById(project.id, owner.id, payload);
    const healed = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
      include: { concept: { select: { canonicalKey: true } } },
    });
    assert.equal(healed.length, 1);
    assert.equal(healed[0]?.concept.canonicalKey, 'component:breadboard');
    const healedId = healed[0]!.id;

    await updateMyLearningProjectSubmissionById(project.id, owner.id, payload);
    const retry = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
    });
    assert.equal(retry.length, 1);
    assert.equal(retry[0]?.id, healedId);
  });

  test('create rolls back when component concept persistence fails after component write', async () => {
    const owner = await createLearnerUser('component-create-rollback');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );
    const title = `${TEST_MARKER} component create rollback ${Date.now()}`;
    let createAttempted = false;

    const failingDeps = createComponentConceptLifecycleDeps({
      deleteAssignments:
        defaultComponentConceptAssignmentPersistenceDeps.deleteAssignments,
      createAssignment: async (client, componentId, conceptId) => {
        const rows = await client.projectRequiredComponent.findMany({
          where: { project: { title } },
          select: { id: true, componentName: true, materialType: true },
        });
        assert.ok(rows.length > 0);
        assert.equal(rows[0]?.componentName, 'Breadboard');
        assert.equal(rows[0]?.materialType, 'Breadboard');
        assert.equal(rows[0]?.id, componentId);
        createAttempted = true;
        assert.ok(conceptId);
        throw new Error(
          'forced component concept persistence failure after entity write',
        );
      },
    });

    await assert.rejects(
      () =>
        prisma.$transaction((tx) =>
          learningProjectsRepository.createLearningProjectForReview({
            createdBy: owner.id,
            categoryId: projectCategory.id,
            title,
            shortDescription: `${TEST_MARKER} component create rollback short.`,
            description: `${TEST_MARKER} component create rollback full.`,
            difficulty: 'BEGINNER',
            requiredComponents: [
              {
                name: 'Breadboard',
                quantity: 1,
                unit: 'piece',
                isRequired: true,
                componentRole: 'REQUIRED_MATERIAL',
                materialType: 'Breadboard',
                searchKeywords: ['Breadboard'],
                canBeSubstituted: false,
              },
            ],
            client: tx,
            componentLifecycleDeps: failingDeps,
          }),
        ),
      (error: unknown) =>
        error instanceof Error
        && error.message
          === 'forced component concept persistence failure after entity write',
    );

    assert.equal(createAttempted, true);
    assert.equal(await prisma.learningProject.count({ where: { title } }), 0);
    assert.equal(
      await prisma.projectRequiredComponent.count({
        where: { project: { title } },
      }),
      0,
    );
    assert.equal(
      await prisma.projectComponentConcept.count({
        where: { component: { project: { title } } },
      }),
      0,
    );
    assert.equal(
      await prisma.learningProjectConcept.count({
        where: { project: { title } },
      }),
      0,
    );
  });

  test('update rolls back after stale assignment delete when create persistence fails', async () => {
    const owner = await createLearnerUser('component-update-rollback');
    const projectCategory = await createCategory(
      'PROJECT',
      'project-topic:robotics',
    );
    const project = await createProject({
      createdBy: owner.id,
      categoryId: projectCategory.id,
      status: 'CHANGES_REQUESTED',
      title: `${TEST_MARKER} component update rollback original`,
    });
    const topicJoin = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: projectCategory.topicConceptId,
      },
    });
    const component = await prisma.projectRequiredComponent.create({
      data: {
        projectId: project.id,
        componentName: 'Unknown part',
        materialType: 'unknown-type',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        providedByUser: true,
        reviewStatus: 'PENDING_REVIEW',
      },
    });
    const staleConcept = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:led', status: 'ACTIVE' },
      select: { id: true },
    });
    const staleJoin = await prisma.projectComponentConcept.create({
      data: {
        componentId: component.id,
        conceptId: staleConcept.id,
      },
    });
    let deletedStaleInTx = false;
    let createAttempted = false;

    const failingDeps = createComponentConceptLifecycleDeps({
      deleteAssignments: async (client, componentId, conceptIds) => {
        await defaultComponentConceptAssignmentPersistenceDeps.deleteAssignments(
          client,
          componentId,
          conceptIds,
        );
        deletedStaleInTx = conceptIds.includes(staleConcept.id);
        assert.equal(
          await client.projectComponentConcept.count({
            where: { id: staleJoin.id },
          }),
          0,
        );
      },
      createAssignment: async (client, componentId, conceptId) => {
        assert.equal(componentId, component.id);
        assert.notEqual(conceptId, staleConcept.id);
        const mutated = await client.projectRequiredComponent.findUniqueOrThrow({
          where: { id: componentId },
          select: { componentName: true, materialType: true, quantity: true },
        });
        assert.equal(mutated.componentName, 'Breadboard');
        assert.equal(mutated.materialType, 'Breadboard');
        assert.equal(Number(mutated.quantity), 2);
        createAttempted = true;
        throw new Error(
          'forced component concept persistence failure after entity write',
        );
      },
    });

    await assert.rejects(
      () =>
        learningProjectsRepository.updateMyLearningProjectSubmission({
          id: project.id,
          userId: owner.id,
          categoryId: projectCategory.id,
          title: `${TEST_MARKER} component update rollback changed`,
          shortDescription: `${TEST_MARKER} component update rollback short.`,
          description: `${TEST_MARKER} component update rollback full.`,
          difficulty: 'BEGINNER',
          requiredComponents: [
            {
              id: component.id,
              component: {
                name: 'Breadboard',
                quantity: 2,
                unit: 'piece',
                isRequired: true,
                componentRole: 'REQUIRED_MATERIAL',
                materialType: 'Breadboard',
                searchKeywords: ['Breadboard'],
                canBeSubstituted: false,
              },
            },
          ],
          componentLifecycleDeps: failingDeps,
        }),
      (error: unknown) =>
        error instanceof Error
        && error.message
          === 'forced component concept persistence failure after entity write',
    );

    assert.equal(deletedStaleInTx, true);
    assert.equal(createAttempted, true);

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      select: { title: true, status: true, categoryId: true },
    });
    assert.equal(
      stored.title,
      `${TEST_MARKER} component update rollback original`,
    );
    assert.equal(stored.status, 'CHANGES_REQUESTED');
    assert.equal(stored.categoryId, projectCategory.id);

    const storedComponent = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: component.id },
      select: { componentName: true, materialType: true, quantity: true },
    });
    assert.equal(storedComponent.componentName, 'Unknown part');
    assert.equal(storedComponent.materialType, 'unknown-type');
    assert.equal(Number(storedComponent.quantity), 1);

    const restoredJoins = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
    });
    assert.equal(restoredJoins.length, 1);
    assert.equal(restoredJoins[0]?.id, staleJoin.id);
    assert.equal(restoredJoins[0]?.conceptId, staleConcept.id);

    const topics = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(topics.length, 1);
    assert.equal(topics[0]?.id, topicJoin.id);
    assert.equal(topics[0]?.conceptId, projectCategory.topicConceptId);
  });
});
