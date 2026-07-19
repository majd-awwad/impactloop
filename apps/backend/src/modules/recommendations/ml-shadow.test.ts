import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import { env } from '../../config/env.js';
import { resetLoggerForTests, setLoggerDestinationForTests } from '../../observability/logger.js';
import { combineNormalizedScores, scorePortableLightFm } from './ml-lightfm-scorer.js';
import { loadPortableModelArtifact, validatePortableModelArtifact } from './ml-model-artifact.js';
import { clearMlArtifactCacheForTests, runMlShadowComparison, setMlShadowFailureForTests, setMlShadowNeverSettleForTests, setMlShadowObserverForTests, type MlShadowFailurePhase, type ShadowDiagnostics } from './ml-shadow.service.js';
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
  const priorEnabled = env.recommendationMlShadowEnabled;
  env.recommendationMlShadowEnabled = false;
  assert.equal(env.recommendationMlMaterialServingEnabled, false);
  assert.equal(env.recommendationMlProjectServingEnabled, false);
  const response = { ordering: ['active', 'unchanged'] };
  const observations: Array<ShadowDiagnostics & { domain: 'material' | 'project' }> = [];
  const logLines: string[] = []; const logStream = new PassThrough(); logStream.on('data', (chunk) => logLines.push(chunk.toString())); setLoggerDestinationForTests(logStream); resetLoggerForTests();
  setMlShadowObserverForTests((value) => observations.push(value));
  const result = await runMlShadowComparison({ response, domain: 'material', interests: [], candidates: [], activeCandidateKeys: [], currentTopKeys: [], recentEvents: [], evaluationTimestamp: '2026-08-10T00:00:00Z' });
  assert.strictEqual(result.response, response); assert.equal(result.diagnostics.status, 'DISABLED');
  assert.equal(observations.length, 0);
  assert.doesNotMatch(logLines.join(''), /recommendationMlMaterialShadowDiagnostics/);
  setMlShadowObserverForTests(undefined);
  setLoggerDestinationForTests(null); resetLoggerForTests();
  env.recommendationMlShadowEnabled = priorEnabled;
});

test('material serving cannot bypass a disabled shadow flag', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, materialServing: env.recommendationMlMaterialServingEnabled };
  env.recommendationMlShadowEnabled = false;
  env.recommendationMlMaterialServingEnabled = true;
  const response = { ordering: ['deterministic'] };
  const result = await runMlShadowComparison({ response, domain: 'material', interests: [], candidates: [], activeCandidateKeys: [], currentTopKeys: [], recentEvents: [], evaluationTimestamp: '2026-08-10T00:00:00Z' });
  assert.strictEqual(result.response, response);
  assert.equal(result.diagnostics.status, 'DISABLED');
  assert.equal(result.rankedCandidateKeys, undefined);
  env.recommendationMlShadowEnabled = prior.enabled;
  env.recommendationMlMaterialServingEnabled = prior.materialServing;
});

test('enabled shadow scores bounded candidates and failures safely fall back', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, materialServing: env.recommendationMlMaterialServingEnabled, projectServing: env.recommendationMlProjectServingEnabled, materialPath: env.recommendationMlMaterialArtifactPath, projectPath: env.recommendationMlProjectArtifactPath };
  env.recommendationMlShadowEnabled = true; env.recommendationMlMaterialServingEnabled = true; env.recommendationMlProjectServingEnabled = true; env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid.json'); env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid.json'); clearMlArtifactCacheForTests();
  const response = { visible: ['x'] };
  const input = { response, domain: 'material' as const, interests: ['Electronics & Components'], candidates: [{ candidateKey: 'x', categoryId: 'invented-category', categoryLabel: 'Electronics & Components', condition: 'GOOD', isFree: true, pickupAllowed: true, deliveryAllowed: false }], activeCandidateKeys: ['x'], currentTopKeys: ['x'], recentEvents: [], evaluationTimestamp: '2026-08-10T00:00:00Z' };
  const scored = await runMlShadowComparison(input); assert.strictEqual(scored.response, response); assert.equal(scored.diagnostics.status, 'SCORED'); assert.deepEqual(scored.rankedCandidateKeys, ['x']);
  const projectScored = await runMlShadowComparison({ ...input, response: { visible: ['project'] }, domain: 'project', candidates: [{ candidateKey: 'p', categoryId: 'invented-category', categoryLabel: 'Electronics & Components', difficulty: 'BEGINNER' }], activeCandidateKeys: ['p'], currentTopKeys: ['p'] });
  assert.equal(projectScored.diagnostics.status, 'SCORED'); assert.equal(projectScored.rankedCandidateKeys, undefined);
  env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'missing.json'); clearMlArtifactCacheForTests();
  const failed = await runMlShadowComparison(input); assert.strictEqual(failed.response, response); assert.equal(failed.diagnostics.status, 'FALLBACK');
  env.recommendationMlShadowEnabled = prior.enabled; env.recommendationMlMaterialServingEnabled = prior.materialServing; env.recommendationMlProjectServingEnabled = prior.projectServing; env.recommendationMlMaterialArtifactPath = prior.materialPath; env.recommendationMlProjectArtifactPath = prior.projectPath; clearMlArtifactCacheForTests();
});

