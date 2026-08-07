import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createServer, type Server } from 'node:http';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';

import { startPaymentCheckout } from './payments.service.js';
import { ensureMaterialPaymentOrder } from './payments.ensure.js';
import {
  cleanupPayTest,
  createPayReservationFixture,
  createPayTestIds,
  createPayUser,
  trackOrder,
} from './payments.test-helpers.js';
import { getPaymentProvider } from './providers/payment-provider.registry.js';
import { MockPaymentProvider } from './providers/mock/mock.provider.js';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

describe('PAY-01B route gating and checkout claim', () => {
  const ids = createPayTestIds();
  let learnerId = '';
  let supplierId = '';
  let server: Server;
  let baseUrl = '';

  before(async () => {
    assert.equal(env.paymentProvider, 'mock');
    assert.equal(env.paymentMockRoutesEnabled, true);

    const learner = await createPayUser(ids, {
      role: 'LEARNER',
      emailSuffix: 'pay01b-learner',
    });
    const supplier = await createPayUser(ids, {
      role: 'SUPPLIER',
      emailSuffix: 'pay01b-supplier',
    });
    learnerId = learner.id;
    supplierId = supplier.id;

    server = createServer(createApp({ recommendationEventOrigin: 'REAL' }));
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

  test('mock routes are available in valid Mock mode', async () => {
    const webhook = await fetch(`${baseUrl}/api/payments/webhooks/mock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    // Mounted route rejects unsigned payload (not a missing-route 404).
    assert.equal(webhook.status, 401);

    const act = await fetch(
      `${baseUrl}/api/payments/mock/checkout/nonexistent/act`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    // Validation middleware runs on the mounted mock act route.
    assert.equal(act.status, 400);
  });

  test('provider checkout is claimed once for the same active attempt', async () => {
    const reservation = await createPayReservationFixture(ids, {
      learnerId,
      supplierId,
      materialSubtotal: 71,
    });
    const ensured = await ensureMaterialPaymentOrder(reservation.id);
    assert.ok(ensured.outcome === 'CREATED' || ensured.outcome === 'EXISTING');
    trackOrder(ids, ensured.order.id);

    const provider = getPaymentProvider();
    assert.ok(provider instanceof MockPaymentProvider);
    let createCheckoutCalls = 0;
    const original = provider.createCheckout.bind(provider);
    provider.createCheckout = async (input) => {
      createCheckoutCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 40));
      return original(input);
    };

    try {
      const [first, second] = await Promise.allSettled([
        startPaymentCheckout({
          orderId: ensured.order.id,
          payerUserId: learnerId,
          idempotencyKey: `pay01b-claim-a-${randomUUID()}`,
        }),
        startPaymentCheckout({
          orderId: ensured.order.id,
          payerUserId: learnerId,
          idempotencyKey: `pay01b-claim-b-${randomUUID()}`,
        }),
      ]);

      const successes = [first, second].filter(
        (row) => row.status === 'fulfilled',
      );
      assert.ok(successes.length >= 1);
      assert.equal(createCheckoutCalls, 1);

      const active = await prisma.paymentAttempt.findMany({
        where: {
          paymentOrderId: ensured.order.id,
          status: { in: ['CREATED', 'PENDING'] },
        },
      });
      assert.equal(active.length, 1);
      assert.ok(active[0]?.providerRef);
    } finally {
      provider.createCheckout = original;
    }
  });
});

describe('PAY-01B fresh migration chain', () => {
  test('migrate deploy on empty DB reaches PAY-01 with payment tables and indexes', async () => {
    const admin = new pg.Client({
      connectionString:
        'postgresql://postgres:123456@127.0.0.1:5433/postgres',
    });
    await admin.connect();
    const dbName = `impactloop_pay01b_${Date.now()}`;
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
    await admin.end();

    const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: backendRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://postgres:123456@127.0.0.1:5433/${dbName}?schema=public`,
      },
      shell: true,
    });

    assert.equal(
      deploy.status,
      0,
      `migrate deploy failed:\n${deploy.stdout}\n${deploy.stderr}`,
    );
    assert.match(
      `${deploy.stdout}\n${deploy.stderr}`,
      /20260805210000_pay01_payment_domain/,
    );

    const db = new pg.Client({
      connectionString: `postgresql://postgres:123456@127.0.0.1:5433/${dbName}`,
    });
    await db.connect();

    try {
      const failed = await db.query(
        `SELECT migration_name FROM _prisma_migrations
         WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL`,
      );
      assert.equal(failed.rowCount, 0);

      const tables = await db.query(
        `SELECT to_regclass('public.payment_orders') AS payment_orders,
                to_regclass('public.payment_attempts') AS payment_attempts,
                to_regclass('public.payment_provider_events') AS payment_provider_events,
                to_regclass('public.payment_refunds') AS payment_refunds`,
      );
      assert.ok(tables.rows[0].payment_orders);
      assert.ok(tables.rows[0].payment_attempts);
      assert.ok(tables.rows[0].payment_provider_events);
      assert.ok(tables.rows[0].payment_refunds);

      const constraints = await db.query(
        `SELECT conname FROM pg_constraint
         WHERE conname IN (
           'payment_orders_purpose_source_check',
           'payment_orders_cycle_positive_check',
           'payment_orders_amount_positive_check',
           'payment_attempts_amount_positive_check',
           'payment_attempts_amount_minor_positive_check'
         )`,
      );
      assert.equal(constraints.rowCount, 5);

      const indexes = await db.query(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = 'public' AND indexname IN (
           'payment_attempts_one_active_per_order_uidx',
           'payment_attempts_provider_provider_ref_uidx',
           'payment_orders_material_cycle_uidx',
           'payment_orders_delivery_fee_cycle_uidx'
         )`,
      );
      assert.equal(indexes.rowCount, 4);

      const learningCols = await db.query(
        `SELECT indexname, indexdef FROM pg_indexes
         WHERE schemaname = 'public'
           AND tablename = 'project_build_learning_answer_attempts'
           AND indexdef ILIKE '%UNIQUE%'
           AND indexdef ILIKE '%assignment_id%'
           AND indexdef ILIKE '%attempt_number%'`,
      );
      assert.ok(
        learningCols.rowCount && learningCols.rowCount > 0,
        'expected unique (assignment_id, attempt_number) index',
      );
    } finally {
      await db.end();
      const cleanup = new pg.Client({
        connectionString:
          'postgresql://postgres:123456@127.0.0.1:5433/postgres',
      });
      await cleanup.connect();
      await cleanup.query(`DROP DATABASE IF EXISTS "${dbName}"`);
      await cleanup.end();
    }
  });
});
