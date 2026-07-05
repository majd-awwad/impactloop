import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';
import { verifyAccessToken } from '../../utils/jwt.js';

import {
  becomeLearner,
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
  expectedStatus = 400,
  expectedMessage = /Unsupported supplier type for this flow|Organization supplier types require a separate verification flow/i,
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
      assert.equal(error.statusCode, expectedStatus);
      assert.match(error.message, expectedMessage);
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

  test('learner self-upgrade rejects organization supplier types', async () => {
    const organizationTypes = [
      'WORKSHOP',
      'FACTORY',
      'EDUCATIONAL_INSTITUTION',
    ] as const;

    for (const supplierType of organizationTypes) {
      const learner = await createUser({
        suffix: `blocked-org-${supplierType.toLowerCase()}`,
        roles: ['LEARNER'],
        withLearnerProfile: true,
      });

      await assertBecomeSupplierRejected(
        learner.id,
        supplierType,
        400,
        /Organization supplier types require a separate verification flow/i,
      );
    }
  });

  test('unsupported supplier types are rejected from become-supplier flow', async () => {
    const learner = await createUser({
      suffix: 'blocked-types',
      roles: ['LEARNER'],
      withLearnerProfile: true,
    });

    for (const supplierType of ['STORE', 'UNIVERSITY_LAB']) {
      await assertBecomeSupplierRejected(learner.id, supplierType);
    }
  });

  test('existing supplier cannot use become-supplier again', async () => {
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

    await assert.rejects(
      () =>
        becomeSupplier(supplier.id, {
          userId: supplier.id,
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: 'Should Not Duplicate',
          pickupArea: 'Nablus, Rafidia',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /already have a supplier profile/i);
        return true;
      },
    );

    const profilesAfter = await prisma.supplierProfile.count({
      where: { userId: supplier.id },
    });

    assert.equal(profilesBefore, 1);
    assert.equal(profilesAfter, 1);
  });

  test('student/individual supplier with learner role can switch to learner and back', async () => {
    const supplier = await createUser({
      suffix: 'switch-individual',
      roles: ['LEARNER', 'SUPPLIER'],
      withLearnerProfile: true,
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

  test('supplier-only account cannot switch to learner without learner role', async () => {
    const supplier = await createUser({
      suffix: 'supplier-only',
      roles: ['SUPPLIER'],
      withSupplierProfile: true,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      activeRole: 'SUPPLIER',
    });

    await assert.rejects(
      () => switchActiveRole(supplier.id, 'LEARNER'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );

    const summary = await getAuthenticatedUser(supplier.id);
    assert.equal(summary.canSwitchToLearner, false);
    assert.equal(summary.canBecomeLearner, true);
  });

  test('student supplier can become learner', async () => {
    const supplier = await createUser({
      suffix: 'become-learner-student',
      roles: ['SUPPLIER'],
      withSupplierProfile: true,
      supplierType: 'STUDENT_SUPPLIER',
      activeRole: 'SUPPLIER',
    });

    const { user } = await becomeLearner(supplier.id, {
      userId: supplier.id,
      learnerType: 'University student',
      skillLevel: 'Beginner',
      interests: ['electronics'],
      bio: 'Learning robotics',
    });

    assert.equal(user.roles.includes('LEARNER'), true);
    assert.equal(user.roles.includes('SUPPLIER'), true);
    assert.equal(user.activeRole, 'LEARNER');
    assert.equal(user.learnerProfile?.learnerType, 'University student');
    assert.equal(user.canSwitchToLearner, true);
    assert.equal(user.canBecomeLearner, false);
  });

  test('individual supplier can become learner', async () => {
    const supplier = await createUser({
      suffix: 'become-learner-individual',
      roles: ['SUPPLIER'],
      withSupplierProfile: true,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      activeRole: 'SUPPLIER',
    });

    const { user } = await becomeLearner(supplier.id, {
      userId: supplier.id,
      learnerType: 'Self learner',
      skillLevel: 'Intermediate',
    });

    assert.equal(user.roles.includes('LEARNER'), true);
    assert.equal(user.supplierProfile?.supplierType, 'INDIVIDUAL_SUPPLIER');
    assert.equal(user.canBecomeLearner, false);
  });

  test('organization suppliers cannot become learner', async () => {
    for (const supplierType of [
      'WORKSHOP',
      'FACTORY',
      'EDUCATIONAL_INSTITUTION',
    ]) {
      const supplier = await createUser({
        suffix: `become-learner-${supplierType.toLowerCase()}`,
        roles: ['SUPPLIER'],
        withSupplierProfile: true,
        supplierType,
        activeRole: 'SUPPLIER',
      });

      await assert.rejects(
        () =>
          becomeLearner(supplier.id, {
            userId: supplier.id,
            learnerType: 'Self learner',
            skillLevel: 'Beginner',
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 403);
          assert.match(
            error.message,
            /Only student and individual suppliers can add learner access/i,
          );
          return true;
        },
      );
    }
  });

  test('admin cannot use become-learner endpoint', async () => {
    const admin = await createUser({
      suffix: 'become-learner-admin',
      roles: ['ADMIN', 'SUPPLIER'],
      withSupplierProfile: true,
      supplierType: 'INDIVIDUAL_SUPPLIER',
      activeRole: 'SUPPLIER',
    });

    await assert.rejects(
      () =>
        becomeLearner(admin.id, {
          userId: admin.id,
          learnerType: 'Self learner',
          skillLevel: 'Beginner',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });

  test('organization supplier types cannot switch to learner', async () => {
    for (const supplierType of [
      'WORKSHOP',
      'FACTORY',
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

  test('admin cannot use become-supplier self-upgrade', async () => {
    const admin = await createUser({
      suffix: 'become-admin',
      roles: ['ADMIN', 'LEARNER'],
      withLearnerProfile: true,
      activeRole: 'ADMIN',
    });

    await assert.rejects(
      () =>
        becomeSupplier(admin.id, {
          userId: admin.id,
          supplierType: 'STUDENT_SUPPLIER',
          publicName: 'Admin Supplier',
          pickupArea: 'Nablus, Rafidia',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
  });

  test('driver cannot use become-supplier self-upgrade', async () => {
    const driver = await createUser({
      suffix: 'become-driver',
      roles: ['DRIVER', 'LEARNER'],
      withLearnerProfile: true,
      activeRole: 'DRIVER',
    });

    await assert.rejects(
      () =>
        becomeSupplier(driver.id, {
          userId: driver.id,
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: 'Driver Supplier',
          pickupArea: 'Nablus, Rafidia',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
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
