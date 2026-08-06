import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';
import { createServer, type Server } from 'node:http';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { signAccessToken } from '../../utils/jwt.js';

import { createReservation } from '../reservations/reservations.service.js';
import {
  acceptSupplierReservation,
  cancelSupplierAcceptedReservation,
} from '../supplier-reservations/supplier-reservations.service.js';

import { PAYMENT_NOTIFICATION_TYPES } from './payments.notifications.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { reconcileAcceptedPaymentObligations } from './payments.reconcile.js';
import {
  actOnMockCheckout,
  completeMockRefundViaEvent,
  requestFullRefundForPaidOrder,
  startPaymentCheckout,
} from './payments.service.js';
import {
  cleanupPayTest,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

const MARKER = '[pay04-notif]';

function futureWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

describe('PAY-04 payment notifications', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let otherLearnerId = '';
  let supplierId = '';
  let server: Server;
  let baseUrl = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay04-l' })
    ).id;
    otherLearnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay04-other' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay04-s' })
    ).id;

    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind test server');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await cleanupPayTest(ids);
  });

  beforeEach(() => setElectronicPaymentEnforcementForTests(true));
  afterEach(() => setElectronicPaymentEnforcementForTests(undefined));

  async function createPaidPickupMaterial(price: number) {
    const category = await prisma.category.create({
      data: {
        nameEn: `${MARKER} cat ${Date.now()}`,
        nameAr: `${MARKER} فئة`,
        categoryType: 'MATERIAL',
        isActive: true,
      },
      select: { id: true },
    });
    ids.categories.push(category.id);
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: MARKER,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    ids.locations.push(location.id);
    const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
      where: { userId: supplierId },
      select: { id: true },
    });
    const material = await prisma.material.create({
      data: {
        ownerId: supplierId,
        supplierProfileId: supplierProfile.id,
        categoryId: category.id,
        locationId: location.id,
        title: `${MARKER} material`,
        description: 'pay04',
        materialType: 'Test',
        quantity: 10,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: price === 0,
        price: price === 0 ? null : price,
        pickupAllowed: true,
        deliveryAllowed: true,
      },
      select: { id: true },
    });
    ids.materials.push(material.id);
    return material;
  }

  async function acceptPaidPickup(price: number, hoursFromNow: number) {
    const material = await createPaidPickupMaterial(price);
    const preferred = futureWindow(hoursFromNow);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    });
    ids.reservations.push(created.id);

    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
      selectedPreferredWindowIndex: 0,
    });

    const order = await prisma.paymentOrder.findFirst({
      where: { reservationId: created.id },
    });
    if (order) {
      trackOrder(ids, order.id);
    }
    return { reservationId: created.id, order };
  }

  async function payOrder(orderId: string, key: string) {
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: key,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
    return checkout;
  }

  async function notesForReservation(
    reservationId: string,
    types?: string[],
  ) {
    return prisma.notification.findMany({
      where: {
        userId: learnerId,
        relatedEntityId: reservationId,
        ...(types
          ? { notificationType: { in: types } }
          : {
              notificationType: {
                in: Object.values(PAYMENT_NOTIFICATION_TYPES),
              },
            }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  test('paid pickup acceptance creates one payment-required notification', async () => {
    const { reservationId, order } = await acceptPaidPickup(41, 30);
    assert.ok(order);

    const required = await notesForReservation(reservationId, [
      PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
    ]);
    assert.equal(required.length, 1);
    assert.match(required[0]!.body, /pickup code stays hidden/i);
    assert.equal(required[0]!.relatedEntityId, reservationId);
    const meta = required[0]!.metadata as Record<string, unknown>;
    assert.equal(meta.paymentOrderId, order.id);
    assert.equal(meta.fulfillmentBlocked, true);
    assert.ok(!JSON.stringify(meta).toLowerCase().includes('provider'));
    assert.ok(!JSON.stringify(meta).includes('selfPickupCode'));
  });

  test('free pickup creates no payment notification', async () => {
    const { reservationId, order } = await acceptPaidPickup(0, 31);
    assert.equal(order, null);
    assert.equal((await notesForReservation(reservationId)).length, 0);
  });

  test('disabled mode creates no payment notifications', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const { reservationId } = await acceptPaidPickup(12, 32);
    assert.equal((await notesForReservation(reservationId)).length, 0);
  });

  test('repeated acceptance ensure does not duplicate payment-required', async () => {
    const { reservationId, order } = await acceptPaidPickup(15, 33);
    assert.ok(order);
    const { notifyPaymentRequiredAfterAcceptance } = await import(
      './payments.notifications.js'
    );
    await notifyPaymentRequiredAfterAcceptance(reservationId);
    await notifyPaymentRequiredAfterAcceptance(reservationId);
    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
        ])
      ).length,
      1,
    );
  });

  test('verified payment success notifies completed + pickup unlocked without code', async () => {
    const { reservationId, order } = await acceptPaidPickup(42, 34);
    assert.ok(order);
    const checkout = await payOrder(order.id, `pay04-ok-${Date.now()}`);

    const completed = await notesForReservation(reservationId, [
      PAYMENT_NOTIFICATION_TYPES.PAYMENT_COMPLETED,
    ]);
    assert.equal(completed.length, 1);
    assert.match(completed[0]!.body, /received/i);
    assert.ok(
      !(completed[0]!.metadata as Record<string, unknown>).morePaymentRequired,
    );

    const unlocked = await notesForReservation(reservationId, [
      PAYMENT_NOTIFICATION_TYPES.PAYMENT_FULFILLMENT_READY,
    ]);
    assert.equal(unlocked.length, 1);
    assert.match(unlocked[0]!.body, /pickup code/i);
    const blob = JSON.stringify(unlocked[0]!.metadata ?? {});
    assert.ok(!blob.toLowerCase().includes('handover'));
    assert.ok(!blob.includes('selfPickupCode'));

    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    }).catch(() => undefined);

    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_COMPLETED,
        ])
      ).length,
      1,
    );
    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_FULFILLMENT_READY,
        ])
      ).length,
      1,
    );
  });

  test('invalid webhook creates no payment-completed notification', async () => {
    const { reservationId, order } = await acceptPaidPickup(18, 35);
    assert.ok(order);
    const before = await notesForReservation(reservationId, [
      PAYMENT_NOTIFICATION_TYPES.PAYMENT_COMPLETED,
    ]);

    const res = await fetch(`${baseUrl}/api/payments/webhooks/mock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bogus: true }),
    });
    assert.ok(res.status >= 400);

    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_COMPLETED,
        ])
      ).length,
      before.length,
    );
  });

  test('refund requested then completed notifications are idempotent', async () => {
    const { reservationId, order } = await acceptPaidPickup(43, 36);
    assert.ok(order);
    await payOrder(order.id, `pay04-rf-${Date.now()}`);

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { pickupWindowEnd: new Date(Date.now() - 2 * 60 * 60_000) },
    });
    await cancelSupplierAcceptedReservation(supplierId, reservationId, {
      reason: 'cancel for refund notify',
    });

    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUND_REQUESTED,
        ])
      ).length,
      1,
    );

    await requestFullRefundForPaidOrder({
      orderId: order.id,
      reason: 'duplicate lifecycle',
      actorUserId: learnerId,
    });
    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUND_REQUESTED,
        ])
      ).length,
      1,
    );

    await completeMockRefundViaEvent({
      orderId: order.id,
      outcome: 'succeeded',
    });
    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUNDED,
        ])
      ).length,
      1,
    );
  });

  test('late success after cancel sends late-success message not normal paid', async () => {
    const { reservationId, order } = await acceptPaidPickup(44, 37);
    assert.ok(order);

    const checkout = await startPaymentCheckout({
      orderId: order.id,
      payerUserId: learnerId,
      idempotencyKey: `pay04-late-${Date.now()}`,
    });

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { pickupWindowEnd: new Date(Date.now() - 3 * 60 * 60_000) },
    });
    await cancelSupplierAcceptedReservation(supplierId, reservationId, {
      reason: 'cancel before late pay',
    });

    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_LATE_SUCCESS_REFUND,
        ])
      ).length,
      1,
    );
    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_COMPLETED,
        ])
      ).length,
      0,
    );
    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_FULFILLMENT_READY,
        ])
      ).length,
      0,
    );

    await completeMockRefundViaEvent({
      orderId: order.id,
      outcome: 'succeeded',
    });
    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUNDED,
        ])
      ).length,
      1,
    );
  });

  test('refund success while ACCEPTED consolidates new-cycle messaging', async () => {
    const { reservationId, order } = await acceptPaidPickup(55, 38);
    assert.ok(order);
    await payOrder(order.id, `pay04-cycle-${Date.now()}`);

    await requestFullRefundForPaidOrder({
      orderId: order.id,
      reason: 'manual refund while accepted',
      actorUserId: learnerId,
    });
    await completeMockRefundViaEvent({
      orderId: order.id,
      outcome: 'succeeded',
    });

    const refunded = await notesForReservation(reservationId, [
      PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUNDED,
    ]);
    assert.equal(refunded.length, 1);
    assert.match(refunded[0]!.body, /new payment/i);
    const meta = refunded[0]!.metadata as Record<string, unknown>;
    assert.equal(meta.newCycleCreated, true);

    const cycle2 = await prisma.paymentOrder.findFirstOrThrow({
      where: { reservationId, cycleNumber: 2 },
    });
    trackOrder(ids, cycle2.id);

    await completeMockRefundViaEvent({
      orderId: order.id,
      outcome: 'succeeded',
    }).catch(() => undefined);

    assert.equal(
      (
        await notesForReservation(reservationId, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_REFUNDED,
        ])
      ).length,
      1,
    );
  });

  test('reconciliation dry-run creates no notifications; apply is idempotent', async () => {
    const material = await createPaidPickupMaterial(21);
    const preferred = futureWindow(39);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    });
    ids.reservations.push(created.id);

    // Force ACCEPTED without going through accept path obligations.
    await prisma.reservation.update({
      where: { id: created.id },
      data: {
        status: 'ACCEPTED',
        pickupWindowStart: new Date(preferred.start),
        pickupWindowEnd: new Date(preferred.end),
        materialSubtotal: 21,
        pricingCurrency: 'NIS',
      },
    });

    const before = await notesForReservation(created.id);
    await reconcileAcceptedPaymentObligations({ dryRun: true });
    assert.equal((await notesForReservation(created.id)).length, before.length);

    await reconcileAcceptedPaymentObligations({ dryRun: false });
    const afterFirst = await notesForReservation(created.id, [
      PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
    ]);
    assert.ok(afterFirst.length >= 1);

    const order = await prisma.paymentOrder.findFirstOrThrow({
      where: { reservationId: created.id },
    });
    trackOrder(ids, order.id);

    await reconcileAcceptedPaymentObligations({ dryRun: false });
    assert.equal(
      (
        await notesForReservation(created.id, [
          PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
        ])
      ).length,
      afterFirst.length,
    );
  });

  test('notification list API serializes payment types safely for owner only', async () => {
    const { reservationId, order } = await acceptPaidPickup(19, 40);
    assert.ok(order);

    const learnerToken = signAccessToken({
      sub: learnerId,
      roles: ['LEARNER'],
    });
    const otherToken = signAccessToken({
      sub: otherLearnerId,
      roles: ['LEARNER'],
    });

    const mine = await fetch(`${baseUrl}/api/notifications?limit=50`, {
      headers: { authorization: `Bearer ${learnerToken}` },
    });
    assert.equal(mine.status, 200);
    const mineBody = (await mine.json()) as {
      data: {
        items: Array<{
          notificationType: string;
          relatedEntityId: string | null;
          metadata: Record<string, unknown>;
        }>;
      };
    };
    const paymentItem = mineBody.data.items.find(
      (item) =>
        item.relatedEntityId === reservationId &&
        item.notificationType === PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
    );
    assert.ok(paymentItem);
    assert.equal(typeof paymentItem!.notificationType, 'string');
    assert.ok(!JSON.stringify(paymentItem!.metadata).includes('providerRef'));

    const other = await fetch(`${baseUrl}/api/notifications?limit=50`, {
      headers: { authorization: `Bearer ${otherToken}` },
    });
    assert.equal(other.status, 200);
    const otherBody = (await other.json()) as {
      data: {
        items: Array<{ relatedEntityId: string | null; notificationType: string }>;
      };
    };
    assert.equal(
      otherBody.data.items.filter(
        (item) =>
          item.relatedEntityId === reservationId &&
          item.notificationType.startsWith('PAYMENT_'),
      ).length,
      0,
    );
  });
});
