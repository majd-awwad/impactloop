import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import {
  ADMIN_ACTIVITY_ACTIONS,
  listAdminActivityLogs,
  logAdminActivity,
} from './admin-activity-log.js';
import { suspendAdminPerson, reactivateAdminPerson } from '../admin-people/admin-people.service.js';
import { createEmailInvitation } from '../invitations/invitations.service.js';

const TEST_MARKER = '[test-admin-audit-logs]';

type TestContext = {
  actorAdminId: string;
  supplierId: string;
  userIds: string[];
  invitationIds: string[];
};

const ctx: TestContext = {
  actorAdminId: '',
  supplierId: '',
  userIds: [],
  invitationIds: [],
};

async function createUser(input: {
  suffix: string;
  role: 'ADMIN' | 'SUPPLIER';
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
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

describe('admin audit logs', () => {
  before(async () => {
    const actorAdmin = await createUser({ suffix: 'actor-admin', role: 'ADMIN' });
    const supplier = await createUser({ suffix: 'supplier', role: 'SUPPLIER' });

    ctx.actorAdminId = actorAdmin.id;
    ctx.supplierId = supplier.id;

    await suspendAdminPerson(ctx.actorAdminId, ctx.supplierId, {
      reason: 'Audit log integration test suspension.',
    });

    const invitation = await createEmailInvitation(ctx.actorAdminId, {
      recipientEmail: `${TEST_MARKER}-invite-${Date.now()}@impactloop.test`,
      role: 'DRIVER',
      expiresInMinutes: 60,
    });
    ctx.invitationIds.push(invitation.id);
  });

  after(async () => {
    if (ctx.invitationIds.length > 0) {
      await prisma.roleInvitation.deleteMany({
        where: { id: { in: ctx.invitationIds } },
      });
    }

    if (ctx.userIds.length > 0) {
      await prisma.adminActivityLog.deleteMany({
        where: {
          OR: [
            { actorUserId: { in: ctx.userIds } },
            { targetId: { in: ctx.userIds } },
          ],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: ctx.userIds } } });
    }
  });

  test('lists audit logs newest first with pagination and summary', async () => {
    const all = await listAdminActivityLogs({
      page: 1,
      limit: 20,
      search: TEST_MARKER,
    });

    assert.ok(all.items.length >= 1);
    assert.ok(all.pagination.total >= 1);
    assert.ok(all.pagination.totalPages >= 1);
    assert.equal(typeof all.summary.total, 'number');
    assert.equal(typeof all.summary.today, 'number');
    assert.equal(typeof all.summary.thisWeek, 'number');
    assert.ok(all.filterOptions.actions.some((item) => item.value === 'USER_SUSPENDED'));
    assert.ok(
      all.filterOptions.actions.some((item) => item.value === 'INVITATION_CREATED'),
    );
    assert.ok(all.filterOptions.targetTypes.some((item) => item.value === 'USER'));
    assert.ok(
      all.filterOptions.targetTypes.some((item) => item.value === 'INVITATION'),
    );
  });

  test('action, actor, and target type filters work', async () => {
    const filtered = await listAdminActivityLogs({
      page: 1,
      limit: 20,
      action: 'USER_SUSPENDED',
      actorId: ctx.actorAdminId,
      targetType: 'USER',
    });

    assert.ok(filtered.items.length >= 1);
    for (const item of filtered.items) {
      assert.equal(item.action, 'USER_SUSPENDED');
      assert.equal(item.actorUserId, ctx.actorAdminId);
      assert.equal(item.targetType, 'USER');
    }
  });

  test('search matches actor and target labels', async () => {
    const byTarget = await listAdminActivityLogs({
      page: 1,
      limit: 20,
      search: TEST_MARKER,
    });
    assert.ok(byTarget.items.length >= 1);

    const byActionLabel = await listAdminActivityLogs({
      page: 1,
      limit: 20,
      search: 'suspended',
    });
    assert.ok(byActionLabel.items.some((item) => item.action === 'USER_SUSPENDED'));
  });

  test('reactivate writes USER_REACTIVATED log', async () => {
    await reactivateAdminPerson(ctx.actorAdminId, ctx.supplierId);

    const logs = await listAdminActivityLogs({
      page: 1,
      limit: 20,
      action: 'USER_REACTIVATED',
      actorId: ctx.actorAdminId,
    });

    assert.ok(logs.items.some((item) => item.targetId === ctx.supplierId));
  });

  test('invitation create writes INVITATION_CREATED log', async () => {
    const logs = await listAdminActivityLogs({
      page: 1,
      limit: 20,
      action: 'INVITATION_CREATED',
      actorId: ctx.actorAdminId,
    });

    assert.ok(logs.items.length >= 1);
    assert.equal(logs.items[0]!.targetType, 'INVITATION');
  });

  test('filter options include known actions even when empty result set', async () => {
    const result = await listAdminActivityLogs({
      page: 1,
      limit: 20,
      search: 'definitely-no-match-xyz-12345',
    });

    assert.equal(result.items.length, 0);
    assert.ok(
      result.filterOptions.actions.some(
        (item) => item.value === ADMIN_ACTIVITY_ACTIONS.MATERIAL_HIDDEN,
      ),
    );
    assert.ok(result.filterOptions.actions.every((item) => item.label.length > 0));
  });

  test('manual log entry supports expanded action labels', async () => {
    await logAdminActivity({
      actorUserId: ctx.actorAdminId,
      action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_HIDDEN,
      targetType: 'MATERIAL',
      targetId: 'material-test-id',
      targetLabel: `${TEST_MARKER} Hidden material`,
      metadata: { reason: 'Test hide reason' },
    });

    const logs = await listAdminActivityLogs({
      page: 1,
      limit: 5,
      action: 'MATERIAL_HIDDEN',
      search: TEST_MARKER,
    });

    assert.ok(logs.items.length >= 1);
    assert.equal(logs.items[0]!.actionLabel, 'Material hidden');
    assert.equal(logs.items[0]!.targetType, 'MATERIAL');
  });
});
