import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import type { NextFunction, Request, Response } from 'express';

import {
  approveAdminLearningProject,
  archiveAdminLearningProject,
  getAdminLearningProjectById,
  hideAdminLearningProject,
  listAdminLearningProjects,
  rejectAdminLearningProject,
  requestChangesAdminLearningProject,
  restoreAdminLearningProject,
  updateAdminLearningProjectComponent,
} from './admin-learning-projects.service.js';
import * as adminLearningProjectsRepository from './admin-learning-projects.repository.js';
import {
  getLearningProjects,
  getLearningProjectById,
} from '../learning-projects/learning-projects.service.js';
import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';
import {
  defaultProjectTopicLifecycleDeps,
  reconcileLearningProjectTopics,
  type ProjectTopicLifecycleDeps,
} from '../taxonomy/project-concept-assignment.repository.js';
import {
  createComponentConceptLifecycleDeps,
  defaultComponentConceptAssignmentPersistenceDeps,
  defaultComponentConceptLifecycleDeps,
  type ComponentConceptLifecycleDeps,
} from '../taxonomy/component-concept-assignment.repository.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

const TEST_MARKER = '[test-admin-learning-projects]';

type TestIds = {
  users: string[];
  categories: string[];
  projects: string[];
  notifications: string[];
  activityLogs: string[];
};

const ids: TestIds = {
  users: [],
  categories: [],
  projects: [],
  notifications: [],
  activityLogs: [],
};

async function createAdminUser() {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Admin`,
      email: `${TEST_MARKER}-admin-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createLearnerUser() {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner`,
      email: `${TEST_MARKER}-learner-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
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

async function createProjectCategory(topicCanonicalKey?: string) {
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
      nameEn: `${TEST_MARKER} Robotics ${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      nameAr: `${TEST_MARKER} روبوتات`,
      categoryType: 'PROJECT',
      isActive: true,
      projectTopicConceptId: topic.id,
    },
  });
  ids.categories.push(category.id);
  return {
    ...category,
    topicConceptId: topic.id,
    topicCanonicalKey: topic.canonicalKey,
  };
}

async function createMaterialCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Electronics`,
      nameAr: `${TEST_MARKER} إلكترونيات`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
}

async function createProjectComponent(input: {
  projectId: string;
  materialCategoryId: string;
  componentName?: string;
  materialType?: string;
  componentRole?: 'REQUIRED_MATERIAL' | 'TOOL' | 'CONSUMABLE';
  categoryId?: string | null;
  searchKeywords?: string[];
}) {
  return prisma.projectRequiredComponent.create({
    data: {
      projectId: input.projectId,
      componentName: input.componentName ?? `${TEST_MARKER} Arduino Uno board`,
      materialType: input.materialType ?? 'Arduino board',
      quantity: 1,
      unit: 'piece',
      componentRole: input.componentRole ?? 'REQUIRED_MATERIAL',
      categoryId:
        input.categoryId === undefined
          ? input.materialCategoryId
          : input.categoryId,
      searchKeywords: input.searchKeywords ?? ['arduino', 'microcontroller'],
      providedByUser: true,
      reviewStatus: 'PENDING_REVIEW',
    },
  });
}

async function createLearningProject(input: {
  suffix: string;
  status:
    | 'DRAFT'
    | 'PENDING_REVIEW'
    | 'PUBLISHED'
    | 'CHANGES_REQUESTED'
    | 'REJECTED'
    | 'HIDDEN'
    | 'ARCHIVED';
  authorId: string;
  categoryId: string;
  includeComponent?: boolean;
  componentOverrides?: Omit<
    Parameters<typeof createProjectComponent>[0],
    'projectId' | 'materialCategoryId'
  >;
}) {
  const project = await prisma.learningProject.create({
    data: {
      categoryId: input.categoryId,
      createdBy: input.authorId,
      title: `${TEST_MARKER} ${input.suffix}`,
      shortDescription: `${TEST_MARKER} short description`,
      description: `${TEST_MARKER} full description for moderation tests.`,
      difficulty: 'BEGINNER',
      status: input.status,
      submittedAt:
        input.status === 'PENDING_REVIEW' ? new Date() : undefined,
    },
  });
  ids.projects.push(project.id);

  if (input.includeComponent !== false) {
    const materialCategory = await createMaterialCategory();
    await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      ...input.componentOverrides,
    });
  }

  return project;
}

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.activityLogs.length > 0) {
    await prisma.adminActivityLog.deleteMany({
      where: { id: { in: ids.activityLogs } },
    });
  }

  if (ids.notifications.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: ids.notifications } },
    });
  }

  if (ids.projects.length > 0) {
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
    });
  }

  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.categories } },
    });
  }

  if (ids.users.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: ids.users } },
    });
  }
});

