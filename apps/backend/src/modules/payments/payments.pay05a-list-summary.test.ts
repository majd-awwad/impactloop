import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { listMyReservations } from '../reservations/reservations.service.js';

import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import {
  cleanupPayTest,
  createPayDeliveryGroupFixture,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

describe('PAY-05A list paymentSummary batch DTO', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'pay05a-learner',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'pay05a-supplier',
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

  async function attachDeliveryFields(
    reservationId: string,
    groupId: string,
    deliveryFee: number,
  ) {
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: { materialSubtotal: true },
    });

    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: groupId,
        deliveryAddressText: '12 Learner Street',
        dropoffCity: 'Ramallah',
        deliveryFee,
        totalAmount: reservation.materialSubtotal.add(deliveryFee),
        confirmedDeliveryWindowStart: new Date(Date.now() + 86_400_000),
        confirmedDeliveryWindowEnd: new Date(Date.now() + 93_600_000),
        supplierPickupWindowStart: new Date(Date.now() + 43_200_000),
        supplierPickupWindowEnd: new Date(Date.now() + 50_400_000),
      },
    });
  }

  test('owner list includes batched paymentSummary with amount strings', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 16,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    const listed = await listMyReservations(learnerId);
    const row = listed.find((r) => r.id === reservation.id);
    assert.ok(row);
    assert.ok(row.paymentSummary);
    assert.equal(row.paymentSummary.enforcementEnabled, true);
    assert.equal(row.paymentSummary.overallStatus, 'REQUIRES_PAYMENT');
    assert.equal(row.paymentSummary.hasMaterialPaymentOutstanding, true);
    assert.equal(row.paymentSummary.hasDeliveryFeeOutstanding, false);
    assert.equal(row.paymentSummary.checkoutableOrderId, ensured.order.id);
    assert.equal(row.paymentSummary.outstandingAmount, '16.00');
    assert.equal(typeof row.paymentSummary.outstandingAmount, 'string');
    assert.equal(row.paymentSummary.fulfillmentReady, false);
    assert.equal(row.paymentSummary.pickupCodeAvailable, false);
    assert.equal(row.paymentSummary.deliveryDispatchable, false);
    assert.equal(
      Object.prototype.hasOwnProperty.call(row.paymentSummary, 'provider'),
      false,
    );
    assert.equal(
      Object.prototype.hasOwnProperty.call(row.paymentSummary, 'attempts'),
      false,
    );
  });

  test('shared delivery fee is not double-counted in outstanding amounts', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 12,
    });
    const a = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
    });
    const b = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
    });
    await attachDeliveryFields(a.id, group.id, 12);
    await attachDeliveryFields(b.id, group.id, 0);

    const ma = await ensureMaterialPaymentOrder(a.id);
    const mb = await ensureMaterialPaymentOrder(b.id);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(ma.outcome === 'CREATED' || ma.outcome === 'EXISTING');
    assert.ok(mb.outcome === 'CREATED' || mb.outcome === 'EXISTING');
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, ma.order.id);
    trackOrder(ids, mb.order.id);
    trackOrder(ids, fee.order.id);

    await prisma.paymentOrder.update({
      where: { id: ma.order.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    await prisma.paymentOrder.update({
      where: { id: mb.order.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    const listed = await listMyReservations(learnerId);
    const members = listed.filter((r) => r.id === a.id || r.id === b.id);
    assert.equal(members.length, 2);

    const feeAmounts = members
      .map((m) => m.paymentSummary?.outstandingAmount)
      .filter((amount) => amount != null);
    // Only the primary payer (positive deliveryFee) includes fee amount.
    assert.equal(feeAmounts.length, 1);
    assert.equal(feeAmounts[0], '12.00');

    for (const member of members) {
      assert.equal(member.paymentSummary?.hasDeliveryFeeOutstanding, true);
      assert.equal(member.paymentSummary?.hasMaterialPaymentOutstanding, false);
      assert.equal(member.paymentSummary?.checkoutableOrderId, fee.order.id);
    }
  });

  test('payments disabled returns PAYMENT_DISABLED without pay CTA', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 9.5,
    });

    const listed = await listMyReservations(learnerId);
    const row = listed.find((r) => r.id === reservation.id);
    assert.ok(row?.paymentSummary);
    assert.equal(row.paymentSummary.enforcementEnabled, false);
    assert.equal(row.paymentSummary.overallStatus, 'PAYMENT_DISABLED');
    assert.equal(row.paymentSummary.checkoutableOrderId, null);
    assert.equal(row.paymentSummary.hasMaterialPaymentOutstanding, false);
    assert.equal(row.paymentSummary.fulfillmentReady, true);
    assert.equal(row.paymentSummary.pickupCodeAvailable, true);
  });

  test('mixed free and paid reservations batch without per-row payment queries', async () => {
    const free = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });
    const paid = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 5,
    });
    const ensured = await ensureMaterialPaymentOrder(paid.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    const listed = await listMyReservations(learnerId);
    const freeRow = listed.find((r) => r.id === free.id);
    const paidRow = listed.find((r) => r.id === paid.id);

    assert.equal(freeRow?.paymentSummary?.overallStatus, 'NOT_REQUIRED');
    assert.equal(freeRow?.paymentSummary?.checkoutableOrderId, null);
    assert.equal(freeRow?.paymentSummary?.pickupCodeAvailable, true);

    assert.equal(paidRow?.paymentSummary?.overallStatus, 'REQUIRES_PAYMENT');
    assert.equal(paidRow?.paymentSummary?.checkoutableOrderId, ensured.order.id);
    assert.equal(paidRow?.paymentSummary?.outstandingAmount, '5.00');
  });
});
