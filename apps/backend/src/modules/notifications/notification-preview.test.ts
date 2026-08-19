import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sanitizeNotificationPreview } from './notification-preview.js';

test('sanitizeNotificationPreview collapses whitespace and truncates safely', () => {
  assert.equal(sanitizeNotificationPreview('  Hello   world  '), 'Hello world');
  assert.equal(sanitizeNotificationPreview('line1\nline2'), 'line1 line2');
  assert.equal(sanitizeNotificationPreview(''), '');

  const long = 'a'.repeat(120);
  const preview = sanitizeNotificationPreview(long);
  assert.equal(preview.length, 80);
  assert.equal(preview.endsWith('…'), true);
  assert.equal(preview.includes('\n'), false);
});
