import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { getMaterialById, getMaterials } from '../materials/materials.service.js';

import { createReservation, getMyReservationById, listMyReservations } from './reservations.service.js';

const TEST_MARKER = '[test-reservation-pickup-location]';

type TestContext = {
  learnerId: string;
  supplierId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
};

async function createUser(input: {
  displayName: string;
  emailSuffix: string;
  role: 'LEARNER' | 'SUPPLIER';
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

async function createMaterial(ctx: TestContext) {
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
      quantity: 2,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function createPendingReservation(ctx: TestContext) {
  const material = await createMaterial(ctx);
  const reservation = await createReservation(ctx.learnerId, {
    materialId: material.id,
    quantityRequested: 1,
  });
  ctx.createdReservationIds.push(reservation.id);
  return reservation;
}

async function cleanup(ctx: TestContext) {
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
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.learnerProfile.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.supplierProfile.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('listMyReservations pickupLocationFull privacy', () => {
  const ctx: TestContext = {
    learnerId: '',
    supplierId: '',
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
        area: `${TEST_MARKER}-area`,
        addressLine: '12 Supplier Street, Building B',
        latitude: 32.2211,
        longitude: 35.2544,
        visibility: 'ORDER_ONLY',
        isApproximate: false,
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

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.learnerId = learner.id;
    ctx.supplierId = supplier.id;
    ctx.createdUserIds.push(learner.id, supplier.id);
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('PENDING reservation returns pickupLocationFull null', async () => {
    const reservation = await createPendingReservation(ctx);

    const listed = (await listMyReservations(ctx.learnerId)).find(
      (item) => item.id === reservation.id,
    );

    assert.ok(listed);
    assert.equal(listed?.status, 'PENDING');
    assert.equal(listed?.pickupLocationFull, null);
    assert.equal(listed?.material.city, 'Nablus');
    assert.equal(listed?.material.area, `${TEST_MARKER}-area`);
  });

  test('ACCEPTED reservation returns full pickup location for owning learner', async () => {
    const reservation = await createPendingReservation(ctx);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });

    const listed = (await listMyReservations(ctx.learnerId)).find(
      (item) => item.id === reservation.id,
    );

    assert.ok(listed);
    assert.equal(listed?.status, 'ACCEPTED');
    assert.ok(listed?.pickupLocationFull);
    assert.equal(listed?.pickupLocationFull?.country, 'Palestine');
    assert.equal(listed?.pickupLocationFull?.city, 'Nablus');
    assert.equal(listed?.pickupLocationFull?.area, `${TEST_MARKER}-area`);
    assert.equal(
      listed?.pickupLocationFull?.addressLine,
      '12 Supplier Street, Building B',
    );
    assert.equal(listed?.pickupLocationFull?.latitude, 32.2211);
    assert.equal(listed?.pickupLocationFull?.longitude, 35.2544);
    assert.equal(listed?.pickupLocationFull?.isApproximate, false);
  });

  test('ACCEPTED reservation with active delivery still returns pickupLocationFull', async () => {
    const reservation = await createPendingReservation(ctx);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        pickupLocationId: ctx.locationId,
        dropoffLocationId: ctx.locationId,
        requestedByUserId: ctx.learnerId,
        status: 'WAITING_FOR_DRIVER',
      },
    });

    const listed = (await listMyReservations(ctx.learnerId)).find(
      (item) => item.id === reservation.id,
    );

    assert.ok(listed);
    assert.equal(listed?.status, 'ACCEPTED');
    assert.ok(listed?.activeDelivery);
    assert.ok(listed?.pickupLocationFull);
    assert.equal(
      listed?.pickupLocationFull?.addressLine,
      '12 Supplier Street, Building B',
    );
  });

  test('COMPLETED reservation keeps pickupLocationFull for history', async () => {
    const reservation = await createPendingReservation(ctx);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'COMPLETED',
        acceptedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const listed = (await listMyReservations(ctx.learnerId)).find(
      (item) => item.id === reservation.id,
    );

    assert.ok(listed);
    assert.equal(listed?.status, 'COMPLETED');
    assert.ok(listed?.pickupLocationFull);
    assert.equal(
      listed?.pickupLocationFull?.addressLine,
      '12 Supplier Street, Building B',
    );
    assert.equal(listed?.pickupLocationFull?.latitude, 32.2211);
    assert.equal(listed?.pickupLocationFull?.longitude, 35.2544);
  });

  test('CANCELLED, REJECTED, and EXPIRED reservations return pickupLocationFull null', async () => {
    for (const status of ['CANCELLED', 'REJECTED', 'EXPIRED'] as const) {
      const reservation = await createPendingReservation(ctx);

      await prisma.reservation.update({
        where: { id: reservation.id },
        data: {
          status,
          ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
          ...(status === 'REJECTED'
            ? { rejectedAt: new Date(), rejectionReason: 'Unavailable' }
            : {}),
        },
      });

      const listed = (await listMyReservations(ctx.learnerId)).find(
        (item) => item.id === reservation.id,
      );

      assert.ok(listed);
      assert.equal(listed?.status, status);
      assert.equal(listed?.pickupLocationFull, null);
    }
  });

  test('public material detail still omits precise pickup fields', async () => {
    const material = await createMaterial(ctx);
    const publicMaterial = await getMaterialById(material.id);

    assert.equal(publicMaterial.city, 'Nablus');
    assert.equal(publicMaterial.area, `${TEST_MARKER}-area`);
    assert.equal('latitude' in publicMaterial, false);
    assert.equal('longitude' in publicMaterial, false);
    assert.equal('addressLine' in publicMaterial, false);
  });

  test('public material list still omits precise pickup fields', async () => {
    const material = await createMaterial(ctx);
    const publicList = await getMaterials({
      page: 1,
      limit: 50,
      q: TEST_MARKER,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });

    const listed = publicList.items.find((item) => item.id === material.id);
    assert.ok(listed);
    assert.equal(listed?.city, 'Nablus');
    assert.equal(listed?.area, `${TEST_MARKER}-area`);
    assert.equal('latitude' in listed!, false);
    assert.equal('longitude' in listed!, false);
    assert.equal('addressLine' in listed!, false);
  });

  test('getMyReservationById returns learner-owned reservation', async () => {
    const material = await createMaterial(ctx);
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [
        {
          start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });

    const loaded = await getMyReservationById(ctx.learnerId, reservation.id);

    assert.equal(loaded.id, reservation.id);
    assert.equal(loaded.status, 'PENDING');
    assert.equal(loaded.material.id, material.id);
  });

  test('getMyReservationById rejects other learners', async () => {
    const material = await createMaterial(ctx);
    const reservation = await createReservation(ctx.learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [
        {
          start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });

    const otherLearner = await prisma.user.create({
      data: {
        email: `${TEST_MARKER}-other-${Date.now()}@test.local`,
        passwordHash: await hashPassword('Password123!'),
        displayName: 'Other Learner',
        accountStatus: 'ACTIVE',
      },
    });
    ctx.createdUserIds.push(otherLearner.id);

    await assert.rejects(
      () => getMyReservationById(otherLearner.id, reservation.id),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        return /not found/i.test(error.message);
      },
    );
  });
});
