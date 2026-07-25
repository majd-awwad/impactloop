import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import { env } from '../../config/env.js';
import { resetLoggerForTests, setLoggerDestinationForTests } from '../../observability/logger.js';
import { combineNormalizedScores, scorePortableLightFm } from './ml-lightfm-scorer.js';
import { loadPortableModelArtifact, validatePortableModelArtifact } from './ml-model-artifact.js';
import { calculateProjectTop10RankMovement, calculateProjectTopKOverlap, clearMlArtifactCacheForTests, runMlShadowComparison, setMlShadowFailureForTests, setMlShadowInterestRegistryLoaderForTests, setMlShadowNeverSettleForTests, setMlShadowObserverForTests, type MlShadowFailurePhase, type ShadowDiagnostics } from './ml-shadow.service.js';
import { isolatedRecommendationTest } from './recommendation-test-isolation.js';
import { buildShortTermIntent, recentItemScore, SHORT_TERM_CONFIG } from './short-term-intent.js';
import {
  TAXONOMY_ALIAS_SOURCE,
  type LearnerInterestRegistryConcept,
} from '../taxonomy/learner-interest-resolver.js';
import { normalizeTaxonomyAlias } from '../taxonomy/taxonomy-normalization.js';

const emptyInterestRegistry = async (): Promise<
  readonly LearnerInterestRegistryConcept[]
> => [];

const fixtureInterestRegistry = async (): Promise<
  readonly LearnerInterestRegistryConcept[]
> => [
  {
    id: 'concept-arduino',
    canonicalKey: 'interest:arduino',
    conceptType: 'INTEREST',
    status: 'ACTIVE',
    labelEn: 'Arduino',
    labelAr: 'أردوينو',
    aliases: [
      {
        id: 'alias-arduino-en',
        alias: 'Arduino',
        normalizedAlias: normalizeTaxonomyAlias('Arduino'),
        language: 'EN',
        aliasType: 'CANONICAL',
        source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
        isActive: true,
      },
    ],
    learnerInterests: [{ id: 'legacy-arduino', learnerInterestKey: 'arduino' }],
  },
  {
    id: 'concept-robotics',
    canonicalKey: 'interest:robotics',
    conceptType: 'INTEREST',
    status: 'ACTIVE',
    labelEn: 'Robotics',
    labelAr: 'الروبوتات',
    aliases: [],
    learnerInterests: [
      { id: 'legacy-robotics', learnerInterestKey: 'robotics' },
    ],
  },
];

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

