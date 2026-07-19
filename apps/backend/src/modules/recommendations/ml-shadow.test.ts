import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { env } from '../../config/env.js';
import { combineNormalizedScores, scorePortableLightFm } from './ml-lightfm-scorer.js';
import { loadPortableModelArtifact, validatePortableModelArtifact } from './ml-model-artifact.js';
import { clearMlArtifactCacheForTests, runMlShadowComparison } from './ml-shadow.service.js';
import { buildShortTermIntent, recentItemScore, SHORT_TERM_CONFIG } from './short-term-intent.js';

const repositoryRoot = process.cwd().endsWith(path.join('apps', 'backend')) ? path.resolve(process.cwd(), '../..') : process.cwd();
const portableRoot = path.join(repositoryRoot, 'ml/recommendation/generated/portable-model');

test('portable artifacts exclude Benchmark B and prohibited features', async () => {
  for (const domain of ['material', 'project'] as const) {
    const artifact = await loadPortableModelArtifact(path.join(portableRoot, `${domain}-hybrid.json`), domain);
    const text = JSON.stringify(artifact);
    assert.doesNotMatch(text, /SYNTHETIC_CATALOG_EXTENSION|identity:|material_type|hidden|cohort/i);
  }
});

test('loader rejects hash, dimensions, non-finite values, duplicate keys, and domain', async () => {
  const valid = JSON.parse(await readFile(path.join(portableRoot, 'material-hybrid.json'), 'utf8'));
  assert.throws(() => validatePortableModelArtifact({ ...valid, content_hash: '0'.repeat(64) }), /artifact_content_hash/);
  assert.throws(() => validatePortableModelArtifact({ ...valid, latent_dimension: 99 }), /feature_dimension/);
  const nonFinite = structuredClone(valid); nonFinite.user_features[0].bias = "NaN";
  assert.throws(() => validatePortableModelArtifact(nonFinite), /non_finite/);
  const duplicate = structuredClone(valid); duplicate.user_features.push(duplicate.user_features[0]);
  assert.throws(() => validatePortableModelArtifact(duplicate), /duplicate/);
  assert.throws(() => validatePortableModelArtifact(valid, 'project'), /artifact_domain/);
});

test('Python and TypeScript LightFM scores and Top-K match', async () => {
  const fixtures = JSON.parse(await readFile(path.join(portableRoot, 'parity-fixtures.json'), 'utf8'));
  for (const fixture of fixtures.lightfm_cases) {
    const artifact = await loadPortableModelArtifact(path.join(portableRoot, `${fixture.domain}-hybrid.json`), fixture.domain);
    const result = scorePortableLightFm(artifact, fixture.user_features, fixture.candidates.map((candidate: any) => ({ candidateKey: candidate.candidate_key, features: candidate.features })));
    for (const candidate of fixture.candidates) {
      const actual = result.scored.find((value) => value.candidateKey === candidate.candidate_key)!.score;
      assert.ok(Math.abs(actual - candidate.python_score) <= 1e-9);
    }
    assert.deepEqual(result.scored.slice(0, 5).map((value) => value.candidateKey), fixture.python_top5);
    assert.deepEqual(result.scored.slice(0, 10).map((value) => value.candidateKey), fixture.python_top10);
  }
});

test('Python and TypeScript recent intent, decay, reversals, caps, and blend match', async () => {
  const fixtures = JSON.parse(await readFile(path.join(portableRoot, 'parity-fixtures.json'), 'utf8'));
  for (const fixture of fixtures.intent_cases) {
    const metadata = new Map(Object.entries(fixture.metadata).map(([key, value]: [string, any]) => [key, { categoryKey: value.category_key, conceptKeys: value.concept_keys, componentConceptKeys: value.component_concept_keys }]));
    const recent = buildShortTermIntent(fixture.events.map((value: any) => ({ entityKey: value.entity_key, actionType: value.action_type, timestampUtc: value.timestamp_utc })), metadata, fixture.evaluation_timestamp);
    const recentScores = new Map<string, number>();
    for (const [key, expected] of Object.entries(fixture.python_recent_scores) as Array<[string, number]>) {
      const actual = recentItemScore(metadata.get(key)!, recent.intent); recentScores.set(key, actual); assert.ok(Math.abs(actual - expected) <= 1e-9, `${fixture.name}:${key}:${actual}:${expected}`);
    }
    const combined = combineNormalizedScores(Object.entries(fixture.base_scores).map(([candidateKey, score]) => ({ candidateKey, score: Number(score) })), recentScores, SHORT_TERM_CONFIG.recentBlend);
    assert.deepEqual(combined.map((value) => value.candidateKey), fixture.python_combined_top, fixture.name);
  }
});

test('flags default disabled and shadow returns exact response object', async () => {
  assert.equal(env.recommendationMlShadowEnabled, false);
  assert.equal(env.recommendationMlMaterialServingEnabled, false);
  assert.equal(env.recommendationMlProjectServingEnabled, false);
  const response = { ordering: ['active', 'unchanged'] };
  const result = await runMlShadowComparison({ response, domain: 'material', interests: [], candidates: [], activeCandidateKeys: [], currentTopKeys: [], recentEvents: [], evaluationTimestamp: '2026-08-10T00:00:00Z' });
  assert.strictEqual(result.response, response); assert.equal(result.diagnostics.status, 'DISABLED');
});

