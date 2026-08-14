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
  submitNoDriverPickupWindow,
} from '../supplier-reservations/supplier-reservations.service.js';
import {
  acceptDelivery,
  listActiveDriverDeliveries,
  listAvailableDeliveries,
  updateDriverDeliveryStatus,
} from '../driver/driver.service.js';
import { setDriverDeliveryWindow } from '../driver/driver-delivery-scheduling.service.js';
import {
  createReservation,
} from '../reservations/reservations.service.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';
import {
  markDriverDeliveryFailed,
  markDriverIssueAfterPickup,
  markDriverPickupFailed,
} from '../fulfillment-failures/fulfillment-failures.service.js';
import {
  cancelAndReleaseHoldForPickupRecoveryReport,
  requestSupplierRescheduleForPickupRecoveryReport,
} from '../admin-no-show-reports/admin-delivery-pickup-recovery.repository.js';
import { getMaterialQuantityState } from '../reservations/reservations.quantity.js';
import { confirmSupplierDeliveryReturn } from '../delivery-returns/delivery-returns.service.js';

const TEST_MARKER = '[test-delivery-group-operational]';

function buildFeasibleDeliveryScheduling(hoursFromNowPickup = 24) {
  const supplierPickupStart = new Date(Date.now() + hoursFromNowPickup * 3_600_000);
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
                  acceptingNewJobs: true,
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
  overrides: Partial<CreateReservationInput> = {},
) {
  const materialA = await createMaterial(ctx, 'A');
  const materialB = await createMaterial(ctx, 'B');

  const first = await createReservation(
    ctx.learnerId,
    deliveryPayload(materialA.id, scheduling, overrides),
  );
  ctx.createdReservationIds.push(first.id);
  if (first.deliveryGroupId) {
    ctx.createdGroupIds.push(first.deliveryGroupId);
  }

  const second = await createReservation(
    ctx.learnerId,
    deliveryPayload(materialB.id, scheduling, {
      ...overrides,
      combineWithDeliveryGroupId: first.deliveryGroupId!,
    }),
  );
  ctx.createdReservationIds.push(second.id);

  assert.equal(first.deliveryGroupId, second.deliveryGroupId);

  return { first, second, groupId: first.deliveryGroupId!, scheduling };
}

async function createTripleGroupedReservations(
  ctx: TestContext,
  scheduling = buildFeasibleDeliveryScheduling(30),
  overrides: Partial<CreateReservationInput> = {},
) {
  const materialA = await createMaterial(ctx, 'A');
  const materialB = await createMaterial(ctx, 'B');
  const materialC = await createMaterial(ctx, 'C');

  const first = await createReservation(
    ctx.learnerId,
    deliveryPayload(materialA.id, scheduling, overrides),
  );
  ctx.createdReservationIds.push(first.id);
  if (first.deliveryGroupId) {
    ctx.createdGroupIds.push(first.deliveryGroupId);
  }

  const second = await createReservation(
    ctx.learnerId,
    deliveryPayload(materialB.id, scheduling, {
      ...overrides,
      combineWithDeliveryGroupId: first.deliveryGroupId!,
    }),
  );
  ctx.createdReservationIds.push(second.id);

  const third = await createReservation(
    ctx.learnerId,
    deliveryPayload(materialC.id, scheduling, {
      ...overrides,
      combineWithDeliveryGroupId: first.deliveryGroupId!,
    }),
  );
  ctx.createdReservationIds.push(third.id);

  assert.equal(first.deliveryGroupId, second.deliveryGroupId);
  assert.equal(first.deliveryGroupId, third.deliveryGroupId);

  return {
    first,
    second,
    third,
    groupId: first.deliveryGroupId!,
    scheduling,
  };
}

async function prepareTripleGroupedPickup(ctx: TestContext) {
  const grouped = await createTripleGroupedReservations(ctx);
  const reservationIds = [
    grouped.first.id,
    grouped.second.id,
    grouped.third.id,
  ];

  await acceptDeliveryReservation(ctx, grouped.first.id, grouped.scheduling);
  await acceptDeliveryReservation(ctx, grouped.second.id, grouped.scheduling);
  await acceptDeliveryReservation(ctx, grouped.third.id, grouped.scheduling);

  const delivery = await prisma.delivery.findFirstOrThrow({
    where: { deliveryGroupId: grouped.groupId },
  });
  ctx.createdDeliveryIds.push(delivery.id);

  await prisma.reservation.updateMany({
    where: { id: { in: reservationIds } },
    data: activePickupWindowReservationUpdate(),
  });
  await acceptDelivery(ctx.driverUserId, delivery.id);
  await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
    status: 'ARRIVED_PICKUP',
  });

  return { ...grouped, delivery, reservationIds };
}

async function prepareDetachedPartialPickupRecovery(
  ctx: TestContext,
  scenarioArea: string,
) {
  const scheduling = buildFeasibleDeliveryScheduling(36);
  const grouped = await createTripleGroupedReservations(ctx, scheduling, {
    dropoffArea: scenarioArea,
  });
  const reservationIds = [
    grouped.first.id,
    grouped.second.id,
    grouped.third.id,
  ];

  await acceptDeliveryReservation(ctx, grouped.first.id, scheduling);
  await acceptDeliveryReservation(ctx, grouped.second.id, scheduling);
  await acceptDeliveryReservation(ctx, grouped.third.id, scheduling);

  const originalDelivery = await prisma.delivery.findFirstOrThrow({
    where: { deliveryGroupId: grouped.groupId },
  });
  ctx.createdDeliveryIds.push(originalDelivery.id);

  await prisma.reservation.updateMany({
    where: { id: { in: reservationIds } },
    data: activePickupWindowReservationUpdate(),
  });
  await prisma.reservation.updateMany({
    where: { id: { in: reservationIds } },
    data: activeConfirmedDeliveryWindowUpdate(),
  });
  await acceptDelivery(ctx.driverUserId, originalDelivery.id);
  await updateDriverDeliveryStatus(ctx.driverUserId, originalDelivery.id, {
    status: 'ARRIVED_PICKUP',
  });
  await updateDriverDeliveryStatus(ctx.driverUserId, originalDelivery.id, {
    status: 'PICKED_UP',
    confirmationCode: deriveHandoverCode(
      'supplier-handover',
      originalDelivery.id,
    ),
    pickedReservationIds: [grouped.first.id, grouped.second.id],
    unpicked: [
      {
        reservationId: grouped.third.id,
        reason: 'WRONG_ITEM',
        note: 'Focused recovery-link scenario.',
      },
    ],
  });

  const report = await prisma.noShowReport.findFirstOrThrow({
    where: {
      reservationId: grouped.third.id,
      reasonCode: 'PICKUP_FAILED',
    },
    orderBy: { createdAt: 'desc' },
  });
  const requested = await requestSupplierRescheduleForPickupRecoveryReport({
    reportId: report.id,
    adminUserId: ctx.supplierId,
    adminNote: 'Focused partial-pickup recovery test.',
  });
  assert.equal(requested.outcome, 'REQUESTED');

  return { ...grouped, scheduling, originalDelivery, report };
}

