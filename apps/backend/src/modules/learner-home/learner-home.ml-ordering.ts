import type {
  MaterialCondition,
  ProjectDifficulty,
} from '../../generated/prisma/client.js';
import { TaxonomyFoundationRepository } from '../taxonomy/taxonomy-foundation.repository.js';
import {
  buildCanonicalMaterialRuntimeFeatures,
  buildCanonicalProjectRuntimeFeatures,
  canonicalConceptAssociationFromActiveKey,
  getCanonicalRuntimeFeatureAuthority,
  type CanonicalRuntimeFeatureAuthority,
} from '../recommendations/canonical-runtime-item-features.js';
import { resolveCanonicalShadowUserFeatures } from '../recommendations/canonical-shadow-user-features.js';
import type {
  LocalMlDomain,
  LocalMlScoringInput,
  WeightedFeature,
} from '../recommendations/ml-lightfm-scorer.js';
import { stableOpaqueKey } from '../recommendations/local-ml-training-snapshot.schema.js';
import {
  getRecommendationMlRuntimeSnapshot,
  rankMlPrimaryCandidates,
  type RecommendationMlRankingResult,
  type RecommendationMlRuntimeSnapshot,
} from '../recommendations/ml-runtime-state.service.js';

const DIAGNOSTIC_SAMPLE_LIMIT = 8;

export type LearnerHomeMlOrderingStatus =
  | 'DETERMINISTIC'
  | 'SHADOW'
  | 'ML_RANKED'
  | 'FALLBACK_NOT_READY'
  | 'FALLBACK_FAILED';

export type LearnerHomeMlOrderingDiagnostics = Readonly<{
  candidateCount: number;
  scoredCount: number;
  retryCount: number;
  unmappedCandidateCount: number;
  omittedMappedCandidateCount: number;
  unknownRankedKeyCount: number;
  duplicateRankedKeyCount: number;
  opaqueKeySamples: readonly string[];
}>;

export type LearnerHomeMlOrderingDecision = Readonly<{
  domain: LocalMlDomain;
  runtimeMode: RecommendationMlRuntimeSnapshot['mode'];
  status: LearnerHomeMlOrderingStatus;
  reasonCode?: string;
  diagnostics: LearnerHomeMlOrderingDiagnostics;
}>;

export type LearnerHomeMlOrderedPool<T> = Readonly<{
  ordered: readonly T[];
  decision: LearnerHomeMlOrderingDecision;
}>;

export type LearnerHomeMlPreparedCandidate<T> = Readonly<{
  candidateKey: string;
  item: T;
  features: readonly WeightedFeature[];
}>;

export type LearnerHomeMaterialMlCandidate<T> = Readonly<{
  candidateKey: string;
  item: T;
  conceptKeys: readonly string[];
  condition: MaterialCondition;
  isFree: boolean;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
}>;

export type LearnerHomeProjectMlCandidate<T> = Readonly<{
  candidateKey: string;
  item: T;
  conceptKeys: readonly string[];
  componentConceptKeys: readonly string[];
  difficulty: ProjectDifficulty;
}>;

type MlOrderingDependencies = Readonly<{
  getSnapshot: () => RecommendationMlRuntimeSnapshot;
  rank: (input: LocalMlScoringInput) => RecommendationMlRankingResult;
  loadUserFeatures: (interests: readonly string[]) => Promise<readonly WeightedFeature[]>;
  loadAuthority: () => Promise<CanonicalRuntimeFeatureAuthority>;
}>;

const defaultDependencies: MlOrderingDependencies = {
  getSnapshot: getRecommendationMlRuntimeSnapshot,
  rank: rankMlPrimaryCandidates,
  loadUserFeatures: async (interests) =>
    (
      await resolveCanonicalShadowUserFeatures({
        storedInterests: interests,
        loadRegistry: () =>
          new TaxonomyFoundationRepository().loadLearnerInterestResolutionRegistry(),
      })
    ).features,
  loadAuthority: getCanonicalRuntimeFeatureAuthority,
};

const emptyDiagnostics = (
  candidateCount: number,
): LearnerHomeMlOrderingDiagnostics => ({
  candidateCount,
  scoredCount: 0,
  retryCount: 0,
  unmappedCandidateCount: 0,
  omittedMappedCandidateCount: 0,
  unknownRankedKeyCount: 0,
  duplicateRankedKeyCount: 0,
  opaqueKeySamples: [],
});

