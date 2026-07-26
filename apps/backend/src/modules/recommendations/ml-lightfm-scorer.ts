import type {
  PortableFeature,
  PortableModelArtifact,
  PortableModelArtifactV2,
} from './ml-model-artifact.js';
import { stableOpaqueKey } from './local-ml-training-snapshot.schema.js';
import {
  buildFeatureReadinessArtifactInput,
  classifyRuntimeFeatureForScorer,
  createFeatureReadinessSampleCollector,
  FEATURE_READINESS_SAMPLE_LIMIT,
  finalizeFeatureReadinessSamples,
  fingerprintRecommendationFeatureReadinessInput,
  hashFeatureReadinessCandidateKey,
  hashFeatureReadinessToken,
  recordFeatureReadinessIssue,
  type BoundedSampleEntry,
  type FeatureCriticality,
  type FeatureReadinessEvaluateInput,
  type FeatureReadinessIssueCode,
  type GroupCoverageSnapshot,
  type RecommendationFeatureReadiness,
} from './recommendation-feature-readiness.js';

export type WeightedFeature = readonly [name: string, weight: number];
export type ScoredCandidate = { candidateKey: string; score: number };

export const LIGHTFM_SCORER_RESULT_SCHEMA_VERSION =
  'lightfm-scorer-result-v1' as const;

export type LightFmScorerReasonCode =
  | 'FEATURE_CONTEXT_UNAVAILABLE'
  | 'FEATURE_CONTEXT_MISMATCH'
  | 'MISSING_CRITICAL_FEATURE'
  | 'MISSING_REQUIRED_GROUP'
  | 'EMPTY_CRITICAL_REPRESENTATION'
  | 'UNKNOWN_RUNTIME_FEATURE'
  | 'UNSUPPORTED_RUNTIME_FEATURE'
  | 'NONPORTABLE_RUNTIME_FEATURE'
  | 'INVALID_RUNTIME_FEATURE_VALUE'
  | 'INVALID_RUNTIME_FEATURE_WEIGHT'
  | 'INVALID_MODEL_VALUE'
  | 'NONFINITE_RUNTIME_INPUT'
  | 'NONFINITE_MODEL_INPUT'
  | 'NONFINITE_INTERMEDIATE'
  | 'NONFINITE_OUTPUT';

export type LightFmDiagnosticSample = BoundedSampleEntry;

export type LightFmFeatureIssueSummary = {
  occurrenceCount: number;
  uniqueCount: number;
  sample: LightFmDiagnosticSample[];
  sampleLimit: typeof FEATURE_READINESS_SAMPLE_LIMIT;
  truncated: boolean;
};

export type LightFmScorerDiagnostics = {
  missing: LightFmFeatureIssueSummary;
  missingCritical: LightFmFeatureIssueSummary;
  missingOptional: LightFmFeatureIssueSummary;
  unknown: LightFmFeatureIssueSummary;
  unsupported: LightFmFeatureIssueSummary;
  nonportable: LightFmFeatureIssueSummary;
  invalidValue: LightFmFeatureIssueSummary;
  invalidWeight: LightFmFeatureIssueSummary;
  invalidModelValueCount: number;
  nonfiniteRuntimeInputCount: number;
  nonfiniteModelInputCount: number;
  nonfiniteIntermediateCount: number;
  nonfiniteOutputCount: number;
  groups: Readonly<Record<string, GroupCoverageSnapshot>>;
};

type LightFmScorerResultBase = {
  schemaVersion: typeof LIGHTFM_SCORER_RESULT_SCHEMA_VERSION;
  scoringReadiness: 'READY' | 'NOT_READY';
  reasonCodes: LightFmScorerReasonCode[];
  diagnostics: LightFmScorerDiagnostics;
};

export type LightFmScorerResult =
  | (LightFmScorerResultBase & {
      outcome: 'SCORED';
      scored: ScoredCandidate[];
    })
  | (LightFmScorerResultBase & {
      outcome: 'FAILED_CLOSED';
      scoringReadiness: 'NOT_READY';
      scored: [];
    });

export type LightFmScorerContext = {
  readinessInput: FeatureReadinessEvaluateInput;
  featureReadiness: RecommendationFeatureReadiness;
};

