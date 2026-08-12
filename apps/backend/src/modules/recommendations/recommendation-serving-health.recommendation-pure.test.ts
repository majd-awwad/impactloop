import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  auditRankPoolCap,
  auditSoftScoreGate,
  evaluateDomainServingHealth,
  evaluateRequestServingHealth,
  accumulateServingCoverage,
  emptyServingCoverageCounts,
  summarizeServingCoverage,
  accumulateCoverageFromAlgorithmVersions,
} from './recommendation-serving-health.js';
import type { LearnerHomeMlOrderingDecision } from '../learner-home/learner-home.ml-ordering.js';
import type { RecommendationMlRuntimeSnapshot } from './ml-runtime-state.service.js';

const decision = (
  overrides: Partial<LearnerHomeMlOrderingDecision> &
    Pick<LearnerHomeMlOrderingDecision, 'domain' | 'runtimeMode' | 'status'>,
): LearnerHomeMlOrderingDecision => ({
  reasonCode: overrides.reasonCode,
  diagnostics: overrides.diagnostics ?? {
    candidateCount: 5,
    scoredCount: overrides.status === 'ML_RANKED' ? 5 : 0,
    retryCount: 0,
    unmappedCandidateCount: 0,
    omittedMappedCandidateCount: 0,
    unknownRankedKeyCount: 0,
    duplicateRankedKeyCount: 0,
    opaqueKeySamples: [],
  },
  domain: overrides.domain,
  runtimeMode: overrides.runtimeMode,
  status: overrides.status,
});

const domainState = (
  state: RecommendationMlRuntimeSnapshot['material']['state'],
  failureCode?: RecommendationMlRuntimeSnapshot['material']['failureCode'],
): RecommendationMlRuntimeSnapshot['material'] =>
  Object.freeze({
    runtimeMode: 'ML_PRIMARY' as const,
    domain: 'material' as const,
    state,
    ...(failureCode ? { failureCode } : {}),
    modelVersion: state === 'READY' ? 'lm-06-local-lightfm-v1' : undefined,
    schemaVersion: state === 'READY' ? 'impactloop-lightfm-portable-v2' : undefined,
    semanticContentHash: state === 'READY' ? 'e'.repeat(64) : undefined,
  });

