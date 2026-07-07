import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import {
  activeConfirmedDeliveryWindowUpdate,
  activePickupWindowReservationUpdate,
} from '../../test-utils/handover-test-windows.js';
import {
  acceptSupplierReservation,
  declineSupplierReservation,
} from '../supplier-reservations/supplier-reservations.service.js';
import {
  acceptDelivery,
  listActiveDriverDeliveries,
  listAvailableDeliveries,
  updateDriverDeliveryStatus,
} from '../driver/driver.service.js';
import {
  createReservation,
} from '../reservations/reservations.service.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';

const TEST_MARKER = '[test-delivery-group-operational]';

function buildFeasibleDeliveryScheduling(hoursFromNowPickup = 24) {
  const supplierPickupStart = new Date(Date.now() + hoursFromNowPickup * 3_600_000);
  const supplierPickupEnd = new Date(
    supplierPickupStart.getTime() + 2 * 3_600_000,
  );
  const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
  const learnerDeliveryStart = new Date(
    earliestDelivery.getTime() - 30 * 60_000,
  );
  const learnerDeliveryEnd = new Date(
    earliestDelivery.getTime() + 3 * 3_600_000,
  );

  return {
    supplierPickup: {
      start: supplierPickupStart.toISOString(),
      end: supplierPickupEnd.toISOString(),
    },
    learnerDelivery: {
      start: learnerDeliveryStart.toISOString(),
      end: learnerDeliveryEnd.toISOString(),
    },
  };
}

function deliveryPayload(
  materialId: string,
  scheduling: ReturnType<typeof buildFeasibleDeliveryScheduling>,
  overrides: Partial<CreateReservationInput> = {},
): CreateReservationInput {
  return {
    materialId,
    quantityRequested: 1,
    fulfillmentMethod: 'DELIVERY',
    learnerPreferredDeliveryWindows: [scheduling.learnerDelivery],
    deliveryAddressText: '12 Learner Street, Nablus',
    dropoffCity: 'Nablus',
    safeDropoffAllowed: false,
    ...overrides,
  };
}

type TestContext = {
  learnerId: string;
  supplierId: string;
  driverUserId: string;
  driverProfileId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
  createdGroupIds: string[];
  createdDeliveryIds: string[];
};

async function createUser(input: {
  displayName: string;
  emailSuffix: string;
  role: 'LEARNER' | 'SUPPLIER' | 'DRIVER';
}) {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.displayName}`,
      email: `${TEST_MARKER}-${input.emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: input.role, isPrimary: true }],
      },
      ...(input.role === 'LEARNER'
        ? {
            learnerProfile: {
              create: {
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            },
          }
        : input.role === 'SUPPLIER'
          ? {
              supplierProfile: {
                create: {
                  supplierType: 'INDIVIDUAL_SUPPLIER',
                  publicName: `${TEST_MARKER} supplier`,
                  verificationStatus: 'VERIFIED',
                },
              },
            }
          : {
              driverProfile: {
                create: {
                  displayName: `${TEST_MARKER} driver`,
                  phone: '+970599000001',
                  city: 'Nablus',
                  area: TEST_MARKER,
                  transportationType: 'CAR',
                },
              },
            }),
    },
    select: { id: true },
  });
}

