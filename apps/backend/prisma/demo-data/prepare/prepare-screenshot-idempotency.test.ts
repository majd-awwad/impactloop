import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isReviewThreadComplete } from './prepare-reviews.js';
import { shouldReuseEligibleHelpTarget } from './prepare-help-session.js';
import { notificationHasDemoTag, NOTIFICATION_DEMO_TAG } from './prepare-notifications.js';

describe('review demo idempotency', () => {
  test('a 5-star review plus the three-comment thread is considered complete', () => {
    assert.equal(
      isReviewThreadComplete({ reviewRating: 5, commentCount: 3 }),
      true,
    );
    assert.equal(
      isReviewThreadComplete({ reviewRating: 4, commentCount: 3 }),
      false,
    );
    assert.equal(
      isReviewThreadComplete({ reviewRating: 5, commentCount: 2 }),
      false,
    );
  });
});

describe('help-session demo reuse', () => {
  test('reuses an existing eligible active build or session instead of creating another', () => {
    assert.equal(
      shouldReuseEligibleHelpTarget({
        existingEligibleBuildId: 'build-1',
        existingActiveSessionId: null,
      }),
      true,
    );
    assert.equal(
      shouldReuseEligibleHelpTarget({
        existingEligibleBuildId: null,
        existingActiveSessionId: 'session-1',
      }),
      true,
    );
    assert.equal(
      shouldReuseEligibleHelpTarget({
        existingEligibleBuildId: null,
        existingActiveSessionId: null,
      }),
      false,
    );
  });
});

describe('notification demo idempotency', () => {
  test('stamped notifications are recognized by the local demo tag', () => {
    assert.equal(
      notificationHasDemoTag({ localDemoTag: NOTIFICATION_DEMO_TAG }),
      true,
    );
    assert.equal(notificationHasDemoTag({ other: true }), false);
  });
});
