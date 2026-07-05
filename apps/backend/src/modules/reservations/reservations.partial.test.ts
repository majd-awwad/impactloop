import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import { hashPassword } from '../../utils/password.js';
import { updateDriverDeliveryStatus } from '../driver/driver.service.js';
import { requestDeliveryForReservation } from '../deliveries/deliveries.service.js';
import { getMaterialById } from '../materials/materials.service.js';
import {
  acceptSupplierReservation,
  completeSupplierReservation,
  declineSupplierReservation,
} from '../supplier-reservations/supplier-reservations.service.js';

import {
  cancelReservation,
  createReservation,
} from './reservations.service.js';
import type { CreateReservationInput } from './reservations.validation.js';
import {
  activeConfirmedDeliveryWindowUpdate,
  activePickupWindowReservationUpdate,
} from '../../test-utils/handover-test-windows.js';

const TEST_MARKER = '[test-partial-reservations]';

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

async function acceptWithLearnerPreferredWindow(
  supplierId: string,
  reservation: Awaited<ReturnType<typeof createReservation>>,
) {
  const window = reservation.learnerPreferredPickupWindows[0];
  assert.ok(window, 'preferred pickup window required');

  const accepted = await acceptSupplierReservation(supplierId, reservation.id, {
    pickupWindowStart: window.start,
    pickupWindowEnd: window.end,
  });

  await prisma.reservation.update({
    where: { id: reservation.id },
    data: activePickupWindowReservationUpdate(),
  });

  return accepted;
}

type TestContext = {
  learnerId: string;
  learnerTwoId: string;
  supplierId: string;
  driverId: string;
  driverProfileId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
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
                  displayName: `${TEST_MARKER} ${input.displayName}`,
                  phone: `+97059${Math.floor(Math.random() * 1000000)
                      .toString()
                      .padStart(6, '0')}`,
                  city: 'Ramallah',
                  area: 'Downtown',
                  transportationType: 'BICYCLE',
                  vehicleType: 'BICYCLE',
                  status: 'ACTIVE',
                  availability: 'AVAILABLE',
                },
              },
            }),
    },
    select: { id: true, driverProfile: { select: { id: true } } },
  });
}

