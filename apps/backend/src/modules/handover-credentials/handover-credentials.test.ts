import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { hashToken } from '../../utils/token.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import { activeHandoverWindow } from '../../test-utils/handover-test-windows.js';

import {
  issueHandoverCredential,
  verifyHandoverCredential,
} from './handover-credentials.service.js';
import {
  formatHandoverQrPayload,
  normalizeHandoverCredentialToken,
} from './handover-credentials.token.js';
import {
  completeSupplierReservation,
  confirmHandoverCredential,
} from '../supplier-reservations/supplier-reservations.service.js';
import {
  ensureMaterialPaymentOrder,
} from '../payments/payments.ensure.js';
import { setElectronicPaymentEnforcementForTests } from '../payments/payments.policy.js';
import {
  cleanupPayTest,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from '../payments/payments.test-helpers.js';
import {
  getMyProjectBuildById,
  startProjectBuildById,
} from '../learning-projects/learning-projects.service.js';

const TEST_MARKER = '[test-handover-qr-credential]';

type Ctx = {
  supplierId: string;
  otherSupplierId: string;
  learnerId: string;
  otherLearnerId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdReservationIds: string[];
  createdProjectIds: string[];
  createdBuildIds: string[];
  createdRequestIds: string[];
  createdCategoryIds: string[];
  createdLocationIds: string[];
};

async function createAcceptedPickupReservation(
  ctx: Ctx,
  options: {
    ownerId?: string;
    requesterId?: string;
    status?: 'ACCEPTED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED' | 'REJECTED';
    quantity?: number;
    window?: { start: Date; end: Date };
  } = {},
) {
  const ownerId = options.ownerId ?? ctx.supplierId;
  const requesterId = options.requesterId ?? ctx.learnerId;
  const status = options.status ?? 'ACCEPTED';
  const window = options.window ?? activeHandoverWindow();

  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: ownerId },
    select: { id: true },
  });

  const material = await prisma.material.create({
    data: {
      ownerId,
      supplierProfileId: supplierProfile?.id,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} Arduino Uno`,
      description: 'QR handover test material',
      materialType: 'Test',
      quantity: options.quantity ?? 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
    },
  });
  ctx.createdMaterialIds.push(material.id);

  const reservation = await prisma.reservation.create({
    data: {
      materialId: material.id,
      requesterId,
      ownerId,
      quantityRequested: 1,
      status,
      fulfillmentMethod: 'PICKUP',
      message: TEST_MARKER,
      pickupWindowStart: window.start,
      pickupWindowEnd: window.end,
      acceptedAt: status === 'ACCEPTED' || status === 'COMPLETED' ? new Date() : undefined,
      completedAt: status === 'COMPLETED' ? new Date() : undefined,
      cancelledAt: status === 'CANCELLED' ? new Date() : undefined,
      rejectedAt: status === 'REJECTED' ? new Date() : undefined,
    },
  });
  ctx.createdReservationIds.push(reservation.id);

  return { reservation, material };
}

describe('handover credential token helpers', () => {
  test('normalizes raw token and impactloop URI', () => {
    const raw = 'abcdefghijklmnopqrstuvwxyz012345';
    assert.equal(normalizeHandoverCredentialToken(raw), raw);
    assert.equal(
      normalizeHandoverCredentialToken(formatHandoverQrPayload(raw)),
      raw,
    );
    assert.equal(normalizeHandoverCredentialToken('short'), null);
    assert.equal(normalizeHandoverCredentialToken('abc/def/ghi/jklmnop'), null);
  });
});

describe('QR-01 handover credentials', () => {
  let ctx: Ctx;
  const payIds = createPayTestIds();

  before(async () => {
    const category = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} category`,
        nameAr: `${TEST_MARKER} فئة`,
        categoryType: 'MATERIAL',
        isActive: true,
      },
      select: { id: true },
    });
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

    const passwordHash = await hashPassword('TestPassword123!');
    const mkUser = async (
      role: 'LEARNER' | 'SUPPLIER',
      suffix: string,
    ) => {
      const user = await prisma.user.create({
        data: {
          displayName: `${TEST_MARKER} ${suffix}`,
          email: `${TEST_MARKER}-${suffix}-${Date.now()}@impactloop.test`,
          passwordHash,
          accountStatus: 'ACTIVE',
          emailVerifiedAt: new Date(),
          roles: { create: [{ role, isPrimary: true }] },
          ...(role === 'LEARNER'
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
                    publicName: `${TEST_MARKER} ${suffix}`,
                    verificationStatus: 'VERIFIED',
                  },
                },
              }),
        },
        select: { id: true },
      });
      return user.id;
    };

    const learnerId = await mkUser('LEARNER', 'learner');
    const otherLearnerId = await mkUser('LEARNER', 'other-learner');
    const supplierId = await mkUser('SUPPLIER', 'supplier');
    const otherSupplierId = await mkUser('SUPPLIER', 'other-supplier');

    ctx = {
      learnerId,
      otherLearnerId,
      supplierId,
      otherSupplierId,
      categoryId: category.id,
      locationId: location.id,
      createdUserIds: [learnerId, otherLearnerId, supplierId, otherSupplierId],
      createdMaterialIds: [],
      createdReservationIds: [],
      createdProjectIds: [],
      createdBuildIds: [],
      createdRequestIds: [],
      createdCategoryIds: [category.id],
      createdLocationIds: [location.id],
    };
  });

  after(async () => {
    if (ctx.createdRequestIds.length) {
      await prisma.learnerMaterialRequestMatch.deleteMany({
        where: { requestId: { in: ctx.createdRequestIds } },
      });
      await prisma.learnerMaterialRequest.deleteMany({
        where: { id: { in: ctx.createdRequestIds } },
      });
    }
    if (ctx.createdBuildIds.length) {
      await prisma.projectBuildItem.deleteMany({
        where: { buildId: { in: ctx.createdBuildIds } },
      });
      await prisma.projectBuild.deleteMany({
        where: { id: { in: ctx.createdBuildIds } },
      });
    }
    if (ctx.createdProjectIds.length) {
      await prisma.learningProject.deleteMany({
        where: { id: { in: ctx.createdProjectIds } },
      });
    }
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
    if (ctx.createdCategoryIds.length) {
      await prisma.category.deleteMany({
        where: { id: { in: ctx.createdCategoryIds } },
      });
    }
    if (ctx.createdLocationIds.length) {
      await prisma.location.deleteMany({
        where: { id: { in: ctx.createdLocationIds } },
      });
    }
    if (ctx.createdUserIds.length) {
      await prisma.user.deleteMany({
        where: { id: { in: ctx.createdUserIds } },
      });
    }
    await cleanupPayTest(payIds);
  });

  test('eligible learner receives opaque credential (hash stored, not raw)', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    assert.equal(issued.reservationId, reservation.id);
    assert.ok(issued.handoverToken.length >= 32);
    assert.equal(
      issued.qrPayload,
      formatHandoverQrPayload(issued.handoverToken),
    );
    assert.ok(issued.expiresAt);

    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: {
        handoverTokenHash: true,
        handoverTokenExpiresAt: true,
        handoverTokenUsedAt: true,
      },
    });
    assert.equal(stored.handoverTokenHash, hashToken(issued.handoverToken));
    assert.ok(stored.handoverTokenExpiresAt);
    assert.equal(stored.handoverTokenUsedAt, null);
  });

  test('different learner cannot issue credential', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    await assert.rejects(
      () => issueHandoverCredential(ctx.otherLearnerId, reservation.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'NOT_FOUND',
    );
  });

  test('terminal reservation cannot receive credential', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx, {
      status: 'CANCELLED',
    });
    await assert.rejects(
      () => issueHandoverCredential(ctx.learnerId, reservation.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'CONFLICT',
    );
  });

  test('valid token + correct supplier verifies without completing', async () => {
    const { reservation, material } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    const preview = await verifyHandoverCredential(
      ctx.supplierId,
      issued.qrPayload,
    );
    assert.equal(preview.reservationId, reservation.id);
    assert.equal(preview.material.id, material.id);
    assert.equal(preview.material.title, material.title);
    assert.equal(preview.quantity, 1);
    assert.equal(preview.unit, 'piece');
    assert.ok(preview.learner.displayName);

    const stillAccepted = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { status: true, handoverTokenUsedAt: true },
    });
    assert.equal(stillAccepted.status, 'ACCEPTED');
    assert.equal(stillAccepted.handoverTokenUsedAt, null);
  });

  test('random and tampered tokens are rejected', async () => {
    await assert.rejects(
      () =>
        verifyHandoverCredential(
          ctx.supplierId,
          'totally-random-token-value-xxxxxx',
        ),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );

    const { reservation } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);
    const tampered = `${issued.handoverToken.slice(0, -2)}zz`;
    await assert.rejects(
      () => verifyHandoverCredential(ctx.supplierId, tampered),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );
  });

  test('expired token is rejected', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        handoverTokenExpiresAt: new Date(Date.now() - 60_000),
      },
    });

    await assert.rejects(
      () => verifyHandoverCredential(ctx.supplierId, issued.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );
    await assert.rejects(
      () => confirmHandoverCredential(ctx.supplierId, issued.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );
  });

  test('wrong supplier cannot verify or confirm', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    await assert.rejects(
      () =>
        verifyHandoverCredential(ctx.otherSupplierId, issued.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );
    await assert.rejects(
      () =>
        confirmHandoverCredential(ctx.otherSupplierId, issued.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );
  });

  test('token for cancelled reservation is rejected', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    await assert.rejects(
      () => verifyHandoverCredential(ctx.supplierId, issued.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );
  });

  test('confirm completes reservation and consumes token; replay fails', async () => {
    const { reservation, material } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    const completed = await confirmHandoverCredential(
      ctx.supplierId,
      issued.handoverToken,
    );
    assert.equal(completed.status, 'COMPLETED');

    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: {
        status: true,
        completedAt: true,
        handoverTokenUsedAt: true,
      },
    });
    assert.equal(stored.status, 'COMPLETED');
    assert.ok(stored.completedAt);
    assert.ok(stored.handoverTokenUsedAt);

    const reusedMaterial = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
      select: { status: true, quantity: true, reusedByReservationId: true },
    });
    assert.equal(reusedMaterial.status, 'REUSED');
    assert.equal(Number(reusedMaterial.quantity), 0);
    assert.equal(reusedMaterial.reusedByReservationId, reservation.id);

    // Replay is idempotent (returns COMPLETED) or rejects — never duplicates side effects.
    const replay = await confirmHandoverCredential(
      ctx.supplierId,
      issued.handoverToken,
    ).catch((error: unknown) => error);
    if (replay instanceof AppError) {
      assert.ok(
        replay.code === 'HANDOVER_CREDENTIAL_INVALID' ||
          replay.code === 'CONFLICT',
      );
    } else {
      assert.equal((replay as { status: string }).status, 'COMPLETED');
    }

    const historyCount = await prisma.reservationStatusHistory.count({
      where: {
        reservationId: reservation.id,
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
      },
    });
    assert.equal(historyCount, 1);
  });

  test('concurrent confirmations complete at most once', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    const results = await Promise.allSettled([
      confirmHandoverCredential(ctx.supplierId, issued.handoverToken),
      confirmHandoverCredential(ctx.supplierId, issued.handoverToken),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert.equal(fulfilled.length + rejected.length, 2);
    assert.ok(fulfilled.length >= 1);
    assert.ok(fulfilled.length <= 2);

    const statuses = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { status: true },
    });
    assert.equal(statuses.status, 'COMPLETED');

    const historyCount = await prisma.reservationStatusHistory.count({
      where: {
        reservationId: reservation.id,
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
      },
    });
    assert.equal(historyCount, 1);
  });

  test('manual handover code still completes and invalidates QR credential', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    const completed = await completeSupplierReservation(
      ctx.supplierId,
      reservation.id,
      {
        confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
      },
    );
    assert.equal(completed.status, 'COMPLETED');

    const stored = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { handoverTokenUsedAt: true, status: true },
    });
    assert.equal(stored.status, 'COMPLETED');
    assert.ok(stored.handoverTokenUsedAt);

    const replay = await confirmHandoverCredential(
      ctx.supplierId,
      issued.handoverToken,
    ).catch((error: unknown) => error);
    if (replay instanceof AppError) {
      assert.ok(
        replay.code === 'HANDOVER_CREDENTIAL_INVALID' ||
          replay.code === 'CONFLICT',
      );
    } else {
      assert.equal((replay as { status: string }).status, 'COMPLETED');
    }

    const historyCount = await prisma.reservationStatusHistory.count({
      where: {
        reservationId: reservation.id,
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
      },
    });
    assert.equal(historyCount, 1);
  });

  test('reissue invalidates previous token', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const first = await issueHandoverCredential(ctx.learnerId, reservation.id);
    const second = await issueHandoverCredential(ctx.learnerId, reservation.id);

    assert.notEqual(first.handoverToken, second.handoverToken);

    await assert.rejects(
      () => verifyHandoverCredential(ctx.supplierId, first.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );

    const preview = await verifyHandoverCredential(
      ctx.supplierId,
      second.handoverToken,
    );
    assert.equal(preview.reservationId, reservation.id);
  });

  test('reissue: confirm with A fails and B succeeds', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const first = await issueHandoverCredential(ctx.learnerId, reservation.id);
    const second = await issueHandoverCredential(ctx.learnerId, reservation.id);

    await assert.rejects(
      () => confirmHandoverCredential(ctx.supplierId, first.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'HANDOVER_CREDENTIAL_INVALID',
    );

    const completed = await confirmHandoverCredential(
      ctx.supplierId,
      second.handoverToken,
    );
    assert.equal(completed.status, 'COMPLETED');

    await assert.rejects(
      () => confirmHandoverCredential(ctx.supplierId, first.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        (error.code === 'HANDOVER_CREDENTIAL_INVALID' ||
          error.code === 'CONFLICT'),
    );
  });

  test('token for cancelled reservation is rejected on confirm', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    await assert.rejects(
      () => confirmHandoverCredential(ctx.supplierId, issued.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        (error.code === 'HANDOVER_CREDENTIAL_INVALID' ||
          error.code === 'CONFLICT'),
    );

    const stillCancelled = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { status: true, handoverTokenUsedAt: true },
    });
    assert.equal(stillCancelled.status, 'CANCELLED');
    assert.equal(stillCancelled.handoverTokenUsedAt, null);
  });

  test('token for expired reservation is rejected on verify and confirm', async () => {
    const { reservation } = await createAcceptedPickupReservation(ctx);
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'EXPIRED',
      },
    });

    await assert.rejects(
      () => verifyHandoverCredential(ctx.supplierId, issued.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        (error.code === 'HANDOVER_CREDENTIAL_INVALID' ||
          error.code === 'CONFLICT'),
    );
    await assert.rejects(
      () => confirmHandoverCredential(ctx.supplierId, issued.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        (error.code === 'HANDOVER_CREDENTIAL_INVALID' ||
          error.code === 'CONFLICT'),
    );
  });

  test('QR confirm preserves linked Project Build acquisition state', async () => {
    const materialCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} mat-cat`,
        nameAr: `${TEST_MARKER} فئة`,
        categoryType: 'BOTH',
        isActive: true,
      },
    });
    const projectCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} proj-cat`,
        nameAr: `${TEST_MARKER} مشروع`,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });

    const { reservation, material } = await createAcceptedPickupReservation(ctx);

    await prisma.material.update({
      where: { id: material.id },
      data: { categoryId: materialCategory.id },
    });

    const project = await prisma.learningProject.create({
      data: {
        categoryId: projectCategory.id,
        createdBy: ctx.learnerId,
        title: `${TEST_MARKER} QR build project`,
        shortDescription: 'short',
        description: 'description',
        difficulty: 'BEGINNER',
        status: 'PUBLISHED',
        requiredComponents: {
          create: [
            {
              componentName: 'Arduino Uno',
              materialType: 'Test',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              categoryId: materialCategory.id,
              searchKeywords: ['arduino'],
            },
          ],
        },
      },
    });
    ctx.createdProjectIds.push(project.id);

    const build = await startProjectBuildById(project.id, ctx.learnerId);
    ctx.createdBuildIds.push(build.id);
    const itemId = build.items[0]!.id;

    await prisma.projectBuildItem.update({
      where: { id: itemId },
      data: {
        linkedMaterialId: material.id,
        linkedReservationId: reservation.id,
        linkedMaterialAt: new Date(),
      },
    });

    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);
    const completed = await confirmHandoverCredential(
      ctx.supplierId,
      issued.handoverToken,
    );
    assert.equal(completed.status, 'COMPLETED');

    const buildView = await getMyProjectBuildById(project.id, ctx.learnerId);
    const item = buildView.items.find((entry) => entry.id === itemId);
    assert.ok(item);
    assert.equal(item.linkedReservation?.id, reservation.id);
    assert.equal(item.linkedReservation?.status, 'COMPLETED');
    assert.equal(item.isReadyForBuild, true);

    await prisma.projectBuildItem.deleteMany({
      where: { buildId: build.id },
    });
    await prisma.projectBuild.delete({ where: { id: build.id } });
    await prisma.projectRequiredComponent.deleteMany({
      where: { projectId: project.id },
    });
    await prisma.learningProject.delete({ where: { id: project.id } });
    await prisma.material.update({
      where: { id: material.id },
      data: { categoryId: ctx.categoryId },
    });
    await prisma.category.deleteMany({
      where: { id: { in: [materialCategory.id, projectCategory.id] } },
    });
    ctx.createdProjectIds = ctx.createdProjectIds.filter((id) => id !== project.id);
    ctx.createdBuildIds = ctx.createdBuildIds.filter((id) => id !== build.id);
  });

  test('QR-04 full lifecycle: verify has no completion side effects; confirm once; replay safe', async () => {
    const { reservation, material } = await createAcceptedPickupReservation(ctx, {
      quantity: 1,
    });

    const materialBefore = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
      select: { status: true, quantity: true, reusedByReservationId: true },
    });
    assert.equal(materialBefore.status, 'AVAILABLE');
    assert.equal(Number(materialBefore.quantity), 1);

    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);
    await verifyHandoverCredential(ctx.supplierId, issued.qrPayload);

    const afterVerify = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { status: true, completedAt: true, handoverTokenUsedAt: true },
    });
    assert.equal(afterVerify.status, 'ACCEPTED');
    assert.equal(afterVerify.completedAt, null);
    assert.equal(afterVerify.handoverTokenUsedAt, null);

    const materialAfterVerify = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
      select: { status: true, quantity: true, reusedByReservationId: true },
    });
    assert.equal(materialAfterVerify.status, 'AVAILABLE');
    assert.equal(Number(materialAfterVerify.quantity), 1);
    assert.equal(materialAfterVerify.reusedByReservationId, null);

    const historyAfterVerify = await prisma.reservationStatusHistory.count({
      where: {
        reservationId: reservation.id,
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
      },
    });
    assert.equal(historyAfterVerify, 0);

    const completed = await confirmHandoverCredential(
      ctx.supplierId,
      issued.qrPayload,
    );
    assert.equal(completed.status, 'COMPLETED');

    const historyAfterConfirm = await prisma.reservationStatusHistory.count({
      where: {
        reservationId: reservation.id,
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
      },
    });
    assert.equal(historyAfterConfirm, 1);

    const replay = await confirmHandoverCredential(
      ctx.supplierId,
      issued.handoverToken,
    ).catch((error) => error);
    if (replay instanceof AppError) {
      assert.ok(
        replay.code === 'HANDOVER_CREDENTIAL_INVALID' ||
          replay.code === 'CONFLICT',
      );
    } else {
      assert.equal(replay.status, 'COMPLETED');
    }

    const historyAfterReplay = await prisma.reservationStatusHistory.count({
      where: {
        reservationId: reservation.id,
        oldStatus: 'ACCEPTED',
        newStatus: 'COMPLETED',
      },
    });
    assert.equal(historyAfterReplay, 1);

    const materialAfterReplay = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
      select: { quantity: true, status: true },
    });
    assert.equal(Number(materialAfterReplay.quantity), 0);
    assert.equal(materialAfterReplay.status, 'REUSED');
  });

  test('QR-04 verify alone never mutates reservation or material toward completion', async () => {
    const { reservation, material } = await createAcceptedPickupReservation(ctx, {
      quantity: 3,
    });
    const issued = await issueHandoverCredential(ctx.learnerId, reservation.id);
    await verifyHandoverCredential(ctx.supplierId, issued.handoverToken);
    await verifyHandoverCredential(ctx.supplierId, issued.qrPayload);

    const reservationState = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { status: true, completedAt: true, handoverTokenUsedAt: true },
    });
    assert.equal(reservationState.status, 'ACCEPTED');
    assert.equal(reservationState.completedAt, null);
    assert.equal(reservationState.handoverTokenUsedAt, null);

    const materialState = await prisma.material.findUniqueOrThrow({
      where: { id: material.id },
      select: { status: true, quantity: true, reusedByReservationId: true },
    });
    assert.equal(materialState.status, 'AVAILABLE');
    assert.equal(Number(materialState.quantity), 3);
    assert.equal(materialState.reusedByReservationId, null);

    const historyCount = await prisma.reservationStatusHistory.count({
      where: { reservationId: reservation.id, newStatus: 'COMPLETED' },
    });
    assert.equal(historyCount, 0);
  });
});

