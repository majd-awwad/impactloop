import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { prisma } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import { scorePortableLightFm, type WeightedFeature } from './ml-lightfm-scorer.js';
import { loadPortableModelArtifact } from './ml-model-artifact.js';
import { buildShortTermIntent, recentItemScore, type IntentMetadata, type RecentIntentEvent } from './short-term-intent.js';
import { classifyRecentIntent } from './recent-intent-confidence.js';
import { fuseMaterialRankings, setMaterialFusionIterationBudgetForTests } from './material-rank-fusion.js';

const root = process.cwd().endsWith(path.join('apps', 'backend')) ? path.resolve(process.cwd(), '../..') : process.cwd();
const categoryKey = (id: string) => createHash('sha256').update(`impactloop-category:${id}`).digest('hex');
const now = '2026-07-19T12:00:00Z';
const metadata = new Map<string, IntentMetadata>(Array.from({ length: 12 }, (_, index) => [`b${index}`, { categoryKey: 'b', conceptKeys: ['shared-b'], componentConceptKeys: [] }]));
const views = (count: number, day = '19'): RecentIntentEvent[] => Array.from({ length: count }, (_, index) => ({ entityKey: `b${index}`, actionType: 'view', timestampUtc: `2026-07-${day}T${String(index + 1).padStart(2, '0')}:00:00Z` }));

test('burst-aware confidence covers coherent, accidental, repeated, reversed, old, and scattered evidence', () => {
  assert.equal(classifyRecentIntent([], metadata, now).confidence, 'NONE');
  const accidental = classifyRecentIntent([{ entityKey: 'b0', actionType: 'like', timestampUtc: '2026-07-19T10:00:00Z' }], metadata, now);
  assert.equal(accidental.confidence, 'LOW'); assert.equal(accidental.confidenceSource, 'INSUFFICIENT_COHERENCE');
  assert.equal(classifyRecentIntent(views(3), metadata, now).confidence, 'LOW');
  const medium = classifyRecentIntent(views(4), metadata, now); assert.equal(medium.confidence, 'MEDIUM'); assert.equal(medium.confidenceSource, 'VIEW_BURST');
  const highEvents = [...views(8), { entityKey: 'b0', actionType: 'like', timestampUtc: '2026-07-19T10:00:00Z' }, { entityKey: 'b1', actionType: 'like', timestampUtc: '2026-07-19T11:00:00Z' }];
  const high = classifyRecentIntent(highEvents, metadata, now); assert.equal(high.confidence, 'HIGH'); assert.equal(high.confidenceSource, 'VIEW_BURST'); assert.equal(high.burstWindowHours, 24);
  assert.deepEqual(high, classifyRecentIntent(highEvents, metadata, now));
  const repeated = classifyRecentIntent(Array.from({ length: 20 }, (_, index) => ({ entityKey: 'b0', actionType: 'view', timestampUtc: `2026-07-19T${String(index % 12).padStart(2, '0')}:00:00Z` })), metadata, now);
  assert.equal(repeated.confidence, 'LOW'); assert.equal(repeated.burstUniqueViewCount, 1); assert.equal(repeated.rejectedCounts.duplicateOrCapped, 18);
  const reversed = classifyRecentIntent([...highEvents, { entityKey: 'b0', actionType: 'unlike', timestampUtc: '2026-07-19T11:30:00Z' }], metadata, now);
  assert.equal(reversed.burstActiveLikeCount, 1); assert.equal(reversed.rejectedCounts.reversed, 1);
  const old = classifyRecentIntent([...views(8, '14'), { entityKey: 'b0', actionType: 'like', timestampUtc: '2026-07-14T10:00:00Z' }, { entityKey: 'b1', actionType: 'like', timestampUtc: '2026-07-14T11:00:00Z' }], metadata, now);
  assert.equal(old.confidence, 'LOW'); assert.equal(old.burstUniqueMaterialCount, 0); assert.equal(old.uniqueRecentViewCount, 8);
  const failedStrong = classifyRecentIntent([...views(3), { entityKey: 'b0', actionType: 'reservation_cancelled', timestampUtc: '2026-07-19T11:30:00Z' }], metadata, now);
  assert.equal(failedStrong.confidence, 'LOW'); assert.equal(failedStrong.burstStrongActionCount, 0);
});

