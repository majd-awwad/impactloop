import assert from 'node:assert/strict';
import {
  after,
  afterEach,
  before,
  beforeEach,
  describe,
  test,
} from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import {
  activeConfirmedDeliveryWindowUpdate,
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
  hashHandoverCredentialToken,
  normalizeDeliveryHandoverCredentialToken,
} from '../handover-credentials/handover-credentials.token.js';
import { setElectronicPaymentEnforcementForTests } from '../payments/payments.policy.js';
import { ensureMaterialPaymentOrder } from '../payments/payments.ensure.js';
import {
  actOnMockCheckout,
  startPaymentCheckout,
} from '../payments/payments.service.js';
import {
  cleanupPayTest,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from '../payments/payments.test-helpers.js';

import {
  confirmDeliveryHandoverCredential,
  issueDeliveryHandoverCredential,
  verifyDeliveryHandoverCredential,
} from './delivery-handover-credentials.service.js';

const TEST_MARKER = '[test-delivery-handover-qr]';

type TestContext = {
  learnerId: string;
  otherLearnerId: string;
  supplierId: string;
  driverId: string;
  secondDriverId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
};

async function createUser(input: {
  displayName: string;
  emailSuffix: string;
  role: 'LEARNER' | 'SUPPLIER' | 'DRIVER';
  driverStatus?: 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';
  driverAvailability?: 'OFFLINE' | 'AVAILABLE' | 'ON_DELIVERY';
  acceptingNewJobs?: boolean;
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
                status: input.driverStatus ?? 'ACTIVE',
                availability: input.driverAvailability ?? 'AVAILABLE',
                acceptingNewJobs:
                  input.acceptingNewJobs ??
                  input.driverAvailability !== 'OFFLINE',
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
}

async function createAcceptedReservation(
  ctx: TestContext,
  input: {
    learnerId?: string;
    deliveryAllowed?: boolean;
    status?: 'PENDING' | 'ACCEPTED' | 'COMPLETED';
  } = {},
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
      description: 'Test material for delivery handover QR',
      materialType: 'Test material',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status === 'PENDING' ? 'PENDING_RESERVATION' : 'RESERVED',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: input.deliveryAllowed ?? true,
    },
  });
  ctx.createdMaterialIds.push(material.id);

  const now = new Date();
  const activePickup = activePickupWindowReservationUpdate();
  const activeDelivery = activeConfirmedDeliveryWindowUpdate();
  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: input.learnerId ?? ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: input.status ?? 'ACCEPTED',
      pickupWindowStart:
        input.status === 'PENDING' ? undefined : activePickup.pickupWindowStart,
      pickupWindowEnd:
        input.status === 'PENDING' ? undefined : activePickup.pickupWindowEnd,
      supplierPickupWindowStart:
        input.status === 'PENDING'
          ? undefined
          : activePickup.supplierPickupWindowStart,
      supplierPickupWindowEnd:
        input.status === 'PENDING'
          ? undefined
          : activePickup.supplierPickupWindowEnd,
      confirmedDeliveryWindowStart:
        input.status === 'PENDING'
          ? undefined
          : activeDelivery.confirmedDeliveryWindowStart,
      confirmedDeliveryWindowEnd:
        input.status === 'PENDING'
          ? undefined
          : activeDelivery.confirmedDeliveryWindowEnd,
      acceptedAt: input.status === 'PENDING' ? undefined : now,
      completedAt: input.status === 'COMPLETED' ? now : undefined,
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
    addressLine: 'Delivery handover test dropoff',
    latitude: 31.9,
    longitude: 35.2,
    visibility: 'PRIVATE' as const,
    isApproximate: false,
  },
  learnerNote: 'Please call before arrival',
});

async function progressToArrivedDropoff(
  driverId: string,
  deliveryId: string,
) {
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ARRIVED_PICKUP',
  });
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'PICKED_UP',
    confirmationCode: deriveHandoverCode('supplier-handover', deliveryId),
  });
  await updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ON_THE_WAY',
  });
  return updateDriverDeliveryStatus(driverId, deliveryId, {
    status: 'ARRIVED_DROPOFF',
  });
}

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

