import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertContainment,
  assertDomainSeparation,
  assertDuplicateKeysContained,
  assertFiniteScores,
  assertLimitPreserved,
  assertMappedUnmappedAppend,
  assertMaterialCrossSectionDedup,
  assertStampTruthful,
  assertUnknownKeysContained,
  assertUniqueness,
  buildSectionAlgorithmStamp,
  classifyHardFailure,
  compareRepeatabilitySnapshots,
  extractSectionTokenFromActualStamp,
  formatHumanReport,
  mlDecisionToken,
  redactForOutput,
  toJsonReport,
  aliasForIndex,
  type SmokeJsonReport,
  type SmokeOrderingDecision,
  type SmokeRepeatabilitySnapshot,
  SMOKE_SCHEMA_VERSION,
} from './recommendations-ml-smoke-local-checks.js';

const decision = (
  status: SmokeOrderingDecision['status'],
): SmokeOrderingDecision => ({
  runtimeMode: 'ML_PRIMARY',
  status,
  diagnostics: {
    candidateCount: 3,
    scoredCount: status === 'ML_RANKED' ? 2 : 0,
    retryCount: 0,
    unmappedCandidateCount: 1,
    omittedMappedCandidateCount: 0,
    unknownRankedKeyCount: 0,
    duplicateRankedKeyCount: 0,
  },
});

test('ml-smoke-local pure: containment rejects out-of-pool ids', () => {
  assert.equal(assertContainment(['a', 'b'], ['a', 'b', 'c']).ok, true);
  const failed = assertContainment(['a', 'x'], ['a', 'b']);
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'OUT_OF_POOL_CANDIDATE');
  assert.equal(classifyHardFailure(failed.code), true);
});

test('ml-smoke-local pure: uniqueness rejects duplicates', () => {
  assert.equal(assertUniqueness(['a', 'b']).ok, true);
  const failed = assertUniqueness(['a', 'a']);
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'DUPLICATE_RESULT');
});

test('ml-smoke-local pure: finite scores reject NaN and infinities', () => {
  assert.equal(assertFiniteScores([0, 1.5, -2]).ok, true);
  assert.equal(assertFiniteScores([Number.NaN]).ok, false);
  assert.equal(assertFiniteScores([Number.POSITIVE_INFINITY]).ok, false);
  assert.equal(assertFiniteScores([Number.NEGATIVE_INFINITY]).ok, false);
  assert.equal(classifyHardFailure('NONFINITE_SCORE'), true);
});

test('ml-smoke-local pure: mapped/unmapped append preserves deterministic tail', () => {
  const original = ['a', 'b', 'c', 'd'];
  const rankedMapped = ['c', 'a'];
  const combined = ['c', 'a', 'b', 'd'];
  assert.equal(
    assertMappedUnmappedAppend({
      originalIds: original,
      rankedMappedIds: rankedMapped,
      combinedIds: combined,
    }).ok,
    true,
  );
  assert.equal(
    assertMappedUnmappedAppend({
      originalIds: original,
      rankedMappedIds: rankedMapped,
      combinedIds: ['c', 'a', 'd', 'b'],
    }).ok,
    false,
  );
});

test('ml-smoke-local pure: limit preservation', () => {
  assert.equal(assertLimitPreserved(4, 4).ok, true);
  assert.equal(assertLimitPreserved(5, 4).ok, false);
});