test('scattered full history cannot dilute a coherent burst, while a scattered burst remains LOW', () => {
  const mixed = new Map<string, IntentMetadata>(Array.from({ length: 42 }, (_, index) => [`m${index}`, { categoryKey: `cat-${index % 6}`, conceptKeys: [`concept-${index % 6}`], componentConceptKeys: [] }]));
  const scattered: RecentIntentEvent[] = [...Array.from({ length: 24 }, (_, index) => ({ entityKey: `m${10 + index}`, actionType: 'view', timestampUtc: `2026-07-19T${String(index % 12).padStart(2, '0')}:${String(index).padStart(2, '0')}:00Z` })), ...Array.from({ length: 31 }, (_, index) => ({ entityKey: `m${index}`, actionType: 'like', timestampUtc: `2026-07-19T${String(index % 12).padStart(2, '0')}:${String(index + 20).padStart(2, '0')}:00Z` })), { entityKey: 'm33', actionType: 'reservation', timestampUtc: '2026-07-19T11:59:00Z' }];
  const scatteredProfile = classifyRecentIntent(scattered, mixed, now); assert.equal(scatteredProfile.confidence, 'LOW'); assert.equal(scatteredProfile.uniqueRecentMaterialCount, 34); assert.equal(scatteredProfile.uniqueRecentViewCount, 24); assert.equal(scatteredProfile.activeRecentLikeCount, 31); assert.ok(scatteredProfile.dominantCategoryShare < .25); assert.ok(scatteredProfile.fullHistoryDominantCategoryShare < .25);
  const coherentMetadata = new Map(mixed); for (let index = 34; index < 42; index += 1) coherentMetadata.set(`m${index}`, { categoryKey: 'burst-category', conceptKeys: ['burst-concept'], componentConceptKeys: [] });
  const oldScattered = scattered.map((event, index) => ({ ...event, timestampUtc: `2026-07-${String(10 + index % 8).padStart(2, '0')}T01:00:00Z` }));
  const burst = Array.from({ length: 8 }, (_, index) => ({ entityKey: `m${34 + index}`, actionType: 'view', timestampUtc: `2026-07-19T11:${String(index).padStart(2, '0')}:00Z` }));
  const coherent = classifyRecentIntent([...oldScattered, ...burst, { entityKey: 'm34', actionType: 'like', timestampUtc: '2026-07-19T11:50:00Z' }, { entityKey: 'm35', actionType: 'like', timestampUtc: '2026-07-19T11:51:00Z' }], coherentMetadata, now);
  assert.equal(coherent.confidence, 'HIGH'); assert.equal(coherent.confidenceSource, 'VIEW_BURST');
  assert.equal(coherent.dominantCategoryShare, 1); assert.ok(coherent.fullHistoryDominantCategoryShare < .6);
  const fiveLikes = classifyRecentIntent(Array.from({ length: 5 }, (_, index) => ({ entityKey: `m${34 + index}`, actionType: 'like', timestampUtc: `2026-07-19T11:0${index}:00Z` })), coherentMetadata, now);
  assert.equal(fiveLikes.confidence, 'HIGH'); assert.equal(fiveLikes.confidenceSource, 'MULTI_LIKE_BURST'); assert.equal(fiveLikes.burstActiveLikeCount, 5);
});

test('rank fusion enforces quality and representation guardrails', () => {
  const longTerm = Array.from({ length: 20 }, (_, index) => ({ candidateKey: `a${index}`, score: 20 - index }));
  const recent = new Map([...Array.from({ length: 4 }, (_, index) => [`a${10 + index}`, .9 - index * .1] as const), ['a19', .01]]);
  assert.deepEqual(fuseMaterialRankings(longTerm, recent, 'NONE').ranking, longTerm);
  assert.deepEqual(fuseMaterialRankings(longTerm, recent, 'LOW').ranking, longTerm);
  const medium = fuseMaterialRankings(longTerm, recent, 'MEDIUM');
  assert.equal(medium.insertedTop5Count, 1); assert.equal(medium.insertedTop10Count, 1);
  const high = fuseMaterialRankings(longTerm, recent, 'HIGH');
  assert.equal(high.insertedTop5Count, 2); assert.equal(high.insertedTop10Count, 3);
  assert.equal(high.recentSlotsAllowedTop5, 2); assert.equal(high.recentSlotsUsedTop5, 2);
  assert.equal(high.recentSlotsAllowedTop10, 3); assert.equal(high.recentSlotsUsedTop10, 3);
  assert.deepEqual(high.qualifiedRecent.slice(0, 2).map((value) => value.candidateKey), ['a10', 'a11']);
  assert.ok(high.ranking.slice(0, 5).filter((value) => value.candidateKey.startsWith('a') && Number(value.candidateKey.slice(1)) < 10).length >= 2);
  assert.equal(high.ranking.some((value) => value.candidateKey === 'a19' && high.ranking.indexOf(value) < 10), false);
  assert.throws(() => fuseMaterialRankings([...longTerm, longTerm[0]!], recent, 'HIGH'), /duplicate_candidate/);
  const catalog = Array.from({ length: 161 }, (_, index) => ({ candidateKey: `p${index}`, score: 161 - index }));
  const catalogRecent = new Map(Array.from({ length: 30 }, (_, index) => [`p${100 + index}`, 1 - index / 100]));
  const durations: number[] = [];
  for (let run = 0; run < 200; run += 1) { const started = performance.now(); fuseMaterialRankings(catalog, catalogRecent, 'HIGH'); durations.push(performance.now() - started); }
  durations.sort((left, right) => left - right); const p95 = durations[Math.floor(durations.length * .95)]!;
  console.log(JSON.stringify({ slice4dFusionPerformance: { candidates: 161, runs: 200, p95Ms: p95 } }));
  assert.ok(p95 <= 2);
});