describe('QR-01 payment gate', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'qr01-learner',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'qr01-supplier',
    });
    learnerId = learner.id;
    supplierId = supplier.id;
  });

  after(async () => {
    await cleanupPayTest(ids);
  });

  beforeEach(() => {
    setElectronicPaymentEnforcementForTests(true);
  });

  afterEach(() => {
    setElectronicPaymentEnforcementForTests(undefined);
  });

  test('payment required unpaid: issue and confirm rejected', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 45,
    });

    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    await assert.rejects(
      () => issueHandoverCredential(learnerId, reservation.id),
      (error: unknown) =>
        error instanceof AppError && error.code === 'PAYMENT_REQUIRED',
    );

    // Force a stored token as if issued while unpaid; confirm must still fail.
    const forcedToken = 'forced-unpaid-handover-token-value-01';
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        handoverTokenHash: hashToken(forcedToken),
        handoverTokenIssuedAt: new Date(),
        handoverTokenExpiresAt: new Date(Date.now() + 60 * 60_000),
        handoverTokenUsedAt: null,
      },
    });

    await assert.rejects(
      () => confirmHandoverCredential(supplierId, forcedToken),
      (error: unknown) =>
        error instanceof AppError && error.code === 'PAYMENT_REQUIRED',
    );

    const status = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { status: true },
    });
    assert.equal(status.status, 'ACCEPTED');
  });

  test('cash QR pickup previews authoritative amount and settles with supplier evidence', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 45,
      paymentMethod: 'CASH',
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    assert.equal(ensured.order.status, 'REQUIRES_PAYMENT');

    const issued = await issueHandoverCredential(learnerId, reservation.id);
    const preview = await verifyHandoverCredential(
      supplierId,
      issued.handoverToken,
    );
    assert.deepEqual(preview.payment, {
      paymentMethod: 'CASH',
      cashDueAtHandover: true,
      totalAmount: Number(ensured.order.amount).toFixed(2),
      currency: ensured.order.currency,
    });

    await assert.rejects(
      () => confirmHandoverCredential(supplierId, issued.handoverToken),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'CASH_COLLECTION_CONFIRMATION_REQUIRED',
    );
    assert.equal(
      (
        await prisma.paymentOrder.findUniqueOrThrow({
          where: { id: ensured.order.id },
        })
      ).status,
      'REQUIRES_PAYMENT',
    );

    const completed = await confirmHandoverCredential(
      supplierId,
      issued.handoverToken,
      true,
    );
    assert.equal(completed.status, 'COMPLETED');
    const settled = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: ensured.order.id },
    });
    assert.equal(settled.status, 'PAID');
    assert.equal(settled.cashCollectedByUserId, supplierId);
    assert.ok(settled.paidAt);
  });
});