type IssueKey =
  | 'missing'
  | 'missingCritical'
  | 'missingOptional'
  | 'unknown'
  | 'unsupported'
  | 'nonportable'
  | 'invalidValue'
  | 'invalidWeight';

const issueCodeByKey: Record<IssueKey, FeatureReadinessIssueCode> = {
  missing: 'SCORER_MISSING_FEATURE',
  missingCritical: 'MISSING_CRITICAL_ARTIFACT_FEATURE',
  missingOptional: 'MISSING_OPTIONAL_ARTIFACT_FEATURE',
  unknown: 'UNKNOWN_RUNTIME_FEATURE',
  unsupported: 'UNSUPPORTED_RUNTIME_FEATURE',
  nonportable: 'NONPORTABLE_RUNTIME_FEATURE',
  invalidValue: 'INVALID_RUNTIME_FEATURE_VALUE',
  invalidWeight: 'INVALID_RUNTIME_FEATURE_WEIGHT',
};

const uniqueIssueIdentity = (side: 'user' | 'item', token: string): string =>
  `${side}\u0000${token}`;

const scoreReasonCompare = (
  left: LightFmScorerReasonCode,
  right: LightFmScorerReasonCode,
): number => (left < right ? -1 : left > right ? 1 : 0);

const parseModelValue = (
  raw: unknown,
): { ok: true; value: number } | { ok: false; nonfinite: boolean } => {
  const value = Number(raw);
  if (Number.isNaN(value)) return { ok: false, nonfinite: false };
  if (!Number.isFinite(value)) return { ok: false, nonfinite: true };
  return { ok: true, value };
};

