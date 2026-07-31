import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { requiresPickupRecoveryOperationalAction } from '../admin-no-show-reports/admin-delivery-pickup-recovery.repository.js';
import {
  listAdminNoShowReports,
  resolveAdminNoShowReport,
} from '../admin-no-show-reports/admin-no-show-reports.service.js';
import { getMaterialQuantityState } from '../reservations/reservations.quantity.js';
import { submitSupplierNoShowReport } from './supplier-reservations.service.js';
import {
  SUPPLIER_NO_SHOW_REPORT_REASON_CODES,
  submitNoShowReportSchema,
} from './supplier-reservations.validation.js';

const TEST_MARKER = '[test-supplier-no-show-reasons]';

const pickupWindowEndAfterGrace = () =>
  new Date(Date.now() - (31 * 60 + 5) * 1000);

type TestContext = {
  supplierId: string;
  learnerId: string;
  adminId: string;
  categoryId: string;
  locationId: string;
  createdReservationIds: string[];
  createdMaterialIds: string[];
  createdReportIds: string[];
  createdUserIds: string[];
};

async function createAcceptedPickupReservation(
  ctx: TestContext,
  input: { pickupWindowEnd: Date; quantity?: number },
) {
  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: 'No-show reason test material',
      materialType: 'Test',
      quantity: input.quantity ?? 3,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'RESERVED',
    },
  });
  ctx.createdMaterialIds.push(material.id);

  const start = new Date(input.pickupWindowEnd.getTime() - 3_600_000);
  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId: ctx.learnerId,
      ownerId: ctx.supplierId,
      quantityRequested: 1,
      status: 'ACCEPTED',
      fulfillmentMethod: 'PICKUP',
      pickupWindowStart: start,
      pickupWindowEnd: input.pickupWindowEnd,
      acceptedAt: start,
    },
  });
  ctx.createdReservationIds.push(reservation.id);

  return { reservation, material };
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReportIds.length) {
    await prisma.noShowReport.deleteMany({
      where: { id: { in: ctx.createdReportIds } },
    });
  }

  if (ctx.createdReservationIds.length) {
    await prisma.noShowReport.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
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

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('supplier no-show reason codes', () => {
  let ctx: TestContext;

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    assert.ok(category);

    const location = await prisma.location.create({
      data: {
        country: 'PS',
        city: 'Ramallah',
        area: 'Test',
        addressLine: 'Test',
        latitude: 31.9,
        longitude: 35.2,
      },
    });

    const passwordHash = await hashPassword('Password123!');
    const supplier = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} Supplier`,
        email: `${Date.now()}-no-show-supplier@test.local`,
        passwordHash,
        accountStatus: 'ACTIVE',
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: 'No-show Supplier',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    const learner = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} Learner`,
        email: `${Date.now()}-no-show-learner@test.local`,
        passwordHash,
        accountStatus: 'ACTIVE',
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      },
    });
    const admin = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} Admin`,
        email: `${Date.now()}-no-show-admin@test.local`,
        passwordHash,
        accountStatus: 'ACTIVE',
        roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
      },
    });

    ctx = {
      supplierId: supplier.id,
      learnerId: learner.id,
      adminId: admin.id,
      categoryId: category.id,
      locationId: location.id,
      createdReservationIds: [],
      createdMaterialIds: [],
      createdReportIds: [],
      createdUserIds: [supplier.id, learner.id, admin.id],
    };
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('validation accepts all seven supplier reason codes', () => {
    for (const reasonCode of SUPPLIER_NO_SHOW_REPORT_REASON_CODES) {
      const parsed = submitNoShowReportSchema.parse({
        reasonCode,
        note: `Supplier report for ${reasonCode}`,
      });
      assert.equal(parsed.reasonCode, reasonCode);
    }
  });

  test('validation rejects unsupported reason codes', () => {
    assert.throws(() =>
      submitNoShowReportSchema.parse({
        reasonCode: 'PICKUP_FAILED',
        note: 'Invalid supplier reason',
      }),
    );
  });

  for (const reasonCode of [
    'LEARNER_DID_NOT_ARRIVE',
    'DRIVER_DID_NOT_ARRIVE',
    'NO_RESPONSE_AFTER_PICKUP_WINDOW',
    'OTHER',
  ] as const) {
    test(`pickup-oriented reason ${reasonCode} still submits on overdue self pickup`, async () => {
      const { reservation } = await createAcceptedPickupReservation(ctx, {
        pickupWindowEnd: pickupWindowEndAfterGrace(),
      });

      if (reasonCode === 'DRIVER_DID_NOT_ARRIVE') {
        await assert.rejects(
          () =>
            submitSupplierNoShowReport(ctx.supplierId, reservation.id, {
              reasonCode,
              note: 'Driver did not arrive',
            }),
          /assigned driver/i,
        );
        return;
      }

      const reported = await submitSupplierNoShowReport(
        ctx.supplierId,
        reservation.id,
        {
          reasonCode,
          note: `Supplier report for ${reasonCode}`,
        },
      );
      ctx.createdReportIds.push(reported.noShowReport!.id);

      const stored = await prisma.noShowReport.findUniqueOrThrow({
        where: { id: reported.noShowReport!.id },
      });
      assert.equal(stored.reasonCode, reasonCode);
      assert.equal(reported.status, 'AWAITING_RESOLUTION');
    });
  }

  for (const reasonCode of [
    'REPEATED_DELAY',
    'WRONG_INFORMATION',
    'SAFETY_OR_TRUST_CONCERN',
  ] as const) {
    test(`general incident reason ${reasonCode} is accepted and persisted unchanged`, async () => {
      const { reservation, material } = await createAcceptedPickupReservation(ctx, {
        pickupWindowEnd: pickupWindowEndAfterGrace(),
        quantity: 4,
      });

      const before = await getMaterialQuantityState(prisma, material.id);
      assert.ok(before);
      assert.equal(Number(before.heldQuantity), 1);

      const reported = await submitSupplierNoShowReport(
        ctx.supplierId,
        reservation.id,
        {
          reasonCode,
          note: `General incident report for ${reasonCode}`,
        },
      );
      ctx.createdReportIds.push(reported.noShowReport!.id);

      const stored = await prisma.noShowReport.findUniqueOrThrow({
        where: { id: reported.noShowReport!.id },
      });
      assert.equal(stored.reasonCode, reasonCode);
      assert.equal(stored.targetRole, 'LEARNER');
      assert.equal(stored.targetUserId, ctx.learnerId);
      assert.equal(reported.status, 'ACCEPTED');
      assert.equal(reported.noShowReport?.status, 'PENDING_REVIEW');

      const after = await getMaterialQuantityState(prisma, material.id);
      assert.ok(after);
      assert.equal(Number(after.heldQuantity), 1);
      assert.equal(Number(after.availableQuantity), 3);
    });
  }

  test('general incident reports appear in admin no-show list', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx, {
      pickupWindowEnd: pickupWindowEndAfterGrace(),
    });

    const reported = await submitSupplierNoShowReport(
      ctx.supplierId,
      reservation.id,
      {
        reasonCode: 'WRONG_INFORMATION',
        note: 'Learner provided incorrect pickup details',
      },
    );
    ctx.createdReportIds.push(reported.noShowReport!.id);

    const listed = await listAdminNoShowReports({
      status: 'PENDING_REVIEW',
      page: 1,
      limit: 50,
    });

    const match = listed.items.find(
      (item) => item.id === reported.noShowReport!.id,
    );
    assert.ok(match);
    assert.equal(match.reasonCode, 'WRONG_INFORMATION');
    assert.equal(match.targetRole, 'LEARNER');
  });

  test('general incident reports are not pickup-recovery operational actions', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx, {
      pickupWindowEnd: pickupWindowEndAfterGrace(),
    });

    const reported = await submitSupplierNoShowReport(
      ctx.supplierId,
      reservation.id,
      {
        reasonCode: 'SAFETY_OR_TRUST_CONCERN',
        note: 'Safety concern during pickup coordination',
      },
    );
    ctx.createdReportIds.push(reported.noShowReport!.id);

    assert.equal(
      requiresPickupRecoveryOperationalAction({
        report: {
          reasonCode: 'SAFETY_OR_TRUST_CONCERN',
          targetRole: 'LEARNER',
          status: 'PENDING_REVIEW',
        },
        reservationStatus: reported.status,
      }),
      false,
    );

    const resolved = await resolveAdminNoShowReport(
      ctx.adminId,
      reported.noShowReport!.id,
      'Reviewed without pickup recovery action',
    );
    assert.equal(resolved.status, 'RESOLVED_NO_STRIKE');
  });

  test('learner no-show pickup-oriented report still escalates overdue self pickup', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx, {
      pickupWindowEnd: pickupWindowEndAfterGrace(),
    });

    const reported = await submitSupplierNoShowReport(
      ctx.supplierId,
      reservation.id,
      {
        reasonCode: 'LEARNER_DID_NOT_ARRIVE',
        note: 'Learner never arrived',
      },
    );
    ctx.createdReportIds.push(reported.noShowReport!.id);

    assert.equal(reported.status, 'AWAITING_RESOLUTION');
    assert.equal(reported.noShowReport?.targetRole, 'LEARNER');
  });
});
