import assert from 'node:assert/strict';
import {
  after,
  before,
  describe,
  test,
} from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import {
  activePickupWindowReservationUpdate,
} from '../../test-utils/handover-test-windows.js';
import {
  acceptDelivery,
  updateDriverDeliveryStatus,
} from '../driver/driver.service.js';
import { requestDeliveryForReservation } from '../deliveries/deliveries.service.js';
import {
  issueHandoverCredential,
  verifyHandoverCredential,
} from '../handover-credentials/handover-credentials.service.js';
import {
  DELIVERY_HANDOVER_QR_URI_PREFIX,
  formatDeliveryHandoverQrPayload,
  formatHandoverQrPayload,
  formatSupplierPickupHandoverQrPayload,
  hashHandoverCredentialToken,
  normalizeSupplierPickupHandoverCredentialToken,
  SUPPLIER_PICKUP_HANDOVER_QR_URI_PREFIX,
} from '../handover-credentials/handover-credentials.token.js';
import {
  confirmDeliveryHandoverCredential,
  issueDeliveryHandoverCredential,
  verifyDeliveryHandoverCredential,
} from '../delivery-handover-credentials/delivery-handover-credentials.service.js';
import {
  confirmSupplierPickupHandoverCredential,
  issueSupplierPickupHandoverCredential,
  verifySupplierPickupHandoverCredential,
} from './supplier-pickup-handover-credentials.service.js';

const TEST_MARKER = '[test-supplier-pickup-handover-qr]';

type TestContext = {
  learnerId: string;
  otherSupplierId: string;
  supplierId: string;
  driverId: string;
  secondDriverId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
  createdDeliveryGroupIds: string[];
};

