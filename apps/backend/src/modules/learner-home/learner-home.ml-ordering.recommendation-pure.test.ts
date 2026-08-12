import assert from 'node:assert/strict';
import { test } from 'node:test';

import { stableOpaqueKey } from '../recommendations/local-ml-training-snapshot.schema.js';
import type { RecommendationMlRankingResult } from '../recommendations/ml-runtime-state.service.js';
import {
  applyContainedMlRanking,
  buildLearnerHomeMlRuntimeIdentity,
  rankLearnerHomeMlCandidatePool,
  rankPreparedLearnerHomeMlCandidatePoolForTests,
  type LearnerHomeMlPreparedCandidate,
} from './learner-home.ml-ordering.js';

const prepared = (keys: readonly string[]): LearnerHomeMlPreparedCandidate<{ id: string }>[] =>
  keys.map((candidateKey) => ({
    candidateKey,
    item: { id: candidateKey },
    features: [['feature', 1]],
  }));

const diagnostics = (candidateCount: number, overrides: Record<string, unknown> = {}) => ({
  runtimeMode: 'ML_PRIMARY' as const,
  domain: 'material' as const,
  state: 'READY' as const,
  candidateCount,
  duplicateCandidateCount: 0,
  scoredCount: 0,
  missingMappingCount: 0,
  missingMappingKeySamples: [] as string[],
  featureMappingMissingCount: 0,
  ...overrides,
});

const ranked = (
  keys: readonly string[],
  scores: readonly number[] = keys.map((_, index) => keys.length - index),
): Extract<RecommendationMlRankingResult, { outcome: 'ML_RANKED' }> => ({
  outcome: 'ML_RANKED',
  mode: 'ML_PRIMARY',
  domain: 'material',
  scored: keys.map((candidateKey, index) => ({
    candidateKey,
    score: scores[index]!,
  })),
  rankedCandidateKeys: keys,
  diagnostics: diagnostics(keys.length, { scoredCount: keys.length }),
});

const missing = (
  candidateCount: number,
  keys: readonly string[],
): RecommendationMlRankingResult => ({
  outcome: 'ML_UNAVAILABLE',
  mode: 'ML_PRIMARY',
  domain: 'material',
  reasonCode: 'CANDIDATE_MAPPING_MISSING',
  diagnostics: diagnostics(candidateCount, {
    missingMappingCount: keys.length,
    missingMappingKeySamples: keys.map((key) => stableOpaqueKey('material', key)).slice(0, 8),
  }),
});

test('contained ranking drops unknown keys and deterministically appends omitted candidates', () => {
  const original = prepared(['a', 'b', 'c']);
  const result = applyContainedMlRanking({
    domain: 'material',
    runtimeMode: 'ML_PRIMARY',
    original,
    mapped: original,
    unmapped: [],
    result: ranked(['unknown', 'c', 'a']),
    retryCount: 0,
    opaqueKeySamples: [],
  });
  assert.deepEqual(result.ordered.map((item) => item.id), ['c', 'a', 'b']);
  assert.equal(result.decision.status, 'ML_RANKED');
  assert.equal(result.decision.diagnostics.unknownRankedKeyCount, 1);
  assert.equal(result.decision.diagnostics.omittedMappedCandidateCount, 1);
  assert.deepEqual(result.decision.diagnostics.opaqueKeySamples, [
    stableOpaqueKey('material', 'unknown'),
  ]);
});

test('non-ML-ranked tail preserves original interleaving of unmapped and omitted mapped candidates', () => {
  const original = prepared(['a', 'b', 'c', 'd']);
  const mapped = prepared(['a', 'c', 'd']);
  const unmapped = prepared(['b']);
  const result = applyContainedMlRanking({
    domain: 'material',
    runtimeMode: 'ML_PRIMARY',
    original,
    mapped,
    unmapped,
    result: ranked(['a']),
    retryCount: 0,
    opaqueKeySamples: [],
  });
  assert.deepEqual(result.ordered.map((item) => item.id), ['a', 'b', 'c', 'd']);
  assert.equal(result.decision.status, 'ML_RANKED');
  assert.equal(result.decision.diagnostics.unmappedCandidateCount, 1);
  assert.equal(result.decision.diagnostics.omittedMappedCandidateCount, 2);
});

