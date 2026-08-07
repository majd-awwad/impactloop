import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'project-help-session-http-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'project-help-session-http-refresh-secret';

const TEST_MARKER = '[test-project-help-session-http]';

let baseUrl = '';
let server: Server | null = null;
let prisma: typeof import('../../database/prisma.js').prisma;
let signAccessToken: typeof import('../../utils/jwt.js').signAccessToken;
let hashPassword: typeof import('../../utils/password.js').hashPassword;

const ids = {
  users: [] as string[],
  categories: [] as string[],
  projects: [] as string[],
};

const tokenFor = (userId: string, roles: string[]) =>
  signAccessToken({ sub: userId, roles });

async function createLearner(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${suffix}`,
      email: `${TEST_MARKER}-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
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

async function createProject(authorId: string) {
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
      createdBy: authorId,
      title: `${TEST_MARKER} Project`,
      shortDescription: 'Short',
      description: 'Description',
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      submittedAt: new Date(),
    },
  });
  ids.projects.push(project.id);
  return project;
}

before(async () => {
  ({ prisma } = await import('../../database/prisma.js'));
  ({ signAccessToken } = await import('../../utils/jwt.js'));
  ({ hashPassword } = await import('../../utils/password.js'));
  const { app } = await import('../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (ids.projects.length > 0) {
    await prisma.projectHelpSessionOffering.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }
  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  if (ids.users.length > 0) {
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.learnerProfile.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('project help session HTTP', () => {
  test('private endpoints return Cache-Control no-store', async () => {
    const author = await createLearner('author');
    const project = await createProject(author.id);
    const token = tokenFor(author.id, ['LEARNER']);

    const availability = await fetch(
      `${baseUrl}/api/learning-projects/${project.id}/help-sessions/availability`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(availability.status, 200);
    assert.match(availability.headers.get('cache-control') ?? '', /no-store/);

    const settings = await fetch(
      `${baseUrl}/api/learning-projects/mine/${project.id}/help-sessions/settings`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(settings.status, 200);
    assert.match(settings.headers.get('cache-control') ?? '', /no-store/);
  });
});
