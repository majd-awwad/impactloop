import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import { becomeSupplier, getAuthenticatedUser } from '../auth/auth.service.js';
import { listSupplierReservations } from '../supplier-reservations/supplier-reservations.service.js';
import {
  getSupplierDashboard,
  getSupplierMaterials,
  getSupplierProfile,
} from '../supplier/supplier.service.js';

const TEST_MARKER = 'test-new-supplier-empty';

const ids = {
  users: [] as string[],
};

async function createLearner(suffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');
  const email = `${TEST_MARKER}-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`;

  const user = await prisma.user.create({
    data: {
      displayName: `New Supplier ${suffix}`,
      email,
      passwordHash,
      accountStatus: 'ACTIVE',
      activeRole: 'LEARNER',
      roles: {
        create: [{ role: 'LEARNER', isPrimary: true }],
      },
      learnerProfile: {
        create: {
          learnerType: 'student',
          skillLevel: 'beginner',
          interests: ['electronics'],
        },
      },
    },
  });

  ids.users.push(user.id);
  return user;
}

async function becomeStudentSupplier(userId: string) {
  return becomeSupplier(userId, {
    userId,
    supplierType: 'STUDENT_SUPPLIER',
    publicName: 'Empty Student Supplier',
    description: 'Just getting started',
    pickupArea: 'Nablus, Rafidia',
  });
}

async function cleanup() {
  if (ids.users.length === 0) {
    return;
  }

  await prisma.user.deleteMany({
    where: { id: { in: ids.users } },
  });
  ids.users.length = 0;
}

describe('new supplier portal empty data', () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  test('STUDENT supplier profile returns zero stats and empty arrays', async () => {
    const learner = await createLearner('student-profile');
    const { user } = await becomeStudentSupplier(learner.id);

    const profile = await getSupplierProfile(user.id);

    assert.equal(profile.hasSupplierProfile, true);
    assert.equal(profile.stats.materialsCount, 0);
    assert.equal(profile.stats.availableMaterialsCount, 0);
    assert.equal(profile.stats.reusedMaterialsCount, 0);
    assert.equal(profile.stats.followersCount, 0);
    assert.equal(profile.stats.totalViews, 0);
    assert.equal(profile.stats.totalLikes, 0);
    assert.equal(profile.stats.totalReservations, 0);
    assert.deepEqual(profile.materialsPreview, []);
    assert.deepEqual(profile.latestFollowers, []);
    assert.equal(profile.supplier?.verificationStatus, 'NOT_REQUIRED');
    assert.equal(profile.supplier?.organizationProfile, null);
  });

  test('INDIVIDUAL supplier profile returns zero stats and empty arrays', async () => {
    const learner = await createLearner('individual-profile');
    const { user } = await becomeSupplier(learner.id, {
      userId: learner.id,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      publicName: 'Empty Individual Supplier',
      pickupArea: 'Nablus, Rafidia',
    });

    const profile = await getSupplierProfile(user.id);

    assert.equal(profile.hasSupplierProfile, true);
    assert.equal(profile.stats.materialsCount, 0);
    assert.deepEqual(profile.materialsPreview, []);
    assert.equal(profile.supplier?.verificationStatus, 'NOT_REQUIRED');
  });

  test('new supplier dashboard returns zero stats and empty lists', async () => {
    const learner = await createLearner('dashboard');
    const { user } = await becomeStudentSupplier(learner.id);

    const dashboard = await getSupplierDashboard(user.id);

    assert.equal(dashboard.hasSupplierProfile, true);
    assert.equal(dashboard.stats.materials.available, 0);
    assert.equal(dashboard.stats.materials.reused, 0);
    assert.equal(dashboard.stats.reservations.pending, 0);
    assert.equal(dashboard.stats.reservations.accepted, 0);
    assert.equal(dashboard.stats.reservations.completed, 0);
    assert.deepEqual(dashboard.recentMaterials, []);
    assert.deepEqual(dashboard.upcomingPickups, []);
    assert.deepEqual(dashboard.recentActivity, []);
  });

  test('new supplier materials returns empty list', async () => {
    const learner = await createLearner('materials');
    const { user } = await becomeStudentSupplier(learner.id);

    const materials = await getSupplierMaterials(user.id, {
      page: 1,
      limit: 20,
      isFree: undefined,
    });

    assert.deepEqual(materials.items, []);
    assert.equal(materials.pagination.totalItems, 0);
    assert.equal(materials.summary.total, 0);
  });

  test('new supplier reservation requests returns empty list', async () => {
    const learner = await createLearner('requests');
    const { user } = await becomeStudentSupplier(learner.id);

    const pending = await listSupplierReservations(user.id, { status: 'pending' });
    const accepted = await listSupplierReservations(user.id, {
      status: 'accepted',
    });
    const completed = await listSupplierReservations(user.id, {
      status: 'completed',
    });

    assert.deepEqual(pending, []);
    assert.deepEqual(accepted, []);
    assert.deepEqual(completed, []);
  });

  test('/auth/me reflects roles and activeRole after become supplier', async () => {
    const learner = await createLearner('auth-me');
    const { user } = await becomeStudentSupplier(learner.id);

    const summary = await getAuthenticatedUser(user.id);

    assert.deepEqual(summary.roles.sort(), ['LEARNER', 'SUPPLIER']);
    assert.equal(summary.activeRole, 'SUPPLIER');
    assert.equal(summary.canSwitchToLearner, true);
    assert.equal(summary.canSwitchToSupplier, true);
  });
});
