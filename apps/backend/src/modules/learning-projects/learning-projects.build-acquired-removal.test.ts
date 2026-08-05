import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { createLearnerMaterialRequest } from '../learner-material-requests/learner-material-requests.service.js';
import { fulfillRequestFromCompletedReservation } from '../learner-material-requests/learner-material-requests.service.js';
import { getMaterialById } from '../materials/materials.service.js';
import {
  getMyProjectBuildById,
  removeAcquiredMaterialFromBuildItemById,
  startProjectBuildById,
} from './learning-projects.service.js';

const TEST_MARKER = '[test-learning-project-acquired-removal]';

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

async function createProjectCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} project category ${Date.now()}`,
      nameAr: `${TEST_MARKER} مشروع`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
}

async function createPublishedProject(input: {
  authorId: string;
  projectCategoryId: string;
  materialCategoryId: string;
}) {
  const project = await prisma.learningProject.create({
    data: {
      categoryId: input.projectCategoryId,
      createdBy: input.authorId,
      title: `${TEST_MARKER} project`,
      shortDescription: `${TEST_MARKER} short`,
      description: `${TEST_MARKER} description`,
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      requiredComponents: {
        create: [
          {
            componentName: 'Plastic crate',
            materialType: 'Storage',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            isRequired: true,
            categoryId: input.materialCategoryId,
            searchKeywords: ['crate'],
          },
        ],
      },
    },
    include: { requiredComponents: true },
  });
  ids.projects.push(project.id);
  return project;
}

async function setupFulfilledBuildItem() {
  const learner = await createLearnerUser('learner');
  const supplier = await createSupplierUser('supplier');
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} material category ${Date.now()}`,
      nameAr: `${TEST_MARKER} فئة`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.materialCategories.push(category.id);
  const projectCategory = await createProjectCategory();

  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Ramallah',
      area: 'Al Bireh',
      isApproximate: true,
    },
  });
  ids.locations.push(location.id);

  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: supplier.id },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: supplier.id,
      supplierProfileId: supplierProfile?.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} Sorted Plastic Bottle Caps Bag`,
      description: `${TEST_MARKER} description`,
      materialType: 'Storage',
      quantity: 0,
      unit: 'bags',
      status: 'REUSED',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      isFree: true,
      currency: 'NIS',
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });
  ids.materials.push(material.id);

  const project = await createPublishedProject({
    authorId: learner.id,
    projectCategoryId: projectCategory.id,
    materialCategoryId: category.id,
  });
  const build = await startProjectBuildById(project.id, learner.id);
  ids.builds.push(build!.id);
  const itemId = build!.items[0]!.id;

  const request = await createLearnerMaterialRequest(learner.id, {
    requestedItemName: `${TEST_MARKER} crate request`,
    categoryId: category.id,
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

  const match = await prisma.learnerMaterialRequestMatch.create({
    data: {
      materialRequest: { connect: { id: request.id } },
      material: { connect: { id: material.id } },
      supplierUser: { connect: { id: supplier.id } },
      status: 'SUGGESTED',
    },
  });
  ids.matches.push(match.id);

  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      quantityRequested: 11,
      status: 'COMPLETED',
      fulfillmentMethod: 'PICKUP',
      completedAt: new Date(),
    },
  });
  ids.reservations.push(reservation.id);

  await prisma.learnerMaterialRequestMatch.update({
    where: { id: match.id },
    data: { reservationId: reservation.id },
  });

  await fulfillRequestFromCompletedReservation(reservation.id);

  await prisma.projectBuildItem.update({
    where: { id: itemId },
    data: {
      linkedMaterialId: material.id,
      linkedReservationId: reservation.id,
      linkedMaterialAt: new Date(),
    },
  });

  return {
    learner,
    supplier,
    project,
    build: build!,
    itemId,
    material,
    request,
    match,
    reservation,
  };
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
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }
  if (ids.projects.length > 0) {
    await prisma.learningProject.deleteMany({ where: { id: { in: ids.projects } } });
  }
  if (ids.materials.length > 0) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }
  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }
  if (ids.materialCategories.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.materialCategories } },
    });
  }
  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('remove acquired material from build item', () => {
  before(() => {
    process.env.NODE_ENV = 'test';
  });

  test('clears build allocation without mutating reservation or material request', async () => {
    const ctx = await setupFulfilledBuildItem();

    const beforeReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: ctx.reservation.id },
    });
    const beforeRequest = await prisma.learnerMaterialRequest.findUniqueOrThrow({
      where: { id: ctx.request.id },
    });

    const result = await removeAcquiredMaterialFromBuildItemById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      {
        materialId: ctx.material.id,
        reservationId: ctx.reservation.id,
      },
    );

    assert.equal(result.outcome, 'removed');
    const item = await prisma.projectBuildItem.findUniqueOrThrow({
      where: { id: ctx.itemId },
    });
    assert.equal(item.linkedMaterialId, null);
    assert.equal(item.linkedReservationId, null);
    assert.equal(item.linkedMaterialAt, null);
    assert.equal(item.dismissedAcquiredReservationId, ctx.reservation.id);

    const afterReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: ctx.reservation.id },
    });
    const afterRequest = await prisma.learnerMaterialRequest.findUniqueOrThrow({
      where: { id: ctx.request.id },
    });
    assert.equal(afterReservation.status, beforeReservation.status);
    assert.equal(afterRequest.status, beforeRequest.status);

    const refreshedBuild = await getMyProjectBuildById(
      ctx.project.id,
      ctx.learner.id,
    );
    const refreshedItem = refreshedBuild?.items.find(
      (entry) => entry.id === ctx.itemId,
    );
    assert.equal(refreshedItem?.linkedMaterial, null);
    assert.equal(refreshedItem?.linkedReservation, null);
    assert.equal(refreshedItem?.isReadyForBuild, false);
  });

  test('repeated removal is idempotent and stale links are rejected', async () => {
    const ctx = await setupFulfilledBuildItem();

    await removeAcquiredMaterialFromBuildItemById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      {
        materialId: ctx.material.id,
        reservationId: ctx.reservation.id,
      },
    );

    const second = await removeAcquiredMaterialFromBuildItemById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      {
        materialId: ctx.material.id,
        reservationId: ctx.reservation.id,
      },
    );
    assert.equal(second.outcome, 'already_removed');

    await prisma.projectBuildItem.update({
      where: { id: ctx.itemId },
      data: {
        linkedMaterialId: ctx.material.id,
        linkedReservationId: ctx.reservation.id,
        linkedMaterialAt: new Date(),
      },
    });

    const stale = await removeAcquiredMaterialFromBuildItemById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      {
        materialId: 'stale-material-id',
        reservationId: ctx.reservation.id,
      },
    );
    assert.equal(stale.outcome, 'stale_link');
  });

  test('acquired material access remains after build links are cleared', async () => {
    const ctx = await setupFulfilledBuildItem();

    await removeAcquiredMaterialFromBuildItemById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      {
        materialId: ctx.material.id,
        reservationId: ctx.reservation.id,
      },
    );

    const detail = await getMaterialById(ctx.material.id, {
      sub: ctx.learner.id,
      roles: ['LEARNER'],
    });

    assert.equal((detail as { isAcquiredView?: boolean }).isAcquiredView, true);
    assert.equal((detail as { acquiredQuantity?: number }).acquiredQuantity, 11);
  });

  test('archived build is not mutated', async () => {
    const ctx = await setupFulfilledBuildItem();

    await prisma.projectBuild.update({
      where: { id: ctx.build.id },
      data: { status: 'ARCHIVED' },
    });

    const result = await removeAcquiredMaterialFromBuildItemById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      {
        materialId: ctx.material.id,
        reservationId: ctx.reservation.id,
      },
    );

    assert.equal(result.outcome, 'archived_build');
    const item = await prisma.projectBuildItem.findUniqueOrThrow({
      where: { id: ctx.itemId },
    });
    assert.equal(item.linkedMaterialId, ctx.material.id);
    assert.equal(item.linkedReservationId, ctx.reservation.id);
  });
});