async function createUser(input: {
  displayName: string;
  emailSuffix: string;
  role: 'LEARNER' | 'SUPPLIER' | 'DRIVER';
  driverAvailability?: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY';
}) {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.displayName}`,
      email: `${TEST_MARKER}-${input.emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
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
        : {}),
      ...(input.role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} supplier`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {}),
      ...(input.role === 'DRIVER'
        ? {
            driverProfile: {
              create: {
                displayName: `${TEST_MARKER} ${input.displayName}`,
                phone: `+97059${Math.floor(Math.random() * 1_000_000)
                  .toString()
                  .padStart(6, '0')}`,
                city: 'Ramallah',
                area: 'Downtown',
                transportationType: 'BICYCLE',
                vehicleType: 'BICYCLE',
                status: 'ACTIVE',
                availability: input.driverAvailability ?? 'AVAILABLE',
                acceptingNewJobs: true,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
}

async function createAcceptedReservation(ctx: TestContext) {
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
      description: 'Test material for supplier pickup handover QR',
      materialType: 'Test material',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'RESERVED',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: true,
    },
  });
  ctx.createdMaterialIds.push(material.id);

  const now = new Date();
  const activePickup = activePickupWindowReservationUpdate();
  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: 'ACCEPTED',
      pickupWindowStart: activePickup.pickupWindowStart,
      pickupWindowEnd: activePickup.pickupWindowEnd,
      supplierPickupWindowStart: activePickup.supplierPickupWindowStart,
      supplierPickupWindowEnd: activePickup.supplierPickupWindowEnd,
      acceptedAt: now,
    },
  });
  ctx.createdReservationIds.push(reservation.id);

  return { reservation, material };
}

const deliveryInput = () => ({
  dropoffLocation: {
    country: 'Palestine',
    city: 'Ramallah',
    area: TEST_MARKER,
    addressLine: 'Supplier pickup handover test dropoff',
    latitude: 31.9,
    longitude: 35.2,
    visibility: 'PRIVATE' as const,
    isApproximate: false,
  },
  learnerNote: 'Please call before arrival',
});

async function createAvailableDriver(ctx: TestContext, suffix: string) {
  const driver = await createUser({
    displayName: `driver ${suffix}`,
    emailSuffix: `driver-${suffix}`,
    role: 'DRIVER',
    driverAvailability: 'AVAILABLE',
  });
  ctx.createdUserIds.push(driver.id);
  return driver.id;
}

async function createDeliveryAtArrivedPickup(
  ctx: TestContext,
  input: { driverId?: string } = {},
) {
  const driverId =
    input.driverId ?? (await createAvailableDriver(ctx, `pickup-${Date.now()}`));
  const { reservation } = await createAcceptedReservation(ctx);
  const delivery = await requestDeliveryForReservation(
    ctx.learnerId,
    reservation.id,
    deliveryInput(),
  );
  await acceptDelivery(driverId, delivery.id);
  const arrived = await updateDriverDeliveryStatus(driverId, delivery.id, {
    status: 'ARRIVED_PICKUP',
  });
  return { delivery: arrived, reservation, driverId };
}

async function cleanup(ctx: TestContext) {
  const markerDeliveryWhere = {
    OR: [
      { reservationId: { in: ctx.createdReservationIds } },
      { pickupLocation: { area: TEST_MARKER } },
      { dropoffLocation: { area: TEST_MARKER } },
    ],
  };

  await prisma.deliveryPickupItem.deleteMany({
    where: { delivery: markerDeliveryWhere },
  });
  await prisma.deliveryLocationPing.deleteMany({
    where: { delivery: markerDeliveryWhere },
  });
  await prisma.deliveryStatusHistory.deleteMany({
    where: { delivery: markerDeliveryWhere },
  });
  await prisma.deliveryAssignment.deleteMany({
    where: { delivery: markerDeliveryWhere },
  });
  await prisma.delivery.deleteMany({
    where: markerDeliveryWhere,
  });

  if (ctx.createdDeliveryGroupIds.length) {
    await prisma.deliveryGroup.deleteMany({
      where: { id: { in: ctx.createdDeliveryGroupIds } },
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

  await prisma.location.deleteMany({
    where: { area: TEST_MARKER },
  });

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('supplier pickup handover credential token helpers', () => {
  test('formats and normalizes supplier-pickup-handover QR payloads', () => {
    const raw = 'abcdefghijklmnopqrstuvwxyz012345';
    assert.equal(
      formatSupplierPickupHandoverQrPayload(raw),
      `${SUPPLIER_PICKUP_HANDOVER_QR_URI_PREFIX}${raw}`,
    );
    assert.equal(
      normalizeSupplierPickupHandoverCredentialToken(
        formatSupplierPickupHandoverQrPayload(raw),
      ),
      raw,
    );
    assert.equal(
      normalizeSupplierPickupHandoverCredentialToken(
        formatHandoverQrPayload(raw),
      ),
      null,
    );
    assert.equal(
      normalizeSupplierPickupHandoverCredentialToken(
        formatDeliveryHandoverQrPayload(raw),
      ),
      null,
    );
  });
});

describe('supplier pickup handover credentials', () => {
  const ctx: TestContext = {
    learnerId: '',
    otherSupplierId: '',
    supplierId: '',
    driverId: '',
    secondDriverId: '',
    categoryId: '',
    locationId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdReservationIds: [],
    createdDeliveryGroupIds: [],
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    assert.ok(category, 'Expected at least one material category');

    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: TEST_MARKER,
        addressLine: 'Supplier pickup',
        latitude: 32.22,
        longitude: 35.26,
        visibility: 'ORDER_ONLY',
        isApproximate: false,
        locationType: 'MATERIAL_PICKUP',
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
    const otherSupplier = await createUser({
      displayName: 'other supplier',
      emailSuffix: 'other-supplier',
      role: 'SUPPLIER',
    });
    const driver = await createUser({
      displayName: 'driver',
      emailSuffix: 'driver',
      role: 'DRIVER',
      driverAvailability: 'AVAILABLE',
    });
    const secondDriver = await createUser({
      displayName: 'second driver',
      emailSuffix: 'second-driver',
      role: 'DRIVER',
      driverAvailability: 'AVAILABLE',
    });

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.learnerId = learner.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.driverId = driver.id;
    ctx.secondDriverId = secondDriver.id;
    ctx.createdUserIds.push(
      learner.id,
      supplier.id,
      otherSupplier.id,
      driver.id,
      secondDriver.id,
    );
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('manual supplier handover code still marks PICKED_UP', async () => {
    const { delivery, driverId } = await createDeliveryAtArrivedPickup(ctx);
    const picked = await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', delivery.id),
    });
    assert.equal(picked.status, 'PICKED_UP');
  });

  test('issue: eligible supplier + delivery issues credential with supplier-pickup-handover prefix', async () => {
    const { reservation, delivery } = await createDeliveryAtArrivedPickup(ctx);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    assert.equal(issued.reservationId, reservation.id);
    assert.equal(issued.deliveryId, delivery.id);
    assert.ok(issued.handoverToken.length >= 32);
    assert.equal(
      issued.qrPayload,
      formatSupplierPickupHandoverQrPayload(issued.handoverToken),
    );
    assert.ok(issued.qrPayload.startsWith(SUPPLIER_PICKUP_HANDOVER_QR_URI_PREFIX));
    assert.ok(issued.expiresAt);

    const stored = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: {
        supplierPickupHandoverTokenHash: true,
        supplierPickupHandoverTokenExpiresAt: true,
        supplierPickupHandoverTokenUsedAt: true,
      },
    });
    assert.equal(
      stored.supplierPickupHandoverTokenHash,
      hashHandoverCredentialToken(issued.handoverToken),
    );
    assert.ok(stored.supplierPickupHandoverTokenExpiresAt);
    assert.equal(stored.supplierPickupHandoverTokenUsedAt, null);
  });

  test('issue: different supplier receives 404', async () => {
    const { reservation } = await createDeliveryAtArrivedPickup(ctx);

    await assert.rejects(
      () =>
        issueSupplierPickupHandoverCredential(
          ctx.otherSupplierId,
          reservation.id,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, 'NOT_FOUND');
        return true;
      },
    );
  });

  test('issue: terminal delivery is rejected', async () => {
    const { reservation, delivery } = await createDeliveryAtArrivedPickup(ctx);

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: 'CANCELLED' },
    });

    await assert.rejects(
      () =>
        issueSupplierPickupHandoverCredential(ctx.supplierId, reservation.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('verify: valid QR + assigned driver previews without marking picked up', async () => {
    const { reservation, delivery, driverId } =
      await createDeliveryAtArrivedPickup(ctx);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    const preview = await verifySupplierPickupHandoverCredential(
      driverId,
      issued.qrPayload,
    );

    assert.equal(preview.deliveryId, delivery.id);
    assert.equal(preview.reservationId, reservation.id);
    assert.ok(preview.supplier.displayName);
    assert.ok(preview.items.length >= 1);
    assert.ok(preview.expiresAt);

    const stored = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: { status: true, supplierPickupHandoverTokenUsedAt: true },
    });
    assert.equal(stored.status, 'ARRIVED_PICKUP');
    assert.equal(stored.supplierPickupHandoverTokenUsedAt, null);
  });

  test('verify: wrong driver receives HANDOVER_CREDENTIAL_INVALID', async () => {
    const { reservation } = await createDeliveryAtArrivedPickup(ctx);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    await assert.rejects(
      () =>
        verifySupplierPickupHandoverCredential(
          ctx.secondDriverId,
          issued.handoverToken,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('verify: wrong status (DRIVER_ASSIGNED) is rejected', async () => {
    const driverId = await createAvailableDriver(ctx, `assigned-${Date.now()}`);
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    await assert.rejects(
      () =>
        verifySupplierPickupHandoverCredential(driverId, issued.handoverToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('verify: expired token is rejected', async () => {
    const { reservation, delivery, driverId } =
      await createDeliveryAtArrivedPickup(ctx);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        supplierPickupHandoverTokenExpiresAt: new Date(Date.now() - 60_000),
      },
    });

    await assert.rejects(
      () =>
        verifySupplierPickupHandoverCredential(driverId, issued.handoverToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
    await assert.rejects(
      () =>
        confirmSupplierPickupHandoverCredential(driverId, issued.handoverToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('confirm: valid token marks delivery PICKED_UP', async () => {
    const { reservation, delivery, driverId } =
      await createDeliveryAtArrivedPickup(ctx);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    const picked = await confirmSupplierPickupHandoverCredential(
      driverId,
      issued.qrPayload,
    );
    assert.equal(picked.status, 'PICKED_UP');

    const storedDelivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: {
        status: true,
        supplierPickupHandoverTokenUsedAt: true,
      },
    });
    assert.equal(storedDelivery.status, 'PICKED_UP');
    assert.ok(storedDelivery.supplierPickupHandoverTokenUsedAt);

    const pickupItems = await prisma.deliveryPickupItem.count({
      where: { deliveryId: delivery.id, wasPicked: true },
    });
    assert.equal(pickupItems, 1);
  });

  test('confirm: same token twice completes at most once', async () => {
    const { reservation, delivery, driverId } =
      await createDeliveryAtArrivedPickup(ctx);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    const results = await Promise.allSettled([
      confirmSupplierPickupHandoverCredential(driverId, issued.handoverToken),
      confirmSupplierPickupHandoverCredential(driverId, issued.handoverToken),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    assert.ok(fulfilled.length >= 1);

    const storedDelivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: { status: true },
    });
    assert.equal(storedDelivery.status, 'PICKED_UP');

    const historyCount = await prisma.deliveryStatusHistory.count({
      where: {
        deliveryId: delivery.id,
        oldStatus: 'ARRIVED_PICKUP',
        newStatus: 'PICKED_UP',
      },
    });
    assert.equal(historyCount, 1);
  });

  test('reissue: confirm with A fails and B succeeds', async () => {
    const { reservation, driverId } = await createDeliveryAtArrivedPickup(ctx);
    const first = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );
    const second = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    assert.notEqual(first.handoverToken, second.handoverToken);

    await assert.rejects(
      () =>
        confirmSupplierPickupHandoverCredential(driverId, first.handoverToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );

    const picked = await confirmSupplierPickupHandoverCredential(
      driverId,
      second.handoverToken,
    );
    assert.equal(picked.status, 'PICKED_UP');
  });

  test('confirm: grouped multi-item delivery is rejected (force manual code)', async () => {
    const { reservation, delivery, driverId } =
      await createDeliveryAtArrivedPickup(ctx);
    const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
      where: { userId: ctx.supplierId },
      select: { id: true },
    });
    const activePickup = activePickupWindowReservationUpdate();
    const group = await prisma.deliveryGroup.create({
      data: {
        learnerId: ctx.learnerId,
        supplierProfileId: supplierProfile.id,
        dropoffCity: 'Ramallah',
        dropoffArea: TEST_MARKER,
        deliveryFee: 5,
        deliveryZone: 'SAME_CITY',
        status: 'ASSIGNED',
        windowStart: activePickup.supplierPickupWindowStart,
        windowEnd: activePickup.supplierPickupWindowEnd,
        assignedDriverProfileId: (
          await prisma.driverProfile.findFirstOrThrow({
            where: { userId: driverId },
            select: { id: true },
          })
        ).id,
      },
    });
    ctx.createdDeliveryGroupIds.push(group.id);

    const { reservation: secondReservation } = await createAcceptedReservation(ctx);
    await prisma.reservation.update({
      where: { id: secondReservation.id },
      data: {
        deliveryGroupId: group.id,
        fulfillmentMethod: 'DELIVERY',
      },
    });

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { deliveryGroupId: group.id },
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        deliveryGroupId: group.id,
        fulfillmentMethod: 'DELIVERY',
      },
    });

    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    await assert.rejects(
      () =>
        confirmSupplierPickupHandoverCredential(driverId, issued.handoverToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('cross-purpose: learner pickup QR rejected by supplier pickup verify', async () => {
    const { reservation } = await createAcceptedReservation(ctx);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { fulfillmentMethod: 'PICKUP' },
    });
    const pickupIssued = await issueHandoverCredential(
      ctx.learnerId,
      reservation.id,
    );

    await assert.rejects(
      () =>
        verifySupplierPickupHandoverCredential(
          ctx.driverId,
          pickupIssued.qrPayload,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('cross-purpose: delivery handover QR rejected by supplier pickup verify', async () => {
    const driverId = await createAvailableDriver(ctx, `cross-del-${Date.now()}`);
    const { reservation } = await createAcceptedReservation(ctx);
    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      reservation.id,
      deliveryInput(),
    );
    await acceptDelivery(driverId, delivery.id);
    await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', delivery.id),
    });
    await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(driverId, delivery.id, {
      status: 'ARRIVED_DROPOFF',
    });

    const deliveryIssued = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );

    await assert.rejects(
      () =>
        verifySupplierPickupHandoverCredential(
          driverId,
          deliveryIssued.qrPayload,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('cross-purpose: supplier pickup QR rejected by delivery handover verify', async () => {
    const { reservation, driverId } = await createDeliveryAtArrivedPickup(ctx);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    await assert.rejects(
      () =>
        verifyDeliveryHandoverCredential(driverId, issued.qrPayload),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('cross-purpose: supplier pickup QR rejected by learner pickup supplier verify', async () => {
    const { reservation } = await createDeliveryAtArrivedPickup(ctx);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    await assert.rejects(
      () => verifyHandoverCredential(ctx.supplierId, issued.qrPayload),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('cross-purpose: supplier pickup QR rejected by delivery handover confirm', async () => {
    const { reservation, driverId } = await createDeliveryAtArrivedPickup(ctx);
    const issued = await issueSupplierPickupHandoverCredential(
      ctx.supplierId,
      reservation.id,
    );

    await assert.rejects(
      () => confirmDeliveryHandoverCredential(driverId, issued.qrPayload),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });
});