isolatedRecommendationTest('flags default disabled and shadow returns exact response object', async () => {
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

isolatedRecommendationTest('material serving cannot bypass a disabled shadow flag', async () => {
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

isolatedRecommendationTest('project shadow recent intent diagnostics stay privacy-safe without mutating the response', async () => {
  const prior = { shadow: env.recommendationMlShadowEnabled, projectServing: env.recommendationMlProjectServingEnabled, projectPath: env.recommendationMlProjectArtifactPath };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlProjectServingEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid-runtime-v2.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  const observations: Array<ShadowDiagnostics & { domain: 'material' | 'project' }> = [];
  setMlShadowObserverForTests((value) => observations.push(value));
  try {
    const response = { sections: [{ key: 'suggested_projects', items: ['deterministic-a'] }] };
    const candidates = Array.from({ length: 8 }, (_, index) => ({
      candidateKey: `shadow-project-${index}`,
      categoryId: `category-${index % 2}`,
      categoryLabel: `Category ${index % 2}`,
      difficulty: 'BEGINNER',
      conceptKeys: index < 4 ? ['robotics-core'] : ['textiles-core'],
      componentConceptKeys: [`component-${index % 3}`],
    }));
    const profileOnly = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: [],
      candidates,
      activeCandidateKeys: candidates.map((value) => value.candidateKey),
      currentTopKeys: ['deterministic-a'],
      recentEvents: [],
      evaluationTimestamp: '2026-07-19T12:00:00Z',
    });
    assert.strictEqual(profileOnly.response, response);
    assert.equal(profileOnly.diagnostics.recentConfidence, 'NONE');
    assert.equal(profileOnly.diagnostics.recentSlotsUsedTop5, 0);
    assert.equal(profileOnly.rankedCandidateKeys, undefined);

    const coherentEvents = [
      { entityKey: 'shadow-project-0', actionType: 'project_save', timestampUtc: '2026-07-19T10:00:00Z' },
      { entityKey: 'shadow-project-1', actionType: 'like', timestampUtc: '2026-07-19T10:05:00Z' },
      { entityKey: 'shadow-project-0', actionType: 'like', timestampUtc: '2026-07-19T10:10:00Z' },
      { entityKey: 'shadow-project-1', actionType: 'project_save', timestampUtc: '2026-07-19T10:15:00Z' },
    ];
    const coherent = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: [],
      candidates,
      activeCandidateKeys: candidates.map((value) => value.candidateKey),
      currentTopKeys: ['deterministic-a'],
      recentEvents: coherentEvents,
      evaluationTimestamp: '2026-07-19T12:00:00Z',
    });
    assert.strictEqual(coherent.response, response);
    assert.equal(coherent.rankedCandidateKeys, undefined);
    assert.equal(coherent.diagnostics.projectReadinessStatus, 'NOT_READY');
    assert.equal(coherent.diagnostics.featureReadiness?.status, 'NOT_READY');
    // Synthetic concept keys may not map into the artifact; fusion runs only when mapping integrity is healthy.
    if ((coherent.diagnostics.runtimeCandidatesMissingFromArtifact ?? 1) === 0) {
      assert.ok(['MEDIUM', 'HIGH'].includes(String(coherent.diagnostics.recentConfidence)));
      assert.ok((coherent.diagnostics.recentSlotsUsedTop5 ?? 0) <= 2);
      assert.ok((coherent.diagnostics.recentSlotsUsedTop10 ?? 0) <= 3);
      assert.ok((coherent.diagnostics.recentFusionDurationMs ?? 0) > 0);
    } else {
      assert.equal(coherent.diagnostics.recentConfidence, 'NONE');
    }
    assert.doesNotMatch(JSON.stringify(coherent.diagnostics), /shadow-project|robotics-core|textiles-core/i);
    assert.ok((coherent.diagnostics.totalProjectRecommendationDurationMs ?? -1) >= 0);
    assert.ok((coherent.diagnostics.recentFusionDurationMs ?? -1) >= 0);
    assert.ok(observations.filter((value) => value.domain === 'project').length >= 1);
  } finally {
    setMlShadowObserverForTests(undefined);
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectServingEnabled = prior.projectServing;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
  }
});

isolatedRecommendationTest('project shadow failure does not change material serving path', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, materialServing: env.recommendationMlMaterialServingEnabled, materialPath: env.recommendationMlMaterialArtifactPath, projectPath: env.recommendationMlProjectArtifactPath };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlMaterialServingEnabled = true;
  env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid.json');
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'missing-project-artifact.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  try {
    const response = { visible: ['material-x'] };
    const material = await runMlShadowComparison({
      response,
      domain: 'material',
      interests: ['Electronics & Components'],
      candidates: [{ candidateKey: 'material-x', categoryId: 'invented-category', categoryLabel: 'Electronics & Components', condition: 'GOOD', isFree: true, pickupAllowed: true, deliveryAllowed: false }],
      activeCandidateKeys: ['material-x'],
      currentTopKeys: ['material-x'],
      recentEvents: [],
      evaluationTimestamp: '2026-08-10T00:00:00Z',
    });
    assert.equal(material.rankedCandidateKeys, undefined);
    assert.equal(
      material.diagnostics.servingSuppressedReason,
      'CANONICAL_USER_FEATURES_SHADOW_ONLY',
    );
    assert.equal(material.diagnostics.status, 'SCORED');
    const project = await runMlShadowComparison({
      response: { visible: ['project-y'] },
      domain: 'project',
      interests: [],
      candidates: [{ candidateKey: 'project-y', categoryId: 'invented-category', categoryLabel: 'Electronics & Components', difficulty: 'BEGINNER', conceptKeys: ['concept-a'] }],
      activeCandidateKeys: ['project-y'],
      currentTopKeys: ['project-y'],
      recentEvents: [],
      evaluationTimestamp: '2026-08-10T00:00:00Z',
    });
    assert.equal(project.diagnostics.status, 'FALLBACK');
    assert.equal(project.rankedCandidateKeys, undefined);
  } finally {
    env.recommendationMlShadowEnabled = prior.enabled;
    env.recommendationMlMaterialServingEnabled = prior.materialServing;
    env.recommendationMlMaterialArtifactPath = prior.materialPath;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
  }
});

