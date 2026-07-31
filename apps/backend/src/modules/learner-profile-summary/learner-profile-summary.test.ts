import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';
import type { Server } from 'node:http';
import { createApp } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import type { ReservationStatus } from '../../generated/prisma/client.js';
import { signAccessToken } from '../../utils/jwt.js';

const marker = `profile-summary-${Date.now()}`;
const ids = {
  users: [] as string[],
  projects: [] as string[],
  locations: [] as string[],
  categoryId: '',
  materialId: '',
  hiddenMaterialId: '',
};

let learnerId = '';
let emptyLearnerId = '';
let nonLearnerId = '';
let expectedContinueProjectId = '';
let server: Server | null = null;
let serverUrl = '';

before(async () => {
  const category = await prisma.category.create({
    data: {
      nameEn: `${marker} category`,
      nameAr: `${marker} category ar`,
      categoryType: 'BOTH',
    },
  });
  ids.categoryId = category.id;

  const learner = await prisma.user.create({
    data: {
      displayName: 'Majd Learner',
      email: `${marker}-learner@impactloop.test`,
      phone: '+970599000001',
      passwordHash: 'test-hash',
      accountStatus: 'ACTIVE',
      activeRole: 'SUPPLIER',
      roles: {
        create: [
          { role: 'LEARNER', isPrimary: true },
          { role: 'SUPPLIER', isPrimary: false },
        ],
      },
      learnerProfile: {
        create: {
          learnerType: 'Student',
          skillLevel: 'Intermediate',
          interests: ['Robotics', '  '],
          bio: 'Building practical projects.',
        },
      },
    },
  });
  learnerId = learner.id;
  ids.users.push(learner.id);

  const emptyLearner = await prisma.user.create({
    data: {
      displayName: '   ',
      email: `${marker}-empty-learner@impactloop.test`,
      passwordHash: 'test-hash',
      accountStatus: 'ACTIVE',
      roles: { create: { role: 'LEARNER', isPrimary: true } },
    },
  });
  emptyLearnerId = emptyLearner.id;
  ids.users.push(emptyLearner.id);

  const nonLearner = await prisma.user.create({
    data: {
      displayName: 'Supplier User',
      email: `${marker}-supplier@impactloop.test`,
      passwordHash: 'test-hash',
      accountStatus: 'ACTIVE',
      roles: { create: { role: 'SUPPLIER', isPrimary: true } },
    },
  });
  nonLearnerId = nonLearner.id;
  ids.users.push(nonLearner.id);

  const savedLocation = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Nablus',
      area: 'Rafidia',
      locationType: 'USER_SAVED',
      visibility: 'PRIVATE',
      isApproximate: false,
    },
  });
  const materialLocation = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Nablus',
      locationType: 'MATERIAL',
      visibility: 'APPROXIMATE',
    },
  });
  ids.locations.push(savedLocation.id, materialLocation.id);
  await prisma.userSavedLocation.create({
    data: {
      userId: learner.id,
      locationId: savedLocation.id,
      label: 'Campus',
      isDefault: false,
    },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: nonLearner.id,
      categoryId: category.id,
      locationId: materialLocation.id,
      title: `${marker} material`,
      description: 'Profile summary reservation fixture.',
      materialType: 'Electronics',
      quantity: 100,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
    },
  });
  ids.materialId = material.id;
  await prisma.materialLike.create({
    data: { materialId: material.id, userId: learner.id },
  });
  const hiddenMaterial = await prisma.material.create({
    data: {
      ownerId: nonLearner.id,
      categoryId: category.id,
      locationId: materialLocation.id,
      title: `${marker} unavailable material`,
      description: 'Historical like that must remain private.',
      materialType: 'Electronics',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'UNAVAILABLE',
    },
  });
  ids.hiddenMaterialId = hiddenMaterial.id;
  await prisma.materialLike.create({
    data: { materialId: hiddenMaterial.id, userId: learner.id },
  });

  const statuses: ReservationStatus[] = [
    'PENDING',
    'AWAITING_LEARNER_CONFIRMATION',
    'AWAITING_SUPPLIER_CONFIRMATION',
    'ACCEPTED',
    'AWAITING_RESOLUTION',
    'COMPLETED',
    'REJECTED',
    'CANCELLED',
    'EXPIRED',
    'NO_SHOW',
    'FULFILLMENT_FAILED',
  ];
  await prisma.reservation.createMany({
    data: statuses.map((status) => ({
      materialId: material.id,
      requesterId: learner.id,
      ownerId: nonLearner.id,
      quantityRequested: 1,
      status,
    })),
  });
  await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: nonLearner.id,
      ownerId: learner.id,
      quantityRequested: 1,
      status: 'PENDING',
    },
  });

  const createProject = async (name: string, options?: { hidden?: boolean }) => {
    const project = await prisma.learningProject.create({
      data: {
        categoryId: category.id,
        createdBy: nonLearner.id,
        title: `${marker} ${name}`,
        shortDescription: `${name} summary`,
        description: `${name} description`,
        difficulty: 'BEGINNER',
        status: 'PUBLISHED',
        hiddenAt: options?.hidden ? new Date() : null,
      },
    });
    ids.projects.push(project.id);
    return project;
  };

  const oldProject = await createProject('old active');
  const latestProject = await createProject('latest active');
  expectedContinueProjectId = latestProject.id;
  const completedProject = await createProject('completed');
  const archivedBuildProject = await createProject('archived build');
  const readyProject = await createProject('fully ready');
  const hiddenProject = await createProject('hidden', { hidden: true });

  await prisma.projectSave.createMany({
    data: [oldProject, latestProject, hiddenProject].map((project) => ({
      projectId: project.id,
      userId: learner.id,
    })),
  });
  await prisma.projectFollow.createMany({
    data: [latestProject, hiddenProject].map((project) => ({
      projectId: project.id,
      userId: learner.id,
    })),
  });

  const oldBuild = await prisma.projectBuild.create({
    data: {
      projectId: oldProject.id,
      learnerId: learner.id,
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-07-27T00:00:00.000Z'),
      updatedAt: new Date('2026-07-28T00:00:00.000Z'),
    },
  });
  assert.ok(oldBuild.id);

  const latestBuild = await prisma.projectBuild.create({
    data: {
      projectId: latestProject.id,
      learnerId: learner.id,
      status: 'IN_PROGRESS',
      startedAt: new Date('2026-07-28T00:00:00.000Z'),
      updatedAt: new Date('2026-07-29T00:00:00.000Z'),
    },
  });
  const steps = await Promise.all(
    [1, 2, 3].map((stepNumber) =>
      prisma.projectStep.create({
        data: {
          projectId: latestProject.id,
          stepNumber,
          title: `Step ${stepNumber}`,
          description: `Do step ${stepNumber}`,
          reviewStatus: 'ACCEPTED',
        },
      }),
    ),
  );
  await prisma.projectBuildStepProgress.createMany({
    data: steps.slice(0, 2).map((step) => ({
      buildId: latestBuild.id,
      projectStepId: step.id,
      completedAt: new Date('2026-07-29T00:00:00.000Z'),
    })),
  });

  await prisma.projectBuild.createMany({
    data: [
      {
        projectId: completedProject.id,
        learnerId: learner.id,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
      {
        projectId: archivedBuildProject.id,
        learnerId: learner.id,
        status: 'ARCHIVED',
      },
      {
        projectId: hiddenProject.id,
        learnerId: learner.id,
        status: 'IN_PROGRESS',
      },
      {
        projectId: oldProject.id,
        learnerId: nonLearner.id,
        status: 'IN_PROGRESS',
      },
    ],
  });

  const readyBuild = await prisma.projectBuild.create({
    data: {
      projectId: readyProject.id,
      learnerId: learner.id,
      status: 'IN_PROGRESS',
    },
  });
  const readyComponent = await prisma.projectRequiredComponent.create({
    data: {
      projectId: readyProject.id,
      categoryId: category.id,
      componentName: 'Ready sensor',
      materialType: 'Sensor',
      quantity: 1,
      unit: 'piece',
      componentRole: 'REQUIRED_MATERIAL',
      reviewStatus: 'ACCEPTED',
    },
  });
  await prisma.projectBuildItem.create({
    data: {
      buildId: readyBuild.id,
      requiredComponentId: readyComponent.id,
      status: 'AVAILABLE',
    },
  });

  const app = createApp({ recommendationEventOrigin: 'TEST' });
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server!.once('listening', resolve));
  const address = server.address() as AddressInfo;
  serverUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  const runningServer = server;
  if (runningServer) {
    await new Promise<void>((resolve, reject) =>
      runningServer.close((error) => (error ? reject(error) : resolve())),
    );
  }
  if (ids.projects.length > 0) {
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
    });
  }
  if (ids.materialId) {
    await prisma.materialLike.deleteMany({
      where: {
        materialId: { in: [ids.materialId, ids.hiddenMaterialId] },
      },
    });
    await prisma.reservation.deleteMany({
      where: { materialId: ids.materialId },
    });
    await prisma.material.deleteMany({ where: { id: ids.materialId } });
  }
  if (ids.hiddenMaterialId) {
    await prisma.material.deleteMany({ where: { id: ids.hiddenMaterialId } });
  }
  await prisma.userSavedLocation.deleteMany({
    where: { userId: { in: ids.users } },
  });
  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }
  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  if (ids.categoryId) {
    await prisma.category.deleteMany({ where: { id: ids.categoryId } });
  }
});

