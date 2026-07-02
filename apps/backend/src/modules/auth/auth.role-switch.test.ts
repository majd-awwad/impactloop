import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';
import { verifyAccessToken } from '../../utils/jwt.js';

import {
  becomeSupplier,
  getAuthenticatedUser,
  switchActiveRole,
} from './auth.service.js';

const TEST_MARKER = 'test-role-switch';

const ids = {
  users: [] as string[],
};

type CreateUserInput = {
  suffix: string;
  roles: ('LEARNER' | 'SUPPLIER' | 'ADMIN' | 'DRIVER')[];
  supplierType?: string;
  withSupplierProfile?: boolean;
  withLearnerProfile?: boolean;
  activeRole?: 'LEARNER' | 'SUPPLIER' | 'ADMIN' | 'DRIVER';
};

async function createUser(input: CreateUserInput) {
  const passwordHash = await hashPassword('TestPassword123!');
  const email = `${TEST_MARKER}-${input.suffix}-${Date.now()}-${Math.random()}@impactloop.test`;

  const user = await prisma.user.create({
    data: {
      displayName: `Role Switch ${input.suffix}`,
      email,
      passwordHash,
      accountStatus: 'ACTIVE',
      activeRole: input.activeRole ?? input.roles[0],
      roles: {
        create: input.roles.map((role, index) => ({
          role,
          isPrimary: index === 0,
        })),
      },
      ...(input.withLearnerProfile
        ? {
            learnerProfile: {
              create: {
                learnerType: 'student',
                skillLevel: 'beginner',
                interests: ['electronics'],
              },
            },
          }
        : {}),
      ...(input.withSupplierProfile
        ? {
            supplierProfile: {
              create: {
                supplierType: input.supplierType ?? 'INDIVIDUAL_SUPPLIER',
                publicName: `Supplier ${input.suffix}`,
                verificationStatus: 'NOT_REQUIRED',
                defaultPickupLocation: {
                  create: {
                    country: 'Palestine',
                    city: 'Nablus',
                    area: 'Rafidia',
                    isApproximate: true,
                    visibility: 'PRIVATE',
                  },
                },
              },
            },
          }
        : {}),
    },
  });

  ids.users.push(user.id);
  return user;
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

async function assertBecomeSupplierRejected(
  userId: string,
  supplierType: string,
): Promise<void> {
  await assert.rejects(
    () =>
      becomeSupplier(userId, {
        userId,
        supplierType,
        publicName: 'Blocked Supplier',
        pickupArea: 'Nablus, Rafidia',
      }),
    (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 400);
      assert.match(
        error.message,
        /student or individual supplier profiles/i,
      );
      return true;
    },
  );
}