isolatedRecommendationTest('project serving cannot bypass a disabled shadow flag', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, projectServing: env.recommendationMlProjectServingEnabled, projectPath: env.recommendationMlProjectArtifactPath };
  env.recommendationMlShadowEnabled = false;
  env.recommendationMlProjectServingEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid-runtime-v2.json');
  clearMlArtifactCacheForTests();
  const response = { sections: [{ key: 'suggested_projects', items: ['deterministic-a'] }] };
  const result = await runMlShadowComparison({
    response,
    domain: 'project',
    interests: [],
    candidates: [{ candidateKey: 'project-a', categoryId: 'fixture-category', categoryLabel: 'Fixture', difficulty: 'BEGINNER' }],
    activeCandidateKeys: ['project-a'],
    currentTopKeys: ['project-a'],
    recentEvents: [],
    evaluationTimestamp: '2026-07-19T00:00:00Z',
  });
  assert.strictEqual(result.response, response);
  assert.equal(result.diagnostics.status, 'DISABLED');
  assert.equal(result.rankedCandidateKeys, undefined);
  env.recommendationMlShadowEnabled = prior.enabled;
  env.recommendationMlProjectServingEnabled = prior.projectServing;
  env.recommendationMlProjectArtifactPath = prior.projectPath;
  clearMlArtifactCacheForTests();
});

isolatedRecommendationTest('project serving returns fused ranking only when shadow, serving, and readiness are all READY', async () => {
  const prior = { shadow: env.recommendationMlShadowEnabled, projectServing: env.recommendationMlProjectServingEnabled, projectPath: env.recommendationMlProjectArtifactPath };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlProjectServingEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid-runtime-v2.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  try {
    const response = { sections: [{ key: 'suggested_projects', items: ['deterministic-a', 'deterministic-b'] }] };
    const notReady = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: [],
      candidates: [
        { candidateKey: 'project-a', categoryId: 'fixture-category-a', categoryLabel: 'Fixture A', difficulty: 'BEGINNER' },
        { candidateKey: 'project-b', categoryId: 'fixture-category-b', categoryLabel: 'Fixture B', difficulty: 'INTERMEDIATE' },
      ],
      activeCandidateKeys: ['project-a', 'project-b'],
      currentTopKeys: ['project-a', 'project-b'],
      recentEvents: [],
      evaluationTimestamp: '2026-07-19T00:00:00Z',
    });
    assert.strictEqual(notReady.response, response);
    assert.equal(notReady.rankedCandidateKeys, undefined);
    assert.equal(notReady.diagnostics.projectReadinessStatus, 'NOT_READY');

    env.recommendationMlProjectServingEnabled = false;
    clearMlArtifactCacheForTests();
    const shadowOnly = await runMlShadowComparison({
      response,
      domain: 'project',
      interests: ['Electronics & Components'],
      candidates: [{
        candidateKey: 'mapped-project',
        categoryId: '8d9dfae37dba117ec300f83c2fad0b25b2114b204b6e9c621d5a94e93051bf94',
        categoryLabel: 'Electronics & Components',
        difficulty: 'BEGINNER',
        conceptKeys: ['project-topic:electronics'],
        componentConceptKeys: ['component:arduino-board'],
      }],
      activeCandidateKeys: ['mapped-project'],
      currentTopKeys: ['mapped-project'],
      recentEvents: [],
      evaluationTimestamp: '2026-07-19T00:00:00Z',
    });
    assert.strictEqual(shadowOnly.response, response);
    assert.equal(shadowOnly.rankedCandidateKeys, undefined);
    assert.equal(shadowOnly.diagnostics.projectReadinessStatus, 'NOT_READY');
  } finally {
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectServingEnabled = prior.projectServing;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
  }
});

test('project readiness overlap and rank movement are bounded aggregate calculations', () => {
  assert.deepEqual(calculateProjectTopKOverlap(['a', 'b', 'c', 'd', 'e'], ['e', 'c', 'x', 'b', 'a'], 5), { count: 4, ratio: 0.8 });
  assert.deepEqual(calculateProjectTopKOverlap(['a'], ['a'], 10), { count: 1, ratio: 1 });
  assert.deepEqual(calculateProjectTop10RankMovement(['a', 'b', 'c', 'd'], ['b', 'a', 'd', 'c']), { average: 1, maximum: 1 });
  assert.deepEqual(calculateProjectTop10RankMovement([], []), { average: 0, maximum: 0 });
});

