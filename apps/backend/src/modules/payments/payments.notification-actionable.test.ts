import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';
import { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

import { createReservation } from '../reservations/reservations.service.js';
import { acceptSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';

import { listMyNotifications } from '../notifications/notifications.service.js';

import { buildActionablePaymentNotificationSnapshot } from './payments.notification-actionable.js';
import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { PAYMENT_NOTIFICATION_TYPES } from './payments.notifications.js';
import { notifyPaymentRequiredAfterAcceptance } from './payments.notifications.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { reconcileAcceptedPaymentObligations } from './payments.reconcile.js';
import {
  cleanupPayTest,
  createPayDeliveryGroupFixture,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

const MARKER = '[pay-notif-agg]';

function futureWindow(hoursFromNow = 24, durationHours = 2) {
  const start = new Date(Date.now() + hoursFromNow * 3_600_000);
  const end = new Date(start.getTime() + durationHours * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function assertLearnerAggregatedPaymentMetadataSafe(
  metadata: Record<string, unknown>,
  forbiddenInternalIds: string[],
) {
  assert.equal(metadata.outstandingPaymentOrderIds, undefined);
  assert.equal(metadata.paymentOrderId, undefined);
  assert.equal(metadata.deliveryGroupId, undefined);
  const serialized = JSON.stringify(metadata);
  for (const id of forbiddenInternalIds) {
    assert.ok(
      !serialized.includes(id),
      `learner notification metadata leaked internal id: ${id}`,
    );
  }
}

describe('payment notification aggregation', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay-agg-l' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay-agg-s' })
    ).id;
  });

  after(async () => {
    const orphanOrders = await prisma.paymentOrder.findMany({
      where: {
        OR: [
          ...(ids.reservations.length
            ? [{ reservationId: { in: ids.reservations } }]
            : []),
          ...(ids.groups.length
            ? [{ deliveryGroupId: { in: ids.groups } }]
            : []),
        ],
      },
      select: { id: true },
    });
    for (const order of orphanOrders) {
      trackOrder(ids, order.id);
    }
    await cleanupPayTest(ids);
  });

  beforeEach(() => setElectronicPaymentEnforcementForTests(true));
  afterEach(() => setElectronicPaymentEnforcementForTests(undefined));

  async function createPaidMaterial(price: number, deliveryAllowed = true) {
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
        description: 'agg',
        materialType: 'Test',
        quantity: 10,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: price === 0,
        price: price === 0 ? null : price,
        pickupAllowed: true,
        deliveryAllowed,
      },
      select: { id: true },
    });
    ids.materials.push(material.id);
    return material;
  }

  async function attachDeliveryFields(
    reservationId: string,
    groupId: string,
    deliveryFee = 11,
  ) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: groupId,
        deliveryAddressText: 'Test dropoff',
        dropoffCity: 'Ramallah',
        dropoffArea: 'Center',
        deliveryFee: new Prisma.Decimal(deliveryFee),
        status: 'ACCEPTED',
      },
    });
  }

  async function acceptDeliveryReservation(
    materialId: string,
    price: number,
    deliveryFee: number,
  ) {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee,
    });
    const preferred = futureWindow();
    const created = await createReservation(learnerId, {
      materialId,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      paymentMethod: 'CARD',
      dropoffCity: 'Ramallah',
      deliveryAddressText: 'Test dropoff',
      learnerPreferredDeliveryWindows: [preferred],
    });
    ids.reservations.push(created.id);

    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
      selectedPreferredWindowIndex: 0,
    });

    await attachDeliveryFields(created.id, group.id, deliveryFee);

    const materialResult = await ensureMaterialPaymentOrder(created.id);
    const feeResult = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(
      materialResult.outcome === 'CREATED' ||
        materialResult.outcome === 'EXISTING',
    );
    assert.ok(
      feeResult.outcome === 'CREATED' || feeResult.outcome === 'EXISTING',
    );
    trackOrder(ids, materialResult.order.id);
    trackOrder(ids, feeResult.order.id);

    const materialOrder = materialResult.order;
    const feeOrder = feeResult.order;

    return {
      reservationId: created.id,
      groupId: group.id,
      materialOrder,
      feeOrder,
      materialSubtotal: price,
      deliveryFee,
    };
  }

  test('CARD delivery with material + delivery fee creates one actionable notification', async () => {
    const material = await createPaidMaterial(20);
    const {
      reservationId,
      materialOrder,
      feeOrder,
      materialSubtotal,
      deliveryFee,
    } = await acceptDeliveryReservation(material.id, 20, 11);

    await prisma.notification.deleteMany({
      where: { userId: learnerId, relatedEntityId: reservationId },
    });

    await notifyPaymentRequiredAfterAcceptance(reservationId);

    const required = await prisma.notification.findMany({
      where: {
        userId: learnerId,
        relatedEntityId: reservationId,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
      },
    });
    assert.equal(required.length, 1);
    assert.match(required[0]!.eventKey ?? '', /^reservation:.+:actionable-payment:/);
    assert.equal(
      (required[0]!.metadata as Record<string, unknown>).aggregatedCheckout,
      true,
    );
    assert.equal(
      (required[0]!.metadata as Record<string, unknown>).totalAmount,
      (materialSubtotal + deliveryFee).toFixed(2),
    );
    assert.ok(materialOrder);
    assert.ok(feeOrder);
    assert.equal(
      await prisma.paymentOrder.count({
        where: {
          id: { in: [materialOrder!.id, feeOrder!.id] },
        },
      }),
      2,
    );
    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          eventKey: `payment:${materialOrder!.id}:required`,
        },
      }),
      0,
    );
    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          eventKey: `payment:${feeOrder!.id}:required`,
        },
      }),
      0,
    );
  });

  test('serialized aggregated notification hides internal payment identifiers', async () => {
    const material = await createPaidMaterial(20);
    const { reservationId, materialOrder, feeOrder, groupId } =
      await acceptDeliveryReservation(material.id, 20, 11);

    await prisma.notification.deleteMany({
      where: { userId: learnerId, relatedEntityId: reservationId },
    });
    await notifyPaymentRequiredAfterAcceptance(reservationId);

    const listed = await listMyNotifications(learnerId, { page: 1, limit: 50 });
    const item = listed.items.find(
      (row) =>
        row.relatedEntityId === reservationId &&
        row.notificationType === PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
    );
    assert.ok(item);
    assert.equal(item.metadata.aggregatedCheckout, true);
    assertLearnerAggregatedPaymentMetadataSafe(item.metadata, [
      materialOrder!.id,
      feeOrder!.id,
      groupId,
    ]);
  });

  test('material-only CARD pickup creates one actionable notification', async () => {
    const material = await createPaidMaterial(15);
    const preferred = futureWindow();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      paymentMethod: 'CARD',
      learnerPreferredPickupWindows: [preferred],
    });
    ids.reservations.push(created.id);
    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
      selectedPreferredWindowIndex: 0,
    });

    await prisma.notification.deleteMany({
      where: { userId: learnerId, relatedEntityId: created.id },
    });
    await notifyPaymentRequiredAfterAcceptance(created.id);

    const required = await prisma.notification.findMany({
      where: {
        userId: learnerId,
        relatedEntityId: created.id,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
      },
    });
    assert.equal(required.length, 1);
    assert.match(required[0]!.body, /pickup code stays hidden/i);
  });

  test('delivery-fee-only CARD creates one actionable notification', async () => {
    const material = await createPaidMaterial(0);
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 9,
    });
    const preferred = futureWindow();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'DELIVERY',
      paymentMethod: 'CARD',
      dropoffCity: 'Ramallah',
      deliveryAddressText: 'Test dropoff',
      learnerPreferredDeliveryWindows: [preferred],
    });
    ids.reservations.push(created.id);
    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
      selectedPreferredWindowIndex: 0,
    });
    await attachDeliveryFields(created.id, group.id, 9);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, fee.order.id);

    await prisma.notification.deleteMany({
      where: { userId: learnerId, relatedEntityId: created.id },
    });
    await notifyPaymentRequiredAfterAcceptance(created.id);

    const required = await prisma.notification.findMany({
      where: {
        userId: learnerId,
        relatedEntityId: created.id,
        notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
      },
    });
    assert.equal(required.length, 1);
    assert.equal(
      (required[0]!.metadata as Record<string, unknown>).deliveryFeeOutstanding,
      true,
    );
    assert.equal(
      (required[0]!.metadata as Record<string, unknown>).materialOutstanding,
      false,
    );
  });

  test('CASH acceptance creates no pay-now notification', async () => {
    const material = await createPaidMaterial(12);
    const preferred = futureWindow();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      paymentMethod: 'CASH',
      learnerPreferredPickupWindows: [preferred],
    });
    ids.reservations.push(created.id);
    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
      selectedPreferredWindowIndex: 0,
    });

    await notifyPaymentRequiredAfterAcceptance(created.id);

    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          relatedEntityId: created.id,
          notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
        },
      }),
      0,
    );
  });

  test('free reservation creates no pay-now notification', async () => {
    const material = await createPaidMaterial(0);
    const preferred = futureWindow();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      paymentMethod: 'CARD',
      learnerPreferredPickupWindows: [preferred],
    });
    ids.reservations.push(created.id);
    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: preferred.start,
      pickupWindowEnd: preferred.end,
      selectedPreferredWindowIndex: 0,
    });

    await notifyPaymentRequiredAfterAcceptance(created.id);

    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          relatedEntityId: created.id,
          notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
        },
      }),
      0,
    );
  });

  test('rerun does not duplicate actionable notification', async () => {
    const material = await createPaidMaterial(18);
    const { reservationId } = await acceptDeliveryReservation(material.id, 18, 6);

    await prisma.notification.deleteMany({
      where: { userId: learnerId, relatedEntityId: reservationId },
    });

    await notifyPaymentRequiredAfterAcceptance(reservationId);
    await notifyPaymentRequiredAfterAcceptance(reservationId);
    await reconcileAcceptedPaymentObligations({
      dryRun: false,
      reservationIds: [reservationId],
    });

    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          relatedEntityId: reservationId,
          notificationType: PAYMENT_NOTIFICATION_TYPES.PAYMENT_REQUIRED,
        },
      }),
      1,
    );
  });

  test('shared delivery fee is not double-counted in total', async () => {
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
    await attachDeliveryFields(a.id, group.id, 14);
    await attachDeliveryFields(b.id, group.id, 14);

    const ma = await ensureMaterialPaymentOrder(a.id);
    const mb = await ensureMaterialPaymentOrder(b.id);
    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    trackOrder(ids, ma.order.id);
    trackOrder(ids, mb.order.id);
    trackOrder(ids, fee.order.id);

    const snapshot = await buildActionablePaymentNotificationSnapshot(a.id);
    assert.ok(snapshot);
    assert.equal(snapshot.totalAmount, '63.00');
    assert.equal(snapshot.deliveryFeeAmount, '14.00');
    assert.equal(snapshot.materialAmount, '49.00');
  });

  test('new cycle notification path remains separate', async () => {
    const material = await createPaidMaterial(10);
    const preferred = futureWindow();
    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      paymentMethod: 'CARD',
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

    await prisma.paymentOrder.update({
      where: { id: order.id },
      data: { cycleNumber: 2, status: 'REQUIRES_PAYMENT' },
    });

    const { notifyNewPaymentCycleRequired } = await import(
      './payments.notifications.js'
    );
    await notifyNewPaymentCycleRequired(order.id);

    assert.equal(
      await prisma.notification.count({
        where: {
          userId: learnerId,
          eventKey: `payment:${order.id}:new-cycle`,
        },
      }),
      1,
    );
  });
});