test('duplicate ranked keys reject the result and cannot duplicate visible candidates', () => {
  const original = prepared(['a', 'b']);
  const result = applyContainedMlRanking({
    domain: 'material',
    runtimeMode: 'ML_PRIMARY',
    original,
    mapped: original,
    unmapped: [],
    result: ranked(['b', 'b', 'a']),
    retryCount: 0,
    opaqueKeySamples: [],
  });
  assert.deepEqual(result.ordered.map((item) => item.id), ['a', 'b']);
  assert.equal(result.decision.status, 'FALLBACK_FAILED');
  assert.equal(result.decision.reasonCode, 'DUPLICATE_RANKED_KEY');
});

test('mapping misses are removed, retried, and appended in original stable order', () => {
  const candidates = prepared(['a', 'b', 'c', 'd']);
  let calls = 0;
  const result = rankPreparedLearnerHomeMlCandidatePoolForTests({
    domain: 'material',
    runtimeMode: 'ML_PRIMARY',
    userFeatures: [],
    candidates,
    rank: (input) => {
      calls += 1;
      return calls === 1
        ? missing(input.candidates.length, ['b', 'd'])
        : ranked(['c', 'a']);
    },
  });
  assert.equal(calls, 2);
  assert.deepEqual(result.ordered.map((item) => item.id), ['c', 'a', 'b', 'd']);
  assert.equal(result.decision.status, 'ML_RANKED');
  assert.equal(result.decision.diagnostics.unmappedCandidateCount, 2);
  assert.equal(result.decision.diagnostics.retryCount, 1);
});

test('more than eight mapping misses use bounded multiple retries', () => {
  const keys = Array.from({ length: 18 }, (_, index) => `c-${index}`);
  const missingKeys = keys.slice(0, 17);
  const candidates = prepared(keys);
  let remaining = [...missingKeys];
  let calls = 0;
  const result = rankPreparedLearnerHomeMlCandidatePoolForTests({
    domain: 'material',
    runtimeMode: 'ML_PRIMARY',
    userFeatures: [],
    candidates,
    rank: (input) => {
      calls += 1;
      if (remaining.length === 0) return ranked(['c-17']);
      const reported = remaining.slice(0, 8);
      remaining = remaining.slice(8);
      return missing(input.candidates.length, reported);
    },
  });
  assert.equal(calls, 4);
  assert.equal(result.ordered[0]?.id, 'c-17');
  assert.deepEqual(result.ordered.slice(1).map((item) => item.id), missingKeys);
  assert.equal(result.decision.diagnostics.opaqueKeySamples.length, 8);
});