test('ml-smoke-local pure: domain separation', () => {
  assert.equal(
    assertDomainSeparation({
      domain: 'material',
      returnedIds: ['m1', 'm2'],
      foreignPoolIds: ['p1', 'p2'],
    }).ok,
    true,
  );
  const failed = assertDomainSeparation({
    domain: 'material',
    returnedIds: ['m1', 'p1'],
    foreignPoolIds: ['p1', 'p2'],
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'DOMAIN_CROSSING');
});

test('ml-smoke-local pure: actual stamp mismatch is detected against independent stamp', () => {
  const ranked = decision('ML_RANKED');
  // Independently supplied actual stamp — not buildSectionAlgorithmStamp(ranked).
  const actualMismatch =
    'learner-home-v1:base=legacy-v1;sm=deterministic;sp=ml-primary';
  const failed = assertStampTruthful({
    actualStamp: actualMismatch,
    decision: ranked,
    sectionKey: 'suggested_materials',
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'ML_APPLIED_WITHOUT_STAMP');

  const constructed = buildSectionAlgorithmStamp({
    sectionKey: 'suggested_materials',
    runtimeMode: 'ML_PRIMARY',
    decision: ranked,
    effectiveBase: 'legacy-v1',
  });
  // Prove the check uses the supplied actual stamp, not the constructed one:
  // constructed would pass, but we pass a different actual stamp and fail.
  assert.match(constructed, /sm=ml-primary/);
  assert.notEqual(constructed, actualMismatch);
});

test('ml-smoke-local pure: fallback claiming ML on actual stamp is detected', () => {
  const fallback = decision('FALLBACK_FAILED');
  const actualStamp = 'learner-home-v1:base=legacy-v1;sm=ml-primary;sp=fb-failed';
  const failed = assertStampTruthful({
    actualStamp,
    decision: fallback,
    sectionKey: 'suggested_materials',
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'FALLBACK_CLAIMS_ML_SUCCESS');
});

test('ml-smoke-local pure: stamp domain misroute is detected', () => {
  const ranked = decision('ML_RANKED');
  // Expected sm=ml-primary but only sp carries ml-primary (swapped).
  const actualStamp =
    'learner-home-v1:base=legacy-v1;sm=deterministic;sp=ml-primary';
  const failed = assertStampTruthful({
    actualStamp,
    decision: ranked,
    sectionKey: 'suggested_materials',
  });
  assert.equal(failed.ok, false);
  assert.ok(
    failed.code === 'ML_APPLIED_WITHOUT_STAMP' ||
      failed.code === 'STAMP_DOMAIN_MISROUTE',
  );
  assert.equal(
    extractSectionTokenFromActualStamp(actualStamp, 'suggested_materials'),
    'deterministic',
  );
  assert.equal(
    extractSectionTokenFromActualStamp(actualStamp, 'suggested_projects'),
    'ml-primary',
  );
});

test('ml-smoke-local pure: truthful actual stamp passes', () => {
  const ranked = decision('ML_RANKED');
  const actualStamp =
    'learner-home-v1:base=legacy-v1;sm=ml-primary;sp=fb-not-ready';
  assert.equal(
    assertStampTruthful({
      actualStamp,
      decision: ranked,
      sectionKey: 'suggested_materials',
    }).ok,
    true,
  );
  assert.equal(mlDecisionToken('ML_RANKED'), 'ml-primary');
});

test('ml-smoke-local pure: cross-section dedup matches dedupeMaterialSections authority', () => {
  // Allowed fallback duplicate when alternatives are exhausted.
  const only = { id: 'only-item', title: 'only-item', score: 100 };
  assert.equal(
    assertMaterialCrossSectionDedup({
      preDedup: {
        materialsForSavedProjects: [only],
        suggestedMaterials: [only],
        freeMaterialsNearYou: [only],
      },
      actual: {
        materialsForSavedProjects: [only],
        suggestedMaterials: [only],
        freeMaterialsNearYou: [only],
      },
      limits: {
        materialsForSavedProjects: 1,
        suggestedMaterials: 1,
        freeMaterialsNearYou: 1,
      },
    }).ok,
    true,
  );

  // Real violation: lower-priority section kept a duplicate despite an available alternative.
  const shared = { id: 'shared', title: 'shared', score: 120 };
  const suggestedOnly = {
    id: 'suggested-only',
    title: 'suggested-only',
    score: 90,
  };
  const failed = assertMaterialCrossSectionDedup({
    preDedup: {
      materialsForSavedProjects: [shared],
      suggestedMaterials: [shared, suggestedOnly],
      freeMaterialsNearYou: [shared],
    },
    actual: {
      materialsForSavedProjects: [shared],
      // Wrong: retained shared instead of switching to suggested-only.
      suggestedMaterials: [shared],
      freeMaterialsNearYou: [shared],
    },
    limits: {
      materialsForSavedProjects: 1,
      suggestedMaterials: 1,
      freeMaterialsNearYou: 1,
    },
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'CROSS_SECTION_DEDUP_VIOLATION');

  // Same pre-dedup with correct authoritative output passes (priority + no improper duplicate).
  assert.equal(
    assertMaterialCrossSectionDedup({
      preDedup: {
        materialsForSavedProjects: [shared],
        suggestedMaterials: [shared, suggestedOnly],
        freeMaterialsNearYou: [shared],
      },
      actual: {
        materialsForSavedProjects: [shared],
        suggestedMaterials: [suggestedOnly],
        freeMaterialsNearYou: [shared],
      },
      limits: {
        materialsForSavedProjects: 1,
        suggestedMaterials: 1,
        freeMaterialsNearYou: 1,
      },
    }).ok,
    true,
  );
});

test('ml-smoke-local pure: unknown ranked keys contained when diagnosed but never visible', () => {
  const decisionWithUnknown = {
    ...decision('ML_RANKED'),
    diagnostics: {
      ...decision('ML_RANKED').diagnostics,
      unknownRankedKeyCount: 2,
    },
  };
  assert.equal(
    assertUnknownKeysContained({
      decision: decisionWithUnknown,
      poolIds: ['a', 'b', 'c'],
      orderedPoolIds: ['c', 'a', 'b'],
      returnedIds: ['c', 'a'],
    }).ok,
    true,
  );
  const accepted = assertUnknownKeysContained({
    decision: decisionWithUnknown,
    poolIds: ['a', 'b', 'c'],
    orderedPoolIds: ['unknown', 'a', 'b'],
    returnedIds: ['unknown', 'a'],
  });
  assert.equal(accepted.ok, false);
  assert.equal(accepted.code, 'UNKNOWN_KEYS_ACCEPTED');
});

test('ml-smoke-local pure: duplicate ranked keys contained with truthful fallback', () => {
  const duplicateDecision = {
    ...decision('FALLBACK_FAILED'),
    diagnostics: {
      ...decision('FALLBACK_FAILED').diagnostics,
      duplicateRankedKeyCount: 1,
    },
  };
  assert.equal(
    assertDuplicateKeysContained({
      decision: duplicateDecision,
      returnedIds: ['a', 'b'],
      actualStamp: 'learner-home-v1:base=legacy-v1;sm=fb-failed;sp=ml-primary',
      sectionKey: 'suggested_materials',
    }).ok,
    true,
  );
  const mlAccepted = assertDuplicateKeysContained({
    decision: {
      ...decision('ML_RANKED'),
      diagnostics: {
        ...decision('ML_RANKED').diagnostics,
        duplicateRankedKeyCount: 1,
      },
    },
    returnedIds: ['a', 'b'],
    actualStamp: 'learner-home-v1:base=legacy-v1;sm=ml-primary;sp=ml-primary',
    sectionKey: 'suggested_materials',
  });
  assert.equal(mlAccepted.ok, false);
  assert.equal(mlAccepted.code, 'DUPLICATE_KEYS_ACCEPTED');

  const visibleDup = assertDuplicateKeysContained({
    decision: duplicateDecision,
    returnedIds: ['a', 'a'],
    actualStamp: 'learner-home-v1:base=legacy-v1;sm=fb-failed;sp=ml-primary',
    sectionKey: 'suggested_materials',
  });
  assert.equal(visibleDup.ok, false);
  assert.equal(visibleDup.code, 'DUPLICATE_KEYS_ACCEPTED');
});

test('ml-smoke-local pure: repeatability compares full snapshot fields', () => {
  const base: SmokeRepeatabilitySnapshot = {
    rankedIds: ['a', 'b'],
    orderedPoolIds: ['a', 'b', 'c'],
    visibleIds: ['a', 'b'],
    actualStamp: 'learner-home-v1:base=legacy-v1;sm=ml-primary;sp=ml-primary',
    status: 'ML_RANKED',
    mappedCount: 2,
    unmappedCount: 1,
    omittedMappedCount: 0,
    unknownKeyCount: 0,
    duplicateKeyCount: 0,
    fallback: false,
    scores: [1, 2],
    diagnosticsDigest: 'candidateCount=3;scoredCount=2',
  };
  assert.equal(compareRepeatabilitySnapshots(base, base).ok, true);
  const failed = compareRepeatabilitySnapshots(base, {
    ...base,
    omittedMappedCount: 1,
  });
  assert.equal(failed.ok, false);
  assert.equal(failed.code, 'UNSTABLE_RANKING');
  assert.match(failed.detail ?? '', /omittedMappedCount/);
});

test('ml-smoke-local pure: redaction strips PII keys', () => {
  const redacted = redactForOutput({
    alias: 'learner-1',
    email: 'majd@learner.com',
    displayName: 'secret',
    interests: ['arduino'],
    nested: { password: 'x', ok: 1 },
  });
  assert.deepEqual(redacted, {
    alias: 'learner-1',
    nested: { ok: 1 },
  });
});

test('ml-smoke-local pure: hard vs diagnostic classification', () => {
  assert.equal(classifyHardFailure('OUT_OF_POOL_CANDIDATE'), true);
  assert.equal(classifyHardFailure('MATERIAL_ML_NOT_APPLIED'), true);
  assert.equal(classifyHardFailure('APPEND_ORDER_MISMATCH'), true);
  assert.equal(classifyHardFailure('ml_order_equals_deterministic_prefix'), false);
});

test('ml-smoke-local pure: parseSmokeArgs honors --json and npm_config_json', async () => {
  const { parseSmokeArgs } = await import(
    './recommendations-ml-smoke-local-checks.js'
  );
  assert.equal(parseSmokeArgs(['--json']).json, true);
  assert.equal(
    parseSmokeArgs([], { npm_config_json: 'true' } as NodeJS.ProcessEnv).json,
    true,
  );
  assert.equal(
    parseSmokeArgs(['--evaluation-time=2026-07-23T00:00:00.000Z'])
      .evaluationTimeUtc,
    '2026-07-23T00:00:00.000Z',
  );
});

test('ml-smoke-local pure: stable JSON serialization includes schema and aliases only', () => {
  const report: SmokeJsonReport = {
    schemaVersion: SMOKE_SCHEMA_VERSION,
    evaluationTimeUtc: '2026-07-23T00:00:00.000Z',
    runtimeMode: 'ML_PRIMARY',
    artifacts: {
      material: { state: 'READY', semanticContentHash: 'a'.repeat(64) },
      project: { state: 'READY', semanticContentHash: 'b'.repeat(64) },
    },
    domains: {
      material: { readiness: 'READY' },
      project: { readiness: 'READY' },
    },
    learners: [{ alias: 'learner-1' }],
    sections: [],
    hardFailures: [],
    diagnostics: [
      'suggested_materials:personalization_order_differs_across_learners',
    ],
    success: true,
  };
  const json = toJsonReport(report);
  assert.match(json, /"schemaVersion": "impactloop-ml-smoke-local-v1"/);
  assert.doesNotMatch(json, /@learner\.com/);
  assert.doesNotMatch(json, /email/);
  const human = formatHumanReport(report);
  assert.match(human, /PASS/);
  assert.equal(aliasForIndex(0), 'learner-1');
  assert.equal(aliasForIndex(2), 'learner-3');
});
