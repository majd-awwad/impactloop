import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

const TEST_MARKER = '[test-learner-material-requests]';
const IDEMPOTENCY = 'test-mr-idempotency-key-01';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  requests: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  matches: [] as string[],
};

let server: Server;
let baseUrl = '';

const createUser = async (suffix: string, role: 'LEARNER' | 'SUPPLIER') => {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${suffix}`,
      email: `${TEST_MARKER}-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      activeRole: role,
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
};

const createCategory = async () => {
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
};

before(async () => {
  process.env.NODE_ENV = 'test';
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (ids.matches.length) {
    await prisma.learnerMaterialRequestMatch.deleteMany({
      where: { id: { in: ids.matches } },
    });
  }
  if (ids.requests.length) {
    await prisma.learnerMaterialRequest.deleteMany({
      where: { id: { in: ids.requests } },
    });
  }
  if (ids.materials.length) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }
  if (ids.users.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  if (ids.locations.length) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }
  if (ids.categories.length) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.categories } },
    });
  }
});

describe('Learner & Supplier material requests', () => {
  test('auth gates and full create/suggest/privacy flow', async () => {
    const learner = await createUser('learner', 'LEARNER');
    const supplier = await createUser('supplier', 'SUPPLIER');
    const otherSupplier = await createUser('supplier-b', 'SUPPLIER');
    const category = await createCategory();

    const learnerToken = signAccessToken({
      sub: learner.id,
      roles: ['LEARNER'],
    });
    const supplierToken = signAccessToken({
      sub: supplier.id,
      roles: ['SUPPLIER'],
    });
    const otherSupplierToken = signAccessToken({
      sub: otherSupplier.id,
      roles: ['SUPPLIER'],
    });

    assert.equal(
      (
        await fetch(`${baseUrl}/api/learner/material-requests`)
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/learner/material-requests`, {
          headers: { Authorization: `Bearer ${supplierToken}` },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/supplier/material-requests`)
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${baseUrl}/api/supplier/material-requests`, {
          headers: { Authorization: `Bearer ${learnerToken}` },
        })
      ).status,
      403,
    );

    const createResponse = await fetch(
      `${baseUrl}/api/learner/material-requests`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${learnerToken}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': IDEMPOTENCY,
        },
        body: JSON.stringify({
          requestedItemName: 'DC motor',
          categoryId: category.id,
          description: 'Need a small 6V DC motor for a robot car.',
          quantity: 2,
          unit: 'piece',
          alternativesAllowed: true,
          locationCountry: 'PS',
          locationCity: 'Ramallah',
          locationArea: 'Al-Bireh',
        }),
      },
    );
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as {
      data: { id: string; status: string; location: { city: string } };
    };
    ids.requests.push(created.data.id);
    assert.equal(created.data.status, 'OPEN');
    assert.equal(created.data.location.city, 'Ramallah');

    const replay = await fetch(`${baseUrl}/api/learner/material-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${learnerToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': IDEMPOTENCY,
      },
      body: JSON.stringify({
        requestedItemName: 'DC motor',
        categoryId: category.id,
        description: 'Need a small 6V DC motor for a robot car.',
        quantity: 2,
        unit: 'piece',
        alternativesAllowed: true,
        locationCountry: 'PS',
        locationCity: 'Ramallah',
        locationArea: 'Al-Bireh',
      }),
    });
    assert.equal(replay.status, 200);

    const duplicate = await fetch(`${baseUrl}/api/learner/material-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${learnerToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'test-mr-idempotency-key-02',
      },
      body: JSON.stringify({
        requestedItemName: 'DC motor',
        categoryId: category.id,
        description: 'Duplicate should fail',
        quantity: 1,
        unit: 'piece',
        locationCity: 'Ramallah',
      }),
    });
    assert.equal(duplicate.status, 409);

    const feed = await fetch(`${baseUrl}/api/supplier/material-requests`, {
      headers: { Authorization: `Bearer ${supplierToken}` },
    });
    assert.equal(feed.status, 200);
    const feedBody = (await feed.json()) as {
      data: { items: Array<Record<string, unknown>> };
    };
    const item = feedBody.data.items.find(
      (entry) => entry.id === created.data.id,
    );
    assert.ok(item);
    const serialized = JSON.stringify(item);
    assert.equal(serialized.includes('learnerId'), false);
    assert.equal(serialized.includes('latitude'), false);
    assert.equal(serialized.includes('sourceSavedLocationId'), false);

    const location = await prisma.location.create({
      data: {
        country: 'PS',
        city: 'Nablus',
        isApproximate: true,
        visibility: 'ORDER_ONLY',
        locationType: 'MATERIAL_PICKUP',
      },
    });
    ids.locations.push(location.id);
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: supplier.id },
    });
    const material = await prisma.material.create({
      data: {
        ownerId: supplier.id,
        supplierProfileId: profile?.id,
        categoryId: category.id,
        locationId: location.id,
        title: 'DC motor 6V',
        description: `${TEST_MARKER} motor`,
        materialType: 'Motor',
        quantity: 5,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        pickupAllowed: true,
        deliveryAllowed: false,
      },
    });
    ids.materials.push(material.id);

    const suggest = await fetch(
      `${baseUrl}/api/supplier/material-requests/${created.data.id}/suggestions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supplierToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ materialId: material.id }),
      },
    );
    assert.equal(suggest.status, 201);
    const suggestBody = (await suggest.json()) as {
      data: { ownMatches?: Array<{ id: string }> };
    };
    const matchId = suggestBody.data.ownMatches?.[0]?.id;
    assert.ok(matchId, 'expected suggestion response to include the created match');
    ids.matches.push(matchId!);

    const otherFeed = await fetch(
      `${baseUrl}/api/supplier/material-requests/${created.data.id}`,
      { headers: { Authorization: `Bearer ${otherSupplierToken}` } },
    );
    assert.equal(otherFeed.status, 200);
    const otherDetail = (await otherFeed.json()) as {
      data: { suggestionCount: number; ownMatches?: unknown[] };
    };
    assert.ok(otherDetail.data.suggestionCount >= 1);
    assert.equal((otherDetail.data.ownMatches ?? []).length, 0);

    const detail = await fetch(
      `${baseUrl}/api/learner/material-requests/${created.data.id}`,
      { headers: { Authorization: `Bearer ${learnerToken}` } },
    );
    assert.equal(detail.status, 200);
    const detailBody = (await detail.json()) as {
      data: {
        matches: Array<{
          id: string;
          canReserve: boolean;
          supplier?: { displayName?: string };
          material?: { title?: string; pickupAllowed?: boolean };
        }>;
        activeSuggestionCount: number;
      };
    };
    assert.ok(detailBody.data.matches.length >= 1);
    const learnerMatch = detailBody.data.matches.find((match) => match.id === matchId);
    assert.ok(learnerMatch);
    assert.equal(learnerMatch?.canReserve, true);
    assert.equal(learnerMatch?.material?.title, 'DC motor 6V');
    assert.ok(learnerMatch?.supplier?.displayName);
    assert.equal(detailBody.data.activeSuggestionCount, 1);

    const detailSerialized = JSON.stringify(detailBody.data);
    assert.equal(detailSerialized.includes('email'), false);
    assert.equal(detailSerialized.includes('phone'), false);

    const dismiss = await fetch(
      `${baseUrl}/api/learner/material-requests/matches/${matchId}/dismiss`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${learnerToken}` },
      },
    );
    assert.equal(dismiss.status, 200);
  });

  test('list only returns the requester\'s own requests', async () => {
    const learnerA = await createUser('list-a', 'LEARNER');
    const learnerB = await createUser('list-b', 'LEARNER');
    const category = await createCategory();
    const tokenA = signAccessToken({ sub: learnerA.id, roles: ['LEARNER'] });
    const tokenB = signAccessToken({ sub: learnerB.id, roles: ['LEARNER'] });

    const createForLearner = async (token: string, key: string, name: string) => {
      const response = await fetch(`${baseUrl}/api/learner/material-requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          requestedItemName: name,
          categoryId: category.id,
          quantity: 1,
          unit: 'piece',
          locationCity: 'Ramallah',
        }),
      });
      assert.equal(response.status, 201);
      const body = (await response.json()) as { data: { id: string } };
      ids.requests.push(body.data.id);
      return body.data.id;
    };

    const requestAId = await createForLearner(tokenA, 'list-own-a-key-000001', 'Resistor pack');
    const requestBId = await createForLearner(tokenB, 'list-own-b-key-000001', 'Capacitor pack');

    const listA = await fetch(`${baseUrl}/api/learner/material-requests`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.equal(listA.status, 200);
    const listABody = (await listA.json()) as {
      data: { items: Array<{ id: string }> };
    };
    assert.ok(listABody.data.items.some((item) => item.id === requestAId));
    assert.equal(
      listABody.data.items.some((item) => item.id === requestBId),
      false,
    );

    const listB = await fetch(`${baseUrl}/api/learner/material-requests`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const listBBody = (await listB.json()) as {
      data: { items: Array<{ id: string }> };
    };
    assert.ok(listBBody.data.items.some((item) => item.id === requestBId));
    assert.equal(
      listBBody.data.items.some((item) => item.id === requestAId),
      false,
    );
  });

  test('cancel and fulfill only apply to OPEN requests', async () => {
    const learner = await createUser('cancel-fulfill', 'LEARNER');
    const category = await createCategory();
    const token = signAccessToken({ sub: learner.id, roles: ['LEARNER'] });

    const createRequest = async (key: string, name: string) => {
      const response = await fetch(`${baseUrl}/api/learner/material-requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          requestedItemName: name,
          categoryId: category.id,
          quantity: 1,
          unit: 'piece',
          locationCity: 'Ramallah',
        }),
      });
      assert.equal(response.status, 201);
      const body = (await response.json()) as { data: { id: string } };
      ids.requests.push(body.data.id);
      return body.data.id;
    };

    const cancelRequestId = await createRequest('cancel-key-000000001', 'Servo motor');
    const cancelResponse = await fetch(
      `${baseUrl}/api/learner/material-requests/${cancelRequestId}/cancel`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(cancelResponse.status, 200);
    const cancelBody = (await cancelResponse.json()) as { data: { status: string } };
    assert.equal(cancelBody.data.status, 'CANCELLED');

    const cancelAgain = await fetch(
      `${baseUrl}/api/learner/material-requests/${cancelRequestId}/cancel`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(cancelAgain.status, 409);

    const fulfillRequestId = await createRequest('fulfill-key-000000001', 'LED strip');
    const fulfillResponse = await fetch(
      `${baseUrl}/api/learner/material-requests/${fulfillRequestId}/fulfill`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(fulfillResponse.status, 200);
    const fulfillBody = (await fulfillResponse.json()) as { data: { status: string } };
    assert.equal(fulfillBody.data.status, 'FULFILLED');

    const fulfillAgain = await fetch(
      `${baseUrl}/api/learner/material-requests/${fulfillRequestId}/fulfill`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(fulfillAgain.status, 409);
  });

  test('duplicate creates a new OPEN request only from cancelled or expired requests', async () => {
    const learner = await createUser('duplicate', 'LEARNER');
    const category = await createCategory();
    const token = signAccessToken({ sub: learner.id, roles: ['LEARNER'] });

    const createResponse = await fetch(`${baseUrl}/api/learner/material-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'duplicate-key-000000001',
      },
      body: JSON.stringify({
        requestedItemName: 'Arduino board',
        categoryId: category.id,
        quantity: 1,
        unit: 'piece',
        locationCity: 'Ramallah',
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as { data: { id: string } };
    ids.requests.push(created.data.id);

    const duplicateWhileOpen = await fetch(
      `${baseUrl}/api/learner/material-requests/${created.data.id}/duplicate`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(duplicateWhileOpen.status, 409);

    const cancelResponse = await fetch(
      `${baseUrl}/api/learner/material-requests/${created.data.id}/cancel`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(cancelResponse.status, 200);

    const duplicateResponse = await fetch(
      `${baseUrl}/api/learner/material-requests/${created.data.id}/duplicate`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
    );
    assert.equal(duplicateResponse.status, 201);
    const duplicated = (await duplicateResponse.json()) as {
      data: { id: string; status: string; requestedItemName: string };
    };
    ids.requests.push(duplicated.data.id);
    assert.notEqual(duplicated.data.id, created.data.id);
    assert.equal(duplicated.data.status, 'OPEN');
    assert.equal(duplicated.data.requestedItemName, 'Arduino board');
  });

  test('a request is filtered out of its own learner-as-supplier feed', async () => {
    const hybrid = await createUser('hybrid', 'LEARNER');
    const learnerToken = signAccessToken({ sub: hybrid.id, roles: ['LEARNER'] });
    const supplierToken = signAccessToken({ sub: hybrid.id, roles: ['SUPPLIER'] });
    const category = await createCategory();

    const createResponse = await fetch(`${baseUrl}/api/learner/material-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${learnerToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'hybrid-self-feed-key-001',
      },
      body: JSON.stringify({
        requestedItemName: 'Breadboard',
        categoryId: category.id,
        quantity: 1,
        unit: 'piece',
        locationCity: 'Ramallah',
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as { data: { id: string } };
    ids.requests.push(created.data.id);

    const feed = await fetch(`${baseUrl}/api/supplier/material-requests`, {
      headers: { Authorization: `Bearer ${supplierToken}` },
    });
    assert.equal(feed.status, 200);
    const feedBody = (await feed.json()) as {
      data: { items: Array<{ id: string }> };
    };
    assert.equal(
      feedBody.data.items.some((item) => item.id === created.data.id),
      false,
    );

    const detail = await fetch(
      `${baseUrl}/api/supplier/material-requests/${created.data.id}`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    assert.equal(detail.status, 404);
  });

  test('weak matches require confirmation before a suggestion is created', async () => {
    const learner = await createUser('weak-learner', 'LEARNER');
    const supplier = await createUser('weak-supplier', 'SUPPLIER');
    const requestCategory = await createCategory();
    const otherCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Textiles`,
        nameAr: `${TEST_MARKER} أقمشة`,
        categoryType: 'MATERIAL',
        isActive: true,
      },
    });
    ids.categories.push(otherCategory.id);

    const learnerToken = signAccessToken({ sub: learner.id, roles: ['LEARNER'] });
    const supplierToken = signAccessToken({ sub: supplier.id, roles: ['SUPPLIER'] });

    const createResponse = await fetch(`${baseUrl}/api/learner/material-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${learnerToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'weak-match-key-000000001',
      },
      body: JSON.stringify({
        requestedItemName: 'Zzyzx unrelated widget',
        categoryId: requestCategory.id,
        quantity: 1,
        unit: 'piece',
        locationCity: 'Ramallah',
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as { data: { id: string } };
    ids.requests.push(created.data.id);

    const location = await prisma.location.create({
      data: {
        country: 'PS',
        city: 'Nablus',
        isApproximate: true,
        visibility: 'ORDER_ONLY',
        locationType: 'MATERIAL_PICKUP',
      },
    });
    ids.locations.push(location.id);
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: supplier.id },
    });
    const material = await prisma.material.create({
      data: {
        ownerId: supplier.id,
        supplierProfileId: profile?.id,
        categoryId: otherCategory.id,
        locationId: location.id,
        title: 'Completely unrelated fabric roll',
        description: `${TEST_MARKER} unrelated`,
        materialType: 'Fabric',
        quantity: 5,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        pickupAllowed: true,
        deliveryAllowed: false,
      },
    });
    ids.materials.push(material.id);

    const weakAttempt = await fetch(
      `${baseUrl}/api/supplier/material-requests/${created.data.id}/suggestions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supplierToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ materialId: material.id }),
      },
    );
    assert.equal(weakAttempt.status, 409);
    const weakBody = (await weakAttempt.json()) as { error: { code: string } };
    assert.equal(weakBody.error.code, 'WEAK_MATCH_CONFIRMATION_REQUIRED');

    const confirmed = await fetch(
      `${baseUrl}/api/supplier/material-requests/${created.data.id}/suggestions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supplierToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ materialId: material.id, confirmWeakMatch: true }),
      },
    );
    assert.equal(confirmed.status, 201);
    const confirmedBody = (await confirmed.json()) as {
      data: { ownMatches?: Array<{ id: string }> };
    };
    const confirmedMatchId = confirmedBody.data.ownMatches?.[0]?.id;
    if (confirmedMatchId) {
      ids.matches.push(confirmedMatchId);
    }
  });

  test('candidate materials endpoint returns ranked owned materials', async () => {
    const learner = await createUser('candidate-learner', 'LEARNER');
    const supplier = await createUser('candidate-supplier', 'SUPPLIER');
    const category = await createCategory();
    const learnerToken = signAccessToken({ sub: learner.id, roles: ['LEARNER'] });
    const supplierToken = signAccessToken({ sub: supplier.id, roles: ['SUPPLIER'] });

    const createResponse = await fetch(`${baseUrl}/api/learner/material-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${learnerToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': 'candidate-key-000000001',
      },
      body: JSON.stringify({
        requestedItemName: 'Copper wire spool',
        categoryId: category.id,
        quantity: 1,
        unit: 'piece',
        locationCity: 'Ramallah',
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as { data: { id: string } };
    ids.requests.push(created.data.id);

    const location = await prisma.location.create({
      data: {
        country: 'PS',
        city: 'Nablus',
        isApproximate: true,
        visibility: 'ORDER_ONLY',
        locationType: 'MATERIAL_PICKUP',
      },
    });
    ids.locations.push(location.id);
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: supplier.id },
    });
    const material = await prisma.material.create({
      data: {
        ownerId: supplier.id,
        supplierProfileId: profile?.id,
        categoryId: category.id,
        locationId: location.id,
        title: 'Copper wire spool 10m',
        description: `${TEST_MARKER} copper wire`,
        materialType: 'Wire',
        quantity: 3,
        unit: 'piece',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        pickupAllowed: true,
        deliveryAllowed: false,
      },
    });
    ids.materials.push(material.id);

    const candidates = await fetch(
      `${baseUrl}/api/supplier/material-requests/${created.data.id}/candidate-materials`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    assert.equal(candidates.status, 200);
    const candidatesBody = (await candidates.json()) as {
      data: { items: Array<{ materialId: string }> };
    };
    assert.ok(
      candidatesBody.data.items.some((item) => item.materialId === material.id),
    );
  });
});
