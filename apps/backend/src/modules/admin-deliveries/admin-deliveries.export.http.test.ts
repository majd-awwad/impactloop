import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { Express } from 'express';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

const TEST_MARKER = '[test-admin-deliveries-export-http]';

let app: Express;
let adminToken = '';
let learnerToken = '';
let adminUserId = '';
let learnerUserId = '';

before(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp({ recommendationEventOrigin: 'TEST' });

  const passwordHash = await hashPassword('TestPassword123!');
  const admin = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Admin`,
      email: `${TEST_MARKER}-admin-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
    },
  });
  const learner = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner`,
      email: `${TEST_MARKER}-learner-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
    },
  });
  adminUserId = admin.id;
  learnerUserId = learner.id;
  adminToken = signAccessToken({ sub: admin.id, roles: ['ADMIN'] });
  learnerToken = signAccessToken({ sub: learner.id, roles: ['LEARNER'] });
});

after(async () => {
  const ids = [adminUserId, learnerUserId].filter(Boolean);
  if (ids.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
});

const request = async (
  path: string,
  options: { token?: string; method?: string } = {},
) => {
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(
      `http://127.0.0.1:${address.port}${path}`,
      {
        method: options.method ?? 'GET',
        headers: options.token
          ? { Authorization: `Bearer ${options.token}` }
          : undefined,
      },
    );
    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return { status: response.status, body, contentType };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

describe('admin deliveries export HTTP auth', () => {
  test('preflight returns 401 without token', async () => {
    const result = await request('/api/admin/deliveries/export/preflight');
    assert.equal(result.status, 401);
  });

  test('preflight returns 403 for non-admin', async () => {
    const result = await request('/api/admin/deliveries/export/preflight', {
      token: learnerToken,
    });
    assert.equal(result.status, 403);
  });

  test('preflight succeeds for admin without pdf format', async () => {
    const result = await request(
      `/api/admin/deliveries/export/preflight?search=${encodeURIComponent(TEST_MARKER)}`,
      { token: adminToken },
    );
    assert.equal(result.status, 200);
    assert.equal((result.body as { success?: boolean }).success, true);
    const data = (
      result.body as {
        data?: { formats?: Record<string, unknown> };
      }
    ).data;
    assert.ok(data?.formats?.xlsx);
    assert.ok(data?.formats?.csv);
    assert.equal('pdf' in (data?.formats ?? {}), false);
  });

  test('export csv succeeds for admin', async () => {
    const result = await request(
      `/api/admin/deliveries/export?format=csv&search=${encodeURIComponent(`${TEST_MARKER}-none`)}`,
      { token: adminToken },
    );
    assert.equal(result.status, 200);
    assert.match(result.contentType, /text\/csv/);
  });

  test('export xlsx succeeds for admin', async () => {
    const result = await request(
      `/api/admin/deliveries/export?format=xlsx&search=${encodeURIComponent(`${TEST_MARKER}-none`)}`,
      { token: adminToken },
    );
    assert.equal(result.status, 200);
    assert.match(
      result.contentType,
      /spreadsheetml\.sheet|application\/octet-stream/,
    );
    assert.ok(Buffer.isBuffer(result.body));
    assert.equal((result.body as Buffer).subarray(0, 2).toString('utf8'), 'PK');
  });

  test('export pdf is rejected for deliveries', async () => {
    const result = await request(
      '/api/admin/deliveries/export?format=pdf',
      { token: adminToken },
    );
    assert.ok(result.status === 400 || result.status === 422);
  });
});
