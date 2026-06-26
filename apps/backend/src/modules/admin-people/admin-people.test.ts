import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import {
  listAdminPeople,
  reactivateAdminPerson,
  suspendAdminPerson,
} from './admin-people.service.js';

const TEST_MARKER = '[test-admin-people]';

type TestContext = {
  actorAdminId: string;
  otherAdminId: string;
  supplierId: string;
  learnerId: string;
  userIds: string[];
};

const ctx: TestContext = {
  actorAdminId: '',
  otherAdminId: '',
  supplierId: '',
  learnerId: '',
  userIds: [],
};

async function createUser(input: {
  suffix: string;
  role: 'ADMIN' | 'SUPPLIER' | 'LEARNER' | 'DRIVER' | 'MODERATOR';
  accountStatus?: 'ACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: input.accountStatus ?? 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: input.role, isPrimary: true }] },
      supplierProfile:
        input.role === 'SUPPLIER'
          ? {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} Supplier ${input.suffix}`,
                verificationStatus: 'NOT_REQUIRED',
              },
            }
          : undefined,
    },
  });
  ctx.userIds.push(user.id);
  return user;
}

describe('admin people management', () => {
  before(async () => {
    const actorAdmin = await createUser({ suffix: 'actor-admin', role: 'ADMIN' });
    const otherAdmin = await createUser({ suffix: 'other-admin', role: 'ADMIN' });
    const supplier = await createUser({ suffix: 'supplier', role: 'SUPPLIER' });
    const learner = await createUser({ suffix: 'learner', role: 'LEARNER' });

    ctx.actorAdminId = actorAdmin.id;
    ctx.otherAdminId = otherAdmin.id;
    ctx.supplierId = supplier.id;
    ctx.learnerId = learner.id;
  });

  after(async () => {
    if (ctx.userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
    }
  });

  test('admin can list people with action flags', async () => {
    const result = await listAdminPeople(ctx.actorAdminId, {
      tab: 'ALL',
      page: 1,
      limit: 50,
    });

    assert.ok(result.items.length > 0);
    const supplier = result.items.find((item) => item.userId === ctx.supplierId);
    const admin = result.items.find((item) => item.userId === ctx.otherAdminId);
    const actor = result.items.find((item) => item.userId === ctx.actorAdminId);

    assert.ok(supplier);
    assert.equal(supplier!.canSuspend, true);
    assert.equal(supplier!.isProtectedAdmin, false);

    assert.ok(admin);
    assert.equal(admin!.canSuspend, false);
    assert.equal(admin!.isProtectedAdmin, true);

    assert.ok(actor);
    assert.equal(actor!.canSuspend, false);
  });

  test('admin cannot suspend themselves', async () => {
    await assert.rejects(
      () => suspendAdminPerson(ctx.actorAdminId, ctx.actorAdminId, {}),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        assert.match(error.message, /your own account/i);
        return true;
      },
    );
  });

  test('admin cannot suspend another admin account', async () => {
    await assert.rejects(
      () => suspendAdminPerson(ctx.actorAdminId, ctx.otherAdminId, {}),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 403);
        assert.match(error.message, /Admin accounts cannot be suspended/i);
        return true;
      },
    );
  });

  test('admin can suspend and reactivate a supplier', async () => {
    const suspended = await suspendAdminPerson(ctx.actorAdminId, ctx.supplierId, {
      reason: 'Policy violation during test.',
    });
    assert.equal(suspended.accountStatus, 'SUSPENDED');
    assert.equal(suspended.canReactivate, true);

    const reactivated = await reactivateAdminPerson(ctx.actorAdminId, ctx.supplierId);
    assert.equal(reactivated.accountStatus, 'ACTIVE');
    assert.equal(reactivated.canSuspend, true);
  });

  test('admin targets are flagged as protected in list responses', async () => {
    const result = await listAdminPeople(ctx.actorAdminId, {
      tab: 'ADMINS',
      page: 1,
      limit: 20,
    });

    assert.ok(result.items.length >= 1);
    for (const item of result.items) {
      assert.equal(item.isProtectedAdmin, true);
      assert.equal(item.canSuspend, false);
      assert.equal(item.canReactivate, false);
    }
  });

  test('learners tab excludes supplier driver moderator admin accounts', async () => {
    const result = await listAdminPeople(ctx.actorAdminId, {
      tab: 'LEARNERS',
      page: 1,
      limit: 50,
    });

    for (const item of result.items) {
      assert.equal(item.isProtectedAdmin, false);
      assert.equal(item.roles.includes('SUPPLIER'), false);
      assert.equal(item.roles.includes('DRIVER'), false);
      assert.equal(item.roles.includes('MODERATOR'), false);
      assert.equal(item.roles.includes('ADMIN'), false);
      assert.equal(item.isLearnerOnly, true);
    }
  });
});
