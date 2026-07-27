import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProjectRecentIntent,
  classifyProjectRecentIntent,
  projectRecentItemScore,
  type ProjectRecentIntentEvent,
} from './project-recent-intent.js';
import type { IntentMetadata } from './short-term-intent.js';

const now = '2026-07-19T12:00:00Z';
const sharedConcept = 'robotics-core';
const metadata = new Map<string, IntentMetadata>([
  ['p0', { categoryKey: 'cat-a', conceptKeys: [sharedConcept], componentConceptKeys: ['motor-control'] }],
  ['p1', { categoryKey: 'cat-a', conceptKeys: [sharedConcept], componentConceptKeys: ['sensor-array'] }],
  ['p2', { categoryKey: 'cat-b', conceptKeys: ['textiles'], componentConceptKeys: [] }],
  ['hidden', { categoryKey: 'cat-hidden', conceptKeys: [], componentConceptKeys: [] }],
]);

const event = (entityKey: string, actionType: string, timestampUtc: string): ProjectRecentIntentEvent => ({
  entityKey,
  actionType,
  timestampUtc,
});

test('project evidence: none, weak, repeated, active states, reversals, and invalid actions', () => {
  assert.equal(classifyProjectRecentIntent([], metadata, now).confidence, 'NONE');

  const weak = classifyProjectRecentIntent([event('p0', 'project_follow', '2026-07-19T10:00:00Z')], metadata, now);
  assert.equal(weak.confidence, 'LOW');
  assert.equal(weak.confidenceSource, 'INSUFFICIENT_COHERENCE');

  const repeated = classifyProjectRecentIntent(
    Array.from({ length: 12 }, (_, index) => event('p0', 'project_save', `2026-07-19T10:${String(index).padStart(2, '0')}:00Z`)),
    metadata,
    now,
  );
  assert.equal(repeated.confidence, 'LOW');
  assert.equal(repeated.burstDistinctProjectCount, 1);
  assert.ok(repeated.rejectedCounts.duplicateOrCapped > 0);

  const saved = classifyProjectRecentIntent([event('p0', 'project_save', '2026-07-19T10:00:00Z')], metadata, now);
  assert.equal(saved.burstActiveSaveCount, 1);

  const unsaved = classifyProjectRecentIntent([
    event('p0', 'project_save', '2026-07-19T10:00:00Z'),
    event('p0', 'unsave', '2026-07-19T10:30:00Z'),
  ], metadata, now);
  assert.equal(unsaved.burstActiveSaveCount, 0);
  assert.equal(unsaved.rejectedCounts.reversed, 1);

  const liked = classifyProjectRecentIntent([event('p0', 'like', '2026-07-19T10:00:00Z')], metadata, now);
  assert.equal(liked.burstActiveLikeCount, 1);

  const unliked = classifyProjectRecentIntent([
    event('p0', 'like', '2026-07-19T10:00:00Z'),
    event('p0', 'unlike', '2026-07-19T10:30:00Z'),
  ], metadata, now);
  assert.equal(unliked.burstActiveLikeCount, 0);

  const followed = classifyProjectRecentIntent([event('p0', 'project_follow', '2026-07-19T10:00:00Z')], metadata, now);
  assert.equal(followed.burstActiveFollowCount, 1);

  const unfollowed = classifyProjectRecentIntent([
    event('p0', 'project_follow', '2026-07-19T10:00:00Z'),
    event('p0', 'unfollow', '2026-07-19T10:30:00Z'),
  ], metadata, now);
  assert.equal(unfollowed.burstActiveFollowCount, 0);

  const strong = classifyProjectRecentIntent([event('p0', 'build_progress', '2026-07-19T10:00:00Z')], metadata, now);
  assert.equal(strong.burstStrongActionCount, 1);

  const failed = classifyProjectRecentIntent([
    event('p0', 'build_failed', '2026-07-19T10:00:00Z'),
    event('p0', 'build_started', '2026-07-19T10:05:00Z'),
  ], metadata, now);
  assert.equal(failed.burstStrongActionCount, 1);
  assert.equal(failed.rejectedCounts.invalidAction, 1);

  const hidden = classifyProjectRecentIntent([event('hidden', 'project_save', '2026-07-19T10:00:00Z')], metadata, now);
  assert.equal(hidden.recentHistoryDistinctProjectCount, 0);
});