async function createMaterial(ctx: TestContext, titleSuffix: string) {
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: ctx.supplierId },
    select: { id: true },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      supplierProfileId: supplierProfile?.id,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} ${titleSuffix} ${Date.now()}`,
      description: `${TEST_MARKER} material`,
      materialType: 'Test material',
      quantity: 5,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: false,
      price: 5,
      deliveryAllowed: true,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdDeliveryIds.length) {
    await prisma.deliveryStatusHistory.deleteMany({
      where: { deliveryId: { in: ctx.createdDeliveryIds } },
    });
    await prisma.deliveryAssignment.deleteMany({
      where: { deliveryId: { in: ctx.createdDeliveryIds } },
    });
    await prisma.delivery.deleteMany({
      where: { id: { in: ctx.createdDeliveryIds } },
    });
  }

  if (ctx.createdReservationIds.length) {
    await prisma.reservationStatusHistory.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: ctx.createdReservationIds } },
    });
  }

  if (ctx.createdGroupIds.length) {
    await prisma.deliveryGroup.deleteMany({
      where: { id: { in: ctx.createdGroupIds } },
    });
  }

  if (ctx.createdMaterialIds.length) {
    await prisma.material.deleteMany({
      where: { id: { in: ctx.createdMaterialIds } },
    });
  }

  if (ctx.locationId) {
    await prisma.location.deleteMany({ where: { id: ctx.locationId } });
  }

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: ctx.createdUserIds } } });
  }
}

async function acceptDeliveryReservation(
  ctx: TestContext,
  reservationId: string,
  scheduling = buildFeasibleDeliveryScheduling(24 + ctx.createdReservationIds.length),
) {
  return acceptSupplierReservation(ctx.supplierId, reservationId, {
    pickupWindowStart: scheduling.supplierPickup.start,
    pickupWindowEnd: scheduling.supplierPickup.end,
    selectedPreferredWindowIndex: 0,
  });
}

async function createGroupedReservations(
  ctx: TestContext,
  scheduling = buildFeasibleDeliveryScheduling(30),
) {
  const materialA = await createMaterial(ctx, 'A');
  const materialB = await createMaterial(ctx, 'B');

  const first = await createReservation(
    ctx.learnerId,
    deliveryPayload(materialA.id, scheduling),
  );
  ctx.createdReservationIds.push(first.id);
  if (first.deliveryGroupId) {
    ctx.createdGroupIds.push(first.deliveryGroupId);
  }

  const second = await createReservation(
    ctx.learnerId,
    deliveryPayload(materialB.id, scheduling, {
      combineWithDeliveryGroupId: first.deliveryGroupId!,
    }),
  );
  ctx.createdReservationIds.push(second.id);

  assert.equal(first.deliveryGroupId, second.deliveryGroupId);

  return { first, second, groupId: first.deliveryGroupId!, scheduling };
}

describe('operational delivery groups', () => {
  const ctx: TestContext = {
    learnerId: '',
    supplierId: '',
    driverUserId: '',
    driverProfileId: '',
    categoryId: '',
    locationId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdReservationIds: [],
    createdGroupIds: [],
    createdDeliveryIds: [],
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { isActive: true },
      select: { id: true },
    });
    assert.ok(category);

    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: TEST_MARKER,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });

    const learner = await createUser({
      displayName: 'learner',
      emailSuffix: 'learner',
      role: 'LEARNER',
    });
    const supplier = await createUser({
      displayName: 'supplier',
      emailSuffix: 'supplier',
      role: 'SUPPLIER',
    });
    const driver = await createUser({
      displayName: 'driver',
      emailSuffix: 'driver',
      role: 'DRIVER',
    });
    const driverProfile = await prisma.driverProfile.findUniqueOrThrow({
      where: { userId: driver.id },
      select: { id: true },
    });

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.learnerId = learner.id;
    ctx.supplierId = supplier.id;
    ctx.driverUserId = driver.id;
    ctx.driverProfileId = driverProfile.id;
    ctx.createdUserIds.push(learner.id, supplier.id, driver.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  afterEach(async () => {
    if (!ctx.createdDeliveryIds.length) {
      return;
    }

    await prisma.deliveryAssignment.deleteMany({
      where: { deliveryId: { in: ctx.createdDeliveryIds } },
    });
    await prisma.delivery.updateMany({
      where: { id: { in: ctx.createdDeliveryIds } },
      data: {
        status: 'WAITING_FOR_DRIVER',
        assignedDriverProfileId: null,
        assignedAt: null,
        arrivedPickupAt: null,
        pickedUpAt: null,
        onTheWayAt: null,
        arrivedDropoffAt: null,
        deliveredAt: null,
        cancelledAt: null,
      },
    });

    if (ctx.createdGroupIds.length) {
      await prisma.deliveryGroup.updateMany({
        where: { id: { in: ctx.createdGroupIds } },
        data: {
          status: 'OPEN',
          assignedDriverProfileId: null,
        },
      });
    }
  });

  test('two grouped accepted reservations create one delivery', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);

    const deliveries = await prisma.delivery.findMany({
      where: { deliveryGroupId: groupId },
    });

    assert.equal(deliveries.length, 1);
    ctx.createdDeliveryIds.push(deliveries[0]!.id);
  });

  test('accepting second grouped reservation reuses existing delivery', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    const afterFirst = await prisma.delivery.findMany({
      where: { deliveryGroupId: groupId },
    });
    assert.equal(afterFirst.length, 1);

    await acceptDeliveryReservation(ctx, second.id, scheduling);

    const afterSecond = await prisma.delivery.findMany({
      where: { deliveryGroupId: groupId },
    });
    assert.equal(afterSecond.length, 1);
    assert.equal(afterSecond[0]!.id, afterFirst[0]!.id);
    ctx.createdDeliveryIds.push(afterSecond[0]!.id);
  });

  test('driver available jobs shows one grouped job with two items', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);

    const jobs = await listAvailableDeliveries(ctx.driverUserId);
    const groupedJobs = jobs.deliveries.filter(
      (job) => job.deliveryGroupId === groupId,
    );

    assert.equal(groupedJobs.length, 1);
    assert.equal(groupedJobs[0]!.groupedDelivery, true);
    assert.equal(groupedJobs[0]!.itemCount, 2);
    assert.equal(groupedJobs[0]!.items.length, 2);
  });

  test('active delivery count counts grouped delivery as one', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);

    const before = await listActiveDriverDeliveries(ctx.driverUserId);
    assert.equal(before.activeDeliveryCount, 0);

    await acceptDelivery(ctx.driverUserId, delivery.id);

    const after = await listActiveDriverDeliveries(ctx.driverUserId);
    assert.equal(after.activeDeliveryCount, 1);
    assert.equal(after.deliveries.length, 1);
    assert.equal(after.deliveries[0]!.itemCount, 2);
  });

  test('driver accepting grouped job assigns one delivery', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);

    const jobs = await listAvailableDeliveries(ctx.driverUserId);
    const groupedJob = jobs.deliveries.find(
      (job) => job.deliveryGroupId === groupId,
    );
    assert.ok(groupedJob);

    const assigned = await acceptDelivery(ctx.driverUserId, groupedJob.id);
    assert.equal(assigned.status, 'DRIVER_ASSIGNED');

    const row = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    assert.equal(row.assignedDriverProfileId, ctx.driverProfileId);
  });

  test('rejected grouped reservation is excluded from driver job items', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await declineSupplierReservation(ctx.supplierId, second.id, {
      reason: 'Out of stock',
    });

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);

    const jobs = await listAvailableDeliveries(ctx.driverUserId);
    const groupedJob = jobs.deliveries.find(
      (job) => job.deliveryGroupId === groupId,
    );
    assert.ok(groupedJob);
    assert.equal(groupedJob.itemCount, 1);
    assert.equal(groupedJob.items.length, 1);
    assert.equal(groupedJob.items[0]!.reservationId, first.id);
  });

  test('assigned grouped delivery cannot accept another grouped reservation', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);
    await acceptDelivery(ctx.driverUserId, delivery.id);

    await assert.rejects(
      () => acceptDeliveryReservation(ctx, second.id, scheduling),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        return true;
      },
    );
  });

  test('different delivery groups create separate deliveries', async () => {
    const schedulingA = buildFeasibleDeliveryScheduling(40);
    const schedulingB = buildFeasibleDeliveryScheduling(50);

    const materialA = await createMaterial(ctx, 'group-a');
    const materialB = await createMaterial(ctx, 'group-b');

    const first = await createReservation(
      ctx.learnerId,
      deliveryPayload(materialA.id, schedulingA),
    );
    const second = await createReservation(
      ctx.learnerId,
      deliveryPayload(materialB.id, schedulingB),
    );
    ctx.createdReservationIds.push(first.id, second.id);
    if (first.deliveryGroupId) {
      ctx.createdGroupIds.push(first.deliveryGroupId);
    }
    if (second.deliveryGroupId) {
      ctx.createdGroupIds.push(second.deliveryGroupId);
    }

    assert.notEqual(first.deliveryGroupId, second.deliveryGroupId);

    await acceptDeliveryReservation(ctx, first.id, schedulingA);
    await acceptDeliveryReservation(ctx, second.id, schedulingB);

    const deliveries = await prisma.delivery.findMany({
      where: {
        reservationId: { in: [first.id, second.id] },
      },
    });

    assert.equal(deliveries.length, 2);
    ctx.createdDeliveryIds.push(...deliveries.map((item) => item.id));
  });

  test('single reservation without group still creates one delivery', async () => {
    const scheduling = buildFeasibleDeliveryScheduling(60);
    const material = await createMaterial(ctx, 'single');
    const reservation = await createReservation(
      ctx.learnerId,
      deliveryPayload(material.id, scheduling),
    );
    ctx.createdReservationIds.push(reservation.id);
    if (reservation.deliveryGroupId) {
      ctx.createdGroupIds.push(reservation.deliveryGroupId);
    }

    const accepted = await acceptDeliveryReservation(ctx, reservation.id, scheduling);
    assert.equal(accepted.status, 'ACCEPTED');

    const deliveries = await prisma.delivery.findMany({
      where: { reservationId: reservation.id },
    });

    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]!.deliveryGroupId, reservation.deliveryGroupId);
    ctx.createdDeliveryIds.push(deliveries[0]!.id);
  });

  test('one delivery fee per group is preserved on reservations', async () => {
    const scheduling = buildFeasibleDeliveryScheduling(70);
    const { first, second } = await createGroupedReservations(ctx, scheduling);

    const firstRow = await prisma.reservation.findUniqueOrThrow({
      where: { id: first.id },
      select: { deliveryFee: true, totalAmount: true },
    });
    const secondRow = await prisma.reservation.findUniqueOrThrow({
      where: { id: second.id },
      select: { deliveryFee: true, totalAmount: true },
    });

    assert.ok(Number(firstRow.deliveryFee) > 0);
    assert.equal(Number(secondRow.deliveryFee), 0);
    assert.ok(Number(firstRow.totalAmount) > Number(secondRow.totalAmount));
  });

  test('grouped delivery handover code is derived from the one delivery row', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);

    const supplierCode = deriveHandoverCode('supplier-handover', delivery.id);
    const learnerCode = deriveHandoverCode('learner-delivery', delivery.id);

    assert.equal(supplierCode.length, 6);
    assert.equal(learnerCode.length, 6);
  });

  test('delivered grouped delivery completes all accepted reservations', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);

    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: activePickupWindowReservationUpdate(),
    });
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: activeConfirmedDeliveryWindowUpdate(),
    });

    await acceptDelivery(ctx.driverUserId, delivery.id);

    const supplierCode = deriveHandoverCode('supplier-handover', delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'PICKED_UP',
      confirmationCode: supplierCode,
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });

    const learnerCode = deriveHandoverCode('learner-delivery', delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'DELIVERED',
      confirmationCode: learnerCode,
    });

    const statuses = await prisma.reservation.findMany({
      where: { id: { in: [first.id, second.id] } },
      select: { id: true, status: true },
    });

    assert.equal(
      statuses.every((row) => row.status === 'COMPLETED'),
      true,
    );
  });
});
