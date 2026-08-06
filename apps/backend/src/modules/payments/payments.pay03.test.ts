import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';

import {
  createReservation,
  getMyReservationById,
} from '../reservations/reservations.service.js';
import {
  acceptSupplierReservation,
  cancelSupplierAcceptedReservation,
} from '../supplier-reservations/supplier-reservations.service.js';

import {
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import {
  handleReservationPaymentLifecycleTransition,
  peekDeliveryFeeEligibility,
} from './payments.lifecycle.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';
import {
  actOnMockCheckout,
  completeMockRefundViaEvent,
  requestFullRefundForPaidOrder,
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
import { evaluatePickupPaymentReadiness } from './payments.readiness.js';
import { runSerializableTransaction } from '../reservations/reservations.quantity.js';

const MARKER = '[pay03-test]';

function futureWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

describe('PAY-03 cancellation, refunds, and payment cycles', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay03-l' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay03-s' })
    ).id;
  });

  after(async () => {
    await cleanupPayTest(ids);
  });

  beforeEach(() => setElectronicPaymentEnforcementForTests(true));
  afterEach(() => setElectronicPaymentEnforcementForTests(undefined));

  async function payOrder(orderId: string) {
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay03-${orderId}-${Date.now()}-${Math.random()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
    trackOrder(ids, orderId);
  }

  async function createPaidPickupMaterial(price: number) {
    const category = await prisma.category.create({
      data: {
        nameEn: `${MARKER} ${Date.now()}`,
        nameAr: 'فئة',
        categoryType: 'MATERIAL',
        isActive: true,
      },
    });
    ids.categories.push(category.id);
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
    });
    ids.locations.push(location.id);
    const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
      where: { userId: supplierId },
    });
    const material = await prisma.material.create({
      data: {
        ownerId: supplierId,
        supplierProfileId: supplierProfile.id,
        categoryId: category.id,
        locationId: location.id,
        title: `${MARKER} material`,
        description: MARKER,
        materialType: 'Test',
        quantity: 10,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: false,
        price,
      },
    });
    ids.materials.push(material.id);
    return material;
  }

  test('unpaid material order cancels when accepted pickup is cancelled by supplier', async () => {
    const material = await createPaidPickupMaterial(30);
    const preferred = futureWindow(40);
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

    const order = await prisma.paymentOrder.findFirstOrThrow({
      where: { reservationId: created.id, purpose: 'MATERIAL_SUBTOTAL' },
    });
    trackOrder(ids, order.id);
    assert.equal(order.status, 'REQUIRES_PAYMENT');

    // Force overdue window so supplier cancel path is allowed.
    await prisma.reservation.update({
      where: { id: created.id },
      data: {
        pickupWindowEnd: new Date(Date.now() - 2 * 60 * 60_000),
      },
    });

    await cancelSupplierAcceptedReservation(supplierId, created.id, {
      reason: 'Window passed',
    });

    const after = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    assert.equal(after.status, 'CANCELLED');
    assert.ok(after.cancelledAt);

    // Idempotent duplicate lifecycle
    await runSerializableTransaction(async (tx) => {
      const again = await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: created.id,
        newStatus: 'CANCELLED',
        actorUserId: supplierId,
      });
      assert.ok(
        again.actions.some(
          (a) =>
            a.kind === 'SKIPPED_ALREADY_TERMINAL' || a.kind === 'NONE',
        ),
      );
    });
  });

  test('paid material refunds on pre-fulfillment cancel; success finalizes REFUNDED', async () => {
    const material = await createPaidPickupMaterial(45);
    const preferred = futureWindow(41);
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

    const order = await prisma.paymentOrder.findFirstOrThrow({
      where: { reservationId: created.id },
    });
    await payOrder(order.id);

    await prisma.reservation.update({
      where: { id: created.id },
      data: { pickupWindowEnd: new Date(Date.now() - 2 * 60 * 60_000) },
    });

    await cancelSupplierAcceptedReservation(supplierId, created.id, {
      reason: 'Cancelled after pay',
    });

    const pending = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { refund: true },
    });
    assert.equal(pending.status, 'REFUND_PENDING');
    assert.ok(pending.refund);
    assert.equal(
      await prisma.paymentRefund.count({ where: { paymentOrderId: order.id } }),
      1,
    );

    const readiness = await evaluatePickupPaymentReadiness(created.id);
    assert.equal(readiness.ready, false);
    assert.equal(readiness.status, 'REFUND_PENDING');

    const mapped = await getMyReservationById(learnerId, created.id);
    assert.equal(mapped.selfPickupCode, null);

    await completeMockRefundViaEvent({
      orderId: order.id,
      outcome: 'succeeded',
    });

    const refunded = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    assert.equal(refunded.status, 'REFUNDED');
  });

  test('completed material is not auto-refunded by lifecycle COMPLETED class', async () => {
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
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const result = await runSerializableTransaction(async (tx) =>
      handleReservationPaymentLifecycleTransition(tx, {
        reservationId: reservation.id,
        newStatus: 'COMPLETED',
        actorUserId: supplierId,
      }),
    );
    assert.ok(result.actions.some((a) => a.kind === 'SKIPPED_FULFILLED'));
    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: ensured.order.id },
    });
    assert.equal(order.status, 'PAID');
  });

  test('delivery fee: one member cancelled keeps fee; last member cancels unpaid fee', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 12,
    });
    const first = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
    });
    const second = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 11,
    });

    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: '12 St',
        dropoffCity: 'Ramallah',
      },
    });

    const fee = await (
      await import('./payments.ensure.js')
    ).ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, fee.order.id);

    await ensureMaterialPaymentOrder(first.id);
    await ensureMaterialPaymentOrder(second.id);

    await prisma.reservation.update({
      where: { id: first.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    await runSerializableTransaction(async (tx) => {
      await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: first.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
      });
    });

    const feeStill = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: fee.order.id },
    });
    assert.equal(feeStill.status, 'REQUIRES_PAYMENT');

    const eligibilityMid = await peekDeliveryFeeEligibility(group.id);
    assert.equal(eligibilityMid.eligibility, 'FEE_STILL_REQUIRED');

    await prisma.reservation.update({
      where: { id: second.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    await runSerializableTransaction(async (tx) => {
      await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: second.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
      });
    });

    const feeAfter = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: fee.order.id },
    });
    assert.equal(feeAfter.status, 'CANCELLED');
  });

  test('late success after cancelled unpaid order starts auto-refund without fulfillment', async () => {
    const material = await createPaidPickupMaterial(18);
    const preferred = futureWindow(42);
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

    const order = await prisma.paymentOrder.findFirstOrThrow({
      where: { reservationId: created.id },
    });
    trackOrder(ids, order.id);

    const checkout = await startPaymentCheckout({
      orderId: order.id,
      payerUserId: learnerId,
      idempotencyKey: `pay03-late-${Date.now()}`,
    });

    await prisma.reservation.update({
      where: { id: created.id },
      data: { pickupWindowEnd: new Date(Date.now() - 3 * 60 * 60_000) },
    });
    await cancelSupplierAcceptedReservation(supplierId, created.id, {
      reason: 'cancel before late pay',
    });

    const cancelled = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    assert.equal(cancelled.status, 'CANCELLED');

    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    const after = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { refund: true, attempts: true },
    });
    assert.equal(after.status, 'REFUND_PENDING');
    assert.ok(after.refund);
    assert.equal(
      after.attempts.some((a) => a.status === 'SUCCEEDED'),
      true,
    );

    const mapped = await getMyReservationById(learnerId, created.id);
    assert.equal(mapped.selfPickupCode, null);
    assert.notEqual(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', created.id),
    );
  });

  test('cycle 2 created after terminal cycle when reservation re-accepted via reschedule', async () => {
    const material = await createPaidPickupMaterial(27);
    const preferred = futureWindow(43);
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

    const cycle1 = await prisma.paymentOrder.findFirstOrThrow({
      where: { reservationId: created.id },
    });
    trackOrder(ids, cycle1.id);

    await prisma.reservation.update({
      where: { id: created.id },
      data: { pickupWindowEnd: new Date(Date.now() - 2 * 60 * 60_000) },
    });
    await cancelSupplierAcceptedReservation(supplierId, created.id, {
      reason: 'close cycle1',
    });

    assert.equal(
      (
        await prisma.paymentOrder.findUniqueOrThrow({ where: { id: cycle1.id } })
      ).status,
      'CANCELLED',
    );

    // Re-open as ACCEPTED via fixture path + ensure (simulates recovery re-accept).
    // Production reschedule requires AWAITING_SUPPLIER from ACCEPTED; after cancel
    // we recreate acceptance by setting ACCEPTED and calling ensure.
    await prisma.reservation.update({
      where: { id: created.id },
      data: {
        status: 'ACCEPTED',
        cancelledAt: null,
        pickupWindowStart: new Date(Date.now() + 48 * 3_600_000),
        pickupWindowEnd: new Date(Date.now() + 50 * 3_600_000),
      },
    });

    const ensured = await ensureMaterialPaymentOrder(created.id);
    assert.equal(ensured.outcome, 'CREATED');
    assert.equal(ensured.order.cycleNumber, 2);
    trackOrder(ids, ensured.order.id);

    const orders = await prisma.paymentOrder.findMany({
      where: { reservationId: created.id },
      orderBy: { cycleNumber: 'asc' },
    });
    assert.equal(orders.length, 2);
    assert.equal(orders[0]!.status, 'CANCELLED');
    assert.equal(orders[1]!.status, 'REQUIRES_PAYMENT');

    const req = await getReservationPaymentRequirement(created.id, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(req.material.cycleNumber, 2);
    assert.equal(req.material.canStartCheckout, true);
    assert.equal(
      req.orders.filter((o) => o.purpose === 'MATERIAL_SUBTOTAL' && o.isCurrent)
        .length,
      1,
    );
    assert.equal(
      req.orders.some(
        (o) => o.cycleNumber === 1 && o.status === 'CANCELLED' && !o.isCurrent,
      ),
      true,
    );
  });

  test('failed checkout stays on same cycle (new attempt only)', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 14,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    const first = await startPaymentCheckout({
      orderId: ensured.order.id,
      payerUserId: learnerId,
      idempotencyKey: `pay03-fail-${Date.now()}`,
    });
    await actOnMockCheckout({
      attemptId: first.attemptId,
      action: 'decline',
      actorUserId: learnerId,
    });

    const second = await startPaymentCheckout({
      orderId: ensured.order.id,
      payerUserId: learnerId,
      idempotencyKey: `pay03-retry-${Date.now()}`,
    });
    assert.notEqual(second.attemptId, first.attemptId);

    const orders = await prisma.paymentOrder.findMany({
      where: { reservationId: reservation.id },
    });
    assert.equal(orders.length, 1);
    assert.equal(orders[0]!.cycleNumber, 1);
  });

  test('disabled mode: supplier cancel creates no PaymentOrder mutations', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const material = await createPaidPickupMaterial(9);
    const preferred = futureWindow(44);
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

    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: created.id } }),
      0,
    );

    await prisma.reservation.update({
      where: { id: created.id },
      data: { pickupWindowEnd: new Date(Date.now() - 2 * 60 * 60_000) },
    });
    await cancelSupplierAcceptedReservation(supplierId, created.id, {
      reason: 'legacy cancel',
    });

    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: created.id } }),
      0,
    );
  });

  test('duplicate refund prepare reuses one PaymentRefund row', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 22,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    const first = await requestFullRefundForPaidOrder({
      orderId: ensured.order.id,
      reason: 'test',
      actorUserId: learnerId,
    });
    const second = await requestFullRefundForPaidOrder({
      orderId: ensured.order.id,
      reason: 'test again',
      actorUserId: learnerId,
    });

    assert.equal(first.refundId, second.refundId);
    assert.equal(
      await prisma.paymentRefund.count({
        where: { paymentOrderId: ensured.order.id },
      }),
      1,
    );
  });

  test('fee not refunded while sibling remains AWAITING_RESOLUTION', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 15,
    });
    const first = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
    });
    const second = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 11,
    });
    await prisma.reservation.updateMany({
      where: { id: { in: [first.id, second.id] } },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: '12 St',
        dropoffCity: 'Ramallah',
      },
    });
    const fee = await (
      await import('./payments.ensure.js')
    ).ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, fee.order.id);
    await payOrder(fee.order.id);

    await prisma.reservation.update({
      where: { id: first.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await prisma.reservation.update({
      where: { id: second.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });

    await runSerializableTransaction(async (tx) => {
      await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: first.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
      });
    });

    const eligibility = await peekDeliveryFeeEligibility(group.id);
    assert.equal(eligibility.eligibility, 'FEE_STILL_REQUIRED');
    assert.equal(
      (await prisma.paymentOrder.findUniqueOrThrow({ where: { id: fee.order.id } }))
        .status,
      'PAID',
    );
  });

  test('assigned delivery blocks automatic fee refund when group empty', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 16,
    });
    const member = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
    });
    await prisma.reservation.update({
      where: { id: member.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: '12 St',
        dropoffCity: 'Ramallah',
      },
    });
    const fee = await (
      await import('./payments.ensure.js')
    ).ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, fee.order.id);
    await payOrder(fee.order.id);

    const pickupLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: '[pay03-test] pickup',
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    ids.locations.push(pickupLocation.id);
    const dropoffLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Ramallah',
        area: '[pay03-test] drop',
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    ids.locations.push(dropoffLocation.id);

    await prisma.delivery.create({
      data: {
        reservationId: member.id,
        deliveryGroupId: group.id,
        status: 'AWAITING_RESOLUTION',
        pickupLocationId: pickupLocation.id,
        dropoffLocationId: dropoffLocation.id,
        requestedByUserId: learnerId,
      },
    });

    await prisma.reservation.update({
      where: { id: member.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const eligibility = await peekDeliveryFeeEligibility(group.id);
    assert.equal(
      eligibility.eligibility,
      'FULFILLMENT_STARTED_RESOLUTION_REQUIRED',
    );
  });

  test('CHECKOUT_PENDING late success on terminal source → REFUND_PENDING', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 19,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    const checkout = await startPaymentCheckout({
      orderId: ensured.order.id,
      payerUserId: learnerId,
      idempotencyKey: `pay03-co-pending-${Date.now()}`,
    });
    assert.equal(
      (
        await prisma.paymentOrder.findUniqueOrThrow({
          where: { id: ensured.order.id },
        })
      ).status,
      'CHECKOUT_PENDING',
    );

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    const after = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: ensured.order.id },
      include: { refund: true },
    });
    assert.equal(after.status, 'REFUND_PENDING');
    assert.ok(after.refund);
    assert.equal(after.refund!.reason, 'LATE_SUCCESS_AFTER_SOURCE_TERMINAL');

    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    assert.equal(readiness.ready, false);
  });

  test('REFUND_PENDING blocks pickup readiness', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 21,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    await requestFullRefundForPaidOrder({
      orderId: ensured.order.id,
      reason: 'block pickup',
      actorUserId: learnerId,
    });

    const readiness = await evaluatePickupPaymentReadiness(reservation.id);
    assert.equal(readiness.ready, false);
    assert.equal(readiness.status, 'REFUND_PENDING');
  });

  test('reconcile dry-run classifies unpaid terminal and empty group fee', async () => {
    const { reconcileAcceptedPaymentObligations } = await import(
      './payments.reconcile.js'
    );
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 13,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'EXPIRED' },
    });

    const dry = await reconcileAcceptedPaymentObligations({
      dryRun: true,
      reservationIds: [reservation.id],
    });
    assert.equal(dry.paymentEnforcementEnabled, true);
    assert.ok(dry.unpaidCancelCandidates.includes(ensured.order.id));
  });
});
