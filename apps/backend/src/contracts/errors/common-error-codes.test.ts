import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  COMMON_ERROR_CODES,
  isCommonErrorCode,
} from './common-error-codes.js';

const contractPath = new URL(
  '../../../../../contracts/errors/common-error-codes-v1.json',
  import.meta.url,
);

test('backend common error codes match the shared wire contract', () => {
  const contract = JSON.parse(readFileSync(contractPath, 'utf8')) as {
    contractId: string;
    codes: Record<string, string>;
  };

  assert.equal(contract.contractId, 'impactloop-common-error-codes-v1');
  assert.deepEqual(contract.codes, COMMON_ERROR_CODES);
});

test('common error-code guard recognizes only contract values', () => {
  for (const code of Object.values(COMMON_ERROR_CODES)) {
    assert.equal(isCommonErrorCode(code), true);
  }

  assert.equal(isCommonErrorCode('UNKNOWN_ERROR'), false);
  assert.equal(isCommonErrorCode(null), false);
});