describe('recommendation serving health', () => {
  test('READY + ML_RANKED is healthy ML_SERVED', () => {
    const truth = evaluateDomainServingHealth({
      decision: decision({
        domain: 'material',
        runtimeMode: 'ML_PRIMARY',
        status: 'ML_RANKED',
      }),
      domainState: domainState('READY'),
      finalSectionItemCount: 4,
    });
    assert.equal(truth.health, 'ML_SERVED');
    assert.equal(truth.expectedToMlRank, true);
    assert.equal(truth.mlOwnedFinalOrder, true);
  });

  test('READY + non-empty pool + fallback is FALLBACK_UNEXPECTED', () => {
    const truth = evaluateDomainServingHealth({
      decision: decision({
        domain: 'material',
        runtimeMode: 'ML_PRIMARY',
        status: 'FALLBACK_FAILED',
        reasonCode: 'SCORER_EXCEPTION',
      }),
      domainState: domainState('READY'),
      finalSectionItemCount: 4,
    });
    assert.equal(truth.health, 'FALLBACK_UNEXPECTED');
    assert.equal(truth.expectedToMlRank, true);
    assert.equal(truth.mlOwnedFinalOrder, false);
  });

  test('NOT_READY + fallback is FALLBACK_EXPECTED', () => {
    const truth = evaluateDomainServingHealth({
      decision: decision({
        domain: 'project',
        runtimeMode: 'ML_PRIMARY',
        status: 'FALLBACK_NOT_READY',
        reasonCode: 'RUNTIME_NOT_READY',
      }),
      domainState: domainState('NOT_READY', 'ARTIFACT_PATH_MISSING'),
      finalSectionItemCount: 4,
    });
    assert.equal(truth.health, 'FALLBACK_EXPECTED');
    assert.equal(truth.expectedToMlRank, false);
  });

  test('explicit DETERMINISTIC is intentional', () => {
    const truth = evaluateDomainServingHealth({
      decision: decision({
        domain: 'material',
        runtimeMode: 'DETERMINISTIC',
        status: 'DETERMINISTIC',
      }),
      domainState: domainState('DISABLED'),
      finalSectionItemCount: 4,
    });
    assert.equal(truth.health, 'EXPLICIT_DETERMINISTIC');
    assert.equal(truth.expectedToMlRank, false);
  });

  test('SHADOW is intentional non-serving', () => {
    const truth = evaluateDomainServingHealth({
      decision: decision({
        domain: 'material',
        runtimeMode: 'SHADOW',
        status: 'SHADOW',
      }),
      domainState: domainState('READY'),
      finalSectionItemCount: 4,
    });
    assert.equal(truth.health, 'SHADOW');
    assert.equal(truth.expectedToMlRank, false);
    assert.equal(truth.mlOwnedFinalOrder, false);
  });

  test('empty candidate pool is EMPTY not unexpected', () => {
    const truth = evaluateDomainServingHealth({
      decision: decision({
        domain: 'material',
        runtimeMode: 'ML_PRIMARY',
        status: 'DETERMINISTIC',
        reasonCode: 'EMPTY_CANDIDATE_POOL',
        diagnostics: {
          candidateCount: 0,
          scoredCount: 0,
          retryCount: 0,
          unmappedCandidateCount: 0,
          omittedMappedCandidateCount: 0,
          unknownRankedKeyCount: 0,
          duplicateRankedKeyCount: 0,
          opaqueKeySamples: [],
        },
      }),
      domainState: domainState('READY'),
      finalSectionItemCount: 0,
    });
    assert.equal(truth.health, 'EMPTY');
    assert.equal(truth.expectedToMlRank, false);
  });

  test('request health aggregates unexpected fallback across domains', () => {
    const snapshot = {
      mode: 'ML_PRIMARY' as const,
      material: domainState('READY'),
      project: domainState('READY'),
    };
    const truth = evaluateRequestServingHealth({
      snapshot,
      materialDecision: decision({
        domain: 'material',
        runtimeMode: 'ML_PRIMARY',
        status: 'ML_RANKED',
      }),
      projectDecision: decision({
        domain: 'project',
        runtimeMode: 'ML_PRIMARY',
        status: 'FALLBACK_FAILED',
        reasonCode: 'FEATURE_BUILD_FAILED',
      }),
      materialFinalSectionItemCount: 4,
      projectFinalSectionItemCount: 4,
    });
    assert.equal(truth.hasUnexpectedFallback, true);
    assert.equal(truth.overallHealth, 'FALLBACK_UNEXPECTED');
    assert.equal(truth.material.health, 'ML_SERVED');
    assert.equal(truth.project.health, 'FALLBACK_UNEXPECTED');
  });

  test('coverage accumulator tracks ML_RANKED rate', () => {
    let counts = emptyServingCoverageCounts();
    const ranked = evaluateDomainServingHealth({
      decision: decision({
        domain: 'material',
        runtimeMode: 'ML_PRIMARY',
        status: 'ML_RANKED',
      }),
      domainState: domainState('READY'),
      finalSectionItemCount: 4,
    });
    const fallback = evaluateDomainServingHealth({
      decision: decision({
        domain: 'material',
        runtimeMode: 'ML_PRIMARY',
        status: 'FALLBACK_NOT_READY',
      }),
      domainState: domainState('NOT_READY', 'ARTIFACT_PATH_MISSING'),
      finalSectionItemCount: 4,
    });
    counts = accumulateServingCoverage(counts, ranked);
    counts = accumulateServingCoverage(counts, ranked);
    counts = accumulateServingCoverage(counts, fallback);
    const summary = summarizeServingCoverage(counts);
    assert.equal(summary.total, 3);
    assert.equal(summary.counts.ML_RANKED, 2);
    assert.equal(summary.counts.FALLBACK_NOT_READY, 1);
    assert.equal(summary.mlRankedRate, 2 / 3);
  });

  test('soft score gate and rank-pool audits classify truncation', () => {
    const soft = auditSoftScoreGate({
      hardEligibleCount: 100,
      softEligibleCount: 40,
    });
    assert.equal(soft.excludedByScoreZeroCount, 60);
    assert.equal(soft.classification, 'LOW_DETERMINISTIC_PREFERENCE');

    const cap = auditRankPoolCap({ softEligibleCount: 120, poolCap: 48 });
    assert.equal(cap.truncated, true);
    assert.equal(cap.truncatedCount, 72);
  });

  test('algorithmVersion stamps accumulate independent domain coverage', () => {
    const summary = accumulateCoverageFromAlgorithmVersions([
      'learner-home-v1:base=legacy-v1;sm=ml-primary;sp=fb-not-ready',
      'learner-home-v1:base=legacy-v1;sm=ml-primary;sp=ml-primary',
      'learner-home-v1:base=legacy-v1;sm=fb-failed;sp=ml-primary',
    ]);
    assert.equal(summary.material.ML_RANKED, 2);
    assert.equal(summary.material.FALLBACK_FAILED, 1);
    assert.equal(summary.project.ML_RANKED, 2);
    assert.equal(summary.project.FALLBACK_NOT_READY, 1);
    assert.equal(summary.materialSummary.mlRankedRate, 2 / 3);
  });

  test('cold-start serving truth table is honest about expected outcomes', () => {
    const cases: Array<{
      name: string;
      domainState: RecommendationMlRuntimeSnapshot['material']['state'];
      status: LearnerHomeMlOrderingDecision['status'];
      candidateCount: number;
      reasonCode?: string;
      expectedHealth: string;
      expectedToMlRank: boolean;
    }> = [
      {
        name: 'new learner with interests, READY, non-empty pool',
        domainState: 'READY',
        status: 'ML_RANKED',
        candidateCount: 12,
        expectedHealth: 'ML_SERVED',
        expectedToMlRank: true,
      },
      {
        name: 'new learner no interests, empty soft pool',
        domainState: 'READY',
        status: 'DETERMINISTIC',
        candidateCount: 0,
        reasonCode: 'EMPTY_CANDIDATE_POOL',
        expectedHealth: 'EMPTY',
        expectedToMlRank: false,
      },
      {
        name: 'sparse learner READY unexpected scorer failure',
        domainState: 'READY',
        status: 'FALLBACK_FAILED',
        candidateCount: 8,
        reasonCode: 'SCORER_EXCEPTION',
        expectedHealth: 'FALLBACK_UNEXPECTED',
        expectedToMlRank: true,
      },
      {
        name: 'rich history but domain NOT_READY',
        domainState: 'NOT_READY',
        status: 'FALLBACK_NOT_READY',
        candidateCount: 20,
        reasonCode: 'RUNTIME_NOT_READY',
        expectedHealth: 'FALLBACK_EXPECTED',
        expectedToMlRank: false,
      },
      {
        name: 'missing vocabulary mapping still ML_RANKED with append',
        domainState: 'READY',
        status: 'ML_RANKED',
        candidateCount: 10,
        expectedHealth: 'ML_SERVED',
        expectedToMlRank: true,
      },
      {
        name: 'explicit DETERMINISTIC rollback',
        domainState: 'DISABLED',
        status: 'DETERMINISTIC',
        candidateCount: 10,
        expectedHealth: 'EXPLICIT_DETERMINISTIC',
        expectedToMlRank: false,
      },
    ];

    for (const row of cases) {
      const truth = evaluateDomainServingHealth({
        decision: decision({
          domain: 'material',
          runtimeMode:
            row.expectedHealth === 'EXPLICIT_DETERMINISTIC'
              ? 'DETERMINISTIC'
              : 'ML_PRIMARY',
          status: row.status,
          reasonCode: row.reasonCode,
          diagnostics: {
            candidateCount: row.candidateCount,
            scoredCount: row.status === 'ML_RANKED' ? row.candidateCount : 0,
            retryCount: 0,
            unmappedCandidateCount: row.name.includes('vocabulary') ? 3 : 0,
            omittedMappedCandidateCount: 0,
            unknownRankedKeyCount: 0,
            duplicateRankedKeyCount: 0,
            opaqueKeySamples: [],
          },
        }),
        domainState: domainState(
          row.domainState,
          row.domainState === 'NOT_READY' ? 'ARTIFACT_PATH_MISSING' : undefined,
        ),
        finalSectionItemCount: Math.min(4, row.candidateCount),
      });
      assert.equal(truth.health, row.expectedHealth, row.name);
      assert.equal(truth.expectedToMlRank, row.expectedToMlRank, row.name);
    }
  });
});
