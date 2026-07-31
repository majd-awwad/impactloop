import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { createReservation } from '../reservations/reservations.service.js';
import { acceptSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';
import type { CreateReservationInput } from '../reservations/reservations.validation.js';

import {
  getMyNotificationUnreadCount,
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from './notifications.service.js';
import { createNotification } from './notifications.repository.js';

const TEST_MARKER = '[test-notifications]';

type TestContext = {
  learnerId: string;
  supplierId: string;
  categoryId: string;
  locationId: string;
  materialId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
  createdNotificationIds: string[];
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
): CreateReservationInput {
  return {
    materialId,
    quantityRequested,
    fulfillmentMethod: 'PICKUP',
    learnerPreferredPickupWindows: [futurePreferredWindow()],
  };
}

async function createUser(role: 'LEARNER' | 'SUPPLIER') {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${role}`,
      email: `${TEST_MARKER}-${role}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role, isPrimary: true }],
      },
      ...(role === 'LEARNER'
        ? {
            learnerProfile: {
              create: {
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            },
          }
        : {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} supplier`,
                verificationStatus: 'VERIFIED',
              },
            },
          }),
    },
    select: { id: true },
  });
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdNotificationIds.length) {
    await prisma.notification.deleteMany({
      where: { id: { in: ctx.createdNotificationIds } },
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
    await prisma.user.deleteMany({ where: { id: { in: ctx.createdUserIds } } });
  }
}

describe('notifications module', () => {
  const ctx: TestContext = {
    learnerId: '',
    supplierId: '',
    categoryId: '',
    locationId: '',
    materialId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdReservationIds: [],
    createdNotificationIds: [],
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

    const learner = await createUser('LEARNER');
    const supplier = await createUser('SUPPLIER');

    const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
      where: { userId: supplier.id },
      select: { id: true },
    });

    const material = await prisma.material.create({
      data: {
        ownerId: supplier.id,
        supplierProfileId: supplierProfile.id,
        categoryId: category.id,
        locationId: location.id,
        title: `${TEST_MARKER} material`,
        description: 'Notification test material',
        materialType: 'Test material',
        quantity: 5,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: true,
      },
      select: { id: true },
    });

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.learnerId = learner.id;
    ctx.supplierId = supplier.id;
    ctx.materialId = material.id;
    ctx.createdUserIds.push(learner.id, supplier.id);
    ctx.createdMaterialIds.push(material.id);
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  async function resetNotifications() {
    await prisma.notification.deleteMany({
      where: { userId: { in: [ctx.learnerId, ctx.supplierId] } },
    });
    ctx.createdNotificationIds = [];
  }

  test('listMyNotifications returns only the authenticated user rows', async () => {
    await resetNotifications();
    const mine = await createNotification({
      userId: ctx.learnerId,
      notificationType: 'TEST',
      title: 'Mine',
      body: 'Learner notification',
      relatedEntityType: 'RESERVATION',
      relatedEntityId: 'res-test',
    });
    const other = await createNotification({
      userId: ctx.supplierId,
      notificationType: 'TEST',
      title: 'Other',
      body: 'Supplier notification',
    });
    ctx.createdNotificationIds.push(mine.id, other.id);

    const listed = await listMyNotifications(ctx.learnerId, {
      page: 1,
      limit: 20,
      isRead: undefined,
    });

    assert.equal(listed.items.length, 1);
    assert.equal(listed.items[0]?.title, 'Mine');
    assert.equal(listed.unreadCount, 1);
  });

  test('markMyNotificationRead and markAllMyNotificationsRead update unread count', async () => {
    await resetNotifications();
    const first = await createNotification({
      userId: ctx.learnerId,
      notificationType: 'TEST',
      title: 'First',
      body: 'First notification',
    });
    const second = await createNotification({
      userId: ctx.learnerId,
      notificationType: 'TEST',
      title: 'Second',
      body: 'Second notification',
    });
    ctx.createdNotificationIds.push(first.id, second.id);

    const marked = await markMyNotificationRead(ctx.learnerId, first.id);
    assert.equal(marked.isRead, true);

    const partialUnread = await getMyNotificationUnreadCount(ctx.learnerId);
    assert.equal(partialUnread.unreadCount, 1);

    const cleared = await markAllMyNotificationsRead(ctx.learnerId);
    assert.equal(cleared.updatedCount, 1);

    const finalUnread = await getMyNotificationUnreadCount(ctx.learnerId);
    assert.equal(finalUnread.unreadCount, 0);
  });

  test('markMyNotificationRead rejects foreign notification', async () => {
    await resetNotifications();
    const notification = await createNotification({
      userId: ctx.supplierId,
      notificationType: 'TEST',
      title: 'Supplier only',
      body: 'Not for learner',
    });
    ctx.createdNotificationIds.push(notification.id);

    await assert.rejects(
      () => markMyNotificationRead(ctx.learnerId, notification.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('reservation create and accept write persisted notifications', async () => {
    await resetNotifications();
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(ctx.materialId, 1),
    );
    ctx.createdReservationIds.push(reservation.id);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const supplierNotifications = await listMyNotifications(ctx.supplierId, {
      page: 1,
      limit: 20,
      isRead: false,
    });

    assert.ok(
      supplierNotifications.items.some(
        (item) =>
          item.notificationType === 'RESERVATION_REQUESTED' &&
          item.relatedEntityId === reservation.id,
      ),
    );

    const window = reservation.learnerPreferredPickupWindows[0];
    assert.ok(window);

    await acceptSupplierReservation(ctx.supplierId, reservation.id, {
      pickupWindowStart: window.start,
      pickupWindowEnd: window.end,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const learnerNotifications = await listMyNotifications(ctx.learnerId, {
      page: 1,
      limit: 20,
      isRead: false,
    });

    const acceptedNotification = learnerNotifications.items.find(
      (item) =>
        item.notificationType === 'RESERVATION_ACCEPTED' &&
        item.relatedEntityId === reservation.id,
    );
    assert.ok(acceptedNotification);
    assert.equal(acceptedNotification.actionType, 'OPEN_RESERVATION');
    assert.equal(
      acceptedNotification.metadata?.materialTitle,
      reservation.material.title,
    );
  });

  test('listMyNotifications tolerates unknown types and empty labels', async () => {
    await resetNotifications();
    const notification = await createNotification({
      userId: ctx.learnerId,
      notificationType: 'LEGACY_UNKNOWN_EVENT',
      title: ' ',
      body: '',
    });
    ctx.createdNotificationIds.push(notification.id);

    const listed = await listMyNotifications(ctx.learnerId, {
      page: 1,
      limit: 50,
      isRead: undefined,
    });

    const item = listed.items.find((row) => row.id === notification.id);
    assert.ok(item);
    assert.equal(item?.notificationType, 'LEGACY_UNKNOWN_EVENT');
    assert.equal(item?.title, 'Notification');
    assert.equal(item?.body, '');
  });

  test('listMyNotifications normalizes pagination numbers', async () => {
    await resetNotifications();
    const notification = await createNotification({
      userId: ctx.learnerId,
      notificationType: 'TEST',
      title: 'Paged',
      body: 'Paged notification',
    });
    ctx.createdNotificationIds.push(notification.id);

    const listed = await listMyNotifications(ctx.learnerId, {
      page: 1,
      limit: 50,
      isRead: undefined,
    });

    assert.equal(listed.pagination.limit, 50);
    assert.ok(listed.items.length >= 1);

    const capped = await listMyNotifications(ctx.learnerId, {
      page: 1,
      limit: 100,
      isRead: undefined,
    });

    assert.equal(capped.pagination.limit, 50);
  });
});
