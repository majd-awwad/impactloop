import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import type { Express } from 'express';

import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';
import { signAccessToken } from '../../utils/jwt.js';

import { getMyReservationById } from '../reservations/reservations.service.js';
import { completeSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';

import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { reevaluateFulfillmentAfterPaymentOrderPaid } from './payments.fulfillment.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import {
  evaluateDeliveryGroupPaymentReadiness,
  evaluatePickupPaymentReadiness,
} from './payments.readiness.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';
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
  createPaymentsCheckoutTestApp,
  trackOrder,
} from './payments.test-helpers.js';

describe('PAY-02 payment obligations and fulfillment gating', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let otherLearnerId = '';
  let supplierId = '';
  let adminId = '';
  let app: Express;
  let server: Server;
  let baseUrl = '';

  before(async () => {
    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'pay02-learner',
    });
    const other = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'pay02-other',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'pay02-supplier',
    });
    const admin = await createPayUser(ids, {
      role: 'ADMIN',
      emailSuffix: 'pay02-admin',
    });
    learnerId = learner.id;
    otherLearnerId = other.id;
    supplierId = supplier.id;
    adminId = admin.id;

    app = await createPaymentsCheckoutTestApp();
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

  beforeEach(() => {
    setElectronicPaymentEnforcementForTests(true);
  });

  afterEach(() => {
    setElectronicPaymentEnforcementForTests(undefined);
  });

  async function payOrder(orderId: string) {
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay02-${orderId}-${Date.now()}-${Math.random()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
    trackOrder(ids, orderId);
  }

  async function attachDeliveryFields(reservationId: string, groupId: string) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: groupId,
        deliveryAddressText: '12 Learner Street',
        dropoffCity: 'Ramallah',
        dropoffArea: 'Center',
        deliveryFee: new Prisma.Decimal(0),
        confirmedDeliveryWindowStart: new Date(Date.now() + 86_400_000),
        confirmedDeliveryWindowEnd: new Date(Date.now() + 93_600_000),
        supplierPickupWindowStart: new Date(Date.now() + 43_200_000),
        supplierPickupWindowEnd: new Date(Date.now() + 50_400_000),
      },
    });
  }

  test('payments disabled: paid pickup creates no order and code remains available', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 40,
    });

    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    assert.equal(readiness.status, 'PAYMENT_DISABLED');
    assert.equal(readiness.ready, true);

    const orders = await prisma.paymentOrder.count({
      where: { reservationId: reservation.id },
    });
    assert.equal(orders, 0);

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', reservation.id),
    );

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() - 30 * 60_000),
        pickupWindowEnd: new Date(Date.now() + 60 * 60_000),
      },
    });

    const completed = await completeSupplierReservation(
      supplierId,
      reservation.id,
      {
        confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
      },
    );
    assert.equal(completed.status, 'COMPLETED');
  });

  test('free pickup: no material order, code exposed, completion succeeds', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });

    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.equal(ensured.outcome, 'NOT_REQUIRED');

    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    assert.equal(readiness.status, 'NOT_REQUIRED');
    assert.equal(readiness.ready, true);

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', reservation.id),
    );
  });

  test('paid pickup unpaid: material order, code hidden, completion rejected', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 55,
    });

    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    const again = await ensureMaterialPaymentOrder(reservation.id);
    assert.equal(again.outcome, 'EXISTING');
    assert.equal(again.order.id, ensured.order.id);

    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    assert.equal(readiness.ready, false);
    assert.equal(readiness.status, 'REQUIRES_PAYMENT');

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(mapped.selfPickupCode, null);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() - 30 * 60_000),
        pickupWindowEnd: new Date(Date.now() + 60 * 60_000),
      },
    });

    await assert.rejects(
      () =>
        completeSupplierReservation(supplierId, reservation.id, {
          confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'PAYMENT_REQUIRED',
    );
  });

  test('paid pickup after success: code visible and completion succeeds', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 60,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    await payOrder(ensured.order.id);

    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    assert.equal(readiness.status, 'PAID');
    assert.equal(readiness.ready, true);

    const mapped = await getMyReservationById(learnerId, reservation.id);
    assert.equal(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', reservation.id),
    );

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        pickupWindowStart: new Date(Date.now() - 30 * 60_000),
        pickupWindowEnd: new Date(Date.now() + 60 * 60_000),
      },
    });

    const completed = await completeSupplierReservation(
      supplierId,
      reservation.id,
      {
        confirmationCode: deriveHandoverCode('self-pickup', reservation.id),
      },
    );
    assert.equal(completed.status, 'COMPLETED');
  });

  test('checkout pending does not satisfy pickup payment', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 22,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    await startPaymentCheckout({
      orderId: ensured.order.id,
      payerUserId: learnerId,
      idempotencyKey: `pay02-pending-${Date.now()}`,
    });

    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    assert.equal(readiness.status, 'PROCESSING');
    assert.equal(readiness.ready, false);
  });

  test('missing material order for positive accepted pickup fails closed', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 18,
    });

    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    assert.equal(readiness.status, 'INVARIANT_VIOLATION');
    assert.equal(readiness.ready, false);
  });

  test('paid material + positive fee: both required before Delivery', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 15,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 40,
    });
    await attachDeliveryFields(reservation.id, group.id);

    const material = await ensureMaterialPaymentOrder(reservation.id);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(material.outcome === 'CREATED' || material.outcome === 'EXISTING');
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, material.order.id);
    trackOrder(ids, fee.order.id);

    let readiness = await evaluateDeliveryGroupPaymentReadiness(group.id);
    assert.equal(readiness.overallReady, false);

    await payOrder(fee.order.id);
    readiness = await evaluateDeliveryGroupPaymentReadiness(group.id);
    assert.equal(readiness.overallReady, false);
    assert.equal(readiness.fee.ready, true);

    await payOrder(material.order.id);
    readiness = await evaluateDeliveryGroupPaymentReadiness(group.id);
    assert.equal(readiness.overallReady, true);

    // Verified success already triggers post-commit fulfillment reevaluation.
    const deliveries = await prisma.delivery.findMany({
      where: { deliveryGroupId: group.id },
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]?.status, 'WAITING_FOR_DRIVER');

    const again = await reevaluateFulfillmentAfterPaymentOrderPaid(
      material.order.id,
    );
    assert.equal(again.deliveryCreated, false);
    assert.equal(
      (
        await prisma.delivery.findMany({
          where: { deliveryGroupId: group.id },
        })
      ).length,
      1,
    );
  });

  test('two paid reservations in one group need all three obligations', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 12,
    });
    const a = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 20,
    });
    const b = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 25,
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

    const feeAgain = await ensureDeliveryFeePaymentOrder(group.id);
    assert.equal(feeAgain.outcome, 'EXISTING');
    assert.equal(feeAgain.order.id, fee.order.id);

    await payOrder(fee.order.id);
    await payOrder(ma.order.id);
    let readiness = await evaluateDeliveryGroupPaymentReadiness(group.id);
    assert.equal(readiness.overallReady, false);

    await payOrder(mb.order.id);
    readiness = await evaluateDeliveryGroupPaymentReadiness(group.id);
    assert.equal(readiness.overallReady, true);

    await Promise.all([
      reevaluateFulfillmentAfterPaymentOrderPaid(mb.order.id),
      reevaluateFulfillmentAfterPaymentOrderPaid(fee.order.id),
    ]);

    const deliveries = await prisma.delivery.findMany({
      where: { deliveryGroupId: group.id },
    });
    assert.equal(deliveries.length, 1);
  });

  test('mixed free and paid group waits only on positive obligations', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 10,
    });
    const free = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });
    const paid = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 30,
    });
    await attachDeliveryFields(free.id, group.id);
    await attachDeliveryFields(paid.id, group.id);

    const freeOrder = await ensureMaterialPaymentOrder(free.id);
    const paidOrder = await ensureMaterialPaymentOrder(paid.id);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.equal(freeOrder.outcome, 'NOT_REQUIRED');
    assert.ok(paidOrder.outcome === 'CREATED' || paidOrder.outcome === 'EXISTING');
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, paidOrder.order.id);
    trackOrder(ids, fee.order.id);

    await payOrder(fee.order.id);
    await payOrder(paidOrder.order.id);
    const readiness = await evaluateDeliveryGroupPaymentReadiness(group.id);
    assert.equal(readiness.overallReady, true);
  });

  test('requirement endpoint auth and pickup code availability', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 33,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    const learnerToken = signAccessToken({
      sub: learnerId,
      roles: ['LEARNER'],
    });
    const otherToken = signAccessToken({
      sub: otherLearnerId,
      roles: ['LEARNER'],
    });
    const adminToken = signAccessToken({
      sub: adminId,
      roles: ['ADMIN'],
    });

    const ownerRes = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/requirement`,
      { headers: { Authorization: `Bearer ${learnerToken}` } },
    );
    assert.equal(ownerRes.status, 200);
    const ownerBody = (await ownerRes.json()) as {
      data: Awaited<ReturnType<typeof getReservationPaymentRequirement>>;
    };
    assert.equal(ownerBody.data.reservationId, reservation.id);
    assert.equal(ownerBody.data.pickupCodeAvailable, false);
    assert.equal(ownerBody.data.material.amount, '33.00');
    assert.equal(typeof ownerBody.data.material.amount, 'string');

    const otherRes = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/requirement`,
      { headers: { Authorization: `Bearer ${otherToken}` } },
    );
    assert.equal(otherRes.status, 404);

    const unauth = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/requirement`,
    );
    assert.equal(unauth.status, 401);

    const adminRes = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/requirement`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    assert.equal(adminRes.status, 200);
  });

  test('existing Delivery blocks unpaid late join under enforcement', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 0,
    });
    const primary = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });
    await attachDeliveryFields(primary.id, group.id);

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: primary.id },
      include: {
        material: {
          select: {
            location: {
              select: {
                country: true,
                city: true,
                area: true,
                addressLine: true,
                latitude: true,
                longitude: true,
                isApproximate: true,
              },
            },
          },
        },
      },
    });

    const { createOperationalDelivery } = await import(
      '../delivery-groups/delivery-group-operations.service.js'
    );
    await prisma.$transaction(async (tx) => {
      await createOperationalDelivery(tx, {
        reservationId: primary.id,
        deliveryGroupId: group.id,
        requesterId: learnerId,
        changedByUserId: supplierId,
        materialLocation: reservation.material.location,
        deliveryAddressText: '12 Learner Street',
        dropoffCity: 'Ramallah',
        dropoffArea: 'Center',
        statusHistoryNote: 'pay02 late-join guard fixture',
      });
    });

    const { findCompatibleDeliveryGroupCandidate } = await import(
      '../delivery-groups/delivery-groups.repository.js'
    );
    const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
      where: { userId: supplierId },
      select: { id: true },
    });
    const windowStart = new Date(Date.now() + 24 * 3_600_000);
    const windowEnd = new Date(windowStart.getTime() + 2 * 3_600_000);

    const candidate = await findCompatibleDeliveryGroupCandidate({
      learnerId,
      supplierProfileId: supplierProfile.id,
      dropoffCity: 'Ramallah',
      preferredDeliveryWindows: [
        {
          start: windowStart.toISOString(),
          end: windowEnd.toISOString(),
        },
      ],
      deliveryZone: 'SAME_CITY',
    });

    assert.equal(candidate, null);
  });
});
