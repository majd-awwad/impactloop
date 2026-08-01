import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';

import {
  linkBuildItemMaterialById,
  linkBuildItemReservationById,
  startProjectBuildById,
} from './learning-projects.service.js';
import { createReservation } from '../reservations/reservations.service.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';

const TEST_MARKER = '[test-learning-project-reservation-linking]';

type TestIds = {
  users: string[];
  categories: string[];
  materialCategories: string[];
  locations: string[];
  materials: string[];
  projects: string[];
  builds: string[];
  reservations: string[];
};

const ids: TestIds = {
  users: [],
  categories: [],
  materialCategories: [],
  locations: [],
  materials: [],
  projects: [],
  builds: [],
  reservations: [],
};

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function pickupReservationPayload(
  materialId: string,
  quantityRequested: number,
  overrides: Partial<CreateReservationInput> = {},
): CreateReservationInput {
  return {
    materialId,
    quantityRequested,
    fulfillmentMethod: 'PICKUP',
    learnerPreferredPickupWindows: [futurePreferredWindow()],
    ...overrides,
  };
}

async function createLearnerUser(suffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}@impactloop.test`,
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

async function createSupplierUser(suffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier ${suffix}`,
      email: `${TEST_MARKER}-supplier-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
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

async function createMaterialCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Electronics`,
      nameAr: `${TEST_MARKER} إلكترونيات`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.materialCategories.push(category.id);
  return category;
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

async function createLocation() {
  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Ramallah',
      area: 'Al Bireh',
      isApproximate: true,
    },
  });
  ids.locations.push(location.id);
  return location;
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
      description: `${TEST_MARKER} material description`,
      materialType: 'Arduino board',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      pickupAllowed: true,
    },
  });
  ids.materials.push(material.id);
  return material;
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
      title: `${TEST_MARKER} Reservation linking project`,
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
    },
  });
  ids.projects.push(project.id);
  return project;
}

async function setupLinkedBuildItem() {
  const learner = await createLearnerUser('setup');
  const supplier = await createSupplierUser('setup');
  const otherLearner = await createLearnerUser('other');
  const materialCategory = await createMaterialCategory();
  const projectCategory = await createProjectCategory();
  const location = await createLocation();
  const material = await createMaterial({
    ownerId: supplier.id,
    categoryId: materialCategory.id,
    locationId: location.id,
    title: `${TEST_MARKER} Arduino`,
  });
  const otherMaterial = await createMaterial({
    ownerId: supplier.id,
    categoryId: materialCategory.id,
    locationId: location.id,
    title: `${TEST_MARKER} Other board`,
  });
  const project = await createPublishedProject({
    authorId: learner.id,
    projectCategoryId: projectCategory.id,
    materialCategoryId: materialCategory.id,
  });
  const build = await startProjectBuildById(project.id, learner.id);
  ids.builds.push(build.id);
  const itemId = build.items[0]!.id;

  await linkBuildItemMaterialById(project.id, learner.id, itemId, material.id);

  return {
    learner,
    otherLearner,
    supplier,
    project,
    build,
    itemId,
    material,
    otherMaterial,
  };
}

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.reservations.length > 0) {
    await prisma.reservation.deleteMany({
      where: { id: { in: ids.reservations } },
    });
  }

  if (ids.builds.length > 0) {
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
  }

  if (ids.projects.length > 0) {
    await prisma.projectBuild.deleteMany({
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

  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }

  if (ids.materialCategories.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.materialCategories } },
    });
  }

  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('learning project build reservation linking', () => {
  test('create reservation with valid buildItemId links ProjectBuildItem', async () => {
    const ctx = await setupLinkedBuildItem();

    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(reservation.id);

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
      select: { linkedReservationId: true },
    });

    assert.equal(buildItem?.linkedReservationId, reservation.id);
    assert.equal(reservation.status, 'PENDING');
  });

  test('buildItemId owned by another learner fails with NOT_FOUND', async () => {
    const ctx = await setupLinkedBuildItem();

    await assert.rejects(
      () =>
        createReservation(
          ctx.otherLearner.id,
          pickupReservationPayload(ctx.material.id, 1, {
            buildItemId: ctx.itemId,
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'NOT_FOUND');
        return true;
      },
    );
  });

  test('materialId mismatch fails with BUILD_ITEM_MATERIAL_MISMATCH', async () => {
    const ctx = await setupLinkedBuildItem();

    await assert.rejects(
      () =>
        createReservation(
          ctx.learner.id,
          pickupReservationPayload(ctx.otherMaterial.id, 1, {
            buildItemId: ctx.itemId,
          }),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'BUILD_ITEM_MATERIAL_MISMATCH');
        return true;
      },
    );
  });

  test('active linked reservation conflict fails with ACTIVE_BUILD_ITEM_RESERVATION', async () => {
    const ctx = await setupLinkedBuildItem();

    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(reservation.id);

    const secondReservation = await prisma.reservation.create({
      data: {
        materialId: ctx.material.id,
        requesterId: ctx.learner.id,
        ownerId: ctx.supplier.id,
        quantityRequested: 1,
        status: 'PENDING',
        fulfillmentMethod: 'PICKUP',
      },
    });
    ids.reservations.push(secondReservation.id);

    await assert.rejects(
      () =>
        linkBuildItemReservationById(
          ctx.project.id,
          ctx.learner.id,
          ctx.itemId,
          secondReservation.id,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'ACTIVE_BUILD_ITEM_RESERVATION');
        return true;
      },
    );
  });

  test('terminal linked reservation can be replaced on new create', async () => {
    const ctx = await setupLinkedBuildItem();

    const first = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(first.id);

    await prisma.reservation.update({
      where: { id: first.id },
      data: { status: 'CANCELLED' },
    });

    const second = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(second.id);

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
      select: { linkedReservationId: true },
    });

    assert.equal(buildItem?.linkedReservationId, second.id);
  });

  test('fallback link-reservation endpoint links owned reservation', async () => {
    const ctx = await setupLinkedBuildItem();

    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1),
    );
    ids.reservations.push(reservation.id);

    const build = await linkBuildItemReservationById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      reservation.id,
    );

    assert.equal(build.items[0]?.linkedReservation?.id, reservation.id);

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
      select: { linkedReservationId: true },
    });

    assert.equal(buildItem?.linkedReservationId, reservation.id);
  });

  test('fallback rejects wrong learner reservation', async () => {
    const ctx = await setupLinkedBuildItem();

    const reservation = await createReservation(
      ctx.otherLearner.id,
      pickupReservationPayload(ctx.material.id, 1),
    );
    ids.reservations.push(reservation.id);

    await assert.rejects(
      () =>
        linkBuildItemReservationById(
          ctx.project.id,
          ctx.learner.id,
          ctx.itemId,
          reservation.id,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'NOT_FOUND');
        return true;
      },
    );
  });

  test('fallback rejects reservation with mismatched material', async () => {
    const ctx = await setupLinkedBuildItem();

    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.otherMaterial.id, 1),
    );
    ids.reservations.push(reservation.id);

    await assert.rejects(
      () =>
        linkBuildItemReservationById(
          ctx.project.id,
          ctx.learner.id,
          ctx.itemId,
          reservation.id,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'BUILD_ITEM_MATERIAL_MISMATCH');
        return true;
      },
    );
  });
});
