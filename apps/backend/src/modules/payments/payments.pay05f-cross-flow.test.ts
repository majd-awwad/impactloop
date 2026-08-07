import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  getMyReservationById,
  listMyReservations,
} from '../reservations/reservations.service.js';

import { startReservationCheckout } from './payments.checkout-session.js';
import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { resolvePaymentSummariesByReservations } from './payments.list-summary.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';
import { actOnMockCheckout } from './payments.service.js';
import {
  cleanupPayTest,
  createPayDeliveryGroupFixture,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

/**
 * PAY-05F — Cross-flow payment integration (enforcement ON).
 *
 * Reuses PAY-05* invariants and adds missing cross-surface assertions:
 * list ↔ details ↔ requirement ↔ checkout stay consistent; auth gates hold;
 * shared-group joiners surface fee amounts without inventing extra orders.
 */
describe('PAY-05F cross-flow payment integration (enforcement ON)', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let otherLearnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay05f-l' })
    ).id;
    otherLearnerId = (
      await createPayUser(ids, {
        role: 'LEARNER',
        emailSuffix: 'pay05f-other',
      })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay05f-s' })
    ).id;
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

  async function ensureAndTrackMaterial(reservationId: string) {
    const ensured = await ensureMaterialPaymentOrder(reservationId);
    if (ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING') {
      trackOrder(ids, ensured.order.id);
      return ensured.order;
    }
    return null;
  }

  async function ensureAndTrackFee(groupId: string) {
    const ensured = await ensureDeliveryFeePaymentOrder(groupId);
    if (ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING') {
      trackOrder(ids, ensured.order.id);
      return ensured.order;
    }
    return null;
  }

  function assertSummaryAligned(
    listSummary: NonNullable<
      Awaited<ReturnType<typeof listMyReservations>>[number]['paymentSummary']
    >,
    detailSummary: NonNullable<
      Awaited<ReturnType<typeof getMyReservationById>>['paymentSummary']
    >,
    requirement: Awaited<ReturnType<typeof getReservationPaymentRequirement>>,
  ) {
    assert.equal(listSummary.overallStatus, detailSummary.overallStatus);
    assert.equal(
      listSummary.outstandingAmount,
      detailSummary.outstandingAmount,
    );
    assert.equal(
      listSummary.hasMaterialPaymentOutstanding,
      detailSummary.hasMaterialPaymentOutstanding,
    );
    assert.equal(
      listSummary.hasDeliveryFeeOutstanding,
      detailSummary.hasDeliveryFeeOutstanding,
    );
    assert.equal(
      listSummary.checkoutableOrderId,
      detailSummary.checkoutableOrderId,
    );
    assert.equal(
      listSummary.pickupCodeAvailable,
      detailSummary.pickupCodeAvailable,
    );
    assert.equal(
      listSummary.fulfillmentReady,
      detailSummary.fulfillmentReady,
    );
    assert.equal(
      listSummary.pickupCodeAvailable,
      requirement.pickupCodeAvailable,
    );
    assert.equal(listSummary.fulfillmentReady, requirement.fulfillmentReady);
  }

  test('A: paid pickup — list/details/requirement stay aligned after success', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 40,
      pickupWindowStart: new Date(Date.now() - 30 * 60_000),
      pickupWindowEnd: new Date(Date.now() + 3_600_000),
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const beforeList = await listMyReservations(learnerId);
    const beforeRow = beforeList.find((r) => r.id === reservation.id);
    assert.equal(beforeRow?.paymentSummary?.overallStatus, 'REQUIRES_PAYMENT');
    assert.equal(beforeRow?.paymentSummary?.checkoutableOrderId, material.id);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05f-A-${Date.now()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const listed = await listMyReservations(learnerId);
    const listRow = listed.find((r) => r.id === reservation.id);
    const detail = await getMyReservationById(learnerId, reservation.id);
    const requirement = await getReservationPaymentRequirement(reservation.id, {
      userId: learnerId,
      roles: ['LEARNER'],
    });

    assert.ok(listRow?.paymentSummary);
    assert.ok(detail.paymentSummary);
    assertSummaryAligned(
      listRow.paymentSummary,
      detail.paymentSummary,
      requirement,
    );
    assert.equal(listRow.paymentSummary.overallStatus, 'PAID');
    assert.equal(listRow.paymentSummary.pickupCodeAvailable, true);
    assert.equal(detail.selfPickupCode != null, true);
    assert.equal(await prisma.delivery.count({ where: { reservationId: reservation.id } }), 0);
  });

  test('B: free pickup — NOT_REQUIRED, no material order, no checkout', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
      pickupWindowStart: new Date(Date.now() - 30 * 60_000),
      pickupWindowEnd: new Date(Date.now() + 3_600_000),
    });

    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.equal(ensured.outcome, 'NOT_REQUIRED');

    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: learnerId,
          idempotencyKey: `pay05f-B-${Date.now()}`,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'NOTHING_TO_PAY',
    );

    const listed = await listMyReservations(learnerId);
    const listRow = listed.find((r) => r.id === reservation.id);
    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(listRow?.paymentSummary?.overallStatus, 'NOT_REQUIRED');
    assert.equal(detail.paymentSummary?.overallStatus, 'NOT_REQUIRED');
    assert.equal(listRow?.paymentSummary?.checkoutableOrderId, null);
    assert.equal(detail.paymentSummary?.fulfillmentReady, true);
  });

  test('C: material+delivery combined — list total matches checkout; WAITING only after settle', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 20,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 200,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 20,
      deliveryGroupId: group.id,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(material);
    assert.ok(fee);

    const listedBefore = await listMyReservations(learnerId);
    const before = listedBefore.find((r) => r.id === reservation.id);
    assert.equal(before?.paymentSummary?.outstandingAmount, '220.00');
    assert.equal(before?.paymentSummary?.outstandingOrderCount, 2);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05f-C-${Date.now()}`,
    });
    assert.equal(checkout.totalAmountMinor, 22000);
    assert.equal(checkout.items.length, 2);

    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const deliveries = await prisma.delivery.findMany({
      where: { reservationId: reservation.id },
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]!.status, 'WAITING_FOR_DRIVER');

    const listed = await listMyReservations(learnerId);
    const detail = await getMyReservationById(learnerId, reservation.id);
    const listRow = listed.find((r) => r.id === reservation.id);
    assert.equal(listRow?.paymentSummary?.overallStatus, 'PAID');
    assert.equal(detail.paymentSummary?.overallStatus, 'PAID');
    assert.equal(listRow?.paymentSummary?.pickupCodeAvailable, false);
  });

  test('D: paid pickup then fee-only delivery — material not recharged', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 50,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const first = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05f-D1-${Date.now()}`,
    });
    await actOnMockCheckout({
      attemptId: first.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 18,
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryFee: 18,
        deliveryAddressText: '12 Learner Street',
        dropoffCity: 'Ramallah',
        totalAmount: 68,
        confirmedDeliveryWindowStart: new Date(Date.now() + 86_400_000),
        confirmedDeliveryWindowEnd: new Date(Date.now() + 93_600_000),
      },
    });
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(fee);

    const listed = await listMyReservations(learnerId);
    const listRow = listed.find((r) => r.id === reservation.id);
    assert.equal(listRow?.paymentSummary?.hasMaterialPaymentOutstanding, false);
    assert.equal(listRow?.paymentSummary?.hasDeliveryFeeOutstanding, true);
    assert.equal(listRow?.paymentSummary?.outstandingAmount, '18.00');
    assert.equal(listRow?.paymentSummary?.checkoutableOrderId, fee.id);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05f-D2-${Date.now()}`,
    });
    assert.equal(checkout.items.length, 1);
    assert.equal(checkout.items[0]!.purpose, 'DELIVERY_FEE');
    assert.equal(checkout.totalAmountMinor, 1800);

    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'success',
      actorUserId: learnerId,
    });

    const materialPaid = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
    });
    assert.equal(materialPaid.status, 'PAID');
    assert.equal(
      await prisma.paymentOrder.count({
        where: {
          reservationId: reservation.id,
          purpose: 'MATERIAL_SUBTOTAL',
          status: 'PAID',
        },
      }),
      1,
    );
  });

  test('E/F: zero-fee delivery and free-material+paid-fee', async () => {
    const freeFeeGroup = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 0,
    });
    const freeFeeRes = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 25,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 0,
      deliveryGroupId: freeFeeGroup.id,
    });
    const material = await ensureAndTrackMaterial(freeFeeRes.id);
    assert.ok(material);
    await prisma.paymentOrder.update({
      where: { id: material.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    const feeEnsure = await ensureDeliveryFeePaymentOrder(freeFeeGroup.id);
    assert.equal(feeEnsure.outcome, 'NOT_REQUIRED');

    const freeFeeDetail = await getMyReservationById(learnerId, freeFeeRes.id);
    assert.equal(freeFeeDetail.paymentSummary?.hasDeliveryFeeOutstanding, false);
    assert.notEqual(
      freeFeeDetail.paymentSummary?.overallStatus,
      'REQUIRES_PAYMENT',
    );

    const paidFeeGroup = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 22,
    });
    const freeMaterial = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 22,
      deliveryGroupId: paidFeeGroup.id,
    });
    const materialEnsure = await ensureMaterialPaymentOrder(freeMaterial.id);
    assert.equal(materialEnsure.outcome, 'NOT_REQUIRED');
    const fee = await ensureAndTrackFee(paidFeeGroup.id);
    assert.ok(fee);

    const checkout = await startReservationCheckout({
      reservationId: freeMaterial.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05f-F-${Date.now()}`,
    });
    assert.equal(checkout.items.length, 1);
    assert.equal(checkout.items[0]!.purpose, 'DELIVERY_FEE');
    assert.equal(checkout.totalAmountMinor, 2200);
  });

  test('H: shared group — joiner surfaces fee amount; fee order charged once', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 12,
    });
    const a = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 12,
      deliveryGroupId: group.id,
    });
    const b = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 10,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 0,
      deliveryGroupId: group.id,
    });
    const ma = await ensureAndTrackMaterial(a.id);
    const mb = await ensureAndTrackMaterial(b.id);
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(ma && mb && fee);

    await prisma.paymentOrder.update({
      where: { id: ma.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    await prisma.paymentOrder.update({
      where: { id: mb.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    const listed = await listMyReservations(learnerId);
    const members = listed.filter((r) => r.id === a.id || r.id === b.id);
    assert.equal(members.length, 2);
    for (const member of members) {
      assert.equal(member.paymentSummary?.outstandingAmount, '12.00');
      assert.equal(member.paymentSummary?.checkoutableOrderId, fee.id);
      assert.equal(member.paymentSummary?.hasDeliveryFeeOutstanding, true);
    }

    const feeOrders = await prisma.paymentOrder.findMany({
      where: { deliveryGroupId: group.id, purpose: 'DELIVERY_FEE' },
    });
    assert.equal(feeOrders.length, 1);
  });

  test('I: decline leaves list/details requiring payment; no Delivery', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 33,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const checkout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05f-I-${Date.now()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId!,
      action: 'decline',
      actorUserId: learnerId,
    });

    const paid = await prisma.paymentOrder.findUniqueOrThrow({
      where: { id: material.id },
    });
    assert.notEqual(paid.status, 'PAID');
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: reservation.id } }),
      0,
    );

    const listed = await listMyReservations(learnerId);
    const detail = await getMyReservationById(learnerId, reservation.id);
    const listRow = listed.find((r) => r.id === reservation.id);
    assert.equal(listRow?.paymentSummary?.overallStatus, 'REQUIRES_PAYMENT');
    assert.equal(detail.paymentSummary?.overallStatus, 'REQUIRES_PAYMENT');
    assert.ok(listRow?.paymentSummary?.checkoutableOrderId);
    assert.equal(
      listRow?.paymentSummary?.checkoutableOrderId,
      detail.paymentSummary?.checkoutableOrderId,
    );
  });

  test('J/K: pending preserves processing; already-paid checkout is NOTHING_TO_PAY', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 28,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    const pendingCheckout = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05f-J-pending-${Date.now()}`,
    });
    await actOnMockCheckout({
      attemptId: pendingCheckout.attemptId!,
      action: 'pending',
      actorUserId: learnerId,
    });

    const listedPending = await listMyReservations(learnerId);
    const pendingRow = listedPending.find((r) => r.id === reservation.id);
    assert.equal(pendingRow?.paymentSummary?.overallStatus, 'PROCESSING');

    // Force settle for the stale-notification already-paid path.
    await prisma.paymentOrder.update({
      where: { id: material.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: learnerId,
          idempotencyKey: `pay05f-K-${Date.now()}`,
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'NOTHING_TO_PAY',
    );

    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(detail.paymentSummary?.overallStatus, 'PAID');
    assert.equal(detail.paymentSummary?.checkoutableOrderId, null);
  });

  test('L: cancel before payment cancels checkoutable surface', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 19,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);

    await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay05f-L-${Date.now()}`,
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'CANCELLED' },
    });

    const listed = await listMyReservations(learnerId);
    const detail = await getMyReservationById(learnerId, reservation.id);
    const listRow = listed.find((r) => r.id === reservation.id);
    assert.ok(listRow?.paymentSummary);
    assert.ok(detail.paymentSummary);
    assert.equal(
      listRow.paymentSummary.checkoutableOrderId,
      detail.paymentSummary.checkoutableOrderId,
    );
    assert.equal(listRow.paymentSummary.checkoutableOrderId, null);
    assert.equal(listRow.paymentSummary.fulfillmentReady, false);
  });

  test('M: refund pending — no checkout CTA across list/details', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 44,
    });
    const material = await ensureAndTrackMaterial(reservation.id);
    assert.ok(material);
    await prisma.paymentOrder.update({
      where: { id: material.id },
      data: { status: 'REFUND_PENDING', paidAt: new Date() },
    });

    const listed = await listMyReservations(learnerId);
    const detail = await getMyReservationById(learnerId, reservation.id);
    const listRow = listed.find((r) => r.id === reservation.id);
    assert.equal(listRow?.paymentSummary?.overallStatus, 'REFUND_PENDING');
    assert.equal(detail.paymentSummary?.overallStatus, 'REFUND_PENDING');
    assert.equal(listRow?.paymentSummary?.checkoutableOrderId, null);
    assert.equal(detail.paymentSummary?.checkoutableOrderId, null);
  });

  test('N/O: delivery gating + pickup code consistency on details', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 15,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 60,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 15,
      deliveryGroupId: group.id,
      pickupWindowStart: new Date(Date.now() - 30 * 60_000),
      pickupWindowEnd: new Date(Date.now() + 3_600_000),
    });
    await ensureAndTrackMaterial(reservation.id);
    await ensureAndTrackFee(group.id);

    const requirement = await getReservationPaymentRequirement(reservation.id, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(requirement.paymentReady, false);
    assert.equal(requirement.deliveryExists, false);
    assert.equal(requirement.deliveryDispatchable, false);

    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(detail.paymentSummary?.pickupCodeAvailable, false);
    assert.equal(detail.selfPickupCode, null);
    assert.equal(detail.fulfillmentMethod, 'DELIVERY');
  });

  test('P: action truth fields — paid pickup vs unpaid delivery fee', async () => {
    const paidPickup = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 21,
      pickupWindowStart: new Date(Date.now() - 30 * 60_000),
      pickupWindowEnd: new Date(Date.now() + 3_600_000),
    });
    const material = await ensureAndTrackMaterial(paidPickup.id);
    assert.ok(material);
    await prisma.paymentOrder.update({
      where: { id: material.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 9,
    });
    const unpaidDelivery = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 21,
      fulfillmentMethod: 'DELIVERY',
      deliveryFee: 9,
      deliveryGroupId: group.id,
    });
    const unpaidMaterial = await ensureAndTrackMaterial(unpaidDelivery.id);
    assert.ok(unpaidMaterial);
    await prisma.paymentOrder.update({
      where: { id: unpaidMaterial.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    const fee = await ensureAndTrackFee(group.id);
    assert.ok(fee);

    const summaries = await resolvePaymentSummariesByReservations([
      {
        id: paidPickup.id,
        status: 'ACCEPTED',
        fulfillmentMethod: 'PICKUP',
        materialSubtotal: 21,
        deliveryFee: 0,
        pricingCurrency: 'NIS',
        deliveryGroupId: null,
        deliveryStatus: null,
        assignedDriverProfileId: null,
        pickupWindowStart: new Date(Date.now() - 30 * 60_000),
        pickupWindowEnd: new Date(Date.now() + 3_600_000),
      },
      {
        id: unpaidDelivery.id,
        status: 'ACCEPTED',
        fulfillmentMethod: 'DELIVERY',
        materialSubtotal: 21,
        deliveryFee: 9,
        pricingCurrency: 'NIS',
        deliveryGroupId: group.id,
        deliveryStatus: null,
        assignedDriverProfileId: null,
        pickupWindowStart: null,
        pickupWindowEnd: null,
      },
    ]);

    const pickup = summaries.get(paidPickup.id)!;
    assert.equal(pickup.overallStatus, 'PAID');
    assert.equal(pickup.checkoutableOrderId, null);
    assert.equal(pickup.pickupCodeAvailable, true);

    const delivery = summaries.get(unpaidDelivery.id)!;
    assert.equal(delivery.overallStatus, 'REQUIRES_PAYMENT');
    assert.equal(delivery.checkoutableOrderId, fee.id);
    assert.equal(delivery.hasDeliveryFeeOutstanding, true);
    assert.equal(delivery.pickupCodeAvailable, false);
    assert.equal(delivery.deliveryDispatchable, false);
  });

  test('Q: authorization — other learner cannot checkout or read details', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 17,
    });
    await ensureAndTrackMaterial(reservation.id);

    await assert.rejects(
      () =>
        startReservationCheckout({
          reservationId: reservation.id,
          payerUserId: otherLearnerId,
          idempotencyKey: `pay05f-Q-${Date.now()}`,
        }),
      (error: unknown) => error instanceof AppError,
    );

    await assert.rejects(
      () => getMyReservationById(otherLearnerId, reservation.id),
      (error: unknown) => error instanceof AppError,
    );

    await assert.rejects(
      () =>
        getReservationPaymentRequirement(reservation.id, {
          userId: otherLearnerId,
          roles: ['LEARNER'],
        }),
      (error: unknown) => error instanceof AppError,
    );
  });
});