const decision = (
  domain: LocalMlDomain,
  runtimeMode: RecommendationMlRuntimeSnapshot['mode'],
  status: LearnerHomeMlOrderingStatus,
  diagnostics: LearnerHomeMlOrderingDiagnostics,
  reasonCode?: string,
): LearnerHomeMlOrderingDecision => ({
  domain,
  runtimeMode,
  status,
  ...(reasonCode ? { reasonCode } : {}),
  diagnostics: Object.freeze({
    ...diagnostics,
    opaqueKeySamples: Object.freeze([...diagnostics.opaqueKeySamples]),
  }),
});

const deterministicResult = <T>(
  domain: LocalMlDomain,
  runtimeMode: RecommendationMlRuntimeSnapshot['mode'],
  candidates: readonly LearnerHomeMlPreparedCandidate<T>[],
  status: Exclude<LearnerHomeMlOrderingStatus, 'ML_RANKED'>,
  reasonCode?: string,
  diagnostics: LearnerHomeMlOrderingDiagnostics = emptyDiagnostics(candidates.length),
): LearnerHomeMlOrderedPool<T> => ({
  ordered: Object.freeze(candidates.map((candidate) => candidate.item)),
  decision: decision(domain, runtimeMode, status, diagnostics, reasonCode),
});

export const buildMaterialMlScoringInput = <T>(input: {
  userFeatures: readonly WeightedFeature[];
  authority: CanonicalRuntimeFeatureAuthority;
  candidates: readonly LearnerHomeMaterialMlCandidate<T>[];
}): {
  scoringInput: LocalMlScoringInput;
  prepared: readonly LearnerHomeMlPreparedCandidate<T>[];
} => {
  const prepared = input.candidates.map((candidate) => ({
    candidateKey: candidate.candidateKey,
    item: candidate.item,
    features: buildCanonicalMaterialRuntimeFeatures({
      authority: input.authority,
      concepts: candidate.conceptKeys.map((canonicalKey) =>
        canonicalConceptAssociationFromActiveKey(input.authority, canonicalKey),
      ),
      condition: candidate.condition,
      isFree: candidate.isFree,
      pickupAllowed: candidate.pickupAllowed,
      deliveryAllowed: candidate.deliveryAllowed,
    }).features,
  }));
  return {
    prepared,
    scoringInput: {
      domain: 'material',
      userFeatures: input.userFeatures,
      candidates: prepared.map(({ candidateKey, features }) => ({
        candidateKey,
        features,
      })),
    },
  };
};

export const buildProjectMlScoringInput = <T>(input: {
  userFeatures: readonly WeightedFeature[];
  authority: CanonicalRuntimeFeatureAuthority;
  candidates: readonly LearnerHomeProjectMlCandidate<T>[];
}): {
  scoringInput: LocalMlScoringInput;
  prepared: readonly LearnerHomeMlPreparedCandidate<T>[];
} => {
  const prepared = input.candidates.map((candidate) => ({
    candidateKey: candidate.candidateKey,
    item: candidate.item,
    features: buildCanonicalProjectRuntimeFeatures({
      authority: input.authority,
      topicConcepts: candidate.conceptKeys.map((canonicalKey) =>
        canonicalConceptAssociationFromActiveKey(input.authority, canonicalKey),
      ),
      componentConcepts: candidate.componentConceptKeys.map((canonicalKey) => ({
        ...canonicalConceptAssociationFromActiveKey(input.authority, canonicalKey),
        isRequired: true,
      })),
      difficulty: candidate.difficulty,
    }).features,
  }));
  return {
    prepared,
    scoringInput: {
      domain: 'project',
      userFeatures: input.userFeatures,
      candidates: prepared.map(({ candidateKey, features }) => ({
        candidateKey,
        features,
      })),
    },
  };
};