test('unmatched missing diagnostics fail closed without retrying forever', () => {
  const candidates = prepared(['a', 'b']);
  let calls = 0;
  const result = rankPreparedLearnerHomeMlCandidatePoolForTests({
    domain: 'material',
    runtimeMode: 'ML_PRIMARY',
    userFeatures: [],
    candidates,
    rank: (input) => {
      calls += 1;
      return missing(input.candidates.length, ['not-in-pool']);
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result.ordered.map((item) => item.id), ['a', 'b']);
  assert.equal(result.decision.reasonCode, 'UNSAFE_MAPPING_DIAGNOSTIC');
});

test('an entirely unmapped pool falls back deterministically', () => {
  const candidates = prepared(['a', 'b']);
  const result = rankPreparedLearnerHomeMlCandidatePoolForTests({
    domain: 'material',
    runtimeMode: 'ML_PRIMARY',
    userFeatures: [],
    candidates,
    rank: (input) => missing(
      input.candidates.length,
      input.candidates.map((candidate) => candidate.candidateKey),
    ),
  });
  assert.deepEqual(result.ordered.map((item) => item.id), ['a', 'b']);
  assert.equal(result.decision.status, 'FALLBACK_NOT_READY');
  assert.equal(result.decision.reasonCode, 'NO_SAFELY_RANKABLE_SUBSET');
});

test('non-finite scores and domain mismatches reject ML output', () => {
  const original = prepared(['a']);
  const nonfinite = applyContainedMlRanking({
    domain: 'material',
    runtimeMode: 'ML_PRIMARY',
    original,
    mapped: original,
    unmapped: [],
    result: ranked(['a'], [Number.NaN]),
    retryCount: 0,
    opaqueKeySamples: [],
  });
  assert.equal(nonfinite.decision.reasonCode, 'NONFINITE_OUTPUT');

  const mismatch = applyContainedMlRanking({
    domain: 'project',
    runtimeMode: 'ML_PRIMARY',
    original,
    mapped: original,
    unmapped: [],
    result: ranked(['a']),
    retryCount: 0,
    opaqueKeySamples: [],
  });
  assert.equal(mismatch.decision.reasonCode, 'DOMAIN_MISMATCH');
});

test('deterministic and shadow modes preserve the pool without invoking serving dependencies', async () => {
  for (const mode of ['DETERMINISTIC', 'SHADOW'] as const) {
    let calls = 0;
    const result = await rankLearnerHomeMlCandidatePool({
      domain: 'material',
      interests: [],
      candidates: [{
        candidateKey: 'a',
        item: { id: 'a' },
        conceptKeys: [],
        condition: 'GOOD',
        isFree: false,
        pickupAllowed: true,
        deliveryAllowed: false,
      }],
    }, {
      getSnapshot: () => ({
        mode,
        material: { runtimeMode: mode, domain: 'material', state: 'DISABLED' },
        project: { runtimeMode: mode, domain: 'project', state: 'DISABLED' },
      }),
      rank: () => {
        calls += 1;
        throw new Error('must not run');
      },
      loadUserFeatures: async () => {
        calls += 1;
        throw new Error('must not run');
      },
      loadAuthority: async () => {
        calls += 1;
        throw new Error('must not run');
      },
    });
    assert.deepEqual(result.ordered, [{ id: 'a' }]);
    assert.equal(result.decision.status, mode === 'SHADOW' ? 'SHADOW' : 'DETERMINISTIC');
    assert.equal(calls, 0);
  }
});

test('invalid scorer output while the domain is READY is a failed fallback', () => {
  const candidates = prepared(['a']);
  const result = rankPreparedLearnerHomeMlCandidatePoolForTests({
    domain: 'material',
    runtimeMode: 'ML_PRIMARY',
    userFeatures: [],
    candidates,
    rank: (input) => ({
      outcome: 'ML_UNAVAILABLE',
      mode: 'ML_PRIMARY',
      domain: 'material',
      reasonCode: 'INVALID_CANDIDATE_KEY',
      diagnostics: diagnostics(input.candidates.length),
    }),
  });
  assert.deepEqual(result.ordered.map((item) => item.id), ['a']);
  assert.equal(result.decision.status, 'FALLBACK_FAILED');
  assert.equal(result.decision.reasonCode, 'INVALID_CANDIDATE_KEY');
});

test('runtime cache identity separates modes and independent artifact identities', () => {
  const snapshot = (mode: 'DETERMINISTIC' | 'SHADOW' | 'ML_PRIMARY', materialHash: string, projectHash: string) => ({
    mode,
    material: {
      runtimeMode: mode,
      domain: 'material' as const,
      state: mode === 'DETERMINISTIC' ? 'DISABLED' as const : 'READY' as const,
      semanticContentHash: materialHash,
      loadCompletedAt: '2026-07-27T00:00:00.000Z',
    },
    project: {
      runtimeMode: mode,
      domain: 'project' as const,
      state: mode === 'DETERMINISTIC' ? 'DISABLED' as const : 'READY' as const,
      semanticContentHash: projectHash,
      loadCompletedAt: '2026-07-27T00:00:00.000Z',
    },
  });
  const deterministic = buildLearnerHomeMlRuntimeIdentity({ snapshot: snapshot('DETERMINISTIC', 'm1', 'p1') });
  const shadow = buildLearnerHomeMlRuntimeIdentity({ snapshot: snapshot('SHADOW', 'm1', 'p1') });
  const local = buildLearnerHomeMlRuntimeIdentity({ snapshot: snapshot('ML_PRIMARY', 'm1', 'p1') });
  const changedMaterial = buildLearnerHomeMlRuntimeIdentity({ snapshot: snapshot('ML_PRIMARY', 'm2', 'p1') });
  const changedProject = buildLearnerHomeMlRuntimeIdentity({ snapshot: snapshot('ML_PRIMARY', 'm1', 'p2') });
  assert.notDeepEqual(deterministic, shadow);
  assert.notDeepEqual(shadow, local);
  assert.notEqual(local.material, changedMaterial.material);
  assert.equal(local.project, changedMaterial.project);
  assert.notEqual(local.project, changedProject.project);
  assert.equal(local.material, changedProject.material);
});
