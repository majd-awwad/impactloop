import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';
import { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

import { PAYMENT_NOTIFICATION_TYPES } from './payments.notifications.js';
import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { reconcileAcceptedPaymentObligations } from './payments.reconcile.js';
import {
  actOnMockCheckout,
  startPaymentCheckout,
} from './payments.service.js';
import {
  cleanupPayTest,
  createPayDeliveryGroupFixture,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

describe('PAY-04R group fee dedupe and reconcile notify', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay04r-l' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay04r-s' })
    ).id;
  });

  after(async () => {
    await cleanupPayTest(ids);
  });

  beforeEach(() => setElectronicPaymentEnforcementForTests(true));
  afterEach(() => setElectronicPaymentEnforcementForTests(undefined));

  async function attachDeliveryFields(reservationId: string, groupId: string) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: groupId,
        deliveryAddressText: 'Test dropoff',
        dropoffCity: 'Ramallah',
        dropoffArea: 'Center',
        status: 'ACCEPTED',
      },
    });
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
  }

  test('two materials + one fee: fee required communicated once', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 14,
    });
    const a = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 22,
    });
    const b = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 27,
    });
    await attachDeliveryFields(a.id, group.id);
    await attachDeliveryFields(b.id, group.id);

    const ma = await ensureMaterialPaymentOrder(a.id);
    const mb = await ensureMaterialPaymentOrder(b.id);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(ma.outcome === 'CREATED' || ma.outcome === 'EXISTING');
    assert.ok(mb.outcome === 'CREATED' || mb.outcome === 'EXISTING');
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, ma.order.id);
    trackOrder(ids, mb.order.id);
    trackOrder(ids, fee.order.id);

    const { notifyPaymentRequiredAfterAcceptance } = await import(
      './payments.notifications.js'
    );
    await notifyPaymentRequiredAfterAcceptance(a.id);
    await notifyPaymentRequiredAfterAcceptance(b.id);
    await notifyPaymentRequiredAfterAcceptance(a.id);

    const feeRequired = await prisma.notification.findMany({
      where: {
        userId: learnerId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
        eventKey: `payment:${fee.order.id}:required`,
      },
    });
    assert.equal(feeRequired.length, 1);

    const materialRequired = await prisma.notification.findMany({
      where: {
        userId: learnerId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
        eventKey: {
          in: [
            `payment:${ma.order.id}:required`,
            `payment:${mb.order.id}:required`,
          ],
        },
      },
    });
    assert.equal(materialRequired.length, 2);

    const bundleSpam = await prisma.notification.count({
      where: {
        userId: learnerId,
        eventKey: { contains: ':bundle:' },
      },
    });
    assert.equal(bundleSpam, 0);
  });

  test('mixed free/paid group: free has no material required; fee once', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 9,
    });
    const free = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });
    await prisma.reservation.update({
      where: { id: free.id },
      data: {
        materialSubtotal: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(0),
        unitPriceAtReservation: new Prisma.Decimal(0),
      },
    });
    const paid = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 30,
    });
    await attachDeliveryFields(free.id, group.id);
    await attachDeliveryFields(paid.id, group.id);

    const material = await ensureMaterialPaymentOrder(paid.id);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(material.outcome === 'CREATED' || material.outcome === 'EXISTING');
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, material.order.id);
    trackOrder(ids, fee.order.id);

    const { notifyPaymentRequiredAfterAcceptance } = await import(
      './payments.notifications.js'
    );
    await notifyPaymentRequiredAfterAcceptance(free.id);
    await notifyPaymentRequiredAfterAcceptance(paid.id);

    assert.equal(
      await prisma.paymentOrder.count({
        where: {
          reservationId: free.id,
          purpose: 'MATERIAL_SUBTOTAL',
        },
      }),
      0,
    );
    assert.equal(
      await prisma.notification.count({
        where: {
          eventKey: `payment:${material.order.id}:required`,
        },
      }),
      1,
    );
    assert.equal(
      await prisma.notification.count({
        where: { eventKey: `payment:${fee.order.id}:required` },
      }),
      1,
    );
  });

  test('partial material pay while fee unpaid does not unlock delivery', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 11,
    });
    const a = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 19,
    });
    const b = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 21,
    });
    await attachDeliveryFields(a.id, group.id);
    await attachDeliveryFields(b.id, group.id);

    const ma = await ensureMaterialPaymentOrder(a.id);
    const mb = await ensureMaterialPaymentOrder(b.id);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(ma.outcome === 'CREATED' || ma.outcome === 'EXISTING');
    assert.ok(mb.outcome === 'CREATED' || mb.outcome === 'EXISTING');
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, ma.order.id);
    trackOrder(ids, mb.order.id);
    trackOrder(ids, fee.order.id);

    await payOrder(ma.order.id, `pay04r-partial-${Date.now()}`);

    const completed = await prisma.notification.findFirst({
      where: {
        userId: learnerId,
        eventKey: `payment:${ma.order.id}:paid`,
      },
    });
    assert.ok(completed);
    assert.match(completed!.body, /additional payment/i);
    assert.equal(
      (completed!.metadata as Record<string, unknown>).morePaymentRequired,
      true,
    );

    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          notificationType:
            PAYMENT_NOTIFICATION_TYPES.PAYMENT_FULFILLMENT_READY,
          relatedEntityId: { in: [a.id, b.id] },
        },
      }),
      0,
    );

    await payOrder(fee.order.id, `pay04r-fee-${Date.now()}`);
    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          notificationType:
            PAYMENT_NOTIFICATION_TYPES.PAYMENT_FULFILLMENT_READY,
        },
      }),
      0,
    );

    await payOrder(mb.order.id, `pay04r-final-${Date.now()}`);
    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          notificationType:
            PAYMENT_NOTIFICATION_TYPES.PAYMENT_FULFILLMENT_READY,
          relatedEntityType: 'RESERVATION',
        },
      }),
      1,
    );
    assert.equal(
      await prisma.delivery.count({ where: { deliveryGroupId: group.id } }),
      1,
    );
  });

  test('reconcile creates material+fee then notifies once each; dry-run none', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 8,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 33,
    });
    await attachDeliveryFields(reservation.id, group.id);

    const before = await prisma.notification.count({
      where: {
        userId: learnerId,
        relatedEntityId: reservation.id,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
      },
    });

    await reconcileAcceptedPaymentObligations({
      dryRun: true,
      reservationIds: [reservation.id],
    });
    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          relatedEntityId: reservation.id,
          notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
        },
      }),
      before,
    );

    await reconcileAcceptedPaymentObligations({
      dryRun: false,
      reservationIds: [reservation.id],
    });

    const material = await prisma.paymentOrder.findFirstOrThrow({
      where: { reservationId: reservation.id, purpose: 'MATERIAL_SUBTOTAL' },
    });
    const fee = await prisma.paymentOrder.findFirstOrThrow({
      where: { deliveryGroupId: group.id, purpose: 'DELIVERY_FEE' },
    });
    trackOrder(ids, material.id);
    trackOrder(ids, fee.id);

    assert.equal(
      await prisma.notification.count({
        where: { eventKey: `payment:${material.id}:required` },
      }),
      1,
    );
    assert.equal(
      await prisma.notification.count({
        where: { eventKey: `payment:${fee.id}:required` },
      }),
      1,
    );

    await reconcileAcceptedPaymentObligations({
      dryRun: false,
      reservationIds: [reservation.id],
    });
    assert.equal(
      await prisma.notification.count({
        where: { eventKey: `payment:${material.id}:required` },
      }),
      1,
    );
    assert.equal(
      await prisma.notification.count({
        where: { eventKey: `payment:${fee.id}:required` },
      }),
      1,
    );
  });

  test('cancelled group member is not used as delivery-ready deep link', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 7,
    });
    const primary = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 16,
    });
    const cancelled = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 17,
    });
    await attachDeliveryFields(primary.id, group.id);
    await attachDeliveryFields(cancelled.id, group.id);
    await prisma.reservation.update({
      where: { id: cancelled.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const material = await ensureMaterialPaymentOrder(primary.id);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(material.outcome === 'CREATED' || material.outcome === 'EXISTING');
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, material.order.id);
    trackOrder(ids, fee.order.id);

    await payOrder(fee.order.id, `pay04r-link-fee-${Date.now()}`);
    await payOrder(material.order.id, `pay04r-link-mat-${Date.now()}`);

    const ready = await prisma.notification.findFirst({
      where: {
        userId: learnerId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_FULFILLMENT_READY,
        relatedEntityType: 'RESERVATION',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(ready);
    assert.equal(ready!.relatedEntityId, primary.id);
    assert.notEqual(ready!.relatedEntityId, cancelled.id);
  });
});