async function groupedPickupStateSnapshot(input: {
  deliveryId: string;
  groupId: string;
  reservationIds: string[];
  driverProfileId: string;
}) {
  const [delivery, group, assignments, reservations, deliveryHistoryCount,
    reservationHistoryCount, driver] = await Promise.all([
    prisma.delivery.findUniqueOrThrow({
      where: { id: input.deliveryId },
      select: {
        status: true,
        reservationId: true,
        deliveryGroupId: true,
        assignedDriverProfileId: true,
        pickedUpAt: true,
        supplierHandoverCodeHash: true,
        supplierHandoverCodeGeneratedAt: true,
        updatedAt: true,
      },
    }),
    prisma.deliveryGroup.findUniqueOrThrow({
      where: { id: input.groupId },
      select: {
        status: true,
        assignedDriverProfileId: true,
        updatedAt: true,
      },
    }),
    prisma.deliveryAssignment.findMany({
      where: { deliveryId: input.deliveryId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        driverProfileId: true,
        status: true,
        releasedAt: true,
        releaseReason: true,
      },
    }),
    prisma.reservation.findMany({
      where: { id: { in: input.reservationIds } },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        status: true,
        fulfillmentMethod: true,
        deliveryGroupId: true,
        materialId: true,
        pendingRescheduleReason: true,
        pendingRescheduleNote: true,
        updatedAt: true,
      },
    }),
    prisma.deliveryStatusHistory.count({
      where: { deliveryId: input.deliveryId },
    }),
    prisma.reservationStatusHistory.count({
      where: { reservationId: { in: input.reservationIds } },
    }),
    prisma.driverProfile.findUniqueOrThrow({
      where: { id: input.driverProfileId },
      select: { availability: true, updatedAt: true },
    }),
  ]);

  const materialHolds = await Promise.all(
    reservations.map(async (reservation) => {
      const state = await getMaterialQuantityState(
        prisma,
        reservation.materialId,
      );
      return {
        materialId: reservation.materialId,
        materialQuantity: state?.materialQuantity.toString() ?? null,
        heldQuantity: state?.heldQuantity.toString() ?? null,
        availableQuantity: state?.availableQuantity.toString() ?? null,
      };
    }),
  );
  materialHolds.sort((left, right) =>
    left.materialId.localeCompare(right.materialId),
  );

  return {
    delivery,
    group,
    assignments,
    reservations,
    materialHolds,
    deliveryHistoryCount,
    reservationHistoryCount,
    driver,
  };
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

  test('grouped pickup failure atomically moves the whole group to admin recovery', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);
    await acceptDelivery(ctx.driverUserId, delivery.id);

    const expiredEnd = new Date(Date.now() - 2 * 60 * 60_000);
    const expiredStart = new Date(expiredEnd.getTime() - 60 * 60_000);
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: {
        supplierPickupWindowStart: expiredStart,
        supplierPickupWindowEnd: expiredEnd,
      },
    });

    await markDriverPickupFailed(ctx.driverUserId, delivery.id, {
      reason: 'SUPPLIER_UNAVAILABLE',
      note: 'Grouped pickup could not be completed.',
    });

    const [updatedDelivery, group, reservations, assignment, driver] =
      await Promise.all([
        prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } }),
        prisma.deliveryGroup.findUniqueOrThrow({ where: { id: groupId } }),
        prisma.reservation.findMany({
          where: { id: { in: [first.id, second.id] } },
          select: { status: true },
        }),
        prisma.deliveryAssignment.findFirstOrThrow({
          where: { deliveryId: delivery.id },
          orderBy: { acceptedAt: 'desc' },
        }),
        prisma.driverProfile.findUniqueOrThrow({
          where: { id: ctx.driverProfileId },
        }),
      ]);

    assert.equal(updatedDelivery.status, 'FAILED_PICKUP');
    assert.equal(updatedDelivery.assignedDriverProfileId, null);
    assert.equal(group.status, 'CANCELLED');
    assert.equal(group.assignedDriverProfileId, null);
    assert.equal(
      reservations.every((reservation) =>
        reservation.status === 'AWAITING_RESOLUTION'),
      true,
    );
    assert.equal(assignment.status, 'RELEASED');
    assert.equal(driver.availability, 'AVAILABLE');
  });

  test('grouped pickup recovery reopens all reservations and the shared delivery', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);
    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);
    await acceptDelivery(ctx.driverUserId, delivery.id);

    const expiredEnd = new Date(Date.now() - 2 * 60 * 60_000);
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: {
        supplierPickupWindowStart: new Date(
          expiredEnd.getTime() - 60 * 60_000,
        ),
        supplierPickupWindowEnd: expiredEnd,
      },
    });
    await markDriverPickupFailed(ctx.driverUserId, delivery.id, {
      reason: 'MATERIAL_NOT_READY',
      note: 'Grouped material was not ready.',
    });

    const report = await prisma.noShowReport.findFirstOrThrow({
      where: { deliveryId: delivery.id, reasonCode: 'PICKUP_FAILED' },
      orderBy: { createdAt: 'desc' },
    });
    const adminResult =
      await requestSupplierRescheduleForPickupRecoveryReport({
        reportId: report.id,
        adminUserId: ctx.supplierId,
        adminNote: 'Request a shared replacement pickup window.',
      });
    assert.equal(adminResult.outcome, 'REQUESTED');

    const replacementStart = new Date(Date.now() + 24 * 60 * 60_000);
    const replacementEnd = new Date(
      replacementStart.getTime() + 2 * 60 * 60_000,
    );
    await submitNoDriverPickupWindow(ctx.supplierId, first.id, {
      pickupWindowStart: replacementStart.toISOString(),
      pickupWindowEnd: replacementEnd.toISOString(),
      supplierNote: 'Shared replacement window.',
    });

    const [reopenedDelivery, reopenedGroup, reservations] = await Promise.all([
      prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } }),
      prisma.deliveryGroup.findUniqueOrThrow({ where: { id: groupId } }),
      prisma.reservation.findMany({
        where: { id: { in: [first.id, second.id] } },
      }),
    ]);
    assert.equal(reopenedDelivery.status, 'WAITING_FOR_DRIVER');
    assert.equal(reopenedDelivery.assignedDriverProfileId, null);
    assert.equal(reopenedGroup.status, 'OPEN');
    assert.equal(reopenedGroup.assignedDriverProfileId, null);
    assert.equal(
      reservations.every(
        (reservation) =>
          reservation.status === 'ACCEPTED' &&
          reservation.supplierPickupWindowStart?.getTime() ===
            replacementStart.getTime() &&
          reservation.supplierPickupWindowEnd?.getTime() ===
            replacementEnd.getTime(),
      ),
      true,
    );
  });

  test('partial pickup keeps selected items and detaches unpicked with hold', async () => {
    const { first, second, third, groupId, scheduling } =
      await createTripleGroupedReservations(ctx);

    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);
    await acceptDeliveryReservation(ctx, third.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);

    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      data: activePickupWindowReservationUpdate(),
    });
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      data: activeConfirmedDeliveryWindowUpdate(),
    });

    await acceptDelivery(ctx.driverUserId, delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });

    const heldBefore = await getMaterialQuantityState(
      prisma,
      (
        await prisma.reservation.findUniqueOrThrow({
          where: { id: third.id },
          select: { materialId: true },
        })
      ).materialId,
    );
    assert.ok(heldBefore);
    assert.equal(Number(heldBefore.heldQuantity), 1);

    const supplierCode = deriveHandoverCode('supplier-handover', delivery.id);
    const updated = await updateDriverDeliveryStatus(
      ctx.driverUserId,
      delivery.id,
      {
        status: 'PICKED_UP',
        confirmationCode: supplierCode,
        pickedReservationIds: [first.id, second.id],
        unpicked: [
          {
            reservationId: third.id,
            reason: 'MATERIAL_NOT_READY',
            note: 'Supplier still preparing the item',
          },
        ],
      },
    );

    assert.equal(updated.status, 'PICKED_UP');
    assert.equal(updated.itemCount, 2);
    assert.equal(
      updated.items.every((item) =>
        [first.id, second.id].includes(item.reservationId),
      ),
      true,
    );

    const detachedMaterialId = (
      await prisma.reservation.findUniqueOrThrow({
        where: { id: third.id },
        select: { materialId: true },
      })
    ).materialId;

    const [group, detached, carried, assignment, heldAfter] = await Promise.all([
      prisma.deliveryGroup.findUniqueOrThrow({ where: { id: groupId } }),
      prisma.reservation.findUniqueOrThrow({ where: { id: third.id } }),
      prisma.reservation.findMany({
        where: { id: { in: [first.id, second.id] } },
      }),
      prisma.deliveryAssignment.findFirstOrThrow({
        where: { deliveryId: delivery.id },
        orderBy: { acceptedAt: 'desc' },
      }),
      getMaterialQuantityState(prisma, detachedMaterialId),
    ]);

    assert.equal(group.status, 'ASSIGNED');
    assert.equal(group.assignedDriverProfileId, ctx.driverProfileId);
    assert.equal(detached.deliveryGroupId, null);
    assert.equal(detached.status, 'AWAITING_SUPPLIER_CONFIRMATION');
    assert.equal(
      detached.pendingRescheduleReason,
      'DRIVER_PARTIAL_PICKUP_MATERIAL_NOT_READY',
    );
    assert.equal(
      carried.every(
        (reservation) =>
          reservation.status === 'ACCEPTED' &&
          reservation.deliveryGroupId === groupId,
      ),
      true,
    );
    assert.equal(assignment.status, 'ACTIVE');
    assert.ok(heldAfter);
    assert.equal(Number(heldAfter.heldQuantity), 1);

    const operationalStart = new Date(Date.now() - 10 * 60_000);
    const operationalEnd = new Date(Date.now() + 90 * 60_000);
    await setDriverDeliveryWindow(ctx.driverUserId, delivery.id, {
      start: operationalStart.toISOString(),
      end: operationalEnd.toISOString(),
    });

    const scheduledReservations = await prisma.reservation.findMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      select: {
        id: true,
        confirmedDeliveryWindowStart: true,
        confirmedDeliveryWindowEnd: true,
      },
    });
    for (const carriedReservationId of [first.id, second.id]) {
      const scheduled = scheduledReservations.find(
        (reservation) => reservation.id === carriedReservationId,
      );
      assert.equal(
        scheduled?.confirmedDeliveryWindowStart?.getTime(),
        operationalStart.getTime(),
      );
      assert.equal(
        scheduled?.confirmedDeliveryWindowEnd?.getTime(),
        operationalEnd.getTime(),
      );
    }
    const unscheduledDetached = scheduledReservations.find(
      (reservation) => reservation.id === third.id,
    );
    assert.equal(
      unscheduledDetached?.confirmedDeliveryWindowStart?.getTime(),
      detached.confirmedDeliveryWindowStart?.getTime(),
    );
    assert.equal(
      unscheduledDetached?.confirmedDeliveryWindowEnd?.getTime(),
      detached.confirmedDeliveryWindowEnd?.getTime(),
    );

    const replacementStart = new Date(Date.now() + 48 * 60 * 60_000);
    const replacementEnd = new Date(
      replacementStart.getTime() + 2 * 60 * 60_000,
    );
    await submitNoDriverPickupWindow(ctx.supplierId, third.id, {
      pickupWindowStart: replacementStart.toISOString(),
      pickupWindowEnd: replacementEnd.toISOString(),
      supplierNote: 'Replacement item is ready',
    });

    const regrouped = await prisma.reservation.findUniqueOrThrow({
      where: { id: third.id },
    });
    assert.ok(regrouped.deliveryGroupId);
    assert.notEqual(regrouped.deliveryGroupId, groupId);
    ctx.createdGroupIds.push(regrouped.deliveryGroupId!);

    assert.equal(
      regrouped.deliveryFee?.toString(),
      detached.deliveryFee?.toString(),
    );
    assert.equal(
      regrouped.totalAmount?.toString(),
      detached.totalAmount?.toString(),
    );

    const regroupedDelivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: regrouped.deliveryGroupId },
      orderBy: { requestedAt: 'desc' },
    });
    ctx.createdDeliveryIds.push(regroupedDelivery.id);

    assert.equal(regrouped.status, 'ACCEPTED');
    assert.equal(regrouped.pendingRescheduleReason, null);

    const jobs = await listAvailableDeliveries(ctx.driverUserId);
    assert.equal(
      jobs.deliveries.some((job) => job.id === regroupedDelivery.id),
      true,
    );

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

    const afterComplete = await prisma.reservation.findMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      select: { id: true, status: true },
    });
    assert.equal(
      afterComplete.find((row) => row.id === first.id)?.status,
      'COMPLETED',
    );
    assert.equal(
      afterComplete.find((row) => row.id === second.id)?.status,
      'COMPLETED',
    );
    assert.equal(
      afterComplete.find((row) => row.id === third.id)?.status,
      'ACCEPTED',
    );
  });

  test('final grouped return confirms only authoritative carried items atomically', async () => {
    const { first, second, third, groupId, scheduling } =
      await createTripleGroupedReservations(ctx);
    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);
    await acceptDeliveryReservation(ctx, third.id, scheduling);
    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);

    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      data: activePickupWindowReservationUpdate(),
    });
    await acceptDelivery(ctx.driverUserId, delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', delivery.id),
      pickedReservationIds: [first.id, second.id],
      unpicked: [
        {
          reservationId: third.id,
          reason: 'MATERIAL_NOT_READY',
          note: 'Not handed to the driver',
        },
      ],
    });
    const firstWindowStart = new Date(Date.now() - 5 * 60_000);
    const firstWindowEnd = new Date(Date.now() + 60 * 60_000);
    await setDriverDeliveryWindow(ctx.driverUserId, delivery.id, {
      start: firstWindowStart.toISOString(),
      end: firstWindowEnd.toISOString(),
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });
    const retryStart = new Date(Date.now() + 60 * 60_000);
    const retryEnd = new Date(retryStart.getTime() + 60 * 60_000);
    await markDriverDeliveryFailed(ctx.driverUserId, delivery.id, {
      reason: 'ADDRESS_OR_ACCESS_ISSUE',
      learnerContactAttempted: true,
      retryWindowStart: retryStart.toISOString(),
      retryWindowEnd: retryEnd.toISOString(),
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });
    await markDriverDeliveryFailed(ctx.driverUserId, delivery.id, {
      reason: 'ADDRESS_OR_ACCESS_ISSUE',
      learnerContactAttempted: true,
    });

    const before = await prisma.reservation.findMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      select: { id: true, status: true },
    });
    assert.equal(before.find((row) => row.id === first.id)?.status, 'ACCEPTED');
    assert.equal(before.find((row) => row.id === second.id)?.status, 'ACCEPTED');
    assert.equal(
      before.find((row) => row.id === third.id)?.status,
      'AWAITING_SUPPLIER_CONFIRMATION',
    );

    const confirmed = await confirmSupplierDeliveryReturn(
      ctx.supplierId,
      delivery.id,
    );
    assert.equal(confirmed.outcome, 'CONFIRMED');
    assert.equal(confirmed.items.length, 2);
    assert.deepEqual(
      new Set(confirmed.items.map((item) => item.reservationId)),
      new Set([first.id, second.id]),
    );
    const after = await prisma.reservation.findMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      select: { id: true, status: true },
    });
    assert.equal(
      after.find((row) => row.id === first.id)?.status,
      'AWAITING_RESOLUTION',
    );
    assert.equal(
      after.find((row) => row.id === second.id)?.status,
      'AWAITING_RESOLUTION',
    );
    assert.equal(
      after.find((row) => row.id === third.id)?.status,
      'AWAITING_SUPPLIER_CONFIRMATION',
    );
  });

  test('partial recovery joins an existing OPEN group and links its actual primary Delivery', async () => {
    const scenarioArea = `${TEST_MARKER}-recovery-existing-${Date.now()}`;
    const recovery = await prepareDetachedPartialPickupRecovery(
      ctx,
      scenarioArea,
    );
    const candidateMaterial = await createMaterial(ctx, 'recovery candidate');
    const candidateReservation = await createReservation(
      ctx.learnerId,
      deliveryPayload(candidateMaterial.id, recovery.scheduling, {
        dropoffArea: scenarioArea,
      }),
    );
    ctx.createdReservationIds.push(candidateReservation.id);
    assert.ok(candidateReservation.deliveryGroupId);
    ctx.createdGroupIds.push(candidateReservation.deliveryGroupId);
    await acceptDeliveryReservation(
      ctx,
      candidateReservation.id,
      recovery.scheduling,
    );

    const candidateDelivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: candidateReservation.deliveryGroupId },
    });
    ctx.createdDeliveryIds.push(candidateDelivery.id);
    assert.equal(candidateDelivery.reservationId, candidateReservation.id);
    assert.notEqual(candidateDelivery.reservationId, recovery.third.id);

    const originalBefore = await prisma.delivery.findUniqueOrThrow({
      where: { id: recovery.originalDelivery.id },
      select: {
        status: true,
        deliveryGroupId: true,
        reservationId: true,
        assignedDriverProfileId: true,
        pickedUpAt: true,
        updatedAt: true,
      },
    });
    const originalHistoryBefore = await prisma.deliveryStatusHistory.count({
      where: { deliveryId: recovery.originalDelivery.id },
    });
    const replacementStart = new Date(Date.now() + 60 * 60 * 60_000);
    const replacementEnd = new Date(
      replacementStart.getTime() + 2 * 60 * 60_000,
    );
    await submitNoDriverPickupWindow(ctx.supplierId, recovery.third.id, {
      pickupWindowStart: replacementStart.toISOString(),
      pickupWindowEnd: replacementEnd.toISOString(),
      supplierNote: 'Join the compatible recovery group.',
    });

    const [detachedAfter, reportAfter, groupDeliveries, originalAfter] =
      await Promise.all([
        prisma.reservation.findUniqueOrThrow({
          where: { id: recovery.third.id },
        }),
        prisma.noShowReport.findUniqueOrThrow({
          where: { id: recovery.report.id },
        }),
        prisma.delivery.findMany({
          where: { deliveryGroupId: candidateReservation.deliveryGroupId },
        }),
        prisma.delivery.findUniqueOrThrow({
          where: { id: recovery.originalDelivery.id },
          select: {
            status: true,
            deliveryGroupId: true,
            reservationId: true,
            assignedDriverProfileId: true,
            pickedUpAt: true,
            updatedAt: true,
          },
        }),
      ]);

    assert.equal(detachedAfter.deliveryGroupId, candidateReservation.deliveryGroupId);
    assert.equal(groupDeliveries.length, 1);
    assert.equal(groupDeliveries[0]!.id, candidateDelivery.id);
    assert.equal(reportAfter.recoveryDeliveryId, candidateDelivery.id);
    assert.equal(
      reportAfter.recoveryDeliveryGroupId,
      candidateReservation.deliveryGroupId,
    );
    assert.equal(reportAfter.recoveryAction, 'RESERVATION_REGROUPED');
    assert.ok(reportAfter.recoveryCompletedAt);
    assert.deepEqual(originalAfter, originalBefore);
    assert.equal(
      await prisma.deliveryStatusHistory.count({
        where: { deliveryId: recovery.originalDelivery.id },
      }),
      originalHistoryBefore,
    );
  });

  test('partial recovery creates a new group and persists its exact Delivery and group IDs', async () => {
    const scenarioArea = `${TEST_MARKER}-recovery-new-${Date.now()}`;
    const recovery = await prepareDetachedPartialPickupRecovery(
      ctx,
      scenarioArea,
    );
    const replacementStart = new Date(Date.now() + 60 * 60 * 60_000);
    const replacementEnd = new Date(
      replacementStart.getTime() + 2 * 60 * 60_000,
    );
    await submitNoDriverPickupWindow(ctx.supplierId, recovery.third.id, {
      pickupWindowStart: replacementStart.toISOString(),
      pickupWindowEnd: replacementEnd.toISOString(),
    });

    const detachedAfter = await prisma.reservation.findUniqueOrThrow({
      where: { id: recovery.third.id },
    });
    assert.ok(detachedAfter.deliveryGroupId);
    ctx.createdGroupIds.push(detachedAfter.deliveryGroupId);
    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: detachedAfter.deliveryGroupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);
    const reportAfter = await prisma.noShowReport.findUniqueOrThrow({
      where: { id: recovery.report.id },
    });

    assert.equal(reportAfter.recoveryDeliveryId, delivery.id);
    assert.equal(reportAfter.recoveryDeliveryGroupId, detachedAfter.deliveryGroupId);
    assert.equal(reportAfter.recoveryAction, 'RESERVATION_REGROUPED');
    assert.ok(reportAfter.recoveryCompletedAt);
  });

  test('partial recovery persists the exact standalone Delivery when grouping is unavailable', async () => {
    const scenarioArea = `${TEST_MARKER}-recovery-single-${Date.now()}`;
    const recovery = await prepareDetachedPartialPickupRecovery(
      ctx,
      scenarioArea,
    );
    await prisma.reservation.update({
      where: { id: recovery.third.id },
      data: { deliveryZone: null },
    });
    const replacementStart = new Date(Date.now() + 60 * 60 * 60_000);
    const replacementEnd = new Date(
      replacementStart.getTime() + 2 * 60 * 60_000,
    );
    await submitNoDriverPickupWindow(ctx.supplierId, recovery.third.id, {
      pickupWindowStart: replacementStart.toISOString(),
      pickupWindowEnd: replacementEnd.toISOString(),
    });

    const detachedAfter = await prisma.reservation.findUniqueOrThrow({
      where: { id: recovery.third.id },
    });
    assert.equal(detachedAfter.deliveryGroupId, null);
    const delivery = await prisma.delivery.findFirstOrThrow({
      where: {
        reservationId: recovery.third.id,
        deliveryGroupId: null,
        status: 'WAITING_FOR_DRIVER',
      },
      orderBy: { requestedAt: 'desc' },
    });
    ctx.createdDeliveryIds.push(delivery.id);
    const reportAfter = await prisma.noShowReport.findUniqueOrThrow({
      where: { id: recovery.report.id },
    });

    assert.equal(reportAfter.recoveryDeliveryId, delivery.id);
    assert.equal(reportAfter.recoveryDeliveryGroupId, null);
    assert.equal(reportAfter.recoveryAction, 'REPLACEMENT_WINDOW_SUBMITTED');
    assert.ok(reportAfter.recoveryCompletedAt);
  });

  test('partial recovery failure rolls back reservation, report, group, Delivery, and history writes', async () => {
    const scenarioArea = `${TEST_MARKER}-recovery-rollback-${Date.now()}`;
    const recovery = await prepareDetachedPartialPickupRecovery(
      ctx,
      scenarioArea,
    );
    await prisma.reservation.update({
      where: { id: recovery.third.id },
      data: { deliveryAddressText: null },
    });
    const [reservationBefore, reportBefore, reservationHistoryBefore,
      originalHistoryBefore, scenarioGroupCountBefore, deliveryCountBefore] =
      await Promise.all([
        prisma.reservation.findUniqueOrThrow({
          where: { id: recovery.third.id },
        }),
        prisma.noShowReport.findUniqueOrThrow({
          where: { id: recovery.report.id },
        }),
        prisma.reservationStatusHistory.count({
          where: { reservationId: recovery.third.id },
        }),
        prisma.deliveryStatusHistory.count({
          where: { deliveryId: recovery.originalDelivery.id },
        }),
        prisma.deliveryGroup.count({
          where: { dropoffArea: scenarioArea, status: 'OPEN' },
        }),
        prisma.delivery.count({
          where: { reservationId: recovery.third.id },
        }),
      ]);
    const replacementStart = new Date(Date.now() + 60 * 60 * 60_000);

    await assert.rejects(
      () =>
        submitNoDriverPickupWindow(ctx.supplierId, recovery.third.id, {
          pickupWindowStart: replacementStart.toISOString(),
          pickupWindowEnd: new Date(
            replacementStart.getTime() + 2 * 60 * 60_000,
          ).toISOString(),
        }),
      /Delivery address is required/,
    );

    const [reservationAfter, reportAfter] = await Promise.all([
      prisma.reservation.findUniqueOrThrow({
        where: { id: recovery.third.id },
      }),
      prisma.noShowReport.findUniqueOrThrow({
        where: { id: recovery.report.id },
      }),
    ]);
    assert.deepEqual(reservationAfter, reservationBefore);
    assert.deepEqual(reportAfter, reportBefore);
    assert.equal(
      await prisma.deliveryGroup.count({
        where: { dropoffArea: scenarioArea, status: 'OPEN' },
      }),
      scenarioGroupCountBefore,
    );
    assert.equal(
      await prisma.delivery.count({
        where: { reservationId: recovery.third.id },
      }),
      deliveryCountBefore,
    );
    assert.equal(
      await prisma.reservationStatusHistory.count({
        where: { reservationId: recovery.third.id },
      }),
      reservationHistoryBefore,
    );
    assert.equal(
      await prisma.deliveryStatusHistory.count({
        where: { deliveryId: recovery.originalDelivery.id },
      }),
      originalHistoryBefore,
    );
  });

  test('invalid confirmation code does not split the group', async () => {
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
    await acceptDelivery(ctx.driverUserId, delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });

    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
          status: 'PICKED_UP',
          confirmationCode: '000000',
          pickedReservationIds: [first.id],
          unpicked: [{ reservationId: second.id, reason: 'WRONG_ITEM' }],
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 400 &&
        error.code === 'INVALID_CONFIRMATION_CODE',
    );

    const [deliveryAfter, reservations] = await Promise.all([
      prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } }),
      prisma.reservation.findMany({
        where: { id: { in: [first.id, second.id] } },
      }),
    ]);
    assert.equal(deliveryAfter.status, 'ARRIVED_PICKUP');
    assert.equal(
      reservations.every(
        (reservation) =>
          reservation.status === 'ACCEPTED' &&
          reservation.deliveryGroupId === groupId,
      ),
      true,
    );
  });

  test('zero selected is rejected and the existing full pickup failure handles all items', async () => {
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
    await acceptDelivery(ctx.driverUserId, delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });

    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
          status: 'PICKED_UP',
          confirmationCode: deriveHandoverCode(
            'supplier-handover',
            delivery.id,
          ),
          pickedReservationIds: [],
          unpicked: [
            { reservationId: first.id, reason: 'MATERIAL_MISSING' },
            { reservationId: second.id, reason: 'MATERIAL_MISSING' },
          ],
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_PARTIAL_PICKUP_SELECTION_INVALID',
    );

    const expiredEnd = new Date(Date.now() - 31 * 60_000);
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { supplierPickupWindowEnd: expiredEnd },
    });
    await markDriverPickupFailed(ctx.driverUserId, delivery.id, {
      reason: 'MATERIAL_NOT_READY',
      note: 'No grouped item was handed over.',
    });

    const [failedDelivery, cancelledGroup, reservations, assignment] =
      await Promise.all([
        prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } }),
        prisma.deliveryGroup.findUniqueOrThrow({ where: { id: groupId } }),
        prisma.reservation.findMany({
          where: { id: { in: [first.id, second.id] } },
        }),
        prisma.deliveryAssignment.findFirstOrThrow({
          where: { deliveryId: delivery.id },
          orderBy: { acceptedAt: 'desc' },
        }),
      ]);
    assert.equal(failedDelivery.status, 'FAILED_PICKUP');
    assert.equal(cancelledGroup.status, 'CANCELLED');
    assert.equal(cancelledGroup.assignedDriverProfileId, null);
    assert.equal(
      reservations.every(
        (reservation) =>
          reservation.status === 'AWAITING_RESOLUTION' &&
          reservation.deliveryGroupId === groupId,
      ),
      true,
    );
    assert.equal(assignment.status, 'RELEASED');
  });

  test('duplicate or unrelated partial pickup ids are rejected', async () => {
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
    await acceptDelivery(ctx.driverUserId, delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });

    const supplierCode = deriveHandoverCode('supplier-handover', delivery.id);
    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
          status: 'PICKED_UP',
          confirmationCode: supplierCode,
          pickedReservationIds: [first.id, first.id],
          unpicked: [{ reservationId: second.id, reason: 'OTHER' }],
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_PARTIAL_PICKUP_SELECTION_INVALID',
    );
    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
          status: 'PICKED_UP',
          confirmationCode: supplierCode,
          pickedReservationIds: [first.id, 'missing-reservation'],
          unpicked: [{ reservationId: second.id, reason: 'OTHER' }],
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'DRIVER_PARTIAL_PICKUP_SELECTION_INVALID',
    );
  });

  test('post-pickup failure affects only carried reservations after split', async () => {
    const { first, second, third, groupId, scheduling } =
      await createTripleGroupedReservations(ctx);
    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);
    await acceptDeliveryReservation(ctx, third.id, scheduling);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      data: {
        ...activePickupWindowReservationUpdate(),
        ...activeConfirmedDeliveryWindowUpdate(),
      },
    });
    await acceptDelivery(ctx.driverUserId, delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });

    const supplierCode = deriveHandoverCode('supplier-handover', delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'PICKED_UP',
      confirmationCode: supplierCode,
      pickedReservationIds: [first.id, second.id],
      unpicked: [
        {
          reservationId: third.id,
          reason: 'MATERIAL_NOT_READY',
          note: 'Still pending at supplier',
        },
      ],
    });

    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ON_THE_WAY',
    });

    const { markDriverIssueAfterPickup } = await import(
      '../fulfillment-failures/fulfillment-failures.service.js'
    );
    await markDriverIssueAfterPickup(ctx.driverUserId, delivery.id, {
      note: 'Vehicle issue after split pickup',
    });

    const reservations = await prisma.reservation.findMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      select: { id: true, status: true, deliveryGroupId: true },
    });
    assert.equal(
      reservations.find((row) => row.id === first.id)?.status,
      'AWAITING_RESOLUTION',
    );
    assert.equal(
      reservations.find((row) => row.id === second.id)?.status,
      'AWAITING_RESOLUTION',
    );
    assert.equal(
      reservations.find((row) => row.id === third.id)?.status,
      'AWAITING_SUPPLIER_CONFIRMATION',
    );
    assert.equal(
      reservations.find((row) => row.id === third.id)?.deliveryGroupId,
      null,
    );
  });

  test('all-selected partial pickup rejects an attached member with unexpected state and fully rolls back', async () => {
    const { first, second, third, groupId, delivery, reservationIds } =
      await prepareTripleGroupedPickup(ctx);

    await prisma.reservation.update({
      where: { id: third.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    const before = await groupedPickupStateSnapshot({
      deliveryId: delivery.id,
      groupId,
      reservationIds,
      driverProfileId: ctx.driverProfileId,
    });

    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
          status: 'PICKED_UP',
          confirmationCode: deriveHandoverCode(
            'supplier-handover',
            delivery.id,
          ),
          pickedReservationIds: [first.id, second.id],
          unpicked: [],
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'DRIVER_GROUPED_DELIVERY_SPLIT_CONFLICT',
    );

    const after = await groupedPickupStateSnapshot({
      deliveryId: delivery.id,
      groupId,
      reservationIds,
      driverProfileId: ctx.driverProfileId,
    });
    assert.deepEqual(after, before);
    assert.equal(after.delivery.status, 'ARRIVED_PICKUP');
    assert.equal(after.group.status, 'ASSIGNED');
    assert.equal(after.assignments.length, 1);
    assert.equal(after.assignments[0]?.status, 'ACTIVE');
  });

  test('legacy full grouped pickup rejects an unexpected member state and fully rolls back', async () => {
    const { third, groupId, delivery, reservationIds } =
      await prepareTripleGroupedPickup(ctx);

    await prisma.reservation.update({
      where: { id: third.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    const before = await groupedPickupStateSnapshot({
      deliveryId: delivery.id,
      groupId,
      reservationIds,
      driverProfileId: ctx.driverProfileId,
    });

    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
          status: 'PICKED_UP',
          confirmationCode: deriveHandoverCode(
            'supplier-handover',
            delivery.id,
          ),
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.statusCode === 409 &&
        error.code === 'DRIVER_GROUPED_DELIVERY_SPLIT_CONFLICT',
    );

    const after = await groupedPickupStateSnapshot({
      deliveryId: delivery.id,
      groupId,
      reservationIds,
      driverProfileId: ctx.driverProfileId,
    });
    assert.deepEqual(after, before);
    assert.equal(after.delivery.status, 'ARRIVED_PICKUP');
  });

  test('valid all-selected partial contract completes the full grouped pickup', async () => {
    const { first, second, third, groupId, delivery, reservationIds } =
      await prepareTripleGroupedPickup(ctx);

    const updated = await updateDriverDeliveryStatus(
      ctx.driverUserId,
      delivery.id,
      {
        status: 'PICKED_UP',
        confirmationCode: deriveHandoverCode(
          'supplier-handover',
          delivery.id,
        ),
        pickedReservationIds: [first.id, second.id, third.id],
        unpicked: [],
      },
    );

    assert.equal(updated.status, 'PICKED_UP');
    assert.equal(updated.itemCount, 3);
    const [group, reservations] = await Promise.all([
      prisma.deliveryGroup.findUniqueOrThrow({ where: { id: groupId } }),
      prisma.reservation.findMany({
        where: { id: { in: reservationIds } },
        select: { status: true, fulfillmentMethod: true, deliveryGroupId: true },
      }),
    ]);
    assert.equal(group.status, 'ASSIGNED');
    assert.equal(group.assignedDriverProfileId, ctx.driverProfileId);
    assert.equal(
      reservations.every(
        (reservation) =>
          reservation.status === 'ACCEPTED' &&
          reservation.fulfillmentMethod === 'DELIVERY' &&
          reservation.deliveryGroupId === groupId,
      ),
      true,
    );
  });

  test('valid legacy full grouped pickup succeeds without selection fields', async () => {
    const { groupId, delivery, reservationIds } =
      await prepareTripleGroupedPickup(ctx);

    const updated = await updateDriverDeliveryStatus(
      ctx.driverUserId,
      delivery.id,
      {
        status: 'PICKED_UP',
        confirmationCode: deriveHandoverCode(
          'supplier-handover',
          delivery.id,
        ),
      },
    );

    assert.equal(updated.status, 'PICKED_UP');
    assert.equal(updated.itemCount, 3);
    const [group, reservations] = await Promise.all([
      prisma.deliveryGroup.findUniqueOrThrow({ where: { id: groupId } }),
      prisma.reservation.findMany({
        where: { id: { in: reservationIds } },
        select: { status: true, fulfillmentMethod: true, deliveryGroupId: true },
      }),
    ]);
    assert.equal(group.status, 'ASSIGNED');
    assert.equal(group.assignedDriverProfileId, ctx.driverProfileId);
    assert.equal(
      reservations.every(
        (reservation) =>
          reservation.status === 'ACCEPTED' &&
          reservation.fulfillmentMethod === 'DELIVERY' &&
          reservation.deliveryGroupId === groupId,
      ),
      true,
    );
  });

  test('whole grouped pickup failure fails closed on mixed reservation state', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);
    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);
    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);
    await acceptDelivery(ctx.driverUserId, delivery.id);

    const expiredEnd = new Date(Date.now() - 2 * 60 * 60_000);
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: {
        supplierPickupWindowStart: new Date(expiredEnd.getTime() - 60 * 60_000),
        supplierPickupWindowEnd: expiredEnd,
      },
    });
    await prisma.reservation.update({
      where: { id: second.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    const [deliveryHistoryBefore, reservationHistoryBefore, holdBefore] =
      await Promise.all([
        prisma.deliveryStatusHistory.count({ where: { deliveryId: delivery.id } }),
        prisma.reservationStatusHistory.count({
          where: { reservationId: { in: [first.id, second.id] } },
        }),
        getMaterialQuantityState(
          prisma,
          (
            await prisma.reservation.findUniqueOrThrow({
              where: { id: second.id },
              select: { materialId: true },
            })
          ).materialId,
        ),
      ]);

    await assert.rejects(
      () =>
        markDriverPickupFailed(ctx.driverUserId, delivery.id, {
          reason: 'MATERIAL_NOT_READY',
          note: 'Must reject the mixed group.',
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'GROUPED_DELIVERY_STATE_CONFLICT',
    );

    const [afterDelivery, afterGroup, afterAssignment, statuses, holdAfter] =
      await Promise.all([
        prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } }),
        prisma.deliveryGroup.findUniqueOrThrow({ where: { id: groupId } }),
        prisma.deliveryAssignment.findFirstOrThrow({
          where: { deliveryId: delivery.id },
          orderBy: { acceptedAt: 'desc' },
        }),
        prisma.reservation.findMany({
          where: { id: { in: [first.id, second.id] } },
          select: { id: true, status: true },
        }),
        getMaterialQuantityState(
          prisma,
          (
            await prisma.reservation.findUniqueOrThrow({
              where: { id: second.id },
              select: { materialId: true },
            })
          ).materialId,
        ),
      ]);

    assert.equal(afterDelivery.status, 'DRIVER_ASSIGNED');
    assert.equal(afterGroup.status, 'ASSIGNED');
    assert.equal(afterAssignment.status, 'ACTIVE');
    assert.equal(statuses.find((row) => row.id === first.id)?.status, 'ACCEPTED');
    assert.equal(
      statuses.find((row) => row.id === second.id)?.status,
      'AWAITING_RESOLUTION',
    );
    assert.equal(
      await prisma.deliveryStatusHistory.count({ where: { deliveryId: delivery.id } }),
      deliveryHistoryBefore,
    );
    assert.equal(
      await prisma.reservationStatusHistory.count({
        where: { reservationId: { in: [first.id, second.id] } },
      }),
      reservationHistoryBefore,
    );
    assert.equal(holdAfter?.heldQuantity.toString(), holdBefore?.heldQuantity.toString());
  });

  test('grouped failure rejects primary membership and Driver ownership mismatches', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);
    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);
    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);
    await acceptDelivery(ctx.driverUserId, delivery.id);
    const expiredEnd = new Date(Date.now() - 2 * 60 * 60_000);
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { supplierPickupWindowEnd: expiredEnd },
    });

    const unrelatedMaterial = await createMaterial(ctx, 'unrelated-primary');
    const unrelated = await createReservation(
      ctx.learnerId,
      deliveryPayload(unrelatedMaterial.id, buildFeasibleDeliveryScheduling(72)),
    );
    ctx.createdReservationIds.push(unrelated.id);
    if (unrelated.deliveryGroupId) ctx.createdGroupIds.push(unrelated.deliveryGroupId);
    await prisma.reservation.update({
      where: { id: unrelated.id },
      data: { status: 'ACCEPTED' },
    });

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { reservationId: unrelated.id },
    });
    await assert.rejects(
      () =>
        markDriverPickupFailed(ctx.driverUserId, delivery.id, {
          reason: 'OTHER',
          note: 'Primary must belong to the group.',
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'GROUPED_DELIVERY_STATE_CONFLICT',
    );

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { reservationId: first.id },
    });
    await prisma.deliveryGroup.update({
      where: { id: groupId },
      data: { assignedDriverProfileId: null },
    });
    await assert.rejects(
      () =>
        markDriverPickupFailed(ctx.driverUserId, delivery.id, {
          reason: 'OTHER',
          note: 'Group and Delivery Driver must match.',
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'GROUPED_DELIVERY_STATE_CONFLICT',
    );
    const assignment = await prisma.deliveryAssignment.findFirstOrThrow({
      where: { deliveryId: delivery.id },
      orderBy: { acceptedAt: 'desc' },
    });
    assert.equal(assignment.status, 'ACTIVE');
  });

  test('post-pickup failure and Driver issue fail closed on mixed carried state', async () => {
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
      data: {
        ...activePickupWindowReservationUpdate(),
        confirmedDeliveryWindowStart: new Date(Date.now() - 3 * 60 * 60_000),
        confirmedDeliveryWindowEnd: new Date(Date.now() - 2 * 60 * 60_000),
      },
    });
    await acceptDelivery(ctx.driverUserId, delivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', delivery.id),
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });
    await prisma.reservation.update({
      where: { id: second.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });
    const historyBefore = await prisma.deliveryStatusHistory.count({
      where: { deliveryId: delivery.id },
    });

    for (const operation of [
      () =>
        markDriverDeliveryFailed(ctx.driverUserId, delivery.id, {
          reason: 'ADDRESS_ISSUE',
          note: 'Mixed carried state.',
        }),
      () =>
        markDriverIssueAfterPickup(ctx.driverUserId, delivery.id, {
          note: 'Mixed carried state.',
        }),
    ]) {
      await assert.rejects(
        operation,
        (error: unknown) =>
          error instanceof AppError &&
          error.code === 'GROUPED_DELIVERY_STATE_CONFLICT',
      );
    }

    const after = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    assert.equal(after.status, 'ARRIVED_DROPOFF');
    assert.equal(after.assignedDriverProfileId, ctx.driverProfileId);
    assert.equal(
      await prisma.deliveryStatusHistory.count({ where: { deliveryId: delivery.id } }),
      historyBefore,
    );
  });

  test('partial incident is actionable and replacement never reopens history', async () => {
    const { first, second, third, groupId, scheduling } =
      await createTripleGroupedReservations(ctx);
    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);
    await acceptDeliveryReservation(ctx, third.id, scheduling);
    const carryingDelivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(carryingDelivery.id);
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id, third.id] } },
      data: activePickupWindowReservationUpdate(),
    });
    await acceptDelivery(ctx.driverUserId, carryingDelivery.id);
    await updateDriverDeliveryStatus(ctx.driverUserId, carryingDelivery.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverUserId, carryingDelivery.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode(
        'supplier-handover',
        carryingDelivery.id,
      ),
      pickedReservationIds: [first.id, second.id],
      unpicked: [
        {
          reservationId: third.id,
          reason: 'WRONG_ITEM',
          note: 'Different model was presented.',
        },
      ],
    });

    const reports = await prisma.noShowReport.findMany({
      where: { reservationId: third.id, reasonCode: 'PICKUP_FAILED' },
    });
    assert.equal(reports.length, 1);
    assert.equal(reports[0]!.deliveryId, carryingDelivery.id);
    assert.equal(reports[0]!.reporterUserId, ctx.driverUserId);
    assert.match(reports[0]!.note ?? '', /originalDeliveryGroupId=/);
    assert.match(reports[0]!.note ?? '', /reason=WRONG_ITEM/);

    const originalDeliverySnapshot = await prisma.delivery.findUniqueOrThrow({
      where: { id: carryingDelivery.id },
    });
    const historicalStatuses = ['DELIVERED', 'FAILED_PICKUP'] as const;
    const historicalIds: string[] = [];
    for (const status of historicalStatuses) {
      const historical = await prisma.delivery.create({
        data: {
          reservationId: third.id,
          pickupLocationId: carryingDelivery.pickupLocationId,
          dropoffLocationId: carryingDelivery.dropoffLocationId,
          requestedByUserId: ctx.learnerId,
          status,
          failureReason: status === 'FAILED_PICKUP' ? 'Historical failure' : null,
        },
      });
      historicalIds.push(historical.id);
    }

    const adminResult = await requestSupplierRescheduleForPickupRecoveryReport({
      reportId: reports[0]!.id,
      adminUserId: ctx.supplierId,
      adminNote: 'Supplier must provide the correct item window.',
    });
    assert.equal(adminResult.outcome, 'REQUESTED');

    const replacementStart = new Date(Date.now() + 48 * 60 * 60_000);
    const replacementEnd = new Date(replacementStart.getTime() + 2 * 60 * 60_000);
    await submitNoDriverPickupWindow(ctx.supplierId, third.id, {
      pickupWindowStart: replacementStart.toISOString(),
      pickupWindowEnd: replacementEnd.toISOString(),
      supplierNote: 'Correct item is ready.',
    });

    const [carryingAfter, historiesAfter, detached, hold] = await Promise.all([
      prisma.delivery.findUniqueOrThrow({ where: { id: carryingDelivery.id } }),
      prisma.delivery.findMany({
        where: { id: { in: historicalIds } },
        orderBy: { status: 'asc' },
      }),
      prisma.reservation.findUniqueOrThrow({ where: { id: third.id } }),
      getMaterialQuantityState(
        prisma,
        (
          await prisma.reservation.findUniqueOrThrow({
            where: { id: third.id },
            select: { materialId: true },
          })
        ).materialId,
      ),
    ]);

    assert.equal(carryingAfter.status, originalDeliverySnapshot.status);
    assert.equal(carryingAfter.assignedDriverProfileId, ctx.driverProfileId);
    assert.deepEqual(
      historiesAfter.map((delivery) => delivery.status).sort(),
      [...historicalStatuses].sort(),
    );
    assert.equal(detached.status, 'ACCEPTED');
    assert.ok(detached.deliveryGroupId);
    ctx.createdGroupIds.push(detached.deliveryGroupId!);
    const replacementDelivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: detached.deliveryGroupId },
    });
    ctx.createdDeliveryIds.push(replacementDelivery.id);
    assert.equal(replacementDelivery.status, 'WAITING_FOR_DRIVER');
    assert.equal(historicalIds.includes(replacementDelivery.id), false);
    assert.equal(Number(hold?.heldQuantity), 1);
    await prisma.delivery.deleteMany({ where: { id: { in: historicalIds } } });
  });

  test('mixed-state Admin cancel and supplier shared-window recovery fail closed', async () => {
    const { first, second, groupId, scheduling } =
      await createGroupedReservations(ctx);
    await acceptDeliveryReservation(ctx, first.id, scheduling);
    await acceptDeliveryReservation(ctx, second.id, scheduling);
    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { deliveryGroupId: groupId },
    });
    ctx.createdDeliveryIds.push(delivery.id);
    await acceptDelivery(ctx.driverUserId, delivery.id);
    const expiredEnd = new Date(Date.now() - 2 * 60 * 60_000);
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: { supplierPickupWindowEnd: expiredEnd },
    });
    await markDriverPickupFailed(ctx.driverUserId, delivery.id, {
      reason: 'MATERIAL_NOT_READY',
      note: 'Create recovery state for mixed-state checks.',
    });
    const report = await prisma.noShowReport.findFirstOrThrow({
      where: { deliveryId: delivery.id, reasonCode: 'PICKUP_FAILED' },
    });
    await prisma.reservation.update({
      where: { id: second.id },
      data: { status: 'ACCEPTED' },
    });

    await assert.rejects(
      () =>
        requestSupplierRescheduleForPickupRecoveryReport({
          reportId: report.id,
          adminUserId: ctx.supplierId,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'GROUPED_DELIVERY_STATE_CONFLICT',
    );

    await assert.rejects(
      () =>
        cancelAndReleaseHoldForPickupRecoveryReport({
          reportId: report.id,
          adminUserId: ctx.supplierId,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'GROUPED_DELIVERY_STATE_CONFLICT',
    );

    await prisma.reservation.update({
      where: { id: second.id },
      data: {
        status: 'AWAITING_SUPPLIER_CONFIRMATION',
        pendingRescheduleRequestedBy: 'SUPPLIER',
        pendingRescheduleReason: 'STALE_PICKUP_ADMIN_REQUEST',
      },
    });
    await prisma.reservation.update({
      where: { id: first.id },
      data: {
        status: 'AWAITING_SUPPLIER_CONFIRMATION',
        pendingRescheduleRequestedBy: 'SUPPLIER',
        pendingRescheduleReason: 'STALE_PICKUP_ADMIN_REQUEST',
      },
    });
    await prisma.reservation.update({
      where: { id: second.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    const replacementStart = new Date(Date.now() + 48 * 60 * 60_000);
    await assert.rejects(
      () =>
        submitNoDriverPickupWindow(ctx.supplierId, first.id, {
          pickupWindowStart: replacementStart.toISOString(),
          pickupWindowEnd: new Date(
            replacementStart.getTime() + 2 * 60 * 60_000,
          ).toISOString(),
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'GROUPED_DELIVERY_STATE_CONFLICT',
    );

    const unchangedDelivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
    });
    assert.equal(unchangedDelivery.status, 'FAILED_PICKUP');
  });
});
