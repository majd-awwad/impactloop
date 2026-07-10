import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import { DRIVER_NOTIFICATION_TYPES } from './driver-delivery-notification-types.js';
import { notifyDriverDeliveryMovedToAdminReview } from './driver-notification-events.service.js';
import {
  getMyNotificationUnreadCount,
  listMyNotifications,
  markMyNotificationRead,
} from './notifications.service.js';
import { createNotification } from './notifications.repository.js';

const TEST_MARKER = '[test-driver-moved-to-admin-review-notification]';

type TestContext = {
  driverId: string;
  otherDriverId: string;
  createdUserIds: string[];
  createdNotificationIds: string[];
};

async function createDriver(suffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Driver ${suffix}`,
      email: `${TEST_MARKER}-driver-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
      driverProfile: {
        create: {
          displayName: `${TEST_MARKER} Driver ${suffix}`,
          phone: `+97059${Math.floor(Math.random() * 1_000_000)
            .toString()
            .padStart(6, '0')}`,
          city: 'Ramallah',
          area: 'Center',
          transportationType: 'BICYCLE',
          vehicleType: 'BICYCLE',
        },
      },
    },
  });
}

describe('driver moved-to-admin-review notification visibility', () => {
  const ctx: TestContext = {
    driverId: '',
    otherDriverId: '',
    createdUserIds: [],
    createdNotificationIds: [],
  };

  before(async () => {
    const driver = await createDriver('primary');
    const otherDriver = await createDriver('other');
    ctx.driverId = driver.id;
    ctx.otherDriverId = otherDriver.id;
    ctx.createdUserIds.push(driver.id, otherDriver.id);
  });

  after(async () => {
    if (ctx.createdNotificationIds.length) {
      await prisma.notification.deleteMany({
        where: { id: { in: ctx.createdNotificationIds } },
      });
    }

    if (ctx.createdUserIds.length) {
      await prisma.user.deleteMany({
        where: { id: { in: ctx.createdUserIds } },
      });
    }
  });

  test('listMyNotifications returns DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW for the driver', async () => {
    const deliveryId = `delivery-${Date.now()}`;

    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId,
      driverUserId: ctx.driverId,
    });

    const listed = await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 20,
      isRead: undefined,
    });

    const item = listed.items.find(
      (entry) =>
        entry.notificationType ===
          DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW &&
        entry.relatedEntityId === deliveryId,
    );
    assert.ok(item);
    assert.equal(item.relatedEntityType, 'DELIVERY');
    assert.equal(item.title, 'Delivery moved to admin review');
    assert.ok(item.body.includes('pickup was not completed'));
    assert.equal(item.isRead, false);
    ctx.createdNotificationIds.push(item.id);
  });

  test('notification belongs only to the removed driver', async () => {
    const deliveryId = `delivery-other-${Date.now()}`;

    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId,
      driverUserId: ctx.driverId,
    });

    const driverListed = await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 50,
      isRead: undefined,
    });
    const otherListed = await listMyNotifications(ctx.otherDriverId, {
      page: 1,
      limit: 50,
      isRead: undefined,
    });

    const driverItem = driverListed.items.find(
      (entry) => entry.relatedEntityId === deliveryId,
    );
    const otherItem = otherListed.items.find(
      (entry) => entry.relatedEntityId === deliveryId,
    );

    assert.ok(driverItem);
    assert.equal(otherItem, undefined);
    if (driverItem) {
      ctx.createdNotificationIds.push(driverItem.id);
    }
  });

  test('notifyDriverDeliveryMovedToAdminReview is idempotent', async () => {
    const deliveryId = `delivery-idempotent-${Date.now()}`;

    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId,
      driverUserId: ctx.driverId,
    });
    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId,
      driverUserId: ctx.driverId,
    });

    const rows = await prisma.notification.findMany({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW,
        relatedEntityType: 'DELIVERY',
        relatedEntityId: deliveryId,
      },
    });

    assert.equal(rows.length, 1);
    ctx.createdNotificationIds.push(rows[0]!.id);
  });

  test('repeated listMyNotifications fetch does not duplicate notifications', async () => {
    const deliveryId = `delivery-list-fetch-${Date.now()}`;

    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId,
      driverUserId: ctx.driverId,
    });

    const beforeCount = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW,
        relatedEntityId: deliveryId,
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

    const afterCount = await prisma.notification.count({
      where: {
        userId: ctx.driverId,
        notificationType:
          DRIVER_NOTIFICATION_TYPES.DRIVER_DELIVERY_MOVED_TO_ADMIN_REVIEW,
        relatedEntityId: deliveryId,
      },
    });

    assert.equal(afterCount, beforeCount);
    assert.equal(beforeCount, 1);

    const rows = await prisma.notification.findMany({
      where: {
        userId: ctx.driverId,
        relatedEntityId: deliveryId,
      },
      select: { id: true },
    });
    ctx.createdNotificationIds.push(...rows.map((row) => row.id));
  });

  test('legacy driver notification types remain hidden from list', async () => {
    const legacy = await createNotification({
      userId: ctx.driverId,
      notificationType: 'DRIVER_DELIVERY_AVAILABLE',
      title: 'Legacy job available',
      body: 'Should not appear',
      relatedEntityType: 'DELIVERY',
      relatedEntityId: `legacy-${Date.now()}`,
    });
    ctx.createdNotificationIds.push(legacy.id);

    const listed = await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 50,
      isRead: undefined,
    });

    assert.equal(
      listed.items.some((item) => item.id === legacy.id),
      false,
    );
  });

  test('read and unread filters still work for moved-to-admin-review notifications', async () => {
    const deliveryId = `delivery-read-filter-${Date.now()}`;

    await notifyDriverDeliveryMovedToAdminReview({
      deliveryId,
      driverUserId: ctx.driverId,
    });

    const unreadListed = await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 50,
      isRead: false,
    });
    const unreadItem = unreadListed.items.find(
      (entry) => entry.relatedEntityId === deliveryId,
    );
    assert.ok(unreadItem);
    ctx.createdNotificationIds.push(unreadItem.id);

    const marked = await markMyNotificationRead(ctx.driverId, unreadItem.id);
    assert.equal(marked.isRead, true);

    const stillUnread = await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 50,
      isRead: false,
    });
    assert.equal(
      stillUnread.items.some((entry) => entry.id === unreadItem.id),
      false,
    );

    const readListed = await listMyNotifications(ctx.driverId, {
      page: 1,
      limit: 50,
      isRead: true,
    });
    assert.ok(readListed.items.some((entry) => entry.id === unreadItem.id));

    const unreadCount = await getMyNotificationUnreadCount(ctx.driverId);
    assert.ok(unreadCount.unreadCount >= 0);
  });
});