test('enabled shadow scores bounded candidates and failures safely fall back', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, path: env.recommendationMlMaterialArtifactPath };
  env.recommendationMlShadowEnabled = true; env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid.json'); clearMlArtifactCacheForTests();
  const response = { visible: ['x'] };
  const input = { response, domain: 'material' as const, interests: ['Electronics & Components'], candidates: [{ candidateKey: 'x', categoryId: 'invented-category', categoryLabel: 'Electronics & Components', condition: 'GOOD', isFree: true, pickupAllowed: true, deliveryAllowed: false }], activeCandidateKeys: ['x'], currentTopKeys: ['x'], recentEvents: [], evaluationTimestamp: '2026-08-10T00:00:00Z' };
  const scored = await runMlShadowComparison(input); assert.strictEqual(scored.response, response); assert.equal(scored.diagnostics.status, 'SCORED');
  env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'missing.json'); clearMlArtifactCacheForTests();
  const failed = await runMlShadowComparison(input); assert.strictEqual(failed.response, response); assert.equal(failed.diagnostics.status, 'FALLBACK');
  env.recommendationMlShadowEnabled = prior.enabled; env.recommendationMlMaterialArtifactPath = prior.path; clearMlArtifactCacheForTests();
});

test('candidate duplicates disable shadow and cached catalog-scale scoring stays bounded', async () => {
  const loadStarted = performance.now(); const artifact = await loadPortableModelArtifact(path.join(portableRoot, 'material-hybrid.json'), 'material'); const loadMs = performance.now() - loadStarted;
  const projectLoadStarted = performance.now(); const projectArtifact = await loadPortableModelArtifact(path.join(portableRoot, 'project-hybrid.json'), 'project'); const projectLoadMs = performance.now() - projectLoadStarted;
  const fixture = JSON.parse(await readFile(path.join(portableRoot, 'parity-fixtures.json'), 'utf8')).lightfm_cases[0];
  const candidates = Array.from({ length: 161 }, (_, index) => ({ candidateKey: `candidate-${String(index).padStart(3, '0')}`, features: fixture.candidates[index % fixture.candidates.length].features }));
  const timings: number[] = []; const memoryBefore = process.memoryUsage().heapUsed;
  for (let run = 0; run < 100; run += 1) { const started = performance.now(); const scored = scorePortableLightFm(artifact, fixture.user_features, candidates); combineNormalizedScores(scored.scored, new Map(), SHORT_TERM_CONFIG.recentBlend); timings.push(performance.now() - started); }
  const projectCandidates = candidates.slice(0, 29); const projectTimings: number[] = [];
  for (let run = 0; run < 100; run += 1) { const started = performance.now(); scorePortableLightFm(projectArtifact, fixture.user_features, projectCandidates); projectTimings.push(performance.now() - started); }
  projectTimings.sort((a, b) => a - b);
  const intentMetadata = new Map(candidates.map((value) => [value.candidateKey, { categoryKey: 'category', conceptKeys: [], componentConceptKeys: [] }]));
  const intentStarted = performance.now(); const intent = buildShortTermIntent([{ entityKey: candidates[0]!.candidateKey, actionType: 'view', timestampUtc: '2026-08-09T00:00:00Z' }], intentMetadata, '2026-08-10T00:00:00Z'); const shortTermProfileMs = performance.now() - intentStarted;
  const rerankStarted = performance.now(); new Map(candidates.map((value) => [value.candidateKey, recentItemScore(intentMetadata.get(value.candidateKey)!, intent.intent)])); const combinedRerankMs = performance.now() - rerankStarted;
  timings.sort((a, b) => a - b); const p50 = timings[49]!; const p95 = timings[94]!; const memoryIncreaseBytes = Math.max(0, process.memoryUsage().heapUsed - memoryBefore);
  console.log(JSON.stringify({ slice4aPerformance: { materialArtifactLoadMs: loadMs, projectArtifactLoadMs: projectLoadMs, artifactSizeBytes: (await readFile(path.join(portableRoot, 'material-hybrid.json'))).byteLength, material161P50Ms: p50, material161P95Ms: p95, project29P50Ms: projectTimings[49], project29P95Ms: projectTimings[94], shortTermProfileMs, combinedRerankMs, memoryIncreaseBytes } }));
  assert.ok(p95 < 50, `material scoring p95 ${p95}ms`);
  const prior = env.recommendationMlShadowEnabled; env.recommendationMlShadowEnabled = true;
  const response = { unchanged: true }; const duplicate = { candidateKey: 'same', categoryId: 'category', categoryLabel: 'Category' };
  const result = await runMlShadowComparison({ response, domain: 'material', interests: [], candidates: [duplicate, duplicate], activeCandidateKeys: ['same'], currentTopKeys: [], recentEvents: [], evaluationTimestamp: '2026-08-10T00:00:00Z' });
  assert.strictEqual(result.response, response); assert.equal(result.diagnostics.fallbackReason, 'candidate_mismatch'); env.recommendationMlShadowEnabled = prior;
});
