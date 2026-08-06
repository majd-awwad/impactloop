import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';

import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import {
  cleanupPayTest,
  createPayDeliveryGroupFixture,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

describe('PAY-01 ensure payment orders', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'ensure-learner',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'ensure-supplier',
    });
    learnerId = learner.id;
    supplierId = supplier.id;
  });

  after(async () => {
    await cleanupPayTest(ids);
  });

  test('material zero amount creates no order', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });

    const result = await ensureMaterialPaymentOrder(reservation.id);
    assert.equal(result.outcome, 'NOT_REQUIRED');
  });

  test('delivery fee zero creates no order', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 0,
    });

    const result = await ensureDeliveryFeePaymentOrder(group.id);
    assert.equal(result.outcome, 'NOT_REQUIRED');
  });

  test('material cycle-1 derives payer amount currency from reservation', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 12.5,
      pricingCurrency: 'NIS',
    });

    const result = await ensureMaterialPaymentOrder(reservation.id);
    if (result.outcome !== 'CREATED' && result.outcome !== 'EXISTING') {
      assert.fail(`expected order, got ${result.outcome}`);
    }

    trackOrder(ids, result.order.id);
    assert.equal(result.order.payerUserId, learnerId);
    assert.equal(result.order.amount, '12.50');
    assert.equal(result.order.currency, 'NIS');
    assert.equal(result.order.purpose, 'MATERIAL_SUBTOTAL');
    assert.equal(result.order.cycleNumber, 1);
    assert.equal(result.order.reservationId, reservation.id);
    assert.equal(result.order.deliveryGroupId, null);
  });

  test('delivery-fee cycle-1 derives payer amount currency from group', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 20,
    });

    const result = await ensureDeliveryFeePaymentOrder(group.id);
    if (result.outcome !== 'CREATED' && result.outcome !== 'EXISTING') {
      assert.fail(`expected order, got `);
    }

    trackOrder(ids, result.order.id);
    assert.equal(result.order.payerUserId, learnerId);
    assert.equal(result.order.amount, '20.00');
    assert.equal(result.order.currency, 'NIS');
    assert.equal(result.order.purpose, 'DELIVERY_FEE');
    assert.equal(result.order.deliveryGroupId, group.id);
    assert.equal(result.order.reservationId, null);
  });

  test('concurrent material ensures create one order', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 7,
    });

    const [a, b] = await Promise.all([
      ensureMaterialPaymentOrder(reservation.id),
      ensureMaterialPaymentOrder(reservation.id),
    ]);

    if (a.outcome !== 'CREATED' && a.outcome !== 'EXISTING') assert.fail('expected a');
if (b.outcome !== 'CREATED' && b.outcome !== 'EXISTING') assert.fail('expected b');

    trackOrder(ids, a.order.id);
    trackOrder(ids, b.order.id);
    assert.equal(a.order.id, b.order.id);

    const count = await prisma.paymentOrder.count({
      where: {
        reservationId: reservation.id,
        purpose: 'MATERIAL_SUBTOTAL',
      },
    });
    assert.equal(count, 1);
  });

  test('concurrent delivery-fee ensures create one order', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 40,
    });

    const [a, b] = await Promise.all([
      ensureDeliveryFeePaymentOrder(group.id),
      ensureDeliveryFeePaymentOrder(group.id),
    ]);

    if (a.outcome !== 'CREATED' && a.outcome !== 'EXISTING') assert.fail('expected a');
if (b.outcome !== 'CREATED' && b.outcome !== 'EXISTING') assert.fail('expected b');

    trackOrder(ids, a.order.id);
    assert.equal(a.order.id, b.order.id);
  });

  test('existing cycle-1 order is returned unchanged', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 9,
    });
    const first = await ensureMaterialPaymentOrder(reservation.id);
    if (first.outcome !== 'CREATED' && first.outcome !== 'EXISTING') assert.fail('expected order');
    trackOrder(ids, first.order.id);

    await prisma.paymentOrder.update({
      where: { id: first.order.id },
      data: { status: 'CHECKOUT_PENDING' },
    });

    const second = await ensureMaterialPaymentOrder(reservation.id);
    assert.equal(second.outcome, 'EXISTING');
    if (second.outcome !== 'EXISTING') {
      assert.fail('expected existing');
    }
    assert.equal(second.order.id, first.order.id);
    assert.equal(second.order.status, 'CHECKOUT_PENDING');
  });

  test('terminal order is not reopened by ensure; ACCEPTED source gets next cycle', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 11,
    });
    const first = await ensureMaterialPaymentOrder(reservation.id);
    if (first.outcome !== 'CREATED' && first.outcome !== 'EXISTING') assert.fail('expected order');
    trackOrder(ids, first.order.id);

    await prisma.paymentOrder.update({
      where: { id: first.order.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const second = await ensureMaterialPaymentOrder(reservation.id);
    assert.equal(second.outcome, 'CREATED');
    if (second.outcome !== 'CREATED') {
      assert.fail('expected created');
    }
    assert.equal(second.order.cycleNumber, 2);
    assert.equal(second.order.status, 'REQUIRES_PAYMENT');
    trackOrder(ids, second.order.id);

    const cycle1 = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: first.order.id },
    });
    assert.equal(cycle1.status, 'CANCELLED');
  });

  test('schema rejects invalid purpose/source shapes', async () => {
    await assert.rejects(
      () =>
        prisma.$executeRaw`
          INSERT INTO payment_orders (
            id, payer_user_id, purpose, cycle_number, status, currency, amount,
            reservation_id, delivery_group_id, created_at, updated_at
          ) VALUES (
            ${`pay_invalid_${Date.now()}`},
            ${learnerId},
            'MATERIAL_SUBTOTAL'::"PaymentPurpose",
            1,
            'REQUIRES_PAYMENT'::"PaymentOrderStatus",
            'NIS',
            1.00,
            NULL,
            NULL,
            NOW(),
            NOW()
          )
        `,
    );
  });

  test('future cycle number can exist without mutating cycle 1', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 15,
    });
    const cycle1 = await ensureMaterialPaymentOrder(reservation.id);
    if (cycle1.outcome !== 'CREATED' && cycle1.outcome !== 'EXISTING') {
      assert.fail(`expected order, got ${cycle1.outcome}`);
    }
    trackOrder(ids, cycle1.order.id);

    await prisma.paymentOrder.update({
      where: { id: cycle1.order.id },
      data: { status: 'REFUNDED', refundedAt: new Date(), paidAt: new Date() },
    });

    const cycle2 = await prisma.paymentOrder.create({
      data: {
        payerUserId: learnerId,
        purpose: 'MATERIAL_SUBTOTAL',
        cycleNumber: 2,
        status: 'REQUIRES_PAYMENT',
        currency: 'NIS',
        amount: new Prisma.Decimal(15),
        reservationId: reservation.id,
      },
    });
    trackOrder(ids, cycle2.id);

    const stillCycle1 = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: cycle1.order.id },
    });
    assert.equal(stillCycle1.status, 'REFUNDED');
    assert.equal(stillCycle1.cycleNumber, 1);
    assert.equal(cycle2.cycleNumber, 2);
  });
});