describe('auth role switching', () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  test('learner can become STUDENT supplier and keeps LEARNER role', async () => {
    const learner = await createUser({
      suffix: 'student-supplier',
      roles: ['LEARNER'],
      withLearnerProfile: true,
    });

    const { user } = await becomeSupplier(learner.id, {
      userId: learner.id,
      supplierType: 'STUDENT_SUPPLIER',
      publicName: 'Student Supplier',
      description: 'Sharing class leftovers',
      pickupArea: 'Nablus, Rafidia',
    });

    assert.equal(user.roles.includes('LEARNER'), true);
    assert.equal(user.roles.includes('SUPPLIER'), true);
    assert.equal(user.activeRole, 'SUPPLIER');
    assert.equal(user.supplierProfile?.supplierType, 'STUDENT_SUPPLIER');
    assert.equal(user.supplierProfile?.verificationStatus, 'NOT_REQUIRED');
    assert.equal(user.canSwitchToLearner, true);
    assert.equal(user.canSwitchToSupplier, true);
  });

  test('become supplier returns auth session with updated JWT roles', async () => {
    const learner = await createUser({
      suffix: 'jwt-roles',
      roles: ['LEARNER'],
      withLearnerProfile: true,
    });

    const session = await becomeSupplier(learner.id, {
      userId: learner.id,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      publicName: 'JWT Supplier',
      pickupArea: 'Nablus, Rafidia',
    });

    const payload = verifyAccessToken(session.accessToken);
    assert.equal(payload.sub, learner.id);
    assert.equal(payload.roles.includes('LEARNER'), true);
    assert.equal(payload.roles.includes('SUPPLIER'), true);
  });

  test('learner can become INDIVIDUAL supplier and keeps LEARNER role', async () => {
    const learner = await createUser({
      suffix: 'individual-supplier',
      roles: ['LEARNER'],
      withLearnerProfile: true,
    });

    const { user } = await becomeSupplier(learner.id, {
      userId: learner.id,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      publicName: 'Individual Supplier',
      pickupArea: 'Nablus, Rafidia',
    });

    assert.equal(user.roles.includes('LEARNER'), true);
    assert.equal(user.roles.includes('SUPPLIER'), true);
    assert.equal(user.supplierProfile?.supplierType, 'INDIVIDUAL_SUPPLIER');
  });

  test('learner cannot become organization supplier types from become-supplier flow', async () => {
    const learner = await createUser({
      suffix: 'blocked-types',
      roles: ['LEARNER'],
      withLearnerProfile: true,
    });

    for (const supplierType of [
      'WORKSHOP',
      'STORE',
      'FACTORY',
      'UNIVERSITY_LAB',
      'EDUCATIONAL_INSTITUTION',
    ]) {
      await assertBecomeSupplierRejected(learner.id, supplierType);
    }
  });

  test('become supplier does not create duplicate supplier profile', async () => {
    const supplier = await createUser({
      suffix: 'duplicate-profile',
      roles: ['LEARNER', 'SUPPLIER'],
      withLearnerProfile: true,
      withSupplierProfile: true,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      activeRole: 'LEARNER',
    });

    const profilesBefore = await prisma.supplierProfile.count({
      where: { userId: supplier.id },
    });

    const { user } = await becomeSupplier(supplier.id, {
      userId: supplier.id,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      publicName: 'Should Not Duplicate',
      pickupArea: 'Nablus, Rafidia',
    });

    const profilesAfter = await prisma.supplierProfile.count({
      where: { userId: supplier.id },
    });

    assert.equal(profilesBefore, 1);
    assert.equal(profilesAfter, 1);
    assert.equal(user.supplierProfile?.publicName, 'Supplier duplicate-profile');
    assert.equal(user.activeRole, 'SUPPLIER');
  });

  test('student/individual supplier can switch to learner and back without deleting roles', async () => {
    const supplier = await createUser({
      suffix: 'switch-individual',
      roles: ['SUPPLIER'],
      withSupplierProfile: true,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      activeRole: 'SUPPLIER',
    });

    const { user: asLearner } = await switchActiveRole(supplier.id, 'LEARNER');
    assert.equal(asLearner.activeRole, 'LEARNER');
    assert.equal(asLearner.roles.includes('LEARNER'), true);
    assert.equal(asLearner.roles.includes('SUPPLIER'), true);

    const { user: asSupplier } = await switchActiveRole(supplier.id, 'SUPPLIER');
    assert.equal(asSupplier.activeRole, 'SUPPLIER');
    assert.equal(asSupplier.roles.includes('SUPPLIER'), true);
    assert.equal(asSupplier.roles.includes('LEARNER'), true);
  });

  test('organization supplier types cannot switch to learner', async () => {
    for (const supplierType of [
      'WORKSHOP',
      'STORE',
      'FACTORY',
      'UNIVERSITY_LAB',
      'EDUCATIONAL_INSTITUTION',
    ]) {
      const supplier = await createUser({
        suffix: `org-${supplierType.toLowerCase()}`,
        roles: ['SUPPLIER'],
        withSupplierProfile: true,
        supplierType,
        activeRole: 'SUPPLIER',
      });

      await assert.rejects(
        () => switchActiveRole(supplier.id, 'LEARNER'),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 403);
          assert.match(
            error.message,
            /Organization supplier accounts cannot switch to learner mode/i,
          );
          return true;
        },
      );

      const summary = await getAuthenticatedUser(supplier.id);
      assert.equal(summary.canSwitchToLearner, false);
    }
  });

  test('organization supplier with LEARNER role still cannot switch to learner', async () => {
    const workshopLearner = await createUser({
      suffix: 'workshop-with-learner',
      roles: ['LEARNER', 'SUPPLIER'],
      withLearnerProfile: true,
      withSupplierProfile: true,
      supplierType: 'WORKSHOP',
      activeRole: 'SUPPLIER',
    });

    await assert.rejects(
      () => switchActiveRole(workshopLearner.id, 'LEARNER'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );

    const summary = await getAuthenticatedUser(workshopLearner.id);
    assert.equal(summary.canSwitchToLearner, false);
  });

  test('switch role rejects supplier portal without supplier profile', async () => {
    const learner = await createUser({
      suffix: 'no-supplier-profile',
      roles: ['LEARNER'],
      withLearnerProfile: true,
    });

    await assert.rejects(
      () => switchActiveRole(learner.id, 'SUPPLIER'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });

  test('/auth/me summary returns roles, activeRole, and canSwitch flags', async () => {
    const user = await createUser({
      suffix: 'me-summary',
      roles: ['LEARNER', 'SUPPLIER'],
      withLearnerProfile: true,
      withSupplierProfile: true,
      supplierType: 'STUDENT_SUPPLIER',
      activeRole: 'LEARNER',
    });

    const summary = await getAuthenticatedUser(user.id);

    assert.deepEqual(summary.roles.sort(), ['LEARNER', 'SUPPLIER']);
    assert.equal(summary.activeRole, 'LEARNER');
    assert.equal(summary.canSwitchToLearner, true);
    assert.equal(summary.canSwitchToSupplier, true);
    assert.equal(summary.defaultPortalRoute, '/home');
  });

  test('admin role is unaffected by portal switch helpers', async () => {
    const admin = await createUser({
      suffix: 'admin',
      roles: ['ADMIN'],
      activeRole: 'ADMIN',
    });

    const summary = await getAuthenticatedUser(admin.id);

    assert.equal(summary.activeRole, 'ADMIN');
    assert.equal(summary.canSwitchToLearner, false);
    assert.equal(summary.canSwitchToSupplier, false);
    assert.equal(summary.defaultPortalRoute, '/admin');

    await assert.rejects(
      () => switchActiveRole(admin.id, 'LEARNER'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });
});
