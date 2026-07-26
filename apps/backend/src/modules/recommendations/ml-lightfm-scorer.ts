import type {
  PortableFeature,
  PortableModelArtifact,
} from './ml-model-artifact.js';
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
