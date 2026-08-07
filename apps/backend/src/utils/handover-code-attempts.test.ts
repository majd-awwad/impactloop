import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../database/prisma.js';
import {
  getHandoverCodeAttemptPolicy,
  resetHandoverCodeAttemptsForTests,
  resolveHandoverCodeAttemptPolicy,
  verifyHandoverCodeWithAttemptLimit,
} from './handover-code-attempts.js';
import { hashHandoverCode } from './handover-codes.js';
import { hashPassword } from './password.js';

const TEST_MARKER = '[test-handover-code-attempts]';

describe('handover code attempt limiting', () => {
  let userId: string;

  before(async () => {
    const passwordHash = await hashPassword('TestPassword123!');
    const user = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} user`,
        email: `${TEST_MARKER}-${Date.now()}@impactloop.test`,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    userId = user.id;
  });

  after(async () => {
    await resetHandoverCodeAttemptsForTests(prisma);
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  test('resolveHandoverCodeAttemptPolicy uses bounded defaults', () => {
    const policy = resolveHandoverCodeAttemptPolicy({
      HANDOVER_CODE_MAX_ATTEMPTS: '8',
      HANDOVER_CODE_LOCKOUT_MS: '120000',
    });

    assert.equal(policy.maxAttempts, 8);
    assert.equal(policy.lockoutMs, 120_000);

    const fallback = resolveHandoverCodeAttemptPolicy({
      HANDOVER_CODE_MAX_ATTEMPTS: '99',
      HANDOVER_CODE_LOCKOUT_MS: '500',
    });
    assert.equal(fallback.maxAttempts, 5);
    assert.equal(fallback.lockoutMs, 15 * 60_000);
  });

  test('locks out after max failed attempts without running bcrypt when locked', async () => {
    const entityId = `reservation-${Date.now()}`;
    const storedHash = await hashHandoverCode('123456');
    const policy = { maxAttempts: 3, lockoutMs: 60_000 };

    for (let attempt = 0; attempt < policy.maxAttempts - 1; attempt += 1) {
      const result = await prisma.$transaction((tx) =>
        verifyHandoverCodeWithAttemptLimit(tx, {
          userId,
          scope: 'self-pickup',
          entityId,
          providedCode: '000000',
          storedHash,
          policy,
        }),
      );

      assert.equal(result.outcome, 'INVALID_CODE');
    }

    const thresholdLock = await prisma.$transaction((tx) =>
      verifyHandoverCodeWithAttemptLimit(tx, {
        userId,
        scope: 'self-pickup',
        entityId,
        providedCode: '000000',
        storedHash,
        policy,
      }),
    );
    assert.equal(thresholdLock.outcome, 'LOCKED');

    const locked = await prisma.$transaction((tx) =>
      verifyHandoverCodeWithAttemptLimit(tx, {
        userId,
        scope: 'self-pickup',
        entityId,
        providedCode: '123456',
        storedHash,
        policy,
      }),
    );

    assert.equal(locked.outcome, 'LOCKED');
    assert.ok((locked.retryAfterSeconds ?? 0) > 0);

    const audits = await prisma.handoverCodeVerificationAudit.findMany({
      where: { userId, entityId, scope: 'self-pickup' },
      orderBy: { createdAt: 'asc' },
    });

    assert.equal(audits.filter((row) => row.outcome === 'FAILED').length, 3);
    assert.equal(
      audits.filter((row) => row.outcome === 'LOCKED_REJECTED').length,
      1,
    );
  });

  test('clears attempt counter after a successful verification', async () => {
    const entityId = `reservation-success-${Date.now()}`;
    const plainCode = '654321';
    const storedHash = await hashHandoverCode(plainCode);
    const policy = getHandoverCodeAttemptPolicy();

    await prisma.$transaction((tx) =>
      verifyHandoverCodeWithAttemptLimit(tx, {
        userId,
        scope: 'self-pickup',
        entityId,
        providedCode: '111111',
        storedHash,
        policy,
      }),
    );

    const success = await prisma.$transaction((tx) =>
      verifyHandoverCodeWithAttemptLimit(tx, {
        userId,
        scope: 'self-pickup',
        entityId,
        providedCode: plainCode,
        storedHash,
        policy,
      }),
    );

    assert.equal(success.outcome, 'VALID');

    const remaining = await prisma.handoverCodeAttempt.count({
      where: { userId, entityId, scope: 'self-pickup' },
    });
    assert.equal(remaining, 0);
  });

  test('counts invalid format attempts without bcrypt compare', async () => {
    const entityId = `delivery-${Date.now()}`;
    const storedHash = await hashHandoverCode('123456');
    const policy = { maxAttempts: 2, lockoutMs: 30_000 };

    const invalidFormat = await prisma.$transaction((tx) =>
      verifyHandoverCodeWithAttemptLimit(tx, {
        userId,
        scope: 'supplier-handover',
        entityId,
        providedCode: 'abc',
        storedHash,
        policy,
      }),
    );

    assert.equal(invalidFormat.outcome, 'INVALID_FORMAT');

    const audits = await prisma.handoverCodeVerificationAudit.count({
      where: {
        userId,
        entityId,
        scope: 'supplier-handover',
        outcome: 'INVALID_FORMAT',
      },
    });
    assert.equal(audits, 1);
  });
});
