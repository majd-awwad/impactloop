import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';

import {
  createReservation,
} from '../reservations/reservations.service.js';
import { requestLearnerPickupReschedule } from '../reservations/reservations.service.js';
import {
  acceptLearnerRescheduleProposal,
  acceptSupplierReservation,
  cancelSupplierAcceptedReservation,
} from '../supplier-reservations/supplier-reservations.service.js';
import { expireStaleMissedPickupsForRequester } from '../reservations/reservations.missed-pickup-expiry.repository.js';

import { ensureMaterialPaymentOrder } from './payments.ensure.js';
import {
  ensureNextPaymentCycleAfterVerifiedRefund,
  flushPostCommitPaymentRefunds,
  handleReservationPaymentLifecycleTransition,
  peekMaterialRefundEligibility,
} from './payments.lifecycle.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';
import { reconcileAcceptedPaymentObligations } from './payments.reconcile.js';
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
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

const MARKER = '[pay03r-test]';

function futureWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

describe('PAY-03R refund eligibility, recovery cycle, regression', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay03r-l' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay03r-s' })
    ).id;
  });

  after(async () => {
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
        description: 'pay03r',
        materialType: 'Test',
        quantity: 10,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: false,
        price,
        pickupAllowed: true,
        deliveryAllowed: true,
      },
      select: { id: true },
    });
    ids.materials.push(material.id);
    return material;
  }

  async function payOrder(orderId: string) {
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay03r-${orderId}-${Date.now()}-${Math.random()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
  }

  test('re-accept while REFUND_PENDING: refund success creates cycle 2 automatically', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 31,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    await requestFullRefundForPaidOrder({
      orderId: ensured.order.id,
      reason: 'pending while still accepted',
      actorUserId: learnerId,
    });
    assert.equal(
      (
        await prisma.paymentOrder.findUniqueOrThrow({
          where: { id: ensured.order.id },
        })
      ).status,
      'REFUND_PENDING',
    );

    // ACCEPTED + REFUND_PENDING: ensure must not open cycle 2 yet.
    const mid = await ensureMaterialPaymentOrder(reservation.id);
    assert.equal(mid.outcome, 'EXISTING');
    assert.equal(mid.order.cycleNumber, 1);

    await completeMockRefundViaEvent({
      orderId: ensured.order.id,
      outcome: 'succeeded',
    });

    const orders = await prisma.paymentOrder.findMany({
      where: { reservationId: reservation.id },
      orderBy: { cycleNumber: 'asc' },
    });
    assert.equal(orders.length, 2);
    assert.equal(orders[0]!.status, 'REFUNDED');
    assert.equal(orders[1]!.status, 'REQUIRES_PAYMENT');
    assert.equal(orders[1]!.cycleNumber, 2);
    trackOrder(ids, orders[1]!.id);

    const again = await ensureNextPaymentCycleAfterVerifiedRefund(
      ensured.order.id,
    );
    // Refunded cycle is no longer latest once cycle 2 exists.
    assert.equal(again.outcome, 'NOT_LATEST');
    assert.equal(
      await prisma.paymentOrder.count({
        where: { reservationId: reservation.id },
      }),
      2,
    );

    const req = await getReservationPaymentRequirement(reservation.id, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(req.material.cycleNumber, 2);
    assert.equal(req.material.canStartCheckout, true);
    assert.equal(
      req.orders.some((o) => o.cycleNumber === 1 && !o.isCurrent),
      true,
    );
  });

  test('refund success on terminal source creates no cycle 2', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 32,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await runSerializableTransaction(async (tx) => {
      await handleReservationPaymentLifecycleTransition(tx, {
        reservationId: reservation.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
      });
    });
    await completeMockRefundViaEvent({
      orderId: ensured.order.id,
      outcome: 'succeeded',
    });

    assert.equal(
      await prisma.paymentOrder.count({
        where: { reservationId: reservation.id },
      }),
      1,
    );
    const after = await ensureNextPaymentCycleAfterVerifiedRefund(
      ensured.order.id,
    );
    assert.equal(after.outcome, 'NOT_PAYABLE');
  });

  test('assigned Delivery blocks automatic material refund', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 33,
    });
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 10,
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: '1 St',
        dropoffCity: 'Ramallah',
      },
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    const pickupLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${MARKER} p`,
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
        area: `${MARKER} d`,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    ids.locations.push(dropoffLocation.id);

    await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        deliveryGroupId: group.id,
        status: 'DRIVER_ASSIGNED',
        pickupLocationId: pickupLocation.id,
        dropoffLocationId: dropoffLocation.id,
        requestedByUserId: learnerId,
      },
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    const eligibility = await peekMaterialRefundEligibility(reservation.id);
    assert.equal(
      eligibility.eligibility,
      'FULFILLMENT_STARTED_RESOLUTION_REQUIRED',
    );

    const result = await runSerializableTransaction(async (tx) =>
      handleReservationPaymentLifecycleTransition(tx, {
        reservationId: reservation.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
      }),
    );
    assert.ok(
      result.actions.some(
        (a) =>
          a.kind === 'SKIPPED_RESOLUTION_REQUIRED' ||
          (a.kind === 'MATERIAL_ELIGIBILITY' &&
            a.eligibility === 'FULFILLMENT_STARTED_RESOLUTION_REQUIRED'),
      ),
    );
    assert.equal(
      (
        await prisma.paymentOrder.findUniqueOrThrow({
          where: { id: ensured.order.id },
        })
      ).status,
      'PAID',
    );
  });

  test('reconcile skips assigned Delivery material refund', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 34,
    });
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 9,
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: '2 St',
        dropoffCity: 'Ramallah',
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    // ensure may refuse because not ACCEPTED — create order directly if needed
    let orderId = ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING'
      ? ensured.order.id
      : null;
    if (!orderId) {
      const created = await prisma.paymentOrder.create({
        data: {
          payerUserId: learnerId,
          purpose: 'MATERIAL_SUBTOTAL',
          cycleNumber: 1,
          status: 'PAID',
          currency: 'NIS',
          amount: 34,
          reservationId: reservation.id,
          paidAt: new Date(),
        },
      });
      orderId = created.id;
    } else {
      await prisma.paymentOrder.update({
        where: { id: orderId },
        data: { status: 'PAID', paidAt: new Date() },
      });
    }
    trackOrder(ids, orderId);

    const pickupLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${MARKER} rp`,
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
        area: `${MARKER} rd`,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    ids.locations.push(dropoffLocation.id);
    await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        deliveryGroupId: group.id,
        status: 'PICKED_UP',
        pickedUpAt: new Date(),
        pickupLocationId: pickupLocation.id,
        dropoffLocationId: dropoffLocation.id,
        requestedByUserId: learnerId,
      },
    });

    const dry = await reconcileAcceptedPaymentObligations({
      dryRun: true,
      reservationIds: [reservation.id],
    });
    assert.ok(
      dry.materialResolutionRequiredSkipped.includes(reservation.id),
    );
    assert.equal(dry.refundCandidates.includes(orderId), false);
  });

  test('missed-pickup expiry starts refund for paid material', async () => {
    const material = await createPaidPickupMaterial(35);
    const preferred = futureWindow(50);
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
    await payOrder(order.id);

    await prisma.reservation.update({
      where: { id: created.id },
      data: {
        pickupWindowEnd: new Date(Date.now() - 80 * 60 * 60_000),
      },
    });

    await expireStaleMissedPickupsForRequester(learnerId);

    const after = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { refund: true },
    });
    assert.ok(
      after.status === 'REFUND_PENDING' || after.status === 'REFUNDED',
    );
    assert.ok(after.refund);
  });

  test('flush failure leaves cancellation intact and refund retryable', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 36,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);
    await payOrder(ensured.order.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const lifecycle = await runSerializableTransaction(async (tx) =>
      handleReservationPaymentLifecycleTransition(tx, {
        reservationId: reservation.id,
        newStatus: 'CANCELLED',
        actorUserId: learnerId,
      }),
    );
    assert.equal(
      (
        await prisma.reservation.findUniqueOrThrow({
          where: { id: reservation.id },
        })
      ).status,
      'CANCELLED',
    );

    // Corrupt attempt provider ref so provider refund initiation fails.
    await prisma.paymentAttempt.updateMany({
      where: { paymentOrderId: ensured.order.id, status: 'SUCCEEDED' },
      data: { providerRef: null },
    });

    const flush = await flushPostCommitPaymentRefunds(
      lifecycle.postCommitRefunds,
    );
    assert.ok(flush.failed.length >= 1 || flush.attemptedOrderIds.length >= 1);

    const order = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: ensured.order.id },
      include: { refund: true },
    });
    assert.equal(order.status, 'REFUND_PENDING');
    assert.ok(order.refund);
    assert.equal(
      await prisma.paymentRefund.count({
        where: { paymentOrderId: ensured.order.id },
      }),
      1,
    );

    // Restore provider ref and retry via same refund row.
    await prisma.paymentAttempt.updateMany({
      where: { paymentOrderId: ensured.order.id, status: 'SUCCEEDED' },
      data: { providerRef: `mock-restored-${ensured.order.id}` },
    });
    await requestFullRefundForPaidOrder({
      orderId: ensured.order.id,
      reason: 'retry',
      actorUserId: learnerId,
    });
    assert.equal(
      await prisma.paymentRefund.count({
        where: { paymentOrderId: ensured.order.id },
      }),
      1,
    );
  });

  test('production acceptLearnerReschedule creates cycle 2 after terminal cycle', async () => {
    const material = await createPaidPickupMaterial(37);
    const preferred = futureWindow(55);
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
    await payOrder(cycle1.id);

    const rescheduleWindow = futureWindow(70);
    await requestLearnerPickupReschedule(learnerId, created.id, {
      pickupWindowStart: rescheduleWindow.start,
      pickupWindowEnd: rescheduleWindow.end,
      reason: 'Need later window',
    });
    assert.equal(
      (
        await prisma.reservation.findUniqueOrThrow({ where: { id: created.id } })
      ).status,
      'AWAITING_SUPPLIER_CONFIRMATION',
    );

    // Prior cycle becomes terminal (refunded) before supplier re-accepts.
    await requestFullRefundForPaidOrder({
      orderId: cycle1.id,
      reason: 'terminal before re-accept',
      actorUserId: learnerId,
    });
    await completeMockRefundViaEvent({
      orderId: cycle1.id,
      outcome: 'succeeded',
    });
    // Keep AWAITING_SUPPLIER — refund success must not create cycle 2 yet.
    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: created.id } }),
      1,
    );

    const accepted = await acceptLearnerRescheduleProposal(
      supplierId,
      created.id,
    );
    assert.equal(accepted.status, 'ACCEPTED');

    const orders = await prisma.paymentOrder.findMany({
      where: { reservationId: created.id },
      orderBy: { cycleNumber: 'asc' },
    });
    assert.equal(orders.length, 2);
    assert.equal(orders[0]!.status, 'REFUNDED');
    assert.equal(orders[1]!.cycleNumber, 2);
    assert.equal(orders[1]!.status, 'REQUIRES_PAYMENT');
    trackOrder(ids, orders[1]!.id);
  });

  test('disabled mode: missed-pickup expiry creates no PaymentOrders', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const material = await createPaidPickupMaterial(8);
    const preferred = futureWindow(56);
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
      data: { pickupWindowEnd: new Date(Date.now() - 80 * 60 * 60_000) },
    });
    await expireStaleMissedPickupsForRequester(learnerId);
    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: created.id } }),
      0,
    );
  });
});
