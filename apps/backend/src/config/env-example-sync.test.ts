import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

describe('backend env example templates', () => {
  test('apps/backend/.env.example and apps/backend/env.example stay identical', () => {
    const canonical = readFileSync(
      path.join(backendRoot, '.env.example'),
      'utf8',
    );
    const alias = readFileSync(path.join(backendRoot, 'env.example'), 'utf8');

    assert.equal(
      alias,
      canonical,
      'env.example must match .env.example; update both from the canonical template.',
    );
  });
});