describe('GET /api/learner/profile-summary', () => {
  test('returns the truthful learner-owned summary with active portal independence', async () => {
    const response = await fetch(`${serverUrl}/api/learner/profile-summary`, {
      headers: {
        Authorization: `Bearer ${signAccessToken({
          sub: learnerId,
          roles: ['LEARNER', 'SUPPLIER'],
        })}`,
      },
    });
    const body = await response.json() as {
      success: boolean;
      data: Record<string, any>;
    };

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(body.success, true);
    assert.deepEqual(body.data.profileCompletion, {
      completedSteps: 6,
      totalSteps: 6,
      percentage: 100,
      missingSteps: [],
    });
    assert.deepEqual(body.data.journey, {
      activeReservationsCount: 5,
      completedReservationsCount: 1,
      likedMaterialsCount: 1,
      savedProjectsCount: 2,
      followedProjectsCount: 1,
      activeBuildsCount: 2,
      completedBuildsCount: 1,
    });
    assert.equal(body.data.continueProject.projectId, expectedContinueProjectId);
    assert.equal(body.data.continueProject.imageUrl, null);
    assert.deepEqual(body.data.continueProject.progress, {
      completedSteps: 2,
      totalSteps: 3,
      percentage: 67,
    });
    assert.equal('score' in body.data.continueProject, false);
    assert.equal('materials' in body.data, false);
  });

  test('rejects signed-out and non-learner callers', async () => {
    const signedOut = await fetch(`${serverUrl}/api/learner/profile-summary`);
    assert.equal(signedOut.status, 401);

    const nonLearner = await fetch(`${serverUrl}/api/learner/profile-summary`, {
      headers: {
        Authorization: `Bearer ${signAccessToken({
          sub: nonLearnerId,
          roles: ['SUPPLIER'],
        })}`,
      },
    });
    assert.equal(nonLearner.status, 403);
  });

  test('returns explicit empty data for a learner without a profile or activity', async () => {
    const response = await fetch(`${serverUrl}/api/learner/profile-summary`, {
      headers: {
        Authorization: `Bearer ${signAccessToken({
          sub: emptyLearnerId,
          roles: ['LEARNER'],
        })}`,
      },
    });
    const body = (await response.json()) as {
      data: Record<string, any>;
    };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.profileCompletion, {
      completedSteps: 0,
      totalSteps: 6,
      percentage: 0,
      missingSteps: [
        'display_name',
        'phone',
        'learning_basics',
        'interests',
        'bio',
        'saved_location',
      ],
    });
    assert.deepEqual(body.data.journey, {
      activeReservationsCount: 0,
      completedReservationsCount: 0,
      likedMaterialsCount: 0,
      savedProjectsCount: 0,
      followedProjectsCount: 0,
      activeBuildsCount: 0,
      completedBuildsCount: 0,
    });
    assert.equal(body.data.continueProject, null);
  });
});

