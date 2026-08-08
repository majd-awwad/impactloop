import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { createReservation } from '../reservations/reservations.service.js';
import {
  createLearnerMaterialRequest,
  fulfillRequestFromCompletedReservation,
  getLearnerMaterialRequest,
} from '../learner-material-requests/learner-material-requests.service.js';
import { createNotificationIfMissing } from '../notifications/notifications.repository.js';
import { completeSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';
import { acceptSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';
import {
  updateDriverDeliveryStatus,
} from '../driver/driver.service.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import {
  activeConfirmedDeliveryWindowUpdate,
  activePickupWindowReservationUpdate,
} from '../../test-utils/handover-test-windows.js';
import {
  getMyProjectBuildById,
  linkBuildItemMaterialById,
  startProjectBuildById,
} from './learning-projects.service.js';

const TEST_MARKER = '[test-learning-project-mr-build-sync]';

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
  notifications: [] as string[],
  deliveries: [] as string[],
};

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
      title: `${TEST_MARKER} MR build sync project`,
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

async function createDriverUser() {
  const passwordHash = await hashPassword('TestPassword123!');
  const phone = `+97059${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')}`;
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Driver`,
      email: `${TEST_MARKER}-driver-${Date.now()}@impactloop.test`,
      passwordHash,
      phone,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
      driverProfile: {
        create: {
          displayName: `${TEST_MARKER} Driver`,
          phone,
          city: 'Ramallah',
          area: TEST_MARKER,
          transportationType: 'BICYCLE',
          vehicleType: 'BICYCLE',
          status: 'ACTIVE',
          availability: 'AVAILABLE',
        },
      },
    },
    include: { driverProfile: true },
  });
  ids.users.push(user.id);
  return user;
}

async function setupBuildLinkedMaterialRequest() {
  const learner = await createLearnerUser('linked');
  const supplier = await createSupplierUser('linked');
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
    projectBuildId: build.id,
    projectBuildItemId: itemId,
  });
  ids.requests.push(request.id);

  return {
    learner,
    otherLearner,
    supplier,
    project,
    build,
    itemId,
    material,
    otherMaterial,
    request,
    materialCategory,
  };
}

async function createCompletedReservationForMatch(input: {
  learnerId: string;
  supplierId: string;
  materialId: string;
  requestId: string;
  matchId: string;
}) {
  const reservation = await createReservation(input.learnerId, {
    materialId: input.materialId,
    quantityRequested: 1,
    fulfillmentMethod: 'PICKUP',
    materialRequestMatchId: input.matchId,
    learnerPreferredPickupWindows: [
      {
        start: new Date(Date.now() + 24 * 3_600_000).toISOString(),
        end: new Date(Date.now() + 26 * 3_600_000).toISOString(),
      },
    ],
  });
  ids.reservations.push(reservation.id);

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  return reservation;
}

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.notifications.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: ids.notifications } },
    });
  }

  if (ids.deliveries.length > 0) {
    await prisma.delivery.deleteMany({ where: { id: { in: ids.deliveries } } });
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

describe('material request fulfillment build synchronization', () => {
  test('completed reservation fulfills request and links build item as ready', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await createCompletedReservationForMatch({
      learnerId: ctx.learner.id,
      supplierId: ctx.supplier.id,
      materialId: ctx.material.id,
      requestId: ctx.request.id,
      matchId: match.id,
    });

    const result = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.ok(result);
    assert.equal(result?.status, 'FULFILLED');
    assert.equal(result?.transitionedToFulfilled, true);
    assert.equal(result?.buildSyncOutcome, 'synced');

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedMaterialId, ctx.material.id);
    assert.equal(buildItem?.linkedReservationId, reservation.id);
    assert.ok(buildItem?.linkedMaterialAt);

    const build = await getMyProjectBuildById(ctx.project.id, ctx.learner.id);
    const item = build?.items.find((entry) => entry.id === ctx.itemId);
    assert.ok(item);
    assert.equal(item?.isReadyForBuild, true);
    assert.equal(item?.readinessLabel, 'Ready for build — material acquired');
    assert.equal(item?.linkedMaterial?.id, ctx.material.id);
    assert.equal(item?.linkedReservation?.id, reservation.id);
    assert.equal(item?.linkedReservation?.status, 'COMPLETED');
    assert.equal(item?.status, 'MISSING');
  });

  test('request without build linkage fulfills without changing build items', async () => {
    const learner = await createLearnerUser('no-build');
    const supplier = await createSupplierUser('no-build');
    const category = await createMaterialCategory();
    const location = await createLocation();
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} loose material`,
    });

    const request = await createLearnerMaterialRequest(learner.id, {
      requestedItemName: `${TEST_MARKER} loose request`,
      categoryId: category.id,
      description: null,
      quantity: 1,
      unit: 'piece',
      alternativesAllowed: true,
      locationCity: 'Ramallah',
      locationArea: null,
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

    const reservation = await createCompletedReservationForMatch({
      learnerId: learner.id,
      supplierId: supplier.id,
      materialId: material.id,
      requestId: request.id,
      matchId: match.id,
    });

    const result = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.ok(result);
    assert.equal(result?.buildSyncOutcome, 'no_build_link');
    assert.equal(result?.transitionedToFulfilled, true);
  });

  test('already fulfilled but unsynchronized request is repaired without duplicate notification', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'RESERVATION_CREATED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: ctx.material.id,
        requesterId: ctx.learner.id,
        ownerId: ctx.supplier.id,
        quantityRequested: 1,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    await prisma.learnerMaterialRequestMatch.update({
      where: { id: match.id },
      data: { reservationId: reservation.id },
    });
    await prisma.learnerMaterialRequest.update({
      where: { id: ctx.request.id },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
    });

    const result = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.ok(result);
    assert.equal(result?.transitionedToFulfilled, false);
    assert.equal(result?.buildSyncOutcome, 'synced');

    const notification = await createNotificationIfMissing({
      userId: result!.learnerId,
      notificationType: 'MATERIAL_REQUEST_FULFILLED',
      title: 'Material request fulfilled',
      body: `Your request "${result!.requestedItemName}" was marked fulfilled after a completed reservation.`,
      relatedEntityType: 'MATERIAL_REQUEST',
      relatedEntityId: result!.id,
      eventKey: `mr:fulfilled:${result!.id}`,
      entityType: 'MATERIAL_REQUEST',
      entityId: result!.id,
      actionType: 'OPEN_ENTITY',
    });
    if (notification) {
      ids.notifications.push(notification.id);
    }

    const notifications = await prisma.notification.findMany({
      where: { eventKey: `mr:fulfilled:${ctx.request.id}` },
    });
    assert.equal(notifications.length, 1);
  });

  test('running synchronization twice is idempotent', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await createCompletedReservationForMatch({
      learnerId: ctx.learner.id,
      supplierId: ctx.supplier.id,
      materialId: ctx.material.id,
      requestId: ctx.request.id,
      matchId: match.id,
    });

    const first = await fulfillRequestFromCompletedReservation(reservation.id);
    const second = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.equal(first?.buildSyncOutcome, 'synced');
    assert.equal(second?.transitionedToFulfilled, false);
    assert.equal(second?.buildSyncOutcome, 'already_synced');
  });

  test('cannot overwrite a build item linked to another material', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    await linkBuildItemMaterialById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      ctx.otherMaterial.id,
    );

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await createCompletedReservationForMatch({
      learnerId: ctx.learner.id,
      supplierId: ctx.supplier.id,
      materialId: ctx.material.id,
      requestId: ctx.request.id,
      matchId: match.id,
    });

    const result = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.ok(result);
    assert.equal(result?.status, 'FULFILLED');
    assert.equal(result?.buildSyncOutcome, 'conflict');

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedMaterialId, ctx.otherMaterial.id);
    assert.equal(buildItem?.linkedReservationId, null);
  });

  test('same material with manually linked build item attaches completed reservation', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    await linkBuildItemMaterialById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      ctx.material.id,
    );

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await createCompletedReservationForMatch({
      learnerId: ctx.learner.id,
      supplierId: ctx.supplier.id,
      materialId: ctx.material.id,
      requestId: ctx.request.id,
      matchId: match.id,
    });

    const result = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.equal(result?.buildSyncOutcome, 'synced');

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedMaterialId, ctx.material.id);
    assert.equal(buildItem?.linkedReservationId, reservation.id);
  });

  test('does not overwrite a different active reservation on the build item', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    await linkBuildItemMaterialById(
      ctx.project.id,
      ctx.learner.id,
      ctx.itemId,
      ctx.material.id,
    );

    const activeReservation = await prisma.reservation.create({
      data: {
        materialId: ctx.material.id,
        requesterId: ctx.learner.id,
        ownerId: ctx.supplier.id,
        quantityRequested: 1,
        status: 'ACCEPTED',
      },
    });
    ids.reservations.push(activeReservation.id);

    await prisma.projectBuildItem.update({
      where: { id: ctx.itemId },
      data: { linkedReservationId: activeReservation.id },
    });

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'RESERVATION_CREATED',
      },
    });
    ids.matches.push(match.id);

    const completedReservation = await prisma.reservation.create({
      data: {
        materialId: ctx.material.id,
        requesterId: ctx.learner.id,
        ownerId: ctx.supplier.id,
        quantityRequested: 1,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(completedReservation.id);

    await prisma.learnerMaterialRequestMatch.update({
      where: { id: match.id },
      data: { reservationId: completedReservation.id },
    });

    const result = await fulfillRequestFromCompletedReservation(
      completedReservation.id,
    );
    assert.equal(result?.buildSyncOutcome, 'conflict');

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedReservationId, activeReservation.id);
  });

  test('cross-learner reservation cannot update build item or fulfill request', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'RESERVATION_CREATED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: ctx.material.id,
        requesterId: ctx.otherLearner.id,
        ownerId: ctx.supplier.id,
        quantityRequested: 1,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    await prisma.learnerMaterialRequestMatch.update({
      where: { id: match.id },
      data: { reservationId: reservation.id },
    });

    const result = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.equal(result, null);

    const request = await prisma.learnerMaterialRequest.findUnique({
      where: { id: ctx.request.id },
    });
    assert.equal(request?.status, 'OPEN');

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedMaterialId, null);
    assert.equal(buildItem?.linkedReservationId, null);
  });

  test('ambiguous reservation matches do not update build items', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    const otherRequest = await createLearnerMaterialRequest(ctx.learner.id, {
      requestedItemName: `${TEST_MARKER} second request`,
      categoryId: ctx.materialCategory.id,
      description: null,
      quantity: 1,
      unit: 'piece',
      alternativesAllowed: true,
      locationCity: 'Ramallah',
      locationArea: null,
    });
    ids.requests.push(otherRequest.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: ctx.material.id,
        requesterId: ctx.learner.id,
        ownerId: ctx.supplier.id,
        quantityRequested: 1,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    const matchA = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'RESERVATION_CREATED',
        reservation: { connect: { id: reservation.id } },
      },
    });
    const matchB = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: otherRequest.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'RESERVATION_CREATED',
        reservation: { connect: { id: reservation.id } },
      },
    });
    ids.matches.push(matchA.id, matchB.id);

    const result = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.equal(result, null);

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedMaterialId, null);
    assert.equal(buildItem?.linkedReservationId, null);
  });

  test('archived build does not mutate build item but request can fulfill', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    await prisma.projectBuild.update({
      where: { id: ctx.build.id },
      data: { status: 'ARCHIVED' },
    });

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await createCompletedReservationForMatch({
      learnerId: ctx.learner.id,
      supplierId: ctx.supplier.id,
      materialId: ctx.material.id,
      requestId: ctx.request.id,
      matchId: match.id,
    });

    const result = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.equal(result?.status, 'FULFILLED');
    assert.equal(result?.buildSyncOutcome, 'archived_build');

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedMaterialId, null);
    assert.equal(buildItem?.linkedReservationId, null);
  });

  test('committed completion with missing post-hook is repaired by reconciliation', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await createReservation(ctx.learner.id, {
      materialId: ctx.material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      materialRequestMatchId: match.id,
      learnerPreferredPickupWindows: [
        {
          start: new Date(Date.now() + 24 * 3_600_000).toISOString(),
          end: new Date(Date.now() + 26 * 3_600_000).toISOString(),
        },
      ],
    });
    ids.reservations.push(reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    const before = await prisma.learnerMaterialRequest.findUnique({
      where: { id: ctx.request.id },
    });
    assert.equal(before?.status, 'OPEN');

    const repaired = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.ok(repaired);
    assert.equal(repaired?.status, 'FULFILLED');
    assert.equal(repaired?.buildSyncOutcome, 'synced');

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedMaterialId, ctx.material.id);
    assert.equal(buildItem?.linkedReservationId, reservation.id);
  });

  test('supplier re-complete on already completed reservation reconciles without duplicate notification', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await createReservation(ctx.learner.id, {
      materialId: ctx.material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      materialRequestMatchId: match.id,
      learnerPreferredPickupWindows: [
        {
          start: new Date(Date.now() + 24 * 3_600_000).toISOString(),
          end: new Date(Date.now() + 26 * 3_600_000).toISOString(),
        },
      ],
    });
    ids.reservations.push(reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'ACCEPTED',
        pickupWindowStart: new Date(Date.now() - 3_600_000),
        pickupWindowEnd: new Date(Date.now() + 3_600_000),
      },
    });

    await completeSupplierReservation(ctx.supplier.id, reservation.id, {
      confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
    });

    await prisma.projectBuildItem.update({
      where: { id: ctx.itemId },
      data: {
        linkedMaterialId: null,
        linkedReservationId: null,
        linkedMaterialAt: null,
      },
    });
    await prisma.learnerMaterialRequest.update({
      where: { id: ctx.request.id },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
    });

    await completeSupplierReservation(ctx.supplier.id, reservation.id, {
      confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
    });

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedMaterialId, ctx.material.id);
    assert.equal(buildItem?.linkedReservationId, reservation.id);

    const notifications = await prisma.notification.findMany({
      where: { eventKey: `mr:fulfilled:${ctx.request.id}` },
    });
    assert.equal(notifications.length, 1);
  });

  test('driver re-deliver on already delivered delivery reconciles without duplicate notification', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    const driver = await createDriverUser();

    await prisma.material.update({
      where: { id: ctx.material.id },
      data: { deliveryAllowed: true },
    });

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(
      supplierPickupStart.getTime() + 2 * 3_600_000,
    );
    const earliestDelivery = new Date(supplierPickupStart.getTime() + 60 * 60_000);
    const learnerDeliveryStart = new Date(
      earliestDelivery.getTime() - 30 * 60_000,
    );
    const learnerDeliveryEnd = new Date(
      earliestDelivery.getTime() + 3 * 3_600_000,
    );

    const reservation = await createReservation(ctx.learner.id, {
      materialId: ctx.material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      materialRequestMatchId: match.id,
      learnerPreferredDeliveryWindows: [
        {
          start: learnerDeliveryStart.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: '12 Learner Street',
      dropoffCity: 'Ramallah',
      safeDropoffAllowed: false,
    });
    ids.reservations.push(reservation.id);

    await acceptSupplierReservation(ctx.supplier.id, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        ...activePickupWindowReservationUpdate(),
        ...activeConfirmedDeliveryWindowUpdate(),
      },
    });

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { reservationId: reservation.id },
    });
    ids.deliveries.push(delivery.id);

    const profile = driver.driverProfile;
    assert.ok(profile);

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        status: 'DELIVERED',
        assignedDriverProfileId: profile.id,
        assignedAt: new Date(),
      },
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    await prisma.deliveryAssignment.create({
      data: {
        deliveryId: delivery.id,
        driverProfileId: profile.id,
        assignedByUserId: driver.id,
        status: 'ACTIVE',
      },
    });

    const fulfilled = await fulfillRequestFromCompletedReservation(reservation.id);
    assert.ok(fulfilled);
    assert.equal(fulfilled.transitionedToFulfilled, true);
    await createNotificationIfMissing({
      userId: fulfilled.learnerId,
      notificationType: 'MATERIAL_REQUEST_FULFILLED',
      title: 'Material request fulfilled',
      body: `Your request "${fulfilled.requestedItemName}" was marked fulfilled after a completed reservation.`,
      relatedEntityType: 'MATERIAL_REQUEST',
      relatedEntityId: fulfilled.id,
      eventKey: `mr:fulfilled:${fulfilled.id}`,
      entityType: 'MATERIAL_REQUEST',
      entityId: fulfilled.id,
      actionType: 'OPEN_ENTITY',
    });

    await prisma.projectBuildItem.update({
      where: { id: ctx.itemId },
      data: {
        linkedMaterialId: null,
        linkedReservationId: null,
        linkedMaterialAt: null,
      },
    });
    await prisma.learnerMaterialRequest.update({
      where: { id: ctx.request.id },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
    });

    await updateDriverDeliveryStatus(driver.id, delivery.id, {
      status: 'DELIVERED',
      confirmationCode: deriveHandoverCode('learner-delivery', delivery.id),
    });

    const buildItem = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItem?.linkedMaterialId, ctx.material.id);
    assert.equal(buildItem?.linkedReservationId, reservation.id);

    const notifications = await prisma.notification.findMany({
      where: { eventKey: `mr:fulfilled:${ctx.request.id}` },
    });
    assert.equal(notifications.length, 1);
  });

  test('getLearnerMaterialRequest repairs fulfilled unsynced request via worker reconciliation', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'RESERVATION_CREATED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: ctx.material.id,
        requesterId: ctx.learner.id,
        ownerId: ctx.supplier.id,
        quantityRequested: 1,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    await prisma.learnerMaterialRequestMatch.update({
      where: { id: match.id },
      data: { reservationId: reservation.id },
    });
    await prisma.learnerMaterialRequest.update({
      where: { id: ctx.request.id },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
    });

    const buildItemBefore = await prisma.projectBuildItem.findUnique({
      where: { id: ctx.itemId },
    });
    assert.equal(buildItemBefore?.linkedMaterialId, null);
    assert.equal(buildItemBefore?.linkedReservationId, null);

    const { reconcileStaleFulfilledBuildSyncBatch } = await import(
      '../material-requests/material-requests.build-sync-reconciliation.js'
    );
    const { fulfillRequestFromCompletedReservation } = await import(
      '../learner-material-requests/learner-material-requests.service.js'
    );
    const batch = await reconcileStaleFulfilledBuildSyncBatch(
      fulfillRequestFromCompletedReservation,
      { batchSize: 20 },
    );
    assert.equal(batch.repairedCount, 1);

    const detail = await getLearnerMaterialRequest(ctx.learner.id, ctx.request.id);
    assert.equal(detail.status, 'FULFILLED');

    const acquiredMatch = detail.matches?.find((entry) => entry.id === match.id);
    assert.ok(acquiredMatch);
    assert.equal(acquiredMatch?.isAcquired, true);
    assert.equal(acquiredMatch?.reservationStatus, 'COMPLETED');
    assert.equal(acquiredMatch?.material?.id, ctx.material.id);
    assert.equal(acquiredMatch?.canReserve, false);

    const build = await getMyProjectBuildById(ctx.project.id, ctx.learner.id);
    const item = build?.items.find((entry) => entry.id === ctx.itemId);
    assert.equal(item?.isReadyForBuild, true);
    assert.equal(build?.progress.ready, 1);

    const notifications = await prisma.notification.findMany({
      where: { eventKey: `mr:fulfilled:${ctx.request.id}` },
    });
    assert.equal(notifications.length, 0);
  });

  test('getMyProjectBuildById repairs fulfilled unsynced build item on load', async () => {
    const ctx = await setupBuildLinkedMaterialRequest();
    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: ctx.request.id } },
        material: { connect: { id: ctx.material.id } },
        supplierUser: { connect: { id: ctx.supplier.id } },
        status: 'RESERVATION_CREATED',
      },
    });
    ids.matches.push(match.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: ctx.material.id,
        requesterId: ctx.learner.id,
        ownerId: ctx.supplier.id,
        quantityRequested: 1,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    await prisma.learnerMaterialRequestMatch.update({
      where: { id: match.id },
      data: { reservationId: reservation.id },
    });
    await prisma.learnerMaterialRequest.update({
      where: { id: ctx.request.id },
      data: { status: 'FULFILLED', fulfilledAt: new Date() },
    });

    const build = await getMyProjectBuildById(ctx.project.id, ctx.learner.id);
    const item = build?.items.find((entry) => entry.id === ctx.itemId);
    assert.equal(item?.isReadyForBuild, true);
    assert.equal(item?.linkedMaterial?.id, ctx.material.id);
    assert.equal(item?.linkedReservation?.id, reservation.id);
    assert.equal(build?.progress.ready, 1);
  });
});
