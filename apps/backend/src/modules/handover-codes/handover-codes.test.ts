import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  deriveHandoverCode,
  ensureDeliveryHandoverCodesStored,
  ensureSelfPickupCodeStored,
  verifyHandoverCode,
} from '../../utils/handover-codes.js';
import { hashPassword } from '../../utils/password.js';
import { createReservation } from '../reservations/reservations.service.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';
import {
  acceptDelivery,
  updateDriverDeliveryStatus,
} from '../driver/driver.service.js';
import {
  completeSupplierReservation,
  listSupplierReservations,
} from '../supplier-reservations/supplier-reservations.service.js';
import { acceptSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';
import { listMyReservations } from '../reservations/reservations.service.js';
import { getMyDelivery } from '../deliveries/deliveries.service.js';
import {
  activeConfirmedDeliveryWindowUpdate,
  activePickupWindowReservationUpdate,
} from '../../test-utils/handover-test-windows.js';

const TEST_MARKER = '[test-handover-codes]';

function futurePreferredWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

type TestContext = {
  supplierId: string;
  otherSupplierId: string;
  learnerId: string;
  driverId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
  createdLocationIds: string[];
};

async function createMaterial(
  ctx: TestContext,
  options: { deliveryAllowed?: boolean; quantity?: number } = {},
) {
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
      description: `${TEST_MARKER} material description`,
      materialType: 'Test material',
      quantity: options.quantity ?? 3,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      deliveryAllowed: options.deliveryAllowed ?? false,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function createAvailableDriver(ctx: TestContext, label: string) {
  const passwordHash = await hashPassword('TestPassword123!');
  const uniquePhone = `+97059${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const driver = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} driver ${label}`,
      email: `${TEST_MARKER}-driver-${label}-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: uniquePhone,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
      driverProfile: {
        create: {
          displayName: `${TEST_MARKER} driver ${label}`,
          phone: uniquePhone,
          city: 'Ramallah',
          area: TEST_MARKER,
          transportationType: 'BICYCLE',
          vehicleType: 'BICYCLE',
          status: 'ACTIVE',
          availability: 'AVAILABLE',
        },
      },
    },
    select: { id: true },
  });

  ctx.createdUserIds.push(driver.id);
  return driver.id;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReservationIds.length) {
    await prisma.deliveryLocationPing.deleteMany({
      where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
    });
    await prisma.deliveryStatusHistory.deleteMany({
      where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
    });
    await prisma.deliveryAssignment.deleteMany({
      where: { delivery: { reservationId: { in: ctx.createdReservationIds } } },
    });
    await prisma.delivery.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
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

  if (ctx.createdLocationIds.length) {
    await prisma.location.deleteMany({
      where: { id: { in: ctx.createdLocationIds } },
    });
  }

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('handover confirmation codes', () => {
  let ctx: TestContext;

  before(async () => {
    const category = await prisma.category.findFirst({ select: { id: true } });
    const location = await prisma.location.findFirst({ select: { id: true } });
    assert.ok(category && location);

    const passwordHash = await hashPassword('TestPassword123!');

    const supplier = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} supplier`,
        email: `${TEST_MARKER}-supplier-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: `${TEST_MARKER} supplier`,
            verificationStatus: 'VERIFIED',
          },
        },
      },
      select: { id: true },
    });

    const otherSupplier = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} other supplier`,
        email: `${TEST_MARKER}-other-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: `${TEST_MARKER} other supplier`,
            verificationStatus: 'VERIFIED',
          },
        },
      },
      select: { id: true },
    });

    const learner = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} learner`,
        email: `${TEST_MARKER}-learner-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: {
          create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
        },
      },
      select: { id: true },
    });

    const driver = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} driver`,
        email: `${TEST_MARKER}-driver-${Date.now()}@impactloop.test`,
        passwordHash,
        phone: '+970591234567',
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
        driverProfile: {
          create: {
            displayName: `${TEST_MARKER} driver`,
            phone: '+970591234567',
            city: 'Ramallah',
            area: TEST_MARKER,
            transportationType: 'BICYCLE',
            vehicleType: 'BICYCLE',
            status: 'ACTIVE',
            availability: 'AVAILABLE',
          },
        },
      },
      select: { id: true },
    });

    ctx = {
      supplierId: supplier.id,
      otherSupplierId: otherSupplier.id,
      learnerId: learner.id,
      driverId: driver.id,
      categoryId: category.id,
      locationId: location.id,
      createdUserIds: [supplier.id, otherSupplier.id, learner.id, driver.id],
      createdMaterialIds: [],
      createdReservationIds: [],
      createdLocationIds: [],
    };
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('PICKUP accepted reservation generates pickup code hash', async () => {
    const material = await createMaterial(ctx);
    const preferred = futurePreferredWindow();
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    });
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
    });

    const stored = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      select: { selfPickupCodeHash: true, status: true },
    });

    assert.equal(stored?.status, 'ACCEPTED');
    assert.ok(stored?.selfPickupCodeHash);
  });

  test('supplier cannot complete pickup without code', async () => {
    const material = await createMaterial(ctx);
    const preferred = futurePreferredWindow();
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    });
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
    });

    await assert.rejects(
      () => completeSupplierReservation(ctx.supplierId, reservation.id, {
        confirmationCode: '000000',
      }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  test('supplier completes pickup with correct code -> COMPLETED + quantity consumed once', async () => {
    const material = await createMaterial(ctx, { quantity: 2 });
    const preferred = futurePreferredWindow();
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    });
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: activePickupWindowReservationUpdate(),
    });

    const completed = await completeSupplierReservation(
      ctx.supplierId,
      reservation.id,
      {
        confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
      },
    );

    assert.equal(completed.status, 'COMPLETED');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(Number(updatedMaterial?.quantity), 1);
    assert.equal(updatedMaterial?.status, 'AVAILABLE');
  });

  test('DELIVERY accept generates supplier handover and learner delivery code hashes', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryStart = new Date(earliestDelivery.getTime() - 30 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      learnerPreferredDeliveryWindows: [
        {
          start: learnerDeliveryStart.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: '12 Learner Street',
      safeDropoffAllowed: false,
    } satisfies CreateReservationInput);
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
    });

    const delivery = await prisma.delivery.findFirst({
      where: { reservationId: reservation.id },
    });

    assert.ok(delivery);
    assert.ok(delivery.supplierHandoverCodeHash);
    assert.ok(delivery.learnerDeliveryCodeHash);
  });

  test('driver cannot mark PICKED_UP without supplier handover code', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryStart = new Date(earliestDelivery.getTime() - 30 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      learnerPreferredDeliveryWindows: [
        {
          start: learnerDeliveryStart.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: '12 Learner Street',
      safeDropoffAllowed: false,
    });
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
    });

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { reservationId: reservation.id },
    });

    const driverId = await createAvailableDriver(ctx, 'pickup-without-code');
    await acceptDelivery(driverId, delivery.id);
    await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });

    await assert.rejects(
      () =>
        updateDriverDeliveryStatus(driverId, delivery.id, {
          status: 'PICKED_UP',
          confirmationCode: '000000',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  test('driver marks PICKED_UP with correct supplier handover code', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryStart = new Date(earliestDelivery.getTime() - 30 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      learnerPreferredDeliveryWindows: [
        {
          start: learnerDeliveryStart.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: '12 Learner Street',
      safeDropoffAllowed: false,
    });
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
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

    const driverId = await createAvailableDriver(ctx, 'pickup-with-code');
    await acceptDelivery(driverId, delivery.id);
    await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });

    const updated = await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', delivery.id),
    });

    assert.equal(updated.status, 'PICKED_UP');
    assert.ok(updated.pickedUpAt);

    const storedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    assert.equal(storedReservation?.status, 'ACCEPTED');
  });

  test('driver marks DELIVERED with correct learner delivery code -> reservation COMPLETED', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true, quantity: 2 });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryStart = new Date(earliestDelivery.getTime() - 30 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      learnerPreferredDeliveryWindows: [
        {
          start: learnerDeliveryStart.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: '12 Learner Street',
      safeDropoffAllowed: false,
    });
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
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

    await acceptDelivery(ctx.driverId, delivery.id);
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', delivery.id),
    });
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });

    await updateDriverDeliveryStatus(ctx.driverId, delivery.id, {
      status: 'DELIVERED',
      confirmationCode: deriveHandoverCode('learner-delivery', delivery.id),
    });

    const storedReservation = await prisma.reservation.findUnique({
      where: { id: reservation.id },
    });
    assert.equal(storedReservation?.status, 'COMPLETED');

    const storedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(Number(storedMaterial?.quantity), 1);
  });

  test('codes are not exposed to unauthorized roles', async () => {
    const material = await createMaterial(ctx, { deliveryAllowed: true });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(supplierPickupStart.getTime() + 2 * 3_600_000);
    const earliestDelivery = new Date(supplierPickupEnd.getTime() + 60 * 60_000);
    const learnerDeliveryStart = new Date(earliestDelivery.getTime() - 30 * 60_000);
    const learnerDeliveryEnd = new Date(earliestDelivery.getTime() + 3 * 3_600_000);

    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      learnerPreferredDeliveryWindows: [
        {
          start: learnerDeliveryStart.toISOString(),
          end: learnerDeliveryEnd.toISOString(),
        },
      ],
      deliveryAddressText: '12 Learner Street',
      safeDropoffAllowed: false,
    });
    ctx.createdReservationIds.push(reservation.id);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
    });

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { reservationId: reservation.id },
    });

    const supplierListed = await listSupplierReservations(ctx.supplierId, {
      status: 'accepted',
    });
    const supplierItem = supplierListed.find((item) => item.id === reservation.id);
    assert.ok(supplierItem?.supplierHandoverCode);
    assert.equal(
      'selfPickupCode' in supplierItem && supplierItem.selfPickupCode != null,
      false,
    );

    const learnerReservations = await listMyReservations(ctx.learnerId);
    const learnerReservation = learnerReservations.find(
      (item) => item.id === reservation.id,
    );
    assert.equal(learnerReservation?.selfPickupCode, null);

    const learnerDelivery = await getMyDelivery(ctx.learnerId, delivery.id);
    assert.ok(learnerDelivery.learnerDeliveryCode);
    assert.equal(
      'supplierHandoverCode' in learnerDelivery &&
        learnerDelivery.supplierHandoverCode != null,
      false,
    );
  });

  test('lazy legacy pickup code storage verifies correctly', async () => {
    const material = await createMaterial(ctx);
    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        pickupWindowStart: new Date(Date.now() + 3_600_000),
        pickupWindowEnd: new Date(Date.now() + 5 * 3_600_000),
        acceptedAt: new Date(),
      },
    });
    ctx.createdMaterialIds.push(material.id);
    ctx.createdReservationIds.push(reservation.id);

    await prisma.$transaction(async (tx) => {
      await ensureSelfPickupCodeStored(tx, reservation.id);
    });

    const code = deriveHandoverCode('self-pickup', reservation.id);
    const stored = await prisma.reservation.findUnique({
      where: { id: reservation.id },
      select: { selfPickupCodeHash: true },
    });

    assert.ok(stored?.selfPickupCodeHash);
    assert.equal(await verifyHandoverCode(code, stored?.selfPickupCodeHash), true);
  });

  test('lazy legacy delivery code storage verifies correctly', async () => {
    const material = await createMaterial(ctx);
    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        acceptedAt: new Date(),
      },
    });
    ctx.createdMaterialIds.push(material.id);
    ctx.createdReservationIds.push(reservation.id);

    const delivery = await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        pickupLocationId: ctx.locationId,
        dropoffLocationId: ctx.locationId,
        requestedByUserId: ctx.learnerId,
        status: 'WAITING_FOR_DRIVER',
      },
    });

    await prisma.$transaction(async (tx) => {
      await ensureDeliveryHandoverCodesStored(tx, delivery.id);
    });

    const supplierCode = deriveHandoverCode('supplier-handover', delivery.id);
    const learnerCode = deriveHandoverCode('learner-delivery', delivery.id);
    const stored = await prisma.delivery.findUnique({
      where: { id: delivery.id },
    });

    assert.ok(stored?.supplierHandoverCodeHash);
    assert.ok(stored?.learnerDeliveryCodeHash);
    assert.equal(
      await verifyHandoverCode(supplierCode, stored?.supplierHandoverCodeHash),
      true,
    );
    assert.equal(
      await verifyHandoverCode(learnerCode, stored?.learnerDeliveryCodeHash),
      true,
    );
  });
});
