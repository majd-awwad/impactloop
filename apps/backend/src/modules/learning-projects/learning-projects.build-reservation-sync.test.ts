import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { cancelReservation } from '../reservations/reservations.service.js';
import { createReservation } from '../reservations/reservations.service.js';
import { declineSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';
import { expireStalePendingReservationsByIds } from '../reservations/reservations.pending-expiry.repository.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';
import {
  getMyProjectBuildById,
  linkBuildItemMaterialById,
  startProjectBuildById,
} from './learning-projects.service.js';
import {
  syncBuildItemFromReservationStatus,
} from './learning-projects.build-reservation-sync.js';

const TEST_MARKER = '[test-learning-project-reservation-sync]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  reservations: [] as string[],
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
      title: `${TEST_MARKER} Reservation sync project`,
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
  const materialCategory = await createMaterialCategory();
  const projectCategory = await createProjectCategory();
  const location = await createLocation();
  const material = await createMaterial({
    ownerId: supplier.id,
    categoryId: materialCategory.id,
    locationId: location.id,
    title: `${TEST_MARKER} Arduino`,
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
    supplier,
    material,
    project,
    build,
    itemId,
  };
}

describe('build reservation terminal sync', () => {
  before(async () => {
    await prisma.$connect();
  });

  after(async () => {
    if (ids.reservations.length > 0) {
      await prisma.reservationStatusHistory.deleteMany({
        where: { reservationId: { in: ids.reservations } },
      });
      await prisma.reservation.deleteMany({
        where: { id: { in: ids.reservations } },
      });
    }
    if (ids.builds.length > 0) {
      await prisma.projectBuildItem.deleteMany({
        where: { buildId: { in: ids.builds } },
      });
      await prisma.projectBuild.deleteMany({
        where: { id: { in: ids.builds } },
      });
    }
    if (ids.projects.length > 0) {
      await prisma.projectRequiredComponent.deleteMany({
        where: { projectId: { in: ids.projects } },
      });
      await prisma.learningProject.deleteMany({
        where: { id: { in: ids.projects } },
      });
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
    await prisma.$disconnect();
  });

  test('cancelled linked reservation clears reservation link but keeps material', async () => {
    const ctx = await setupLinkedBuildItem();
    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(reservation.id);

    await cancelReservation(ctx.learner.id, reservation.id);

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
      select: { linkedMaterialId: true, linkedReservationId: true },
    });

    assert.equal(buildItem?.linkedReservationId, null);
    assert.equal(buildItem?.linkedMaterialId, ctx.material.id);

    const build = await getMyProjectBuildById(ctx.project.id, ctx.learner.id);
    const item = build?.items[0];
    assert.equal(item?.linkedReservation, null);
    assert.equal(item?.isReadyForBuild, false);
    assert.equal(item?.linkedMaterial?.id, ctx.material.id);
  });

  test('rejected linked reservation clears reservation link', async () => {
    const ctx = await setupLinkedBuildItem();
    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(reservation.id);

    await declineSupplierReservation(
      ctx.supplier.id,
      reservation.id,
      { reason: 'Unavailable' },
    );

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });

    assert.equal(buildItem?.linkedReservationId, null);
    assert.equal(buildItem?.linkedMaterialId, ctx.material.id);
  });

  test('lazy expiry clears linked reservation from build item', async () => {
    const ctx = await setupLinkedBuildItem();
    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        createdAt: new Date(Date.now() - 8 * 24 * 3_600_000),
      },
    });

    await expireStalePendingReservationsByIds([reservation.id]);

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });

    assert.equal(buildItem?.linkedReservationId, null);
    assert.equal(buildItem?.linkedMaterialId, ctx.material.id);
  });

  test('awaiting resolution preserves linked reservation', async () => {
    const ctx = await setupLinkedBuildItem();
    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    const outcome = await prisma.$transaction((tx) =>
      syncBuildItemFromReservationStatus(tx, {
        reservationId: reservation.id,
        reservationStatus: 'AWAITING_RESOLUTION',
      }),
    );

    assert.equal(outcome, 'awaiting_resolution');

    const build = await getMyProjectBuildById(ctx.project.id, ctx.learner.id);
    const item = build?.items[0];
    assert.equal(item?.linkedReservation?.status, 'AWAITING_RESOLUTION');
    assert.equal(item?.isReadyForBuild, false);
    assert.match(item?.readinessLabel ?? '', /resolution/i);
  });

  test('completed reservation is preserved', async () => {
    const ctx = await setupLinkedBuildItem();
    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const outcome = await prisma.$transaction((tx) =>
      syncBuildItemFromReservationStatus(tx, {
        reservationId: reservation.id,
        reservationStatus: 'COMPLETED',
      }),
    );

    assert.equal(outcome, 'completed_preserved');

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });

    assert.equal(buildItem?.linkedReservationId, reservation.id);
  });

  test('stale terminal event cannot clear a newer active reservation', async () => {
    const ctx = await setupLinkedBuildItem();
    const first = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(first.id);

    const second = await prisma.reservation.create({
      data: {
        materialId: ctx.material.id,
        requesterId: ctx.learner.id,
        ownerId: ctx.supplier.id,
        quantityRequested: 1,
        status: 'PENDING',
        fulfillmentMethod: 'PICKUP',
      },
    });
    ids.reservations.push(second.id);

    await prisma.projectBuildItem.update({
      where: { id: ctx.itemId },
      data: { linkedReservationId: second.id },
    });

    await prisma.reservation.update({
      where: { id: first.id },
      data: { status: 'CANCELLED' },
    });

    const outcome = await prisma.$transaction((tx) =>
      syncBuildItemFromReservationStatus(tx, {
        reservationId: first.id,
        reservationStatus: 'CANCELLED',
      }),
    );

    assert.equal(outcome, 'already_consistent');

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });

    assert.equal(buildItem?.linkedReservationId, second.id);
  });

  test('repeated terminal synchronization is idempotent', async () => {
    const ctx = await setupLinkedBuildItem();
    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(reservation.id);

    await cancelReservation(ctx.learner.id, reservation.id);

    const outcome = await prisma.$transaction((tx) =>
      syncBuildItemFromReservationStatus(tx, {
        reservationId: reservation.id,
        reservationStatus: 'CANCELLED',
      }),
    );

    assert.equal(outcome, 'already_consistent');
  });

  test('getMyProjectBuildById repairs historical stale terminal links', async () => {
    const ctx = await setupLinkedBuildItem();
    const reservation = await createReservation(
      ctx.learner.id,
      pickupReservationPayload(ctx.material.id, 1, {
        buildItemId: ctx.itemId,
      }),
    );
    ids.reservations.push(reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const build = await getMyProjectBuildById(ctx.project.id, ctx.learner.id);
    const item = build?.items[0];

    assert.equal(item?.linkedReservation, null);
    assert.equal(item?.isReadyForBuild, false);
    assert.equal(item?.linkedMaterial?.id, ctx.material.id);
  });
});