test('material development diagnostics are sanitized and preserve the deterministic response', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, path: env.recommendationMlMaterialArtifactPath };
  const observations: Array<ShadowDiagnostics & { domain: 'material' | 'project' }> = [];
  const logLines: string[] = []; const logStream = new PassThrough(); logStream.on('data', (chunk) => logLines.push(chunk.toString())); setLoggerDestinationForTests(logStream); resetLoggerForTests();
  env.recommendationMlShadowEnabled = true; env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid.json'); clearMlArtifactCacheForTests();
  setMlShadowObserverForTests((value) => observations.push(value));
  const response = { sections: [{ key: 'suggested_materials', materials: ['visible-id'] }] };
  const candidates = Array.from({ length: 12 }, (_, index) => ({ candidateKey: `candidate-${index}`, categoryId: 'recent-category', categoryLabel: 'Recent category', conceptKeys: ['recent-concept'], condition: 'GOOD', isFree: true, pickupAllowed: true, deliveryAllowed: false }));
  const recentEvents = candidates.slice(0, 8).flatMap((candidate, index) => [{ entityKey: candidate.candidateKey, actionType: 'view', timestampUtc: `2026-08-10T${String(index + 1).padStart(2, '0')}:00:00Z` }, ...(index < 2 ? [{ entityKey: candidate.candidateKey, actionType: 'like', timestampUtc: `2026-08-10T${String(index + 9).padStart(2, '0')}:00:00Z` }] : [])]);
  const result = await runMlShadowComparison({ response, domain: 'material', interests: [], candidates, activeCandidateKeys: candidates.map((value) => value.candidateKey), currentTopKeys: candidates.map((value) => value.candidateKey), recentEvents, evaluationTimestamp: '2026-08-10T12:00:00Z' });
  assert.strictEqual(result.response, response);
  assert.equal(observations.length, 1);
  const diagnostic = observations[0]!;
  assert.equal(diagnostic.recentConfidence, 'HIGH');
  assert.equal(diagnostic.confidenceSource, 'VIEW_BURST'); assert.equal(diagnostic.burstWindowHours, 24); assert.equal(diagnostic.burstUniqueViewCount, 8); assert.equal(diagnostic.burstActiveLikeCount, 2);
  assert.ok((diagnostic.rankMovement?.filter((value) => value.fusedRank <= 5).length ?? 0) >= (diagnostic.recentSlotsUsedTop5 ?? 0));
  assert.ok((diagnostic.rankMovement?.filter((value) => value.fusedRank <= 10).length ?? 0) >= (diagnostic.recentSlotsUsedTop10 ?? 0));
  assert.ok((diagnostic.qualifiedRecentCandidateCount ?? 0) >= (diagnostic.recentSlotsUsedTop5 ?? 0));
  assert.ok(diagnostic.rankMovement?.every((value) => /^[a-f0-9]{16}$/.test(value.candidateKeyHash)));
  assert.ok((diagnostic.rankMovement?.length ?? 0) <= 5);
  const serialized = JSON.stringify(diagnostic);
  for (const prohibited of ['userId', 'email', 'title', 'description', 'rawMaterialId', 'featureVector', 'embedding', 'interactionHistory', 'candidate-0']) assert.doesNotMatch(serialized, new RegExp(prohibited, 'i'));
  const logged = logLines.flatMap((line) => line.trim().split('\n')).filter(Boolean).map((line) => JSON.parse(line)).find((entry) => entry.operation === 'recommendation.ml.material-decision');
  assert.equal(logged.mode, 'SHADOW'); assert.equal(logged.confidenceLevel, 'HIGH'); assert.equal(logged.confidenceSource, 'VIEW_BURST'); assert.equal(logged.domain, 'material'); assert.ok(logged.totalRecommendationDurationMs >= 0);
  const loggedText = JSON.stringify(logged); assert.doesNotMatch(loggedText, /\[filtered\]|candidate-0|userId|email|title|description|embedding|rankMovement/i);
  const stageEntries = logLines.flatMap((line) => line.trim().split('\n')).filter(Boolean).map((line) => JSON.parse(line)).flatMap((entry) => entry.operation === 'recommendation.ml-shadow.material-stage' && typeof entry.event === 'string' ? [JSON.parse(entry.event)] : []);
  assert.equal(stageEntries.length, 0);
  setMlShadowObserverForTests(undefined); setLoggerDestinationForTests(null); resetLoggerForTests(); env.recommendationMlShadowEnabled = prior.enabled; env.recommendationMlMaterialArtifactPath = prior.path; clearMlArtifactCacheForTests();
});

