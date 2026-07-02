import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';

import { registerUser } from './auth.service.js';

const TEST_MARKER = 'test-auth-register';

const ids = {
  users: [] as string[],
};

async function cleanup() {
  if (ids.users.length === 0) {
    return;
  }

  await prisma.user.deleteMany({
    where: { id: { in: ids.users } },
  });
  ids.users.length = 0;
}

function testEmail(suffix: string): string {
  return `${TEST_MARKER}-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`;
}

describe('auth registration', () => {
  before(async () => {
    await cleanup();
  });

  after(async () => {
    await cleanup();
  });

  test('registers a supplier-only account with active supplier role', async () => {
    const session = await registerUser({
      displayName: 'Supplier Registration Test',
      email: testEmail('supplier-only'),
      password: 'TestPassword123!',
      roles: ['SUPPLIER'],
      supplierProfile: {
        supplierType: 'Workshop',
        publicName: 'Registration Workshop',
        pickupArea: 'Nablus, Rafidia',
      },
    });
    ids.users.push(session.user.id);

    assert.deepEqual(session.user.roles, ['SUPPLIER']);
    assert.equal(session.user.activeRole, 'SUPPLIER');
    assert.equal(session.user.learnerProfile, null);
    assert.equal(session.user.supplierProfile?.supplierType, 'WORKSHOP');
    assert.equal(session.user.supplierProfile?.publicName, 'Registration Workshop');
    assert.equal(session.user.supplierProfile?.pickupAreaLabel, 'Nablus, Rafidia');
  });

  test('registers a dual learner and supplier account with learner as active role', async () => {
    const session = await registerUser({
      displayName: 'Dual Registration Test',
      email: testEmail('dual-role'),
      password: 'TestPassword123!',
      roles: ['LEARNER', 'SUPPLIER'],
      learnerProfile: {
        learnerType: 'University student',
        skillLevel: 'Beginner',
        interests: ['Home improvement', 'Science experiments'],
      },
      supplierProfile: {
        supplierType: 'Student supplier',
        publicName: 'Student Surplus Shelf',
        pickupArea: 'Ramallah, Al Tireh',
      },
    });
    ids.users.push(session.user.id);

    assert.deepEqual(session.user.roles.sort(), ['LEARNER', 'SUPPLIER']);
    assert.equal(session.user.activeRole, 'LEARNER');
    assert.equal(session.user.learnerProfile?.learnerType, 'University student');
    assert.equal(session.user.supplierProfile?.supplierType, 'STUDENT_SUPPLIER');
    assert.equal(session.user.supplierProfile?.verificationStatus, 'NOT_REQUIRED');
  });
});