async function createDeliveryAtArrivedDropoff(
  ctx: TestContext,
  input: { learnerId?: string; driverId?: string } = {},
) {
  const learnerId = input.learnerId ?? ctx.learnerId;
  const driverId =
    input.driverId ??
    (await createAvailableDriver(ctx, `dropoff-${Date.now()}`));
  const { reservation } = await createAcceptedReservation(ctx, { learnerId });
  const delivery = await requestDeliveryForReservation(
    learnerId,
    reservation.id,
    deliveryInput(),
  );
  await acceptDelivery(driverId, delivery.id);
  const arrived = await progressToArrivedDropoff(driverId, delivery.id);
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

describe('delivery handover credential token helpers', () => {
  test('formats and normalizes delivery-handover QR payloads', () => {
    const raw = 'abcdefghijklmnopqrstuvwxyz012345';
    assert.equal(
      formatDeliveryHandoverQrPayload(raw),
      `${DELIVERY_HANDOVER_QR_URI_PREFIX}${raw}`,
    );
    assert.equal(
      normalizeDeliveryHandoverCredentialToken(
        formatDeliveryHandoverQrPayload(raw),
      ),
      raw,
    );
    assert.equal(
      normalizeDeliveryHandoverCredentialToken(formatHandoverQrPayload(raw)),
      null,
    );
  });
});

describe('delivery handover credentials', () => {
  const ctx: TestContext = {
    learnerId: '',
    otherLearnerId: '',
    supplierId: '',
    driverId: '',
    secondDriverId: '',
    categoryId: '',
    locationId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdReservationIds: [],
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
    const otherLearner = await createUser({
      displayName: 'other learner',
      emailSuffix: 'other-learner',
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
    ctx.otherLearnerId = otherLearner.id;
    ctx.supplierId = supplier.id;
    ctx.driverId = driver.id;
    ctx.secondDriverId = secondDriver.id;
    ctx.createdUserIds.push(
      learner.id,
      otherLearner.id,
      supplier.id,
      driver.id,
      secondDriver.id,
    );
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('issue: eligible learner + delivery at ARRIVED_DROPOFF issues credential with delivery-handover prefix', async () => {
    const { delivery } = await createDeliveryAtArrivedDropoff(ctx);
    const issued = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );

    assert.equal(issued.deliveryId, delivery.id);
    assert.ok(issued.handoverToken.length >= 32);
    assert.equal(
      issued.qrPayload,
      formatDeliveryHandoverQrPayload(issued.handoverToken),
    );
    assert.ok(issued.qrPayload.startsWith(DELIVERY_HANDOVER_QR_URI_PREFIX));
    assert.ok(issued.expiresAt);

    const stored = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: {
        learnerDeliveryHandoverTokenHash: true,
        learnerDeliveryHandoverTokenExpiresAt: true,
        learnerDeliveryHandoverTokenUsedAt: true,
      },
    });
    assert.equal(
      stored.learnerDeliveryHandoverTokenHash,
      hashHandoverCredentialToken(issued.handoverToken),
    );
    assert.ok(stored.learnerDeliveryHandoverTokenExpiresAt);
    assert.equal(stored.learnerDeliveryHandoverTokenUsedAt, null);
  });

  test('issue: different learner receives 404', async () => {
    const { delivery } = await createDeliveryAtArrivedDropoff(ctx);

    await assert.rejects(
      () =>
        issueDeliveryHandoverCredential(ctx.otherLearnerId, delivery.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        assert.equal(error.code, 'NOT_FOUND');
        return true;
      },
    );
  });

  test('issue: terminal or cancelled delivery is rejected', async () => {
    const { delivery } = await createDeliveryAtArrivedDropoff(ctx);

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: 'CANCELLED' },
    });

    await assert.rejects(
      () => issueDeliveryHandoverCredential(ctx.learnerId, delivery.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('verify: valid QR + assigned driver previews without marking delivered', async () => {
    const { delivery, driverId } = await createDeliveryAtArrivedDropoff(ctx);
    const issued = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );

    const preview = await verifyDeliveryHandoverCredential(
      driverId,
      issued.qrPayload,
    );

    assert.equal(preview.deliveryId, delivery.id);
    assert.ok(preview.learner.displayName);
    assert.ok(preview.items.length >= 1);
    assert.ok(preview.expiresAt);

    const stored = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: { status: true, learnerDeliveryHandoverTokenUsedAt: true },
    });
    assert.equal(stored.status, 'ARRIVED_DROPOFF');
    assert.equal(stored.learnerDeliveryHandoverTokenUsedAt, null);

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: delivery.reservationId },
      select: { status: true },
    });
    assert.equal(reservation.status, 'ACCEPTED');
  });

  test('verify: wrong driver receives HANDOVER_CREDENTIAL_INVALID', async () => {
    const { delivery } = await createDeliveryAtArrivedDropoff(ctx);
    const issued = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );

    await assert.rejects(
      () =>
        verifyDeliveryHandoverCredential(
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

  test('verify: expired token is rejected', async () => {
    const { delivery, driverId } = await createDeliveryAtArrivedDropoff(ctx);
    const issued = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        learnerDeliveryHandoverTokenExpiresAt: new Date(Date.now() - 60_000),
      },
    });

    await assert.rejects(
      () =>
        verifyDeliveryHandoverCredential(driverId, issued.handoverToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
    await assert.rejects(
      () =>
        confirmDeliveryHandoverCredential(driverId, issued.handoverToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });

  test('confirm: valid token marks delivery DELIVERED and reservation COMPLETED', async () => {
    const { delivery, reservation, driverId } =
      await createDeliveryAtArrivedDropoff(ctx);
    const issued = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );

    const completed = await confirmDeliveryHandoverCredential(
      driverId,
      issued.qrPayload,
    );
    assert.equal(completed.status, 'DELIVERED');

    const storedDelivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: {
        status: true,
        learnerDeliveryHandoverTokenUsedAt: true,
      },
    });
    assert.equal(storedDelivery.status, 'DELIVERED');
    assert.ok(storedDelivery.learnerDeliveryHandoverTokenUsedAt);

    const storedReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { status: true, completedAt: true },
    });
    assert.equal(storedReservation.status, 'COMPLETED');
    assert.ok(storedReservation.completedAt);
  });

  test('confirm: same token twice completes at most once', async () => {
    const { delivery, reservation, driverId } =
      await createDeliveryAtArrivedDropoff(ctx);
    const issued = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );

    const results = await Promise.allSettled([
      confirmDeliveryHandoverCredential(driverId, issued.handoverToken),
      confirmDeliveryHandoverCredential(driverId, issued.handoverToken),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    assert.ok(fulfilled.length >= 1);

    const storedDelivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: { status: true },
    });
    assert.equal(storedDelivery.status, 'DELIVERED');

    const historyCount = await prisma.reservationStatusHistory.count({
      where: {
        reservationId: reservation.id,
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
      },
    });
    assert.equal(historyCount, 1);
  });

  test('reissue: confirm with A fails and B succeeds', async () => {
    const { delivery, driverId } = await createDeliveryAtArrivedDropoff(ctx);
    const first = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );
    const second = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );

    assert.notEqual(first.handoverToken, second.handoverToken);

    await assert.rejects(
      () => confirmDeliveryHandoverCredential(driverId, first.handoverToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );

    const completed = await confirmDeliveryHandoverCredential(
      driverId,
      second.handoverToken,
    );
    assert.equal(completed.status, 'DELIVERED');
  });

  test('cross-purpose: pickup QR rejected by delivery handover verify', async () => {
    const { reservation } = await createAcceptedReservation(ctx);
    const pickupIssued = await issueHandoverCredential(
      ctx.learnerId,
      reservation.id,
    );

    await assert.rejects(
      () =>
        verifyDeliveryHandoverCredential(
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

  test('cross-purpose: delivery QR rejected by supplier pickup verify', async () => {
    const { delivery } = await createDeliveryAtArrivedDropoff(ctx);
    const deliveryIssued = await issueDeliveryHandoverCredential(
      ctx.learnerId,
      delivery.id,
    );

    await assert.rejects(
      () =>
        verifyHandoverCredential(ctx.supplierId, deliveryIssued.qrPayload),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );
  });
});

describe('delivery handover payment gate', () => {
  const payIds = createPayTestIds();
  let learnerId = '';
  let supplierId = '';
  let driverId = '';
  const createdDriverUserIds: string[] = [];

  before(async () => {
    const learner = await createPayUser(payIds, {
      role: 'LEARNER',
      emailSuffix: 'del-handover-learner',
    });
    const supplier = await createPayUser(payIds, {
      role: 'SUPPLIER',
      emailSuffix: 'del-handover-supplier',
    });
    const passwordHash = await hashPassword('TestPassword123!');
    const driver = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} payment-gate driver`,
        email: `${TEST_MARKER}-payment-gate-driver-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: {
          create: [{ role: 'DRIVER', isPrimary: true }],
        },
        driverProfile: {
          create: {
            displayName: `${TEST_MARKER} payment-gate driver`,
            phone: `+97059${Math.floor(Math.random() * 1_000_000)
              .toString()
              .padStart(6, '0')}`,
            city: 'Ramallah',
            area: 'Downtown',
            transportationType: 'BICYCLE',
            vehicleType: 'BICYCLE',
            status: 'ACTIVE',
            availability: 'AVAILABLE',
            acceptingNewJobs: true,
          },
        },
      },
      select: { id: true },
    });
    learnerId = learner.id;
    supplierId = supplier.id;
    driverId = driver.id;
    createdDriverUserIds.push(driver.id);
  });

  after(async () => {
    await cleanupPayTest(payIds);
    if (createdDriverUserIds.length) {
      await prisma.user.deleteMany({
        where: { id: { in: createdDriverUserIds } },
      });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    setElectronicPaymentEnforcementForTests(true);
  });

  afterEach(() => {
    setElectronicPaymentEnforcementForTests(undefined);
  });

  test('unpaid delivery group fee blocks confirm', async () => {
    const reservation = await createPayReservationFixture(payIds, {
      learnerId,
      supplierId,
      materialSubtotal: 12,
    });

    const materialId = (
      await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { materialId: true },
      })
    ).materialId;
    await prisma.material.update({
      where: { id: materialId },
      data: { deliveryAllowed: true },
    });

    const activePickup = activePickupWindowReservationUpdate();
    const activeDelivery = activeConfirmedDeliveryWindowUpdate();
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        ...activePickup,
        ...activeDelivery,
      },
    });

    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(payIds, ensured.order.id);

    const checkout = await startPaymentCheckout({
      orderId: ensured.order.id,
      payerUserId: learnerId,
      idempotencyKey: `del-handover-mat-${ensured.order.id}-${Date.now()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    let deliveryGroupId = '';
    await assert.rejects(
      () =>
        requestDeliveryForReservation(learnerId, reservation.id, {
          dropoffLocation: {
            country: 'Palestine',
            city: 'Ramallah',
            area: TEST_MARKER,
            addressLine: 'Paid delivery dropoff',
            isApproximate: true,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'DELIVERY_FEE_REQUIRED');
        const details = error.details as {
          deliveryGroupId?: string;
          paymentOrderId?: string;
        };
        assert.ok(details.deliveryGroupId);
        assert.ok(details.paymentOrderId);
        deliveryGroupId = details.deliveryGroupId!;
        trackOrder(payIds, details.paymentOrderId!);
        payIds.groups.push(deliveryGroupId);
        return true;
      },
    );

    const material = await prisma.material.findUniqueOrThrow({
      where: { id: materialId },
      select: { locationId: true },
    });
    const dropoff = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Ramallah',
        area: TEST_MARKER,
        addressLine: 'Paid delivery dropoff',
        latitude: 31.9,
        longitude: 35.2,
        visibility: 'PRIVATE',
        isApproximate: false,
        locationType: 'DELIVERY_DROPOFF',
      },
      select: { id: true },
    });
    payIds.locations.push(dropoff.id);

    const delivery = await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        deliveryGroupId,
        pickupLocationId: material.locationId,
        dropoffLocationId: dropoff.id,
        requestedByUserId: learnerId,
        status: 'WAITING_FOR_DRIVER',
      },
      select: { id: true, reservationId: true },
    });

    await acceptDelivery(driverId, delivery.id);
    await progressToArrivedDropoff(driverId, delivery.id);

    const issued = await issueDeliveryHandoverCredential(
      learnerId,
      delivery.id,
    );

    await assert.rejects(
      () =>
        confirmDeliveryHandoverCredential(driverId, issued.handoverToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'HANDOVER_CREDENTIAL_INVALID');
        return true;
      },
    );

    const storedDelivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      select: { status: true },
    });
    assert.equal(storedDelivery.status, 'ARRIVED_DROPOFF');

    const storedReservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { status: true },
    });
    assert.equal(storedReservation.status, 'ACCEPTED');
  });
});
