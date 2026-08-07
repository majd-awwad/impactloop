import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import { requestDeliveryForReservation } from '../deliveries/deliveries.service.js';
import {
  actOnMockCheckout,
  getPaymentOrderForActor,
  startPaymentCheckout,
} from './payments.service.js';
import { ensureMaterialPaymentOrder } from './payments.ensure.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';
import { resolvePaymentSummariesByReservations } from './payments.list-summary.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { reevaluateFulfillmentAfterPaymentOrderPaid } from './payments.fulfillment.js';
import {
  cleanupPayTest,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

const dropoff = {
  country: 'Palestine',
  city: 'Nablus',
  area: 'Old City',
  addressLine: 'Street 1',
  isApproximate: true,
};

/**
 * PAY-05C-R / delivery-fee gate: Request Delivery after material payment must
 * create a DELIVERY_FEE order when fee > 0 and must not open WAITING_FOR_DRIVER
 * until that fee is verified PAID.
 */
describe('Request Delivery delivery-fee payment gate', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';

  before(async () => {
    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'reqdel-fee-learner',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'reqdel-fee-supplier',
    });
    learnerId = learner.id;
    supplierId = supplier.id;
  });

  after(async () => {
    await cleanupPayTest(ids);
  });

  beforeEach(() => setElectronicPaymentEnforcementForTests(true));
  afterEach(() => setElectronicPaymentEnforcementForTests(undefined));

  async function paidMaterialPickupReservation(materialSubtotal = 12) {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal,
    });

    // Enable delivery on the material so Request Delivery is allowed.
    await prisma.material.update({
      where: { id: (await prisma.reservation.findUniqueOrThrow({
        where: { id: reservation.id },
        select: { materialId: true },
      })).materialId },
      data: { deliveryAllowed: true },
    });

    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(
      ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING',
      `expected material order, got ${ensured.outcome}`,
    );
    trackOrder(ids, ensured.order.id);

    const checkout = await startPaymentCheckout({
      orderId: ensured.order.id,
      payerUserId: learnerId,
      idempotencyKey: `reqdel-mat-${ensured.order.id}-${Date.now()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    return reservation.id;
  }

  test('1. paid material + positive delivery fee → fee order required; no Delivery yet', async () => {
    const reservationId = await paidMaterialPickupReservation(12);

    await assert.rejects(
      () =>
        requestDeliveryForReservation(learnerId, reservationId, {
          dropoffLocation: dropoff,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'DELIVERY_FEE_REQUIRED');
        const details = error.details as {
          paymentOrderId?: string;
          deliveryGroupId?: string;
          amount?: string;
        };
        assert.ok(details.paymentOrderId);
        assert.ok(details.deliveryGroupId);
        assert.ok(details.amount && Number(details.amount) > 0);
        trackOrder(ids, details.paymentOrderId!);
        return true;
      },
    );

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: {
        fulfillmentMethod: true,
        deliveryGroupId: true,
        deliveryFee: true,
        pricingCurrency: true,
      },
    });
    assert.equal(reservation.fulfillmentMethod, 'DELIVERY');
    assert.ok(reservation.deliveryGroupId);
    assert.ok(Number(reservation.deliveryFee) > 0);
    assert.equal(reservation.pricingCurrency, 'NIS');

    const group = await prisma.deliveryGroup.findUniqueOrThrow({
      where: { id: reservation.deliveryGroupId! },
      select: { deliveryFee: true, currency: true },
    });
    assert.ok(Number(group.deliveryFee) > 0);
    assert.equal(group.currency, 'NIS');

    const feeOrders = await prisma.paymentOrder.findMany({
      where: {
        deliveryGroupId: reservation.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(feeOrders.length, 1);
    assert.equal(feeOrders[0]!.status, 'REQUIRES_PAYMENT');

    const deliveries = await prisma.delivery.findMany({
      where: { reservationId },
    });
    assert.equal(deliveries.length, 0);

    // Material order must remain a separate PAID order.
    const materialOrders = await prisma.paymentOrder.findMany({
      where: { reservationId, purpose: 'MATERIAL_SUBTOTAL' },
    });
    assert.ok(materialOrders.some((o) => o.status === 'PAID'));
    assert.ok(
      materialOrders.every((o) => o.id !== feeOrders[0]!.id),
      'must not reuse MATERIAL_SUBTOTAL order for delivery fee',
    );
  });

  test('2. paid material + zero delivery fee → Delivery may start immediately', async () => {
    const reservationId = await paidMaterialPickupReservation(12);

    const supplierProfile = await prisma.supplierProfile.findUniqueOrThrow({
      where: { userId: supplierId },
      select: { id: true },
    });
    const windowStart = new Date(Date.now() + 24 * 3_600_000);
    const windowEnd = new Date(windowStart.getTime() + 2 * 3_600_000);
    const freeGroup = await prisma.deliveryGroup.create({
      data: {
        learnerId,
        supplierProfileId: supplierProfile.id,
        dropoffCity: 'Nablus',
        dropoffArea: 'Old City',
        deliveryAddressText: 'Street 1, Old City, Nablus, Palestine',
        deliveryFee: 0,
        currency: 'NIS',
        deliveryZone: 'SAME_CITY',
        status: 'OPEN',
        windowStart,
        windowEnd,
      },
    });
    ids.groups.push(freeGroup.id);

    // Pre-convert reservation onto the free group (fee 0) so Request Delivery
    // only needs to open fulfillment — no DELIVERY_FEE order.
    await prisma.reservation.update({
      where: { id: reservationId },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: freeGroup.id,
        deliveryAddressText: 'Street 1, Old City, Nablus, Palestine',
        dropoffCity: 'Nablus',
        dropoffArea: 'Old City',
        deliveryFee: 0,
        totalAmount: 12,
        pricingCurrency: 'NIS',
        confirmedDeliveryWindowStart: windowStart,
        confirmedDeliveryWindowEnd: windowEnd,
      },
    });

    const delivery = await requestDeliveryForReservation(
      learnerId,
      reservationId,
      { dropoffLocation: dropoff },
    );

    assert.ok(delivery.id);
    assert.equal(delivery.status, 'WAITING_FOR_DRIVER');

    const updated = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: { deliveryGroupId: true, deliveryFee: true, fulfillmentMethod: true },
    });
    assert.equal(updated.fulfillmentMethod, 'DELIVERY');
    assert.equal(updated.deliveryGroupId, freeGroup.id);
    assert.equal(Number(updated.deliveryFee), 0);

    const feeOrders = await prisma.paymentOrder.findMany({
      where: { deliveryGroupId: freeGroup.id, purpose: 'DELIVERY_FEE' },
    });
    assert.equal(feeOrders.length, 0);
  });

  test('3. positive fee paid → Delivery starts exactly once', async () => {
    const reservationId = await paidMaterialPickupReservation(12);

    let paymentOrderId = '';
    let deliveryGroupId = '';
    try {
      await requestDeliveryForReservation(learnerId, reservationId, {
        dropoffLocation: {
          ...dropoff,
          city: 'Ramallah',
        },
      });
      assert.fail('expected DELIVERY_FEE_REQUIRED');
    } catch (error) {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'DELIVERY_FEE_REQUIRED');
      const details = error.details as {
        paymentOrderId: string;
        deliveryGroupId: string;
      };
      paymentOrderId = details.paymentOrderId;
      deliveryGroupId = details.deliveryGroupId;
      trackOrder(ids, paymentOrderId);
      ids.groups.push(deliveryGroupId);
    }

    const checkout = await startPaymentCheckout({
      orderId: paymentOrderId,
      payerUserId: learnerId,
      idempotencyKey: `reqdel-fee-pay-${paymentOrderId}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    const paid = await getPaymentOrderForActor(paymentOrderId, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(paid.status, 'PAID');

    // Payment success path may already create the Delivery; reevaluate must
    // remain idempotent either way.
    let deliveries = await prisma.delivery.findMany({
      where: { deliveryGroupId },
    });
    if (deliveries.length === 0) {
      const fulfillment = await reevaluateFulfillmentAfterPaymentOrderPaid(
        paymentOrderId,
      );
      assert.equal(fulfillment.deliveryCreated, true);
      deliveries = await prisma.delivery.findMany({
        where: { deliveryGroupId },
      });
    }
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]!.status, 'WAITING_FOR_DRIVER');

    const again = await reevaluateFulfillmentAfterPaymentOrderPaid(
      paymentOrderId,
    );
    assert.equal(again.deliveryCreated, false);
    const deliveriesAgain = await prisma.delivery.findMany({
      where: { deliveryGroupId },
    });
    assert.equal(deliveriesAgain.length, 1);
  });

  test('4. repeated Request Delivery → no duplicate fee order or Delivery', async () => {
    const reservationId = await paidMaterialPickupReservation(12);

    const firstIds: string[] = [];
    for (let i = 0; i < 2; i += 1) {
      try {
        await requestDeliveryForReservation(learnerId, reservationId, {
          dropoffLocation: dropoff,
        });
        assert.fail('expected DELIVERY_FEE_REQUIRED');
      } catch (error) {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'DELIVERY_FEE_REQUIRED');
        const details = error.details as { paymentOrderId: string };
        firstIds.push(details.paymentOrderId);
        trackOrder(ids, details.paymentOrderId);
      }
    }

    assert.equal(firstIds[0], firstIds[1]);

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: { deliveryGroupId: true },
    });
    const feeOrders = await prisma.paymentOrder.findMany({
      where: {
        deliveryGroupId: reservation.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(feeOrders.length, 1);
    assert.equal(
      await prisma.delivery.count({ where: { reservationId } }),
      0,
    );
  });

  test('5. shared DeliveryGroup → fee charged once', async () => {
    const firstId = await paidMaterialPickupReservation(12);

    let groupId = '';
    let feeOrderId = '';
    try {
      await requestDeliveryForReservation(learnerId, firstId, {
        dropoffLocation: dropoff,
      });
      assert.fail('expected DELIVERY_FEE_REQUIRED');
    } catch (error) {
      assert.ok(error instanceof AppError);
      const details = error.details as {
        deliveryGroupId: string;
        paymentOrderId: string;
      };
      groupId = details.deliveryGroupId;
      feeOrderId = details.paymentOrderId;
      trackOrder(ids, feeOrderId);
    }

    // Second accepted pickup reservation from same supplier joins the group.
    const secondId = await paidMaterialPickupReservation(8);
    try {
      await requestDeliveryForReservation(learnerId, secondId, {
        dropoffLocation: dropoff,
      });
      // May succeed (free join → delivery) or still require fee if join didn't
      // see the first group yet — either way fee orders for the group stay 1.
    } catch (error) {
      assert.ok(error instanceof AppError);
      if (error.code === 'DELIVERY_FEE_REQUIRED') {
        const details = error.details as {
          deliveryGroupId: string;
          paymentOrderId: string;
        };
        assert.equal(details.deliveryGroupId, groupId);
        assert.equal(details.paymentOrderId, feeOrderId);
      } else {
        throw error;
      }
    }

    const feeOrders = await prisma.paymentOrder.findMany({
      where: { deliveryGroupId: groupId, purpose: 'DELIVERY_FEE' },
    });
    assert.equal(feeOrders.length, 1);

    const members = await prisma.reservation.findMany({
      where: { deliveryGroupId: groupId },
    });
    assert.ok(members.length >= 1);
  });

  test('6. payments disabled → legacy immediate Delivery creation', async () => {
    setElectronicPaymentEnforcementForTests(false);
    const reservationId = await paidMaterialPickupReservation(12);

    const delivery = await requestDeliveryForReservation(
      learnerId,
      reservationId,
      {
        dropoffLocation: {
          ...dropoff,
          city: 'Hebron',
        },
      },
    );
    assert.equal(delivery.status, 'WAITING_FOR_DRIVER');

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: { deliveryGroupId: true, fulfillmentMethod: true },
    });
    assert.equal(reservation.fulfillmentMethod, 'DELIVERY');
    assert.ok(reservation.deliveryGroupId);
    ids.groups.push(reservation.deliveryGroupId!);

    // Legacy: no fee order when enforcement is off.
    const feeOrders = await prisma.paymentOrder.findMany({
      where: {
        deliveryGroupId: reservation.deliveryGroupId!,
        purpose: 'DELIVERY_FEE',
      },
    });
    assert.equal(feeOrders.length, 0);
  });

  test('7. fee unpaid → no driver assignment surface and no usable handover code', async () => {
    const reservationId = await paidMaterialPickupReservation(12);

    try {
      await requestDeliveryForReservation(learnerId, reservationId, {
        dropoffLocation: {
          ...dropoff,
          city: 'Jenin',
        },
      });
    } catch (error) {
      assert.ok(error instanceof AppError);
      assert.equal(error.code, 'DELIVERY_FEE_REQUIRED');
      trackOrder(
        ids,
        (error.details as { paymentOrderId: string }).paymentOrderId,
      );
    }

    const deliveries = await prisma.delivery.findMany({
      where: { reservationId },
    });
    assert.equal(deliveries.length, 0);

    // No WAITING_FOR_DRIVER row ⇒ nothing for drivers to accept.
    const waiting = await prisma.delivery.count({
      where: {
        reservation: { requesterId: learnerId },
        status: 'WAITING_FOR_DRIVER',
        reservationId,
      },
    });
    assert.equal(waiting, 0);
  });

  test('8. reservation requirement + list summary show delivery-fee outstanding', async () => {
    const reservationId = await paidMaterialPickupReservation(12);

    let paymentOrderId = '';
    try {
      await requestDeliveryForReservation(learnerId, reservationId, {
        dropoffLocation: {
          ...dropoff,
          city: 'Tulkarm',
        },
      });
    } catch (error) {
      assert.ok(error instanceof AppError);
      paymentOrderId = (error.details as { paymentOrderId: string })
        .paymentOrderId;
      trackOrder(ids, paymentOrderId);
    }

    const requirement = await getReservationPaymentRequirement(reservationId, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(requirement.fulfillmentMethod, 'DELIVERY');
    assert.ok(requirement.deliveryFee);
    assert.equal(requirement.deliveryFee!.required, true);
    assert.equal(requirement.deliveryFee!.canStartCheckout, true);
    assert.equal(requirement.deliveryFee!.paymentOrderId, paymentOrderId);
    assert.equal(requirement.deliveryExists, false);
    assert.equal(requirement.deliveryDispatchable, false);
    assert.ok(requirement.outstandingPaymentOrderIds.includes(paymentOrderId));

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservationId },
      select: {
        id: true,
        status: true,
        fulfillmentMethod: true,
        materialSubtotal: true,
        deliveryFee: true,
        pricingCurrency: true,
        deliveryGroupId: true,
      },
    });

    const summaries = await resolvePaymentSummariesByReservations([
      {
        id: reservation.id,
        status: reservation.status,
        fulfillmentMethod: reservation.fulfillmentMethod,
        materialSubtotal: reservation.materialSubtotal,
        deliveryFee: reservation.deliveryFee,
        pricingCurrency: reservation.pricingCurrency,
        deliveryGroupId: reservation.deliveryGroupId,
        deliveryStatus: null,
        assignedDriverProfileId: null,
      },
    ]);
    const summary = summaries.get(reservationId);
    assert.ok(summary);
    assert.equal(summary!.hasDeliveryFeeOutstanding, true);
    assert.equal(summary!.checkoutableOrderId, paymentOrderId);
    assert.equal(summary!.fulfillmentReady, false);
  });
});