test('bounded fusion and confidence inputs always make monotonic progress', () => {
  const maximumCandidates = Array.from({ length: 200 }, (_, index) => ({ candidateKey: `max-${index}`, score: 200 - index }));
  const maximumRecent = new Map(maximumCandidates.map((value) => [value.candidateKey, 1]));
  const maximum = fuseMaterialRankings(maximumCandidates, maximumRecent, 'HIGH');
  assert.equal(maximum.ranking.length, 200);
  assert.equal(new Set(maximum.ranking.map((value) => value.candidateKey)).size, 200);

  const undersized = Array.from({ length: 3 }, (_, index) => ({ candidateKey: `small-${index}`, score: 3 - index }));
  const undersizedResult = fuseMaterialRankings(
    undersized,
    new Map(undersized.map((value) => [value.candidateKey, 1])),
    'HIGH',
  );
  assert.deepEqual(undersizedResult.ranking.map((value) => value.candidateKey).sort(), ['small-0', 'small-1', 'small-2']);

  const ineligibleRecent = fuseMaterialRankings(
    undersized,
    new Map([['not-a-candidate', 1], ['also-ineligible', 1]]),
    'HIGH',
  );
  assert.deepEqual(ineligibleRecent.ranking, undersized);

  const repeatedMetadata = new Map<string, IntentMetadata>(
    Array.from({ length: 200 }, (_, index) => [`repeat-${index}`, { categoryKey: 'same-category', conceptKeys: ['same-concept'], componentConceptKeys: [] }]),
  );
  const repeatedEvents = Array.from({ length: 200 }, (_, index) => ({ entityKey: `repeat-${index}`, actionType: 'view', timestampUtc: `2026-07-19T${String(index % 12).padStart(2, '0')}:00:00Z` }));
  const repeatedProfile = classifyRecentIntent(repeatedEvents, repeatedMetadata, now);
  assert.equal(repeatedProfile.dominantFeature, 'category:same-category');
  assert.equal(repeatedProfile.uniqueRecentMaterialCount, 200);

  const duplicateEvents = Array.from({ length: 200 }, (_, index) => ({ entityKey: 'repeat-0', actionType: 'view', timestampUtc: `2026-07-19T${String(index % 12).padStart(2, '0')}:00:00Z` }));
  const duplicateProfile = classifyRecentIntent(duplicateEvents, repeatedMetadata, now);
  assert.equal(duplicateProfile.burstUniqueViewCount, 1);
  assert.ok(duplicateProfile.rejectedCounts.duplicateOrCapped > 0);

  try {
    setMaterialFusionIterationBudgetForTests(0);
    assert.throws(
      () => fuseMaterialRankings(
        Array.from({ length: 4 }, (_, index) => ({ candidateKey: `bound-${index}`, score: 4 - index })),
        new Map([['bound-0', 1]]),
        'HIGH',
      ),
      /material_shadow_iteration_bound/,
    );
  } finally {
    setMaterialFusionIterationBudgetForTests(undefined);
  }
});

test('history outside the burst still contributes to recent scoring with unchanged decay', () => {
  const oldIntent = buildShortTermIntent([{ entityKey: 'b0', actionType: 'view', timestampUtc: '2026-07-17T12:00:00Z' }], metadata, now);
  const freshIntent = buildShortTermIntent([{ entityKey: 'b0', actionType: 'view', timestampUtc: '2026-07-19T11:00:00Z' }], metadata, now);
  const oldScore = recentItemScore(metadata.get('b0')!, oldIntent.intent); const freshScore = recentItemScore(metadata.get('b0')!, freshIntent.intent);
  assert.ok(oldScore > 0); assert.ok(oldScore < freshScore);
  assert.equal(classifyRecentIntent([{ entityKey: 'b0', actionType: 'view', timestampUtc: '2026-07-17T12:00:00Z' }], metadata, now).confidence, 'LOW');
});