describe('admin learning projects moderation', () => {
  test('public Learning Hub excludes non-published projects', async () => {
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const pending = await createLearningProject({
      suffix: 'pending-public',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });
    const rejected = await createLearningProject({
      suffix: 'rejected-public',
      status: 'REJECTED',
      authorId: author.id,
      categoryId: category.id,
    });
    const hidden = await createLearningProject({
      suffix: 'hidden-public',
      status: 'HIDDEN',
      authorId: author.id,
      categoryId: category.id,
    });
    const archived = await createLearningProject({
      suffix: 'archived-public',
      status: 'ARCHIVED',
      authorId: author.id,
      categoryId: category.id,
    });
    const published = await createLearningProject({
      suffix: 'published-public',
      status: 'PUBLISHED',
      authorId: author.id,
      categoryId: category.id,
    });

    const publicList = await getLearningProjects({ page: 1, limit: 100 });
    const publicIds = publicList.items.map((item) => item.id);

    assert.equal(publicIds.includes(pending.id), false);
    assert.equal(publicIds.includes(rejected.id), false);
    assert.equal(publicIds.includes(hidden.id), false);
    assert.equal(publicIds.includes(archived.id), false);
    assert.equal(publicIds.includes(published.id), true);

    await assert.rejects(
      () => getLearningProjectById(pending.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
    await assert.rejects(
      () => getLearningProjectById(rejected.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('admin list shows all moderation statuses', async () => {
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    await createLearningProject({
      suffix: 'admin-list-pending',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });
    await createLearningProject({
      suffix: 'admin-list-published',
      status: 'PUBLISHED',
      authorId: author.id,
      categoryId: category.id,
    });

    const result = await listAdminLearningProjects({
      page: 1,
      limit: 50,
      search: TEST_MARKER,
    });

    const statuses = new Set(result.items.map((item) => item.status));
    assert.ok(statuses.has('PENDING_REVIEW'));
    assert.ok(statuses.has('PUBLISHED'));
    assert.ok(result.summary.total >= 2);
  });

  test('approve publishes project', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'approve-me',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });

    const approved = await approveAdminLearningProject(admin.id, project.id);
    assert.equal(approved.status, 'PUBLISHED');
    assert.ok(approved.reviewedAt);

    const publicProject = await getLearningProjectById(project.id);
    assert.equal(publicProject.id, project.id);
  });

  test('request changes and reject require reason in validation schema', async () => {
    const { moderationReasonSchema } = await import(
      './admin-learning-projects.validation.js'
    );

    assert.equal(
      moderationReasonSchema.safeParse({ reason: 'no' }).success,
      false,
    );
    assert.equal(
      moderationReasonSchema.safeParse({ reason: 'x' }).success,
      false,
    );
    assert.equal(
      moderationReasonSchema.safeParse({ reason: 'Valid reason' }).success,
      true,
    );
  });

  test('request changes hides project from public', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'changes-me',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });

    const updated = await requestChangesAdminLearningProject(admin.id, project.id, {
      reason: 'Please add clearer wiring diagrams.',
    });
    assert.equal(updated.status, 'CHANGES_REQUESTED');
    assert.equal(updated.changesRequestedReason, 'Please add clearer wiring diagrams.');

    await assert.rejects(
      () => getLearningProjectById(project.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('reject hides project from public', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'reject-me',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });

    const updated = await rejectAdminLearningProject(admin.id, project.id, {
      reason: 'Incomplete project instructions.',
    });
    assert.equal(updated.status, 'REJECTED');
    assert.equal(updated.rejectionReason, 'Incomplete project instructions.');

    await assert.rejects(
      () => getLearningProjectById(project.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('hide requires reason and removes published project from public', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'hide-me',
      status: 'PUBLISHED',
      authorId: author.id,
      categoryId: category.id,
    });

    await getLearningProjectById(project.id);

    const hidden = await hideAdminLearningProject(admin.id, project.id, {
      reason: 'Policy violation in images.',
    });
    assert.equal(hidden.status, 'HIDDEN');
    assert.equal(hidden.hiddenReason, 'Policy violation in images.');

    await assert.rejects(
      () => getLearningProjectById(project.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('archive requires reason and removes project from public', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'archive-me',
      status: 'PUBLISHED',
      authorId: author.id,
      categoryId: category.id,
    });

    const archived = await archiveAdminLearningProject(admin.id, project.id, {
      reason: 'Duplicate submission.',
    });
    assert.equal(archived.status, 'ARCHIVED');
    assert.equal(archived.archivedReason, 'Duplicate submission.');

    await assert.rejects(
      () => getLearningProjectById(project.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 404,
    );
  });

  test('restore works only for hidden or archived projects', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const pending = await createLearningProject({
      suffix: 'restore-invalid',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });
    const hidden = await createLearningProject({
      suffix: 'restore-hidden',
      status: 'HIDDEN',
      authorId: author.id,
      categoryId: category.id,
    });

    await assert.rejects(
      () => restoreAdminLearningProject(admin.id, pending.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 400,
    );

    const restored = await restoreAdminLearningProject(admin.id, hidden.id);
    assert.equal(restored.status, 'PUBLISHED');
    const publicProject = await getLearningProjectById(hidden.id);
    assert.equal(publicProject.id, hidden.id);
  });

  test('invalid status transition returns clean 400', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'invalid-transition',
      status: 'ARCHIVED',
      authorId: author.id,
      categoryId: category.id,
    });

    await assert.rejects(
      () => approveAdminLearningProject(admin.id, project.id),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.code === 'INVALID_STATUS_TRANSITION',
    );
  });

  test('audit log is created for successful moderation action', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'audit-log',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });

    await approveAdminLearningProject(admin.id, project.id);

    const log = await prisma.adminActivityLog.findFirst({
      where: {
        actorUserId: admin.id,
        action: 'LEARNING_PROJECT_APPROVED',
        targetType: 'LEARNING_PROJECT',
        targetId: project.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    assert.ok(log);
    if (log) ids.activityLogs.push(log.id);
    assert.equal(log?.targetLabel, project.title);
  });

  test('pagination filter and search work', async () => {
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    await createLearningProject({
      suffix: 'search-alpha',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });
    await createLearningProject({
      suffix: 'search-beta-published',
      status: 'PUBLISHED',
      authorId: author.id,
      categoryId: category.id,
    });

    const filtered = await listAdminLearningProjects({
      page: 1,
      limit: 1,
      search: 'search-alpha',
      status: 'PENDING_REVIEW',
      categoryId: category.id,
      difficulty: 'BEGINNER',
    });

    assert.equal(filtered.items.length, 1);
    assert.ok(filtered.items[0]?.title.includes('search-alpha'));
    assert.equal(filtered.pagination.total, 1);
  });

  test('admin can update component on PENDING_REVIEW project', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'component-edit',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });
    const detail = await getAdminLearningProjectById(project.id);
    const componentId = detail.requiredComponents[0]!.id;
    const materialCategory = await createMaterialCategory();

    const updated = await updateAdminLearningProjectComponent(
      admin.id,
      project.id,
      componentId,
      {
        componentName: `${TEST_MARKER} HC-SR04 sensor`,
        componentRole: 'REQUIRED_MATERIAL',
        categoryId: materialCategory.id,
        materialType: 'Ultrasonic sensor',
        searchKeywords: ['hc-sr04', 'distance'],
      },
    );

    const saved = updated.requiredComponents.find((item) => item.id === componentId);
    assert.equal(saved?.name, `${TEST_MARKER} HC-SR04 sensor`);
    assert.equal(saved?.materialType, 'Ultrasonic sensor');
    assert.equal(saved?.confirmedByUser, true);
    assert.equal(saved?.reviewStatus, 'ACCEPTED');
  });

  test('admin cannot update component on PUBLISHED project', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'published-edit-block',
      status: 'PUBLISHED',
      authorId: author.id,
      categoryId: category.id,
    });
    const detail = await getAdminLearningProjectById(project.id);
    const componentId = detail.requiredComponents[0]!.id;

    await assert.rejects(
      () =>
        updateAdminLearningProjectComponent(admin.id, project.id, componentId, {
          componentName: 'Changed name',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'PROJECT_NOT_EDITABLE');
        return true;
      },
    );
  });

  test('rejects PROJECT-only category for component update', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const projectCategory = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'invalid-component-category',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: projectCategory.id,
    });
    const detail = await getAdminLearningProjectById(project.id);
    const componentId = detail.requiredComponents[0]!.id;

    await assert.rejects(
      () =>
        updateAdminLearningProjectComponent(admin.id, project.id, componentId, {
          categoryId: projectCategory.id,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'INVALID_COMPONENT_CATEGORY');
        return true;
      },
    );
  });

  test('rejects duplicate component name on update', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const materialCategory = await createMaterialCategory();
    const project = await prisma.learningProject.create({
      data: {
        categoryId: category.id,
        createdBy: author.id,
        title: `${TEST_MARKER} duplicate-components`,
        shortDescription: `${TEST_MARKER} short`,
        description: `${TEST_MARKER} description`,
        difficulty: 'BEGINNER',
        status: 'PENDING_REVIEW',
        submittedAt: new Date(),
      },
    });
    ids.projects.push(project.id);
    await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Arduino Uno board',
    });
    const second = await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'LED module',
    });

    await assert.rejects(
      () =>
        updateAdminLearningProjectComponent(admin.id, project.id, second.id, {
          componentName: 'arduino uno board',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'DUPLICATE_COMPONENT_NAME');
        return true;
      },
    );
  });

  test('hard warnings block approve', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'hard-block-approve',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      includeComponent: false,
    });

    await assert.rejects(
      () => approveAdminLearningProject(admin.id, project.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'COMPONENT_QUALITY_HARD_ISSUES');
        return true;
      },
    );
  });

  test('soft warnings do not block approve', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory();
    const project = await createLearningProject({
      suffix: 'soft-warning-approve',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      componentOverrides: {
        componentName: 'stuff',
        materialType: 'Unspecified',
        searchKeywords: [],
        categoryId: null,
        componentRole: 'CONSUMABLE',
      },
    });

    const detail = await getAdminLearningProjectById(project.id);
    assert.equal(detail.componentQuality.canApprove, true);
    assert.ok(detail.componentQuality.softWarnings.length > 0);

    const approved = await approveAdminLearningProject(admin.id, project.id);
    assert.equal(approved.status, 'PUBLISHED');
  });

  test('approve reconciles legacy pending project without topics', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:robotics');
    const project = await createLearningProject({
      suffix: 'approve-reconcile-legacy',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });

    assert.equal(
      await prisma.learningProjectConcept.count({
        where: { projectId: project.id },
      }),
      0,
    );

    const approved = await approveAdminLearningProject(admin.id, project.id);
    assert.equal(approved.status, 'PUBLISHED');

    const concepts = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
      include: { concept: { select: { canonicalKey: true, conceptType: true } } },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.conceptId, category.topicConceptId);
    assert.equal(concepts[0]?.concept.conceptType, 'PROJECT_TOPIC');
    assert.equal(concepts[0]?.concept.canonicalKey, 'project-topic:robotics');

    const componentJoins = await prisma.projectComponentConcept.findMany({
      where: { component: { projectId: project.id } },
      include: { concept: { select: { canonicalKey: true, conceptType: true } } },
    });
    assert.equal(componentJoins.length, 1);
    assert.equal(componentJoins[0]?.concept.conceptType, 'COMPONENT');
    assert.equal(componentJoins[0]?.concept.canonicalKey, 'component:arduino-board');
  });

  test('approve preserves identical topic join row', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:electronics');
    const project = await createLearningProject({
      suffix: 'approve-preserve-row',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });
    const existing = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: category.topicConceptId,
      },
    });

    const approved = await approveAdminLearningProject(admin.id, project.id);
    assert.equal(approved.status, 'PUBLISHED');

    const concepts = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.id, existing.id);
    assert.equal(concepts[0]?.conceptId, category.topicConceptId);
  });

  test('approve rolls back PUBLISHED when topic persistence fails after status write', async () => {
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:robotics');
    const project = await createLearningProject({
      suffix: 'approve-rollback',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
    });
    const existing = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: category.topicConceptId,
      },
    });

    const failingDeps: ProjectTopicLifecycleDeps = {
      reconcileLearningProjectTopics: async (client, projectId) => {
        const row = await client.learningProject.findUnique({
          where: { id: projectId },
          select: { status: true },
        });
        assert.ok(row);
        assert.equal(row.status, 'PUBLISHED');
        throw new Error('forced topic persistence failure after entity write');
      },
    };

    await assert.rejects(
      () =>
        prisma.$transaction((tx) =>
          adminLearningProjectsRepository.approveLearningProjectInTransaction(tx, {
            id: project.id,
            moderationData: {
              status: 'PUBLISHED',
              reviewedAt: new Date(),
              reviewNote: null,
              rejectionReason: null,
              changesRequestedReason: null,
              hiddenAt: null,
              hiddenBy: null,
              hiddenReason: null,
              archivedAt: null,
              archivedBy: null,
              archivedReason: null,
            },
            topicLifecycleDeps: failingDeps,
          }),
        ),
      (error: unknown) =>
        error instanceof Error
        && error.message === 'forced topic persistence failure after entity write',
    );

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      select: { status: true },
    });
    assert.equal(stored.status, 'PENDING_REVIEW');

    const concepts = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.id, existing.id);
  });

  test('approve blocks when category lacks project-topic ownership', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const unowned = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} unowned approve ${Date.now()}`,
        nameAr: `${TEST_MARKER} unowned`,
        categoryType: 'PROJECT',
        isActive: true,
        projectTopicConceptId: null,
      },
    });
    ids.categories.push(unowned.id);

    const project = await createLearningProject({
      suffix: 'approve-unowned',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: unowned.id,
    });

    await assert.rejects(
      () => approveAdminLearningProject(admin.id, project.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'CATEGORY_TAXONOMY_NOT_READY',
    );

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      select: { status: true },
    });
    assert.equal(stored.status, 'PENDING_REVIEW');
  });

  test('overlapping learner update and approve keep category and topic paired', async () => {
    type Deferred<T> = {
      promise: Promise<T>;
      resolve: (value: T) => void;
      reject: (reason?: unknown) => void;
    };
    const deferred = <T>(): Deferred<T> => {
      let resolve!: (value: T) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    };

    const author = await createLearnerUser();
    const categoryA = await createProjectCategory('project-topic:robotics');
    const categoryB = await createProjectCategory('project-topic:electronics');
    assert.notEqual(categoryA.topicConceptId, categoryB.topicConceptId);

    const project = await createLearningProject({
      suffix: 'overlap-update-approve',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: categoryA.id,
    });
    await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: categoryA.topicConceptId,
      },
    });

    const lockAcquired = deferred<void>();
    const release = deferred<void>();

    const updateDeps: ProjectTopicLifecycleDeps = {
      reconcileLearningProjectTopics: async (client, projectId, categoryId) => {
        const row = await client.learningProject.findUnique({
          where: { id: projectId },
          select: { categoryId: true },
        });
        assert.ok(row);
        assert.equal(row.categoryId, categoryB.id);
        assert.equal(categoryId, categoryB.id);
        lockAcquired.resolve();
        await release.promise;
        await reconcileLearningProjectTopics(client, projectId, categoryId);
      },
    };

    const updatePromise = learningProjectsRepository.updateMyLearningProjectSubmission({
      id: project.id,
      userId: author.id,
      categoryId: categoryB.id,
      title: `${TEST_MARKER} overlap updated`,
      shortDescription: `${TEST_MARKER} overlap short.`,
      description: `${TEST_MARKER} overlap full.`,
      difficulty: 'BEGINNER',
      topicLifecycleDeps: updateDeps,
    });

    await lockAcquired.promise;

    const approvePromise = prisma.$transaction((tx) =>
      adminLearningProjectsRepository.approveLearningProjectInTransaction(tx, {
        id: project.id,
        moderationData: {
          status: 'PUBLISHED',
          reviewedAt: new Date(),
          reviewNote: null,
          rejectionReason: null,
          changesRequestedReason: null,
          hiddenAt: null,
          hiddenBy: null,
          hiddenReason: null,
          archivedAt: null,
          archivedBy: null,
          archivedReason: null,
        },
        topicLifecycleDeps: defaultProjectTopicLifecycleDeps,
      }),
    );

    release.resolve();
    const results = await Promise.allSettled([updatePromise, approvePromise]);

    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      2,
    );

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      select: { status: true, categoryId: true },
    });
    const concepts = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
      select: { conceptId: true },
    });

    assert.equal(stored.status, 'PUBLISHED');
    assert.equal(stored.categoryId, categoryB.id);
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.conceptId, categoryB.topicConceptId);
    assert.notEqual(concepts[0]?.conceptId, categoryA.topicConceptId);
  });

  test('non-admin cannot access admin learning project routes', () => {
    const middleware = requireRoles('ADMIN');
    const req = {
      auth: { sub: 'learner-user', roles: ['LEARNER'] },
    } as unknown as Request;
    const res = {} as Response;
    let nextErr: unknown;
    const next: NextFunction = (err?: unknown) => {
      nextErr = err;
    };

    middleware(req, res, next);

    assert.ok(nextErr);
    assert.equal((nextErr as { statusCode?: number }).statusCode, 403);
  });
});

describe('required component concept admin lifecycle', () => {
  test('admin semantic enrich syncs assignment; non-semantic preserves join row', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:robotics');
    const project = await createLearningProject({
      suffix: 'component-concept-enrich',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      includeComponent: false,
    });
    const topicJoin = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: category.topicConceptId,
      },
    });
    const materialCategory = await createMaterialCategory();
    const component = await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Breadboard',
      materialType: 'Breadboard',
    });
    const breadboard = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:breadboard', status: 'ACTIVE' },
      select: { id: true },
    });
    const existingJoin = await prisma.projectComponentConcept.create({
      data: { componentId: component.id, conceptId: breadboard.id },
    });

    await updateAdminLearningProjectComponent(
      admin.id,
      project.id,
      component.id,
      { quantity: 5 },
    );

    const afterNonSemantic = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
    });
    assert.equal(afterNonSemantic.length, 1);
    assert.equal(afterNonSemantic[0]?.id, existingJoin.id);

    await updateAdminLearningProjectComponent(
      admin.id,
      project.id,
      component.id,
      {
        componentName: 'Arduino board',
        materialType: 'Arduino Uno',
      },
    );

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
  });

  test('approve reconciles mapped components and allows unmapped; preserves topic rows', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:electronics');
    const project = await createLearningProject({
      suffix: 'approve-component-reconcile',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      includeComponent: false,
    });
    const topicJoin = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: category.topicConceptId,
      },
    });
    const materialCategory = await createMaterialCategory();
    const mapped = await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Breadboard',
      materialType: 'Breadboard',
    });
    await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Mystery widget',
      materialType: 'totally-unknown-type',
    });

    const approved = await approveAdminLearningProject(admin.id, project.id);
    assert.equal(approved.status, 'PUBLISHED');

    const mappedJoins = await prisma.projectComponentConcept.findMany({
      where: { componentId: mapped.id },
      include: { concept: { select: { canonicalKey: true } } },
    });
    assert.equal(mappedJoins.length, 1);
    assert.equal(mappedJoins[0]?.concept.canonicalKey, 'component:breadboard');

    const unmappedCount = await prisma.projectComponentConcept.count({
      where: {
        component: {
          projectId: project.id,
          componentName: 'Mystery widget',
        },
      },
    });
    assert.equal(unmappedCount, 0);

    const topics = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(topics.length, 1);
    assert.equal(topics[0]?.id, topicJoin.id);
  });

  test('approve preserves identical component assignment row', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:robotics');
    const project = await createLearningProject({
      suffix: 'approve-preserve-component-row',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      includeComponent: false,
    });
    const materialCategory = await createMaterialCategory();
    const component = await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Breadboard',
      materialType: 'Breadboard',
    });
    const breadboard = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:breadboard', status: 'ACTIVE' },
      select: { id: true },
    });
    const existing = await prisma.projectComponentConcept.create({
      data: { componentId: component.id, conceptId: breadboard.id },
    });

    await approveAdminLearningProject(admin.id, project.id);

    const joins = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
    });
    assert.equal(joins.length, 1);
    assert.equal(joins[0]?.id, existing.id);
  });

  test('approve rolls back PUBLISHED when component concept persistence fails', async () => {
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:robotics');
    const project = await createLearningProject({
      suffix: 'approve-component-rollback',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      includeComponent: false,
    });
    const topicJoin = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: category.topicConceptId,
      },
    });
    const materialCategory = await createMaterialCategory();
    const component = await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Breadboard',
      materialType: 'Breadboard',
    });
    const staleConcept = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:led', status: 'ACTIVE' },
      select: { id: true },
    });
    const breadboard = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:breadboard', status: 'ACTIVE' },
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
        const row = await client.learningProject.findUnique({
          where: { id: project.id },
          select: { status: true },
        });
        assert.ok(row);
        assert.equal(row.status, 'PUBLISHED');
        deletedStaleInTx = conceptIds.includes(staleConcept.id);
        assert.equal(
          await client.projectComponentConcept.count({
            where: { id: staleJoin.id },
          }),
          0,
        );
      },
      createAssignment: async (_client, componentId, conceptId) => {
        assert.equal(componentId, component.id);
        assert.equal(conceptId, breadboard.id);
        createAttempted = true;
        throw new Error(
          'forced component concept persistence failure after status write',
        );
      },
    });

    await assert.rejects(
      () =>
        runSerializableTransaction((tx) =>
          adminLearningProjectsRepository.approveLearningProjectInTransaction(tx, {
            id: project.id,
            moderationData: {
              status: 'PUBLISHED',
              reviewedAt: new Date(),
              reviewNote: null,
              rejectionReason: null,
              changesRequestedReason: null,
              hiddenAt: null,
              hiddenBy: null,
              hiddenReason: null,
              archivedAt: null,
              archivedBy: null,
              archivedReason: null,
            },
            componentLifecycleDeps: failingDeps,
          }),
        ),
      (error: unknown) =>
        error instanceof Error
        && error.message
          === 'forced component concept persistence failure after status write',
    );

    assert.equal(deletedStaleInTx, true);
    assert.equal(createAttempted, true);

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      select: { status: true },
    });
    assert.equal(stored.status, 'PENDING_REVIEW');

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
    assert.equal(topics[0]?.conceptId, category.topicConceptId);
  });

  test('admin component edit rolls back when concept persistence fails after row update', async () => {
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:robotics');
    const project = await createLearningProject({
      suffix: 'admin-component-rollback',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      includeComponent: false,
    });
    const topicJoin = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: category.topicConceptId,
      },
    });
    const materialCategory = await createMaterialCategory();
    const component = await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Unknown part',
      materialType: 'unknown-type',
    });
    const staleConcept = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:led', status: 'ACTIVE' },
      select: { id: true },
    });
    const breadboard = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:breadboard', status: 'ACTIVE' },
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
        const mutated = await client.projectRequiredComponent.findUniqueOrThrow({
          where: { id: componentId },
          select: { componentName: true, materialType: true },
        });
        assert.equal(mutated.componentName, 'Breadboard');
        assert.equal(mutated.materialType, 'Breadboard');
      },
      createAssignment: async (_client, componentId, conceptId) => {
        assert.equal(componentId, component.id);
        assert.equal(conceptId, breadboard.id);
        createAttempted = true;
        throw new Error(
          'forced component concept persistence failure after component update',
        );
      },
    });

    await assert.rejects(
      () =>
        adminLearningProjectsRepository.updateAdminLearningProjectComponent({
          projectId: project.id,
          componentId: component.id,
          data: {
            componentName: 'Breadboard',
            materialType: 'Breadboard',
          },
          componentLifecycleDeps: failingDeps,
        }),
      (error: unknown) =>
        error instanceof Error
        && error.message
          === 'forced component concept persistence failure after component update',
    );

    assert.equal(deletedStaleInTx, true);
    assert.equal(createAttempted, true);

    const stored = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: component.id },
      select: { componentName: true, materialType: true },
    });
    assert.equal(stored.componentName, 'Unknown part');
    assert.equal(stored.materialType, 'unknown-type');

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
  });

  test('service rejects component edit after approve publishes the project', async () => {
    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:robotics');
    const project = await createLearningProject({
      suffix: 'edit-after-publish-guard',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      includeComponent: false,
    });
    const topicJoin = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: category.topicConceptId,
      },
    });
    const materialCategory = await createMaterialCategory();
    const component = await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Breadboard',
      materialType: 'Breadboard',
    });
    const breadboard = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:breadboard', status: 'ACTIVE' },
      select: { id: true },
    });
    const existingJoin = await prisma.projectComponentConcept.create({
      data: { componentId: component.id, conceptId: breadboard.id },
    });

    const approved = await approveAdminLearningProject(admin.id, project.id);
    assert.equal(approved.status, 'PUBLISHED');

    await assert.rejects(
      () =>
        updateAdminLearningProjectComponent(admin.id, project.id, component.id, {
          componentName: 'Arduino board',
          materialType: 'Arduino Uno',
          quantity: 9,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'PROJECT_NOT_EDITABLE');
        assert.equal(error.statusCode, 409);
        return true;
      },
    );

    const storedComponent = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: component.id },
      select: { componentName: true, materialType: true, quantity: true },
    });
    assert.equal(storedComponent.componentName, 'Breadboard');
    assert.equal(storedComponent.materialType, 'Breadboard');
    assert.equal(Number(storedComponent.quantity), 1);

    const joins = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
    });
    assert.equal(joins.length, 1);
    assert.equal(joins[0]?.id, existingJoin.id);
    assert.equal(joins[0]?.conceptId, breadboard.id);

    const topics = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(topics.length, 1);
    assert.equal(topics[0]?.id, topicJoin.id);
  });

  test('concurrent approve-then-edit rejects mutation via in-transaction status guard', async () => {
    type Deferred<T> = {
      promise: Promise<T>;
      resolve: (value: T) => void;
      reject: (reason?: unknown) => void;
    };
    const deferred = <T>(): Deferred<T> => {
      let resolve!: (value: T) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    };

    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:robotics');
    const project = await createLearningProject({
      suffix: 'approve-first-edit-race',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      includeComponent: false,
    });
    const topicJoin = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: category.topicConceptId,
      },
    });
    const materialCategory = await createMaterialCategory();
    const component = await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Breadboard',
      materialType: 'Breadboard',
    });
    const breadboard = await prisma.taxonomyConcept.findFirstOrThrow({
      where: { canonicalKey: 'component:breadboard', status: 'ACTIVE' },
      select: { id: true },
    });
    const existingJoin = await prisma.projectComponentConcept.create({
      data: { componentId: component.id, conceptId: breadboard.id },
    });

    const approveStarted = deferred<void>();
    const releaseEdit = deferred<void>();

    const approveDeps = createComponentConceptLifecycleDeps({
      deleteAssignments:
        defaultComponentConceptAssignmentPersistenceDeps.deleteAssignments,
      createAssignment: async (client, componentId, conceptId) => {
        approveStarted.resolve();
        await releaseEdit.promise;
        return defaultComponentConceptAssignmentPersistenceDeps.createAssignment(
          client,
          componentId,
          conceptId,
        );
      },
    });

    // Force non-identical approve reconcile so createAssignment barrier runs:
    // start with no join, approve will create breadboard assignment.
    await prisma.projectComponentConcept.deleteMany({
      where: { componentId: component.id },
    });

    const approvePromise = runSerializableTransaction((tx) =>
      adminLearningProjectsRepository.approveLearningProjectInTransaction(tx, {
        id: project.id,
        moderationData: {
          status: 'PUBLISHED',
          reviewedAt: new Date(),
          reviewNote: null,
          rejectionReason: null,
          changesRequestedReason: null,
          hiddenAt: null,
          hiddenBy: null,
          hiddenReason: null,
          archivedAt: null,
          archivedBy: null,
          archivedReason: null,
        },
        componentLifecycleDeps: approveDeps,
      }),
    );

    await approveStarted.promise;

    const editPromise = updateAdminLearningProjectComponent(
      admin.id,
      project.id,
      component.id,
      {
        componentName: 'Arduino board',
        materialType: 'Arduino Uno',
      },
    );

    releaseEdit.resolve();
    const results = await Promise.allSettled([approvePromise, editPromise]);

    assert.equal(results[0]?.status, 'fulfilled');
    assert.equal(results[1]?.status, 'rejected');
    const editError = (results[1] as PromiseRejectedResult).reason;
    assert.ok(editError instanceof AppError);
    assert.equal(editError.code, 'PROJECT_NOT_EDITABLE');

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      select: { status: true },
    });
    assert.equal(stored.status, 'PUBLISHED');

    const storedComponent = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: component.id },
      select: { componentName: true, materialType: true },
    });
    assert.equal(storedComponent.componentName, 'Breadboard');
    assert.equal(storedComponent.materialType, 'Breadboard');

    const joins = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
      include: { concept: { select: { canonicalKey: true } } },
    });
    assert.equal(joins.length, 1);
    assert.equal(joins[0]?.concept.canonicalKey, 'component:breadboard');

    const topics = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(topics.length, 1);
    assert.equal(topics[0]?.id, topicJoin.id);

    // existingJoin was deleted before approve; final join is the approve-created one
    assert.notEqual(joins[0]?.id, existingJoin.id);
  });

  test('concurrent admin component edit and approve settle on final evidence', async () => {
    type Deferred<T> = {
      promise: Promise<T>;
      resolve: (value: T) => void;
      reject: (reason?: unknown) => void;
    };
    const deferred = <T>(): Deferred<T> => {
      let resolve!: (value: T) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
      });
      return { promise, resolve, reject };
    };

    const admin = await createAdminUser();
    const author = await createLearnerUser();
    const category = await createProjectCategory('project-topic:robotics');
    const project = await createLearningProject({
      suffix: 'component-race-edit-approve',
      status: 'PENDING_REVIEW',
      authorId: author.id,
      categoryId: category.id,
      includeComponent: false,
    });
    const topicJoin = await prisma.learningProjectConcept.create({
      data: {
        projectId: project.id,
        conceptId: category.topicConceptId,
      },
    });
    const materialCategory = await createMaterialCategory();
    const component = await createProjectComponent({
      projectId: project.id,
      materialCategoryId: materialCategory.id,
      componentName: 'Breadboard',
      materialType: 'Breadboard',
    });

    const lockAcquired = deferred<void>();
    const release = deferred<void>();

    const editDeps: ComponentConceptLifecycleDeps = {
      reconcileLearningProjectComponents:
        defaultComponentConceptLifecycleDeps.reconcileLearningProjectComponents,
      reconcileProjectRequiredComponent: async (client, componentId) => {
        const row = await client.projectRequiredComponent.findUnique({
          where: { id: componentId },
          select: { componentName: true, materialType: true },
        });
        assert.ok(row);
        assert.equal(row.componentName, 'Arduino board');
        assert.equal(row.materialType, 'Arduino Uno');
        lockAcquired.resolve();
        await release.promise;
        return defaultComponentConceptLifecycleDeps.reconcileProjectRequiredComponent(
          client,
          componentId,
        );
      },
    };

    const editPromise = adminLearningProjectsRepository.updateAdminLearningProjectComponent({
      projectId: project.id,
      componentId: component.id,
      data: {
        componentName: 'Arduino board',
        materialType: 'Arduino Uno',
      },
      componentLifecycleDeps: editDeps,
    });

    await lockAcquired.promise;

    const approvePromise = approveAdminLearningProject(admin.id, project.id);

    release.resolve();
    const results = await Promise.allSettled([editPromise, approvePromise]);
    assert.equal(
      results.filter((result) => result.status === 'fulfilled').length,
      2,
    );

    const storedComponent = await prisma.projectRequiredComponent.findUniqueOrThrow({
      where: { id: component.id },
      select: { componentName: true, materialType: true },
    });
    assert.equal(storedComponent.componentName, 'Arduino board');
    assert.equal(storedComponent.materialType, 'Arduino Uno');

    const joins = await prisma.projectComponentConcept.findMany({
      where: { componentId: component.id },
      include: { concept: { select: { canonicalKey: true } } },
    });
    assert.equal(joins.length, 1);
    assert.equal(joins[0]?.concept.canonicalKey, 'component:arduino-board');

    const stored = await prisma.learningProject.findUniqueOrThrow({
      where: { id: project.id },
      select: { status: true },
    });
    assert.equal(stored.status, 'PUBLISHED');

    const topics = await prisma.learningProjectConcept.findMany({
      where: { projectId: project.id },
    });
    assert.equal(topics.length, 1);
    assert.equal(topics[0]?.id, topicJoin.id);
  });
});
