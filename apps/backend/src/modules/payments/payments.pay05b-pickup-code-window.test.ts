import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { getMyReservationById } from '../reservations/reservations.service.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';

import { ensureMaterialPaymentOrder } from './payments.ensure.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import {
  cleanupPayTest,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';

async function payOrder(orderId: string) {
  await prisma.paymentOrder.update({
    where: { id: orderId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
    },
  });
}

describe('PAY-05B pickup-code visibility window gate', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'pay05b-learner',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'pay05b-supplier',
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

  test('paid + future window: code hidden with pickupCodeAvailable false', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 16,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() + 24 * 3_600_000),
        pickupWindowEnd: new Date(Date.now() + 26 * 3_600_000),
      },
    });

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(mapped.selfPickupCode, null);
    assert.equal(mapped.paymentSummary?.pickupCodeAvailable, false);
    assert.equal(mapped.paymentSummary?.overallStatus, 'PAID');
    assert.equal(mapped.paymentSummary?.fulfillmentReady, true);

    const requirement = await getReservationPaymentRequirement(reservation.id, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(requirement.pickupCodeAvailable, false);
    assert.equal(requirement.paymentReady, true);
  });

  test('paid + inside allowed handover window: code visible', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 18,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() - 15 * 60_000),
        pickupWindowEnd: new Date(Date.now() + 90 * 60_000),
      },
    });

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', reservation.id),
    );
    assert.equal(mapped.paymentSummary?.pickupCodeAvailable, true);

    const requirement = await getReservationPaymentRequirement(reservation.id, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(requirement.pickupCodeAvailable, true);
  });

  test('paid + expired window: code hidden', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 20,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() - 5 * 3_600_000),
        pickupWindowEnd: new Date(Date.now() - 2 * 3_600_000),
      },
    });

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(mapped.selfPickupCode, null);
    assert.equal(mapped.paymentSummary?.pickupCodeAvailable, false);
  });

  test('unpaid + inside window: code still hidden', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 22,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() - 15 * 60_000),
        pickupWindowEnd: new Date(Date.now() + 90 * 60_000),
      },
    });

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(mapped.selfPickupCode, null);
    assert.equal(mapped.paymentSummary?.pickupCodeAvailable, false);
    assert.equal(mapped.paymentSummary?.overallStatus, 'REQUIRES_PAYMENT');
  });

  test('missing window keeps payment-only gate for fixtures', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 12,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', reservation.id),
    );
    assert.equal(mapped.paymentSummary?.pickupCodeAvailable, true);
  });

  test('enforcement off still hides code before pickup window', async () => {
    setElectronicPaymentEnforcementForTests(false);

    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 14,
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() + 24 * 3_600_000),
        pickupWindowEnd: new Date(Date.now() + 26 * 3_600_000),
      },
    });

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(mapped.selfPickupCode, null);
    assert.equal(mapped.paymentSummary?.pickupCodeAvailable, false);

    const { resolvePickupCodeVisibilityByReservationIds } = await import(
      '../reservations/reservations.service.js',
    );
    const visibility = await resolvePickupCodeVisibilityByReservationIds([
      reservation.id,
    ]);
    assert.equal(visibility.get(reservation.id), false);
  });
});