test('real learner-home shadow shape fails safe across confidence, dominance, fusion, diagnostics, logger, and redaction failures', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, path: env.recommendationMlMaterialArtifactPath };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid-runtime-v2.json');
  clearMlArtifactCacheForTests();
  const response = { profileCompletion: { hasInterests: true }, sections: [{ key: 'suggested_materials', items: ['deterministic'] }] };
  const candidates = Array.from({ length: 107 }, (_, index) => ({ candidateKey: `real-material-${index}`, categoryId: `real-category-${index % 9}`, categoryLabel: `Category ${index % 9}`, conceptKeys: index % 3 === 0 ? [`concept-${index % 11}`] : [], condition: 'GOOD', isFree: index % 2 === 0, pickupAllowed: true, deliveryAllowed: index % 4 === 0 }));
  const recentEvents = Array.from({ length: 26 }, (_, index) => ({ entityKey: `real-material-${index % 21}`, actionType: index % 3 === 0 ? 'like' : 'view', timestampUtc: `2026-07-19T${String(index % 12).padStart(2, '0')}:00:00Z` }));
  const input = { response, domain: 'material' as const, interests: ['Category 1'], candidates, activeCandidateKeys: candidates.map((value) => value.candidateKey), currentTopKeys: candidates.slice(0, 10).map((value) => value.candidateKey), currentSections: [{ sectionKey: 'suggested_materials', candidateKeys: candidates.slice(0, 10).map((value) => value.candidateKey) }], recentEvents, recentEntityMetadata: Array.from({ length: 29 }, (_, index) => ({ entityKey: `real-project-${index}`, candidateKey: `real-project-${index}`, categoryId: `project-category-${index % 4}`, categoryLabel: `Project Category ${index % 4}`, conceptKeys: [`project-concept-${index % 5}`], componentConceptKeys: [`component-${index % 7}`] })), evaluationTimestamp: '2026-07-19T12:00:00Z' };
  setMlShadowFailureForTests(undefined);
  const realShape = await runMlShadowComparison({ ...input, currentSections: [{ sectionKey: 'suggested_materials', candidateKeys: candidates.slice(0, 3).map((value) => value.candidateKey) }] });
  assert.strictEqual(realShape.response, response);
  assert.equal(realShape.diagnostics.status, 'SCORED');
  const phases: MlShadowFailurePhase[] = ['confidence', 'dominance', 'fusion', 'diagnostics', 'logger', 'redaction'];
  try {
    for (const phase of phases) {
      setMlShadowFailureForTests(phase);
      const result = await runMlShadowComparison(input);
      assert.strictEqual(result.response, response, `${phase} changed the original response object`);
      assert.equal(result.diagnostics.status, 'FALLBACK');
      assert.equal(result.diagnostics.fallbackReason, `injected_${phase}_failure`);
      assert.ok(result.diagnostics.fallbackReason.length <= 240);
    }
  } finally {
    setMlShadowFailureForTests(undefined);
    env.recommendationMlShadowEnabled = prior.enabled;
    env.recommendationMlMaterialArtifactPath = prior.path;
    clearMlArtifactCacheForTests();
  }
});

test('never-settling async material shadow is bounded by the secondary timeout', async () => {
  const response = { deterministic: true };
  const started = performance.now();
  setMlShadowNeverSettleForTests(response);
  try {
    const result = await runMlShadowComparison({
      response,
      domain: 'material',
      interests: [],
      candidates: [],
      activeCandidateKeys: [],
      currentTopKeys: [],
      recentEvents: [],
      evaluationTimestamp: '2026-07-19T12:00:00Z',
    });
    assert.strictEqual(result.response, response);
    assert.equal(result.diagnostics.status, 'FALLBACK');
    assert.equal(result.diagnostics.fallbackReason, 'material_shadow_timeout');
    assert.ok(performance.now() - started < 1_500);
  } finally {
    setMlShadowNeverSettleForTests();
  }
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
