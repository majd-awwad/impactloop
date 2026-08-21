import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isReviewThreadComplete } from './prepare-reviews.js';
import { shouldReuseEligibleHelpTarget } from './prepare-help-session.js';
import { notificationHasDemoTag, NOTIFICATION_DEMO_TAG } from './prepare-notifications.js';
import {
  isLearningCheckDemoReady,
  resolveLearningCheckDemoBuildAction,
  shouldReuseLearningCheckBuild,
} from './prepare-learning-check.js';

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

describe('learning-check demo readiness', () => {
  test('requires an active build, READY session, and START/STEP/FINAL coverage', () => {
    assert.equal(
      isLearningCheckDemoReady({
        hasActiveBuild: true,
        sessionReady: true,
        startCount: 2,
        hasPlaceTheLedStepAssignment: true,
        finalCount: 3,
        buildCompleted: false,
      }),
      true,
    );
    assert.equal(
      isLearningCheckDemoReady({
        hasActiveBuild: true,
        sessionReady: true,
        startCount: 2,
        hasPlaceTheLedStepAssignment: true,
        finalCount: 3,
        buildCompleted: true,
      }),
      false,
    );
    assert.equal(
      isLearningCheckDemoReady({
        hasActiveBuild: true,
        sessionReady: true,
        startCount: 0,
        hasPlaceTheLedStepAssignment: true,
        finalCount: 3,
        buildCompleted: false,
      }),
      false,
    );
    assert.equal(
      isLearningCheckDemoReady({
        hasActiveBuild: true,
        sessionReady: true,
        startCount: 2,
        hasPlaceTheLedStepAssignment: false,
        finalCount: 3,
        buildCompleted: false,
      }),
      false,
    );
  });

  test('reuses an existing active Simple LED Circuit build', () => {
    assert.equal(shouldReuseLearningCheckBuild('build-1'), true);
    assert.equal(shouldReuseLearningCheckBuild(null), false);
  });

  test('starts a new attempt when the previous LED build is completed or archived', () => {
    assert.equal(
      resolveLearningCheckDemoBuildAction({
        activeBuildId: 'active-1',
        hasExistingBuild: true,
      }),
      'reuse-active',
    );
    assert.equal(
      resolveLearningCheckDemoBuildAction({
        activeBuildId: null,
        hasExistingBuild: false,
      }),
      'start-first',
    );
    assert.equal(
      resolveLearningCheckDemoBuildAction({
        activeBuildId: null,
        hasExistingBuild: true,
      }),
      'start-again',
    );
  });
});
