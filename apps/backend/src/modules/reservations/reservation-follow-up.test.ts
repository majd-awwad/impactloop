import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import {
  rejectAdminNoShowReport,
  verifyAdminNoShowReport,
} from '../admin-no-show-reports/admin-no-show-reports.service.js';
import {
  createLearnerReservationMessage,
  listMyReservations,
} from '../reservations/reservations.service.js';
import { resolveReservationFollowUp } from '../reservations/reservation-follow-up.js';
import {
  cancelSupplierAcceptedReservation,
  createSupplierReservationMessage,
  listSupplierReservationMessages,
  listSupplierReservations,
  rescheduleSupplierReservation,
  submitSupplierNoShowReport,
} from '../supplier-reservations/supplier-reservations.service.js';

const TEST_MARKER = '[test-reservation-follow-up]';

const pickupWindowEndAfterGrace = () =>
  new Date(Date.now() - (31 * 60 + 5) * 1000);

type TestContext = {
  supplierId: string;
  otherSupplierId: string;
  learnerId: string;
  adminId: string;
  categoryId: string;
  locationId: string;
  createdReservationIds: string[];
  createdMaterialIds: string[];
  createdReportIds: string[];
  createdUserIds: string[];
};

async function createAcceptedReservation(
  ctx: TestContext,
  input: {
    pickupWindowEnd: Date;
    ownerId?: string;
  },
) {
  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId ?? ctx.supplierId,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} material ${Date.now()}`,
      description: 'Follow-up test material',
      materialType: 'Test',
      quantity: 1,
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
      ownerId: input.ownerId ?? ctx.supplierId,
      quantityRequested: 1,
      status: 'ACCEPTED',
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
    await prisma.reservationMessage.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
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
    await prisma.notification.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('resolveReservationFollowUp', () => {
  test('accepted reservation becomes overdue after pickupWindowEnd passes', () => {
    const now = new Date('2026-07-02T12:00:00.000Z');
    const result = resolveReservationFollowUp({
      status: 'ACCEPTED',
      pickupWindowStart: new Date('2026-07-02T08:00:00.000Z'),
      pickupWindowEnd: new Date('2026-07-02T10:00:00.000Z'),
      now,
    });

    assert.equal(result.isOverdue, true);
    assert.equal(result.needsFollowUp, true);
    assert.equal(result.pickupWindowStatus, 'OVERDUE');
  });

  test('accepted reservation before pickupWindowEnd is not overdue', () => {
    const now = new Date('2026-07-02T09:00:00.000Z');
    const result = resolveReservationFollowUp({
      status: 'ACCEPTED',
      pickupWindowStart: new Date('2026-07-02T08:00:00.000Z'),
      pickupWindowEnd: new Date('2026-07-02T10:00:00.000Z'),
      now,
    });

    assert.equal(result.isOverdue, false);
    assert.equal(result.needsFollowUp, false);
  });

  test('overdue does not auto-complete', () => {
    const result = resolveReservationFollowUp({
      status: 'ACCEPTED',
      pickupWindowStart: new Date('2026-07-01T08:00:00.000Z'),
      pickupWindowEnd: new Date('2026-07-01T10:00:00.000Z'),
      now: new Date('2026-07-02T12:00:00.000Z'),
    });

    assert.equal(result.isOverdue, true);
    assert.notEqual(result.pickupWindowStatus, 'COMPLETED');
  });
});

describe('reservation follow-up actions', () => {
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
        email: `${Date.now()}-followup-supplier@test.local`,
        passwordHash,
        accountStatus: 'ACTIVE',
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: 'Follow-up Supplier',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    const otherSupplier = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} Other Supplier`,
        email: `${Date.now()}-followup-other@test.local`,
        passwordHash,
        accountStatus: 'ACTIVE',
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: 'Other Supplier',
            verificationStatus: 'VERIFIED',
          },
        },
      },
    });
    const learner = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} Learner`,
        email: `${Date.now()}-followup-learner@test.local`,
        passwordHash,
        accountStatus: 'ACTIVE',
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      },
    });
    const admin = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} Admin`,
        email: `${Date.now()}-followup-admin@test.local`,
        passwordHash,
        accountStatus: 'ACTIVE',
        roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
      },
    });

    ctx = {
      supplierId: supplier.id,
      otherSupplierId: otherSupplier.id,
      learnerId: learner.id,
      adminId: admin.id,
      categoryId: category.id,
      locationId: location.id,
      createdReservationIds: [],
      createdMaterialIds: [],
      createdReportIds: [],
      createdUserIds: [supplier.id, otherSupplier.id, learner.id, admin.id],
    };
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.$disconnect();
  });

  test('supplier list exposes overdue flags after pickup window passes', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: pastEnd,
    });

    const items = await listSupplierReservations(ctx.supplierId, {
      status: 'accepted',
    });
    const item = items.find((entry) => entry.id === reservation.id);

    assert.ok(item);
    assert.equal(item.isOverdue, true);
    assert.equal(item.needsFollowUp, true);
    assert.equal(item.canSupplierCloseOverduePickup, true);
    assert.equal(item.canSupplierReportAndCloseOverduePickup, true);
  });

  test('supplier can reschedule own accepted reservation and clears overdue when future', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: pastEnd,
    });

    const futureStart = new Date(Date.now() + 3_600_000);
    const futureEnd = new Date(Date.now() + 7_200_000);

    const updated = await rescheduleSupplierReservation(
      ctx.supplierId,
      reservation.id,
      {
        pickupWindowStart: futureStart.toISOString(),
        pickupWindowEnd: futureEnd.toISOString(),
        supplierNote: 'Rescheduled pickup',
        messageToLearner: 'Pickup rescheduled to tomorrow.',
        reason: 'Schedule conflict',
      },
    );

    assert.equal(updated.status, 'AWAITING_LEARNER_CONFIRMATION');
    assert.equal(updated.isOverdue, false);
    assert.equal(updated.needsFollowUp, false);
  });

  test('supplier cannot reschedule another supplier reservation', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: pastEnd,
      ownerId: ctx.otherSupplierId,
    });

    await assert.rejects(
      () =>
        rescheduleSupplierReservation(ctx.supplierId, reservation.id, {
          pickupWindowStart: new Date(Date.now() + 3_600_000).toISOString(),
          pickupWindowEnd: new Date(Date.now() + 7_200_000).toISOString(),
          reason: 'Schedule conflict',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('supplier can cancel own overdue accepted reservation and release material', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation, material } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: pastEnd,
    });

    const cancelled = await cancelSupplierAcceptedReservation(
      ctx.supplierId,
      reservation.id,
      { reason: 'Could not complete pickup' },
    );

    assert.equal(cancelled.status, 'CANCELLED');

    const updatedMaterial = await prisma.material.findUnique({
      where: { id: material.id },
    });
    assert.equal(updatedMaterial?.status, 'AVAILABLE');
  });

  test('cancel does not create no-show strike', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: pastEnd,
    });

    await cancelSupplierAcceptedReservation(ctx.supplierId, reservation.id, {});

    const reports = await prisma.noShowReport.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(reports, 0);
  });

  test('supplier can submit no-show report after pickup window expires', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: pastEnd,
    });

    const report = await submitSupplierNoShowReport(
      ctx.supplierId,
      reservation.id,
      {
        reasonCode: 'LEARNER_DID_NOT_ARRIVE',
        note: 'Learner never arrived',
      },
    );

    ctx.createdReportIds.push(report.noShowReport!.id);
    assert.equal(report.status, 'AWAITING_RESOLUTION');
    assert.equal(report.noShowReport?.status, 'PENDING_REVIEW');
    assert.equal(report.noShowReport?.targetRole, 'LEARNER');
  });

  test('supplier cannot report before pickup window expires', async () => {
    const futureEnd = new Date(Date.now() + 3_600_000);
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: futureEnd,
    });

    await assert.rejects(
      () =>
        submitSupplierNoShowReport(ctx.supplierId, reservation.id, {
          reasonCode: 'LEARNER_DID_NOT_ARRIVE',
          note: 'Learner did not arrive during the pickup window.',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('same reservation target cannot be reported twice', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: pastEnd,
    });

    const first = await submitSupplierNoShowReport(
      ctx.supplierId,
      reservation.id,
      { reasonCode: 'LEARNER_DID_NOT_ARRIVE', note: 'Did not arrive' },
    );
    ctx.createdReportIds.push(first.noShowReport!.id);

    await assert.rejects(
      () =>
        submitSupplierNoShowReport(ctx.supplierId, reservation.id, {
          reasonCode: 'OTHER',
          note: 'Duplicate attempt',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('admin can verify no-show report and three verified reports suspend target', async () => {
    for (let i = 0; i < 3; i += 1) {
      const pastEnd = new Date(pickupWindowEndAfterGrace().getTime() - i * 1000);
      const { reservation } = await createAcceptedReservation(ctx, {
        pickupWindowEnd: pastEnd,
      });
      const report = await submitSupplierNoShowReport(
        ctx.supplierId,
        reservation.id,
        { reasonCode: 'LEARNER_DID_NOT_ARRIVE', note: 'Did not arrive' },
      );
      ctx.createdReportIds.push(report.noShowReport!.id);

      const verified = await verifyAdminNoShowReport(
        ctx.adminId,
        report.noShowReport!.id,
        'Verified',
      );
      if (i === 2) {
        assert.equal(verified.shouldWarnAdmin, true);
        assert.equal(verified.targetSuspended, true);
        assert.match(
          verified.adminRecommendation ?? '',
          /automatically suspended/i,
        );
      }
    }

    const target = await prisma.user.findUnique({
      where: { id: ctx.learnerId },
      select: { accountStatus: true },
    });
    assert.equal(target?.accountStatus, 'SUSPENDED');
  });

  test('admin can reject no-show report', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: pastEnd,
    });
    const report = await submitSupplierNoShowReport(
      ctx.supplierId,
      reservation.id,
      { reasonCode: 'OTHER', note: 'Insufficient evidence from supplier' },
    );
    ctx.createdReportIds.push(report.noShowReport!.id);

    const rejected = await rejectAdminNoShowReport(
      ctx.adminId,
      report.noShowReport!.id,
      'Insufficient evidence',
    );

    assert.equal(rejected.status, 'REJECTED');
  });

  test('learner can send message on own reservation', async () => {
    const futureEnd = new Date(Date.now() + 3_600_000);
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: futureEnd,
    });

    const message = await createLearnerReservationMessage(
      ctx.learnerId,
      reservation.id,
      { body: 'Sorry, I may be late.' },
    );

    assert.equal(message.body, 'Sorry, I may be late.');
  });

  test('supplier can send message on own material reservation', async () => {
    const futureEnd = new Date(Date.now() + 3_600_000);
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: futureEnd,
    });

    const message = await createSupplierReservationMessage(
      ctx.supplierId,
      reservation.id,
      { body: 'Please come before 4 PM.' },
    );

    assert.equal(message.body, 'Please come before 4 PM.');
  });

  test('users cannot message reservations they do not own', async () => {
    const futureEnd = new Date(Date.now() + 3_600_000);
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: futureEnd,
      ownerId: ctx.otherSupplierId,
    });

    await assert.rejects(
      () =>
        createSupplierReservationMessage(ctx.supplierId, reservation.id, {
          body: 'Not my reservation',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('learner list includes follow-up fields and latest message', async () => {
    const pastEnd = pickupWindowEndAfterGrace();
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: pastEnd,
    });

    await createLearnerReservationMessage(ctx.learnerId, reservation.id, {
      body: 'Can we reschedule?',
    });

    const reservations = await listMyReservations(ctx.learnerId);
    const item = reservations.find((entry) => entry.id === reservation.id);

    assert.ok(item);
    assert.equal(item.isOverdue, true);
    assert.equal(item.latestMessage?.body, 'Can we reschedule?');
  });

  test('supplier can list reservation messages', async () => {
    const futureEnd = new Date(Date.now() + 3_600_000);
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: futureEnd,
    });

    await createLearnerReservationMessage(ctx.learnerId, reservation.id, {
      body: 'On my way',
    });

    const messages = await listSupplierReservationMessages(
      ctx.supplierId,
      reservation.id,
    );

    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.body, 'On my way');
  });

  test('learner message notifies only the other participant once', async () => {
    const futureEnd = new Date(Date.now() + 3_600_000);
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: futureEnd,
    });

    const message = await createLearnerReservationMessage(
      ctx.learnerId,
      reservation.id,
      { body: 'I will arrive at 3 PM.' },
    );

    const supplierNotes = await prisma.notification.findMany({
      where: {
        userId: ctx.supplierId,
        notificationType: 'RESERVATION_MESSAGE_RECEIVED',
        relatedEntityId: reservation.id,
      },
    });
    const learnerNotes = await prisma.notification.findMany({
      where: {
        userId: ctx.learnerId,
        notificationType: 'RESERVATION_MESSAGE_RECEIVED',
        relatedEntityId: reservation.id,
      },
    });

    assert.equal(supplierNotes.length, 1);
    assert.equal(learnerNotes.length, 0);
    assert.equal(supplierNotes[0]?.relatedEntityType, 'RESERVATION');
    assert.equal(supplierNotes[0]?.actionType, 'OPEN_RESERVATION');
    assert.match(supplierNotes[0]?.body ?? '', /I will arrive at 3 PM/);
    assert.equal(
      supplierNotes[0]?.eventKey,
      `reservation:message:${message.id}:${ctx.supplierId}`,
    );

    const { notifyReservationMessageReceived } = await import(
      '../notifications/reservation-message-notifications.js'
    );
    await notifyReservationMessageReceived({
      reservationId: reservation.id,
      messageId: message.id,
      senderUserId: ctx.learnerId,
      senderDisplayName: 'Learner',
      body: 'I will arrive at 3 PM.',
    });

    const afterRetry = await prisma.notification.count({
      where: {
        userId: ctx.supplierId,
        notificationType: 'RESERVATION_MESSAGE_RECEIVED',
        relatedEntityId: reservation.id,
      },
    });
    assert.equal(afterRetry, 1);
  });

  test('supplier message notifies the learner and supports read transition', async () => {
    const futureEnd = new Date(Date.now() + 3_600_000);
    const { reservation } = await createAcceptedReservation(ctx, {
      pickupWindowEnd: futureEnd,
    });

    await createSupplierReservationMessage(ctx.supplierId, reservation.id, {
      body: 'Please come before 4 PM.',
    });

    const learnerNotes = await prisma.notification.findMany({
      where: {
        userId: ctx.learnerId,
        notificationType: 'RESERVATION_MESSAGE_RECEIVED',
        relatedEntityId: reservation.id,
      },
    });
    const supplierNotes = await prisma.notification.findMany({
      where: {
        userId: ctx.supplierId,
        notificationType: 'RESERVATION_MESSAGE_RECEIVED',
        relatedEntityId: reservation.id,
      },
    });

    assert.equal(learnerNotes.length, 1);
    assert.equal(supplierNotes.length, 0);
    assert.equal(learnerNotes[0]?.isRead, false);

    const { markMyNotificationRead } = await import(
      '../notifications/notifications.service.js'
    );
    const marked = await markMyNotificationRead(
      ctx.learnerId,
      learnerNotes[0]!.id,
    );
    assert.equal(marked.isRead, true);
  });
});
