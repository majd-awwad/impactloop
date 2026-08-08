import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

import { getPriceRuleRequestDraft } from './price-rule-requests.service.js';
import { createPriceRuleRequestSchema } from './price-rule-requests.validation.js';

const TEST_MARKER = '[test-price-rule-requests-contract]';

let baseUrl = '';
let server: Server | null = null;

const ids = {
  users: [] as string[],
  categories: [] as string[],
  priceRuleRequests: [] as string[],
};

before(async () => {
  process.env.JWT_ACCESS_SECRET ??= 'price-rule-requests-contract-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'price-rule-requests-contract-refresh-secret';

  const { app } = await import('../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (ids.priceRuleRequests.length > 0) {
    await prisma.priceRuleRequest.deleteMany({
      where: { id: { in: ids.priceRuleRequests } },
    });
  }
  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  if (ids.users.length > 0) {
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.supplierProfile.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.learnerProfile.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
});

async function createUser(role: 'SUPPLIER' | 'LEARNER', suffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${suffix}`,
      email: `${TEST_MARKER}-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role, isPrimary: true }] },
      ...(role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} ${suffix}`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {
            learnerProfile: {
              create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
            },
          }),
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createMaterialCategory() {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Electronics`,
      nameAr: `${TEST_MARKER} إلكترونيات`,
      categoryType: 'MATERIAL',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
}

describe('price rule requests validation contract', () => {
  test('requires categoryId and known or unknown material identity', () => {
    assert.equal(
      createPriceRuleRequestSchema.safeParse({
        materialName: 'Wire',
        unit: 'meter',
      }).success,
      false,
    );

    assert.equal(
      createPriceRuleRequestSchema.safeParse({
        categoryId: 'cat-1',
        materialName: 'Wire',
        unit: 'meter',
      }).success,
      true,
    );

    assert.equal(
      createPriceRuleRequestSchema.safeParse({
        categoryId: 'cat-1',
        materialTypeId: 'type-1',
      }).success,
      true,
    );
  });
});

describe('price rule requests HTTP security', () => {
  test('create endpoint requires authentication', async () => {
    const category = await createMaterialCategory();

    const response = await fetch(`${baseUrl}/api/price-rule-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: category.id,
        materialName: `${TEST_MARKER} Sensor board`,
        unit: 'piece',
      }),
    });

    assert.equal(response.status, 401);
  });

  test('supplier list and draft endpoints reject unauthenticated and learner access', async () => {
    const learner = await createUser('LEARNER', 'auth-learner');
    const learnerToken = signAccessToken({ sub: learner.id, roles: ['LEARNER'] });

    assert.equal(
      (await fetch(`${baseUrl}/api/supplier/price-rule-requests`)).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/supplier/price-rule-requests`, {
          headers: { Authorization: `Bearer ${learnerToken}` },
        })
      ).status,
      403,
    );

    assert.equal(
      (await fetch(`${baseUrl}/api/supplier/price-rule-requests/some-id/draft`)).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/supplier/price-rule-requests/some-id/draft`, {
          headers: { Authorization: `Bearer ${learnerToken}` },
        })
      ).status,
      403,
    );
  });

  test('supplier can list own requests and draft is owner-scoped', async () => {
    const supplier = await createUser('SUPPLIER', 'owner');
    const otherSupplier = await createUser('SUPPLIER', 'other');
    const category = await createMaterialCategory();
    const supplierToken = signAccessToken({ sub: supplier.id, roles: ['SUPPLIER'] });
    const otherToken = signAccessToken({ sub: otherSupplier.id, roles: ['SUPPLIER'] });

    const request = await prisma.priceRuleRequest.create({
      data: {
        requestedByUserId: supplier.id,
        categoryId: category.id,
        materialName: `${TEST_MARKER} Custom PCB`,
        normalizedMaterialName: `custom-pcb-${Date.now()}`,
        unit: 'piece',
        status: 'PENDING',
      },
    });
    ids.priceRuleRequests.push(request.id);

    const listResponse = await fetch(`${baseUrl}/api/supplier/price-rule-requests`, {
      headers: { Authorization: `Bearer ${supplierToken}` },
    });
    assert.equal(listResponse.status, 200);
    const listBody = (await listResponse.json()) as {
      data: { requests: Array<{ id: string }> };
    };
    assert.ok(listBody.data.requests.some((item) => item.id === request.id));

    const ownerDraft = await fetch(
      `${baseUrl}/api/supplier/price-rule-requests/${request.id}/draft`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    assert.equal(ownerDraft.status, 200);

    const otherDraft = await fetch(
      `${baseUrl}/api/supplier/price-rule-requests/${request.id}/draft`,
      { headers: { Authorization: `Bearer ${otherToken}` } },
    );
    assert.equal(otherDraft.status, 404);
  });
});

describe('price rule requests service security', () => {
  test('draft lookup rejects cross-owner access', async () => {
    const owner = await createUser('SUPPLIER', 'draft-owner');
    const other = await createUser('SUPPLIER', 'draft-other');
    const category = await createMaterialCategory();

    const request = await prisma.priceRuleRequest.create({
      data: {
        requestedByUserId: owner.id,
        categoryId: category.id,
        materialName: `${TEST_MARKER} Draft isolation item`,
        normalizedMaterialName: `draft-isolation-${Date.now()}`,
        unit: 'piece',
        status: 'PENDING',
      },
    });
    ids.priceRuleRequests.push(request.id);

    await assert.rejects(
      () => getPriceRuleRequestDraft(other.id, request.id),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 404 && error.code === 'NOT_FOUND',
    );
  });
});
