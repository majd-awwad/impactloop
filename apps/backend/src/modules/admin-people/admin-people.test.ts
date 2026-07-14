import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  getAdminPersonById,
  listAdminPeople,
  reactivateAdminPerson,
  suspendAdminPerson,
} from './admin-people.service.js';

const TEST_MARKER = '[test-admin-people]';

type TestContext = {
  actorAdminId: string;
  otherAdminId: string;
  supplierId: string;
  learnerId: string;
  driverId: string;
  userIds: string[];
  categoryId?: string;
  locationId?: string;
  driverLocationId?: string;
  materialIds: string[];
  reservationIds: string[];
  savedLocationIds: string[];
};

const ctx: TestContext = {
  actorAdminId: '',
  otherAdminId: '',
  supplierId: '',
  learnerId: '',
  driverId: '',
  userIds: [],
  materialIds: [],
  reservationIds: [],
  savedLocationIds: [],
};

async function createBaseCategoryAndLocation() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Electronics`,
      nameAr: `${TEST_MARKER} إلكترونيات`,
      categoryType: 'MATERIAL',
      isActive: true,
    },
  });
  ctx.categoryId = category.id;

  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Nablus',
      area: 'Rafidia',
      addressLine: 'Test street',
      isApproximate: true,
      visibility: 'PRIVATE',
    },
  });
  ctx.locationId = location.id;
}

async function createMaterial(ownerId: string, titleSuffix: string) {
  const material = await prisma.material.create({
    data: {
      ownerId,
      categoryId: ctx.categoryId!,
      locationId: ctx.locationId!,
      title: `${TEST_MARKER} material ${titleSuffix}`,
      description: 'test',
      materialType: 'Resistor',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'STUDENT_LEFTOVER',
      status: 'AVAILABLE',
      isFree: true,
    },
  });
  ctx.materialIds.push(material.id);
  return material;
}

async function createReservation(input: {
  materialId: string;
  requesterId: string;
  ownerId: string;
}) {
  const reservation = await prisma.reservation.create({
    data: {
      materialId: input.materialId,
      requesterId: input.requesterId,
      ownerId: input.ownerId,
      quantityRequested: 1,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
  ctx.reservationIds.push(reservation.id);
  return reservation;
}

async function createUser(input: {
  suffix: string;
  role: 'ADMIN' | 'SUPPLIER' | 'LEARNER' | 'DRIVER' | 'MODERATOR';
  accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: input.accountStatus ?? 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: input.role, isPrimary: true }] },
      supplierProfile:
        input.role === 'SUPPLIER'
          ? {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} Supplier ${input.suffix}`,
                verificationStatus: 'NOT_REQUIRED',
              },
            }
          : undefined,
      driverProfile:
        input.role === 'DRIVER'
          ? {
              create: {
                displayName: `${TEST_MARKER} Driver ${input.suffix}`,
                phone: '+970599000001',
                city: 'Ramallah',
                area: 'Al-Bireh',
                transportationType: 'CAR',
                vehicleType: 'UNSPECIFIED',
              },
            }
          : undefined,
    },
  });
  ctx.userIds.push(user.id);
  return user;
}

