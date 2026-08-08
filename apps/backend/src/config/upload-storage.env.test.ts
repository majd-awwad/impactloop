import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import {
  resolveUploadRootDir,
  resolveUploadSubdir,
} from './upload-storage.env.js';

const backendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

describe('upload storage env', () => {
  test('defaults to apps/backend/uploads when UPLOAD_ROOT_DIR is unset', () => {
    assert.equal(
      resolveUploadRootDir({}),
      path.join(backendRoot, 'uploads'),
    );
  });

  test('resolves absolute UPLOAD_ROOT_DIR', () => {
    assert.equal(
      resolveUploadRootDir({ UPLOAD_ROOT_DIR: '/data/uploads' }),
      path.resolve('/data/uploads'),
    );
  });

  test('resolves relative UPLOAD_ROOT_DIR against backend root', () => {
    assert.equal(
      resolveUploadRootDir({ UPLOAD_ROOT_DIR: 'var/uploads' }),
      path.join(backendRoot, 'var', 'uploads'),
    );
  });

  test('resolveUploadSubdir joins segment under configured root', () => {
    const root = path.resolve('/data/uploads');
    assert.equal(
      resolveUploadSubdir('materials', { UPLOAD_ROOT_DIR: '/data/uploads' }),
      path.join(root, 'materials'),
    );
  });
});
