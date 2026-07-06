import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { resolveIncidentReviewStatus } from './incident-review-status.js';

describe('resolveIncidentReviewStatus', () => {
  test('returns pending when any report is pending review', () => {
    assert.equal(
      resolveIncidentReviewStatus([
        { status: 'VERIFIED' },
        { status: 'PENDING_REVIEW' },
      ]),
      'PENDING_REVIEW',
    );
  });

  test('returns verified when no pending reports remain', () => {
    assert.equal(
      resolveIncidentReviewStatus([{ status: 'VERIFIED' }]),
      'VERIFIED',
    );
  });

  test('returns null when there are no reports', () => {
    assert.equal(resolveIncidentReviewStatus([]), null);
  });
});
