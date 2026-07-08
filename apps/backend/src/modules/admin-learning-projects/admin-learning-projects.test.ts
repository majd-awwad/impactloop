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
import {
  getLearningProjects,
  getLearningProjectById,
} from '../learning-projects/learning-projects.service.js';

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

async function createProjectCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Robotics`,
      nameAr: `${TEST_MARKER} روبوتات`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
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
  componentOverrides?: Parameters<typeof createProjectComponent>[0];
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