isolatedRecommendationTest('project readiness exposes candidate and artifact coverage without private identifiers', async () => {
  const prior = { shadow: env.recommendationMlShadowEnabled, projectPath: env.recommendationMlProjectArtifactPath };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  try {
    const response = { unchanged: true };
    const candidates = [
      { candidateKey: 'private-project-a', categoryId: 'unknown-category-a', categoryLabel: 'Unknown A', difficulty: 'BEGINNER', conceptKeys: ['unknown-concept'] },
      { candidateKey: 'private-project-b', categoryId: 'unknown-category-b', categoryLabel: 'Unknown B', difficulty: 'BEGINNER' },
    ];
    const result = await runMlShadowComparison({ response, domain: 'project', interests: [], candidates, activeCandidateKeys: candidates.map((value) => value.candidateKey), currentTopKeys: ['private-project-a', 'private-project-b'], recentEvents: [], evaluationTimestamp: '2026-07-19T00:00:00Z' });
    assert.strictEqual(result.response, response);
    assert.equal(result.diagnostics.runtimeCandidateCount, 2);
    assert.equal(result.diagnostics.scoredCandidateCount, 2);
    assert.equal(result.diagnostics.duplicateRuntimeCandidateCount, 0);
    assert.equal(result.diagnostics.duplicateScoredCandidateCount, 0);
    assert.ok((result.diagnostics.artifactCatalogCount ?? 0) > 0);
    assert.ok((result.diagnostics.runtimeCandidatesMissingFromArtifact ?? 0) > 0);
    assert.ok((result.diagnostics.totalProjectShadowDurationMs ?? -1) >= 0);
    assert.doesNotMatch(JSON.stringify(result.diagnostics), /private-project|Unknown A|Unknown B/i);
  } finally {
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
  }
});

isolatedRecommendationTest('project duplicate runtime candidates are reported as NOT_READY without changing the response', async () => {
  const prior = { shadow: env.recommendationMlShadowEnabled, projectPath: env.recommendationMlProjectArtifactPath };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  try {
    const response = { unchanged: true };
    const duplicate = { candidateKey: 'project-duplicate', categoryId: 'fixture-category', categoryLabel: 'Fixture', difficulty: 'BEGINNER' };
    const result = await runMlShadowComparison({ response, domain: 'project', interests: [], candidates: [duplicate, duplicate], activeCandidateKeys: ['project-duplicate'], currentTopKeys: ['project-duplicate'], recentEvents: [], evaluationTimestamp: '2026-07-19T00:00:00Z' });
    assert.strictEqual(result.response, response);
    assert.equal(result.diagnostics.projectReadinessStatus, 'NOT_READY');
    assert.equal(result.diagnostics.duplicateRuntimeCandidateCount, 1);
    assert.equal(result.diagnostics.duplicateScoredCandidateCount, 1);
    assert.equal(result.diagnostics.hydratedMappingFailureCount, 1);
  } finally {
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
  }
});

isolatedRecommendationTest('project shadow failures and timeout preserve the exact deterministic response', async () => {
  const prior = { shadow: env.recommendationMlShadowEnabled, projectPath: env.recommendationMlProjectArtifactPath };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  const response = { sections: [{ key: 'suggested_projects', items: ['deterministic'] }] };
  const input = {
    response,
    domain: 'project' as const,
    interests: [],
    candidates: [{ candidateKey: 'project-a', categoryId: 'fixture-category', categoryLabel: 'Fixture', difficulty: 'BEGINNER' }],
    activeCandidateKeys: ['project-a'],
    currentTopKeys: ['project-a'],
    recentEvents: [],
    evaluationTimestamp: '2026-07-19T00:00:00Z',
  };
  try {
    env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'missing-project-artifact.json');
    assert.strictEqual((await runMlShadowComparison(input)).response, response);
    clearMlArtifactCacheForTests();
    env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid.json');
    for (const phase of ['diagnostics', 'redaction', 'logger'] as const) {
      setMlShadowFailureForTests(phase);
      const result = await runMlShadowComparison(input);
      assert.strictEqual(result.response, response);
      assert.equal(result.diagnostics.projectReadinessStatus, 'FALLBACK');
    }
    setMlShadowFailureForTests(undefined);
    setMlShadowNeverSettleForTests(response);
    const timedOut = await runMlShadowComparison(input);
    assert.strictEqual(timedOut.response, response);
    assert.equal(timedOut.diagnostics.projectReadinessStatus, 'FALLBACK');
    assert.equal(timedOut.diagnostics.fallbackReason, 'project_shadow_timeout');
  } finally {
    setMlShadowFailureForTests(undefined);
    setMlShadowNeverSettleForTests();
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    clearMlArtifactCacheForTests();
  }
});

