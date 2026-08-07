import type { Prisma } from '../generated/prisma/client.js';

import {
  normalizeHandoverCode,
  verifyHandoverCode,
  type HandoverCodeScope,
} from './handover-codes.js';

export type HandoverCodeVerificationOutcome =
  | 'VALID'
  | 'INVALID_FORMAT'
  | 'INVALID_CODE'
  | 'MISSING_HASH'
  | 'LOCKED';

export type HandoverCodeVerificationResult = {
  outcome: HandoverCodeVerificationOutcome;
  retryAfterSeconds?: number;
};

export type HandoverCodeAttemptPolicy = {
  maxAttempts: number;
  lockoutMs: number;
};

const parseBoundedInteger = (
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (raw == null || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
};

export const resolveHandoverCodeAttemptPolicy = (
  processEnv: NodeJS.Dict<string> = process.env,
): HandoverCodeAttemptPolicy => ({
  maxAttempts: parseBoundedInteger(
    processEnv.HANDOVER_CODE_MAX_ATTEMPTS,
    5,
    1,
    20,
  ),
  lockoutMs: parseBoundedInteger(
    processEnv.HANDOVER_CODE_LOCKOUT_MS,
    15 * 60_000,
    60_000,
    24 * 60 * 60_000,
  ),
});

const handoverCodeAttemptPolicy = resolveHandoverCodeAttemptPolicy();

export const getHandoverCodeAttemptPolicy = (): HandoverCodeAttemptPolicy =>
  handoverCodeAttemptPolicy;

const handoverCodeAttemptUniqueWhere = (input: {
  userId: string;
  scope: HandoverCodeScope;
  entityId: string;
}) => ({
  userId_scope_entityId: {
    userId: input.userId,
    scope: input.scope,
    entityId: input.entityId,
  },
});

const auditHandoverCodeVerification = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    scope: HandoverCodeScope;
    entityId: string;
    outcome: 'FAILED' | 'LOCKED_REJECTED' | 'INVALID_FORMAT';
  },
) => {
  await tx.handoverCodeVerificationAudit.create({
    data: {
      userId: input.userId,
      scope: input.scope,
      entityId: input.entityId,
      outcome: input.outcome,
    },
    select: { id: true },
  });
};

const clearHandoverCodeAttempts = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    scope: HandoverCodeScope;
    entityId: string;
  },
) => {
  await tx.handoverCodeAttempt.deleteMany({
    where: {
      userId: input.userId,
      scope: input.scope,
      entityId: input.entityId,
    },
  });
};

const getActiveLockout = (
  attempt: {
    failedCount: number;
    lockedUntil: Date | null;
  } | null,
  now: Date,
  policy: HandoverCodeAttemptPolicy,
): { locked: true; retryAfterSeconds: number } | { locked: false } => {
  if (!attempt?.lockedUntil || attempt.lockedUntil <= now) {
    return { locked: false };
  }

  if (attempt.failedCount < policy.maxAttempts) {
    return { locked: false };
  }

  return {
    locked: true,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 1000),
    ),
  };
};

const recordHandoverCodeFailure = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    scope: HandoverCodeScope;
    entityId: string;
    auditOutcome: 'FAILED' | 'INVALID_FORMAT';
    now: Date;
    policy: HandoverCodeAttemptPolicy;
  },
): Promise<HandoverCodeVerificationResult> => {
  const existing = await tx.handoverCodeAttempt.findUnique({
    where: handoverCodeAttemptUniqueWhere(input),
    select: {
      failedCount: true,
      lockedUntil: true,
    },
  });

  const lockoutExpired =
    existing?.lockedUntil != null && existing.lockedUntil <= input.now;
  const nextFailedCount =
    existing == null || lockoutExpired ? 1 : existing.failedCount + 1;
  const shouldLock = nextFailedCount >= input.policy.maxAttempts;
  const lockedUntil = shouldLock
    ? new Date(input.now.getTime() + input.policy.lockoutMs)
    : null;

  await tx.handoverCodeAttempt.upsert({
    where: handoverCodeAttemptUniqueWhere(input),
    create: {
      userId: input.userId,
      scope: input.scope,
      entityId: input.entityId,
      failedCount: nextFailedCount,
      lastFailedAt: input.now,
      lockedUntil,
    },
    update: {
      failedCount: nextFailedCount,
      lastFailedAt: input.now,
      lockedUntil,
    },
    select: { id: true },
  });

  await auditHandoverCodeVerification(tx, {
    userId: input.userId,
    scope: input.scope,
    entityId: input.entityId,
    outcome: input.auditOutcome,
  });

  if (shouldLock) {
    return {
      outcome: 'LOCKED',
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(input.policy.lockoutMs / 1000),
      ),
    };
  }

  return {
    outcome:
      input.auditOutcome === 'INVALID_FORMAT' ? 'INVALID_FORMAT' : 'INVALID_CODE',
  };
};

export const verifyHandoverCodeWithAttemptLimit = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    scope: HandoverCodeScope;
    entityId: string;
    providedCode: string;
    storedHash: string | null | undefined;
    policy?: HandoverCodeAttemptPolicy;
  },
): Promise<HandoverCodeVerificationResult> => {
  const policy = input.policy ?? handoverCodeAttemptPolicy;
  const now = new Date();

  const existingAttempt = await tx.handoverCodeAttempt.findUnique({
    where: handoverCodeAttemptUniqueWhere(input),
    select: {
      failedCount: true,
      lockedUntil: true,
    },
  });

  const activeLockout = getActiveLockout(existingAttempt, now, policy);

  if (activeLockout.locked) {
    await auditHandoverCodeVerification(tx, {
      userId: input.userId,
      scope: input.scope,
      entityId: input.entityId,
      outcome: 'LOCKED_REJECTED',
    });

    return {
      outcome: 'LOCKED',
      retryAfterSeconds: activeLockout.retryAfterSeconds,
    };
  }

  const normalized = normalizeHandoverCode(input.providedCode);

  if (!normalized) {
    return recordHandoverCodeFailure(tx, {
      userId: input.userId,
      scope: input.scope,
      entityId: input.entityId,
      auditOutcome: 'INVALID_FORMAT',
      now,
      policy,
    });
  }

  if (!input.storedHash) {
    return { outcome: 'MISSING_HASH' };
  }

  const codeValid = await verifyHandoverCode(normalized, input.storedHash);

  if (codeValid) {
    await clearHandoverCodeAttempts(tx, input);
    return { outcome: 'VALID' };
  }

  return recordHandoverCodeFailure(tx, {
    userId: input.userId,
    scope: input.scope,
    entityId: input.entityId,
    auditOutcome: 'FAILED',
    now,
    policy,
  });
};

export const resetHandoverCodeAttemptsForTests = async (
  tx: Prisma.TransactionClient,
): Promise<void> => {
  await tx.handoverCodeVerificationAudit.deleteMany();
  await tx.handoverCodeAttempt.deleteMany();
};