describe('admin people management', () => {
  before(async () => {
    await createBaseCategoryAndLocation();

    const actorAdmin = await createUser({ suffix: 'actor-admin', role: 'ADMIN' });
    const otherAdmin = await createUser({ suffix: 'other-admin', role: 'ADMIN' });
    const supplier = await createUser({ suffix: 'supplier', role: 'SUPPLIER' });
    const learner = await createUser({ suffix: 'learner', role: 'LEARNER' });
    const driver = await createUser({ suffix: 'driver', role: 'DRIVER' });

    ctx.actorAdminId = actorAdmin.id;
    ctx.otherAdminId = otherAdmin.id;
    ctx.supplierId = supplier.id;
    ctx.learnerId = learner.id;
    ctx.driverId = driver.id;

    await prisma.supplierProfile.update({
      where: { userId: ctx.supplierId },
      data: { defaultPickupLocationId: ctx.locationId },
    });

    const learnerSavedLocation = await prisma.userSavedLocation.create({
      data: {
        userId: ctx.learnerId,
        locationId: ctx.locationId!,
        label: 'Home',
        isDefault: true,
      },
    });
    ctx.savedLocationIds.push(learnerSavedLocation.id);

    const firstMaterial = await createMaterial(ctx.supplierId, 'a');
    await createMaterial(ctx.supplierId, 'b');
    await createReservation({
      materialId: firstMaterial.id,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
    });
  });

  after(async () => {
    if (ctx.reservationIds.length > 0) {
      await prisma.reservation.deleteMany({
        where: { id: { in: ctx.reservationIds } },
      });
    }
    if (ctx.materialIds.length > 0) {
      await prisma.material.deleteMany({ where: { id: { in: ctx.materialIds } } });
    }
    if (ctx.savedLocationIds.length > 0) {
      await prisma.userSavedLocation.deleteMany({
        where: { id: { in: ctx.savedLocationIds } },
      });
    }
    if (ctx.userIds.length > 0) {
      await prisma.adminActivityLog.deleteMany({
        where: {
          OR: [
            { actorUserId: { in: ctx.userIds } },
            { targetId: { in: ctx.userIds } },
          ],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
    }
    if (ctx.categoryId) {
      await prisma.category.delete({ where: { id: ctx.categoryId } });
    }
    if (ctx.locationId) {
      await prisma.location.delete({ where: { id: ctx.locationId } });
    }
  });

  test('admin can list people with action flags', async () => {
    const result = await listAdminPeople(ctx.actorAdminId, {
      tab: 'ALL',
      page: 1,
      limit: 50,
    });

    assert.ok(result.items.length > 0);
    const supplier = result.items.find((item) => item.userId === ctx.supplierId);
    const admin = result.items.find((item) => item.userId === ctx.otherAdminId);
    const actor = result.items.find((item) => item.userId === ctx.actorAdminId);

    assert.ok(supplier);
    assert.equal(supplier!.canSuspend, true);
    assert.equal(supplier!.isProtectedAdmin, false);

    assert.ok(admin);
    assert.equal(admin!.canSuspend, false);
    assert.equal(admin!.isProtectedAdmin, true);

    assert.ok(actor);
    assert.equal(actor!.canSuspend, false);
  });

  test('suspend user requires reason', async () => {
    await assert.rejects(
      () =>
        suspendAdminPerson(ctx.actorAdminId, ctx.learnerId, {
          reason: '',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });

  test('admin cannot suspend themselves', async () => {
    await assert.rejects(
      () =>
        suspendAdminPerson(ctx.actorAdminId, ctx.actorAdminId, {
          reason: 'Attempted self suspension.',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        assert.match(error.message, /your own account/i);
        return true;
      },
    );
  });

  test('admin cannot suspend another admin account', async () => {
    await assert.rejects(
      () =>
        suspendAdminPerson(ctx.actorAdminId, ctx.otherAdminId, {
          reason: 'Attempted admin suspension.',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        assert.match(error.message, /Admin accounts cannot be suspended/i);
        return true;
      },
    );
  });

  test('admin can suspend and reactivate a supplier with audit context', async () => {
    const reason = 'Policy violation during test.';
    const suspended = await suspendAdminPerson(ctx.actorAdminId, ctx.supplierId, {
      reason,
    });
    assert.equal(suspended.accountStatus, 'SUSPENDED');
    assert.equal(suspended.suspensionReason, reason);
    assert.ok(suspended.suspendedAt);
    assert.ok(suspended.suspendedBy);
    assert.equal(suspended.suspendedBy!.id, ctx.actorAdminId);
    assert.equal(suspended.canReactivate, true);

    const stored = await prisma.user.findUnique({
      where: { id: ctx.supplierId },
      select: { suspendedById: true, suspensionReason: true },
    });
    assert.equal(stored?.suspendedById, ctx.actorAdminId);
    assert.equal(stored?.suspensionReason, reason);

    const detail = await getAdminPersonById(ctx.actorAdminId, ctx.supplierId);
    assert.equal(detail.suspensionReason, reason);
    assert.equal(detail.suspendedBy?.id, ctx.actorAdminId);

    const reactivated = await reactivateAdminPerson(ctx.actorAdminId, ctx.supplierId);
    assert.equal(reactivated.accountStatus, 'ACTIVE');
    assert.equal(reactivated.canSuspend, true);
    assert.ok(reactivated.reactivatedAt);
    assert.equal(reactivated.reactivatedBy?.id, ctx.actorAdminId);
    assert.equal(reactivated.suspensionReason, reason);
  });

  test('admin targets are flagged as protected in list responses', async () => {
    const result = await listAdminPeople(ctx.actorAdminId, {
      tab: 'ADMINS',
      page: 1,
      limit: 20,
    });

    assert.ok(result.items.length >= 1);
    for (const item of result.items) {
      assert.equal(item.isProtectedAdmin, true);
      assert.equal(item.canSuspend, false);
      assert.equal(item.canReactivate, false);
    }
  });

  test('learners tab excludes supplier driver moderator admin accounts', async () => {
    const result = await listAdminPeople(ctx.actorAdminId, {
      tab: 'LEARNERS',
      page: 1,
      limit: 50,
    });

    for (const item of result.items) {
      assert.equal(item.isProtectedAdmin, false);
      assert.equal(item.roles.includes('SUPPLIER'), false);
      assert.equal(item.roles.includes('DRIVER'), false);
      assert.equal(item.roles.includes('MODERATOR'), false);
      assert.equal(item.roles.includes('ADMIN'), false);
      assert.equal(item.isLearnerOnly, true);
    }
  });

  test('list items include bounded activity metrics with zero defaults', async () => {
    const result = await listAdminPeople(ctx.actorAdminId, {
      tab: 'ALL',
      page: 1,
      limit: 50,
    });

    const supplier = result.items.find((item) => item.userId === ctx.supplierId);
    const learner = result.items.find((item) => item.userId === ctx.learnerId);
    const admin = result.items.find((item) => item.userId === ctx.otherAdminId);

    assert.ok(supplier);
    assert.equal(supplier!.materialsCount, 2);
    assert.equal(supplier!.reservationsAsOwnerCount, 1);
    assert.equal(supplier!.reservationsAsRequesterCount, 0);

    assert.ok(learner);
    assert.equal(learner!.materialsCount, 0);
    assert.equal(learner!.reservationsAsRequesterCount, 1);
    assert.equal(learner!.reservationsAsOwnerCount, 0);

    assert.ok(admin);
    assert.equal(admin!.materialsCount, 0);
    assert.equal(admin!.reservationsAsRequesterCount, 0);
    assert.equal(admin!.reservationsAsOwnerCount, 0);
  });

  test('list items include safe location labels by role', async () => {
    const result = await listAdminPeople(ctx.actorAdminId, {
      tab: 'ALL',
      page: 1,
      limit: 50,
    });

    const supplier = result.items.find((item) => item.userId === ctx.supplierId);
    const learner = result.items.find((item) => item.userId === ctx.learnerId);
    const driver = result.items.find((item) => item.userId === ctx.driverId);
    const admin = result.items.find((item) => item.userId === ctx.otherAdminId);

    assert.ok(supplier);
    assert.equal(supplier!.locationCity, 'Nablus');
    assert.equal(supplier!.locationArea, 'Rafidia');
    assert.equal(supplier!.locationLabel, 'Nablus · Rafidia');

    assert.ok(learner);
    assert.equal(learner!.locationCity, 'Nablus');
    assert.equal(learner!.locationArea, 'Rafidia');
    assert.equal(learner!.locationLabel, 'Nablus · Rafidia');

    assert.ok(driver);
    assert.equal(driver!.locationCity, 'Ramallah');
    assert.equal(driver!.locationArea, 'Al-Bireh');
    assert.equal(driver!.locationLabel, 'Ramallah · Al-Bireh');

    assert.ok(admin);
    assert.equal(admin!.locationCity, null);
    assert.equal(admin!.locationArea, null);
    assert.equal(admin!.locationLabel, null);

    const ambiguousLearner = await createUser({
      suffix: 'ambiguous-learner',
      role: 'LEARNER',
    });
    const secondLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Jenin',
        area: 'Downtown',
        visibility: 'PRIVATE',
        isApproximate: true,
      },
    });
    const firstSaved = await prisma.userSavedLocation.create({
      data: {
        userId: ambiguousLearner.id,
        locationId: ctx.locationId!,
        label: 'Home',
      },
    });
    const secondSaved = await prisma.userSavedLocation.create({
      data: {
        userId: ambiguousLearner.id,
        locationId: secondLocation.id,
        label: 'Work',
      },
    });
    ctx.savedLocationIds.push(firstSaved.id, secondSaved.id);

    const ambiguousResult = await listAdminPeople(ctx.actorAdminId, {
      tab: 'ALL',
      search: ambiguousLearner.email,
      page: 1,
      limit: 10,
    });
    const ambiguousItem = ambiguousResult.items.find(
      (item) => item.userId === ambiguousLearner.id,
    );
    assert.ok(ambiguousItem);
    assert.equal(ambiguousItem!.locationCity, null);
    assert.equal(ambiguousItem!.locationArea, null);
    assert.equal(ambiguousItem!.locationLabel, null);

    await prisma.location.delete({ where: { id: secondLocation.id } });
  });
});