isolatedRecommendationTest('enabled shadow scores bounded candidates and failures safely fall back', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, materialServing: env.recommendationMlMaterialServingEnabled, projectServing: env.recommendationMlProjectServingEnabled, materialPath: env.recommendationMlMaterialArtifactPath, projectPath: env.recommendationMlProjectArtifactPath };
  env.recommendationMlShadowEnabled = true; env.recommendationMlMaterialServingEnabled = true; env.recommendationMlProjectServingEnabled = true; env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid.json'); env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
  const response = { visible: ['x'] };
  const input = { response, domain: 'material' as const, interests: ['Electronics & Components'], candidates: [{ candidateKey: 'x', categoryId: 'invented-category', categoryLabel: 'Electronics & Components', condition: 'GOOD', isFree: true, pickupAllowed: true, deliveryAllowed: false }], activeCandidateKeys: ['x'], currentTopKeys: ['x'], recentEvents: [], evaluationTimestamp: '2026-08-10T00:00:00Z' };
  const scored = await runMlShadowComparison(input); assert.strictEqual(scored.response, response); assert.equal(scored.diagnostics.status, 'SCORED'); assert.equal(scored.rankedCandidateKeys, undefined); assert.equal(scored.diagnostics.servingSuppressedReason, 'CANONICAL_USER_FEATURES_SHADOW_ONLY');
  const projectScored = await runMlShadowComparison({ ...input, response: { visible: ['project'] }, domain: 'project', candidates: [{ candidateKey: 'p', categoryId: 'invented-category', categoryLabel: 'Electronics & Components', difficulty: 'BEGINNER' }], activeCandidateKeys: ['p'], currentTopKeys: ['p'] });
  assert.equal(projectScored.diagnostics.status, 'SCORED'); assert.equal(projectScored.rankedCandidateKeys, undefined); assert.equal(projectScored.diagnostics.servingSuppressedReason, 'CANONICAL_USER_FEATURES_SHADOW_ONLY');
  env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'missing.json'); clearMlArtifactCacheForTests();
  const failed = await runMlShadowComparison(input); assert.strictEqual(failed.response, response); assert.equal(failed.diagnostics.status, 'FALLBACK');
  env.recommendationMlShadowEnabled = prior.enabled; env.recommendationMlMaterialServingEnabled = prior.materialServing; env.recommendationMlProjectServingEnabled = prior.projectServing; env.recommendationMlMaterialArtifactPath = prior.materialPath; env.recommendationMlProjectArtifactPath = prior.projectPath; clearMlArtifactCacheForTests();
});

isolatedRecommendationTest('material development diagnostics are sanitized and preserve the deterministic response', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, path: env.recommendationMlMaterialArtifactPath };
  const observations: Array<ShadowDiagnostics & { domain: 'material' | 'project' }> = [];
  const logLines: string[] = []; const logStream = new PassThrough(); logStream.on('data', (chunk) => logLines.push(chunk.toString())); setLoggerDestinationForTests(logStream); resetLoggerForTests();
  env.recommendationMlShadowEnabled = true; env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  clearMlArtifactCacheForTests();
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