test('project confidence: scattered LOW, coherent MEDIUM, strong HIGH, dominance, and repetition guardrails', () => {
  const scatteredMetadata = new Map<string, IntentMetadata>([
    ['s0', { categoryKey: 'cat-0', conceptKeys: ['concept-0'], componentConceptKeys: [] }],
    ['s1', { categoryKey: 'cat-1', conceptKeys: ['concept-1'], componentConceptKeys: [] }],
    ['s2', { categoryKey: 'cat-2', conceptKeys: ['concept-2'], componentConceptKeys: [] }],
  ]);
  const scattered = classifyProjectRecentIntent([
    event('s0', 'project_follow', '2026-07-19T10:00:00Z'),
    event('s1', 'project_follow', '2026-07-19T10:05:00Z'),
    event('s2', 'project_follow', '2026-07-19T10:10:00Z'),
  ], scatteredMetadata, now);
  assert.equal(scattered.confidence, 'LOW');
  assert.ok(scattered.burstDominantConceptShare < 0.6);

  const medium = classifyProjectRecentIntent([
    event('p0', 'project_save', '2026-07-19T10:00:00Z'),
    event('p1', 'like', '2026-07-19T10:10:00Z'),
  ], metadata, now);
  assert.equal(medium.confidence, 'MEDIUM');
  assert.equal(medium.burstDistinctProjectCount, 2);
  assert.ok(medium.burstDominantConceptShare >= 0.6);

  const high = classifyProjectRecentIntent([
    event('p0', 'build_started', '2026-07-19T10:00:00Z'),
    event('p0', 'project_save', '2026-07-19T10:05:00Z'),
    event('p1', 'like', '2026-07-19T10:10:00Z'),
    event('p1', 'project_save', '2026-07-19T10:15:00Z'),
  ], metadata, now);
  assert.equal(high.confidence, 'HIGH');
  assert.equal(high.confidenceSource, 'STRONG_ACTION_BURST');
  assert.equal(high.burstDistinctProjectCount, 2);

  const oneProjectHighAttempt = classifyProjectRecentIntent([
    event('p0', 'project_save', '2026-07-19T10:00:00Z'),
    event('p0', 'like', '2026-07-19T10:05:00Z'),
    event('p0', 'project_follow', '2026-07-19T10:10:00Z'),
    event('p0', 'build_started', '2026-07-19T10:15:00Z'),
  ], metadata, now);
  assert.notEqual(oneProjectHighAttempt.confidence, 'HIGH');

  const oldHistory = classifyProjectRecentIntent([
    event('p0', 'project_save', '2026-07-10T10:00:00Z'),
    event('p1', 'project_save', '2026-07-10T11:00:00Z'),
    event('p0', 'like', '2026-07-10T12:00:00Z'),
    event('p1', 'like', '2026-07-10T13:00:00Z'),
  ], metadata, now);
  assert.equal(oldHistory.recentHistoryDistinctProjectCount, 2);
  assert.equal(oldHistory.burstDistinctProjectCount, 0);
  assert.equal(oldHistory.confidence, 'LOW');
  assert.ok(oldHistory.fullHistoryDominantConceptShare >= oldHistory.burstDominantConceptShare);
});

test('unmapped projects do not create false coherence', () => {
  const unmapped = classifyProjectRecentIntent([
    event('hidden', 'project_save', '2026-07-19T10:00:00Z'),
    event('hidden', 'like', '2026-07-19T10:05:00Z'),
  ], metadata, now);
  assert.equal(unmapped.recentHistoryDistinctProjectCount, 0);
  assert.equal(unmapped.confidence, 'NONE');
});

test('project recent scoring uses direct and concept similarity with finite scores', () => {
  const events = [
    event('p0', 'project_save', '2026-07-19T11:00:00Z'),
    event('p1', 'like', '2026-07-19T11:05:00Z'),
  ];
  const intent = buildProjectRecentIntent(events, metadata, now);
  const p0Score = projectRecentItemScore('p0', metadata.get('p0')!, intent.intent, intent.directScores);
  const p1Score = projectRecentItemScore('p1', metadata.get('p1')!, intent.intent, intent.directScores);
  const p2Score = projectRecentItemScore('p2', metadata.get('p2')!, intent.intent, intent.directScores);
  assert.ok(p0Score > 0);
  assert.ok(p1Score > 0);
  assert.ok(p2Score >= 0);
  assert.ok(Number.isFinite(p0Score));
  assert.ok(Number.isFinite(p1Score));
  assert.ok(Number.isFinite(p2Score));
});