export const scorePortableLightFm = (
  artifact: PortableModelArtifact,
  userFeatures: WeightedFeature[],
  candidates: Array<{ candidateKey: string; features: WeightedFeature[] }>,
  context?: LightFmScorerContext,
): LightFmScorerResult => {
  const reasons = new Set<LightFmScorerReasonCode>();
  const sampleCollector = createFeatureReadinessSampleCollector();
  const uniqueByIssue = new Map<IssueKey, Set<string>>(
    (Object.keys(issueCodeByKey) as IssueKey[]).map((key) => [key, new Set()]),
  );
  const userLookup = new Map(
    artifact.user_features.map((entry) => [entry.name, entry]),
  );
  const itemLookup = new Map(
    artifact.item_features.map((entry) => [entry.name, entry]),
  );
  const userArtifactNames = new Set(userLookup.keys());
  const itemArtifactNames = new Set(itemLookup.keys());
  let fatalFeatureIssue = false;
  let invalidModelValueCount = 0;
  let nonfiniteRuntimeInputCount = 0;
  let nonfiniteModelInputCount = 0;
  let nonfiniteIntermediateCount = 0;
  let nonfiniteOutputCount = 0;

  const suppliedContextFingerprint = context
    ? fingerprintRecommendationFeatureReadinessInput(context.readinessInput)
    : undefined;
  const actualContextFingerprint = context
    ? fingerprintRecommendationFeatureReadinessInput({
        compiledContract: context.readinessInput.compiledContract,
        domain: artifact.domain,
        user: {
          features: userFeatures,
          resolutionStatus: context.readinessInput.user.resolutionStatus,
        },
        itemRows: candidates,
        artifact: buildFeatureReadinessArtifactInput(artifact),
      })
    : undefined;
  const contextMatches =
    context !== undefined &&
    context.featureReadiness.domain === artifact.domain &&
    context.readinessInput.domain === artifact.domain &&
    context.featureReadiness.user.resolutionStatus ===
      context.readinessInput.user.resolutionStatus &&
    context.featureReadiness.inputFingerprint === suppliedContextFingerprint &&
    suppliedContextFingerprint === actualContextFingerprint;
  if (!context) reasons.add('FEATURE_CONTEXT_UNAVAILABLE');
  if (context && !contextMatches) {
    reasons.add('FEATURE_CONTEXT_MISMATCH');
    fatalFeatureIssue = true;
  }

  const recordIssue = (input: {
    key: IssueKey;
    side: 'user' | 'item';
    token: string;
    candidateKey?: string;
    groupId: string | null;
    criticality: FeatureCriticality | null;
  }): void => {
    const issueCode = issueCodeByKey[input.key];
    uniqueByIssue
      .get(input.key)!
      .add(uniqueIssueIdentity(input.side, input.token));
    recordFeatureReadinessIssue(sampleCollector, {
      domain: artifact.domain,
      side: input.side,
      groupId: input.groupId,
      issueCode,
      tokenHash: hashFeatureReadinessToken(input.token),
      candidateKeyHash:
        input.candidateKey === undefined
          ? undefined
          : hashFeatureReadinessCandidateKey(input.candidateKey),
      criticality: input.criticality,
      source: 'runtime',
    });
  };

  const preflightRow = (
    side: 'user' | 'item',
    features: WeightedFeature[],
    artifactNames: ReadonlySet<string>,
    candidateKey?: string,
  ): number => {
    let resolvedCriticalOccurrenceCount = 0;
    for (const [token, weight] of features) {
      if (!Number.isFinite(weight)) {
        nonfiniteRuntimeInputCount += 1;
        reasons.add('NONFINITE_RUNTIME_INPUT');
        reasons.add('INVALID_RUNTIME_FEATURE_WEIGHT');
        fatalFeatureIssue = true;
        const structural = contextMatches
          ? classifyRuntimeFeatureForScorer({
              compiledContract: context!.readinessInput.compiledContract,
              domain: artifact.domain,
              side,
              token,
              artifactFeatureNames: artifactNames,
            })
          : undefined;
        recordIssue({
          key: 'invalidWeight',
          side,
          token,
          candidateKey,
          groupId: structural?.groupId ?? null,
          criticality: structural?.criticality ?? null,
        });
        continue;
      }

      if (!contextMatches) {
        if (!artifactNames.has(token)) {
          recordIssue({
            key: 'missing',
            side,
            token,
            candidateKey,
            groupId: null,
            criticality: null,
          });
        }
        continue;
      }

      const classified = classifyRuntimeFeatureForScorer({
        compiledContract: context!.readinessInput.compiledContract,
        domain: artifact.domain,
        side,
        token,
        weight,
        artifactFeatureNames: artifactNames,
      });

      if (classified.state === 'RESOLVED') {
        if (classified.criticality === 'CRITICAL') {
          resolvedCriticalOccurrenceCount += 1;
        }
        continue;
      }

      if (classified.state === 'MISSING_FROM_ARTIFACT') {
        recordIssue({
          key: 'missing',
          side,
          token,
          candidateKey,
          groupId: classified.groupId,
          criticality: classified.criticality,
        });
        const key =
          classified.criticality === 'CRITICAL'
            ? 'missingCritical'
            : 'missingOptional';
        recordIssue({
          key,
          side,
          token,
          candidateKey,
          groupId: classified.groupId,
          criticality: classified.criticality,
        });
        if (classified.criticality === 'CRITICAL') {
          reasons.add('MISSING_CRITICAL_FEATURE');
          fatalFeatureIssue = true;
        }
        continue;
      }

      const issue = {
        side,
        token,
        candidateKey,
        groupId: classified.groupId,
        criticality: classified.criticality,
      };
      if (classified.state === 'UNKNOWN_RUNTIME_FEATURE') {
        recordIssue({ key: 'unknown', ...issue });
        reasons.add('UNKNOWN_RUNTIME_FEATURE');
      } else if (classified.state === 'UNSUPPORTED_RUNTIME_FEATURE') {
        recordIssue({ key: 'unsupported', ...issue });
        reasons.add('UNSUPPORTED_RUNTIME_FEATURE');
      } else if (classified.state === 'NONPORTABLE_RUNTIME_FEATURE') {
        recordIssue({ key: 'nonportable', ...issue });
        reasons.add('NONPORTABLE_RUNTIME_FEATURE');
      } else if (classified.state === 'INVALID_RUNTIME_FEATURE_VALUE') {
        recordIssue({ key: 'invalidValue', ...issue });
        reasons.add('INVALID_RUNTIME_FEATURE_VALUE');
      } else {
        recordIssue({ key: 'invalidWeight', ...issue });
        reasons.add('INVALID_RUNTIME_FEATURE_WEIGHT');
      }
      fatalFeatureIssue = true;
    }
    return resolvedCriticalOccurrenceCount;
  };

  const userResolvedCritical = preflightRow(
    'user',
    userFeatures,
    userArtifactNames,
  );
  const itemResolvedCritical = candidates.map((candidate) =>
    preflightRow(
      'item',
      candidate.features,
      itemArtifactNames,
      candidate.candidateKey,
    ),
  );

  if (contextMatches) {
    const criticalGroups = Object.values(context!.featureReadiness.groups).filter(
      (group) => group.criticality === 'CRITICAL',
    );
    if (
      criticalGroups.some(
        (group) =>
          group.cardinalityStatus === 'MISSING_REQUIRED' ||
          group.missingRequiredCandidateCount > 0,
      )
    ) {
      reasons.add('MISSING_REQUIRED_GROUP');
      fatalFeatureIssue = true;
    }
    if (
      userResolvedCritical === 0 ||
      candidates.length === 0 ||
      itemResolvedCritical.some((count) => count === 0)
    ) {
      reasons.add('EMPTY_CRITICAL_REPRESENTATION');
      fatalFeatureIssue = true;
    }
  }

  const finalizedSamples = (): ReturnType<
    typeof finalizeFeatureReadinessSamples
  > => finalizeFeatureReadinessSamples(sampleCollector);

  const diagnostics = (): LightFmScorerDiagnostics => {
    const finalized = finalizedSamples();
    const summary = (key: IssueKey): LightFmFeatureIssueSummary => {
      const code = issueCodeByKey[key];
      const bucket = finalized.samples[code];
      return {
        occurrenceCount: finalized.issueTotals[code] ?? 0,
        uniqueCount: uniqueByIssue.get(key)!.size,
        sample: bucket?.sample ?? [],
        sampleLimit: FEATURE_READINESS_SAMPLE_LIMIT,
        truncated: bucket?.truncated ?? false,
      };
    };
    return {
      missing: summary('missing'),
      missingCritical: summary('missingCritical'),
      missingOptional: summary('missingOptional'),
      unknown: summary('unknown'),
      unsupported: summary('unsupported'),
      nonportable: summary('nonportable'),
      invalidValue: summary('invalidValue'),
      invalidWeight: summary('invalidWeight'),
      invalidModelValueCount,
      nonfiniteRuntimeInputCount,
      nonfiniteModelInputCount,
      nonfiniteIntermediateCount,
      nonfiniteOutputCount,
      groups: contextMatches ? context!.featureReadiness.groups : {},
    };
  };

  const failClosed = (): LightFmScorerResult => ({
    schemaVersion: LIGHTFM_SCORER_RESULT_SCHEMA_VERSION,
    outcome: 'FAILED_CLOSED',
    scoringReadiness: 'NOT_READY',
    reasonCodes: [...reasons].sort(scoreReasonCompare),
    scored: [],
    diagnostics: diagnostics(),
  });

  if (fatalFeatureIssue) return failClosed();

  const representation = (
    features: WeightedFeature[],
    lookup: ReadonlyMap<string, PortableFeature>,
  ):
    | { ok: true; embedding: number[]; bias: number }
    | { ok: false } => {
    const embedding = Array<number>(artifact.latent_dimension).fill(0);
    let bias = 0;

    for (const [name, weight] of features) {
      const entry = lookup.get(name);
      if (!entry) continue;

      const parsedBias = parseModelValue(entry.bias);
      if (!parsedBias.ok) {
        if (parsedBias.nonfinite) {
          nonfiniteModelInputCount += 1;
          reasons.add('NONFINITE_MODEL_INPUT');
        } else {
          invalidModelValueCount += 1;
          reasons.add('INVALID_MODEL_VALUE');
        }
        return { ok: false };
      }
      const biasContribution = parsedBias.value * weight;
      const nextBias = bias + biasContribution;
      if (!Number.isFinite(biasContribution) || !Number.isFinite(nextBias)) {
        nonfiniteIntermediateCount += 1;
        reasons.add('NONFINITE_INTERMEDIATE');
        return { ok: false };
      }
      bias = nextBias;

      for (let index = 0; index < artifact.latent_dimension; index += 1) {
        const parsedCoordinate = parseModelValue(entry.embedding[index]);
        if (!parsedCoordinate.ok) {
          if (parsedCoordinate.nonfinite) {
            nonfiniteModelInputCount += 1;
            reasons.add('NONFINITE_MODEL_INPUT');
          } else {
            invalidModelValueCount += 1;
            reasons.add('INVALID_MODEL_VALUE');
          }
          return { ok: false };
        }
        const contribution = parsedCoordinate.value * weight;
        const nextCoordinate = embedding[index]! + contribution;
        if (!Number.isFinite(contribution) || !Number.isFinite(nextCoordinate)) {
          nonfiniteIntermediateCount += 1;
          reasons.add('NONFINITE_INTERMEDIATE');
          return { ok: false };
        }
        embedding[index] = nextCoordinate;
      }
    }

    return { ok: true, embedding, bias };
  };

  if (!Number.isInteger(artifact.latent_dimension) || artifact.latent_dimension <= 0) {
    invalidModelValueCount += 1;
    reasons.add('INVALID_MODEL_VALUE');
    return failClosed();
  }

  const user = representation(userFeatures, userLookup);
  if (!user.ok) return failClosed();

  const scored: ScoredCandidate[] = [];
  for (const candidate of candidates) {
    const item = representation(candidate.features, itemLookup);
    if (!item.ok) return failClosed();

    let score = user.bias + item.bias;
    if (!Number.isFinite(score)) {
      nonfiniteOutputCount += 1;
      reasons.add('NONFINITE_OUTPUT');
      return failClosed();
    }
    for (let index = 0; index < artifact.latent_dimension; index += 1) {
      const product = user.embedding[index]! * item.embedding[index]!;
      const nextScore = score + product;
      if (!Number.isFinite(product) || !Number.isFinite(nextScore)) {
        nonfiniteOutputCount += 1;
        reasons.add('NONFINITE_OUTPUT');
        return failClosed();
      }
      score = nextScore;
    }
    scored.push({ candidateKey: candidate.candidateKey, score });
  }

  scored.sort(
    (left, right) =>
      right.score - left.score ||
      left.candidateKey.localeCompare(right.candidateKey),
  );

  const scoringReadiness: 'READY' | 'NOT_READY' =
    contextMatches &&
    context!.featureReadiness.coverageStatus === 'READY' &&
    reasons.size === 0
      ? 'READY'
      : 'NOT_READY';

  return {
    schemaVersion: LIGHTFM_SCORER_RESULT_SCHEMA_VERSION,
    outcome: 'SCORED',
    scoringReadiness,
    reasonCodes: [...reasons].sort(scoreReasonCompare),
    scored,
    diagnostics: diagnostics(),
  };
};