isolatedRecommendationTest('real learner-home shadow shape fails safe across confidence, dominance, fusion, diagnostics, logger, and redaction failures', async () => {
  const prior = { enabled: env.recommendationMlShadowEnabled, path: env.recommendationMlMaterialArtifactPath };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid-runtime-v2.json');
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
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

isolatedRecommendationTest('never-settling async material shadow is bounded by the secondary timeout', async () => {
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

isolatedRecommendationTest('candidate duplicates disable shadow and cached catalog-scale scoring stays bounded', async () => {
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
  setMlShadowInterestRegistryLoaderForTests(emptyInterestRegistry);
  const response = { unchanged: true }; const duplicate = { candidateKey: 'same', categoryId: 'category', categoryLabel: 'Category' };
  const result = await runMlShadowComparison({ response, domain: 'material', interests: [], candidates: [duplicate, duplicate], activeCandidateKeys: ['same'], currentTopKeys: [], recentEvents: [], evaluationTimestamp: '2026-08-10T00:00:00Z' });
  assert.strictEqual(result.response, response); assert.equal(result.diagnostics.fallbackReason, 'candidate_mismatch'); env.recommendationMlShadowEnabled = prior;
});

isolatedRecommendationTest('RP-01.4 canonical user features are candidate-independent and serve-suppressed', async () => {
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlMaterialServingEnabled = true;
  env.recommendationMlProjectServingEnabled = true;
  env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid-runtime-v2.json');
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid-runtime-v2.json');
  setMlShadowInterestRegistryLoaderForTests(fixtureInterestRegistry);
  clearMlArtifactCacheForTests();

  const materialCandidates = [
    {
      candidateKey: 'm1',
      categoryId: 'cat-a',
      categoryLabel: 'Electronics & Components',
      condition: 'GOOD',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  ];
  const emptyPool = await runMlShadowComparison({
    response: { domain: 'material-empty' },
    domain: 'material',
    interests: ['arduino', 'robotics'],
    candidates: [],
    activeCandidateKeys: [],
    currentTopKeys: [],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });
  const populated = await runMlShadowComparison({
    response: { domain: 'material-populated' },
    domain: 'material',
    interests: ['arduino', 'robotics'],
    candidates: materialCandidates,
    activeCandidateKeys: ['m1'],
    currentTopKeys: ['m1'],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });
  const reordered = await runMlShadowComparison({
    response: { domain: 'material-reordered' },
    domain: 'material',
    interests: ['robotics', 'arduino'],
    candidates: [
      {
        candidateKey: 'm2',
        categoryId: 'different-cat',
        categoryLabel: 'Wood & Boards',
        condition: 'NEW',
        isFree: false,
        pickupAllowed: false,
        deliveryAllowed: true,
      },
      ...materialCandidates,
    ],
    activeCandidateKeys: ['m2', 'm1'],
    currentTopKeys: ['m2', 'm1'],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });
  const project = await runMlShadowComparison({
    response: { domain: 'project' },
    domain: 'project',
    interests: ['arduino', 'robotics'],
    candidates: [
      {
        candidateKey: 'p1',
        categoryId: 'proj-cat',
        categoryLabel: 'Robotics Projects',
        difficulty: 'BEGINNER',
        conceptKeys: ['project-topic:robotics'],
        componentConceptKeys: ['component:arduino-board'],
      },
    ],
    activeCandidateKeys: ['p1'],
    currentTopKeys: ['p1'],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });

  for (const result of [emptyPool, populated, reordered, project]) {
    assert.equal(result.diagnostics.status, 'SCORED');
    assert.equal(result.rankedCandidateKeys, undefined);
    assert.equal(
      result.diagnostics.servingSuppressedReason,
      'CANONICAL_USER_FEATURES_SHADOW_ONLY',
    );
    assert.equal(result.diagnostics.resolutionStatus, 'FULLY_MAPPED');
    assert.equal(result.diagnostics.canonicalUserFeatureCount, 2);
    assert.equal(result.diagnostics.candidateIndependent, true);
    assert.equal(
      result.diagnostics.artifactUserFeatureOverlapStatus,
      'ZERO_OVERLAP',
    );
    assert.equal(result.diagnostics.artifactMatchedUserFeatureCount, 0);
    assert.equal(result.diagnostics.artifactMissingUserFeatureCount, 2);
    assert.equal(result.diagnostics.featureReadiness?.status, 'NOT_READY');
    assert.ok(
      result.diagnostics.featureReadiness?.reasons.includes(
        'ARTIFACT_CONTRACT_VERSION_MISSING',
      ),
    );
    assert.equal(result.diagnostics.featureReadiness?.artifact.contractVersionCompatible, false);
    assert.doesNotMatch(
      JSON.stringify(result.diagnostics),
      /interest:[0-9a-f]{64}/,
    );
  }

  assert.equal(emptyPool.diagnostics.canonicalFeatureCount, populated.diagnostics.canonicalFeatureCount);
  assert.equal(populated.diagnostics.canonicalFeatureCount, project.diagnostics.canonicalFeatureCount);
  assert.equal(reordered.diagnostics.canonicalFeatureCount, 2);

  let registryLoads = 0;
  setMlShadowInterestRegistryLoaderForTests(async () => {
    registryLoads += 1;
    throw new Error('taxonomy_registry_should_not_load_for_empty_interests');
  });

  const noInterests = await runMlShadowComparison({
    response: { domain: 'no-interests' },
    domain: 'material',
    interests: [],
    candidates: materialCandidates,
    activeCandidateKeys: ['m1'],
    currentTopKeys: ['m1'],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });
  assert.equal(registryLoads, 0);
  assert.equal(noInterests.diagnostics.status, 'SCORED');
  assert.equal(noInterests.diagnostics.resolutionStatus, 'NO_INTERESTS');
  assert.equal(
    noInterests.diagnostics.artifactUserFeatureOverlapStatus,
    'NO_RUNTIME_FEATURES',
  );
  assert.equal(noInterests.rankedCandidateKeys, undefined);

  registryLoads = 0;
  const noInterestsProject = await runMlShadowComparison({
    response: { domain: 'no-interests-project' },
    domain: 'project',
    interests: [],
    candidates: [
      {
        candidateKey: 'p-empty',
        categoryId: 'proj-cat',
        categoryLabel: 'Robotics Projects',
        difficulty: 'BEGINNER',
      },
    ],
    activeCandidateKeys: ['p-empty'],
    currentTopKeys: ['p-empty'],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });
  assert.equal(registryLoads, 0);
  assert.equal(noInterestsProject.diagnostics.status, 'SCORED');
  assert.equal(noInterestsProject.diagnostics.resolutionStatus, 'NO_INTERESTS');
  assert.equal(
    noInterestsProject.diagnostics.artifactUserFeatureOverlapStatus,
    'NO_RUNTIME_FEATURES',
  );

  setMlShadowInterestRegistryLoaderForTests(fixtureInterestRegistry);
  const unmapped = await runMlShadowComparison({
    response: { domain: 'unmapped' },
    domain: 'material',
    interests: ['totally-unknown-interest-xyz'],
    candidates: materialCandidates,
    activeCandidateKeys: ['m1'],
    currentTopKeys: ['m1'],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });
  assert.equal(unmapped.diagnostics.resolutionStatus, 'UNMAPPED_INTERESTS');
  assert.equal(
    unmapped.diagnostics.artifactUserFeatureOverlapStatus,
    'NO_RUNTIME_FEATURES',
  );
  assert.notEqual(
    unmapped.diagnostics.resolutionStatus,
    noInterests.diagnostics.resolutionStatus,
  );

  setMlShadowInterestRegistryLoaderForTests(async () => {
    throw new Error('taxonomy_registry_unavailable');
  });
  const response = { deterministic: true };
  const failed = await runMlShadowComparison({
    response,
    domain: 'material',
    interests: ['arduino'],
    candidates: materialCandidates,
    activeCandidateKeys: ['m1'],
    currentTopKeys: ['m1'],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });
  assert.strictEqual(failed.response, response);
  assert.equal(failed.diagnostics.status, 'FALLBACK');
  assert.equal(failed.rankedCandidateKeys, undefined);

  // Partial / full overlap against synthetic in-memory artifact names via diagnostics helper path:
  // covered in canonical-shadow-user-features.test.ts; runtime-v2 proven ZERO_OVERLAP above.
});

isolatedRecommendationTest('RP-01.4 material and project canonical features match and ignore candidate labels', async () => {
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlMaterialServingEnabled = true;
  env.recommendationMlProjectServingEnabled = true;
  env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid-runtime-v2.json');
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid-runtime-v2.json');
  setMlShadowInterestRegistryLoaderForTests(fixtureInterestRegistry);
  clearMlArtifactCacheForTests();

  const interests = ['arduino'];
  const material = await runMlShadowComparison({
    response: { section: 'materials' },
    domain: 'material',
    interests,
    candidates: [
      {
        candidateKey: 'm-hash-trap',
        categoryId: 'would-have-produced-hash',
        categoryLabel: 'arduino',
        condition: 'GOOD',
        isFree: true,
        pickupAllowed: true,
        deliveryAllowed: false,
      },
    ],
    activeCandidateKeys: ['m-hash-trap'],
    currentTopKeys: ['m-hash-trap'],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });
  const project = await runMlShadowComparison({
    response: { section: 'projects' },
    domain: 'project',
    interests,
    candidates: [
      {
        candidateKey: 'p-other',
        categoryId: 'other-id',
        categoryLabel: 'Completely Different Label',
        difficulty: 'BEGINNER',
      },
    ],
    activeCandidateKeys: ['p-other'],
    currentTopKeys: ['p-other'],
    recentEvents: [],
    evaluationTimestamp: '2026-08-10T00:00:00Z',
  });

  assert.equal(material.diagnostics.canonicalUserFeatureCount, 1);
  assert.equal(project.diagnostics.canonicalUserFeatureCount, 1);
  assert.equal(material.diagnostics.resolutionStatus, project.diagnostics.resolutionStatus);
  assert.equal(material.rankedCandidateKeys, undefined);
  assert.equal(project.rankedCandidateKeys, undefined);
  assert.equal(material.diagnostics.artifactUserFeatureOverlapStatus, 'ZERO_OVERLAP');
  assert.equal(project.diagnostics.artifactUserFeatureOverlapStatus, 'ZERO_OVERLAP');
});

isolatedRecommendationTest('RP-01.5 feature readiness attaches and keeps serve keys suppressed', async () => {
  const prior = {
    shadow: env.recommendationMlShadowEnabled,
    materialServing: env.recommendationMlMaterialServingEnabled,
    projectServing: env.recommendationMlProjectServingEnabled,
    materialPath: env.recommendationMlMaterialArtifactPath,
    projectPath: env.recommendationMlProjectArtifactPath,
  };
  env.recommendationMlShadowEnabled = true;
  env.recommendationMlMaterialServingEnabled = true;
  env.recommendationMlProjectServingEnabled = true;
  env.recommendationMlMaterialArtifactPath = path.join(portableRoot, 'material-hybrid-runtime-v2.json');
  env.recommendationMlProjectArtifactPath = path.join(portableRoot, 'project-hybrid-runtime-v2.json');
  setMlShadowInterestRegistryLoaderForTests(fixtureInterestRegistry);
  clearMlArtifactCacheForTests();
  try {
    const material = await runMlShadowComparison({
      response: { section: 'materials' },
      domain: 'material',
      interests: ['arduino'],
      candidates: [
        {
          candidateKey: 'm1',
          categoryId: 'cat-1',
          categoryLabel: 'Electronics',
          condition: 'NEW',
          isFree: true,
          pickupAllowed: true,
          deliveryAllowed: false,
          conceptKeys: ['material-family:electronics'],
        },
      ],
      activeCandidateKeys: ['m1'],
      currentTopKeys: ['m1'],
      recentEvents: [],
      evaluationTimestamp: '2026-08-10T00:00:00Z',
    });
    assert.equal(material.diagnostics.status, 'SCORED');
    assert.equal(material.diagnostics.featureReadiness?.status, 'NOT_READY');
    assert.ok(
      material.diagnostics.featureReadiness?.reasons.includes(
        'ARTIFACT_CONTRACT_VERSION_MISSING',
      ),
    );
    assert.ok(
      (material.diagnostics.featureReadiness?.items.unknownOccurrenceCount ?? 0) +
        (material.diagnostics.featureReadiness?.items.unsupportedOccurrenceCount ?? 0) >
        0,
    );
    assert.notEqual(
      material.diagnostics.featureReadiness?.items.missingCriticalOccurrenceCount,
      material.diagnostics.missingFeatureCount,
    );
    assert.equal(material.diagnostics.featureCoverage?.zeroFeatureUser, false);
    assert.equal(material.rankedCandidateKeys, undefined);
    assert.equal(
      material.diagnostics.servingSuppressedReason,
      'CANONICAL_USER_FEATURES_SHADOW_ONLY',
    );

    const project = await runMlShadowComparison({
      response: { section: 'projects' },
      domain: 'project',
      interests: ['arduino'],
      candidates: [
        {
          candidateKey: 'p1',
          categoryId: 'proj-cat',
          categoryLabel: 'Robotics',
          difficulty: 'BEGINNER',
          conceptKeys: ['project-topic:robotics'],
        },
      ],
      activeCandidateKeys: ['p1'],
      currentTopKeys: ['p1'],
      recentEvents: [],
      evaluationTimestamp: '2026-08-10T00:00:00Z',
    });
    assert.equal(project.diagnostics.status, 'SCORED');
    assert.equal(project.diagnostics.projectReadinessStatus, 'NOT_READY');
    assert.equal(project.diagnostics.featureReadiness?.status, 'NOT_READY');
    assert.equal(project.rankedCandidateKeys, undefined);
  } finally {
    env.recommendationMlShadowEnabled = prior.shadow;
    env.recommendationMlMaterialServingEnabled = prior.materialServing;
    env.recommendationMlProjectServingEnabled = prior.projectServing;
    env.recommendationMlMaterialArtifactPath = prior.materialPath;
    env.recommendationMlProjectArtifactPath = prior.projectPath;
    setMlShadowInterestRegistryLoaderForTests(undefined);
    clearMlArtifactCacheForTests();
  }
});
