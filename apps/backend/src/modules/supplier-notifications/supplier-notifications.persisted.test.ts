import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { createNotification } from '../notifications/notifications.repository.js';
import {
  notifyNoDriverSupplierRescheduleRequested,
  notifyReservationCancelledByLearner,
  notifyReservationCreated,
  notifyReservationsExpired,
  notifyStalePickupSupplierRescheduleRequested,
} from '../notifications/reservation-notifications.js';
import { signAccessToken } from '../../utils/jwt.js';

const marker = '[persisted-supplier-notifications]';

type User = { id: string; roles: Array<{ role: string }> };

const createUser = async (role: 'SUPPLIER' | 'LEARNER' | 'ADMIN', suffix: string) => {
  return prisma.user.create({
    data: {
      displayName: `${marker} ${role} ${suffix}`,
      email: `${marker}-${role}-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash: 'not-used-by-test',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role, isPrimary: true }] },
      ...(role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${marker} ${suffix}`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : role === 'LEARNER'
          ? {
              learnerProfile: {
                create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
              },
            }
          : {}),
    },
    include: { roles: { select: { role: true } }, supplierProfile: true },
  });
};

const tokenFor = (user: User) =>
  signAccessToken({ sub: user.id, roles: user.roles.map((role) => role.role) });

const request = async (input: {
  port: number;
  path: string;
  method?: string;
  token?: string;
}) =>
  new Promise<{ status: number; body: any }>((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (input.token) headers.Authorization = `Bearer ${input.token}`;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: input.port,
        path: input.path,
        method: input.method ?? 'GET',
        headers,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode ?? 0,
            body: body ? JSON.parse(body) : null,
          });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });

test('verifies persisted supplier notification HTTP, ownership, filters, and read lifecycle', async () => {
  const createdNotificationIds: string[] = [];
  const createdReservationIds: string[] = [];
  const createdCategoryRequestIds: string[] = [];
  const createdMaterialIds: string[] = [];
  const createdLocationIds: string[] = [];
  const createdUserIds: string[] = [];
  const server = http.createServer(app);

  try {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true, nameEn: true },
    });
    assert.ok(category);

    const [supplierA, supplierB, learner, admin] = await Promise.all([
      createUser('SUPPLIER', 'A'),
      createUser('SUPPLIER', 'B'),
      createUser('LEARNER', 'L'),
      createUser('ADMIN', 'X'),
    ]);
    createdUserIds.push(supplierA.id, supplierB.id, learner.id, admin.id);
    const supplierAProfile = supplierA.supplierProfile;
    assert.ok(supplierAProfile);

    const location = await prisma.location.create({
      data: { country: 'Palestine', city: 'Nablus', area: 'Test', visibility: 'PRIVATE' },
    });
    createdLocationIds.push(location.id);

    const material = await prisma.material.create({
      data: {
        ownerId: supplierA.id,
        supplierProfileId: supplierAProfile.id,
        categoryId: category.id,
        title: `${marker} material`,
        description: 'Persisted verification material',
        materialType: 'piece',
        quantity: 10,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        locationId: location.id,
      },
    });
    createdMaterialIds.push(material.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: learner.id,
        ownerId: supplierA.id,
        quantityRequested: 1,
        fulfillmentMethod: 'PICKUP',
        status: 'PENDING',
      },
    });
    createdReservationIds.push(reservation.id);

    await notifyReservationCreated(reservation.id);
    await notifyReservationCreated(reservation.id);
    await notifyReservationCancelledByLearner(reservation.id);
    await notifyReservationCancelledByLearner(reservation.id);
    await notifyReservationsExpired([reservation.id]);
    await notifyReservationsExpired([reservation.id]);
    await notifyNoDriverSupplierRescheduleRequested(reservation.id, 'verification');
    await notifyNoDriverSupplierRescheduleRequested(reservation.id, 'verification');
    await notifyStalePickupSupplierRescheduleRequested(reservation.id, 'verification');
    await notifyStalePickupSupplierRescheduleRequested(reservation.id, 'verification');
    const producerRows = await prisma.notification.findMany({
      where: { entityId: reservation.id, eventKey: { contains: reservation.id } },
      select: { id: true, eventKey: true, notificationType: true },
    });
    assert.equal(new Set(producerRows.map((row) => row.eventKey)).size, producerRows.length);
    assert.equal(producerRows.filter((row) => row.notificationType === 'RESERVATION_REQUESTED').length, 1);
    assert.equal(producerRows.filter((row) => row.notificationType === 'RESERVATION_CANCELLED').length, 1);
    assert.equal(producerRows.filter((row) => row.notificationType === 'RESERVATION_EXPIRED').length, 2);
    assert.equal(producerRows.filter((row) => row.notificationType === 'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED').length, 1);
    assert.equal(producerRows.filter((row) => row.notificationType === 'STALE_PICKUP_SUPPLIER_RESCHEDULE_REQUESTED').length, 1);
    createdNotificationIds.push(...producerRows.map((row) => row.id));

    const pendingCategory = await prisma.categoryRequest.create({
      data: {
        requestedName: `${marker} pending category`,
        normalizedRequestedName: `${marker}-pending-category`,
        requestedByUserId: supplierA.id,
        status: 'PENDING',
        listingDraftJson: { title: `${marker} pending draft` },
      },
    });
    const approvedCategory = await prisma.categoryRequest.create({
      data: {
        requestedName: `${marker} approved category`,
        normalizedRequestedName: `${marker}-approved-category`,
        requestedByUserId: supplierA.id,
        status: 'APPROVED',
        approvedCategoryId: category.id,
        listingDraftJson: { title: `${marker} approved draft` },
      },
    });
    const publishedCategory = await prisma.categoryRequest.create({
      data: {
        requestedName: `${marker} published category`,
        normalizedRequestedName: `${marker}-published-category`,
        requestedByUserId: supplierA.id,
        status: 'APPROVED',
        approvedCategoryId: category.id,
        publishedMaterialId: material.id,
        publishedAt: new Date(),
        listingDraftJson: { title: `${marker} published draft` },
      },
    });
    createdCategoryRequestIds.push(pendingCategory.id, approvedCategory.id, publishedCategory.id);

    const insert = async (input: {
      userId: string;
      type: string;
      title: string;
      entityType?: string;
      entityId?: string;
      isRead?: boolean;
      createdAt?: Date;
      eventKey?: string;
    }) => {
      const row = await prisma.notification.create({
        data: {
          userId: input.userId,
          notificationType: input.type,
          title: input.title,
          body: `${input.title} message`,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          relatedEntityType: input.entityType ?? null,
          relatedEntityId: input.entityId ?? null,
          eventKey: input.eventKey ?? null,
          isRead: input.isRead ?? false,
          createdAt: input.createdAt ?? new Date(),
          metadata: { source: 'persisted-test' },
        },
      });
      createdNotificationIds.push(row.id);
      return row;
    };

    const baseTime = new Date(Date.now() - 60_000);
    const rows = await Promise.all([
      insert({ userId: supplierA.id, type: 'RESERVATION_REQUESTED', title: `${marker} reservation`, entityType: 'RESERVATION', entityId: reservation.id, eventKey: `${marker}:reservation` }),
      insert({ userId: supplierA.id, type: 'CATEGORY_REQUEST_UPDATE', title: `${marker} pending category`, entityType: 'CATEGORY_REQUEST', entityId: pendingCategory.id, eventKey: `${marker}:pending-category` }),
      insert({ userId: supplierA.id, type: 'CATEGORY_REQUEST_UPDATE', title: `${marker} approved category`, entityType: 'CATEGORY_REQUEST', entityId: approvedCategory.id, eventKey: `${marker}:approved-category` }),
      insert({ userId: supplierA.id, type: 'CATEGORY_REQUEST_UPDATE', title: `${marker} published category`, entityType: 'CATEGORY_REQUEST', entityId: publishedCategory.id, eventKey: `${marker}:published-category` }),
      insert({ userId: supplierA.id, type: 'MATERIAL_MODERATION_UPDATE', title: `${marker} material moderation`, entityType: 'MATERIAL', entityId: material.id, eventKey: `${marker}:material` }),
      insert({ userId: supplierA.id, type: 'SUPPLIER_VERIFICATION_UPDATE', title: `${marker} verification`, entityType: 'SUPPLIER_PROFILE', entityId: supplierAProfile.id, eventKey: `${marker}:verification` }),
      insert({ userId: supplierA.id, type: `${marker}_UNKNOWN`, title: `${marker} unknown`, eventKey: `${marker}:unknown` }),
      insert({ userId: supplierA.id, type: `${marker}_LEGACY_READ`, title: `${marker} legacy read`, isRead: true, createdAt: baseTime }),
      insert({ userId: supplierB.id, type: 'RESERVATION_REQUESTED', title: `${marker} supplier B`, entityType: 'RESERVATION', entityId: reservation.id, eventKey: `${marker}:supplier-b` }),
    ]);

    const idempotentA = await createNotification({
      userId: supplierA.id,
      notificationType: 'RESERVATION_REQUESTED',
      title: `${marker} idempotent`,
      body: 'idempotent',
      eventKey: `${marker}:idempotent:A`,
      entityType: 'RESERVATION',
      entityId: reservation.id,
    });
    const idempotentB = await createNotification({
      userId: supplierA.id,
      notificationType: 'RESERVATION_REQUESTED',
      title: `${marker} idempotent retry`,
      body: 'retry',
      eventKey: `${marker}:idempotent:A`,
      entityType: 'RESERVATION',
      entityId: reservation.id,
    });
    assert.equal(idempotentA.id, idempotentB.id);
    createdNotificationIds.push(idempotentA.id);
    assert.equal(await prisma.notification.count({ where: { eventKey: `${marker}:idempotent:A` } }), 1);

    const genericLearnerNotification = await createNotification({
      userId: learner.id,
      notificationType: `${marker}_GENERIC_UNKNOWN`,
      title: `${marker} generic`,
      body: 'generic',
      eventKey: `${marker}:generic`,
    });
    createdNotificationIds.push(genericLearnerNotification.id);

    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => resolve());
      server.on('error', reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const port = address.port;
    const supplierToken = tokenFor(supplierA);
    const supplierBToken = tokenFor(supplierB);
    const learnerToken = tokenFor(learner);

    assert.equal((await request({ port, path: '/api/supplier/notifications' })).status, 401);
    assert.equal((await request({ port, path: '/api/supplier/notifications', token: learnerToken })).status, 403);

    const list = await request({ port, path: '/api/supplier/notifications?limit=50', token: supplierToken });
    assert.equal(list.status, 200);
    const data = list.body.data;
    assert.ok(Array.isArray(data.items));
    assert.ok(data.pagination && data.summary);
    assert.ok(data.items.every((item: any) => createdNotificationIds.includes(item.id)));
    assert.ok(data.items.some((item: any) => item.rawType === `${marker}_UNKNOWN` && item.category === 'UNKNOWN' && item.action.type === 'UNKNOWN'));
    const destinations = new Set([
      null,
      'SUPPLIER_RESERVATION_DETAIL',
      'SUPPLIER_ADD_MATERIAL_CATEGORY_REQUEST',
      'SUPPLIER_ADD_MATERIAL_PRICE_REQUEST',
      'SUPPLIER_MATERIAL_DETAIL',
      'SUPPLIER_PROFILE',
    ]);
    assert.ok(data.items.every((item: any) => destinations.has(item.action.destination)));
    assert.equal(data.summary.needsAction + data.summary.waiting + data.summary.updates + data.summary.resolved + data.summary.unknownState, data.summary.total);
    assert.equal(data.summary.reservations + data.summary.materials + data.summary.deliveryRecovery + data.summary.account + data.summary.system + data.summary.unknownCategory, data.summary.total);
    for (let index = 1; index < data.items.length; index += 1) {
      const priority = (state: string) => ({ NEEDS_ACTION: 1, WAITING: 2, UPDATE: 3, RESOLVED: 4, UNKNOWN: 5 } as Record<string, number>)[state];
      assert.ok(priority(data.items[index - 1].state) <= priority(data.items[index].state));
    }

    const pageOne = await request({ port, path: '/api/supplier/notifications?page=1&limit=2', token: supplierToken });
    const pageTwo = await request({ port, path: '/api/supplier/notifications?page=2&limit=2', token: supplierToken });
    assert.equal(pageOne.status, 200);
    assert.equal(pageTwo.status, 200);
    assert.equal(new Set([...pageOne.body.data.items, ...pageTwo.body.data.items].map((item: any) => item.id)).size, pageOne.body.data.items.length + pageTwo.body.data.items.length);
    assert.equal((await request({ port, path: '/api/supplier/notifications?page=999&limit=2', token: supplierToken })).body.data.items.length, 0);

    assert.equal((await request({ port, path: '/api/supplier/notifications?state=INVALID', token: supplierToken })).status, 400);
    assert.equal((await request({ port, path: '/api/supplier/notifications?dateFrom=2026-02-02&dateTo=2026-01-01', token: supplierToken })).status, 400);
    assert.equal((await request({ port, path: '/api/supplier/notifications?isRead=false&category=MATERIAL_REVIEW&search=material', token: supplierToken })).status, 200);

    const unreadBefore = (await request({ port, path: '/api/supplier/notifications/unread-count', token: supplierToken })).body.data.unreadCount;
    const reservationRow = rows[0];
    const readResponse = await request({ port, path: `/api/supplier/notifications/${reservationRow.id}/read`, method: 'PATCH', token: supplierToken });
    assert.equal(readResponse.status, 200);
    const persistedRead = await prisma.notification.findUnique({ where: { id: reservationRow.id }, select: { isRead: true, readAt: true } });
    assert.equal(persistedRead?.isRead, true);
    assert.ok(persistedRead?.readAt);
    const unreadAfterOne = (await request({ port, path: '/api/supplier/notifications/unread-count', token: supplierToken })).body.data.unreadCount;
    assert.equal(unreadAfterOne, unreadBefore - 1);
    assert.equal((await request({ port, path: `/api/supplier/notifications/${reservationRow.id}/read`, method: 'PATCH', token: supplierToken })).status, 200);
    assert.equal((await request({ port, path: '/api/supplier/notifications/read-all', method: 'PATCH', token: supplierToken })).status, 200);
    assert.equal((await request({ port, path: '/api/supplier/notifications/unread-count', token: supplierToken })).body.data.unreadCount, 0);

    assert.equal((await request({ port, path: `/api/supplier/notifications/${reservationRow.id}/read`, method: 'PATCH', token: supplierBToken })).status, 404);
    assert.equal((await request({ port, path: '/api/supplier/notifications?limit=50', token: supplierBToken })).body.data.items.every((item: any) => item.id !== reservationRow.id), true);

    const genericList = await request({ port, path: '/api/notifications?limit=50', token: learnerToken });
    assert.equal(genericList.status, 200);
    assert.ok(genericList.body.data.items.some((item: any) => item.id === genericLearnerNotification.id && item.notificationType === `${marker}_GENERIC_UNKNOWN`));
    assert.equal((await request({ port, path: '/api/notifications/unread-count', token: learnerToken })).status, 200);
    assert.equal((await request({ port, path: `/api/notifications/${genericLearnerNotification.id}/read`, method: 'PATCH', token: learnerToken })).status, 200);
    assert.equal((await request({ port, path: '/api/notifications/read-all', method: 'PATCH', token: learnerToken })).status, 200);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (createdNotificationIds.length) await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
    if (createdReservationIds.length) await prisma.reservation.deleteMany({ where: { id: { in: createdReservationIds } } });
    if (createdCategoryRequestIds.length) await prisma.categoryRequest.deleteMany({ where: { id: { in: createdCategoryRequestIds } } });
    if (createdMaterialIds.length) await prisma.material.deleteMany({ where: { id: { in: createdMaterialIds } } });
    if (createdLocationIds.length) await prisma.location.deleteMany({ where: { id: { in: createdLocationIds } } });
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});