describe('GET /api/materials/me/liked', () => {
  test('returns the acting learner collection with private caching', async () => {
    const response = await fetch(
      `${serverUrl}/api/materials/me/liked?page=1&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${signAccessToken({
            sub: learnerId,
            roles: ['LEARNER', 'SUPPLIER'],
          })}`,
        },
      },
    );
    const body = (await response.json()) as {
      success: boolean;
      data: Record<string, any>;
    };

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].material.id, ids.materialId);
    assert.equal(body.data.items[0].material.isLiked, true);
    assert.deepEqual(body.data.pagination, {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  test('rejects signed-out and non-learner callers', async () => {
    const signedOut = await fetch(`${serverUrl}/api/materials/me/liked`);
    assert.equal(signedOut.status, 401);

    const nonLearner = await fetch(`${serverUrl}/api/materials/me/liked`, {
      headers: {
        Authorization: `Bearer ${signAccessToken({
          sub: nonLearnerId,
          roles: ['SUPPLIER'],
        })}`,
      },
    });
    assert.equal(nonLearner.status, 403);
  });

  test('does not return another learner collection', async () => {
    const response = await fetch(`${serverUrl}/api/materials/me/liked`, {
      headers: {
        Authorization: `Bearer ${signAccessToken({
          sub: emptyLearnerId,
          roles: ['LEARNER'],
        })}`,
      },
    });
    const body = (await response.json()) as { data: Record<string, any> };

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.items, []);
    assert.equal(body.data.pagination.total, 0);
  });
});
