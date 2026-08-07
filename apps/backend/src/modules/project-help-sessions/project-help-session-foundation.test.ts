import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, describe, test } from 'node:test';

import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  PROJECT_HELP_SESSION_AUTHOR_SOURCE,
  resolveProjectHelpSessionAuthor,
  resolveProjectHelpSessionAuthorByProject,
} from './project-help-session-author.js';
import {
  DEFAULT_PROJECT_HELP_SESSION_OFFERING,
  getAuthorHelpSessionSettings,
  getEffectiveOfferingForProject,
  getProjectHelpSessionAvailability,
  upsertAuthorHelpSessionSettings,
} from './project-help-session-offering.js';
import {
  buildProjectHelpSessionActiveKey,
  isProjectHelpSessionActiveStatus,
  isProjectHelpSessionTerminalStatus,
  PROJECT_HELP_SESSION_ACTIVE_STATUSES,
  PROJECT_HELP_SESSION_TERMINAL_STATUSES,
} from './project-help-session-status.js';

const TEST_MARKER = '[test-project-help-session-foundation]';
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationSql = readFileSync(
  join(
    __dirname,
    '../../../prisma/migrations/20260805200000_project_help_session_foundation/migration.sql',
  ),
  'utf8',
);

const ids = {
  users: [] as string[],
  categories: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  offerings: [] as string[],
  sessions: [] as string[],
};

