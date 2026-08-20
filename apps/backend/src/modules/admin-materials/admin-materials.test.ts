import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';
import { getMaterials } from '../materials/materials.service.js';

import {
  hideAdminMaterial,
  listAdminMaterialReports,
  listAdminMaterials,
  markAdminMaterialUnavailable,
  markUnavailableFromAdminReport,
  rejectAdminMaterialReport,
  resolveAdminMaterialReport,
  restoreAdminMaterial,
  submitMaterialReport,
  hideMaterialFromAdminReport,
} from './admin-materials.service.js';
import { ADMIN_ACTIVITY_ACTIONS } from '../admin/admin-activity-log.js';

const TEST_MARKER = '[test-admin-materials]';

type TestContext = {
  adminId: string;
  supplierId: string;
  learnerId: string;
  categoryId: string;
  locationId: string;
  materialIds: string[];
  reservationIds: string[];
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
  reservationIds: [],
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

async function createMaterial(
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'PENDING_RESERVATION' | 'RESERVED' | 'REUSED',
) {
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
    await prisma.reservation.deleteMany({
      where: { id: { in: ctx.reservationIds } },
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

  test('admin can mark available material unavailable', async () => {
    const material = await createMaterial('AVAILABLE');

    const updated = await markAdminMaterialUnavailable(ctx.adminId, material.id, {
      reason: 'Temporarily out of stock',
    });
    assert.equal(updated.status, 'UNAVAILABLE');
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
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be restored because its lifecycle is reserved or completed/i,
        );
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
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be restored because its lifecycle is reserved or completed/i,
        );
        return true;
      },
    );
  });

  test('pending reservation material cannot be hidden', async () => {
    const material = await createMaterial('PENDING_RESERVATION');

    await assert.rejects(
      () =>
        hideAdminMaterial(ctx.adminId, material.id, {
          reason: 'Should not hide pending reservation material',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be hidden because it is reserved or already reused/i,
        );
        return true;
      },
    );
  });

  test('pending reservation material cannot be marked unavailable', async () => {
    const material = await createMaterial('PENDING_RESERVATION');

    await assert.rejects(
      () =>
        markAdminMaterialUnavailable(ctx.adminId, material.id, {
          reason: 'Should not mark pending reservation unavailable',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be marked unavailable because it is reserved or already reused/i,
        );
        return true;
      },
    );
  });

  test('confirmation and resolution reservations block material moderation', async () => {
    const statuses = [
      'AWAITING_LEARNER_CONFIRMATION',
      'AWAITING_SUPPLIER_CONFIRMATION',
      'AWAITING_RESOLUTION',
    ] as const;

    for (const status of statuses) {
      const material = await createMaterial('AVAILABLE');
      const reservation = await prisma.reservation.create({
        data: {
          materialId: material.id,
          requesterId: ctx.learnerId,
          ownerId: ctx.supplierId,
          quantityRequested: 1,
          status,
        },
      });
      ctx.reservationIds.push(reservation.id);

      await assert.rejects(
        () =>
          markAdminMaterialUnavailable(ctx.adminId, material.id, {
            reason: `Should not moderate material with ${status}`,
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 409);
          assert.equal(
            (error.details as { reason?: string } | undefined)?.reason,
            'ACTIVE_RESERVATION',
          );
          return true;
        },
      );
    }
  });

  test('reserved material cannot be hidden', async () => {
    const material = await createMaterial('RESERVED');

    await assert.rejects(
      () =>
        hideAdminMaterial(ctx.adminId, material.id, {
          reason: 'Should not hide reserved material',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be hidden because it is reserved or already reused/i,
        );
        return true;
      },
    );
  });

  test('reserved material cannot be marked unavailable', async () => {
    const material = await createMaterial('RESERVED');

    await assert.rejects(
      () =>
        markAdminMaterialUnavailable(ctx.adminId, material.id, {
          reason: 'Should not mark reserved material unavailable',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be marked unavailable because it is reserved or already reused/i,
        );
        return true;
      },
    );
  });

  test('reused material cannot be hidden', async () => {
    const material = await createMaterial('REUSED');

    await assert.rejects(
      () =>
        hideAdminMaterial(ctx.adminId, material.id, {
          reason: 'Should not hide reused material',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be hidden because it is reserved or already reused/i,
        );
        return true;
      },
    );
  });

  test('reused material cannot be marked unavailable', async () => {
    const material = await createMaterial('REUSED');

    await assert.rejects(
      () =>
        markAdminMaterialUnavailable(ctx.adminId, material.id, {
          reason: 'Should not mark reused material unavailable',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be marked unavailable because it is reserved or already reused/i,
        );
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
    assert.equal(resolved.resolutionAction, 'NO_MATERIAL_ACTION');
    assert.equal(resolved.adminNote, 'Reviewed and kept visible');

    const persisted = await prisma.material.findUnique({
      where: { id: material.id },
      select: { status: true },
    });
    assert.equal(persisted?.status, 'AVAILABLE');

    const listedResolved = await listAdminMaterialReports({
      page: 1,
      limit: 50,
      status: 'RESOLVED',
    });
    const listedItem = listedResolved.items.find(
      (item) => item.reportId === report.id,
    );
    assert.ok(listedItem);
    assert.equal(listedItem?.resolutionAction, 'NO_MATERIAL_ACTION');
    assert.equal(listedItem?.adminNote, 'Reviewed and kept visible');
    assert.ok(listedItem?.reviewedByName);

    const listedPending = await listAdminMaterialReports({
      page: 1,
      limit: 50,
      status: 'PENDING',
    });
    assert.equal(
      listedPending.items.some((item) => item.reportId === report.id),
      false,
    );

    const audit = await prisma.adminActivityLog.findFirst({
      where: {
        action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_RESOLVED,
        targetId: report.id,
      },
    });
    assert.ok(audit);
  });

  test('resolve without a usable admin note is rejected', async () => {
    const material = await createMaterial('AVAILABLE');
    const report = await submitMaterialReport(ctx.learnerId, material.id, {
      reason: 'WRONG_PRICE',
    });
    ctx.reportIds.push(report.id);

    await assert.rejects(
      () =>
        resolveAdminMaterialReport(ctx.adminId, report.id, {
          adminNote: 'ab',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        return true;
      },
    );

    const persistedReport = await prisma.materialReport.findUnique({
      where: { id: report.id },
      select: { status: true },
    });
    assert.equal(persistedReport?.status, 'PENDING');
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

    const listedRejected = await listAdminMaterialReports({
      page: 1,
      limit: 50,
      status: 'REJECTED',
    });
    assert.ok(listedRejected.items.some((item) => item.reportId === report.id));

    const audit = await prisma.adminActivityLog.findFirst({
      where: {
        action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_REJECTED,
        targetId: report.id,
      },
    });
    assert.ok(audit);
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
    assert.equal(result.reportStatus, 'RESOLVED');
    assert.equal(result.resolutionAction, 'HIDDEN');

    const persistedReport = await prisma.materialReport.findUnique({
      where: { id: report.id },
      select: { status: true, resolutionAction: true },
    });
    assert.equal(persistedReport?.status, 'RESOLVED');
    assert.equal(persistedReport?.resolutionAction, 'HIDDEN');

    const audit = await prisma.adminActivityLog.findFirst({
      where: {
        action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_HIDE_MATERIAL,
        targetId: material.id,
      },
    });
    assert.ok(audit);
  });

  test('admin can mark material unavailable from report in one transaction', async () => {
    const material = await createMaterial('AVAILABLE');
    const report = await submitMaterialReport(ctx.learnerId, material.id, {
      reason: 'ITEM_NOT_AVAILABLE',
      note: 'Supplier confirmed it is gone',
    });
    ctx.reportIds.push(report.id);

    const result = await markUnavailableFromAdminReport(ctx.adminId, report.id, {
      adminNote: 'Marked unavailable after report review',
    });
    assert.equal(result.materialStatus, 'UNAVAILABLE');
    assert.equal(result.reportStatus, 'RESOLVED');
    assert.equal(result.resolutionAction, 'MARKED_UNAVAILABLE');

    const persistedReport = await prisma.materialReport.findUnique({
      where: { id: report.id },
      select: { status: true, resolutionAction: true },
    });
    assert.equal(persistedReport?.status, 'RESOLVED');
    assert.equal(persistedReport?.resolutionAction, 'MARKED_UNAVAILABLE');

    const listed = await listAdminMaterialReports({
      page: 1,
      limit: 50,
      status: 'RESOLVED',
    });
    const listedItem = listed.items.find((item) => item.reportId === report.id);
    assert.equal(listedItem?.resolutionAction, 'MARKED_UNAVAILABLE');

    const audit = await prisma.adminActivityLog.findFirst({
      where: {
        action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_MARK_UNAVAILABLE,
        targetId: material.id,
      },
    });
    assert.ok(audit);
  });

  test('report hide-material action is blocked for reserved materials', async () => {
    const material = await createMaterial('RESERVED');
    const report = await submitMaterialReport(ctx.learnerId, material.id, {
      reason: 'INAPPROPRIATE',
      note: 'Should not hide reserved material from report',
    });
    ctx.reportIds.push(report.id);

    await assert.rejects(
      () =>
        hideMaterialFromAdminReport(ctx.adminId, report.id, {
          adminNote: 'Attempted hide on reserved material',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be hidden because it is reserved or already reused/i,
        );
        return true;
      },
    );

    const persistedReport = await prisma.materialReport.findUnique({
      where: { id: report.id },
      select: { status: true },
    });
    assert.equal(persistedReport?.status, 'PENDING');
  });

  test('report mark-unavailable action is blocked for reserved materials', async () => {
    const material = await createMaterial('RESERVED');
    const report = await submitMaterialReport(ctx.learnerId, material.id, {
      reason: 'ITEM_NOT_AVAILABLE',
      note: 'Should not mark reserved material unavailable from report',
    });
    ctx.reportIds.push(report.id);

    await assert.rejects(
      () =>
        markUnavailableFromAdminReport(ctx.adminId, report.id, {
          adminNote: 'Attempted unavailable on reserved material',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(
          error.message,
          /cannot be marked unavailable because it is reserved or already reused/i,
        );
        return true;
      },
    );

    const persistedReport = await prisma.materialReport.findUnique({
      where: { id: report.id },
      select: { status: true },
    });
    assert.equal(persistedReport?.status, 'PENDING');
  });
});
