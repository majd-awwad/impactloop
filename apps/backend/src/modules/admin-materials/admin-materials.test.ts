import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';
import { getMaterials } from '../materials/materials.service.js';

import {
  hideAdminMaterial,
  listAdminMaterials,
  rejectAdminMaterialReport,
  resolveAdminMaterialReport,
  restoreAdminMaterial,
  submitMaterialReport,
  hideMaterialFromAdminReport,
} from './admin-materials.service.js';

const TEST_MARKER = '[test-admin-materials]';

type TestContext = {
  adminId: string;
  supplierId: string;
  learnerId: string;
  categoryId: string;
  locationId: string;
  materialIds: string[];
  reportIds: string[];
  userIds: string[];
};

const ctx: TestContext = {
  adminId: '',
  supplierId: '',
  learnerId: '',
  categoryId: '',
  locationId: '',
  materialIds: [],
  reportIds: [],
  userIds: [],
};

async function createUser(input: {
  suffix: string;
  role: 'ADMIN' | 'SUPPLIER' | 'LEARNER';
  withSupplierProfile?: boolean;
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: input.role, isPrimary: true }] },
      supplierProfile: input.withSupplierProfile
        ? {
            create: {
              supplierType: 'INDIVIDUAL_SUPPLIER',
              publicName: `${TEST_MARKER} Supplier ${input.suffix}`,
              verificationStatus: 'NOT_REQUIRED',
            },
          }
        : undefined,
    },
  });
}