async function createUser(input: {
  suffix: string;
  roles: Array<'LEARNER' | 'ADMIN'>;
  primary?: 'LEARNER' | 'ADMIN';
}) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: input.roles.map((role, index) => ({
          role,
          isPrimary: (input.primary ?? input.roles[0]) === role,
        })),
      },
      learnerProfile:
        input.roles.includes('LEARNER')
          ? {
              create: {
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            }
          : undefined,
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createProject(input: {
  authorId: string;
  reviewedById?: string | null;
  status?: 'PUBLISHED' | 'DRAFT';
}) {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Projects`,
      nameAr: `${TEST_MARKER} مشاريع`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(category.id);

  const project = await prisma.learningProject.create({
    data: {
      categoryId: category.id,
      createdBy: input.authorId,
      title: `${TEST_MARKER} Project`,
      shortDescription: 'Short description',
      description: 'Description',
      difficulty: 'BEGINNER',
      status: input.status ?? 'PUBLISHED',
      submittedAt: new Date(),
      reviewedBy: input.reviewedById ?? null,
      reviewedAt: input.reviewedById ? new Date() : null,
    },
    include: {
      createdByUser: {
        select: {
          id: true,
          displayName: true,
          profileImageUrl: true,
          accountStatus: true,
          roles: { select: { role: true } },
        },
      },
    },
  });
  ids.projects.push(project.id);
  return project;
}

async function createBuild(input: { projectId: string; learnerId: string }) {
  const build = await prisma.projectBuild.create({
    data: {
      projectId: input.projectId,
      learnerId: input.learnerId,
      attemptNumber: 1,
      status: 'IN_PROGRESS',
    },
  });
  ids.builds.push(build.id);
  return build;
}

describe('project help session foundation', () => {
  before(async () => {
    await prisma.$connect();
  });

  after(async () => {
    if (ids.sessions.length > 0) {
      await prisma.projectHelpSessionStatusHistory.deleteMany({
        where: { sessionId: { in: ids.sessions } },
      });
      await prisma.projectHelpSessionTimeOption.deleteMany({
        where: { sessionId: { in: ids.sessions } },
      });
      await prisma.projectHelpSession.deleteMany({
        where: { id: { in: ids.sessions } },
      });
    }
    if (ids.offerings.length > 0) {
      await prisma.projectHelpSessionOffering.deleteMany({
        where: { id: { in: ids.offerings } },
      });
    }
    if (ids.builds.length > 0) {
      await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
    }
    if (ids.projects.length > 0) {
      await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
    }
    if (ids.categories.length > 0) {
      await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
    }
    if (ids.users.length > 0) {
      await prisma.userRoleAssignment.deleteMany({
        where: { userId: { in: ids.users } },
      });
      await prisma.learnerProfile.deleteMany({
        where: { userId: { in: ids.users } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    }
    await prisma.$disconnect();
  });

  test('canonical author resolves from learner-created project', async () => {
    const author = await createUser({ suffix: 'author', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });

    const resolved = await resolveProjectHelpSessionAuthor(project.id);
    assert.equal(resolved.available, true);
    if (!resolved.available) {
      return;
    }
    assert.equal(resolved.authorId, author.id);
    assert.equal(resolved.source, PROJECT_HELP_SESSION_AUTHOR_SOURCE);
  });

  test('approving admin is not treated as author', async () => {
    const author = await createUser({ suffix: 'learner-author', roles: ['LEARNER'] });
    const admin = await createUser({
      suffix: 'approver',
      roles: ['ADMIN', 'LEARNER'],
      primary: 'ADMIN',
    });
    const project = await createProject({
      authorId: author.id,
      reviewedById: admin.id,
    });

    const resolved = await resolveProjectHelpSessionAuthor(project.id);
    assert.equal(resolved.available, true);
    if (!resolved.available) {
      return;
    }
    assert.equal(resolved.authorId, author.id);
    assert.notEqual(resolved.authorId, admin.id);
  });

  test('authorless admin-only project returns AUTHOR_UNAVAILABLE', async () => {
    const admin = await createUser({ suffix: 'admin-only', roles: ['ADMIN'] });
    const project = await createProject({ authorId: admin.id });

    const resolved = await resolveProjectHelpSessionAuthor(project.id);
    assert.deepEqual(resolved, {
      available: false,
      reason: 'AUTHOR_UNAVAILABLE',
    });
  });

  test('default effective offering is disabled without creating a DB row', async () => {
    const author = await createUser({ suffix: 'no-offering', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });

    const offering = await getEffectiveOfferingForProject(project.id);
    assert.deepEqual(offering, DEFAULT_PROJECT_HELP_SESSION_OFFERING);
    const stored = await prisma.projectHelpSessionOffering.findUnique({
      where: { projectId: project.id },
    });
    assert.equal(stored, null);
  });

  test('canonical author can create and update offering', async () => {
    const author = await createUser({ suffix: 'settings-author', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });

    const created = await upsertAuthorHelpSessionSettings(project.id, author.id, {
      isEnabled: true,
      allow15Minutes: true,
      allow30Minutes: false,
      weeklyLimit: 4,
    });
    assert.equal(created.isEnabled, true);
    assert.equal(created.allow15Minutes, true);

    const updated = await upsertAuthorHelpSessionSettings(project.id, author.id, {
      isEnabled: true,
      allow15Minutes: false,
      allow30Minutes: true,
      weeklyLimit: 5,
    });
    assert.equal(updated.allow30Minutes, true);
    assert.equal(updated.weeklyLimit, 5);

    const stored = await prisma.projectHelpSessionOffering.findUnique({
      where: { projectId: project.id },
    });
    assert.ok(stored);
    ids.offerings.push(stored.id);
    assert.equal(stored.authorId, author.id);
  });

  test('non-author cannot read private author settings', async () => {
    const author = await createUser({ suffix: 'owner', roles: ['LEARNER'] });
    const other = await createUser({ suffix: 'other', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });

    await assert.rejects(
      () => getAuthorHelpSessionSettings(project.id, other.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('non-author cannot update settings', async () => {
    const author = await createUser({ suffix: 'owner-update', roles: ['LEARNER'] });
    const other = await createUser({ suffix: 'other-update', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });

    await assert.rejects(
      () =>
        upsertAuthorHelpSessionSettings(project.id, other.id, {
          isEnabled: true,
          allow15Minutes: true,
          allow30Minutes: false,
          weeklyLimit: 3,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('enabling with neither duration is rejected', async () => {
    const author = await createUser({ suffix: 'duration', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });

    await assert.rejects(
      () =>
        upsertAuthorHelpSessionSettings(project.id, author.id, {
          isEnabled: true,
          allow15Minutes: false,
          allow30Minutes: false,
          weeklyLimit: 3,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HELP_SESSION_NO_DURATION_ENABLED');
        return true;
      },
    );
  });

  test('weeklyLimit below and above bounds is rejected', async () => {
    const author = await createUser({ suffix: 'weekly', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });

    for (const weeklyLimit of [0, 11]) {
      await assert.rejects(
        () =>
          upsertAuthorHelpSessionSettings(project.id, author.id, {
            isEnabled: false,
            allow15Minutes: true,
            allow30Minutes: false,
            weeklyLimit,
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.code, 'HELP_SESSION_WEEKLY_LIMIT_OUT_OF_RANGE');
          return true;
        },
      );
    }
  });

  test('allowed durations are returned safely in availability', async () => {
    const author = await createUser({ suffix: 'availability', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });
    await upsertAuthorHelpSessionSettings(project.id, author.id, {
      isEnabled: true,
      allow15Minutes: true,
      allow30Minutes: true,
      weeklyLimit: 2,
    });
    const stored = await prisma.projectHelpSessionOffering.findUnique({
      where: { projectId: project.id },
    });
    assert.ok(stored);
    ids.offerings.push(stored.id);

    const availability = await getProjectHelpSessionAvailability(project.id);
    assert.equal(availability.available, true);
    assert.deepEqual(availability.allowedDurations, [15, 30]);
    assert.equal(availability.weeklyLimit, 2);
    assert.ok(availability.authorDisplayName);
    assert.ok(!('email' in availability));
    assert.ok(!('phone' in availability));
  });

  test('public availability exposes no email or phone', async () => {
    const author = await createUser({ suffix: 'privacy', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });
    const availability = await getProjectHelpSessionAvailability(project.id);
    const serialized = JSON.stringify(availability);
    assert.ok(!serialized.includes('@impactloop.test'));
    assert.ok(!serialized.includes('+970'));
  });

  test('only one offering can exist per project', async () => {
    const author = await createUser({ suffix: 'unique-offering', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });
    const offering = await prisma.projectHelpSessionOffering.create({
      data: {
        projectId: project.id,
        authorId: author.id,
        isEnabled: false,
        allow15Minutes: false,
        allow30Minutes: false,
        weeklyLimit: 3,
      },
    });
    ids.offerings.push(offering.id);

    await assert.rejects(
      () =>
        prisma.projectHelpSessionOffering.create({
          data: {
            projectId: project.id,
            authorId: author.id,
            isEnabled: true,
            allow15Minutes: true,
            allow30Minutes: false,
            weeklyLimit: 3,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
        assert.equal(error.code, 'P2002');
        return true;
      },
    );
  });

  test('activeKey uniqueness prevents duplicate active sessions', async () => {
    const author = await createUser({ suffix: 'active-key-author', roles: ['LEARNER'] });
    const learner = await createUser({ suffix: 'active-key-learner', roles: ['LEARNER'] });
    const project = await createProject({ authorId: author.id });
    const build = await createBuild({ projectId: project.id, learnerId: learner.id });
    const activeKey = buildProjectHelpSessionActiveKey(build.id);

    const first = await prisma.projectHelpSession.create({
      data: {
        projectId: project.id,
        buildId: build.id,
        learnerId: learner.id,
        authorId: author.id,
        problemDescription: 'Need help',
        durationMinutes: 15,
        learnerTimeZone: 'Asia/Hebron',
        status: 'PENDING',
        activeKey,
      },
    });
    ids.sessions.push(first.id);

    await assert.rejects(
      () =>
        prisma.projectHelpSession.create({
          data: {
            projectId: project.id,
            buildId: build.id,
            learnerId: learner.id,
            authorId: author.id,
            problemDescription: 'Duplicate',
            durationMinutes: 15,
            learnerTimeZone: 'Asia/Hebron',
            status: 'PENDING',
            activeKey,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
        assert.equal(error.code, 'P2002');
        return true;
      },
    );
  });

  test('status helpers classify active and terminal states', () => {
    for (const status of PROJECT_HELP_SESSION_ACTIVE_STATUSES) {
      assert.equal(isProjectHelpSessionActiveStatus(status), true);
      assert.equal(isProjectHelpSessionTerminalStatus(status), false);
    }
    for (const status of PROJECT_HELP_SESSION_TERMINAL_STATUSES) {
      assert.equal(isProjectHelpSessionTerminalStatus(status), true);
      assert.equal(isProjectHelpSessionActiveStatus(status), false);
    }
  });

  test('migration schema contains no zoomStartUrl or token fields', () => {
    assert.ok(!migrationSql.includes('zoom_start_url'));
    assert.ok(!migrationSql.toLowerCase().includes('access_token'));
    assert.ok(!migrationSql.toLowerCase().includes('client_secret'));
  });

  test('authorless project cannot enable sessions', async () => {
    const admin = await createUser({ suffix: 'admin-enable', roles: ['ADMIN'] });
    const project = await createProject({ authorId: admin.id });

    await assert.rejects(
      () =>
        upsertAuthorHelpSessionSettings(project.id, admin.id, {
          isEnabled: true,
          allow15Minutes: true,
          allow30Minutes: false,
          weeklyLimit: 3,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('resolveProjectHelpSessionAuthorByProject ignores reviewedBy', () => {
    const author = {
      id: 'project-1',
      createdBy: 'learner-1',
      createdByUser: {
        id: 'learner-1',
        displayName: 'Learner Author',
        profileImageUrl: null,
        accountStatus: 'ACTIVE',
        roles: [{ role: 'LEARNER' }],
      },
    };

    const resolved = resolveProjectHelpSessionAuthorByProject(author);
    assert.equal(resolved.available, true);
    if (!resolved.available) {
      return;
    }
    assert.equal(resolved.authorId, 'learner-1');
  });
});
