import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import { getSupplierDashboard } from './supplier.service.js';

const TEST_MARKER = 'test-supplier-dashboard-engagement';

const ids = {
  users: [] as string[],
  materials: [] as string[],
  materialViews: [] as string[],
  locations: [] as string[],
};

async function createSupplierWithMaterialViews() {
  const passwordHash = await hashPassword('TestPassword123!');
  const email = `${TEST_MARKER}-${Date.now()}-${Math.random()}@impactloop.test`;

  const category = await prisma.category.findFirst({
    where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
    select: { id: true },
  });

  assert.ok(category, 'Expected at least one material category');

  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Nablus',
      area: 'Rafidia',
      isApproximate: true,
      visibility: 'PRIVATE',
    },
  });
  ids.locations.push(location.id);

  const user = await prisma.user.create({
    data: {
      displayName: 'Engagement Supplier',
      email,
      passwordHash,
      accountStatus: 'ACTIVE',
      activeRole: 'SUPPLIER',
      roles: {
        create: [{ role: 'SUPPLIER', isPrimary: true }],
      },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: 'Engagement Supplier Shop',
          verificationStatus: 'NOT_REQUIRED',
          defaultPickupLocationId: location.id,
        },
      },
    },
    include: { supplierProfile: true },
  });

  ids.users.push(user.id);

  const material = await prisma.material.create({
    data: {
      ownerId: user.id,
      supplierProfileId: user.supplierProfile!.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} Arduino Uno Boards`,
      description: 'Seeded cached views only',
      materialType: 'OTHER',
      quantity: 2,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      currency: 'ILS',
      pickupAllowed: true,
      deliveryAllowed: false,
      viewsCount: 41,
    },
  });
  ids.materials.push(material.id);

  return { user, material };
}

async function cleanup() {
  if (ids.materialViews.length > 0) {
    await prisma.materialView.deleteMany({
      where: { id: { in: ids.materialViews } },
    });
    ids.materialViews.length = 0;
  }

  if (ids.materials.length > 0) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
    ids.materials.length = 0;
  }

  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    ids.users.length = 0;
  }

  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
    ids.locations.length = 0;
  }
}

describe('supplier dashboard engagement consistency', () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  test('cached material.viewsCount alone does not produce most viewed when MaterialView rows are absent', async () => {
    const { user } = await createSupplierWithMaterialViews();

    const dashboard = await getSupplierDashboard(user.id);

    assert.equal(dashboard.stats.engagement.totalViews, 0);
    assert.equal(dashboard.mostViewedMaterial, null);
  });

  test('total views and most viewed material both use MaterialView records', async () => {
    const { user, material } = await createSupplierWithMaterialViews();

    const view = await prisma.materialView.create({
      data: { materialId: material.id, viewSource: 'DISCOVERY' },
    });
    ids.materialViews.push(view.id);

    const dashboard = await getSupplierDashboard(user.id);

    assert.equal(dashboard.stats.engagement.totalViews, 1);
    assert.ok(dashboard.mostViewedMaterial);
    assert.equal(dashboard.mostViewedMaterial?.title, material.title);
    assert.equal(dashboard.mostViewedMaterial?.viewsCount, 1);
    assert.ok(
      dashboard.stats.engagement.totalViews >=
        (dashboard.mostViewedMaterial?.viewsCount ?? 0),
    );
  });
});
