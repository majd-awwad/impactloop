import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

import { getCategoryRequestDraft } from './category-requests.service.js';
import {
  createCategoryRequestSchema,
  listingDraftJsonSchema,
} from './category-requests.validation.js';

const TEST_MARKER = '[test-category-requests-contract]';

let baseUrl = '';
let server: Server | null = null;

const ids = {
  users: [] as string[],
  categoryRequests: [] as string[],
};

const validListingDraft = (requestedCategoryName: string) => ({
  materialName: `${TEST_MARKER} Reusable sensor`,
  title: `${TEST_MARKER} Reusable sensor`,
  description: 'Detailed description for admin review of the new category.',
  categoryRequestReason: 'Existing categories do not cover this reusable sensor type.',
  requestedCategoryName,
  condition: 'GOOD' as const,
  quantity: 2,
  unit: 'piece',
  isFree: true,
  currency: 'NIS',
  pickupAllowed: true,
  deliveryAllowed: false,
  imageUrls: [],
});

before(async () => {
  process.env.JWT_ACCESS_SECRET ??= 'category-requests-contract-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'category-requests-contract-refresh-secret';

  const { app } = await import('../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (ids.categoryRequests.length > 0) {
    await prisma.categoryRequest.deleteMany({
      where: { id: { in: ids.categoryRequests } },
    });
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

describe('category requests validation contract', () => {
  test('listing draft requires requested category name and positive quantity', () => {
    assert.equal(
      listingDraftJsonSchema.safeParse({
        materialName: 'Item',
        title: 'Item',
        description: 'Long enough description',
        condition: 'GOOD',
        quantity: 0,
        unit: 'piece',
        isFree: true,
      }).success,
      false,
    );

    assert.equal(
      createCategoryRequestSchema.safeParse({
        requestedName: '',
        listingDraftJson: validListingDraft('New category'),
      }).success,
      false,
    );
  });
});

describe('category requests HTTP security', () => {
  test('unauthenticated and learner requests are rejected', async () => {
    const learner = await createUser('LEARNER', 'auth-learner');
    const learnerToken = signAccessToken({ sub: learner.id, roles: ['LEARNER'] });

    assert.equal((await fetch(`${baseUrl}/api/supplier/category-requests`)).status, 401);
    assert.equal(
      (
        await fetch(`${baseUrl}/api/supplier/category-requests`, {
          headers: { Authorization: `Bearer ${learnerToken}` },
        })
      ).status,
      403,
    );
  });

  test('supplier can submit and list own requests; draft is owner-scoped', async () => {
    const supplier = await createUser('SUPPLIER', 'owner');
    const otherSupplier = await createUser('SUPPLIER', 'other');
    const supplierToken = signAccessToken({ sub: supplier.id, roles: ['SUPPLIER'] });
    const otherToken = signAccessToken({ sub: otherSupplier.id, roles: ['SUPPLIER'] });

    const requestedName = `${TEST_MARKER} Specialized lab consumables`;
    const createResponse = await fetch(`${baseUrl}/api/supplier/category-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supplierToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requestedName,
        listingDraftJson: validListingDraft(requestedName),
      }),
    });
    assert.equal(createResponse.status, 201);

    const created = (await createResponse.json()) as {
      data: { id: string; status: string };
    };
    ids.categoryRequests.push(created.data.id);

    const listResponse = await fetch(`${baseUrl}/api/supplier/category-requests`, {
      headers: { Authorization: `Bearer ${supplierToken}` },
    });
    assert.equal(listResponse.status, 200);
    const listBody = (await listResponse.json()) as {
      data: Array<{ id: string }>;
    };
    assert.ok(listBody.data.some((item) => item.id === created.data.id));

    const ownerDraft = await fetch(
      `${baseUrl}/api/supplier/category-requests/${created.data.id}/draft`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    assert.equal(ownerDraft.status, 200);

    const otherDraft = await fetch(
      `${baseUrl}/api/supplier/category-requests/${created.data.id}/draft`,
      { headers: { Authorization: `Bearer ${otherToken}` } },
    );
    assert.equal(otherDraft.status, 404);
  });
});

describe('category requests service security', () => {
  test('draft lookup rejects cross-owner access', async () => {
    const owner = await createUser('SUPPLIER', 'draft-owner');
    const other = await createUser('SUPPLIER', 'draft-other');

    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} Draft isolation`,
        normalizedRequestedName: `draft-isolation-${Date.now()}`,
        requestedByUserId: owner.id,
        status: 'PENDING',
        listingDraftJson: validListingDraft(`${TEST_MARKER} Draft isolation`),
      },
    });
    ids.categoryRequests.push(request.id);

    await assert.rejects(
      () => getCategoryRequestDraft(other.id, request.id),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 404 && error.code === 'NOT_FOUND',
    );
  });
});
