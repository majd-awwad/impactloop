import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { createServer, type Server } from 'node:http';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { signAccessToken } from '../../utils/jwt.js';

import {
  startReservationCheckout,
} from './payments.checkout-session.js';
import { ensureMaterialPaymentOrder } from './payments.ensure.js';
import { setElectronicPaymentEnforcementForTests } from './payments.policy.js';
import { actOnMockCheckout } from './payments.service.js';
import {
  cleanupPayTest,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';

/**
 * PAY-06 E2E-18 — HTTP-level authorization for reservation-scoped payment APIs.
 */
describe('PAY-06 HTTP authorization (enforcement ON)', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let otherLearnerId = '';
  let supplierId = '';
  let server: Server;
  let baseUrl = '';

  before(async () => {
    learnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay06h-a' })
    ).id;
    otherLearnerId = (
      await createPayUser(ids, { role: 'LEARNER', emailSuffix: 'pay06h-b' })
    ).id;
    supplierId = (
      await createPayUser(ids, { role: 'SUPPLIER', emailSuffix: 'pay06h-s' })
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

  function tokenFor(userId: string) {
    return signAccessToken({ sub: userId, roles: ['LEARNER'] });
  }

  test('learner B cannot read requirement, start checkout, restore session, or act', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 27,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    const ownerToken = tokenFor(learnerId);
    const otherToken = tokenFor(otherLearnerId);

    const ownerReq = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/requirement`,
      { headers: { Authorization: `Bearer ${ownerToken}` } },
    );
    assert.equal(ownerReq.status, 200);

    const otherReq = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/requirement`,
      { headers: { Authorization: `Bearer ${otherToken}` } },
    );
    assert.equal(otherReq.status, 404);

    const otherCheckout = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/checkout`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `pay06h-b-${Date.now()}`,
        },
        body: '{}',
      },
    );
    assert.ok([403, 404].includes(otherCheckout.status));

    const ownerCheckout = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/checkout`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `pay06h-a-${Date.now()}`,
        },
        body: '{}',
      },
    );
    assert.equal(ownerCheckout.status, 200);
    const ownerBody = (await ownerCheckout.json()) as {
      data: { checkoutSessionId: string; attemptId: string | null };
    };
    const sessionId = ownerBody.data.checkoutSessionId;
    const attemptId = ownerBody.data.attemptId;
    assert.ok(sessionId);
    assert.ok(attemptId);

    const otherSession = await fetch(
      `${baseUrl}/api/payments/checkout-sessions/${sessionId}`,
      { headers: { Authorization: `Bearer ${otherToken}` } },
    );
    assert.ok([403, 404].includes(otherSession.status));

    const otherRestore = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/checkout-session`,
      { headers: { Authorization: `Bearer ${otherToken}` } },
    );
    assert.ok([403, 404].includes(otherRestore.status));

    const otherAct = await fetch(
      `${baseUrl}/api/payments/mock/checkout/${attemptId}/act`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${otherToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'success' }),
      },
    );
    assert.ok([401, 403, 404].includes(otherAct.status));

    // Owner can still complete; forged delivery deep-link id does not authorize B.
    await actOnMockCheckout({
      attemptId,
      action: 'success',
      actorUserId: learnerId,
    });

    const delivery = await prisma.delivery.findFirst({
      where: { reservationId: reservation.id },
    });
    // Pickup reservation — no delivery. Forge a random id for B.
    const forgedDeliveryId = delivery?.id ?? 'forged-delivery-id';
    const otherDelivery = await fetch(
      `${baseUrl}/api/deliveries/${forgedDeliveryId}`,
      { headers: { Authorization: `Bearer ${otherToken}` } },
    );
    assert.ok([403, 404].includes(otherDelivery.status));

    // Reservation details HTTP
    const otherReservation = await fetch(
      `${baseUrl}/api/reservations/${reservation.id}`,
      { headers: { Authorization: `Bearer ${otherToken}` } },
    );
    assert.ok([403, 404].includes(otherReservation.status));
  });

  test('unauthenticated payment routes are rejected', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 11,
    });
    await ensureMaterialPaymentOrder(reservation.id);

    const unauth = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/requirement`,
    );
    assert.equal(unauth.status, 401);

    // Owner session should not be startable without auth either.
    const unauthCheckout = await fetch(
      `${baseUrl}/api/payments/reservations/${reservation.id}/checkout`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `pay06h-unauth-${Date.now()}`,
        },
        body: '{}',
      },
    );
    assert.equal(unauthCheckout.status, 401);

    // Sanity: service-level owner checkout still works for regression continuity.
    const session = await startReservationCheckout({
      reservationId: reservation.id,
      payerUserId: learnerId,
      idempotencyKey: `pay06h-service-${Date.now()}`,
    });
    assert.ok(session.checkoutSessionId);
  });
});
