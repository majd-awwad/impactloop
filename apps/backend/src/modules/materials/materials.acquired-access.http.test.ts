import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { Express } from 'express';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

const TEST_MARKER = '[test-material-acquired-access-http]';

let app: Express;
const tokens = new Map<string, string>();
const ids = {
  users: [] as string[],
  categories: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  reservations: [] as string[],
};

async function createLearnerUser(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
    },
  });
  ids.users.push(user.id);
  tokens.set(
    user.id,
    signAccessToken({ sub: user.id, roles: ['LEARNER'] }),
  );
  return user;
}

async function createSupplierUser(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier ${suffix}`,
      email: `${TEST_MARKER}-supplier-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: `${TEST_MARKER} Supplier ${suffix}`,
          verificationStatus: 'APPROVED',
        },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createReusedMaterial(ownerId: string) {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Mat ${Date.now()}`,
      nameAr: `${TEST_MARKER} مادة`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.categories.push(category.id);

  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city: 'Ramallah',
      area: 'Al Bireh',
      isApproximate: true,
    },
  });
  ids.locations.push(location.id);

  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: ownerId },
  });

  const material = await prisma.material.create({
    data: {
      ownerId,
      supplierProfileId: supplierProfile?.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} non-public material`,
      description: `${TEST_MARKER} description`,
      materialType: 'Storage',
      quantity: 0,
      unit: 'bags',
      status: 'REUSED',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      isFree: true,
      currency: 'NIS',
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });
  ids.materials.push(material.id);
  return material;
}

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
    const body = await response.json();
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

before(async () => {
  process.env.NODE_ENV = 'test';
  const { createApp } = await import('../../app.js');
  app = createApp({ recommendationEventOrigin: 'TEST' });
});

after(async () => {
  if (ids.reservations.length > 0) {
    await prisma.reservation.deleteMany({ where: { id: { in: ids.reservations } } });
  }
  if (ids.materials.length > 0) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }
  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }
  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
});

describe('materials acquired access HTTP route', () => {
  test('acquiring learner receives acquired material detail over GET /api/materials/:id', async () => {
    const supplier = await createSupplierUser('supplier');
    const learner = await createLearnerUser('learner');
    const otherLearner = await createLearnerUser('other');
    const material = await createReusedMaterial(supplier.id);

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: learner.id,
        ownerId: supplier.id,
        quantityRequested: 11,
        status: 'COMPLETED',
        fulfillmentMethod: 'PICKUP',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    const acquired = await request(`/api/materials/${material.id}`, {
      token: tokens.get(learner.id),
    });
    assert.equal(acquired.status, 200);
    const acquiredData = (acquired.body as { data?: Record<string, unknown> }).data;
    assert.equal(acquiredData?.isAcquiredView, true);
    assert.equal(acquiredData?.acquiredQuantity, 11);
    assert.equal(acquiredData?.canReserve, false);
    assert.equal(acquiredData?.reserveBlockReason, 'ACQUIRED');
    assert.equal(
      (acquiredData?.supplier as { email?: string } | undefined)?.email,
      undefined,
    );

    const guest = await request(`/api/materials/${material.id}`);
    assert.equal(guest.status, 404);

    const unrelated = await request(`/api/materials/${material.id}`, {
      token: tokens.get(otherLearner.id),
    });
    assert.equal(unrelated.status, 404);
  });
});
