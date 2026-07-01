import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import {
  becomeSupplier,
  getAuthenticatedUser,
  switchActiveRole,
} from '../auth/auth.service.js';
import { getSupplierDashboard, getSupplierMaterials } from './supplier.service.js';
import {
  buildSupplierMaterialWhere,
  resolveSupplierContext,
} from './supplier-material-scope.js';

const TEST_MARKER = 'test-supplier-dashboard-existing';

const ids = {
  users: [] as string[],
  materials: [] as string[],
  categories: [] as string[],
  locations: [] as string[],
};

async function createExistingSupplierWithMaterials() {
  const passwordHash = await hashPassword('TestPassword123!');
  const email = `${TEST_MARKER}-${Date.now()}-${Math.random()}@impactloop.test`;

  const category = await prisma.category.findFirst({
    where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
    select: { id: true },
  });

  assert.ok(category, 'Expected at least one material category');
  ids.categories.push(category.id);

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
      displayName: 'Existing Supplier',
      email,
      passwordHash,
      accountStatus: 'ACTIVE',
      activeRole: 'SUPPLIER',
      roles: {
        create: [
          { role: 'LEARNER', isPrimary: false },
          { role: 'SUPPLIER', isPrimary: true },
        ],
      },
      learnerProfile: {
        create: {
          learnerType: 'student',
          skillLevel: 'beginner',
          interests: ['electronics'],
        },
      },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: 'Existing Supplier Shop',
          verificationStatus: 'NOT_REQUIRED',
          defaultPickupLocationId: location.id,
        },
      },
    },
    include: {
      supplierProfile: true,
    },
  });

  ids.users.push(user.id);

  const material = await prisma.material.create({
    data: {
      ownerId: user.id,
      supplierProfileId: user.supplierProfile!.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} Material`,
      description: 'Existing supplier inventory',
      materialType: 'OTHER',
      quantity: 3,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      currency: 'ILS',
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });
  ids.materials.push(material.id);

  return user;
}

async function cleanup() {
  if (ids.materials.length > 0) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
    ids.materials.length = 0;
  }

  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    ids.users.length = 0;
  }

  if (ids.categories.length > 0) {
    ids.categories.length = 0;
  }

  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
    ids.locations.length = 0;
  }
}

describe('existing supplier dashboard scope', () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  test('existing supplier with materials keeps non-zero dashboard after role switch', async () => {
    const user = await createExistingSupplierWithMaterials();

    const asLearner = await switchActiveRole(user.id, 'LEARNER');
    assert.equal(asLearner.user.activeRole, 'LEARNER');

    const learnerDashboard = await getSupplierDashboard(user.id);
    assert.equal(learnerDashboard.stats.materials.total, 1);

    const asSupplier = await switchActiveRole(user.id, 'SUPPLIER');
    assert.equal(asSupplier.user.activeRole, 'SUPPLIER');

    const supplierDashboard = await getSupplierDashboard(user.id);
    assert.equal(supplierDashboard.stats.materials.total, 1);
    assert.equal(supplierDashboard.stats.materials.available, 1);
    assert.equal(supplierDashboard.recentMaterials.length, 1);
  });

  test('become supplier reuses existing profile and keeps material counts', async () => {
    const user = await createExistingSupplierWithMaterials();
    const profilesBefore = await prisma.supplierProfile.count({
      where: { userId: user.id },
    });

    const session = await becomeSupplier(user.id, {
      userId: user.id,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      publicName: 'Should Not Replace',
      pickupArea: 'Nablus, Rafidia',
    });

    const profilesAfter = await prisma.supplierProfile.count({
      where: { userId: user.id },
    });

    assert.equal(profilesBefore, 1);
    assert.equal(profilesAfter, 1);
    assert.equal(session.user.supplierProfile?.publicName, 'Existing Supplier Shop');

    const dashboard = await getSupplierDashboard(user.id);
    assert.equal(dashboard.stats.materials.total, 1);

    const materials = await getSupplierMaterials(user.id, {
      page: 1,
      limit: 20,
      isFree: undefined,
    });
    assert.equal(materials.pagination.totalItems, 1);
  });

  test('/auth/me supplierProfile id matches dashboard supplier profile id', async () => {
    const user = await createExistingSupplierWithMaterials();

    const summary = await getAuthenticatedUser(user.id);
    const dashboard = await getSupplierDashboard(user.id);

    assert.equal(summary.supplierProfile?.id, dashboard.supplier?.id);
  });

  test('material scope matches ownerId and supplierProfileId ownership', async () => {
    const user = await createExistingSupplierWithMaterials();
    const scope = await resolveSupplierContext(user.id);

    const scopedCount = await prisma.material.count({
      where: buildSupplierMaterialWhere(scope),
    });

    assert.equal(scopedCount, 1);
    assert.equal(scope.supplierProfileId, user.supplierProfile!.id);
  });
});