export const applyContainedMlRanking = <T>(input: {
  domain: LocalMlDomain;
  runtimeMode: RecommendationMlRuntimeSnapshot['mode'];
  original: readonly LearnerHomeMlPreparedCandidate<T>[];
  mapped: readonly LearnerHomeMlPreparedCandidate<T>[];
  unmapped: readonly LearnerHomeMlPreparedCandidate<T>[];
  result: Extract<RecommendationMlRankingResult, { outcome: 'ML_RANKED' }>;
  retryCount: number;
  opaqueKeySamples: readonly string[];
}): LearnerHomeMlOrderedPool<T> => {
  const fallbackDiagnostics = (
    overrides: Partial<LearnerHomeMlOrderingDiagnostics> = {},
  ): LearnerHomeMlOrderingDiagnostics => ({
    ...emptyDiagnostics(input.original.length),
    retryCount: input.retryCount,
    unmappedCandidateCount: input.unmapped.length,
    opaqueKeySamples: input.opaqueKeySamples,
    ...overrides,
  });
  if (input.result.domain !== input.domain) {
    return deterministicResult(
      input.domain,
      input.runtimeMode,
      input.original,
      'FALLBACK_FAILED',
      'DOMAIN_MISMATCH',
      fallbackDiagnostics(),
    );
  }

  if (input.result.scored.some((candidate) => !Number.isFinite(candidate.score))) {
    return deterministicResult(
      input.domain,
      input.runtimeMode,
      input.original,
      'FALLBACK_FAILED',
      'NONFINITE_OUTPUT',
      fallbackDiagnostics(),
    );
  }

  const mappedByKey = new Map(input.mapped.map((candidate) => [candidate.candidateKey, candidate]));
  const seenRankedKeys = new Set<string>();
  let duplicateRankedKeyCount = 0;
  let unknownRankedKeyCount = 0;
  const unknownOpaqueKeySamples: string[] = [];
  const rankedMapped: LearnerHomeMlPreparedCandidate<T>[] = [];

  for (const candidateKey of input.result.rankedCandidateKeys) {
    if (seenRankedKeys.has(candidateKey)) {
      duplicateRankedKeyCount += 1;
      continue;
    }
    seenRankedKeys.add(candidateKey);
    const candidate = mappedByKey.get(candidateKey);
    if (!candidate) {
      unknownRankedKeyCount += 1;
      if (unknownOpaqueKeySamples.length < DIAGNOSTIC_SAMPLE_LIMIT) {
        unknownOpaqueKeySamples.push(stableOpaqueKey(input.domain, candidateKey));
      }
      continue;
    }
    rankedMapped.push(candidate);
  }
  const opaqueKeySamples = [...new Set([
    ...input.opaqueKeySamples,
    ...unknownOpaqueKeySamples,
  ])].slice(0, DIAGNOSTIC_SAMPLE_LIMIT);

  if (duplicateRankedKeyCount > 0) {
    return deterministicResult(
      input.domain,
      input.runtimeMode,
      input.original,
      'FALLBACK_FAILED',
      'DUPLICATE_RANKED_KEY',
      fallbackDiagnostics({
        unknownRankedKeyCount,
        duplicateRankedKeyCount,
        opaqueKeySamples,
      }),
    );
  }

  if (rankedMapped.length === 0 && input.mapped.length > 0) {
    return deterministicResult(
      input.domain,
      input.runtimeMode,
      input.original,
      'FALLBACK_FAILED',
      'NO_CONTAINED_RANKED_KEYS',
      fallbackDiagnostics({
        unknownRankedKeyCount,
        opaqueKeySamples,
      }),
    );
  }

  const rankedSet = new Set(rankedMapped.map((candidate) => candidate.candidateKey));
  const omittedMappedCandidateCount = input.mapped.filter(
    (candidate) => !rankedSet.has(candidate.candidateKey),
  ).length;
  const deterministicTail = input.original.filter(
    (candidate) => !rankedSet.has(candidate.candidateKey),
  );
  const combined = [...rankedMapped, ...deterministicTail];
  const combinedKeys = combined.map((candidate) => candidate.candidateKey);

  if (
    new Set(combinedKeys).size !== combinedKeys.length ||
    combined.length !== input.original.length
  ) {
    return deterministicResult(
      input.domain,
      input.runtimeMode,
      input.original,
      'FALLBACK_FAILED',
      'CONTAINMENT_INVARIANT_FAILED',
      fallbackDiagnostics({
        omittedMappedCandidateCount,
        unknownRankedKeyCount,
        opaqueKeySamples,
      }),
    );
  }

  return {
    ordered: Object.freeze(combined.map((candidate) => candidate.item)),
    decision: decision(input.domain, input.runtimeMode, 'ML_RANKED', {
      candidateCount: input.original.length,
      scoredCount: input.result.scored.length,
      retryCount: input.retryCount,
      unmappedCandidateCount: input.unmapped.length,
      omittedMappedCandidateCount,
      unknownRankedKeyCount,
      duplicateRankedKeyCount: 0,
      opaqueKeySamples,
    }),
  };
};

