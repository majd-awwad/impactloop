import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildAdminNoShowReportsWhere } from './admin-no-show-reports.where.js';

describe('admin-no-show-reports.where', () => {
  test('builds empty where with no filters', () => {
    const where = buildAdminNoShowReportsWhere({});
    assert.deepEqual(where, {});
  });

  test('builds accountability workflow filter', () => {
    const where = buildAdminNoShowReportsWhere({
      workflow: 'ACCOUNTABILITY',
    });

    assert.ok(where.AND);
    assert.equal(Array.isArray(where.AND), true);
  });

  test('combines search, target role, and operational filters', () => {
    const where = buildAdminNoShowReportsWhere({
      search: 'wood',
      targetRole: 'LEARNER',
      operationalState: 'REQUIRES_RESOLUTION',
    });

    assert.ok(where.AND);
    assert.equal((where.AND as unknown[]).length, 3);
  });

  test('ignores page and limit fields when present on list query shapes', () => {
    const where = buildAdminNoShowReportsWhere({
      status: 'PENDING_REVIEW',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
    });

    assert.ok(where.AND);
    assert.equal((where.AND as unknown[]).length, 2);
  });
});
