import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildContinuableProjectBuildWhere,
  CONTINUE_PROJECT_BUILD_ORDER_BY,
  isContinueBuildItemReady,
  PUBLIC_CONTINUE_PROJECT_WHERE,
} from './project-build-continuation.js';

describe('project build continuation contract', () => {
  test('shares the canonical item-readiness semantics', () => {
    for (const status of ['ALREADY_OWNED', 'AVAILABLE', 'ALTERNATIVE']) {
      assert.equal(
        isContinueBuildItemReady({ status, linkedReservation: null }),
        true,
      );
    }
    assert.equal(
      isContinueBuildItemReady({
        status: 'RESERVED',
        linkedReservation: { status: 'COMPLETED' },
      }),
      true,
    );
    assert.equal(
      isContinueBuildItemReady({
        status: 'RESERVED',
        linkedReservation: { status: 'ACCEPTED' },
      }),
      false,
    );
    assert.equal(
      isContinueBuildItemReady({ status: 'MISSING', linkedReservation: null }),
      false,
    );
  });

  test('locks public visibility, learner ownership, and deterministic order', () => {
    assert.deepEqual(PUBLIC_CONTINUE_PROJECT_WHERE, {
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
      category: {
        isActive: true,
        categoryType: { in: ['PROJECT', 'BOTH'] },
      },
    });
    const where = buildContinuableProjectBuildWhere('learner-1');
    assert.equal(where.learnerId, 'learner-1');
    assert.equal(where.OR?.length, 2);
    assert.equal(where.OR?.[0]?.status, 'PAUSED');
    assert.equal(where.OR?.[1]?.status, 'IN_PROGRESS');
    assert.deepEqual(where.project, PUBLIC_CONTINUE_PROJECT_WHERE);
    assert.equal(where.OR?.[1]?.OR?.length, 2);
    assert.deepEqual(CONTINUE_PROJECT_BUILD_ORDER_BY, [
      { updatedAt: 'desc' },
      { startedAt: 'desc' },
      { id: 'asc' },
    ]);
  });
});
