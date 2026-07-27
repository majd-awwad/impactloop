import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  classifyOverviewStartIntent,
  describeDurationConstraintViolation,
  durationSatisfiesConstraints,
  isGenericDiscussionAcknowledgement,
  parseDurationConstraints,
  setOverviewStartIntentGeneratorForTests,
} from './ai-project-authoring-sequential-discussion.provider.js';

describe('foundation authoring provider', () => {
  test('Arabic اه classifies as START at overview', async () => {
    assert.equal(await classifyOverviewStartIntent('اه', 'ar'), 'START');
  });

  test('Arabic unrelated request does not start', async () => {
    assert.equal(
      await classifyOverviewStartIntent('بدي مشروع عن الزراعة بالتفصيل', 'ar'),
      'OTHER',
    );
  });

  test('English affirmative classifies as START', async () => {
    assert.equal(await classifyOverviewStartIntent('Yes', 'en'), 'START');
    assert.equal(await classifyOverviewStartIntent('Go ahead', 'en'), 'START');
  });

  test('higher than 60 constraint rejects 60', () => {
    const constraints = parseDurationConstraints('higher than 60');
    assert.ok(constraints);
    assert.equal(durationSatisfiesConstraints(60, constraints), false);
    assert.match(
      describeDurationConstraintViolation(60, constraints) ?? '',
      /greater than 60/i,
    );
  });

  test('Arabic أعلى من 60 constraint rejects 60', () => {
    const constraints = parseDurationConstraints('بدي وقت أعلى من 60');
    assert.ok(constraints);
    assert.equal(durationSatisfiesConstraints(60, constraints), false);
    assert.equal(durationSatisfiesConstraints(75, constraints), true);
  });

  test('Arabic أكثر من ساعة implies more than 60', () => {
    const constraints = parseDurationConstraints('أكثر من ساعة');
    assert.ok(constraints);
    assert.equal(durationSatisfiesConstraints(60, constraints), false);
    assert.equal(durationSatisfiesConstraints(90, constraints), true);
  });

  test('at least two hours requires 120 or more', () => {
    const constraints = parseDurationConstraints('at least two hours');
    assert.ok(constraints);
    assert.equal(durationSatisfiesConstraints(90, constraints), false);
    assert.equal(durationSatisfiesConstraints(120, constraints), true);
  });

  test('generic acknowledgement without revision is rejected', () => {
    assert.equal(
      isGenericDiscussionAcknowledgement('I understand and will revise it.'),
      true,
    );
    assert.equal(
      isGenericDiscussionAcknowledgement('Here is a shorter title for beginners.'),
      false,
    );
  });

  test('start intent override is respected in tests', async () => {
    setOverviewStartIntentGeneratorForTests(async () => 'UPDATE_IDEA' as const);
    assert.equal(await classifyOverviewStartIntent('اه', 'ar'), 'UPDATE_IDEA');
    setOverviewStartIntentGeneratorForTests(null);
  });
});
