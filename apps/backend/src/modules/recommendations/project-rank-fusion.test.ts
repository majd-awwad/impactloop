import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProjectRecentIntent,
  classifyProjectRecentIntent,
  projectRecentItemScore,
  type ProjectRecentIntentEvent,
} from './project-recent-intent.js';
import { fuseProjectRankings, setProjectFusionIterationBudgetForTests } from './project-rank-fusion.js';
import type { IntentMetadata } from './short-term-intent.js';

const now = '2026-07-19T12:00:00Z';
const metadata = new Map<string, IntentMetadata>(
  Array.from({ length: 20 }, (_, index) => [`a${index}`, {
    categoryKey: 'cat-a',
    conceptKeys: ['shared-concept'],
    componentConceptKeys: [`component-${index % 3}`],
  }]),
);

const longTerm = Array.from({ length: 20 }, (_, index) => ({ candidateKey: `a${index}`, score: 20 - index }));
const recentScoresFor = (events: ProjectRecentIntentEvent[]) => {
  const intent = buildProjectRecentIntent(events, metadata, now);
  return new Map(Array.from({ length: 20 }, (_, index) => [
    `a${index}`,
    projectRecentItemScore(`a${index}`, metadata.get(`a${index}`)!, intent.intent, intent.directScores),
  ]));
};

test('project fusion enforces confidence slot limits and quality guardrails', () => {
  const recent = new Map([...Array.from({ length: 4 }, (_, index) => [`a${10 + index}`, 0.9 - index * 0.1] as const), ['a19', 0.01]]);
  assert.deepEqual(fuseProjectRankings(longTerm, recent, 'NONE').ranking, longTerm);
  assert.deepEqual(fuseProjectRankings(longTerm, recent, 'LOW').ranking, longTerm);

  const medium = fuseProjectRankings(longTerm, recent, 'MEDIUM');
  assert.ok(medium.recentSlotsUsedTop5 <= 1);
  assert.ok(medium.recentSlotsUsedTop10 <= 1);

  const high = fuseProjectRankings(longTerm, recent, 'HIGH');
  assert.ok(high.recentSlotsUsedTop5 <= 2);
  assert.ok(high.recentSlotsUsedTop10 <= 3);
  assert.equal(high.recentSlotsAllowedTop5, 2);
  assert.equal(high.recentSlotsAllowedTop10, 3);
  assert.equal(new Set(high.ranking.map((value) => value.candidateKey)).size, longTerm.length);
  assert.equal(high.ranking.some((value) => value.candidateKey === 'a19' && high.ranking.indexOf(value) < 10), false);
});

test('project fusion counts existing top-K recent projects without duplicate insertion', () => {
  const recent = new Map([['a0', 0.95], ['a1', 0.9], ['a2', 0.85], ['a3', 0.8]]);
  const high = fuseProjectRankings(longTerm, recent, 'HIGH');
  assert.ok(high.recentSlotsUsedTop5 >= 2);
  assert.equal(high.ranking[0]?.candidateKey, 'a0');
  assert.equal(new Set(high.ranking.map((value) => value.candidateKey)).size, longTerm.length);
});

test('project fusion terminates for ineligible, fully represented, and bounded inputs', () => {
  const ineligible = fuseProjectRankings(
    longTerm,
    new Map([['missing', 1], ['also-missing', 1]]),
    'HIGH',
  );
  assert.deepEqual(ineligible.ranking, longTerm);

  const alreadyRepresented = fuseProjectRankings(
    longTerm,
    new Map(longTerm.slice(0, 5).map((value) => [value.candidateKey, 1])),
    'MEDIUM',
  );
  assert.deepEqual(alreadyRepresented.ranking, longTerm);
  assert.ok(alreadyRepresented.recentSlotsUsedTop5 <= 1);

  const maximumCandidates = Array.from({ length: 200 }, (_, index) => ({ candidateKey: `max-${index}`, score: 200 - index }));
  const maximumRecent = new Map(maximumCandidates.map((value) => [value.candidateKey, 1]));
  const maximum = fuseProjectRankings(maximumCandidates, maximumRecent, 'HIGH');
  assert.equal(maximum.ranking.length, 200);
  assert.equal(new Set(maximum.ranking.map((value) => value.candidateKey)).size, 200);

  try {
    setProjectFusionIterationBudgetForTests(0);
    assert.throws(
      () => fuseProjectRankings(
        Array.from({ length: 4 }, (_, index) => ({ candidateKey: `bound-${index}`, score: 4 - index })),
        new Map([['bound-3', 1]]),
        'HIGH',
      ),
      /project_shadow_iteration_bound/,
    );
  } finally {
    setProjectFusionIterationBudgetForTests(undefined);
  }
});

test('coherent project burst reaches bounded fusion slots in shadow only', () => {
  const events: ProjectRecentIntentEvent[] = [
    { entityKey: 'a10', actionType: 'project_save', timestampUtc: '2026-07-19T10:00:00Z' },
    { entityKey: 'a11', actionType: 'like', timestampUtc: '2026-07-19T10:05:00Z' },
    { entityKey: 'a10', actionType: 'like', timestampUtc: '2026-07-19T10:10:00Z' },
    { entityKey: 'a11', actionType: 'project_save', timestampUtc: '2026-07-19T10:15:00Z' },
  ];
  const profile = classifyProjectRecentIntent(events, metadata, now);
  assert.ok(['MEDIUM', 'HIGH'].includes(profile.confidence));
  const fused = fuseProjectRankings(longTerm, recentScoresFor(events), profile.confidence === 'HIGH' ? 'HIGH' : 'MEDIUM');
  assert.ok(fused.recentSlotsUsedTop5 + fused.recentSlotsUsedTop10 > 0 || profile.confidence === 'LOW');
});
