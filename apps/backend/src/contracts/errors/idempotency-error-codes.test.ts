import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  IDEMPOTENCY_ERROR_CODES,
  isIdempotencyErrorCode,
} from './idempotency-error-codes.js';

const contractPath = new URL(
  '../../../../../contracts/errors/idempotency-error-codes-v1.json',
  import.meta.url,
);

test('backend idempotency error codes match the shared wire contract', () => {
  const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
    contractId: string;
    codes: Record<string, string>;
  };

  assert.equal(
    contract.contractId,
    'impactloop-idempotency-error-codes-v1',
  );
  assert.deepEqual(contract.codes, IDEMPOTENCY_ERROR_CODES);
});

test('idempotency error-code guard recognizes only contract values', () => {
  for (const code of Object.values(IDEMPOTENCY_ERROR_CODES)) {
    assert.equal(isIdempotencyErrorCode(code), true);
  }

  assert.equal(isIdempotencyErrorCode('IDEMPOTENCY_UNKNOWN'), false);
  assert.equal(isIdempotencyErrorCode(null), false);
});