const rankPreparedPool = <T>(input: {
  domain: LocalMlDomain;
  runtimeMode: RecommendationMlRuntimeSnapshot['mode'];
  userFeatures: readonly WeightedFeature[];
  candidates: readonly LearnerHomeMlPreparedCandidate<T>[];
  rank: MlOrderingDependencies['rank'];
}): LearnerHomeMlOrderedPool<T> => {
  const original = [...input.candidates];
  let mapped = [...input.candidates];
  const unmapped: LearnerHomeMlPreparedCandidate<T>[] = [];
  const opaqueKeySamples: string[] = [];
  let retryCount = 0;

  for (let attempt = 0; attempt <= original.length; attempt += 1) {
    if (mapped.length === 0) {
      return deterministicResult(
        input.domain,
        input.runtimeMode,
        original,
        'FALLBACK_NOT_READY',
        'NO_SAFELY_RANKABLE_SUBSET',
        {
          ...emptyDiagnostics(original.length),
          retryCount,
          unmappedCandidateCount: unmapped.length,
          opaqueKeySamples,
        },
      );
    }

    let result: RecommendationMlRankingResult;
    try {
      result = input.rank({
        domain: input.domain,
        userFeatures: input.userFeatures,
        candidates: mapped.map(({ candidateKey, features }) => ({
          candidateKey,
          features,
        })),
      });
    } catch {
      return deterministicResult(
        input.domain,
        input.runtimeMode,
        original,
        'FALLBACK_FAILED',
        'SCORER_EXCEPTION',
        {
          ...emptyDiagnostics(original.length),
          retryCount,
          unmappedCandidateCount: unmapped.length,
          opaqueKeySamples,
        },
      );
    }

    if (result.outcome === 'ML_RANKED') {
      return applyContainedMlRanking({
        domain: input.domain,
        runtimeMode: input.runtimeMode,
        original,
        mapped,
        unmapped,
        result,
        retryCount,
        opaqueKeySamples,
      });
    }

    if (result.reasonCode !== 'CANDIDATE_MAPPING_MISSING') {
      const status = result.diagnostics.state === 'DISABLED'
        || result.diagnostics.state === 'LOADING'
        || result.diagnostics.state === 'NOT_READY'
        ? 'FALLBACK_NOT_READY'
        : 'FALLBACK_FAILED';
      return deterministicResult(
        input.domain,
        input.runtimeMode,
        original,
        status,
        result.reasonCode,
        {
          ...emptyDiagnostics(original.length),
          retryCount,
          unmappedCandidateCount: unmapped.length,
          opaqueKeySamples,
        },
      );
    }

    const sampleSet = new Set(result.diagnostics.missingMappingKeySamples);
    const removed: LearnerHomeMlPreparedCandidate<T>[] = [];
    const retained: LearnerHomeMlPreparedCandidate<T>[] = [];
    for (const candidate of mapped) {
      const opaqueKey = stableOpaqueKey(input.domain, candidate.candidateKey);
      if (sampleSet.has(opaqueKey)) {
        removed.push(candidate);
        if (opaqueKeySamples.length < DIAGNOSTIC_SAMPLE_LIMIT) {
          opaqueKeySamples.push(opaqueKey);
        }
      } else {
        retained.push(candidate);
      }
    }

    if (removed.length === 0) {
      return deterministicResult(
        input.domain,
        input.runtimeMode,
        original,
        'FALLBACK_FAILED',
        'UNSAFE_MAPPING_DIAGNOSTIC',
        {
          ...emptyDiagnostics(original.length),
          retryCount,
          unmappedCandidateCount: unmapped.length,
          opaqueKeySamples,
        },
      );
    }

    unmapped.push(...removed);
    mapped = retained;
    retryCount += 1;
  }

  return deterministicResult(
    input.domain,
    input.runtimeMode,
    original,
    'FALLBACK_FAILED',
    'MAPPING_RETRY_EXHAUSTED',
    {
      ...emptyDiagnostics(original.length),
      retryCount,
      unmappedCandidateCount: unmapped.length,
      opaqueKeySamples,
    },
  );
};