async function createMaterial(status: 'AVAILABLE' | 'UNAVAILABLE' | 'RESERVED' | 'REUSED') {
  const profile = await prisma.supplierProfile.findUnique({
    where: { userId: ctx.supplierId },
    select: { id: true },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      supplierProfileId: profile?.id,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} Material ${status}`,
      description: `${TEST_MARKER} Material description for ${status}`,
      materialType: 'Test material',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status,
      isFree: false,
      price: 10,
      currency: 'NIS',
      pickupAllowed: true,
      deliveryAllowed: false,
      images: {
        create: [{ imageUrl: '/uploads/materials/test-admin-material.jpg', isCover: true }],
      },
    },
  });

  ctx.materialIds.push(material.id);
  return material;
}

describe('admin materials management', () => {
  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${TEST_MARKER}-area`,
        visibility: 'ORDER_ONLY',
        isApproximate: true,
      },
      select: { id: true },
    });

    assert.ok(category);
    ctx.categoryId = category.id;
    ctx.locationId = location.id;

    const admin = await createUser({ suffix: 'admin', role: 'ADMIN' });
    const supplier = await createUser({
      suffix: 'supplier',
      role: 'SUPPLIER',
      withSupplierProfile: true,
    });
    const learner = await createUser({ suffix: 'learner', role: 'LEARNER' });

    ctx.adminId = admin.id;
    ctx.supplierId = supplier.id;
    ctx.learnerId = learner.id;
    ctx.userIds.push(admin.id, supplier.id, learner.id);
  });

  after(async () => {
    await prisma.notification.deleteMany({
      where: {
        relatedEntityId: { in: ctx.materialIds },
      },
    });
    await prisma.materialReport.deleteMany({
      where: { id: { in: ctx.reportIds } },
    });
    await prisma.materialImage.deleteMany({
      where: { materialId: { in: ctx.materialIds } },
    });
    await prisma.material.deleteMany({
      where: { id: { in: ctx.materialIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ctx.userIds } },
    });
    await prisma.location.delete({ where: { id: ctx.locationId } });
  });

  test('admin can list materials', async () => {
    const material = await createMaterial('AVAILABLE');
    const result = await listAdminMaterials({
      page: 1,
      limit: 50,
      search: material.title,
    });

    assert.ok(result.items.some((item) => item.materialId === material.id));
  });

  test('admin can hide material with reason and it disappears from public discovery', async () => {
    const material = await createMaterial('AVAILABLE');

    const hidden = await hideAdminMaterial(ctx.adminId, material.id, {
      reason: 'Misleading listing details',
    });
    assert.equal(hidden.status, 'UNAVAILABLE');

    const publicList = await getMaterials({
      page: 1,
      limit: 50,
      q: material.title,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });
    assert.equal(
      publicList.items.some((item) => item.id === material.id),
      false,
    );
  });

  test('admin can restore unavailable material', async () => {
    const material = await createMaterial('UNAVAILABLE');

    const restored = await restoreAdminMaterial(ctx.adminId, material.id);
    assert.equal(restored.status, 'AVAILABLE');
  });

  test('restore blocked for reused material', async () => {
    const material = await createMaterial('REUSED');

    await assert.rejects(
      () => restoreAdminMaterial(ctx.adminId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /Reused materials cannot be restored/i);
        return true;
      },
    );
  });

  test('restore blocked for reserved material', async () => {
    const material = await createMaterial('RESERVED');

    await assert.rejects(
      () => restoreAdminMaterial(ctx.adminId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /Reserved materials cannot be restored/i);
        return true;
      },
    );
  });

  test('authenticated learner can report material', async () => {
    const material = await createMaterial('AVAILABLE');

    const report = await submitMaterialReport(ctx.learnerId, material.id, {
      reason: 'WRONG_PRICE',
      note: 'Price seems incorrect',
    });

    assert.equal(report.status, 'PENDING');
    ctx.reportIds.push(report.id);
  });

  test('duplicate pending report is blocked', async () => {
    const material = await createMaterial('AVAILABLE');

    const first = await submitMaterialReport(ctx.learnerId, material.id, {
      reason: 'WRONG_CATEGORY',
    });
    ctx.reportIds.push(first.id);

    await assert.rejects(
      () =>
        submitMaterialReport(ctx.learnerId, material.id, {
          reason: 'WRONG_CATEGORY',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /already reported this material/i);
        return true;
      },
    );
  });

  test('supplier cannot report own material', async () => {
    const material = await createMaterial('AVAILABLE');

    await assert.rejects(
      () =>
        submitMaterialReport(ctx.supplierId, material.id, {
          reason: 'OTHER',
          note: 'Testing self report block',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /cannot report your own material/i);
        return true;
      },
    );
  });

  test('admin can resolve report without hiding material', async () => {
    const material = await createMaterial('AVAILABLE');
    const report = await submitMaterialReport(ctx.learnerId, material.id, {
      reason: 'MISLEADING_INFORMATION',
    });
    ctx.reportIds.push(report.id);

    const resolved = await resolveAdminMaterialReport(ctx.adminId, report.id, {
      adminNote: 'Reviewed and kept visible',
    });
    assert.equal(resolved.status, 'RESOLVED');

    const persisted = await prisma.material.findUnique({
      where: { id: material.id },
      select: { status: true },
    });
    assert.equal(persisted?.status, 'AVAILABLE');
  });

  test('admin can reject report with note', async () => {
    const material = await createMaterial('AVAILABLE');
    const report = await submitMaterialReport(ctx.learnerId, material.id, {
      reason: 'SUSPICIOUS_SUPPLIER',
    });
    ctx.reportIds.push(report.id);

    const rejected = await rejectAdminMaterialReport(ctx.adminId, report.id, {
      adminNote: 'No issue found',
    });
    assert.equal(rejected.status, 'REJECTED');
  });

  test('admin can hide material from report in one transaction', async () => {
    const material = await createMaterial('AVAILABLE');
    const report = await submitMaterialReport(ctx.learnerId, material.id, {
      reason: 'INAPPROPRIATE',
      note: 'Inappropriate content',
    });
    ctx.reportIds.push(report.id);

    const result = await hideMaterialFromAdminReport(ctx.adminId, report.id, {
      adminNote: 'Hidden after inappropriate report',
    });
    assert.equal(result.materialStatus, 'UNAVAILABLE');

    const persistedReport = await prisma.materialReport.findUnique({
      where: { id: report.id },
      select: { status: true },
    });
    assert.equal(persistedReport?.status, 'RESOLVED');
  });
});
