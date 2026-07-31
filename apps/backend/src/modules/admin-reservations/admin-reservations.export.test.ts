import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import {
  exportAdminReservationsCsv,
  exportAdminReservationsPdf,
  exportAdminReservationsXlsx,
  preflightAdminReservationsExport,
} from './admin-reservations.export.js';
import { listAdminReservations } from './admin-reservations.service.js';

const TEST_MARKER = '[test-admin-reservations-export]';

type TestContext = {
  learnerId: string;
  supplierId: string;
  categoryId: string;
  locationId: string;
  reservationIds: string[];
  userIds: string[];
  materialIds: string[];
};

const ctx: TestContext = {
  learnerId: '',
  supplierId: '',
  categoryId: '',
  locationId: '',
  reservationIds: [],
  userIds: [],
  materialIds: [],
};

async function createUser(input: {
  suffix: string;
  role: 'LEARNER' | 'SUPPLIER';
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: input.role, isPrimary: true }] },
      learnerProfile:
        input.role === 'LEARNER'
          ? {
              create: {
                learnerType: 'STUDENT',
                skillLevel: 'BEGINNER',
              },
            }
          : undefined,
      supplierProfile:
        input.role === 'SUPPLIER'
          ? {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} Supplier ${input.suffix}`,
                verificationStatus: 'VERIFIED',
              },
            }
          : undefined,
    },
  });
  ctx.userIds.push(user.id);
  return user;
}

async function createMaterial(ownerId: string, title: string) {
  const material = await prisma.material.create({
    data: {
      ownerId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title,
      description: `${TEST_MARKER} material`,
      materialType: 'Test',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      deliveryAllowed: true,
    },
  });
  ctx.materialIds.push(material.id);
  return material;
}

before(async () => {
  const category = await prisma.category.findFirst({ select: { id: true } });
  const location = await prisma.location.findFirst({ select: { id: true } });
  assert.ok(category && location, 'seed category and location required');

  ctx.categoryId = category.id;
  ctx.locationId = location.id;

  const learner = await createUser({ suffix: 'learner', role: 'LEARNER' });
  const supplier = await createUser({ suffix: 'supplier', role: 'SUPPLIER' });
  ctx.learnerId = learner.id;
  ctx.supplierId = supplier.id;

  const material = await createMaterial(
    ctx.supplierId,
    `${TEST_MARKER} Export Material خشب`,
  );

  const tiedStamp = new Date('2026-07-15T12:00:00.000Z');
  for (let index = 0; index < 5; index += 1) {
    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: learner.id,
        ownerId: supplier.id,
        quantityRequested: 1,
        status: 'ACCEPTED',
        acceptedAt: tiedStamp,
        createdAt: tiedStamp,
        updatedAt: tiedStamp,
      },
    });
    ctx.reservationIds.push(reservation.id);
  }

  const unique = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: learner.id,
      ownerId: supplier.id,
      quantityRequested: 2,
      status: 'PENDING',
      createdAt: new Date('2026-07-16T12:00:00.000Z'),
    },
  });
  ctx.reservationIds.push(unique.id);
});

after(async () => {
  if (ctx.reservationIds.length) {
    await prisma.reservation.deleteMany({ where: { id: { in: ctx.reservationIds } } });
  }
  if (ctx.materialIds.length) {
    await prisma.material.deleteMany({ where: { id: { in: ctx.materialIds } } });
  }
  if (ctx.userIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
  }
});

describe('admin reservations export', () => {
  test('preflight count matches list total and exposes per-format eligibility', async () => {
    const search = TEST_MARKER;
    const [preflight, list] = await Promise.all([
      preflightAdminReservationsExport({ search }),
      listAdminReservations({ page: 1, limit: 20, search }),
    ]);

    assert.equal(preflight.count, list.pagination.total);
    assert.equal(preflight.formats.xlsx.allowed, true);
    assert.equal(preflight.formats.csv.allowed, true);
    assert.ok(preflight.formats.pdf);
  });

  test('keyset export returns every tied createdAt row exactly once across chunks', async () => {
    const search = TEST_MARKER;
    const buffer = await exportAdminReservationsCsv({ search });
    const text = buffer.toString('utf8');
    for (const id of ctx.reservationIds) {
      const matches = text.split(id).length - 1;
      assert.equal(matches, 1, `expected id ${id} exactly once`);
    }
    assert.equal(text.includes('passwordHash'), false);
    assert.equal(text.includes('selfPickupCodeHash'), false);
  });

  test('xlsx and pdf exports succeed', async () => {
    const xlsx = await exportAdminReservationsXlsx({ search: TEST_MARKER });
    assert.equal(xlsx.subarray(0, 2).toString('utf8'), 'PK');

    const pdf = await exportAdminReservationsPdf({ search: TEST_MARKER });
    assert.equal(pdf.subarray(0, 5).toString('utf8'), '%PDF-');
  });

  test('pdf preflight is allowed under the configured PDF limit', async () => {
    const preflight = await preflightAdminReservationsExport({
      search: TEST_MARKER,
    });
    assert.equal(preflight.formats.pdf.exceedsLimit, false);
    assert.equal(preflight.formats.pdf.allowed, true);
  });
});
