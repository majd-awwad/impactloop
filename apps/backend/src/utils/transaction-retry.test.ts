import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { AppError } from './app-error.js';
import {
  isRetryableSerializableConflict,
  runSerializableTransaction,
} from './transaction-retry.js';

const withoutDelay = {
  retryDelayMilliseconds: () => 0,
};

const serializationFailure = () =>
  Object.assign(new Error('serialization failure'), { code: '40001' });

describe('transaction retry', () => {
  test('classifies supported Serializable conflict shapes as retryable', () => {
    const retryableErrors = [
      { code: 'P2034' },
      { code: '40001' },
      { cause: { originalCode: '40001' } },
      { cause: { kind: 'TransactionWriteConflict' } },
      {
        name: 'DriverAdapterError',
        cause: {
          originalCode: '40001',
          kind: 'TransactionWriteConflict',
        },
      },
      new Error('deadlock detected'),
    ];

    for (const error of retryableErrors) {
      assert.equal(isRetryableSerializableConflict(error), true);
    }
  });

  test('does not classify domain or unrelated errors as retryable', () => {
    const nonRetryableErrors = [
      new AppError('Invalid input', 400, 'VALIDATION_ERROR'),
      new AppError('Forbidden', 403, 'FORBIDDEN'),
      { code: 'P2002' },
      new Error('generic conflict'),
      new AppError('Domain conflict', 409, 'CONFLICT'),
      new Error('outer error', { cause: { code: 'P2002' } }),
    ];

    for (const error of nonRetryableErrors) {
      assert.equal(isRetryableSerializableConflict(error), false);
    }
  });

  test('handles cyclic error causes without recursing forever', () => {
    const error = new Error('cycle') as Error & { cause?: unknown };
    error.cause = error;

    assert.equal(isRetryableSerializableConflict(error), false);
  });

  test('runs a successful transaction callback once', async () => {
    let attempts = 0;

    const result = await runSerializableTransaction(
      async () => {
        attempts += 1;
        return 'complete';
      },
      withoutDelay,
    );

    assert.equal(result, 'complete');
    assert.equal(attempts, 1);
  });

  test('reruns the complete callback after one serialization failure', async () => {
    let attempts = 0;

    const result = await runSerializableTransaction(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw serializationFailure();
        }

        return 'complete';
      },
      withoutDelay,
    );

    assert.equal(result, 'complete');
    assert.equal(attempts, 2);
  });

  test('reruns the complete callback for each retryable failure', async () => {
    let attempts = 0;

    const result = await runSerializableTransaction(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw serializationFailure();
        }

        return 'complete';
      },
      withoutDelay,
    );

    assert.equal(result, 'complete');
    assert.equal(attempts, 3);
  });

  test('rethrows a non-retryable error without rerunning the callback', async () => {
    const error = new AppError('Forbidden', 403, 'FORBIDDEN');
    let attempts = 0;

    await assert.rejects(
      () =>
        runSerializableTransaction(
          async () => {
            attempts += 1;
            throw error;
          },
          withoutDelay,
        ),
      (caught: unknown) => caught === error,
    );

    assert.equal(attempts, 1);
  });

  test('rethrows the final retryable error when attempts are exhausted', async () => {
    const error = serializationFailure();
    let attempts = 0;

    await assert.rejects(
      () =>
        runSerializableTransaction(
          async () => {
            attempts += 1;
            throw error;
          },
          { ...withoutDelay, maxAttempts: 3 },
        ),
      (caught: unknown) => caught === error,
    );

    assert.equal(attempts, 3);
  });
});
