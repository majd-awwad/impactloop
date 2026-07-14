import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { requestDeliveryForReservation } from '../deliveries/deliveries.service.js';

import {
  createMySavedDropoffAddress,
  deleteMySavedDropoffAddress,
  listMySavedDropoffAddresses,
  updateMySavedDropoffAddress,
} from './saved-dropoff-addresses.service.js';

const TEST_MARKER = '[test-saved-dropoff-addresses]';

type TestContext = {
  learnerId: string;
  supplierId: string;
  categoryId: string;
  locationId: string;
  materialId: string;
  reservationId: string;
};

const createTestContext = async (): Promise<TestContext> => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const passwordHash = await hashPassword('Password123!');

  const learner = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}@example.com`,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: {
        create: [{ role: 'LEARNER', isPrimary: true }],
      },
      learnerProfile: {
        create: {
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: [],
        },
      },
    },
  });

  const supplier = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} supplier ${suffix}`,
      email: `${TEST_MARKER}-supplier-${suffix}@example.com`,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: {
        create: [{ role: 'SUPPLIER', isPrimary: true }],
      },
    },
  });

  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} category ${suffix}`,
      nameAr: `${TEST_MARKER} category ${suffix}`,
      categoryType: 'MATERIAL',
      isActive: true,
    },
  });

  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Nablus',
      area: 'Downtown',
      addressLine: 'Supplier pickup',
      visibility: 'PRIVATE',
      isApproximate: false,
      locationType: 'MATERIAL_PICKUP',
    },
  });

  const supplierProfile = await prisma.supplierProfile.create({
    data: {
      userId: supplier.id,
      publicName: `${TEST_MARKER} supplier ${suffix}`,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      defaultPickupLocationId: location.id,
    },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: supplier.id,
      supplierProfileId: supplierProfile.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} material ${suffix}`,
      description: 'Test material',
      materialType: 'Test material',
      condition: 'GOOD',
      sourceType: 'STUDENT_LEFTOVER',
      quantity: 5,
      unit: 'piece',
      status: 'AVAILABLE',
      isFree: true,
      deliveryAllowed: true,
    },
  });

  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      ownerId: supplier.id,
      requesterId: learner.id,
      status: 'ACCEPTED',
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      pickupWindowStart: new Date(Date.now() + 60 * 60 * 1000),
      pickupWindowEnd: new Date(Date.now() + 2 * 60 * 60 * 1000),
    },
  });

  return {
    learnerId: learner.id,
    supplierId: supplier.id,
    categoryId: category.id,
    locationId: location.id,
    materialId: material.id,
    reservationId: reservation.id,
  };
};

const cleanupTestContext = async (ctx: TestContext) => {
  const deliveries = await prisma.delivery.findMany({
    where: { reservationId: ctx.reservationId },
    select: {
      pickupLocationId: true,
      dropoffLocationId: true,
    },
  });

  await prisma.deliveryStatusHistory.deleteMany({
    where: {
      delivery: {
        reservationId: ctx.reservationId,
      },
    },
  });
  await prisma.delivery.deleteMany({
    where: { reservationId: ctx.reservationId },
  });

  const deliveryLocationIds = deliveries.flatMap((delivery) => [
    delivery.pickupLocationId,
    delivery.dropoffLocationId,
  ]);

  await prisma.reservation.deleteMany({ where: { id: ctx.reservationId } });
  await prisma.material.deleteMany({ where: { id: ctx.materialId } });

  const savedLinks = await prisma.userSavedLocation.findMany({
    where: { userId: ctx.learnerId },
    select: { locationId: true },
  });
  await prisma.userSavedLocation.deleteMany({ where: { userId: ctx.learnerId } });

  const savedLocationIds = savedLinks.map((link) => link.locationId);
  const locationIdsToDelete = [
    ctx.locationId,
    ...deliveryLocationIds.filter((id): id is string => Boolean(id)),
    ...savedLocationIds,
  ];

  await prisma.location.deleteMany({
    where: {
      id: { in: [...new Set(locationIdsToDelete)] },
    },
  });
  await prisma.category.deleteMany({ where: { id: ctx.categoryId } });
  await prisma.supplierProfile.deleteMany({
    where: { userId: ctx.supplierId },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [ctx.learnerId, ctx.supplierId] } },
  });
};

describe('saved dropoff addresses', () => {
  let ctx: TestContext;

  before(async () => {
    ctx = await createTestContext();
  });

  after(async () => {
    await cleanupTestContext(ctx);
  });

  test('creates, lists, updates, and deletes saved dropoff addresses', async () => {
    const created = await createMySavedDropoffAddress(ctx.learnerId, {
      label: 'Home',
      location: {
        country: 'Palestine',
        city: 'Nablus',
        area: 'Old City',
        addressLine: 'Main street 1',
        isApproximate: false,
      },
      isDefault: true,
    });

    assert.equal(created.label, 'Home');
    assert.equal(created.isDefault, true);
    assert.equal(created.location.city, 'Nablus');

    const listed = await listMySavedDropoffAddresses(ctx.learnerId);
    assert.equal(listed.items.length, 1);
    assert.equal(listed.items[0]?.id, created.id);

    const updated = await updateMySavedDropoffAddress(
      ctx.learnerId,
      created.id,
      {
        label: 'Campus',
        location: {
          country: 'Palestine',
          city: 'Nablus',
          area: 'University',
          addressLine: 'Gate 2',
          isApproximate: false,
        },
      },
    );

    assert.equal(updated.label, 'Campus');
    assert.equal(updated.location.area, 'University');

    const deleted = await deleteMySavedDropoffAddress(ctx.learnerId, created.id);
    assert.equal(deleted.id, created.id);

    const afterDelete = await listMySavedDropoffAddresses(ctx.learnerId);
    assert.equal(afterDelete.items.length, 0);
  });

  test('requests delivery using a saved dropoff address', async () => {
    const saved = await createMySavedDropoffAddress(ctx.learnerId, {
      label: 'Workshop',
      location: {
        country: 'Palestine',
        city: 'Nablus',
        area: 'Industrial',
        addressLine: 'Unit 4',
        isApproximate: false,
      },
      isDefault: false,
    });

    const delivery = await requestDeliveryForReservation(
      ctx.learnerId,
      ctx.reservationId,
      {
        savedDropoffAddressId: saved.id,
        learnerNote: 'Leave at reception',
      },
    );

    assert.equal(delivery.status, 'WAITING_FOR_DRIVER');
    assert.equal(delivery.dropoffLocation.city, 'Nablus');
    assert.equal(delivery.dropoffLocation.area, 'Industrial');
    assert.equal(delivery.learnerNote, 'Leave at reception');
  });
});