export const normalizeScores = (scores: ScoredCandidate[]) => {
  const values = scores.map((value) => value.score);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  return new Map(
    scores.map((value) => [
      value.candidateKey,
      maximum > minimum ? (value.score - minimum) / (maximum - minimum) : 0,
    ]),
  );
};

export const combineNormalizedScores = (
  longTerm: ScoredCandidate[],
  recent: Map<string, number>,
  blend = 0.35,
) => {
  const normalized = normalizeScores(longTerm);

  return longTerm
    .map(({ candidateKey }) => ({
      candidateKey,
      score:
        (1 - blend) * (normalized.get(candidateKey) ?? 0) +
        blend * (recent.get(candidateKey) ?? 0),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || a.candidateKey.localeCompare(b.candidateKey),
    );
};

export type LocalMlDomain = 'material' | 'project';

export type LocalMlCandidate = {
  candidateKey: string;
  features: readonly WeightedFeature[];
};

export type LocalMlScoringInput = {
  domain: LocalMlDomain;
  userFeatures: readonly WeightedFeature[];
  candidates: readonly LocalMlCandidate[];
};

export type LocalMlScorerUnavailableReason =
  | 'DOMAIN_MISMATCH'
  | 'INVALID_CANDIDATE_KEY'
  | 'DUPLICATE_CANDIDATE_CONFLICT'
  | 'DUPLICATE_FEATURE_CONFLICT'
  | 'CANDIDATE_MAPPING_MISSING'
  | 'FEATURE_MAPPING_MISSING'
  | 'INVALID_RUNTIME_FEATURE_WEIGHT'
  | 'NONFINITE_RUNTIME_INPUT'
  | 'NONFINITE_INTERMEDIATE'
  | 'NONFINITE_OUTPUT';

export type LocalMlScorerDiagnostics = Readonly<{
  candidateCount: number;
  duplicateCandidateCount: number;
  scoredCount: number;
  missingMappingCount: number;
  missingMappingKeySamples: readonly string[];
  featureMappingMissingCount: number;
}>;

export type LocalMlContainedScoringResult =
  | Readonly<{
      outcome: 'SCORED';
      domain: LocalMlDomain;
      scored: readonly Readonly<ScoredCandidate>[];
      rankedCandidateKeys: readonly string[];
      diagnostics: LocalMlScorerDiagnostics;
    }>
  | Readonly<{
      outcome: 'UNAVAILABLE';
      domain: LocalMlDomain;
      reasonCode: LocalMlScorerUnavailableReason;
      diagnostics: LocalMlScorerDiagnostics;
    }>;

export type PortableLightFmV2ScorerMetadata = Readonly<{
  domain: LocalMlDomain;
  semanticContentHash: string;
  schemaVersion: string;
  modelVersion: string;
  featureContractId: string;
  featureContractVersion: string;
  aggregationMode: string;
  taxonomyFingerprint: string;
  itemCount: number;
}>;

export type PortableLightFmV2Scorer = Readonly<{
  domain: LocalMlDomain;
  metadata: PortableLightFmV2ScorerMetadata;
  score: (input: LocalMlScoringInput) => LocalMlContainedScoringResult;
}>;

const asciiCompare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const emptyLocalDiagnostics = (
  candidateCount: number,
): LocalMlScorerDiagnostics =>
  Object.freeze({
    candidateCount,
    duplicateCandidateCount: 0,
    scoredCount: 0,
    missingMappingCount: 0,
    missingMappingKeySamples: Object.freeze([] as string[]),
    featureMappingMissingCount: 0,
  });

const freezeLocalDiagnostics = (
  diagnostics: Omit<LocalMlScorerDiagnostics, 'missingMappingKeySamples'> & {
    missingMappingKeySamples: readonly string[];
  },
): LocalMlScorerDiagnostics =>
  Object.freeze({
    ...diagnostics,
    missingMappingKeySamples: Object.freeze([
      ...diagnostics.missingMappingKeySamples,
    ]),
  });

type CanonicalFeatureRow =
  | { ok: true; features: readonly WeightedFeature[] }
  | {
      ok: false;
      reasonCode:
        | 'DUPLICATE_FEATURE_CONFLICT'
        | 'INVALID_RUNTIME_FEATURE_WEIGHT'
        | 'NONFINITE_RUNTIME_INPUT';
    };

const canonicalizeLocalFeatureRow = (
  features: readonly WeightedFeature[],
): CanonicalFeatureRow => {
  const byToken = new Map<string, number>();
  for (const feature of features) {
    if (
      !Array.isArray(feature) ||
      typeof feature[0] !== 'string' ||
      feature[0].length === 0 ||
      !Number.isFinite(feature[1])
    ) {
      return { ok: false, reasonCode: 'NONFINITE_RUNTIME_INPUT' };
    }
    if (feature[1] < 0) {
      return { ok: false, reasonCode: 'INVALID_RUNTIME_FEATURE_WEIGHT' };
    }
    const prior = byToken.get(feature[0]);
    if (prior !== undefined && prior !== feature[1]) {
      return { ok: false, reasonCode: 'DUPLICATE_FEATURE_CONFLICT' };
    }
    byToken.set(feature[0], feature[1]);
  }
  return {
    ok: true,
    features: Object.freeze(
      [...byToken]
        .sort(([left], [right]) => asciiCompare(left, right))
        .map(([token, weight]) => Object.freeze([token, weight]) as WeightedFeature),
    ),
  };
};

const numericMatrix = (
  values: readonly (readonly string[])[],
): readonly (readonly number[])[] =>
  Object.freeze(
    values.map((row) =>
      Object.freeze(
        row.map((value) => {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) throw new Error('nonfinite_model_value');
          return parsed;
        }),
      ),
    ),
  );

const numericVector = (values: readonly string[]): readonly number[] =>
  Object.freeze(
    values.map((value) => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error('nonfinite_model_value');
      return parsed;
    }),
  );

