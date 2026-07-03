import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../../database/prisma.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import {
  deleteSupplierMaterial,
  updateSupplierMaterial,
} from '../supplier/supplier.service.js';
import {
  acceptSupplierReservation,
  completeSupplierReservation,
  declineSupplierReservation,
} from '../supplier-reservations/supplier-reservations.service.js';
import { getMaterialById } from '../materials/materials.service.js';

import { createReservation } from './reservations.service.js';
import { listMyReservations } from './reservations.service.js';
import { cancelReservation } from './reservations.service.js';
import type { CreateReservationInput } from './reservations.validation.js';

const TEST_MARKER = '[test-learner-reservations]';

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

  return acceptSupplierReservation(supplierId, reservation.id, {
    pickupWindowStart: window.start,
    pickupWindowEnd: window.end,
  });
}

function deliveryReservationPayload(
  materialId: string,
  quantityRequested: number,
  overrides: Partial<CreateReservationInput> = {},
): CreateReservationInput {
  return {
    materialId,
    quantityRequested,
    fulfillmentMethod: 'DELIVERY',
    learnerPreferredDeliveryWindows: [futurePreferredWindow()],
    deliveryAddressText: '12 Learner Street, Nablus',
    safeDropoffAllowed: false,
    ...overrides,
  };
}