async function createMaterial(ctx: TestContext, quantity = 10) {
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
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: 'Partial quantity test material',
      materialType: 'Test material',
      quantity,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      deliveryAllowed: true,
      isFree: true,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdDeliveryIds.length) {
    await prisma.deliveryLocationPing.deleteMany({
      where: { deliveryId: { in: ctx.createdDeliveryIds } },
    });
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

  if (ctx.createdMaterialIds.length) {
    await prisma.material.deleteMany({
      where: { id: { in: ctx.createdMaterialIds } },
    });
  }

  if (ctx.locationId) {
    await prisma.location.deleteMany({ where: { id: ctx.locationId } });
  }

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

const deliveryInput = () => ({
  dropoffLocation: {
    country: 'Palestine',
    city: 'Ramallah',
    area: 'Downtown',
    addressLine: 'Main Street 1',
    visibility: 'PRIVATE' as const,
    isApproximate: false,
  },
});

describe('partial quantity reservations', () => {
  const ctx: TestContext = {
    learnerId: '',
    learnerTwoId: '',
    supplierId: '',
    driverId: '',
    driverProfileId: '',
    categoryId: '',
    locationId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdReservationIds: [],
    createdDeliveryIds: [],
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
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
      displayName: 'learner one',
      emailSuffix: 'learner-one',
      role: 'LEARNER',
    });
    const learnerTwo = await createUser({
      displayName: 'learner two',
      emailSuffix: 'learner-two',
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

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.learnerId = learner.id;
    ctx.learnerTwoId = learnerTwo.id;
    ctx.supplierId = supplier.id;
    ctx.driverId = driver.id;
    ctx.driverProfileId = driver.driverProfile!.id;
    ctx.createdUserIds.push(
      learner.id,
      learnerTwo.id,
      supplier.id,
      driver.id,
    );
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('two learners can reserve non-overlapping quantities', async () => {
    const material = await createMaterial(ctx, 10);

    const first = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 3),
    );
    const second = await createReservation(
      ctx.learnerTwoId,
      pickupReservationPayload(material.id, 4),
    );
    ctx.createdReservationIds.push(first.id, second.id);

    const detail = await getMaterialById(material.id);
    assert.equal(detail.quantity, 10);
    assert.equal(detail.availableQuantity, 3);
    assert.equal(detail.status, 'AVAILABLE');
  });

  test('cannot reserve more than available quantity', async () => {
    const material = await createMaterial(ctx, 5);
    const first = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 4),
    );
    ctx.createdReservationIds.push(first.id);

    await assert.rejects(
      () =>
        createReservation(
          ctx.learnerTwoId,
          pickupReservationPayload(material.id, 2),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  test('cancel pending reservation releases hold and restores availability', async () => {
    const material = await createMaterial(ctx, 6);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 4),
    );
    ctx.createdReservationIds.push(reservation.id);

    const cancelled = await cancelReservation(ctx.learnerId, reservation.id);
    assert.equal(cancelled.status, 'CANCELLED');

    const detail = await getMaterialById(material.id);
    assert.equal(detail.availableQuantity, 6);
    assert.equal(detail.status, 'AVAILABLE');
  });

  test('cannot cancel accepted reservation', async () => {
    const material = await createMaterial(ctx, 5);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 2),
    );
    ctx.createdReservationIds.push(reservation.id);

    await acceptWithLearnerPreferredWindow(ctx.supplierId, reservation);

    await assert.rejects(
      () => cancelReservation(ctx.learnerId, reservation.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('cannot cancel completed reservation', async () => {
    const material = await createMaterial(ctx, 5);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 2),
    );
    ctx.createdReservationIds.push(reservation.id);

    await acceptWithLearnerPreferredWindow(ctx.supplierId, reservation);
    await completeSupplierReservation(ctx.supplierId, reservation.id, {
      confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
    });

    await assert.rejects(
      () => cancelReservation(ctx.learnerId, reservation.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('supplier decline releases hold without decrementing quantity', async () => {
    const material = await createMaterial(ctx, 8);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 3),
    );
    ctx.createdReservationIds.push(reservation.id);

    await declineSupplierReservation(ctx.supplierId, reservation.id, {
      reason: 'Not available',
    });

    const stored = await prisma.material.findUnique({
      where: { id: material.id },
      select: { quantity: true, status: true },
    });
    assert.equal(Number(stored?.quantity), 8);
    assert.equal(stored?.status, 'AVAILABLE');
  });

  test('supplier accept does not decrement material quantity', async () => {
    const material = await createMaterial(ctx, 8);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 3),
    );
    ctx.createdReservationIds.push(reservation.id);

    await acceptWithLearnerPreferredWindow(ctx.supplierId, reservation);

    const stored = await prisma.material.findUnique({
      where: { id: material.id },
      select: { quantity: true, status: true },
    });
    assert.equal(Number(stored?.quantity), 8);
    assert.equal(stored?.status, 'AVAILABLE');

    const detail = await getMaterialById(material.id);
    assert.equal(detail.availableQuantity, 5);
  });

  test('supplier complete subtracts quantity and keeps material available when stock remains', async () => {
    const material = await createMaterial(ctx, 8);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 3),
    );
    ctx.createdReservationIds.push(reservation.id);

    await acceptWithLearnerPreferredWindow(ctx.supplierId, reservation);

    const completed = await completeSupplierReservation(
      ctx.supplierId,
      reservation.id,
      {
        confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
      },
    );
    assert.equal(completed.status, 'COMPLETED');

    const stored = await prisma.material.findUnique({
      where: { id: material.id },
      select: {
        quantity: true,
        status: true,
        reusedAt: true,
        reusedByReservationId: true,
      },
    });
    assert.equal(Number(stored?.quantity), 5);
    assert.equal(stored?.status, 'AVAILABLE');
    assert.equal(stored?.reusedByReservationId, null);
    assert.equal(stored?.reusedAt, null);
  });

  test('supplier complete sets reused only when remaining quantity reaches zero', async () => {
    const material = await createMaterial(ctx, 3);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 3),
    );
    ctx.createdReservationIds.push(reservation.id);

    await acceptWithLearnerPreferredWindow(ctx.supplierId, reservation);
    await completeSupplierReservation(ctx.supplierId, reservation.id, {
      confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
    });

    const stored = await prisma.material.findUnique({
      where: { id: material.id },
      select: {
        quantity: true,
        status: true,
        reusedByReservationId: true,
      },
    });
    assert.equal(Number(stored?.quantity), 0);
    assert.equal(stored?.status, 'REUSED');
    assert.equal(stored?.reusedByReservationId, reservation.id);
  });

  test('driver delivered subtracts quantity with same rules', async () => {
    const material = await createMaterial(ctx, 7);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 2),
    );
    ctx.createdReservationIds.push(reservation.id);

    await acceptWithLearnerPreferredWindow(ctx.supplierId, reservation);

    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    ctx.createdDeliveryIds.push(delivery.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: activeConfirmedDeliveryWindowUpdate(),
    });

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        assignedDriverProfileId: ctx.driverProfileId,
        status: 'ARRIVED_DROPOFF',
      },
    });

    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'DELIVERED',
      confirmationCode: deriveHandoverCode('learner-delivery', delivery.id),
    });

    const stored = await prisma.material.findUnique({
      where: { id: material.id },
      select: { quantity: true, status: true },
    });
    assert.equal(Number(stored?.quantity), 5);
    assert.equal(stored?.status, 'AVAILABLE');
  });

  test('concurrent reservations for last available quantity allow only one success', async () => {
    const material = await createMaterial(ctx, 2);

    const results = await Promise.allSettled([
      createReservation(
        ctx.learnerId,
        pickupReservationPayload(material.id, 2),
      ),
      createReservation(
        ctx.learnerTwoId,
        pickupReservationPayload(material.id, 1),
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    ctx.createdReservationIds.push(fulfilled[0]!.value.id);
  });
});
