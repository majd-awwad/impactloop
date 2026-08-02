import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import {
  acceptDelivery,
  listActiveDriverDeliveries,
  listAvailableDeliveries,
  updateDriverAvailability,
  updateDriverDeliveryStatus,
} from '../driver/driver.service.js';
import { requestDeliveryForReservation } from '../deliveries/deliveries.service.js';
import { listMyNotifications } from './notifications.service.js';
import { DRIVER_NOTIFICATION_TYPES } from './driver-delivery-notification-types.js';
import {
  notifyDriverDropoffTime,
  notifyDriverDeliveryMovedToAdminReview,
  notifyDriverDeliveryUnassignedByAdmin,
  notifyDriverPickupTime,
  notifyNewDriverJob,
  resetDriverDeliveryReminderSyncThrottleForTests,
} from './driver-notification-events.service.js';

const TEST_MARKER = '[test-driver-delivery-notifications]';

type TestContext = {
  learnerId: string;
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
  role: 'LEARNER' | 'SUPPLIER' | 'DRIVER';
  suffix: string;
  driverStatus?: 'ACTIVE' | 'INACTIVE';
}) {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.role} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.role}-${input.suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: input.role, isPrimary: true }] },
      ...(input.role === 'LEARNER'
        ? {
            learnerProfile: {
              create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
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
                displayName: `${TEST_MARKER} driver ${input.suffix}`,
                phone: `+97059${Math.floor(Math.random() * 1_000_000)
                  .toString()
                  .padStart(6, '0')}`,
                city: 'Nablus',
                area: 'City Center',
                transportationType: 'BICYCLE',
                vehicleType: 'BICYCLE',
                status: input.driverStatus ?? 'ACTIVE',
                availability: 'AVAILABLE',
                acceptingNewJobs: true,
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });
}

async function createAcceptedReservation(ctx: TestContext, title: string) {
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
      title,
      description: 'Notification test material',
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

  const pickupStart = new Date(Date.now() + 2 * 60 * 60_000);
  const pickupEnd = new Date(pickupStart.getTime() + 2 * 60 * 60_000);
  const deliveryStart = new Date(Date.now() + 4 * 60 * 60_000);
  const deliveryEnd = new Date(deliveryStart.getTime() + 2 * 60 * 60_000);

  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: 'ACCEPTED',
      pickupWindowStart: pickupStart,
      pickupWindowEnd: pickupEnd,
      supplierPickupWindowStart: pickupStart,
      supplierPickupWindowEnd: pickupEnd,
      confirmedDeliveryWindowStart: deliveryStart,
      confirmedDeliveryWindowEnd: deliveryEnd,
      acceptedAt: new Date(),
    },
  });
  ctx.createdReservationIds.push(reservation.id);

  return { reservation, material };
}

async function requestDelivery(ctx: TestContext, reservationId: string) {
  return requestDeliveryForReservation(ctx.learnerId, reservationId, {
    dropoffLocation: {
      country: 'Palestine',
      city: 'Nablus',
      area: TEST_MARKER,
      addressLine: 'Secret exact dropoff street 42',
      latitude: 32.22,
      longitude: 35.25,
      visibility: 'PRIVATE',
      isApproximate: false,
    },
  });
}

async function cleanupTestData(ctx: TestContext) {
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { userId: { in: ctx.createdUserIds } },
        { relatedEntityId: { in: ctx.createdReservationIds } },
      ],
    },
  });

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

  if (ctx.createdReservationIds.length) {
    await prisma.reservation.deleteMany({
      where: { id: { in: ctx.createdReservationIds } },
    });
  }

  if (ctx.createdMaterialIds.length) {
    await prisma.material.deleteMany({
      where: { id: { in: ctx.createdMaterialIds } },
    });
  }

  if (ctx.driverId || ctx.secondDriverId) {
    await prisma.driverProfile.updateMany({
      where: {
        userId: { in: [ctx.driverId, ctx.secondDriverId].filter(Boolean) },
      },
      data: { availability: 'AVAILABLE', acceptingNewJobs: true },
    });
  }
}