type TestContext = {
  learnerId: string;
  otherLearnerId: string;
  supplierId: string;
  supplierOnlyId: string;
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

async function createMaterial(
  ctx: TestContext,
  status:
    | 'AVAILABLE'
    | 'PENDING_RESERVATION'
    | 'RESERVED'
    | 'REUSED'
    | 'UNAVAILABLE' = 'AVAILABLE',
  quantity = 3,
  options: { deliveryAllowed?: boolean } = {},
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
      quantity,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status,
      isFree: true,
      deliveryAllowed: options.deliveryAllowed ?? false,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
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

describe('createReservation', () => {
  const ctx: TestContext = {
    learnerId: '',
    otherLearnerId: '',
    supplierId: '',
    supplierOnlyId: '',
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
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
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
    const supplierOnly = await createUser({
      displayName: 'supplier-only',
      emailSuffix: 'supplier-only',
      role: 'SUPPLIER',
    });

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.learnerId = learner.id;
    ctx.otherLearnerId = otherLearner.id;
    ctx.supplierId = supplier.id;
    ctx.supplierOnlyId = supplierOnly.id;
    ctx.createdUserIds.push(
      learner.id,
      otherLearner.id,
      supplier.id,
      supplierOnly.id,
    );
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('learner can reserve part of available material and listing stays available', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 4);

    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 2, {
        message: 'Please reserve this for my project.',
      }),
    );
    ctx.createdReservationIds.push(reservation.id);

    assert.equal(reservation.status, 'PENDING');
    assert.equal(reservation.material.id, material.id);
    assert.equal(reservation.quantityRequested, 2);
    assert.equal(reservation.fulfillmentMethod, 'PICKUP');
    assert.equal(reservation.learnerPreferredPickupWindows.length, 1);

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
      select: { status: true, quantity: true },
    });
    assert.equal(updatedMaterial?.status, 'AVAILABLE');
    assert.equal(Number(updatedMaterial?.quantity), 4);

    const history = await prisma.reservationStatusHistory.findFirst({
      where: {
        reservationId: reservation.id,
        newStatus: 'PENDING',
      },
    });
    assert.ok(history);
    assert.equal(history?.changedBy, ctx.learnerId);
  });

  test('owner cannot reserve own material', async () => {
    const material = await createMaterial(ctx);

    await assert.rejects(
      () =>
        createReservation(
          ctx.supplierId,
          pickupReservationPayload(material.id, 1),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  test('learner cannot reserve unavailable or reused materials', async () => {
    for (const status of ['UNAVAILABLE', 'REUSED'] as const) {
      const material = await createMaterial(ctx, status);

      await assert.rejects(
        () =>
          createReservation(
            ctx.learnerId,
            pickupReservationPayload(material.id, 1),
          ),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 409);
          return true;
        },
      );
    }
  });

  test('learner cannot reserve with invalid quantity', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 2);

    await assert.rejects(
      () =>
        createReservation(
          ctx.learnerId,
          pickupReservationPayload(material.id, 3),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  test('cannot create duplicate open reservation for same learner and material', async () => {
    const material = await createMaterial(ctx);

    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 1),
    );
    ctx.createdReservationIds.push(reservation.id);

    await assert.rejects(
      () =>
        createReservation(
          ctx.learnerId,
          pickupReservationPayload(material.id, 1),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('learner-created pending reservation blocks supplier delete but allows safe edit', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 2);

    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 1),
    );
    ctx.createdReservationIds.push(reservation.id);

    const updated = await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: 'Updated title',
      description: 'Updated description',
      quantity: 2,
      unit: 'piece',
      condition: 'GOOD',
      pickupAllowed: true,
      deliveryAllowed: false,
    });
    assert.equal(updated.title, 'Updated title');

    await assert.rejects(
      () =>
        updateSupplierMaterial(ctx.supplierId, material.id, {
          title: 'Too little stock',
          description: 'Updated description',
          quantity: 0,
          unit: 'piece',
          condition: 'GOOD',
          pickupAllowed: true,
          deliveryAllowed: false,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );

    await assert.rejects(
      () => deleteSupplierMaterial(ctx.supplierId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('learner can list only their own reservations with material summary', async () => {
    const ownMaterial = await createMaterial(ctx, 'AVAILABLE', 2);
    const otherMaterial = await createMaterial(ctx, 'AVAILABLE', 2);

    const ownReservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(ownMaterial.id, 1, {
        message: 'Need it for class',
      }),
    );
    const otherReservation = await createReservation(
      ctx.otherLearnerId,
      pickupReservationPayload(otherMaterial.id, 1),
    );
    ctx.createdReservationIds.push(ownReservation.id, otherReservation.id);

    const reservations = await listMyReservations(ctx.learnerId);

    assert.ok(reservations.some((item) => item.id === ownReservation.id));
    assert.equal(
      reservations.some((item) => item.id === otherReservation.id),
      false,
    );

    const listed = reservations.find((item) => item.id === ownReservation.id);
    assert.ok(listed);
    assert.equal(listed?.status, 'PENDING');
    assert.equal(listed?.quantityRequested, 1);
    assert.equal(listed?.message, 'Need it for class');
    assert.equal(listed?.fulfillmentMethod, 'PICKUP');
    assert.equal(listed?.learnerPreferredPickupWindows.length, 1);
    assert.equal(listed?.material.id, ownMaterial.id);
    assert.equal(listed?.material.status, 'AVAILABLE');
    assert.equal(listed?.material.city, 'Nablus');
    assert.equal(listed?.material.area, TEST_MARKER);
    assert.equal(listed?.pickupLocationFull, null);
    assert.ok(listed?.supplier.displayName);
  });

  test('learner reservation list includes material imageUrl when material has images', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 2);
    const imageUrl = `https://example.test/${TEST_MARKER}/reservation-material.jpg`;

    await prisma.materialImage.create({
      data: {
        materialId: material.id,
        imageUrl,
        isCover: false,
        sortOrder: 0,
      },
    });

    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 1),
    );
    ctx.createdReservationIds.push(reservation.id);

    const reservations = await listMyReservations(ctx.learnerId);
    const listed = reservations.find((item) => item.id === reservation.id);

    assert.equal(listed?.material.imageUrl, imageUrl);
  });

  test('accepted reservation list item includes pickup window data', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 2);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 1),
    );
    ctx.createdReservationIds.push(reservation.id);

    const pickupWindowStart = new Date();
    const pickupWindowEnd = new Date(pickupWindowStart.getTime() + 3_600_000);
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: pickupWindowStart,
        pickupWindowStart,
        pickupWindowEnd,
        supplierNote: 'Bring your student ID.',
      },
    });

    const reservations = await listMyReservations(ctx.learnerId);
    const listed = reservations.find((item) => item.id === reservation.id);

    assert.equal(listed?.status, 'ACCEPTED');
    assert.equal(listed?.pickupWindowStart, pickupWindowStart.toISOString());
    assert.equal(listed?.pickupWindowEnd, pickupWindowEnd.toISOString());
    assert.equal(listed?.supplierNote, 'Bring your student ID.');
  });

  test('concurrent reservation attempts allow only one success', async () => {
    const material = await createMaterial(ctx);

    const results = await Promise.allSettled([
      createReservation(
        ctx.learnerId,
        pickupReservationPayload(material.id, 1),
      ),
      createReservation(
        ctx.learnerId,
        pickupReservationPayload(material.id, 1),
      ),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);

    const reservation = fulfilled[0]!.value;
    ctx.createdReservationIds.push(reservation.id);

    const reservationCount = await prisma.reservation.count({
      where: {
        materialId: material.id,
        status: { in: ['PENDING', 'ACCEPTED', 'COMPLETED'] },
      },
    });
    assert.equal(reservationCount, 1);
  });

  test('learner can create delivery reservation with address and preferred windows', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 2, {
      deliveryAllowed: true,
    });

    const reservation = await createReservation(
      ctx.learnerId,
      deliveryReservationPayload(material.id, 1, {
        deliveryNote: 'Call before arrival',
      }),
    );
    ctx.createdReservationIds.push(reservation.id);

    assert.equal(reservation.status, 'PENDING');
    assert.equal(reservation.fulfillmentMethod, 'DELIVERY');
    assert.equal(reservation.learnerPreferredDeliveryWindows.length, 1);
    assert.equal(reservation.deliveryAddressText, '12 Learner Street, Nablus');
    assert.equal(reservation.safeDropoffAllowed, false);
    assert.equal(reservation.deliveryNote, 'Call before arrival');

    const reservations = await listMyReservations(ctx.learnerId);
    const listed = reservations.find((item) => item.id === reservation.id);

    assert.equal(listed?.fulfillmentMethod, 'DELIVERY');
    assert.equal(listed?.deliveryAddressText, '12 Learner Street, Nablus');
  });

  test('pending reservation holds quantity and blocks over-reservation', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 10);

    const first = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 5),
    );
    ctx.createdReservationIds.push(first.id);

    let detail = await getMaterialById(material.id);
    assert.equal(detail.quantity, 10);
    assert.equal(detail.availableQuantity, 5);

    await assert.rejects(
      () =>
        createReservation(
          ctx.otherLearnerId,
          pickupReservationPayload(material.id, 6),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );

    const second = await createReservation(
      ctx.otherLearnerId,
      pickupReservationPayload(material.id, 5),
    );
    ctx.createdReservationIds.push(second.id);

    detail = await getMaterialById(material.id);
    assert.equal(detail.availableQuantity, 0);
  });

  test('cancelling pending reservation releases held quantity', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 10);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 5),
    );
    ctx.createdReservationIds.push(reservation.id);

    assert.equal((await getMaterialById(material.id)).availableQuantity, 5);

    await cancelReservation(ctx.learnerId, reservation.id);

    assert.equal((await getMaterialById(material.id)).availableQuantity, 10);
  });

  test('supplier accept keeps hold and complete consumes physical quantity once', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 10);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 5),
    );
    ctx.createdReservationIds.push(reservation.id);

    assert.equal((await getMaterialById(material.id)).availableQuantity, 5);

    await acceptWithLearnerPreferredWindow(ctx.supplierId, reservation);

    assert.equal((await getMaterialById(material.id)).availableQuantity, 5);

    await completeSupplierReservation(ctx.supplierId, reservation.id);

    const stored = await prisma.material.findUnique({
      where: { id: material.id },
      select: { quantity: true },
    });
    assert.equal(Number(stored?.quantity), 5);
    assert.equal((await getMaterialById(material.id)).availableQuantity, 5);
  });

  test('supplier decline releases held quantity', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 10);
    const reservation = await createReservation(
      ctx.learnerId,
      pickupReservationPayload(material.id, 5),
    );
    ctx.createdReservationIds.push(reservation.id);

    assert.equal((await getMaterialById(material.id)).availableQuantity, 5);

    await declineSupplierReservation(ctx.supplierId, reservation.id, {
      reason: 'Not available this week',
    });

    assert.equal((await getMaterialById(material.id)).availableQuantity, 10);
  });

  test('learner cannot create delivery reservation when material disallows delivery', async () => {
    const material = await createMaterial(ctx, 'AVAILABLE', 2, {
      deliveryAllowed: false,
    });

    await assert.rejects(
      () =>
        createReservation(
          ctx.learnerId,
          deliveryReservationPayload(material.id, 1),
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  test('learner role guard rejects unauthenticated and non-learner requests', async () => {
    const middleware = requireRoles('LEARNER');

    let unauthenticatedError: unknown;
    middleware({} as Request, {} as Response, ((error?: unknown) => {
      unauthenticatedError = error;
    }) as NextFunction);
    assert.ok(unauthenticatedError instanceof AppError);
    assert.equal(unauthenticatedError.statusCode, 401);

    let forbiddenError: unknown;
    middleware(
      { auth: { sub: ctx.supplierOnlyId, roles: ['SUPPLIER'] } } as Request,
      {} as Response,
      ((error?: unknown) => {
        forbiddenError = error;
      }) as NextFunction,
    );
    assert.ok(forbiddenError instanceof AppError);
    assert.equal(forbiddenError.statusCode, 403);
  });
});
