import assert from 'node:assert/strict';
import test from 'node:test';

import { IDEMPOTENCY_ERROR_CODES } from '../contracts/errors/idempotency-error-codes.js';
import { AppError } from '../utils/app-error.js';
import {
  computeIdempotencyRequestHash,
  resolveExistingIdempotencyRecord,
} from './idempotency.service.js';

test('request hashes are stable across object key order', () => {
  assert.equal(
    computeIdempotencyRequestHash({ materialId: 'material-1', quantity: 2 }),
    computeIdempotencyRequestHash({ quantity: 2, materialId: 'material-1' }),
  );
});

test('successful idempotency records replay their stored response', () => {
  const replay = resolveExistingIdempotencyRecord<{ id: string }>({
    requestHash: 'matching-hash',
    existing: {
      requestHash: 'matching-hash',
      status: 'SUCCEEDED',
      responseJson: { id: 'resource-1' },
    },
  });

  assert.deepEqual(replay, {
    response: { id: 'resource-1' },
    replayed: true,
  });
});

test('idempotency record conflicts use the shared error contract', () => {
  const cases = [
    {
      requestHash: 'different-hash',
      status: 'SUCCEEDED' as const,
      code: IDEMPOTENCY_ERROR_CODES.keyReused,
      details: { reason: 'key-reused' },
      detailKey: 'keyReused' as const,
    },
    {
      requestHash: 'matching-hash',
      status: 'IN_PROGRESS' as const,
      code: IDEMPOTENCY_ERROR_CODES.inProgress,
      details: { reason: 'in-progress' },
      detailKey: 'inProgress' as const,
    },
    {
      requestHash: 'matching-hash',
      status: 'FAILED' as const,
      code: IDEMPOTENCY_ERROR_CODES.previouslyFailed,
      details: { reason: 'failed' },
      detailKey: 'previouslyFailed' as const,
    },
  ];

  for (const current of cases) {
    const details = { [current.detailKey]: current.details };
    let thrown: AppError | undefined;
    assert.throws(
      () =>
        resolveExistingIdempotencyRecord({
          requestHash: 'matching-hash',
          existing: {
            requestHash: current.requestHash,
            status: current.status,
            responseJson: current.status === 'SUCCEEDED' ? { id: 'ignored' } : null,
          },
          details,
        }),
      (error) => {
        assert.ok(error instanceof AppError);
        thrown = error;
        return true;
      },
    );

    assert.equal(thrown?.code, current.code);
    assert.deepEqual(thrown?.details, current.details);
  }
});
