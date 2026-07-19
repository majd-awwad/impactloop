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
import { fuseMaterialRankings } from './material-rank-fusion.js';

const root = process.cwd().endsWith(path.join('apps', 'backend')) ? path.resolve(process.cwd(), '../..') : process.cwd();
const categoryKey = (id: string) => createHash('sha256').update(`impactloop-category:${id}`).digest('hex');
const now = '2026-07-19T12:00:00Z';
const metadata = new Map<string, IntentMetadata>(Array.from({ length: 12 }, (_, index) => [`b${index}`, { categoryKey: 'b', conceptKeys: ['shared-b'], componentConceptKeys: [] }]));
const views = (count: number, day = '19'): RecentIntentEvent[] => Array.from({ length: count }, (_, index) => ({ entityKey: `b${index}`, actionType: 'view', timestampUtc: `2026-07-${day}T${String(index + 1).padStart(2, '0')}:00:00Z` }));

test('confidence gates are deterministic, reversal-aware, capped, coherent, and decay', () => {
  assert.equal(classifyRecentIntent([], metadata, now).confidence, 'NONE');
  assert.equal(classifyRecentIntent([{ entityKey: 'b0', actionType: 'like', timestampUtc: '2026-07-19T10:00:00Z' }], metadata, now).confidence, 'LOW');
  assert.equal(classifyRecentIntent(views(3), metadata, now).confidence, 'LOW');
  assert.equal(classifyRecentIntent(views(4), metadata, now).confidence, 'MEDIUM');
  const high = [...views(8), { entityKey: 'b0', actionType: 'like', timestampUtc: '2026-07-19T10:00:00Z' }, { entityKey: 'b1', actionType: 'like', timestampUtc: '2026-07-19T11:00:00Z' }];
  assert.equal(classifyRecentIntent(high, metadata, now).confidence, 'HIGH');
  assert.deepEqual(classifyRecentIntent(high, metadata, now), classifyRecentIntent(high, metadata, now));
  assert.notEqual(classifyRecentIntent([...high, { entityKey: 'b0', actionType: 'unlike', timestampUtc: '2026-07-19T11:30:00Z' }], metadata, now).activeRecentLikeCount, 2);
  assert.notEqual(classifyRecentIntent(Array.from({ length: 20 }, (_, index) => ({ entityKey: 'b0', actionType: 'view', timestampUtc: `2026-07-19T${String(index % 12).padStart(2, '0')}:00:00Z` })), metadata, now).confidence, 'HIGH');
  const old = [...views(8, '14'), { entityKey: 'b0', actionType: 'like', timestampUtc: '2026-07-14T10:00:00Z' }, { entityKey: 'b1', actionType: 'like', timestampUtc: '2026-07-14T11:00:00Z' }];
  assert.equal(classifyRecentIntent(old, metadata, now).confidence, 'MEDIUM');
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
  assert.equal(env.recommendationMlMaterialServingEnabled, false); assert.equal(env.recommendationMlProjectServingEnabled, false);
  console.log(JSON.stringify({ slice4d: { pairs: results, casebookRows: casebook.length, profileOnlyUnchanged: profileOnly.length, projectGap: 'NO_COMPONENT_MATERIAL_CONCEPT_OVERLAP' } }));
  await prisma.$disconnect();
});
