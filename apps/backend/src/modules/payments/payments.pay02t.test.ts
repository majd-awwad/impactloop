import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';

import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';

import {
  createReservation,
  getMyReservationById,
  requestLearnerPickupReschedule,
  resolveLearnerConfirmation,
} from '../reservations/reservations.service.js';
import {
  acceptLearnerRescheduleProposal,
  acceptSupplierReservation,
  submitNoDriverPickupWindow,
} from '../supplier-reservations/supplier-reservations.service.js';
import { NO_DRIVER_SUPPLIER_RECONFIRM_REASON } from '../reservations/reservation-timing-policy.js';
import { createOperationalDelivery } from '../delivery-groups/delivery-group-operations.service.js';

import { setObligationCreationFailureForTests } from './payments.acceptance.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import {
  actOnMockCheckout,
  startPaymentCheckout,
} from './payments.service.js';
import {
  cleanupPayTest,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

const MARKER = '[pay02t-test]';

function futureWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

describe('PAY-02T final-ACCEPTED production-path payment coverage', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay02t-l' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay02t-s' })
    ).id;
  });

  after(async () => {
    if (ids.reservations.length) {
      await prisma.noShowReport.deleteMany({
        where: { reservationId: { in: ids.reservations } },
      });
    }
    await cleanupPayTest(ids);
  });

  beforeEach(() => {
    setElectronicPaymentEnforcementForTests(true);
  });

  afterEach(() => {
    setElectronicPaymentEnforcementForTests(undefined);
    setObligationCreationFailureForTests(undefined);
  });

  async function payOrder(orderId: string) {
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay02t-${orderId}-${Date.now()}-${Math.random()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
    trackOrder(ids, orderId);
  }

  async function trackOrdersForReservation(reservationId: string) {
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: { deliveryGroupId: true },
    });
    if (reservation.deliveryGroupId) {
      if (!ids.groups.includes(reservation.deliveryGroupId)) {
        ids.groups.push(reservation.deliveryGroupId);
      }
    }
    const orders = await prisma.paymentOrder.findMany({
      where: {
        OR: [
          { reservationId },
          ...(reservation.deliveryGroupId
            ? [{ deliveryGroupId: reservation.deliveryGroupId }]
            : []),
        ],
      },
      select: { id: true },
    });
    for (const order of orders) {
      trackOrder(ids, order.id);
    }
    return orders;
  }

  async function createMaterial(input: {
    price?: number | null;
    isFree?: boolean;
    deliveryAllowed?: boolean;
    quantity?: number;
    city?: string;
  }) {
    const category = await prisma.category.create({
      data: {
        nameEn: `${MARKER} cat ${Date.now()}-${Math.random()}`,
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
        city: input.city ?? 'Nablus',
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

    const isFree =
      input.isFree ?? (input.price == null || input.price === 0);
    const material = await prisma.material.create({
      data: {
        ownerId: supplierId,
        supplierProfileId: supplierProfile.id,
        categoryId: category.id,
        locationId: location.id,
        title: `${MARKER} material`,
        description: MARKER,
        materialType: 'Test',
        quantity: input.quantity ?? 10,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree,
        price: isFree ? null : input.price,
        deliveryAllowed: input.deliveryAllowed ?? false,
      },
      select: { id: true },
    });
    ids.materials.push(material.id);
    return material;
  }

  async function trackCreatedReservation(reservationId: string) {
    if (!ids.reservations.includes(reservationId)) {
      ids.reservations.push(reservationId);
    }
  }

  async function assertMaterialOrder(input: {
    reservationId: string;
    amount: string;
    currency?: string;
    cycleNumber?: number;
  }) {
    const orders = await prisma.paymentOrder.findMany({
      where: {
        reservationId: input.reservationId,
        purpose: 'MATERIAL_SUBTOTAL',
      },
    });
    assert.equal(orders.length, 1);
    const order = orders[0]!;
    assert.equal(order.status, 'REQUIRES_PAYMENT');
    assert.equal(order.amount.toString(), input.amount);
    assert.equal(order.currency, input.currency ?? 'NIS');
    assert.equal(order.cycleNumber, input.cycleNumber ?? 1);
    trackOrder(ids, order.id);
    return order;
  }

  async function assertNoMaterialOrder(reservationId: string) {
    const count = await prisma.paymentOrder.count({
      where: { reservationId, purpose: 'MATERIAL_SUBTOTAL' },
    });
    assert.equal(count, 0);
  }

  async function assertNoDelivery(reservationId: string) {
    const count = await prisma.delivery.count({ where: { reservationId } });
    assert.equal(count, 0);
  }

  function deliveryAcceptWindows() {
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(
      supplierPickupStart.getTime() + 2 * 3_600_000,
    );
    const earliestDelivery = new Date(
      supplierPickupEnd.getTime() + 60 * 60_000,
    );
    const learnerDeliveryEnd = new Date(
      earliestDelivery.getTime() + 3 * 3_600_000,
    );
    return {
      supplierPickupStart,
      supplierPickupEnd,
      learnerDeliveryStart: earliestDelivery,
      learnerDeliveryEnd,
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Supplier immediate pickup (no preferred windows)
  // ---------------------------------------------------------------------------

  test('1a: supplier immediate pickup (no preferred) creates material order and gates code/Delivery', async () => {
    const material = await createMaterial({ price: 28 });
    const window = futureWindow(30);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
    });
    await trackCreatedReservation(created.id);

    const accepted = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: window.start,
      pickupWindowEnd: window.end,
    });
    assert.equal(accepted.status, 'ACCEPTED');

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(reservation.status, 'ACCEPTED');
    assert.equal(reservation.materialSubtotal?.toString(), '28');

    await assertMaterialOrder({
      reservationId: created.id,
      amount: reservation.materialSubtotal!.toString(),
      currency: reservation.pricingCurrency ?? 'NIS',
    });
    await assertNoDelivery(created.id);

    const mapped = await getMyReservationById(learnerId, created.id);
    assert.equal(mapped.selfPickupCode, null);
    assert.notEqual(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', created.id),
    );

    await assert.rejects(
      () =>
        acceptSupplierReservation(supplierId, created.id, {
          pickupWindowStart: window.start,
          pickupWindowEnd: window.end,
        }),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 409,
    );

    const orderCount = await prisma.paymentOrder.count({
      where: { reservationId: created.id, purpose: 'MATERIAL_SUBTOTAL' },
    });
    assert.equal(orderCount, 1);
  });

  test('1b: supplier immediate pickup zero subtotal creates no PaymentOrder and exposes code', async () => {
    const material = await createMaterial({ isFree: true });
    const window = futureWindow(31);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
    });
    await trackCreatedReservation(created.id);

    const accepted = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: window.start,
      pickupWindowEnd: window.end,
    });
    assert.equal(accepted.status, 'ACCEPTED');
    await assertNoMaterialOrder(created.id);
    await assertNoDelivery(created.id);

    const mapped = await getMyReservationById(learnerId, created.id);
    assert.equal(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', created.id),
    );
  });

  // ---------------------------------------------------------------------------
  // 2. Supplier accepts learner-selected preferred pickup window
  // ---------------------------------------------------------------------------

  test('2: supplier accepts selected preferred pickup window under enforcement', async () => {
    const material = await createMaterial({ price: 33 });
    const preferred = futureWindow(32);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    });
    await trackCreatedReservation(created.id);

    const accepted = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
      selectedPreferredWindowIndex: 0,
    });
    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(accepted.pickupWindowStart, preferred.start);

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    await assertMaterialOrder({
      reservationId: created.id,
      amount: reservation.materialSubtotal!.toString(),
    });
    await assertNoDelivery(created.id);

    const mapped = await getMyReservationById(learnerId, created.id);
    assert.equal(mapped.selfPickupCode, null);
  });

  // ---------------------------------------------------------------------------
  // 3. Supplier accepts matching preferred pickup proposal
  // ---------------------------------------------------------------------------

  test('3: supplier matching preferred pickup proposal creates single material order', async () => {
    const material = await createMaterial({ price: 41 });
    const preferred = futureWindow(33);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    });
    await trackCreatedReservation(created.id);

    // Same window as preference, without selectedPreferredWindowIndex → matching path.
    const accepted = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
    });
    assert.equal(accepted.status, 'ACCEPTED');

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    await assertMaterialOrder({
      reservationId: created.id,
      amount: reservation.materialSubtotal!.toString(),
    });

    await assert.rejects(
      () =>
        acceptSupplierReservation(supplierId, created.id, {
          pickupWindowStart: preferred.start,
          pickupWindowEnd: preferred.end,
        }),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 409,
    );
    assert.equal(
      await prisma.paymentOrder.count({
        where: { reservationId: created.id, purpose: 'MATERIAL_SUBTOTAL' },
      }),
      1,
    );
  });

  // ---------------------------------------------------------------------------
  // 4. Learner accepts supplier pickup proposal
  // ---------------------------------------------------------------------------

  test('4: learner ACCEPT_PROPOSED_PICKUP creates material order atomically and hides code', async () => {
    const material = await createMaterial({ price: 19 });
    const preferred = futureWindow(34);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    });
    await trackCreatedReservation(created.id);

    const mismatch = futureWindow(48);
    const proposed = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: mismatch.start,
      pickupWindowEnd: mismatch.end,
    });
    assert.equal(proposed.status, 'AWAITING_LEARNER_CONFIRMATION');
    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: created.id } }),
      0,
    );

    const confirmed = await resolveLearnerConfirmation(learnerId, created.id, {
      action: 'ACCEPT_PROPOSED_PICKUP',
    });
    assert.equal(confirmed.status, 'ACCEPTED');

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(reservation.status, 'ACCEPTED');
    await assertMaterialOrder({
      reservationId: created.id,
      amount: reservation.materialSubtotal!.toString(),
    });
    await assertNoDelivery(created.id);

    const mapped = await getMyReservationById(learnerId, created.id);
    assert.equal(mapped.selfPickupCode, null);

    const history = await prisma.reservationStatusHistory.findFirst({
      where: {
        reservationId: created.id,
        oldStatus: 'AWAITING_LEARNER_CONFIRMATION',
        newStatus: 'ACCEPTED',
      },
    });
    assert.ok(history);
  });

  // ---------------------------------------------------------------------------
  // 5. Supplier accepts delivery with final confirmed windows
  // ---------------------------------------------------------------------------

  test('5a: supplier delivery accept creates material+fee orders; pay-both creates one Delivery', async () => {
    const material = await createMaterial({
      price: 50,
      deliveryAllowed: true,
    });
    const windows = deliveryAcceptWindows();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '12 Learner Street, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: [
        {
          start: windows.learnerDeliveryStart.toISOString(),
          end: windows.learnerDeliveryEnd.toISOString(),
        },
      ],
    });
    await trackCreatedReservation(created.id);

    const accepted = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: windows.supplierPickupStart.toISOString(),
      pickupWindowEnd: windows.supplierPickupEnd.toISOString(),
    });
    assert.equal(accepted.status, 'ACCEPTED');
    await assertNoDelivery(created.id);

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.ok(reservation.deliveryGroupId);
    ids.groups.push(reservation.deliveryGroupId!);

    const materialOrder = await assertMaterialOrder({
      reservationId: created.id,
      amount: reservation.materialSubtotal!.toString(),
    });

    const feeOrders = await prisma.paymentOrder.findMany({
      where: {
        deliveryGroupId: reservation.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(feeOrders.length, 1);
    const feeOrder = feeOrders[0]!;
    trackOrder(ids, feeOrder.id);

    const group = await prisma.deliveryGroup.findUniqueOrThrow({
      where: { id: reservation.deliveryGroupId! },
    });
    assert.equal(feeOrder.amount.toString(), group.deliveryFee.toString());
    assert.equal(feeOrder.currency, group.currency);
    assert.equal(feeOrder.cycleNumber, 1);
    assert.ok(Number(feeOrder.amount) > 0);

    // Paying only material remains insufficient.
    await payOrder(materialOrder.id);
    assert.equal(await prisma.delivery.count({ where: { reservationId: created.id } }), 0);

    await payOrder(feeOrder.id);
    const deliveries = await prisma.delivery.findMany({
      where: { reservationId: created.id },
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]!.status, 'WAITING_FOR_DRIVER');
  });

  test('5b: supplier delivery accept free material still creates fee order only', async () => {
    const material = await createMaterial({
      isFree: true,
      deliveryAllowed: true,
    });
    const windows = deliveryAcceptWindows();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '14 Free Street, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: [
        {
          start: windows.learnerDeliveryStart.toISOString(),
          end: windows.learnerDeliveryEnd.toISOString(),
        },
      ],
    });
    await trackCreatedReservation(created.id);

    const accepted = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: windows.supplierPickupStart.toISOString(),
      pickupWindowEnd: windows.supplierPickupEnd.toISOString(),
    });
    assert.equal(accepted.status, 'ACCEPTED');
    await assertNoMaterialOrder(created.id);
    await assertNoDelivery(created.id);

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.ok(reservation.deliveryGroupId);
    ids.groups.push(reservation.deliveryGroupId!);
    await trackOrdersForReservation(created.id);

    const feeCount = await prisma.paymentOrder.count({
      where: {
        deliveryGroupId: reservation.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(feeCount, 1);
  });

  // ---------------------------------------------------------------------------
  // 6. Learner submits final delivery window
  // ---------------------------------------------------------------------------

  test('6: learner SUBMIT_DELIVERY_WINDOW creates/reuses obligations and defers Delivery', async () => {
    const material = await createMaterial({
      price: 22,
      deliveryAllowed: true,
    });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(
      supplierPickupStart.getTime() + 2 * 3_600_000,
    );
    const earliestDelivery = new Date(
      supplierPickupEnd.getTime() + 60 * 60_000,
    );
    // Infeasible learner preference → AWAITING_LEARNER_CONFIRMATION
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '22 Confirm Street, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: [
        {
          start: new Date(earliestDelivery.getTime() - 3 * 3_600_000).toISOString(),
          end: new Date(earliestDelivery.getTime() - 30 * 60_000).toISOString(),
        },
      ],
    });
    await trackCreatedReservation(created.id);

    const proposed = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
    });
    assert.equal(proposed.status, 'AWAITING_LEARNER_CONFIRMATION');

    const confirmed = await resolveLearnerConfirmation(learnerId, created.id, {
      action: 'SUBMIT_DELIVERY_WINDOW',
      deliveryWindow: {
        start: earliestDelivery.toISOString(),
        end: new Date(earliestDelivery.getTime() + 3 * 3_600_000).toISOString(),
      },
    });
    assert.equal(confirmed.status, 'ACCEPTED');
    await assertNoDelivery(created.id);

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.ok(reservation.deliveryGroupId);
    ids.groups.push(reservation.deliveryGroupId!);

    await assertMaterialOrder({
      reservationId: created.id,
      amount: reservation.materialSubtotal!.toString(),
    });
    const feeOrders = await prisma.paymentOrder.findMany({
      where: {
        deliveryGroupId: reservation.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(feeOrders.length, 1);
    trackOrder(ids, feeOrders[0]!.id);

    // Idempotent: second confirmation fails; orders stay singular.
    await assert.rejects(
      () =>
        resolveLearnerConfirmation(learnerId, created.id, {
          action: 'SUBMIT_DELIVERY_WINDOW',
          deliveryWindow: {
            start: earliestDelivery.toISOString(),
            end: new Date(earliestDelivery.getTime() + 3 * 3_600_000).toISOString(),
          },
        }),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 409,
    );
    assert.equal(
      await prisma.paymentOrder.count({
        where: {
          OR: [
            { reservationId: created.id },
            { deliveryGroupId: reservation.deliveryGroupId! },
          ],
        },
      }),
      2,
    );
  });

  // ---------------------------------------------------------------------------
  // 7. Supplier accepts learner reschedule proposal (nonterminal cycle)
  // ---------------------------------------------------------------------------

  test('7: acceptLearnerRescheduleProposal reuses nonterminal material order; no Delivery for pickup', async () => {
    const material = await createMaterial({ price: 17 });
    const preferred = futureWindow(35);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [preferred],
    });
    await trackCreatedReservation(created.id);

    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
      selectedPreferredWindowIndex: 0,
    });
    const firstOrder = await assertMaterialOrder({
      reservationId: created.id,
      amount: '17',
    });

    const rescheduleWindow = futureWindow(60);
    await requestLearnerPickupReschedule(learnerId, created.id, {
      pickupWindowStart: rescheduleWindow.start,
      pickupWindowEnd: rescheduleWindow.end,
      reason: 'Schedule conflict',
    });

    const awaiting = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(awaiting.status, 'AWAITING_SUPPLIER_CONFIRMATION');

    const accepted = await acceptLearnerRescheduleProposal(
      supplierId,
      created.id,
    );
    assert.equal(accepted.status, 'ACCEPTED');

    const orders = await prisma.paymentOrder.findMany({
      where: { reservationId: created.id, purpose: 'MATERIAL_SUBTOTAL' },
    });
    assert.equal(orders.length, 1);
    assert.equal(orders[0]!.id, firstOrder.id);
    assert.equal(orders[0]!.status, 'REQUIRES_PAYMENT');
    assert.equal(orders[0]!.cycleNumber, 1);
    await assertNoDelivery(created.id);

    // Deferred PAY-03: terminal CANCELLED/REFUNDED cycle-2 reopen not covered here.
  });

  // ---------------------------------------------------------------------------
  // 8. No-driver recovery (grouped)
  // ---------------------------------------------------------------------------

  test('8a: no-driver grouped recovery defers Delivery reopen until obligations paid', async () => {
    const material = await createMaterial({
      price: 15,
      deliveryAllowed: true,
    });
    const windows = deliveryAcceptWindows();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '8 Recovery Road, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: [
        {
          start: windows.learnerDeliveryStart.toISOString(),
          end: windows.learnerDeliveryEnd.toISOString(),
        },
      ],
    });
    await trackCreatedReservation(created.id);

    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: windows.supplierPickupStart.toISOString(),
      pickupWindowEnd: windows.supplierPickupEnd.toISOString(),
    });

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
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
    assert.ok(reservation.deliveryGroupId);
    ids.groups.push(reservation.deliveryGroupId!);
    await trackOrdersForReservation(created.id);

    let deliveryId = '';
    await prisma.$transaction(async (tx) => {
      const delivery = await createOperationalDelivery(tx, {
        reservationId: created.id,
        deliveryGroupId: reservation.deliveryGroupId!,
        requesterId: learnerId,
        changedByUserId: supplierId,
        materialLocation: reservation.material.location,
        deliveryAddressText: reservation.deliveryAddressText!,
        dropoffCity: reservation.dropoffCity!,
        statusHistoryNote: 'pay02t no-driver fixture',
      });
      deliveryId = delivery.id;
      await tx.delivery.update({
        where: { id: delivery.id },
        data: { status: 'AWAITING_RESOLUTION' },
      });
      await tx.deliveryGroup.update({
        where: { id: reservation.deliveryGroupId! },
        data: { status: 'CANCELLED' },
      });
      await tx.reservation.update({
        where: { id: created.id },
        data: {
          status: 'AWAITING_SUPPLIER_CONFIRMATION',
          pendingRescheduleReason: NO_DRIVER_SUPPLIER_RECONFIRM_REASON,
          pendingRescheduleRequestedBy: 'SUPPLIER',
        },
      });
    });

    await prisma.noShowReport.create({
      data: {
        reservationId: created.id,
        deliveryId,
        targetRole: 'SYSTEM',
        reasonCode: 'NO_DRIVER_AVAILABLE',
        status: 'PENDING_REVIEW',
        reporterUserId: supplierId,
      },
    });

    const replacement = futureWindow(72);
    await submitNoDriverPickupWindow(supplierId, created.id, {
      pickupWindowStart: replacement.start,
      pickupWindowEnd: replacement.end,
      supplierNote: 'Ready after no-driver recovery',
    });

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(after.status, 'ACCEPTED');

    const materialOrders = await prisma.paymentOrder.findMany({
      where: { reservationId: created.id, purpose: 'MATERIAL_SUBTOTAL' },
    });
    const feeOrders = await prisma.paymentOrder.findMany({
      where: {
        deliveryGroupId: reservation.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(materialOrders.length, 1);
    assert.equal(feeOrders.length, 1);
    trackOrder(ids, materialOrders[0]!.id);
    trackOrder(ids, feeOrders[0]!.id);

    const deliveryBeforePay = await prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    assert.equal(deliveryBeforePay.status, 'AWAITING_RESOLUTION');

    const reportBeforePay = await prisma.noShowReport.findFirstOrThrow({
      where: { deliveryId, reasonCode: 'NO_DRIVER_AVAILABLE' },
    });
    assert.equal(reportBeforePay.status, 'PENDING_REVIEW');

    await payOrder(materialOrders[0]!.id);
    await payOrder(feeOrders[0]!.id);

    const deliveryAfterPay = await prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    assert.equal(deliveryAfterPay.status, 'WAITING_FOR_DRIVER');
    assert.equal(
      await prisma.delivery.count({
        where: { deliveryGroupId: reservation.deliveryGroupId! },
      }),
      1,
    );
  });

  test('8b: no-driver ungrouped recovery gates on material payment', async () => {
    const material = await createMaterial({
      price: 12,
      deliveryAllowed: true,
    });
    const windows = deliveryAcceptWindows();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '9 Ungrouped Ave, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: [
        {
          start: windows.learnerDeliveryStart.toISOString(),
          end: windows.learnerDeliveryEnd.toISOString(),
        },
      ],
    });
    await trackCreatedReservation(created.id);

    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: windows.supplierPickupStart.toISOString(),
      pickupWindowEnd: windows.supplierPickupEnd.toISOString(),
    });

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
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
    assert.ok(reservation.deliveryGroupId);
    ids.groups.push(reservation.deliveryGroupId!);
    await trackOrdersForReservation(created.id);

    // Detach group association to exercise ungrouped recovery branch.
    let deliveryId = '';
    await prisma.$transaction(async (tx) => {
      const delivery = await createOperationalDelivery(tx, {
        reservationId: created.id,
        deliveryGroupId: reservation.deliveryGroupId!,
        requesterId: learnerId,
        changedByUserId: supplierId,
        materialLocation: reservation.material.location,
        deliveryAddressText: reservation.deliveryAddressText!,
        dropoffCity: reservation.dropoffCity!,
        statusHistoryNote: 'pay02t ungrouped recovery fixture',
      });
      deliveryId = delivery.id;
      await tx.delivery.update({
        where: { id: delivery.id },
        data: {
          status: 'AWAITING_RESOLUTION',
          deliveryGroupId: null,
        },
      });
      await tx.reservation.update({
        where: { id: created.id },
        data: {
          status: 'AWAITING_SUPPLIER_CONFIRMATION',
          deliveryGroupId: null,
          pendingRescheduleReason: NO_DRIVER_SUPPLIER_RECONFIRM_REASON,
          pendingRescheduleRequestedBy: 'SUPPLIER',
        },
      });
    });

    const replacement = futureWindow(74);
    await submitNoDriverPickupWindow(supplierId, created.id, {
      pickupWindowStart: replacement.start,
      pickupWindowEnd: replacement.end,
    });

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(after.status, 'ACCEPTED');

    const deliveryBeforePay = await prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    assert.equal(deliveryBeforePay.status, 'AWAITING_RESOLUTION');

    const materialOrder = await prisma.paymentOrder.findFirstOrThrow({
      where: { reservationId: created.id, purpose: 'MATERIAL_SUBTOTAL' },
    });
    trackOrder(ids, materialOrder.id);
    await payOrder(materialOrder.id);

    const deliveryAfterPay = await prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    assert.equal(deliveryAfterPay.status, 'WAITING_FOR_DRIVER');
  });

  // ---------------------------------------------------------------------------
  // 9. Partial-pickup replacement recovery
  // ---------------------------------------------------------------------------

  test('9a: partial-pickup replacement creates new group + fee order; defers Delivery', async () => {
    const material = await createMaterial({
      price: 25,
      deliveryAllowed: true,
    });
    const windows = deliveryAcceptWindows();
    const preferredWindows = [
      {
        start: windows.learnerDeliveryStart.toISOString(),
        end: windows.learnerDeliveryEnd.toISOString(),
      },
    ];
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '25 Partial Lane, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: preferredWindows,
    });
    await trackCreatedReservation(created.id);

    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: windows.supplierPickupStart.toISOString(),
      pickupWindowEnd: windows.supplierPickupEnd.toISOString(),
    });
    await trackOrdersForReservation(created.id);

    const beforeDetach = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    const oldGroupId = beforeDetach.deliveryGroupId;
    assert.ok(oldGroupId);
    ids.groups.push(oldGroupId!);

    await prisma.reservation.update({
      where: { id: created.id },
      data: {
        status: 'AWAITING_SUPPLIER_CONFIRMATION',
        deliveryGroupId: null,
        pendingRescheduleReason: 'DRIVER_PARTIAL_PICKUP_MATERIAL_NOT_READY',
        pendingRescheduleRequestedBy: 'SUPPLIER',
        pendingRescheduleNote: 'Item not ready',
        learnerPreferredDeliveryWindows: preferredWindows,
      },
    });

    const replacement = futureWindow(80);
    await submitNoDriverPickupWindow(supplierId, created.id, {
      pickupWindowStart: replacement.start,
      pickupWindowEnd: replacement.end,
      supplierNote: 'Replacement ready',
    });

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(after.status, 'ACCEPTED');
    assert.ok(after.deliveryGroupId);
    assert.notEqual(after.deliveryGroupId, oldGroupId);
    ids.groups.push(after.deliveryGroupId!);

    await assertMaterialOrder({
      reservationId: created.id,
      amount: after.materialSubtotal!.toString(),
    });

    const feeOrders = await prisma.paymentOrder.findMany({
      where: {
        deliveryGroupId: after.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(feeOrders.length, 1);
    assert.ok(Number(feeOrders[0]!.amount) > 0);
    trackOrder(ids, feeOrders[0]!.id);

    assert.equal(
      await prisma.delivery.count({
        where: { deliveryGroupId: after.deliveryGroupId! },
      }),
      0,
    );

    await payOrder(
      (
        await prisma.paymentOrder.findFirstOrThrow({
          where: { reservationId: created.id, purpose: 'MATERIAL_SUBTOTAL' },
        })
      ).id,
    );
    await payOrder(feeOrders[0]!.id);

    assert.equal(
      await prisma.delivery.count({
        where: { deliveryGroupId: after.deliveryGroupId! },
      }),
      1,
    );
  });

  test('9b: partial-pickup replacement joins existing group and reuses fee order', async () => {
    const preferred = deliveryAcceptWindows();
    const preferredWindows = [
      {
        start: preferred.learnerDeliveryStart.toISOString(),
        end: preferred.learnerDeliveryEnd.toISOString(),
      },
    ];

    const materialA = await createMaterial({
      price: 11,
      deliveryAllowed: true,
      quantity: 5,
    });
    const materialB = await createMaterial({
      price: 13,
      deliveryAllowed: true,
      quantity: 5,
    });

    const first = await createReservation(learnerId, {
      materialId: materialA.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '11 Join Street, Nablus',
      dropoffCity: 'Nablus',
      dropoffArea: 'Center',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: preferredWindows,
    });
    await trackCreatedReservation(first.id);

    await acceptSupplierReservation(supplierId, first.id, {
      pickupWindowStart: preferred.supplierPickupStart.toISOString(),
      pickupWindowEnd: preferred.supplierPickupEnd.toISOString(),
    });
    const firstRow = await prisma.reservation.findUniqueOrThrow({
      where: { id: first.id },
    });
    assert.ok(firstRow.deliveryGroupId);
    ids.groups.push(firstRow.deliveryGroupId!);
    await trackOrdersForReservation(first.id);

    const feeBefore = await prisma.paymentOrder.findMany({
      where: {
        deliveryGroupId: firstRow.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(feeBefore.length, 1);
    trackOrder(ids, feeBefore[0]!.id);

    const second = await createReservation(learnerId, {
      materialId: materialB.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '11 Join Street, Nablus',
      dropoffCity: 'Nablus',
      dropoffArea: 'Center',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: preferredWindows,
    });
    await trackCreatedReservation(second.id);

    // Put second into partial-pickup recovery without prior group assignment.
    await prisma.reservation.update({
      where: { id: second.id },
      data: {
        status: 'AWAITING_SUPPLIER_CONFIRMATION',
        deliveryGroupId: null,
        pendingRescheduleReason: 'DRIVER_PARTIAL_PICKUP_MATERIAL_MISSING',
        pendingRescheduleRequestedBy: 'SUPPLIER',
        materialSubtotal: new Prisma.Decimal(13),
        deliveryFee: firstRow.deliveryFee,
        pricingCurrency: firstRow.pricingCurrency,
        deliveryZone: firstRow.deliveryZone,
        totalAmount: new Prisma.Decimal(13).add(firstRow.deliveryFee ?? 0),
        unitPriceAtReservation: new Prisma.Decimal(13),
        acceptedAt: new Date(),
        learnerPreferredDeliveryWindows: preferredWindows,
      },
    });

    const replacement = futureWindow(82);
    await submitNoDriverPickupWindow(supplierId, second.id, {
      pickupWindowStart: replacement.start,
      pickupWindowEnd: replacement.end,
    });

    const secondAfter = await prisma.reservation.findUniqueOrThrow({
      where: { id: second.id },
    });
    assert.equal(secondAfter.status, 'ACCEPTED');
    assert.equal(secondAfter.deliveryGroupId, firstRow.deliveryGroupId);

    const feeAfter = await prisma.paymentOrder.findMany({
      where: {
        deliveryGroupId: firstRow.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(feeAfter.length, 1);
    assert.equal(feeAfter[0]!.id, feeBefore[0]!.id);

    await assertMaterialOrder({
      reservationId: second.id,
      amount: '13',
    });
    assert.equal(
      await prisma.delivery.count({
        where: { deliveryGroupId: firstRow.deliveryGroupId! },
      }),
      0,
    );
  });

  test('9c: partial-pickup replacement with zero delivery fee creates no fee order', async () => {
    const material = await createMaterial({
      price: 8,
      deliveryAllowed: true,
    });
    const preferredWindows = [
      {
        start: futureWindow(90).start,
        end: futureWindow(90).end,
      },
    ];
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '8 Zero Fee, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: preferredWindows,
    });
    await trackCreatedReservation(created.id);

    // Skip normal accept; stage recovery with zero fee snapshot.
    await prisma.reservation.update({
      where: { id: created.id },
      data: {
        status: 'AWAITING_SUPPLIER_CONFIRMATION',
        deliveryGroupId: null,
        pendingRescheduleReason: 'DRIVER_PARTIAL_PICKUP_WRONG_ITEM',
        pendingRescheduleRequestedBy: 'SUPPLIER',
        materialSubtotal: new Prisma.Decimal(8),
        deliveryFee: new Prisma.Decimal(0),
        totalAmount: new Prisma.Decimal(8),
        pricingCurrency: 'NIS',
        deliveryZone: 'SAME_CITY',
        unitPriceAtReservation: new Prisma.Decimal(8),
        acceptedAt: new Date(),
        learnerPreferredDeliveryWindows: preferredWindows,
      },
    });

    const replacement = futureWindow(91);
    await submitNoDriverPickupWindow(supplierId, created.id, {
      pickupWindowStart: replacement.start,
      pickupWindowEnd: replacement.end,
    });

    const after = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(after.status, 'ACCEPTED');
    assert.ok(after.deliveryGroupId);
    ids.groups.push(after.deliveryGroupId!);

    await assertMaterialOrder({ reservationId: created.id, amount: '8' });
    assert.equal(
      await prisma.paymentOrder.count({
        where: {
          deliveryGroupId: after.deliveryGroupId!,
          purpose: 'DELIVERY_FEE',
        },
      }),
      0,
    );
    assert.equal(
      await prisma.delivery.count({
        where: { deliveryGroupId: after.deliveryGroupId! },
      }),
      0,
    );
  });

  // ---------------------------------------------------------------------------
  // Transaction rollback
  // ---------------------------------------------------------------------------

  test('rollback: pickup accept rolls back when obligation creation fails', async () => {
    setObligationCreationFailureForTests(
      new Error('PAY02T forced material obligation failure'),
    );

    const material = await createMaterial({ price: 99 });
    const window = futureWindow(36);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
    });
    await trackCreatedReservation(created.id);

    await assert.rejects(
      () =>
        acceptSupplierReservation(supplierId, created.id, {
          pickupWindowStart: window.start,
          pickupWindowEnd: window.end,
        }),
      /PAY02T forced material obligation failure/,
    );

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(reservation.status, 'PENDING');
    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: created.id } }),
      0,
    );
    await assertNoDelivery(created.id);

    const history = await prisma.reservationStatusHistory.count({
      where: { reservationId: created.id, newStatus: 'ACCEPTED' },
    });
    assert.equal(history, 0);
  });

  test('rollback: delivery accept rolls back when obligation creation fails', async () => {
    setObligationCreationFailureForTests(
      new Error('PAY02T forced delivery obligation failure'),
    );

    const material = await createMaterial({
      price: 77,
      deliveryAllowed: true,
    });
    const windows = deliveryAcceptWindows();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '77 Rollback St, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: [
        {
          start: windows.learnerDeliveryStart.toISOString(),
          end: windows.learnerDeliveryEnd.toISOString(),
        },
      ],
    });
    await trackCreatedReservation(created.id);

    await assert.rejects(
      () =>
        acceptSupplierReservation(supplierId, created.id, {
          pickupWindowStart: windows.supplierPickupStart.toISOString(),
          pickupWindowEnd: windows.supplierPickupEnd.toISOString(),
        }),
      /PAY02T forced delivery obligation failure/,
    );

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.equal(reservation.status, 'PENDING');
    // DeliveryGroup is assigned at reservation create (outside accept TX).
    if (reservation.deliveryGroupId) {
      ids.groups.push(reservation.deliveryGroupId);
    }
    assert.equal(
      await prisma.paymentOrder.count({
        where: {
          OR: [
            { reservationId: created.id },
            ...(reservation.deliveryGroupId
              ? [{ deliveryGroupId: reservation.deliveryGroupId }]
              : []),
          ],
        },
      }),
      0,
    );
    await assertNoDelivery(created.id);
    assert.equal(
      await prisma.reservationStatusHistory.count({
        where: { reservationId: created.id, newStatus: 'ACCEPTED' },
      }),
      0,
    );
  });

  // ---------------------------------------------------------------------------
  // Disabled-mode regression matrix
  // ---------------------------------------------------------------------------

  test('disabled: pickup accept creates no PaymentOrder and exposes code', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const material = await createMaterial({ price: 40 });
    const window = futureWindow(37);
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
    });
    await trackCreatedReservation(created.id);

    const accepted = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: window.start,
      pickupWindowEnd: window.end,
    });
    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: created.id } }),
      0,
    );
    const mapped = await getMyReservationById(learnerId, created.id);
    assert.equal(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', created.id),
    );
  });

  test('disabled: delivery accept creates Delivery immediately with no PaymentOrders', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const material = await createMaterial({
      price: 40,
      deliveryAllowed: true,
    });
    const windows = deliveryAcceptWindows();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '40 Legacy St, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: [
        {
          start: windows.learnerDeliveryStart.toISOString(),
          end: windows.learnerDeliveryEnd.toISOString(),
        },
      ],
    });
    await trackCreatedReservation(created.id);

    const accepted = await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: windows.supplierPickupStart.toISOString(),
      pickupWindowEnd: windows.supplierPickupEnd.toISOString(),
    });
    assert.equal(accepted.status, 'ACCEPTED');
    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: created.id } }),
      0,
    );
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    if (reservation.deliveryGroupId) {
      ids.groups.push(reservation.deliveryGroupId);
      assert.equal(
        await prisma.paymentOrder.count({
          where: { deliveryGroupId: reservation.deliveryGroupId },
        }),
        0,
      );
    }
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: created.id } }),
      1,
    );
  });

  test('disabled: learner SUBMIT_DELIVERY_WINDOW creates Delivery with no PaymentOrders', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const material = await createMaterial({
      price: 21,
      deliveryAllowed: true,
    });
    const supplierPickupStart = new Date(Date.now() + 24 * 3_600_000);
    const supplierPickupEnd = new Date(
      supplierPickupStart.getTime() + 2 * 3_600_000,
    );
    const earliestDelivery = new Date(
      supplierPickupEnd.getTime() + 60 * 60_000,
    );
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '21 Confirm Legacy, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: [
        {
          start: new Date(earliestDelivery.getTime() - 3 * 3_600_000).toISOString(),
          end: new Date(earliestDelivery.getTime() - 30 * 60_000).toISOString(),
        },
      ],
    });
    await trackCreatedReservation(created.id);

    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: supplierPickupStart.toISOString(),
      pickupWindowEnd: supplierPickupEnd.toISOString(),
    });

    const confirmed = await resolveLearnerConfirmation(learnerId, created.id, {
      action: 'SUBMIT_DELIVERY_WINDOW',
      deliveryWindow: {
        start: earliestDelivery.toISOString(),
        end: new Date(earliestDelivery.getTime() + 3 * 3_600_000).toISOString(),
      },
    });
    assert.equal(confirmed.status, 'ACCEPTED');
    assert.equal(
      await prisma.paymentOrder.count({ where: { reservationId: created.id } }),
      0,
    );
    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    if (reservation.deliveryGroupId) {
      ids.groups.push(reservation.deliveryGroupId);
    }
    assert.equal(
      await prisma.delivery.count({ where: { reservationId: created.id } }),
      1,
    );
  });

  test('disabled: no-driver recovery reopens Delivery immediately', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const material = await createMaterial({
      price: 16,
      deliveryAllowed: true,
    });
    const windows = deliveryAcceptWindows();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      deliveryAddressText: '16 Legacy Recovery, Nablus',
      dropoffCity: 'Nablus',
      safeDropoffAllowed: false,
      learnerPreferredDeliveryWindows: [
        {
          start: windows.learnerDeliveryStart.toISOString(),
          end: windows.learnerDeliveryEnd.toISOString(),
        },
      ],
    });
    await trackCreatedReservation(created.id);

    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: windows.supplierPickupStart.toISOString(),
      pickupWindowEnd: windows.supplierPickupEnd.toISOString(),
    });

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.ok(reservation.deliveryGroupId);
    ids.groups.push(reservation.deliveryGroupId!);

    const delivery = await prisma.delivery.findFirstOrThrow({
      where: { reservationId: created.id },
    });

    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { status: 'AWAITING_RESOLUTION' },
    });
    await prisma.deliveryGroup.update({
      where: { id: reservation.deliveryGroupId! },
      data: { status: 'CANCELLED' },
    });
    await prisma.reservation.update({
      where: { id: created.id },
      data: {
        status: 'AWAITING_SUPPLIER_CONFIRMATION',
        pendingRescheduleReason: NO_DRIVER_SUPPLIER_RECONFIRM_REASON,
        pendingRescheduleRequestedBy: 'SUPPLIER',
      },
    });

    const replacement = futureWindow(95);
    await submitNoDriverPickupWindow(supplierId, created.id, {
      pickupWindowStart: replacement.start,
      pickupWindowEnd: replacement.end,
    });

    assert.equal(
      (
        await prisma.reservation.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).status,
      'ACCEPTED',
    );
    assert.equal(
      (
        await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } })
      ).status,
      'WAITING_FOR_DRIVER',
    );
    assert.equal(
      await prisma.paymentOrder.count({
        where: {
          OR: [
            { reservationId: created.id },
            { deliveryGroupId: reservation.deliveryGroupId! },
          ],
        },
      }),
      0,
    );
  });
});
