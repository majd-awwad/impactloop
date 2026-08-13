import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import {
  createLearnerMaterialRequest,
  fulfillRequestFromCompletedReservation,
} from '../learner-material-requests/learner-material-requests.service.js';
import { createReservation } from '../reservations/reservations.service.js';
import { suggestMaterialForRequest } from '../supplier-material-requests/supplier-material-requests.service.js';
import {
  completeProjectBuildStepById,
  getLearningProjects,
  getMyProjectBuildById,
  linkBuildItemMaterialById,
  startProjectBuildById,
} from './learning-projects.service.js';

const TEST_MARKER = '[test-learning-project-core-journey]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  requests: [] as string[],
  matches: [] as string[],
  reservations: [] as string[],
};

async function createLearnerUser(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`,
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

async function createSupplierUser(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier ${suffix}`,
      email: `${TEST_MARKER}-supplier-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: `${TEST_MARKER} Supplier ${suffix}`,
          verificationStatus: 'APPROVED',
        },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createPublishedProjectWithSteps(input: {
  authorId: string;
  projectCategoryId: string;
  materialCategoryId: string;
}) {
  const project = await prisma.learningProject.create({
    data: {
      categoryId: input.projectCategoryId,
      createdBy: input.authorId,
      title: `${TEST_MARKER} Core journey project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName: 'Arduino Uno board',
            materialType: 'Arduino board',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: input.materialCategoryId,
            searchKeywords: ['arduino'],
          },
        ],
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            title: 'Wire the board',
            description: 'Connect power',
            reviewStatus: 'ACCEPTED',
          },
          {
            stepNumber: 2,
            title: 'Upload firmware',
            description: 'Flash the sketch',
            reviewStatus: 'ACCEPTED',
          },
        ],
      },
    },
    include: { requiredComponents: true, steps: true },
  });
  ids.projects.push(project.id);
  return project;
}

async function createMaterial(input: {
  ownerId: string;
  categoryId: string;
  locationId: string;
  title: string;
}) {
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: input.ownerId },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      supplierProfileId: supplierProfile?.id,
      categoryId: input.categoryId,
      locationId: input.locationId,
      title: input.title,
      description: `${TEST_MARKER} description`,
      materialType: 'Arduino board',
      quantity: 5,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });
  ids.materials.push(material.id);
  return material;
}

after(async () => {
  if (ids.reservations.length > 0) {
    await prisma.reservation.deleteMany({ where: { id: { in: ids.reservations } } });
  }
  if (ids.matches.length > 0) {
    await prisma.learnerMaterialRequestMatch.deleteMany({
      where: { id: { in: ids.matches } },
    });
  }
  if (ids.requests.length > 0) {
    await prisma.learnerMaterialRequest.deleteMany({
      where: { id: { in: ids.requests } },
    });
  }
  if (ids.builds.length > 0) {
    await prisma.projectBuildLearningSession.deleteMany({
      where: { buildId: { in: ids.builds } },
    });
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }
  if (ids.projects.length > 0) {
    await prisma.projectLearningQuestion.deleteMany({
      where: { pack: { projectId: { in: ids.projects } } },
    });
    await prisma.projectLearningPack.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }
  if (ids.materials.length > 0) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }
  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }
  if (ids.materialCategories.length > 0 || ids.categories.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: [...ids.materialCategories, ...ids.categories] } },
    });
  }
  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('learning hub core learner journey', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
  });

  test('published project browse → build → request → reserve → acquire → complete build', async () => {
    const author = await createLearnerUser('journey-author');
    const learner = await createLearnerUser('journey');
    const supplier = await createSupplierUser('journey');
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
    const location = await prisma.location.create({
      data: {
        country: 'PS',
        city: 'Ramallah',
        area: 'Al Bireh',
        isApproximate: true,
      },
    });
    ids.locations.push(location.id);

    const project = await createPublishedProjectWithSteps({
      authorId: author.id,
      projectCategoryId: projectCategory.id,
      materialCategoryId: materialCategory.id,
    });

    const browse = await getLearningProjects({ page: 1, limit: 20 });
    assert.ok(browse.items.some((entry) => entry.id === project.id));

    const build = await startProjectBuildById(project.id, learner.id);
    ids.builds.push(build!.id);
    const itemId = build!.items[0]!.id;

    const request = await createLearnerMaterialRequest(learner.id, {
      requestedItemName: `${TEST_MARKER} Arduino request`,
      categoryId: materialCategory.id,
      description: null,
      quantity: 1,
      unit: 'piece',
      alternativesAllowed: true,
      locationCity: 'Ramallah',
      locationArea: null,
      projectId: project.id,
      projectBuildId: build!.id,
      projectBuildItemId: itemId,
    });
    ids.requests.push(request.id);

    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: materialCategory.id,
      locationId: location.id,
      title: `${TEST_MARKER} Arduino Uno`,
    });

    await suggestMaterialForRequest(supplier.id, request.id, {
      materialId: material.id,
      confirmWeakMatch: false,
    });

    const match = await prisma.learnerMaterialRequestMatch.findFirstOrThrow({
      where: {
        materialRequestId: request.id,
        materialId: material.id,
      },
    });
    ids.matches.push(match.id);

    await linkBuildItemMaterialById(project.id, learner.id, itemId, material.id);

    const reservation = await createReservation(learner.id, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      materialRequestMatchId: match.id,
      buildItemId: itemId,
      learnerPreferredPickupWindows: [
        {
          start: new Date(Date.now() + 24 * 3_600_000).toISOString(),
          end: new Date(Date.now() + 26 * 3_600_000).toISOString(),
        },
      ],
    });
    ids.reservations.push(reservation.id);

    const activeBuild = await getMyProjectBuildById(project.id, learner.id);
    const activeItem = activeBuild?.items.find((entry) => entry.id === itemId);
    assert.equal(activeItem?.linkedMaterial?.id, material.id);
    assert.equal(activeItem?.linkedReservation?.id, reservation.id);
    assert.notEqual(activeItem?.linkedReservation?.status, 'COMPLETED');
    assert.equal(activeItem?.isReadyForBuild, false);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await fulfillRequestFromCompletedReservation(reservation.id);

    const acquiredBuild = await getMyProjectBuildById(project.id, learner.id);
    const acquiredItem = acquiredBuild?.items.find((entry) => entry.id === itemId);
    assert.equal(acquiredItem?.acquisitionState, 'acquired');
    assert.equal(acquiredItem?.allocationResult, 'sufficient');
    assert.equal(acquiredItem?.isReadyForBuild, true);
    assert.equal(acquiredItem?.linkedReservation?.status, 'COMPLETED');
    assert.ok(acquiredBuild!.stepProgress.steps.some((step) => step.state !== 'LOCKED'));

    const step1Id = project.steps[0]!.id;
    const step2Id = project.steps[1]!.id;

    const afterStep1 = await completeProjectBuildStepById(
      project.id,
      learner.id,
      step1Id,
    );
    assert.equal(afterStep1.stepProgress.steps[0]?.state, 'COMPLETED');

    const finished = await completeProjectBuildStepById(
      project.id,
      learner.id,
      step2Id,
    );
    assert.equal(finished.status, 'COMPLETED');
    assert.equal(finished.stepProgress.percent, 100);
    assert.equal(finished.stepProgress.nextAction, 'BUILD_COMPLETED');
  });
});