test('three real-catalog preference-shift pairs pass fixed-universe HIGH fusion while 35% remains diagnostic', async () => {
  const model = await loadPortableModelArtifact(path.join(root, 'ml/recommendation/generated/portable-model/material-hybrid-runtime-v2.json'), 'material');
  const rows = await prisma.material.findMany({ where: { status: 'AVAILABLE', quantity: { gt: 0 }, taxonomyConcepts: { some: { concept: { status: 'ACTIVE' } } } }, take: 200, orderBy: { createdAt: 'asc' }, select: { id: true, categoryId: true, condition: true, isFree: true, pickupAllowed: true, deliveryAllowed: true, taxonomyConcepts: { where: { concept: { status: 'ACTIVE' } }, select: { concept: { select: { canonicalKey: true } } } } } });
  const byCategory = new Map<string, typeof rows>(); for (const row of rows) byCategory.set(row.categoryId, [...(byCategory.get(row.categoryId) ?? []), row]);
  const domains = [...byCategory].filter(([, values]) => values.length >= 8).map(([key]) => key).sort(); assert.ok(domains.length >= 4);
  const candidates = rows.map((row) => ({ candidateKey: row.id, categoryId: row.categoryId, metadata: { categoryKey: categoryKey(row.categoryId), conceptKeys: row.taxonomyConcepts.map((entry) => entry.concept.canonicalKey), componentConceptKeys: [] }, features: [[`category:${categoryKey(row.categoryId)}`, 1], ...row.taxonomyConcepts.map((entry) => [`concept:${entry.concept.canonicalKey}`, 1] as WeightedFeature), [`condition:${row.condition}`, 1], [`free:${Number(row.isFree)}`, 1], [`pickup:${Number(row.pickupAllowed)}`, 1], [`delivery:${Number(row.deliveryAllowed)}`, 1]] as WeightedFeature[] }));
  const itemMetadata = new Map(candidates.map((value) => [value.candidateKey, value.metadata]));
  const results = [];
  for (let index = 0; index < 3; index += 1) {
    const domainA = domains[index]!; const domainB = domains[index + 1]!;
    const longTerm = scorePortableLightFm(model, [[`interest:${categoryKey(domainA)}`, 1]], candidates).scored;
    const target = candidates.filter((value) => value.categoryId === domainB).slice(0, 8);
    const events: RecentIntentEvent[] = [...target.map((value, eventIndex) => ({ entityKey: value.candidateKey, actionType: 'view', timestampUtc: `2026-07-19T${String(eventIndex + 1).padStart(2, '0')}:00:00Z` })), ...target.slice(0, 2).map((value, eventIndex) => ({ entityKey: value.candidateKey, actionType: 'like', timestampUtc: `2026-07-19T${String(eventIndex + 9).padStart(2, '0')}:00:00Z` }))];
    const intent = buildShortTermIntent(events, itemMetadata, now); const recent = new Map(candidates.map((value) => [value.candidateKey, recentItemScore(value.metadata, intent.intent)]));
    const profile = classifyRecentIntent(events, itemMetadata, now); assert.equal(profile.confidence, 'HIGH');
    const fused = fuseMaterialRankings(longTerm, recent, profile.confidence).ranking;
    const top5 = fused.slice(0, 5).map((value) => candidates.find((candidate) => candidate.candidateKey === value.candidateKey)!.categoryId);
    assert.ok(top5.filter((value) => value === domainB).length >= 1 && top5.filter((value) => value === domainB).length <= 2);
    assert.ok(top5.filter((value) => value === domainA).length >= 2);
    results.push({ pair: index + 1, confidence: profile.confidence, recentTop5: top5.filter((value) => value === domainB).length, longTermTop5: top5.filter((value) => value === domainA).length, candidateCount: candidates.length });
  }
  const casebook = JSON.parse(await readFile(path.join(root, 'ml/recommendation/generated/benchmark-b/new-users/recommendation-casebook.json'), 'utf8')) as Array<{ stage: string; staged_actions: unknown[]; cohort: string }>;
  const profileOnly = casebook.filter((value) => value.stage === 'T0_PROFILE_ONLY'); assert.equal(profileOnly.length, 50); assert.ok(profileOnly.every((value) => value.staged_actions.length === 0));
  assert.ok(
    env.recommendationMlRuntimeMode === 'DETERMINISTIC' ||
      env.recommendationMlRuntimeMode === 'SHADOW' ||
      env.recommendationMlRuntimeMode === 'ML_PRIMARY',
  );
  console.log(JSON.stringify({ slice4d: { pairs: results, casebookRows: casebook.length, profileOnlyUnchanged: profileOnly.length, projectGap: 'NO_COMPONENT_MATERIAL_CONCEPT_OVERLAP' } }));
  await prisma.$disconnect();
});
