import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';

import {
  getLearningProjectById,
  getMyLearningProjectSubmissionById,
  getMyLearningProjectSubmissions,
  resubmitMyLearningProjectSubmissionById,
  updateMyLearningProjectSubmissionById,
} from './learning-projects.service.js';

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

async function createCategory(categoryType: 'PROJECT' | 'BOTH') {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} ${categoryType}`,
      nameAr: `${TEST_MARKER} فئة`,
      categoryType,
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
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
  if (ids.projects.length > 0) {
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
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
