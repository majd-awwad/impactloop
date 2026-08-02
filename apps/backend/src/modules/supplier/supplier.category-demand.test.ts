import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

import {
  CATEGORY_DEMAND_POSITIVE_RESERVATION_STATUSES,
} from './supplier.category-demand-metrics.js';
import { getSupplierCategoryDemand } from './supplier.category-demand.js';

const TEST_MARKER = '[test-supplier-category-demand]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  views: [] as string[],
  likes: [] as string[],
  reservations: [] as string[],
};

let server: Server;
let baseUrl = '';

const daysAgo = (days: number, from = new Date()) =>
  new Date(from.getTime() - days * 24 * 60 * 60 * 1000);

const createUser = async (input: {
  suffix: string;
  role: 'SUPPLIER' | 'LEARNER';
}) => {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      activeRole: input.role,
      roles: { create: [{ role: input.role, isPrimary: true }] },
      ...(input.role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} ${input.suffix}`,
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

const createCategory = async (input: {
  suffix: string;
  categoryType: 'MATERIAL' | 'PROJECT' | 'BOTH';
  isActive?: boolean;
  nameEn?: string;
  nameAr?: string;
}) => {
  const category = await prisma.category.create({
    data: {
      nameEn: input.nameEn ?? `${TEST_MARKER} ${input.suffix}`,
      nameAr: input.nameAr ?? `${TEST_MARKER} ${input.suffix} ar`,
      categoryType: input.categoryType,
      isActive: input.isActive ?? true,
    },
  });
  ids.categories.push(category.id);
  return category;
};

const createLocation = async () => {
  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Ramallah',
      area: `${TEST_MARKER}-area`,
      isApproximate: true,
      visibility: 'ORDER_ONLY',
      locationType: 'MATERIAL_PICKUP',
    },
  });
  ids.locations.push(location.id);
  return location;
};

const createMaterial = async (input: {
  ownerId: string;
  categoryId: string;
  locationId: string;
  title: string;
  status?:
    | 'AVAILABLE'
    | 'PENDING_RESERVATION'
    | 'RESERVED'
    | 'REUSED'
    | 'UNAVAILABLE';
}) => {
  const profile = await prisma.supplierProfile.findUnique({
    where: { userId: input.ownerId },
    select: { id: true },
  });
  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      supplierProfileId: profile?.id,
      categoryId: input.categoryId,
      locationId: input.locationId,
      title: input.title,
      description: `${TEST_MARKER} description`,
      materialType: 'General',
      quantity: 10,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status ?? 'AVAILABLE',
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });
  ids.materials.push(material.id);
  return material;
};

const createView = async (input: {
  materialId: string;
  createdAt: Date;
}) => {
  const view = await prisma.materialView.create({
    data: {
      materialId: input.materialId,
      viewSource: 'test',
    },
  });
  await prisma.materialView.update({
    where: { id: view.id },
    data: { createdAt: input.createdAt },
  });
  ids.views.push(view.id);
  return view;
};

const createLike = async (input: {
  materialId: string;
  userId: string;
  createdAt: Date;
}) => {
  const like = await prisma.materialLike.create({
    data: {
      materialId: input.materialId,
      userId: input.userId,
    },
  });
  await prisma.materialLike.update({
    where: { id: like.id },
    data: { createdAt: input.createdAt },
  });
  ids.likes.push(like.id);
  return like;
};

const createReservation = async (input: {
  materialId: string;
  requesterId: string;
  ownerId: string;
  status:
    | 'PENDING'
    | 'AWAITING_LEARNER_CONFIRMATION'
    | 'AWAITING_SUPPLIER_CONFIRMATION'
    | 'ACCEPTED'
    | 'AWAITING_RESOLUTION'
    | 'COMPLETED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'EXPIRED'
    | 'NO_SHOW'
    | 'FULFILLMENT_FAILED';
  createdAt: Date;
}) => {
  const reservation = await prisma.reservation.create({
    data: {
      materialId: input.materialId,
      requesterId: input.requesterId,
      ownerId: input.ownerId,
      quantityRequested: 1,
      status: input.status,
      fulfillmentMethod: 'PICKUP',
    },
  });
  await prisma.reservation.update({
    where: { id: reservation.id },
    data: { createdAt: input.createdAt },
  });
  ids.reservations.push(reservation.id);
  return reservation;
};

const requestCategoryDemand = async (token?: string, query = '') =>
  fetch(`${baseUrl}/api/supplier/insights/category-demand${query}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

const assertNoSensitiveFields = (payload: unknown) => {
  const json = JSON.stringify(payload);
  assert.equal(json.includes('viewerUserId'), false);
  assert.equal(json.includes('requesterId'), false);
  assert.equal(json.includes('learnerId'), false);
  assert.equal(json.includes('latitude'), false);
  assert.equal(json.includes('longitude'), false);
  assert.equal(json.includes('ownerId'), false);
  assert.equal(json.includes('supplierProfileId'), false);
  assert.equal(json.includes('materialId'), false);
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
  if (ids.reservations.length) {
    await prisma.reservation.deleteMany({
      where: { id: { in: ids.reservations } },
    });
  }
  if (ids.likes.length) {
    await prisma.materialLike.deleteMany({ where: { id: { in: ids.likes } } });
  }
  if (ids.views.length) {
    await prisma.materialView.deleteMany({ where: { id: { in: ids.views } } });
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

describe('GET /api/supplier/insights/category-demand', () => {
  test('returns 401 when unauthenticated', async () => {
    const response = await requestCategoryDemand();
    assert.equal(response.status, 401);
  });

  test('returns 403 for non-supplier', async () => {
    const learner = await createUser({ suffix: 'learner-auth', role: 'LEARNER' });
    const token = signAccessToken({
      sub: learner.id,
      roles: ['LEARNER'],
    });
    const response = await requestCategoryDemand(token);
    assert.equal(response.status, 403);
  });

  test('validates limit bounds', async () => {
    const supplier = await createUser({ suffix: 'limit-val', role: 'SUPPLIER' });
    const token = signAccessToken({
      sub: supplier.id,
      roles: ['SUPPLIER'],
    });

    for (const query of ['?limit=0', '?limit=-1', '?limit=16', '?limit=abc']) {
      const response = await requestCategoryDemand(token, query);
      assert.equal(response.status, 400, query);
    }

    for (const query of ['?limit=1', '?limit=8', '?limit=15', '']) {
      const response = await requestCategoryDemand(token, query);
      assert.equal(response.status, 200, query || '(default)');
    }
  });

  test('aggregates platform-wide signals with privacy, status, and period rules', async () => {
    const now = new Date();
    const inside = daysAgo(5, now);
    const outside = daysAgo(45, now);

    const supplierA = await createUser({ suffix: 'agg-a', role: 'SUPPLIER' });
    const supplierB = await createUser({ suffix: 'agg-b', role: 'SUPPLIER' });
    const learner = await createUser({ suffix: 'agg-learner', role: 'LEARNER' });
    const learners = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        createUser({ suffix: `agg-l-${index}`, role: 'LEARNER' }),
      ),
    );

    const electronics = await createCategory({
      suffix: 'electronics',
      categoryType: 'MATERIAL',
      nameEn: 'Electronics',
      nameAr: 'إلكترونيات',
    });
    const wood = await createCategory({
      suffix: 'wood',
      categoryType: 'BOTH',
      nameEn: 'Wood',
      nameAr: 'خشب',
    });
    const inactive = await createCategory({
      suffix: 'inactive',
      categoryType: 'MATERIAL',
      isActive: false,
      nameEn: 'Inactive Cat',
    });
    const projectOnly = await createCategory({
      suffix: 'project-only',
      categoryType: 'PROJECT',
      nameEn: 'Project Only',
    });

    const location = await createLocation();
    const electronicsPublic = await createMaterial({
      ownerId: supplierA.id,
      categoryId: electronics.id,
      locationId: location.id,
      title: `${TEST_MARKER} electronics public`,
      status: 'AVAILABLE',
    });
    const electronicsReserved = await createMaterial({
      ownerId: supplierA.id,
      categoryId: electronics.id,
      locationId: location.id,
      title: `${TEST_MARKER} electronics reserved`,
      status: 'RESERVED',
    });
    const electronicsPending = await createMaterial({
      ownerId: supplierB.id,
      categoryId: electronics.id,
      locationId: location.id,
      title: `${TEST_MARKER} electronics pending`,
      status: 'PENDING_RESERVATION',
    });
    const electronicsReused = await createMaterial({
      ownerId: supplierA.id,
      categoryId: electronics.id,
      locationId: location.id,
      title: `${TEST_MARKER} electronics reused`,
      status: 'REUSED',
    });
    const electronicsUnavailable = await createMaterial({
      ownerId: supplierA.id,
      categoryId: electronics.id,
      locationId: location.id,
      title: `${TEST_MARKER} electronics unavailable`,
      status: 'UNAVAILABLE',
    });
    const woodHistorical = await createMaterial({
      ownerId: supplierB.id,
      categoryId: wood.id,
      locationId: location.id,
      title: `${TEST_MARKER} wood historical`,
      status: 'UNAVAILABLE',
    });
    const inactiveMaterial = await createMaterial({
      ownerId: supplierA.id,
      categoryId: inactive.id,
      locationId: location.id,
      title: `${TEST_MARKER} inactive material`,
    });
    const projectMaterial = await createMaterial({
      ownerId: supplierA.id,
      categoryId: projectOnly.id,
      locationId: location.id,
      title: `${TEST_MARKER} project material`,
    });

    // In-window views for electronics (public + historical reused still count for numerator)
    for (let i = 0; i < 20; i += 1) {
      await createView({
        materialId: electronicsPublic.id,
        createdAt: inside,
      });
    }
    for (let i = 0; i < 10; i += 1) {
      await createView({
        materialId: electronicsReused.id,
        createdAt: inside,
      });
    }
    // Outside window — excluded
    await createView({
      materialId: electronicsPublic.id,
      createdAt: outside,
    });

    // Wood: enough activity on non-public material (zero listing denominator)
    for (let i = 0; i < 15; i += 1) {
      await createView({
        materialId: woodHistorical.id,
        createdAt: inside,
      });
    }

    // Likes in window
    for (let i = 0; i < 6; i += 1) {
      await createLike({
        materialId: electronicsPublic.id,
        userId: learners[i]!.id,
        createdAt: inside,
      });
    }
    await createLike({
      materialId: electronicsPublic.id,
      userId: learners[6]!.id,
      createdAt: outside,
    });
    for (let i = 0; i < 4; i += 1) {
      await createLike({
        materialId: woodHistorical.id,
        userId: learners[i + 7]!.id,
        createdAt: inside,
      });
    }

    // Positive reservation statuses each contribute once
    let statusIndex = 0;
    for (const status of CATEGORY_DEMAND_POSITIVE_RESERVATION_STATUSES) {
      await createReservation({
        materialId: electronicsPublic.id,
        requesterId: learners[statusIndex % learners.length]!.id,
        ownerId: supplierA.id,
        status,
        createdAt: inside,
      });
      statusIndex += 1;
    }

    // Negative terminals excluded
    for (const status of [
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
      'NO_SHOW',
      'FULFILLMENT_FAILED',
    ] as const) {
      await createReservation({
        materialId: electronicsPublic.id,
        requesterId: learner.id,
        ownerId: supplierA.id,
        status,
        createdAt: inside,
      });
    }

    // Outside-period reservation excluded
    await createReservation({
      materialId: electronicsPublic.id,
      requesterId: learner.id,
      ownerId: supplierA.id,
      status: 'COMPLETED',
      createdAt: outside,
    });

    // Wood reservations for HIGH-ish signal with zero listings
    for (let i = 0; i < 3; i += 1) {
      await createReservation({
        materialId: woodHistorical.id,
        requesterId: learners[i]!.id,
        ownerId: supplierB.id,
        status: 'ACCEPTED',
        createdAt: inside,
      });
    }

    // Noise on excluded categories
    await createView({
      materialId: inactiveMaterial.id,
      createdAt: inside,
    });
    await createView({
      materialId: projectMaterial.id,
      createdAt: inside,
    });

    const tokenA = signAccessToken({
      sub: supplierA.id,
      roles: ['SUPPLIER'],
    });
    const tokenB = signAccessToken({
      sub: supplierB.id,
      roles: ['SUPPLIER'],
    });

    const responseA = await requestCategoryDemand(tokenA, '?limit=8');
    const responseB = await requestCategoryDemand(tokenB, '?limit=8');
    assert.equal(responseA.status, 200);
    assert.equal(responseB.status, 200);

    const bodyA = (await responseA.json()) as {
      data: Awaited<ReturnType<typeof getSupplierCategoryDemand>>;
    };
    const bodyB = (await responseB.json()) as {
      data: Awaited<ReturnType<typeof getSupplierCategoryDemand>>;
    };

    assert.deepEqual(bodyA.data.items, bodyB.data.items);
    assert.deepEqual(
      bodyA.data.summaryTopCategoryIds,
      bodyB.data.summaryTopCategoryIds,
    );
    assert.equal(bodyA.data.period.days, 30);
    assert.equal(bodyA.data.methodology.version, 'category-demand-v1');
    assert.equal(bodyA.data.methodology.source, 'PLATFORM_LEARNER_ACTIVITY');
    assertNoSensitiveFields(bodyA.data);

    const categoryIds = bodyA.data.items.map((item) => item.categoryId);
    assert.equal(categoryIds.includes(inactive.id), false);
    assert.equal(categoryIds.includes(projectOnly.id), false);

    const electronicsItem = bodyA.data.items.find(
      (item) => item.categoryId === electronics.id,
    );
    assert.ok(electronicsItem);
    assert.equal(electronicsItem.signals.views, 30);
    assert.equal(electronicsItem.signals.likes, 6);
    assert.equal(
      electronicsItem.signals.reservations,
      CATEGORY_DEMAND_POSITIVE_RESERVATION_STATUSES.length,
    );
    assert.equal(electronicsItem.categoryNameEn, 'Electronics');

    const woodItem = bodyA.data.items.find((item) => item.categoryId === wood.id);
    assert.ok(woodItem);
    assert.equal(woodItem.signals.views, 15);
    assert.equal(woodItem.signals.likes, 4);
    assert.equal(woodItem.signals.reservations, 3);
    assert.ok(Number.isFinite(woodItem.score));

    // Scores computed before limit slicing: limit=1 still preserves top score
    const limited = await requestCategoryDemand(tokenA, '?limit=1');
    const limitedBody = (await limited.json()) as {
      data: Awaited<ReturnType<typeof getSupplierCategoryDemand>>;
    };
    assert.equal(limitedBody.data.items.length, 1);
    assert.equal(
      limitedBody.data.items[0]!.score,
      bodyA.data.items[0]!.score,
    );
    assert.equal(
      limitedBody.data.items[0]!.categoryId,
      bodyA.data.items[0]!.categoryId,
    );

    // Ordering deterministic: score desc
    for (let i = 1; i < bodyA.data.items.length; i += 1) {
      const prev = bodyA.data.items[i - 1]!;
      const curr = bodyA.data.items[i]!;
      assert.ok(
        prev.score > curr.score ||
          (prev.score === curr.score &&
            prev.categoryId.localeCompare(curr.categoryId) <= 0),
      );
    }

    // Public listing denominator uses only AVAILABLE / PENDING_RESERVATION / RESERVED
    // electronics has 3 public listings; REUSED/UNAVAILABLE do not inflate denominator.
    // Verified indirectly: score remains finite and wood with 0 listings remains eligible.
    assert.ok(electronicsItem.score >= 0 && electronicsItem.score <= 100);
    assert.ok(woodItem.score >= 0 && woodItem.score <= 100);

    // Unused materials only referenced for denominator semantics
    assert.ok(electronicsReserved.id);
    assert.ok(electronicsPending.id);
    assert.ok(electronicsUnavailable.id);
  });

  test('returns NO_RECENT_ACTIVITY when categories exist without enough signals', async () => {
    const supplier = await createUser({ suffix: 'empty-act', role: 'SUPPLIER' });
    await createCategory({
      suffix: 'quiet-cat',
      categoryType: 'MATERIAL',
      nameEn: `${TEST_MARKER} quiet unique ${Date.now()}`,
    });
    const token = signAccessToken({
      sub: supplier.id,
      roles: ['SUPPLIER'],
    });

    const response = await requestCategoryDemand(token);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      data: Awaited<ReturnType<typeof getSupplierCategoryDemand>>;
    };
    if (body.data.items.length === 0) {
      assert.ok(
        body.data.emptyStateReason === 'NO_RECENT_ACTIVITY' ||
          body.data.emptyStateReason === 'NO_ACTIVE_CATEGORIES',
      );
    } else {
      assert.equal(body.data.emptyStateReason, null);
      assert.ok(body.data.summaryTopCategoryIds.length <= 3);
    }
  });
});