/** @internal Focused pure-test seam for the production containment/retry loop. */
export const rankPreparedLearnerHomeMlCandidatePoolForTests = rankPreparedPool;

export const rankLearnerHomeMlCandidatePool = async <T>(
  input:
    | Readonly<{
        domain: 'material';
        interests: readonly string[];
        candidates: readonly LearnerHomeMaterialMlCandidate<T>[];
      }>
    | Readonly<{
        domain: 'project';
        interests: readonly string[];
        candidates: readonly LearnerHomeProjectMlCandidate<T>[];
      }>,
  dependencyOverrides: Partial<MlOrderingDependencies> = {},
): Promise<LearnerHomeMlOrderedPool<T>> => {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const snapshot = dependencies.getSnapshot();
  const rawCandidates = input.candidates;
  const emptyPrepared = rawCandidates.map((candidate) => ({
    candidateKey: candidate.candidateKey,
    item: candidate.item,
    features: [] as readonly WeightedFeature[],
  }));

  if (snapshot.mode === 'DETERMINISTIC') {
    return deterministicResult(
      input.domain,
      snapshot.mode,
      emptyPrepared,
      'DETERMINISTIC',
    );
  }
  if (snapshot.mode === 'SHADOW') {
    return deterministicResult(input.domain, snapshot.mode, emptyPrepared, 'SHADOW');
  }

  const domainState = input.domain === 'material' ? snapshot.material : snapshot.project;
  if (domainState.state !== 'READY') {
    return deterministicResult(
      input.domain,
      snapshot.mode,
      emptyPrepared,
      domainState.state === 'FAILED' ? 'FALLBACK_FAILED' : 'FALLBACK_NOT_READY',
      domainState.failureCode ?? `RUNTIME_${domainState.state}`,
    );
  }
  if (rawCandidates.length === 0) {
    return deterministicResult(
      input.domain,
      snapshot.mode,
      emptyPrepared,
      'DETERMINISTIC',
      'EMPTY_CANDIDATE_POOL',
    );
  }

  try {
    const [userFeatures, authority] = await Promise.all([
      dependencies.loadUserFeatures(input.interests),
      dependencies.loadAuthority(),
    ]);
    const built = input.domain === 'material'
      ? buildMaterialMlScoringInput({
          userFeatures,
          authority,
          candidates: input.candidates,
        })
      : buildProjectMlScoringInput({
          userFeatures,
          authority,
          candidates: input.candidates,
        });
    return rankPreparedPool({
      domain: input.domain,
      runtimeMode: snapshot.mode,
      userFeatures,
      candidates: built.prepared,
      rank: dependencies.rank,
    });
  } catch {
    return deterministicResult(
      input.domain,
      snapshot.mode,
      emptyPrepared,
      'FALLBACK_FAILED',
      'FEATURE_BUILD_FAILED',
    );
  }
};

const runtimeDomainIdentity = (
  domain: RecommendationMlRuntimeSnapshot['material'],
  fallbackArtifactPath: string,
): string => [
  domain.state,
  domain.semanticContentHash ?? (fallbackArtifactPath || 'NO_ARTIFACT'),
  domain.modelVersion ?? 'NO_MODEL_VERSION',
  domain.schemaVersion ?? 'NO_SCHEMA_VERSION',
  domain.artifactItemCount ?? 'NO_ITEM_COUNT',
  domain.failureCode ?? 'NO_FAILURE',
  domain.loadCompletedAt ?? 'NO_GENERATION',
].join(':');

export const buildLearnerHomeMlRuntimeIdentity = (input: {
  snapshot: RecommendationMlRuntimeSnapshot;
  materialArtifactPath?: string;
  projectArtifactPath?: string;
}): { mode: RecommendationMlRuntimeSnapshot['mode']; material: string; project: string } => ({
  mode: input.snapshot.mode,
  material: runtimeDomainIdentity(
    input.snapshot.material,
    input.materialArtifactPath ?? '',
  ),
  project: runtimeDomainIdentity(
    input.snapshot.project,
    input.projectArtifactPath ?? '',
  ),
});