async function cleanup(ctx: TestContext) {
  await cleanupTestData(ctx);

  await prisma.location.deleteMany({
    where: { area: TEST_MARKER },
  });

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('driver notification events', () => {
  const ctx: TestContext = {
    learnerId: '',
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
    ctx.categoryId = category.id;

    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: TEST_MARKER,
        addressLine: 'Secret exact pickup street 99',
        latitude: 32.2211,
        longitude: 35.2544,
        visibility: 'PRIVATE',
        isApproximate: false,
        locationType: 'MATERIAL',
      },
    });
    ctx.locationId = location.id;

    const learner = await createUser({ role: 'LEARNER', suffix: 'main' });
    const supplier = await createUser({ role: 'SUPPLIER', suffix: 'main' });
    const driver = await createUser({ role: 'DRIVER', suffix: 'main' });
    const secondDriver = await createUser({ role: 'DRIVER', suffix: 'second' });

    ctx.learnerId = learner.id;
    ctx.supplierId = supplier.id;
    ctx.driverId = driver.id;
    ctx.secondDriverId = secondDriver.id;
    ctx.createdUserIds.push(
      learner.id,
      supplier.id,
      driver.id,
      secondDriver.id,
    );
  });

  after(async () => {
    await cleanup(ctx);
  });

  afterEach(async () => {
    resetDriverDeliveryReminderSyncThrottleForTests();
    await cleanupTestData(ctx);
    ctx.createdMaterialIds = [];
    ctx.createdReservationIds = [];
  });

  test('GET available and active jobs do not create new job notifications', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'GET Jobs Pack');
    const delivery = await requestDelivery(ctx, reservation.id);

    const beforeNewJob = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
      },
    });
    assert.ok(beforeNewJob >= 1);

    await listAvailableDeliveries(ctx.driverId);
    await listAvailableDeliveries(ctx.driverId);
    await listActiveDriverDeliveries(ctx.driverId);
    await listActiveDriverDeliveries(ctx.driverId);

    const afterNewJob = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
      },
    });
    assert.equal(afterNewJob, beforeNewJob);
  });

  test('delivery request creates one new job notification per eligible driver', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'LED Pack');
    const delivery = await requestDelivery(ctx, reservation.id);

    for (const userId of [ctx.driverId, ctx.secondDriverId]) {
      const row = await prisma.notification.findFirst({
        where: {
          userId,
          notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
          relatedEntityId: delivery.id,
        },
      });
      assert.ok(row);
      assert.equal(row.title, 'New delivery job');
      assert.ok(!row.title.includes('available'));
      assert.equal(
        (row.metadata as { materialTitle?: string } | null)?.materialTitle,
        'LED Pack',
      );
    }

    const sample = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        relatedEntityId: delivery.id,
      },
    });
    assert.ok(sample?.body.includes('LED Pack'));
    assert.ok(sample?.body.includes('Nablus'));
    assert.ok(!sample?.body.includes('Secret exact pickup street 99'));
  });

  test('new job notifications exclude offline and account-suspended drivers', async () => {
    await prisma.driverProfile.update({
      where: { userId: ctx.secondDriverId },
      data: { acceptingNewJobs: false, availability: 'OFFLINE' },
    });
    await prisma.user.update({
      where: { id: ctx.driverId },
      data: { accountStatus: 'SUSPENDED' },
    });

    try {
      const { reservation } = await createAcceptedReservation(
        ctx,
        'Eligibility Filter Pack',
      );
      const delivery = await requestDelivery(ctx, reservation.id);

      const count = await prisma.notification.count({
        where: {
          userId: { in: [ctx.driverId, ctx.secondDriverId] },
          notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
          relatedEntityId: delivery.id,
        },
      });
      assert.equal(count, 0);
    } finally {
      await prisma.user.update({
        where: { id: ctx.driverId },
        data: { accountStatus: 'ACTIVE' },
      });
      await prisma.driverProfile.update({
        where: { userId: ctx.secondDriverId },
        data: { acceptingNewJobs: true, availability: 'AVAILABLE' },
      });
    }
  });

  test('new job notifications exclude drivers at the active delivery limit', async () => {
    for (let index = 0; index < 3; index += 1) {
      const { reservation } = await createAcceptedReservation(
        ctx,
        `Limit Assignment ${index}`,
      );
      const delivery = await requestDelivery(ctx, reservation.id);
      await acceptDelivery(ctx.driverId, delivery.id);
    }

    const { reservation } = await createAcceptedReservation(
      ctx,
      'Limit Target Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);

    const limitedDriverNotification = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
      },
    });
    const eligibleDriverNotification = await prisma.notification.count({
      where: {
        userId: ctx.secondDriverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
      },
    });

    assert.equal(limitedDriverNotification, 0);
    assert.equal(eligibleDriverNotification, 1);
  });

  test('not accepting suppresses only new-job discovery and preserves assigned event notifications and history', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'Notification Separation Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);

    const historicalNewJob = await prisma.notification.findFirstOrThrow({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
      },
    });
    await prisma.notification.update({
      where: { id: historicalNewJob.id },
      data: { isRead: true, readAt: new Date() },
    });

    await acceptDelivery(ctx.driverId, delivery.id);
    const paused = await updateDriverAvailability(ctx.driverId, {
      acceptingNewJobs: false,
    });
    assert.equal(paused.acceptingNewJobs, false);
    assert.equal(paused.availability, 'ON_DELIVERY');

    const now = Date.now();
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: new Date(now + 5 * 60_000),
        supplierPickupWindowEnd: new Date(now + 30 * 60_000),
        confirmedDeliveryWindowStart: new Date(now + 10 * 60_000),
        confirmedDeliveryWindowEnd: new Date(now + 45 * 60_000),
      },
    });

    await notifyDriverPickupTime(delivery.id);
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: 'PICKED_UP', pickedUpAt: new Date() },
    });
    await notifyDriverDropoffTime(delivery.id);
    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId: delivery.id,
      driverUserId: ctx.driverId,
    });
    await notifyDriverDeliveryUnassignedByAdmin({
      deliveryId: delivery.id,
      driverUserId: ctx.driverId,
      materialTitle: 'Notification Separation Pack',
    });

    const assignedTypes = await prisma.notification.findMany({
      where: {
        userId: ctx.driverId,
        relatedEntityId: delivery.id,
        notificationType: {
          in: [
            DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
            DRIVER_NOTIFICATION_TYPES.DRIVER_DROPOFF_TIME,
            DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW,
            DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN,
          ],
        },
      },
      select: { notificationType: true },
    });
    assert.deepEqual(
      new Set(assignedTypes.map((row) => row.notificationType)),
      new Set([
        DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
        DRIVER_NOTIFICATION_TYPES.DRIVER_DROPOFF_TIME,
        DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW,
        DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN,
      ]),
    );

    const preservedHistory = await prisma.notification.findUnique({
      where: { id: historicalNewJob.id },
    });
    assert.ok(preservedHistory);
    assert.equal(preservedHistory.isRead, true);

    const next = await createAcceptedReservation(ctx, 'Paused Discovery Pack');
    const waitingDelivery = await requestDelivery(ctx, next.reservation.id);
    const pausedDriverNewJobs = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: waitingDelivery.id,
      },
    });
    const availableDriverNewJobs = await prisma.notification.count({
      where: {
        userId: ctx.secondDriverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: waitingDelivery.id,
      },
    });
    assert.equal(pausedDriverNewJobs, 0);
    assert.equal(availableDriverNewJobs, 1);
  });

  test('going available does not create retrospective new-job notifications', async () => {
    await prisma.driverProfile.updateMany({
      where: { userId: { in: [ctx.driverId, ctx.secondDriverId] } },
      data: { acceptingNewJobs: false, availability: 'OFFLINE' },
    });

    const { reservation } = await createAcceptedReservation(
      ctx,
      'Existing Waiting Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);
    const beforeToggle = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
      },
    });
    assert.equal(beforeToggle, 0);

    const available = await updateDriverAvailability(ctx.driverId, {
      acceptingNewJobs: true,
    });
    assert.equal(available.availability, 'AVAILABLE');

    const afterToggle = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
      },
    });
    assert.equal(afterToggle, 0);
  });

  test('re-running new job notification does not duplicate', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'Dup Pack');
    const delivery = await requestDelivery(ctx, reservation.id);

    await notifyNewDriverJob(delivery.id);
    await notifyNewDriverJob(delivery.id);

    for (const userId of [ctx.driverId, ctx.secondDriverId]) {
      const count = await prisma.notification.count({
        where: {
          userId,
          notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
          relatedEntityId: delivery.id,
        },
      });
      assert.equal(count, 1);
    }
  });

  test('accepting delivery removes unread new job notifications only', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'Accept Prune Pack');
    const delivery = await requestDelivery(ctx, reservation.id);

    const unread = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
        isRead: false,
      },
    });
    assert.ok(unread);

    await prisma.notification.update({
      where: { id: unread.id },
      data: { isRead: true },
    });

    await acceptDelivery(ctx.driverId, delivery.id);

    const readHistory = await prisma.notification.count({
      where: { id: unread.id },
    });
    assert.equal(readHistory, 1);

    const unreadRemaining = await prisma.notification.count({
      where: {
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
        relatedEntityId: delivery.id,
        isRead: false,
      },
    });
    assert.equal(unreadRemaining, 0);
  });

  test('delivery request does not create legacy job-available notifications', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'Legacy Pack');
    const delivery = await requestDelivery(ctx, reservation.id);

    const legacy = await prisma.notification.count({
      where: {
        notificationType: 'DRIVER_DELIVERY_AVAILABLE',
        relatedEntityId: delivery.id,
      },
    });
    assert.equal(legacy, 0);
  });

  test('driver accept does not create delivery accepted notification', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'Accept Pack');
    const delivery = await requestDelivery(ctx, reservation.id);

    await acceptDelivery(ctx.driverId, delivery.id);

    const accepted = await prisma.notification.findMany({
      where: {
        userId: ctx.driverId,
        notificationType: 'DRIVER_DELIVERY_ACCEPTED',
        relatedEntityId: delivery.id,
      },
    });

    assert.equal(accepted.length, 0);
  });

  test('pickup time notification created within 15 minutes before pickup', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'Soon Pickup Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const pickupStart = new Date(Date.now() + 10 * 60_000);
    const pickupEnd = new Date(pickupStart.getTime() + 60 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: pickupStart,
        supplierPickupWindowEnd: pickupEnd,
      },
    });

    await notifyDriverPickupTime(accepted.id);

    const reminder = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
        relatedEntityId: accepted.id,
      },
    });

    assert.ok(reminder);
    assert.equal(reminder.title, 'Pickup time');
    assert.match(reminder.body, /Pickup for Soon Pickup Pack starts soon/);
    assert.equal(
      (reminder.metadata as { materialTitle?: string } | null)?.materialTitle,
      'Soon Pickup Pack',
    );
  });

  test('GET notifications list syncs due pickup reminders idempotently', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'List Fetch Reminder Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const pickupStart = new Date(Date.now() + 10 * 60_000);
    const pickupEnd = new Date(pickupStart.getTime() + 60 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: pickupStart,
        supplierPickupWindowEnd: pickupEnd,
      },
    });

    const before = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
        relatedEntityId: accepted.id,
      },
    });

    await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 20,
      isRead: undefined,
    });
    await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 20,
      isRead: undefined,
    });

    const after = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
        relatedEntityId: accepted.id,
      },
    });
    assert.equal(after, 1);
    assert.equal(before <= after, true);
  });

  test('GET notifications list does not create new job notifications', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'List Fetch Job Pack',
    );
    await requestDelivery(ctx, reservation.id);

    const before = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
      },
    });
    assert.ok(before >= 1);

    await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 20,
      isRead: undefined,
    });
    await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 20,
      isRead: undefined,
    });

    const after = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType: DRIVER_NOTIFICATION_TYPES.DRIVER_NEW_JOB,
      },
    });
    assert.equal(after, before);
  });

  test('pickup window started notification is not created', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'Started Pickup Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const pickupStart = new Date(Date.now() - 5 * 60_000);
    const pickupEnd = new Date(Date.now() + 60 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: pickupStart,
        supplierPickupWindowEnd: pickupEnd,
      },
    });

    await notifyDriverPickupTime(accepted.id);

    const reminder = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType: 'DRIVER_PICKUP_WINDOW_STARTED',
        relatedEntityId: accepted.id,
      },
    });

    assert.equal(reminder, null);
  });

  test('pickup overdue notification is not created', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'Overdue Pickup Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const pickupStart = new Date(Date.now() - 3 * 60 * 60_000);
    const pickupEnd = new Date(Date.now() - 60 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: pickupStart,
        supplierPickupWindowEnd: pickupEnd,
      },
    });

    await notifyDriverPickupTime(accepted.id);

    const reminder = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType: 'DRIVER_PICKUP_OVERDUE',
        relatedEntityId: accepted.id,
      },
    });

    assert.equal(reminder, null);
  });

  test('pickup reminders are not created after PICKED_UP', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'Picked Up Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const activeStart = new Date(Date.now() - 15 * 60_000);
    const activeEnd = new Date(Date.now() + 45 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: activeStart,
        supplierPickupWindowEnd: activeEnd,
      },
    });

    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', accepted.id),
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: new Date(Date.now() - 3 * 60 * 60_000),
        supplierPickupWindowEnd: new Date(Date.now() - 60 * 60_000),
      },
    });

    await notifyDriverPickupTime(accepted.id);

    const overdue = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType: 'DRIVER_PICKUP_OVERDUE',
        relatedEntityId: accepted.id,
      },
    });

    assert.equal(overdue, null);
  });

  test('drop-off reminders are skipped if no delivery window exists', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'No Dropoff Window Pack',
    );
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        confirmedDeliveryWindowStart: null,
        confirmedDeliveryWindowEnd: null,
      },
    });

    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const activePickupStart = new Date(Date.now() - 15 * 60_000);
    const activePickupEnd = new Date(Date.now() + 45 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: activePickupStart,
        supplierPickupWindowEnd: activePickupEnd,
      },
    });

    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', accepted.id),
    });

    await notifyDriverDropoffTime(accepted.id);

    const dropoffReminder = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_NOTIFICATION_TYPES.DRIVER_DROPOFF_TIME,
        relatedEntityId: accepted.id,
      },
    });

    assert.equal(dropoffReminder, null);
  });

  test('drop-off reminders are created when delivery window exists', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'Dropoff Window Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const deliveryStart = new Date(Date.now() + 10 * 60_000);
    const deliveryEnd = new Date(deliveryStart.getTime() + 60 * 60_000);
    const activePickupStart = new Date(Date.now() - 15 * 60_000);
    const activePickupEnd = new Date(Date.now() + 45 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        confirmedDeliveryWindowStart: deliveryStart,
        confirmedDeliveryWindowEnd: deliveryEnd,
        supplierPickupWindowStart: activePickupStart,
        supplierPickupWindowEnd: activePickupEnd,
      },
    });

    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', accepted.id),
    });

    const soon = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_NOTIFICATION_TYPES.DRIVER_DROPOFF_TIME,
        relatedEntityId: accepted.id,
      },
    });
    assert.ok(soon);
    assert.equal(
      (soon.metadata as { materialTitle?: string } | null)?.materialTitle,
      'Dropoff Window Pack',
    );
  });

  test('drop-off reminders are not created after DELIVERED', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'Delivered Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const activePickupStart = new Date(Date.now() - 15 * 60_000);
    const activePickupEnd = new Date(Date.now() + 45 * 60_000);
    const deliveryStart = new Date(Date.now() - 15 * 60_000);
    const deliveryEnd = new Date(Date.now() + 45 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: activePickupStart,
        supplierPickupWindowEnd: activePickupEnd,
        confirmedDeliveryWindowStart: deliveryStart,
        confirmedDeliveryWindowEnd: deliveryEnd,
      },
    });

    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', accepted.id),
    });
    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'ON_THE_WAY',
    });
    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'ARRIVED_DROPOFF',
    });
    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'DELIVERED',
      confirmationCode: deriveHandoverCode('learner-delivery', accepted.id),
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        confirmedDeliveryWindowStart: new Date(Date.now() - 3 * 60 * 60_000),
        confirmedDeliveryWindowEnd: new Date(Date.now() - 60 * 60_000),
      },
    });

    await notifyDriverDropoffTime(accepted.id);

    const overdue = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
          notificationType: 'DRIVER_DROPOFF_OVERDUE',
        relatedEntityId: accepted.id,
      },
    });

    assert.equal(overdue, null);
  });

  test('next-step notifications are not created on status updates', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'Next Step Pack');
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const pickupStart = new Date(Date.now() - 5 * 60_000);
    const pickupEnd = new Date(Date.now() + 60 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: pickupStart,
        supplierPickupWindowEnd: pickupEnd,
      },
    });

    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'ARRIVED_PICKUP',
    });
    await updateDriverDeliveryStatus(ctx.driverId, accepted.id, {
      status: 'PICKED_UP',
      confirmationCode: deriveHandoverCode('supplier-handover', accepted.id),
    });

    const count = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
          notificationType: 'DRIVER_DELIVERY_NEXT_STEP',
        relatedEntityId: { startsWith: `${accepted.id}:` },
      },
    });

    assert.equal(count, 0);
  });

  test('lazy reminder sync does not create window-started notifications', async () => {
    const { reservation } = await createAcceptedReservation(
      ctx,
      'Lazy Sync Pack',
    );
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const pickupStart = new Date(Date.now() - 5 * 60_000);
    const pickupEnd = new Date(Date.now() + 60 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: pickupStart,
        supplierPickupWindowEnd: pickupEnd,
      },
    });

    await listActiveDriverDeliveries(ctx.driverId);

    const reminder = await prisma.notification.findFirst({
      where: {
        userId: ctx.driverId,
        notificationType: 'DRIVER_PICKUP_WINDOW_STARTED',
        relatedEntityId: accepted.id,
      },
    });

    assert.equal(reminder, null);
  });

  test('DRIVER role can read their notifications without job-available spam', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'Read Pack');
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const pickupStart = new Date(Date.now() + 10 * 60_000);
    const pickupEnd = new Date(pickupStart.getTime() + 60 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: pickupStart,
        supplierPickupWindowEnd: pickupEnd,
      },
    });
    await notifyDriverPickupTime(accepted.id);

    const page = await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 20,
      isRead: undefined,
    });

    assert.ok(
      !page.items.some(
        (item) =>
          item.notificationType === 'DRIVER_DELIVERY_AVAILABLE' ||
          item.title === 'New delivery job available',
      ),
    );
    assert.ok(
      page.items.some(
        (item) =>
          item.notificationType ===
            DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME &&
          item.relatedEntityId === accepted.id,
      ),
    );
    assert.ok(page.unreadCount >= 1);
  });

  test('repeated notifications list fetch does not create notifications', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'List Fetch Pack');
    await requestDelivery(ctx, reservation.id);

    const beforeCount = await prisma.notification.count({
      where: { userId: ctx.driverId },
    });

    await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 20,
      isRead: undefined,
    });
    await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 20,
      isRead: undefined,
    });

    const afterCount = await prisma.notification.count({
      where: { userId: ctx.driverId },
    });

    assert.equal(afterCount, beforeCount);
  });

  test('repeated pickup reminder sync does not duplicate', async () => {
    const { reservation } = await createAcceptedReservation(ctx, 'Throttle Pack');
    const delivery = await requestDelivery(ctx, reservation.id);
    const accepted = await acceptDelivery(ctx.driverId, delivery.id);

    const pickupStart = new Date(Date.now() + 10 * 60_000);
    const pickupEnd = new Date(pickupStart.getTime() + 60 * 60_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        supplierPickupWindowStart: pickupStart,
        supplierPickupWindowEnd: pickupEnd,
      },
    });

    resetDriverDeliveryReminderSyncThrottleForTests();

    await notifyDriverPickupTime(accepted.id);

    const afterFirstSync = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
        relatedEntityId: accepted.id,
      },
    });

    await notifyDriverPickupTime(accepted.id);
    await notifyDriverPickupTime(accepted.id);
    await notifyDriverPickupTime(accepted.id);

    const afterRepeatedSync = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_NOTIFICATION_TYPES.DRIVER_PICKUP_TIME,
        relatedEntityId: accepted.id,
      },
    });

    assert.equal(afterRepeatedSync, afterFirstSync);
    assert.ok(afterFirstSync >= 1);
  });
});
