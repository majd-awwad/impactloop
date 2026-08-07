import assert from 'node:assert/strict';
import { after, before, beforeEach, afterEach, describe, test } from 'node:test';
import { createServer, type Server } from 'node:http';

import { Prisma } from '../../generated/prisma/client.js';
import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { signAccessToken } from '../../utils/jwt.js';
import { deriveHandoverCode } from '../../utils/handover-codes.js';

import { getMaterialViewerState } from '../materials/materials.service.js';
import { getMyReservationById } from '../reservations/reservations.service.js';
import { acceptSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';
import { createReservation } from '../reservations/reservations.service.js';

import {
  ensureDeliveryFeePaymentOrder,
  ensureMaterialPaymentOrder,
} from './payments.ensure.js';
import { processVerifiedProviderEvent } from './payments.event-processor.js';
import {
  afterVerifiedPaymentEventProcessed,
  reevaluateFulfillmentAfterPaymentOrderPaid,
} from './payments.fulfillment.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { evaluateDeliveryGroupPaymentReadiness } from './payments.readiness.js';
import { getReservationPaymentRequirement } from './payments.requirement.js';
import { reconcileAcceptedPaymentObligations } from './payments.reconcile.js';
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
  trackOrder,
} from './payments.test-helpers.js';
import { getPaymentProvider } from './providers/payment-provider.registry.js';
import { MockPaymentProvider } from './providers/mock/mock.provider.js';
import { signMockPayload } from './providers/mock/mock.hmac.js';