export const buildPortableLightFmV2Scorer = (
  artifact: PortableModelArtifactV2,
): PortableLightFmV2Scorer => {
  if (artifact.aggregationMode !== 'weighted-sum') {
    throw new Error('unsupported_aggregation_mode');
  }

  const dimension = artifact.modelDimensions.embeddingDimension;
  const userEmbeddings = numericMatrix(
    artifact.modelComponents.userFeatureEmbeddings,
  );
  const itemEmbeddings = numericMatrix(
    artifact.modelComponents.itemFeatureEmbeddings,
  );
  const userBiases = numericVector(artifact.modelComponents.userFeatureBiases);
  const itemBiases = numericVector(artifact.modelComponents.itemFeatureBiases);
  const userFeatureIndex = new Map(
    artifact.featureMapping.user.map((entry) => [entry.token, entry.index]),
  );
  const itemFeatureIndex = new Map(
    artifact.featureMapping.item.map((entry) => [entry.token, entry.index]),
  );
  const itemKeys = new Set(artifact.itemMapping.map((entry) => entry.itemKey));

  const metadata: PortableLightFmV2ScorerMetadata = Object.freeze({
    domain: artifact.domain,
    semanticContentHash: artifact.semanticContentHash,
    schemaVersion: artifact.schemaVersion,
    modelVersion: artifact.modelVersion,
    featureContractId: artifact.featureContractId,
    featureContractVersion: artifact.featureContractVersion,
    aggregationMode: artifact.aggregationMode,
    taxonomyFingerprint: artifact.taxonomyFingerprint,
    itemCount: artifact.itemMapping.length,
  });

  const unavailable = (
    input: LocalMlScoringInput,
    reasonCode: LocalMlScorerUnavailableReason,
    diagnostics = emptyLocalDiagnostics(input.candidates.length),
  ): LocalMlContainedScoringResult =>
    Object.freeze({
      outcome: 'UNAVAILABLE' as const,
      domain: input.domain,
      reasonCode,
      diagnostics,
    });

  const representation = (
    features: readonly WeightedFeature[],
    featureIndex: ReadonlyMap<string, number>,
    embeddings: readonly (readonly number[])[],
    biases: readonly number[],
  ):
    | { ok: true; embedding: number[]; bias: number }
    | { ok: false; reasonCode: LocalMlScorerUnavailableReason } => {
    const embedding = Array<number>(dimension).fill(0);
    let bias = 0;
    for (const [token, weight] of features) {
      const rowIndex = featureIndex.get(token);
      if (rowIndex === undefined) {
        return { ok: false, reasonCode: 'FEATURE_MAPPING_MISSING' };
      }
      const biasContribution = biases[rowIndex]! * weight;
      const nextBias = bias + biasContribution;
      if (!Number.isFinite(biasContribution) || !Number.isFinite(nextBias)) {
        return { ok: false, reasonCode: 'NONFINITE_INTERMEDIATE' };
      }
      bias = nextBias;
      for (let coordinate = 0; coordinate < dimension; coordinate += 1) {
        const contribution = embeddings[rowIndex]![coordinate]! * weight;
        const nextCoordinate = embedding[coordinate]! + contribution;
        if (!Number.isFinite(contribution) || !Number.isFinite(nextCoordinate)) {
          return { ok: false, reasonCode: 'NONFINITE_INTERMEDIATE' };
        }
        embedding[coordinate] = nextCoordinate;
      }
    }
    return { ok: true, embedding, bias };
  };

  const score = (input: LocalMlScoringInput): LocalMlContainedScoringResult => {
    if (input.domain !== artifact.domain) {
      return unavailable(input, 'DOMAIN_MISMATCH');
    }

    const userRow = canonicalizeLocalFeatureRow(input.userFeatures);
    if (!userRow.ok) return unavailable(input, userRow.reasonCode);

    const candidates = new Map<
      string,
      { features: readonly WeightedFeature[]; signature: string }
    >();
    let duplicateCandidateCount = 0;
    for (const candidate of input.candidates) {
      if (typeof candidate.candidateKey !== 'string' || candidate.candidateKey.length === 0) {
        return unavailable(input, 'INVALID_CANDIDATE_KEY');
      }
      const row = canonicalizeLocalFeatureRow(candidate.features);
      if (!row.ok) return unavailable(input, row.reasonCode);
      const signature = JSON.stringify(row.features);
      const prior = candidates.get(candidate.candidateKey);
      if (prior) {
        if (prior.signature !== signature) {
          return unavailable(input, 'DUPLICATE_CANDIDATE_CONFLICT');
        }
        duplicateCandidateCount += 1;
        continue;
      }
      candidates.set(candidate.candidateKey, {
        features: row.features,
        signature,
      });
    }

    const missingOpaqueKeys = [...candidates.keys()]
      .map((candidateKey) => stableOpaqueKey(artifact.domain, candidateKey))
      .filter((itemKey) => !itemKeys.has(itemKey))
      .sort(asciiCompare);
    if (missingOpaqueKeys.length > 0) {
      return unavailable(
        input,
        'CANDIDATE_MAPPING_MISSING',
        freezeLocalDiagnostics({
          candidateCount: input.candidates.length,
          duplicateCandidateCount,
          scoredCount: 0,
          missingMappingCount: missingOpaqueKeys.length,
          missingMappingKeySamples: missingOpaqueKeys.slice(0, 8),
          featureMappingMissingCount: 0,
        }),
      );
    }

    const user = representation(
      userRow.features,
      userFeatureIndex,
      userEmbeddings,
      userBiases,
    );
    if (!user.ok) {
      return unavailable(
        input,
        user.reasonCode,
        freezeLocalDiagnostics({
          candidateCount: input.candidates.length,
          duplicateCandidateCount,
          scoredCount: 0,
          missingMappingCount: 0,
          missingMappingKeySamples: [],
          featureMappingMissingCount:
            user.reasonCode === 'FEATURE_MAPPING_MISSING' ? 1 : 0,
        }),
      );
    }

    const scored: ScoredCandidate[] = [];
    for (const [candidateKey, candidate] of candidates) {
      const item = representation(
        candidate.features,
        itemFeatureIndex,
        itemEmbeddings,
        itemBiases,
      );
      if (!item.ok) {
        return unavailable(
          input,
          item.reasonCode,
          freezeLocalDiagnostics({
            candidateCount: input.candidates.length,
            duplicateCandidateCount,
            scoredCount: 0,
            missingMappingCount: 0,
            missingMappingKeySamples: [],
            featureMappingMissingCount:
              item.reasonCode === 'FEATURE_MAPPING_MISSING' ? 1 : 0,
          }),
        );
      }
      let value = user.bias + item.bias;
      if (!Number.isFinite(value)) return unavailable(input, 'NONFINITE_OUTPUT');
      for (let coordinate = 0; coordinate < dimension; coordinate += 1) {
        const product = user.embedding[coordinate]! * item.embedding[coordinate]!;
        const next = value + product;
        if (!Number.isFinite(product) || !Number.isFinite(next)) {
          return unavailable(input, 'NONFINITE_OUTPUT');
        }
        value = next;
      }
      scored.push(Object.freeze({ candidateKey, score: value }));
    }

    scored.sort(
      (left, right) =>
        right.score - left.score || asciiCompare(left.candidateKey, right.candidateKey),
    );
    const frozenScored = Object.freeze([...scored]);
    const rankedCandidateKeys = Object.freeze(
      scored.map((candidate) => candidate.candidateKey),
    );
    return Object.freeze({
      outcome: 'SCORED' as const,
      domain: input.domain,
      scored: frozenScored,
      rankedCandidateKeys,
      diagnostics: freezeLocalDiagnostics({
        candidateCount: input.candidates.length,
        duplicateCandidateCount,
        scoredCount: scored.length,
        missingMappingCount: 0,
        missingMappingKeySamples: [],
        featureMappingMissingCount: 0,
      }),
    });
  };

  return Object.freeze({ domain: artifact.domain, metadata, score });
};