describe('PAY-02R defect regression', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';
  let server: Server;
  let baseUrl = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay02r-l' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay02r-s' })
    ).id;

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

  beforeEach(() => setElectronicPaymentEnforcementForTests(true));
  afterEach(() => setElectronicPaymentEnforcementForTests(undefined));

  async function payOrder(orderId: string) {
    const checkout = await startPaymentCheckout({
      orderId,
      payerUserId: learnerId,
      idempotencyKey: `pay02r-${orderId}-${Date.now()}-${Math.random()}`,
    });
    await actOnMockCheckout({
      attemptId: checkout.attemptId,
      action: 'success',
      actorUserId: learnerId,
    });
    trackOrder(ids, orderId);
  }

  test('material viewer state hides unpaid pickup code (fail-closed)', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 44,
    });
    const material = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
      select: { materialId: true },
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    const viewer = await getMaterialViewerState(material.materialId, {
      sub: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(viewer.reservation?.selfPickupCode ?? null, null);

    const detail = await getMyReservationById(learnerId, reservation.id);
    assert.equal(detail.selfPickupCode, null);
  });

  test('awaiting group member blocks Delivery readiness (Policy A)', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 0,
    });
    const accepted = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });
    const awaiting = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });

    await prisma.reservation.update({
      where: { id: accepted.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: 'A',
        dropoffCity: 'Ramallah',
      },
    });
    await prisma.reservation.update({
      where: { id: awaiting.id },
      data: {
        status: 'AWAITING_LEARNER_CONFIRMATION',
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: 'A',
        dropoffCity: 'Ramallah',
        acceptedAt: null,
      },
    });

    const readiness = await evaluateDeliveryGroupPaymentReadiness(group.id);
    assert.equal(readiness.overallReady, false);
    assert.equal(readiness.overallStatus, 'AWAITING_GROUP_CONFIRMATION');
    assert.deepEqual(readiness.awaitingConfirmationReservationIds, [
      awaiting.id,
    ]);
  });

  test('requirement API: pre-acceptance is NOT_YET_PAYABLE; cancelled Delivery not dispatchable', async () => {
    const pending = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 20,
    });
    await prisma.reservation.update({
      where: { id: pending.id },
      data: { status: 'PENDING', acceptedAt: null },
    });

    const before = await getReservationPaymentRequirement(pending.id, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(before.overallStatus, 'AWAITING_ACCEPTANCE');
    assert.equal(before.material.status, 'NOT_YET_PAYABLE');
    assert.equal(before.material.canStartCheckout, false);

    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 0,
    });
    const deliveryRes = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });
    await prisma.reservation.update({
      where: { id: deliveryRes.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: '12 Learner',
        dropoffCity: 'Ramallah',
      },
    });

    const reservation = await prisma.reservation.findUniqueOrThrow({
      where: { id: deliveryRes.id },
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
      const created = await createOperationalDelivery(tx, {
        reservationId: deliveryRes.id,
        deliveryGroupId: group.id,
        requesterId: learnerId,
        changedByUserId: supplierId,
        materialLocation: reservation.material.location,
        deliveryAddressText: '12 Learner',
        dropoffCity: 'Ramallah',
        statusHistoryNote: 'pay02r cancelled delivery fixture',
      });
      await tx.delivery.update({
        where: { id: created.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
    });

    const req = await getReservationPaymentRequirement(deliveryRes.id, {
      userId: learnerId,
      roles: ['LEARNER'],
    });
    assert.equal(req.deliveryExists, true);
    assert.equal(req.deliveryStatus, 'CANCELLED');
    assert.equal(req.deliveryDispatchable, false);
    assert.equal(req.fulfillmentStarted, false);
  });

  test('duplicate provider success retries fulfillment after missed post-commit hook', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 8,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: '12 Learner Street',
        dropoffCity: 'Ramallah',
        dropoffArea: 'Center',
        confirmedDeliveryWindowStart: new Date(Date.now() + 86_400_000),
        confirmedDeliveryWindowEnd: new Date(Date.now() + 93_600_000),
        supplierPickupWindowStart: new Date(Date.now() + 43_200_000),
        supplierPickupWindowEnd: new Date(Date.now() + 50_400_000),
      },
    });

    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, fee.order.id);

    const checkout = await startPaymentCheckout({
      orderId: fee.order.id,
      payerUserId: learnerId,
      idempotencyKey: `pay02r-dup-${Date.now()}abcdefgh`,
    });

    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockPaymentProvider);
    const attempt = await prisma.paymentAttempt.findUniqueOrThrow({
      where: { id: checkout.attemptId },
    });

    assert.ok(attempt.providerRef);
    const built = provider.buildActionEvent({
      action: 'success',
      attemptId: attempt.id,
      providerRef: attempt.providerRef,
      amountMinor: attempt.amountMinor,
      currency: attempt.currency,
    });

    const rawBody = Buffer.from(JSON.stringify(built.body), 'utf8');
    const timestampSeconds = Math.floor(Date.now() / 1000);
    const signature = signMockPayload(timestampSeconds, rawBody);
    const verified = await provider.verifyAndNormalizeEvent({
      rawBody,
      headers: {
        'x-impactloop-mock-signature': signature,
        'x-impactloop-mock-timestamp': String(timestampSeconds),
      },
    });
    assert.equal(verified.ok, true);
    if (!verified.ok) return;

    // Commit PAID without running the post-commit fulfillment hook.
    const processed = await processVerifiedProviderEvent(
      verified.event,
      verified.signatureValid,
    );
    assert.equal(processed.processingStatus, 'PROCESSED');
    assert.equal(processed.paymentOrderId, fee.order.id);
    assert.equal(
      await prisma.delivery.count({ where: { deliveryGroupId: group.id } }),
      0,
    );

    const duplicate = await processVerifiedProviderEvent(
      verified.event,
      verified.signatureValid,
    );
    assert.equal(duplicate.processingStatus, 'IGNORED_DUPLICATE');
    assert.equal(duplicate.paymentOrderId, fee.order.id);

    await afterVerifiedPaymentEventProcessed(duplicate);

    const deliveries = await prisma.delivery.findMany({
      where: { deliveryGroupId: group.id },
    });
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]?.status, 'WAITING_FOR_DRIVER');

    // HTTP webhook path: second duplicate remains one Delivery.
    const webhookRaw = Buffer.from(JSON.stringify(built.body), 'utf8');
    const ts2 = Math.floor(Date.now() / 1000);
    const webhookRes = await fetch(`${baseUrl}/api/payments/webhooks/mock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-impactloop-mock-signature': signMockPayload(ts2, webhookRaw),
        'x-impactloop-mock-timestamp': String(ts2),
      },
      body: webhookRaw,
    });
    assert.equal(webhookRes.status, 200);
    assert.equal(
      await prisma.delivery.count({ where: { deliveryGroupId: group.id } }),
      1,
    );
  });

  test('deferred recovery Delivery reopens after payment success', async () => {
    const group = await createPayDeliveryGroupFixture(ids, {
      learnerId,
      supplierId,
      deliveryFee: 9,
    });
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 0,
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryGroupId: group.id,
        deliveryAddressText: '12 Learner Street',
        dropoffCity: 'Ramallah',
      },
    });

    const fee = await ensureDeliveryFeePaymentOrder(group.id);
    assert.ok(fee.outcome === 'CREATED' || fee.outcome === 'EXISTING');
    trackOrder(ids, fee.order.id);

    const reservationRow = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
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
    let deliveryId = '';
    await prisma.$transaction(async (tx) => {
      const created = await createOperationalDelivery(tx, {
        reservationId: reservation.id,
        deliveryGroupId: group.id,
        requesterId: learnerId,
        changedByUserId: supplierId,
        materialLocation: reservationRow.material.location,
        deliveryAddressText: '12 Learner Street',
        dropoffCity: 'Ramallah',
        statusHistoryNote: 'pay02r recovery deferred fixture',
      });
      deliveryId = created.id;
      await tx.delivery.update({
        where: { id: created.id },
        data: { status: 'AWAITING_RESOLUTION' },
      });
      await tx.deliveryGroup.update({
        where: { id: group.id },
        data: { status: 'CANCELLED' },
      });
    });

    // Payment still outstanding — reopen should not happen yet.
    let result = await reevaluateFulfillmentAfterPaymentOrderPaid(fee.order.id);
    assert.equal(result.deliveryReopened, false);

    await payOrder(fee.order.id);

    const delivery = await prisma.delivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });
    assert.equal(delivery.status, 'WAITING_FOR_DRIVER');

    const groupRow = await prisma.deliveryGroup.findUniqueOrThrow({
      where: { id: group.id },
    });
    assert.equal(groupRow.status, 'OPEN');
  });

  test('reconcile skips assigned/in-progress Delivery reservations', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 15,
    });
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        fulfillmentMethod: 'DELIVERY',
        deliveryAddressText: '12',
        dropoffCity: 'Ramallah',
      },
    });

    const reservationRow = await prisma.reservation.findUniqueOrThrow({
      where: { id: reservation.id },
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
      const created = await createOperationalDelivery(tx, {
        reservationId: reservation.id,
        requesterId: learnerId,
        changedByUserId: supplierId,
        materialLocation: reservationRow.material.location,
        deliveryAddressText: '12',
        dropoffCity: 'Ramallah',
        statusHistoryNote: 'pay02r reconcile skip',
      });
      await tx.delivery.update({
        where: { id: created.id },
        data: { status: 'DRIVER_ASSIGNED', assignedAt: new Date() },
      });
    });

    const dry = await reconcileAcceptedPaymentObligations({
      dryRun: true,
      reservationIds: [reservation.id],
    });
    assert.ok(dry.skippedFulfillmentStarted.includes(reservation.id));
    assert.equal(dry.materialWouldCreate.includes(reservation.id), false);
  });

  test('supplier accept pickup under enforcement creates material order', async () => {
    const category = await prisma.category.create({
      data: {
        nameEn: `[pay02r] cat ${Date.now()}`,
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
        title: 'pay02r accept pickup',
        description: 'pay02r',
        materialType: 'Test',
        quantity: 5,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: false,
        price: 12,
      },
    });
    ids.materials.push(material.id);

    const windowStart = new Date(Date.now() + 24 * 3_600_000);
    const windowEnd = new Date(windowStart.getTime() + 2 * 3_600_000);

    const created = await createReservation(learnerId, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [
        {
          start: windowStart.toISOString(),
          end: windowEnd.toISOString(),
        },
      ],
    });
    ids.reservations.push(created.id);

    await acceptSupplierReservation(supplierId, created.id, {
      pickupWindowStart: windowStart.toISOString(),
      pickupWindowEnd: windowEnd.toISOString(),
      selectedPreferredWindowIndex: 0,
    });

    const orders = await prisma.paymentOrder.findMany({
      where: { reservationId: created.id, purpose: 'MATERIAL_SUBTOTAL' },
    });
    assert.equal(orders.length, 1);
    assert.equal(orders[0]?.status, 'REQUIRES_PAYMENT');
    trackOrder(ids, orders[0]!.id);

    const mapped = await getMyReservationById(learnerId, created.id);
    assert.equal(mapped.selfPickupCode, null);
    assert.notEqual(
      mapped.selfPickupCode,
      deriveHandoverCode('self-pickup', created.id),
    );
  });
});
