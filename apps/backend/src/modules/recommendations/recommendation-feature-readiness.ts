import { createHash } from 'node:crypto';

import type { LearnerInterestResolutionStatus } from '../taxonomy/learner-interest-resolver.js';
import { TAXONOMY_CONCEPT_SEEDS } from '../taxonomy/taxonomy-foundation.data.js';
import { asciiCompare } from './canonical-shadow-user-features.js';
import type { PortableModelArtifact } from './ml-model-artifact.js';
import type { WeightedFeature } from './ml-lightfm-scorer.js';
import type {
  RecommendationFeatureDomain,
  RecommendationFeatureSide,
  RecommendationFeatureTokenContract,
} from './recommendation-feature-token-contract.js';
import { loadRecommendationFeatureTokenContract } from './recommendation-feature-token-contract.js';

export const FEATURE_READINESS_SAMPLE_LIMIT = 8;
export const FEATURE_READINESS_SCHEMA_VERSION =
  'recommendation-feature-readiness-v1' as const;

export type FeatureCriticality = 'CRITICAL' | 'OPTIONAL';

export type ArtifactFeatureClassification =
  | 'CONTRACT_VALID_ARTIFACT_FEATURE'
  | 'INVALID_ARTIFACT_FEATURE_VALUE'
  | 'UNSUPPORTED_ARTIFACT_FEATURE';

export type ReadinessReasonCode =
  | 'USER_NO_INTERESTS'
  | 'USER_PARTIALLY_MAPPED'
  | 'USER_UNMAPPED_INTERESTS'
  | 'USER_ZERO_ARTIFACT_OVERLAP'
  | 'USER_PARTIAL_ARTIFACT_OVERLAP'
  | 'USER_RUNTIME_REPRESENTATION_INVALID'
  | 'ARTIFACT_CONTRACT_ID_MISSING'
  | 'ARTIFACT_CONTRACT_ID_INCOMPATIBLE'
  | 'ARTIFACT_CONTRACT_VERSION_MISSING'
  | 'ARTIFACT_CONTRACT_VERSION_INCOMPATIBLE'
  | 'ARTIFACT_CONTRACT_FINGERPRINT_MISSING'
  | 'ARTIFACT_CONTRACT_FINGERPRINT_INCOMPATIBLE'
  | 'ARTIFACT_AGGREGATION_MODE_MISSING'
  | 'ARTIFACT_AGGREGATION_MODE_INCOMPATIBLE'
  | 'FEATURE_CONTRACT_RUNTIME_INACTIVE'
  | 'FEATURE_CONTRACT_AGGREGATION_NOT_SELECTED'
  | 'FEATURE_CONTRACT_PORTABLE_ACTIVATION_BLOCKED'
  | 'MISSING_CRITICAL_RUNTIME_GROUP'
  | 'MISSING_CRITICAL_ARTIFACT_FEATURE'
  | 'UNKNOWN_RUNTIME_FEATURE'
  | 'UNSUPPORTED_RUNTIME_FEATURE'
  | 'INVALID_RUNTIME_FEATURE_VALUE'
  | 'INVALID_RUNTIME_FEATURE_WEIGHT'
  | 'INVALID_ARTIFACT_FEATURE_VALUE'
  | 'UNSUPPORTED_ARTIFACT_FEATURE'
  | 'REQUIRED_ENUM_BOOLEAN_UNSUPPORTED'
  | 'INVALID_RUNTIME_CARDINALITY';

export type FeatureReadinessIssueCode =
  | 'SCORER_MISSING_FEATURE'
  | 'MISSING_CRITICAL_RUNTIME_GROUP'
  | 'MISSING_CRITICAL_ARTIFACT_FEATURE'
  | 'MISSING_OPTIONAL_ARTIFACT_FEATURE'
  | 'UNKNOWN_RUNTIME_FEATURE'
  | 'UNSUPPORTED_RUNTIME_FEATURE'
  | 'NONPORTABLE_RUNTIME_FEATURE'
  | 'INVALID_RUNTIME_FEATURE_VALUE'
  | 'INVALID_RUNTIME_FEATURE_WEIGHT'
  | 'INVALID_RUNTIME_CARDINALITY'
  | 'INVALID_ARTIFACT_FEATURE_VALUE'
  | 'UNSUPPORTED_ARTIFACT_FEATURE'
  | 'REQUIRED_ENUM_BOOLEAN_UNSUPPORTED'
  | 'ARTIFACT_FEATURE_NOT_CONSTRUCTED_IN_REQUEST'
  | 'ARTIFACT_CONTRACT_ID_MISSING'
  | 'ARTIFACT_CONTRACT_ID_INCOMPATIBLE'
  | 'ARTIFACT_CONTRACT_VERSION_MISSING'
  | 'ARTIFACT_CONTRACT_VERSION_INCOMPATIBLE'
  | 'ARTIFACT_CONTRACT_FINGERPRINT_MISSING'
  | 'ARTIFACT_CONTRACT_FINGERPRINT_INCOMPATIBLE'
  | 'ARTIFACT_AGGREGATION_MODE_MISSING'
  | 'ARTIFACT_AGGREGATION_MODE_INCOMPATIBLE';

export type BoundedSampleEntry = {
  domain: RecommendationFeatureDomain;
  side: RecommendationFeatureSide | 'artifact';
  groupId: string | null;
  issueCode: FeatureReadinessIssueCode;
  tokenHash: string;
  candidateKeyHash?: string;
  criticality: FeatureCriticality | null;
  source: 'runtime' | 'artifact';
};

export type BoundedSampleBucket = {
  total: number;
  sample: BoundedSampleEntry[];
  sampleLimit: number;
  truncated: boolean;
};

export type UserReadinessStatus = 'PASS' | 'NOT_READY';

export type GroupCoverageSnapshot = {
  criticality: FeatureCriticality;
  side: RecommendationFeatureSide;
  constructedUnique: number;
  resolvedUnique: number;
  missingUnique: number;
  cardinalityStatus: 'OK' | 'MISSING_REQUIRED' | 'EXCEEDED_MAXIMUM';
  candidateCount: number;
  missingRequiredCandidateCount: number;
  exceededMaximumCandidateCount: number;
  invalidValueCandidateCount: number;
  invalidWeightCandidateCount: number;
};

export type RecommendationFeatureReadiness = {
  schemaVersion: typeof FEATURE_READINESS_SCHEMA_VERSION;
  /** Privacy-safe binding to the exact contract, artifact, and runtime rows evaluated. */
  inputFingerprint: string;
  domain: RecommendationFeatureDomain;
  /** Fail-closed overall readiness, including contract activation gate. */
  status: 'READY' | 'NOT_READY';
  /** Feature coverage only; may be READY while overall status remains NOT_READY. */
  coverageStatus: 'READY' | 'NOT_READY';
  reasons: ReadinessReasonCode[];
  user: {
    resolutionStatus: LearnerInterestResolutionStatus;
    readinessStatus: UserReadinessStatus;
    constructedOccurrenceCount: number;
    constructedUniqueCount: number;
    artifactResolvedOccurrenceCount: number;
    artifactResolvedUniqueCount: number;
    missingCriticalOccurrenceCount: number;
    missingCriticalUniqueCount: number;
    unknownOccurrenceCount: number;
    unsupportedOccurrenceCount: number;
    invalidValueOccurrenceCount: number;
    invalidWeightOccurrenceCount: number;
  };
  items: {
    candidateCount: number;
    affectedCandidateCount: number;
    constructedOccurrenceCount: number;
    constructedUniqueCount: number;
    artifactResolvedOccurrenceCount: number;
    artifactResolvedUniqueCount: number;
    missingCriticalOccurrenceCount: number;
    missingCriticalUniqueCount: number;
    missingOptionalOccurrenceCount: number;
    missingOptionalUniqueCount: number;
    unknownOccurrenceCount: number;
    unsupportedOccurrenceCount: number;
    invalidValueOccurrenceCount: number;
    invalidWeightOccurrenceCount: number;
    invalidCardinalityCandidateCount: number;
  };
  artifact: {
    modelVersion: string;
    featureSchemaVersion: string;
    featureContractId: string | null;
    featureContractVersion: string | null;
    featureContractFingerprint: string | null;
    featureAggregationMode: string | null;
    expectedContractId: string;
    expectedContractVersion: string;
    expectedTaxonomyFingerprint: string;
    expectedAggregationMode: string | null;
    contractVersionCompatible: boolean;
    aggregationModeCompatible: boolean;
    expectedCriticalEnumBooleanCount: number;
    presentCriticalEnumBooleanCount: number;
    missingCriticalEnumBooleanCount: number;
    contractValidArtifactFeatureCount: number;
    contractInvalidArtifactFeatureCount: number;
    unsupportedArtifactFeatureCount: number;
    artifactFeatureNotConstructedInRequestCount: number;
  };
  groups: Record<string, GroupCoverageSnapshot>;
  issueTotals: Partial<Record<FeatureReadinessIssueCode, number>>;
  samples: Partial<Record<FeatureReadinessIssueCode, BoundedSampleBucket>>;
};

type NamespaceKind = 'taxonomy' | 'closed';

type CompiledNamespace = {
  id: string;
  kind: NamespaceKind;
  conceptType: string | null;
  pattern: RegExp;
  /** Exact closed values or exact foundation taxonomy tokens for this namespace. */
  membership: ReadonlySet<string>;
};

type CompiledGroup = {
  id: string;
  side: RecommendationFeatureSide;
  domains: readonly RecommendationFeatureDomain[];
  namespaceId: string;
  criticality: FeatureCriticality;
  minimum: number | null;
  maximum: number | null;
  baseWeight: number;
  portableRuntimeEligible: true;
};

export type CompiledRecommendationFeatureReadinessContract = {
  expectedContractId: string;
  expectedContractVersion: string;
  expectedTaxonomyFingerprint: string;
  lifecycle: RecommendationFeatureTokenContract['status']['lifecycle'];
  runtimeActivation: RecommendationFeatureTokenContract['status']['runtimeActivation'];
  aggregationBlocked: boolean;
  aggregationStatus: RecommendationFeatureTokenContract['aggregation']['status'];
  aggregationSelectedMode: RecommendationFeatureTokenContract['aggregation']['selectedMode'];
  portableActivationAllowed: boolean;
  rejectedTokenPrefixes: readonly string[];
  namespaces: readonly CompiledNamespace[];
  groups: readonly CompiledGroup[];
  groupOrder: readonly string[];
  criticalClosedTokensByDomain: ReadonlyMap<
    RecommendationFeatureDomain,
    ReadonlySet<string>
  >;
};

export type FeatureReadinessArtifactInput = {
  artifactIdentity?: string | null;
  modelVersion: string;
  featureSchemaVersion: string;
  feature_contract_id?: string | null;
  feature_contract_version?: string | null;
  feature_contract_fingerprint?: string | null;
  feature_aggregation_mode?: string | null;
  userFeatureNames: ReadonlySet<string> | readonly string[];
  itemFeatureNames: ReadonlySet<string> | readonly string[];
};

export type FeatureReadinessEvaluateInput = {
  compiledContract: CompiledRecommendationFeatureReadinessContract;
  domain: RecommendationFeatureDomain;
  user: {
    features: readonly WeightedFeature[];
    resolutionStatus: LearnerInterestResolutionStatus;
  };
  itemRows: ReadonlyArray<{
    candidateKey: string;
    features: readonly WeightedFeature[];
  }>;
  artifact: FeatureReadinessArtifactInput;
};

export const hashFeatureReadinessToken = (exactToken: string): string =>
  createHash('sha256')
    .update(`recommendation-feature-readiness-token-v1:${exactToken}`)
    .digest('hex');

export const hashFeatureReadinessCandidateKey = (
  candidateKey: string,
): string =>
  createHash('sha256')
    .update(`recommendation-feature-readiness-candidate-v1:${candidateKey}`)
    .digest('hex');

const artifactStringMetadata = (
  artifact: PortableModelArtifact,
  key:
    | 'feature_contract_id'
    | 'feature_contract_version'
    | 'feature_contract_fingerprint'
    | 'feature_aggregation_mode',
): string | null => {
  const value = (artifact as PortableModelArtifact & Record<string, unknown>)[
    key
  ];
  return typeof value === 'string' ? value : null;
};

export const buildFeatureReadinessArtifactInput = (
  artifact: PortableModelArtifact,
): FeatureReadinessArtifactInput => ({
  artifactIdentity: artifact.content_hash,
  modelVersion: artifact.model_version,
  featureSchemaVersion: artifact.feature_schema_version,
  feature_contract_id: artifactStringMetadata(artifact, 'feature_contract_id'),
  feature_contract_version: artifactStringMetadata(
    artifact,
    'feature_contract_version',
  ),
  feature_contract_fingerprint: artifactStringMetadata(
    artifact,
    'feature_contract_fingerprint',
  ),
  feature_aggregation_mode: artifactStringMetadata(
    artifact,
    'feature_aggregation_mode',
  ),
  userFeatureNames: artifact.user_features.map((entry) => entry.name),
  itemFeatureNames: artifact.item_features.map((entry) => entry.name),
});

const toNameSet = (
  names: ReadonlySet<string> | readonly string[],
): ReadonlySet<string> =>
  names instanceof Set ? names : new Set(names);

const fingerprintNumber = (value: number): string => {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Number.POSITIVE_INFINITY) return '+Infinity';
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  if (Object.is(value, -0)) return '-0';
  return String(value);
};

const fingerprintFeatures = (features: readonly WeightedFeature[]) =>
  features.map(([token, weight]) => [token, fingerprintNumber(weight)]);

export const fingerprintRecommendationFeatureReadinessInput = (
  input: FeatureReadinessEvaluateInput,
): string => {
  const { compiledContract, artifact } = input;
  const contractIdentity = {
    expectedContractId: compiledContract.expectedContractId,
    expectedContractVersion: compiledContract.expectedContractVersion,
    expectedTaxonomyFingerprint:
      compiledContract.expectedTaxonomyFingerprint,
    lifecycle: compiledContract.lifecycle,
    runtimeActivation: compiledContract.runtimeActivation,
    aggregationBlocked: compiledContract.aggregationBlocked,
    aggregationStatus: compiledContract.aggregationStatus,
    aggregationSelectedMode: compiledContract.aggregationSelectedMode,
    portableActivationAllowed: compiledContract.portableActivationAllowed,
    rejectedTokenPrefixes: [...compiledContract.rejectedTokenPrefixes],
    namespaces: compiledContract.namespaces.map((namespace) => ({
      id: namespace.id,
      kind: namespace.kind,
      conceptType: namespace.conceptType,
      pattern: namespace.pattern.source,
      membership: [...namespace.membership].sort(asciiCompare),
    })),
    groups: compiledContract.groups.map((group) => ({
      id: group.id,
      side: group.side,
      domains: [...group.domains],
      namespaceId: group.namespaceId,
      criticality: group.criticality,
      minimum: group.minimum,
      maximum: group.maximum,
      baseWeight: fingerprintNumber(group.baseWeight),
      portableRuntimeEligible: group.portableRuntimeEligible,
    })),
    groupOrder: [...compiledContract.groupOrder],
    criticalClosedTokensByDomain: [...compiledContract.criticalClosedTokensByDomain]
      .sort(([left], [right]) => asciiCompare(left, right))
      .map(([domain, tokens]) => [domain, [...tokens].sort(asciiCompare)]),
  };
  const fingerprintPayload = {
    contract: contractIdentity,
    domain: input.domain,
    user: {
      resolutionStatus: input.user.resolutionStatus,
      features: fingerprintFeatures(input.user.features),
    },
    itemRows: input.itemRows.map((row) => ({
      candidateKey: row.candidateKey,
      features: fingerprintFeatures(row.features),
    })),
    artifact: {
      artifactIdentity: artifact.artifactIdentity ?? null,
      modelVersion: artifact.modelVersion,
      featureSchemaVersion: artifact.featureSchemaVersion,
      featureContractId: artifact.feature_contract_id ?? null,
      featureContractVersion: artifact.feature_contract_version ?? null,
      featureContractFingerprint:
        artifact.feature_contract_fingerprint ?? null,
      featureAggregationMode: artifact.feature_aggregation_mode ?? null,
      userFeatureNames: [...toNameSet(artifact.userFeatureNames)].sort(
        asciiCompare,
      ),
      itemFeatureNames: [...toNameSet(artifact.itemFeatureNames)].sort(
        asciiCompare,
      ),
    },
  };
  return createHash('sha256')
    .update('recommendation-feature-readiness-input-v1:')
    .update(JSON.stringify(fingerprintPayload))
    .digest('hex');
};

const groupsFor = (
  compiled: CompiledRecommendationFeatureReadinessContract,
  domain: RecommendationFeatureDomain,
  side: RecommendationFeatureSide,
): CompiledGroup[] =>
  compiled.groups.filter(
    (group) => group.side === side && group.domains.includes(domain),
  );

const findRejectedPrefix = (
  compiled: CompiledRecommendationFeatureReadinessContract,
  token: string,
): string | undefined =>
  compiled.rejectedTokenPrefixes.find((prefix) => token.startsWith(prefix));

const findNamespace = (
  compiled: CompiledRecommendationFeatureReadinessContract,
  token: string,
): CompiledNamespace | undefined => {
  const byPrefix = compiled.namespaces.find((namespace) =>
    token.startsWith(`${namespace.id}:`),
  );
  if (byPrefix) return byPrefix;
  return compiled.namespaces.find((namespace) => namespace.pattern.test(token));
};

const findGroupForNamespace = (
  compiled: CompiledRecommendationFeatureReadinessContract,
  domain: RecommendationFeatureDomain,
  side: RecommendationFeatureSide,
  namespaceId: string,
): CompiledGroup | undefined =>
  groupsFor(compiled, domain, side).find(
    (group) => group.namespaceId === namespaceId,
  );

type StructuralTokenState =
  | 'STRUCTURALLY_VALID'
  | 'UNKNOWN_RUNTIME_FEATURE'
  | 'UNSUPPORTED_RUNTIME_FEATURE'
  | 'INVALID_RUNTIME_FEATURE_VALUE';

type StructuralClassification = {
  token: string;
  groupId: string | null;
  criticality: FeatureCriticality | null;
  group: CompiledGroup | null;
  state: StructuralTokenState;
};

const classifyTokenStructure = (input: {
  compiledContract: CompiledRecommendationFeatureReadinessContract;
  domain: RecommendationFeatureDomain;
  side: RecommendationFeatureSide;
  token: string;
}): StructuralClassification => {
  const { compiledContract, domain, side, token } = input;

  if (findRejectedPrefix(compiledContract, token)) {
    return {
      token,
      groupId: null,
      criticality: null,
      group: null,
      state: 'UNSUPPORTED_RUNTIME_FEATURE',
    };
  }

  const namespace = findNamespace(compiledContract, token);
  if (!namespace) {
    return {
      token,
      groupId: null,
      criticality: null,
      group: null,
      state: 'UNKNOWN_RUNTIME_FEATURE',
    };
  }

  const group = findGroupForNamespace(
    compiledContract,
    domain,
    side,
    namespace.id,
  );
  if (!group) {
    return {
      token,
      groupId: null,
      criticality: null,
      group: null,
      state: 'UNSUPPORTED_RUNTIME_FEATURE',
    };
  }

  if (!namespace.pattern.test(token)) {
    return {
      token,
      groupId: group.id,
      criticality: group.criticality,
      group,
      state: 'INVALID_RUNTIME_FEATURE_VALUE',
    };
  }

  if (!namespace.membership.has(token)) {
    // Closed invalid value, or taxonomy token absent from exact v3 foundation membership.
    return {
      token,
      groupId: group.id,
      criticality: group.criticality,
      group,
      state: 'INVALID_RUNTIME_FEATURE_VALUE',
    };
  }

  return {
    token,
    groupId: group.id,
    criticality: group.criticality,
    group,
    state: 'STRUCTURALLY_VALID',
  };
};

export const classifyRuntimeFeatureToken = (input: {
  compiledContract: CompiledRecommendationFeatureReadinessContract;
  domain: RecommendationFeatureDomain;
  side: RecommendationFeatureSide;
  token: string;
  weight?: number;
  artifactFeatureNames: ReadonlySet<string>;
}): {
  token: string;
  groupId: string | null;
  criticality: FeatureCriticality | null;
  state:
    | 'RESOLVED'
    | 'MISSING_FROM_ARTIFACT'
    | 'UNKNOWN_RUNTIME_FEATURE'
    | 'UNSUPPORTED_RUNTIME_FEATURE'
    | 'INVALID_RUNTIME_FEATURE_VALUE'
    | 'INVALID_RUNTIME_FEATURE_WEIGHT';
} => {
  const structural = classifyTokenStructure(input);
  if (structural.state !== 'STRUCTURALLY_VALID') {
    return {
      token: structural.token,
      groupId: structural.groupId,
      criticality: structural.criticality,
      state: structural.state,
    };
  }

  if (input.weight !== undefined) {
    const expected = structural.group!.baseWeight;
    if (
      !Number.isFinite(input.weight) ||
      input.weight !== expected
    ) {
      return {
        token: structural.token,
        groupId: structural.groupId,
        criticality: structural.criticality,
        state: 'INVALID_RUNTIME_FEATURE_WEIGHT',
      };
    }
  }

  if (input.artifactFeatureNames.has(input.token)) {
    return {
      token: structural.token,
      groupId: structural.groupId,
      criticality: structural.criticality,
      state: 'RESOLVED',
    };
  }
  return {
    token: structural.token,
    groupId: structural.groupId,
    criticality: structural.criticality,
    state: 'MISSING_FROM_ARTIFACT',
  };
};

/**
 * Scorer-only refinement of the RP-01.5 runtime classifier. The external
 * readiness contract intentionally continues to report rejected legacy
 * prefixes as unsupported, while the scorer exposes them as nonportable.
 */
export const classifyRuntimeFeatureForScorer = (input: {
  compiledContract: CompiledRecommendationFeatureReadinessContract;
  domain: RecommendationFeatureDomain;
  side: RecommendationFeatureSide;
  token: string;
  weight?: number;
  artifactFeatureNames: ReadonlySet<string>;
}):
  | ReturnType<typeof classifyRuntimeFeatureToken>
  | {
      token: string;
      groupId: null;
      criticality: null;
      state: 'NONPORTABLE_RUNTIME_FEATURE';
    } => {
  if (findRejectedPrefix(input.compiledContract, input.token)) {
    return {
      token: input.token,
      groupId: null,
      criticality: null,
      state: 'NONPORTABLE_RUNTIME_FEATURE',
    };
  }
  return classifyRuntimeFeatureToken(input);
};

export const classifyArtifactFeatureToken = (input: {
  compiledContract: CompiledRecommendationFeatureReadinessContract;
  domain: RecommendationFeatureDomain;
  side: RecommendationFeatureSide;
  token: string;
}): {
  token: string;
  groupId: string | null;
  criticality: FeatureCriticality | null;
  state: ArtifactFeatureClassification;
} => {
  const { compiledContract, domain, side, token } = input;

  if (findRejectedPrefix(compiledContract, token)) {
    return {
      token,
      groupId: null,
      criticality: null,
      state: 'UNSUPPORTED_ARTIFACT_FEATURE',
    };
  }

  const namespace = findNamespace(compiledContract, token);
  if (!namespace) {
    return {
      token,
      groupId: null,
      criticality: null,
      state: 'UNSUPPORTED_ARTIFACT_FEATURE',
    };
  }

  const group = findGroupForNamespace(
    compiledContract,
    domain,
    side,
    namespace.id,
  );
  if (!group) {
    return {
      token,
      groupId: null,
      criticality: null,
      state: 'UNSUPPORTED_ARTIFACT_FEATURE',
    };
  }

  if (!namespace.pattern.test(token) || !namespace.membership.has(token)) {
    return {
      token,
      groupId: group.id,
      criticality: group.criticality,
      state: 'INVALID_ARTIFACT_FEATURE_VALUE',
    };
  }

  return {
    token,
    groupId: group.id,
    criticality: group.criticality,
    state: 'CONTRACT_VALID_ARTIFACT_FEATURE',
  };
};

export const compileRecommendationFeatureReadinessContract = (
  parsedContract: RecommendationFeatureTokenContract,
): CompiledRecommendationFeatureReadinessContract => {
  const namespaces: CompiledNamespace[] = parsedContract.namespaces.map(
    (namespace) => {
      if (namespace.valueSource.kind === 'taxonomy') {
        const { conceptType } = namespace.valueSource;
        const membership = new Set<string>(
          TAXONOMY_CONCEPT_SEEDS.filter(
            (seed) => seed.conceptType === conceptType,
          ).map((seed) => seed.canonicalKey),
        );
        return {
          id: namespace.id,
          kind: 'taxonomy' as const,
          conceptType,
          pattern: new RegExp(namespace.tokenPattern, 'u'),
          membership,
        };
      }
      const membership = new Set<string>(
        namespace.valueSource.values.map(
          (value) => `${namespace.id}:${value.tokenValue}`,
        ),
      );
      return {
        id: namespace.id,
        kind: 'closed' as const,
        conceptType: null,
        pattern: new RegExp(namespace.tokenPattern, 'u'),
        membership,
      };
    },
  );

  const groups: CompiledGroup[] = parsedContract.featureGroups
    .filter(
      (group) =>
        group.portableRuntimeEligible &&
        group.namespaceId !== null &&
        group.baseWeight !== null,
    )
    .map((group) => ({
      id: group.id,
      side: group.side,
      domains: group.domains,
      namespaceId: group.namespaceId as string,
      criticality: (group.requiredForScoring
        ? 'CRITICAL'
        : 'OPTIONAL') as FeatureCriticality,
      minimum: group.cardinality.minimum,
      maximum: group.cardinality.maximum,
      baseWeight: group.baseWeight as number,
      portableRuntimeEligible: true as const,
    }))
    .sort((left, right) => asciiCompare(left.id, right.id));

  const criticalClosedTokensByDomain = new Map<
    RecommendationFeatureDomain,
    Set<string>
  >();
  for (const domain of parsedContract.supportedDomains) {
    const tokens = new Set<string>();
    for (const group of groups) {
      if (
        group.criticality !== 'CRITICAL' ||
        group.side !== 'item' ||
        !group.domains.includes(domain)
      ) {
        continue;
      }
      const namespace = namespaces.find(
        (candidate) => candidate.id === group.namespaceId,
      );
      if (!namespace || namespace.kind !== 'closed') continue;
      for (const token of namespace.membership) tokens.add(token);
    }
    criticalClosedTokensByDomain.set(domain, tokens);
  }

  return {
    expectedContractId: parsedContract.contractId,
    expectedContractVersion: parsedContract.contractVersion,
    expectedTaxonomyFingerprint:
      parsedContract.taxonomyCompatibility.taxonomyVocabularyFingerprint,
    lifecycle: parsedContract.status.lifecycle,
    runtimeActivation: parsedContract.status.runtimeActivation,
    aggregationBlocked: parsedContract.status.aggregationBlocked,
    aggregationStatus: parsedContract.aggregation.status,
    aggregationSelectedMode: parsedContract.aggregation.selectedMode,
    portableActivationAllowed:
      parsedContract.aggregation.portableActivationAllowed,
    rejectedTokenPrefixes: [
      ...parsedContract.legacyCompatibility.rejectedTokenPrefixes,
    ].sort(asciiCompare),
    namespaces,
    groups,
    groupOrder: groups.map((group) => group.id),
    criticalClosedTokensByDomain,
  };
};

export const compareFeatureReadinessSampleEntries = (
  left: BoundedSampleEntry,
  right: BoundedSampleEntry,
): number =>
  asciiCompare(left.tokenHash, right.tokenHash) ||
  asciiCompare(left.candidateKeyHash ?? '', right.candidateKeyHash ?? '') ||
  asciiCompare(left.groupId ?? '', right.groupId ?? '') ||
  asciiCompare(String(left.side), String(right.side)) ||
  asciiCompare(left.criticality ?? '', right.criticality ?? '') ||
  asciiCompare(left.source, right.source);

export type FeatureReadinessSampleCollector = {
  totals: Map<FeatureReadinessIssueCode, number>;
  entries: Map<FeatureReadinessIssueCode, BoundedSampleEntry[]>;
};

export const createFeatureReadinessSampleCollector =
  (): FeatureReadinessSampleCollector => ({
  totals: new Map(),
  entries: new Map(),
});

export const recordFeatureReadinessIssue = (
  collector: FeatureReadinessSampleCollector,
  entry: BoundedSampleEntry,
): void => {
  collector.totals.set(
    entry.issueCode,
    (collector.totals.get(entry.issueCode) ?? 0) + 1,
  );
  const bucket = collector.entries.get(entry.issueCode) ?? [];
  // Deterministic bounded top-N: insert in order, keep at most SAMPLE_LIMIT.
  let insertAt = bucket.length;
  for (let index = 0; index < bucket.length; index += 1) {
    const comparison = compareFeatureReadinessSampleEntries(
      entry,
      bucket[index]!,
    );
    if (comparison === 0) {
      // Identical sample identity — keep one, still counted in total above.
      collector.entries.set(entry.issueCode, bucket);
      return;
    }
    if (comparison < 0) {
      insertAt = index;
      break;
    }
  }
  bucket.splice(insertAt, 0, entry);
  if (bucket.length > FEATURE_READINESS_SAMPLE_LIMIT) {
    bucket.length = FEATURE_READINESS_SAMPLE_LIMIT;
  }
  collector.entries.set(entry.issueCode, bucket);
};

export const finalizeFeatureReadinessSamples = (
  collector: FeatureReadinessSampleCollector,
): {
  issueTotals: Partial<Record<FeatureReadinessIssueCode, number>>;
  samples: Partial<Record<FeatureReadinessIssueCode, BoundedSampleBucket>>;
} => {
  const issueTotals: Partial<Record<FeatureReadinessIssueCode, number>> = {};
  const samples: Partial<
    Record<FeatureReadinessIssueCode, BoundedSampleBucket>
  > = {};
  for (const code of [...collector.totals.keys()].sort(asciiCompare)) {
    const total = collector.totals.get(code) ?? 0;
    const sample = [...(collector.entries.get(code) ?? [])];
    issueTotals[code] = total;
    samples[code] = {
      total,
      sample,
      sampleLimit: FEATURE_READINESS_SAMPLE_LIMIT,
      truncated: total > sample.length,
    };
  }
  return { issueTotals, samples };
};

const addReason = (
  reasons: Set<ReadinessReasonCode>,
  code: ReadinessReasonCode,
) => {
  reasons.add(code);
};

type SideAccumulateResult = {
  constructedOccurrence: number;
  constructedUnique: Set<string>;
  /** Structurally valid + weight-valid tokens (artifact membership not required). */
  validRuntimeUnique: Set<string>;
  resolvedOccurrence: number;
  resolvedUnique: Set<string>;
  missingCriticalOccurrence: number;
  missingCriticalUnique: Set<string>;
  missingOptionalOccurrence: number;
  missingOptionalUnique: Set<string>;
  unknownOccurrence: number;
  unsupportedOccurrence: number;
  invalidValueOccurrence: number;
  invalidWeightOccurrence: number;
  invalidCardinalityCandidateCount: number;
  affectedCandidates: Set<string>;
  /** groupId → valid tokens (RESOLVED or MISSING) across request */
  validGroupTokens: Map<string, Set<string>>;
  /** groupId → resolved tokens across request */
  resolvedGroupTokens: Map<string, Set<string>>;
  groupStats: Map<
    string,
    {
      missingRequiredCandidateCount: number;
      exceededMaximumCandidateCount: number;
      invalidValueCandidateCount: number;
      invalidWeightCandidateCount: number;
    }
  >;
};

const accumulateSide = (input: {
  compiledContract: CompiledRecommendationFeatureReadinessContract;
  domain: RecommendationFeatureDomain;
  side: RecommendationFeatureSide;
  rows: ReadonlyArray<{
    candidateKey: string | null;
    features: readonly WeightedFeature[];
  }>;
  artifactVocab: ReadonlySet<string>;
  collector: FeatureReadinessSampleCollector;
  reasons: Set<ReadinessReasonCode>;
}): SideAccumulateResult => {
  const {
    compiledContract,
    domain,
    side,
    rows,
    artifactVocab,
    collector,
    reasons,
  } = input;
  const sideGroups = groupsFor(compiledContract, domain, side);

  const result: SideAccumulateResult = {
    constructedOccurrence: 0,
    constructedUnique: new Set(),
    validRuntimeUnique: new Set(),
    resolvedOccurrence: 0,
    resolvedUnique: new Set(),
    missingCriticalOccurrence: 0,
    missingCriticalUnique: new Set(),
    missingOptionalOccurrence: 0,
    missingOptionalUnique: new Set(),
    unknownOccurrence: 0,
    unsupportedOccurrence: 0,
    invalidValueOccurrence: 0,
    invalidWeightOccurrence: 0,
    invalidCardinalityCandidateCount: 0,
    affectedCandidates: new Set(),
    validGroupTokens: new Map(),
    resolvedGroupTokens: new Map(),
    groupStats: new Map(
      sideGroups.map((group) => [
        group.id,
        {
          missingRequiredCandidateCount: 0,
          exceededMaximumCandidateCount: 0,
          invalidValueCandidateCount: 0,
          invalidWeightCandidateCount: 0,
        },
      ]),
    ),
  };

  for (const row of rows) {
    const candidateKeyHash =
      row.candidateKey === null
        ? undefined
        : hashFeatureReadinessCandidateKey(row.candidateKey);
    let rowHasLocalIssue = false;
    let rowCardinalityIssue = false;
    const rowInvalidValueGroups = new Set<string>();
    const rowInvalidWeightGroups = new Set<string>();
    const tokenWeights = new Map<string, number>();
    const rowValidGroupTokens = new Map<string, Set<string>>();

    for (const [token, weight] of row.features) {
      result.constructedOccurrence += 1;
      result.constructedUnique.add(token);

      const structural = classifyTokenStructure({
        compiledContract,
        domain,
        side,
        token,
      });

      if (structural.state === 'UNKNOWN_RUNTIME_FEATURE') {
        result.unknownOccurrence += 1;
        rowHasLocalIssue = true;
        addReason(reasons, 'UNKNOWN_RUNTIME_FEATURE');
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: null,
          issueCode: 'UNKNOWN_RUNTIME_FEATURE',
          tokenHash: hashFeatureReadinessToken(token),
          candidateKeyHash,
          criticality: null,
          source: 'runtime',
        });
        continue;
      }

      if (structural.state === 'UNSUPPORTED_RUNTIME_FEATURE') {
        result.unsupportedOccurrence += 1;
        rowHasLocalIssue = true;
        addReason(reasons, 'UNSUPPORTED_RUNTIME_FEATURE');
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: structural.groupId,
          issueCode: 'UNSUPPORTED_RUNTIME_FEATURE',
          tokenHash: hashFeatureReadinessToken(token),
          candidateKeyHash,
          criticality: structural.criticality,
          source: 'runtime',
        });
        continue;
      }

      if (structural.state === 'INVALID_RUNTIME_FEATURE_VALUE') {
        result.invalidValueOccurrence += 1;
        rowHasLocalIssue = true;
        if (structural.groupId) rowInvalidValueGroups.add(structural.groupId);
        addReason(reasons, 'INVALID_RUNTIME_FEATURE_VALUE');
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: structural.groupId,
          issueCode: 'INVALID_RUNTIME_FEATURE_VALUE',
          tokenHash: hashFeatureReadinessToken(token),
          candidateKeyHash,
          criticality: structural.criticality,
          source: 'runtime',
        });
        continue;
      }

      const expectedWeight = structural.group!.baseWeight;
      const priorWeight = tokenWeights.get(token);
      if (priorWeight !== undefined && priorWeight !== weight) {
        result.invalidWeightOccurrence += 1;
        rowHasLocalIssue = true;
        if (structural.groupId) rowInvalidWeightGroups.add(structural.groupId);
        addReason(reasons, 'INVALID_RUNTIME_FEATURE_WEIGHT');
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: structural.groupId,
          issueCode: 'INVALID_RUNTIME_FEATURE_WEIGHT',
          tokenHash: hashFeatureReadinessToken(token),
          candidateKeyHash,
          criticality: structural.criticality,
          source: 'runtime',
        });
        continue;
      }
      if (
        !Number.isFinite(weight) ||
        weight !== expectedWeight
      ) {
        result.invalidWeightOccurrence += 1;
        rowHasLocalIssue = true;
        if (structural.groupId) rowInvalidWeightGroups.add(structural.groupId);
        addReason(reasons, 'INVALID_RUNTIME_FEATURE_WEIGHT');
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: structural.groupId,
          issueCode: 'INVALID_RUNTIME_FEATURE_WEIGHT',
          tokenHash: hashFeatureReadinessToken(token),
          candidateKeyHash,
          criticality: structural.criticality,
          source: 'runtime',
        });
        continue;
      }

      const isFirstValidOccurrence = priorWeight === undefined;
      if (isFirstValidOccurrence) {
        tokenWeights.set(token, weight);
        result.validRuntimeUnique.add(token);
      }

      const inArtifact = artifactVocab.has(token);
      if (inArtifact) {
        // Occurrence totals count every supplied valid duplicate.
        result.resolvedOccurrence += 1;
        if (isFirstValidOccurrence) {
          result.resolvedUnique.add(token);
          const resolvedSet =
            result.resolvedGroupTokens.get(structural.groupId!) ?? new Set();
          resolvedSet.add(token);
          result.resolvedGroupTokens.set(structural.groupId!, resolvedSet);
        }
      } else if (structural.criticality === 'CRITICAL') {
        result.missingCriticalOccurrence += 1;
        rowHasLocalIssue = true;
        addReason(reasons, 'MISSING_CRITICAL_ARTIFACT_FEATURE');
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: structural.groupId,
          issueCode: 'MISSING_CRITICAL_ARTIFACT_FEATURE',
          tokenHash: hashFeatureReadinessToken(token),
          candidateKeyHash,
          criticality: 'CRITICAL',
          source: 'runtime',
        });
        if (isFirstValidOccurrence) {
          result.missingCriticalUnique.add(token);
        }
      } else {
        result.missingOptionalOccurrence += 1;
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: structural.groupId,
          issueCode: 'MISSING_OPTIONAL_ARTIFACT_FEATURE',
          tokenHash: hashFeatureReadinessToken(token),
          candidateKeyHash,
          criticality: 'OPTIONAL',
          source: 'runtime',
        });
        if (isFirstValidOccurrence) {
          result.missingOptionalUnique.add(token);
        }
      }

      if (isFirstValidOccurrence) {
        const validSet =
          result.validGroupTokens.get(structural.groupId!) ?? new Set();
        validSet.add(token);
        result.validGroupTokens.set(structural.groupId!, validSet);
        const rowSet = rowValidGroupTokens.get(structural.groupId!) ?? new Set();
        rowSet.add(token);
        rowValidGroupTokens.set(structural.groupId!, rowSet);
      }
    }

    for (const group of sideGroups) {
      const stats = result.groupStats.get(group.id)!;
      if (rowInvalidValueGroups.has(group.id)) {
        stats.invalidValueCandidateCount += 1;
      }
      if (rowInvalidWeightGroups.has(group.id)) {
        stats.invalidWeightCandidateCount += 1;
      }
      const count = rowValidGroupTokens.get(group.id)?.size ?? 0;
      if (
        group.criticality === 'CRITICAL' &&
        group.minimum !== null &&
        count < group.minimum
      ) {
        rowHasLocalIssue = true;
        rowCardinalityIssue = true;
        stats.missingRequiredCandidateCount += 1;
        addReason(reasons, 'MISSING_CRITICAL_RUNTIME_GROUP');
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: group.id,
          issueCode: 'MISSING_CRITICAL_RUNTIME_GROUP',
          tokenHash: hashFeatureReadinessToken(`group:${group.id}`),
          candidateKeyHash,
          criticality: 'CRITICAL',
          source: 'runtime',
        });
      } else if (group.maximum !== null && count > group.maximum) {
        rowHasLocalIssue = true;
        rowCardinalityIssue = true;
        stats.exceededMaximumCandidateCount += 1;
        addReason(reasons, 'INVALID_RUNTIME_CARDINALITY');
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: group.id,
          issueCode: 'INVALID_RUNTIME_CARDINALITY',
          tokenHash: hashFeatureReadinessToken(`group:${group.id}`),
          candidateKeyHash,
          criticality: group.criticality,
          source: 'runtime',
        });
      }
    }

    if (rowCardinalityIssue) result.invalidCardinalityCandidateCount += 1;
    if (rowHasLocalIssue && row.candidateKey !== null) {
      result.affectedCandidates.add(row.candidateKey);
    }
  }

  return result;
};

export const evaluateRecommendationFeatureReadiness = (
  input: FeatureReadinessEvaluateInput,
): RecommendationFeatureReadiness => {
  const { compiledContract, domain, user, itemRows, artifact } = input;
  const reasons = new Set<ReadinessReasonCode>();
  const collector = createFeatureReadinessSampleCollector();

  const userVocab = toNameSet(artifact.userFeatureNames);
  const itemVocab = toNameSet(artifact.itemFeatureNames);
  const declaredId =
    artifact.feature_contract_id === undefined
      ? null
      : artifact.feature_contract_id;
  const declaredVersion =
    artifact.feature_contract_version === undefined
      ? null
      : artifact.feature_contract_version;
  const declaredFingerprint =
    artifact.feature_contract_fingerprint === undefined
      ? null
      : artifact.feature_contract_fingerprint;
  const declaredAggregationMode =
    artifact.feature_aggregation_mode === undefined
      ? null
      : artifact.feature_aggregation_mode;
  const expectedAggregationMode = compiledContract.aggregationSelectedMode;

  let contractVersionCompatible = true;
  let aggregationModeCompatible = false;

  if (declaredId == null || declaredId === '') {
    contractVersionCompatible = false;
    addReason(reasons, 'ARTIFACT_CONTRACT_ID_MISSING');
    recordFeatureReadinessIssue(collector, {
      domain,
      side: 'artifact',
      groupId: null,
      issueCode: 'ARTIFACT_CONTRACT_ID_MISSING',
      tokenHash: hashFeatureReadinessToken('feature_contract_id:missing'),
      criticality: 'CRITICAL',
      source: 'artifact',
    });
  } else if (declaredId !== compiledContract.expectedContractId) {
    contractVersionCompatible = false;
    addReason(reasons, 'ARTIFACT_CONTRACT_ID_INCOMPATIBLE');
    recordFeatureReadinessIssue(collector, {
      domain,
      side: 'artifact',
      groupId: null,
      issueCode: 'ARTIFACT_CONTRACT_ID_INCOMPATIBLE',
      tokenHash: hashFeatureReadinessToken(`feature_contract_id:${declaredId}`),
      criticality: 'CRITICAL',
      source: 'artifact',
    });
  }

  if (declaredVersion == null || declaredVersion === '') {
    contractVersionCompatible = false;
    addReason(reasons, 'ARTIFACT_CONTRACT_VERSION_MISSING');
    recordFeatureReadinessIssue(collector, {
      domain,
      side: 'artifact',
      groupId: null,
      issueCode: 'ARTIFACT_CONTRACT_VERSION_MISSING',
      tokenHash: hashFeatureReadinessToken('feature_contract_version:missing'),
      criticality: 'CRITICAL',
      source: 'artifact',
    });
  } else if (declaredVersion !== compiledContract.expectedContractVersion) {
    contractVersionCompatible = false;
    addReason(reasons, 'ARTIFACT_CONTRACT_VERSION_INCOMPATIBLE');
    recordFeatureReadinessIssue(collector, {
      domain,
      side: 'artifact',
      groupId: null,
      issueCode: 'ARTIFACT_CONTRACT_VERSION_INCOMPATIBLE',
      tokenHash: hashFeatureReadinessToken(
        `feature_contract_version:${declaredVersion}`,
      ),
      criticality: 'CRITICAL',
      source: 'artifact',
    });
  }

  if (declaredFingerprint == null || declaredFingerprint === '') {
    contractVersionCompatible = false;
    addReason(reasons, 'ARTIFACT_CONTRACT_FINGERPRINT_MISSING');
    recordFeatureReadinessIssue(collector, {
      domain,
      side: 'artifact',
      groupId: null,
      issueCode: 'ARTIFACT_CONTRACT_FINGERPRINT_MISSING',
      tokenHash: hashFeatureReadinessToken(
        'feature_contract_fingerprint:missing',
      ),
      criticality: 'CRITICAL',
      source: 'artifact',
    });
  } else if (
    declaredFingerprint !== compiledContract.expectedTaxonomyFingerprint
  ) {
    contractVersionCompatible = false;
    addReason(reasons, 'ARTIFACT_CONTRACT_FINGERPRINT_INCOMPATIBLE');
    recordFeatureReadinessIssue(collector, {
      domain,
      side: 'artifact',
      groupId: null,
      issueCode: 'ARTIFACT_CONTRACT_FINGERPRINT_INCOMPATIBLE',
      tokenHash: hashFeatureReadinessToken(
        `feature_contract_fingerprint:${declaredFingerprint}`,
      ),
      criticality: 'CRITICAL',
      source: 'artifact',
    });
  }

  // Aggregation-mode compatibility only applies once the contract selects a mode.
  // While selectedMode is null, no artifact declaration can unlock activation.
  if (expectedAggregationMode !== null) {
    if (declaredAggregationMode == null || declaredAggregationMode === '') {
      addReason(reasons, 'ARTIFACT_AGGREGATION_MODE_MISSING');
      recordFeatureReadinessIssue(collector, {
        domain,
        side: 'artifact',
        groupId: null,
        issueCode: 'ARTIFACT_AGGREGATION_MODE_MISSING',
        tokenHash: hashFeatureReadinessToken('feature_aggregation_mode:missing'),
        criticality: 'CRITICAL',
        source: 'artifact',
      });
    } else if (declaredAggregationMode !== expectedAggregationMode) {
      addReason(reasons, 'ARTIFACT_AGGREGATION_MODE_INCOMPATIBLE');
      recordFeatureReadinessIssue(collector, {
        domain,
        side: 'artifact',
        groupId: null,
        issueCode: 'ARTIFACT_AGGREGATION_MODE_INCOMPATIBLE',
        tokenHash: hashFeatureReadinessToken(
          `feature_aggregation_mode:${declaredAggregationMode}`,
        ),
        criticality: 'CRITICAL',
        source: 'artifact',
      });
    } else {
      aggregationModeCompatible = true;
    }
  }

  const userAcc = accumulateSide({
    compiledContract,
    domain,
    side: 'user',
    rows: [{ candidateKey: null, features: user.features }],
    artifactVocab: userVocab,
    collector,
    reasons,
  });

  const itemAcc = accumulateSide({
    compiledContract,
    domain,
    side: 'item',
    rows: itemRows.map((row) => ({
      candidateKey: row.candidateKey,
      features: row.features,
    })),
    artifactVocab: itemVocab,
    collector,
    reasons,
  });

  let userReadinessStatus: UserReadinessStatus = 'PASS';
  if (user.resolutionStatus === 'NO_INTERESTS') {
    userReadinessStatus = 'NOT_READY';
    addReason(reasons, 'USER_NO_INTERESTS');
  } else if (user.resolutionStatus === 'PARTIALLY_MAPPED') {
    userReadinessStatus = 'NOT_READY';
    addReason(reasons, 'USER_PARTIALLY_MAPPED');
  } else if (user.resolutionStatus === 'UNMAPPED_INTERESTS') {
    userReadinessStatus = 'NOT_READY';
    addReason(reasons, 'USER_UNMAPPED_INTERESTS');
  } else if (user.resolutionStatus === 'FULLY_MAPPED') {
    // Use actual weight-validated runtime tokens only — never reclassify at weight 1.
    if (userAcc.validRuntimeUnique.size === 0) {
      // Contract/vocabulary drift is not a cold-user state.
      userReadinessStatus = 'NOT_READY';
      addReason(reasons, 'USER_RUNTIME_REPRESENTATION_INVALID');
    } else if (userAcc.resolvedUnique.size === 0) {
      userReadinessStatus = 'NOT_READY';
      addReason(reasons, 'USER_ZERO_ARTIFACT_OVERLAP');
    } else if (userAcc.resolvedUnique.size < userAcc.validRuntimeUnique.size) {
      userReadinessStatus = 'NOT_READY';
      addReason(reasons, 'USER_PARTIAL_ARTIFACT_OVERLAP');
    }
  }

  if (
    userAcc.unknownOccurrence > 0 ||
    userAcc.unsupportedOccurrence > 0 ||
    userAcc.invalidValueOccurrence > 0 ||
    userAcc.invalidWeightOccurrence > 0 ||
    userAcc.missingCriticalUnique.size > 0
  ) {
    userReadinessStatus = 'NOT_READY';
  }

  // Artifact vocabulary classification
  let contractValidArtifactFeatureCount = 0;
  let contractInvalidArtifactFeatureCount = 0;
  let unsupportedArtifactFeatureCount = 0;
  let artifactFeatureNotConstructedInRequestCount = 0;

  const classifyArtifactName = (
    token: string,
    side: RecommendationFeatureSide,
  ) => {
    const classified = classifyArtifactFeatureToken({
      compiledContract,
      domain,
      side,
      token,
    });
    if (classified.state === 'CONTRACT_VALID_ARTIFACT_FEATURE') {
      contractValidArtifactFeatureCount += 1;
      const constructed =
        side === 'user'
          ? userAcc.constructedUnique.has(token)
          : itemAcc.constructedUnique.has(token);
      if (!constructed) {
        artifactFeatureNotConstructedInRequestCount += 1;
        recordFeatureReadinessIssue(collector, {
          domain,
          side,
          groupId: classified.groupId,
          issueCode: 'ARTIFACT_FEATURE_NOT_CONSTRUCTED_IN_REQUEST',
          tokenHash: hashFeatureReadinessToken(token),
          criticality: classified.criticality,
          source: 'artifact',
        });
      }
    } else if (classified.state === 'INVALID_ARTIFACT_FEATURE_VALUE') {
      contractInvalidArtifactFeatureCount += 1;
      addReason(reasons, 'INVALID_ARTIFACT_FEATURE_VALUE');
      recordFeatureReadinessIssue(collector, {
        domain,
        side,
        groupId: classified.groupId,
        issueCode: 'INVALID_ARTIFACT_FEATURE_VALUE',
        tokenHash: hashFeatureReadinessToken(token),
        criticality: classified.criticality,
        source: 'artifact',
      });
    } else {
      unsupportedArtifactFeatureCount += 1;
      addReason(reasons, 'UNSUPPORTED_ARTIFACT_FEATURE');
      recordFeatureReadinessIssue(collector, {
        domain,
        side,
        groupId: classified.groupId,
        issueCode: 'UNSUPPORTED_ARTIFACT_FEATURE',
        tokenHash: hashFeatureReadinessToken(token),
        criticality: classified.criticality,
        source: 'artifact',
      });
    }
  };

  for (const token of userVocab) classifyArtifactName(token, 'user');
  for (const token of itemVocab) classifyArtifactName(token, 'item');

  const expectedClosed =
    compiledContract.criticalClosedTokensByDomain.get(domain) ?? new Set();
  let presentCriticalEnumBooleanCount = 0;
  for (const token of expectedClosed) {
    if (itemVocab.has(token)) {
      presentCriticalEnumBooleanCount += 1;
    } else {
      addReason(reasons, 'REQUIRED_ENUM_BOOLEAN_UNSUPPORTED');
      recordFeatureReadinessIssue(collector, {
        domain,
        side: 'item',
        groupId: null,
        issueCode: 'REQUIRED_ENUM_BOOLEAN_UNSUPPORTED',
        tokenHash: hashFeatureReadinessToken(token),
        criticality: 'CRITICAL',
        source: 'artifact',
      });
    }
  }
  const expectedCriticalEnumBooleanCount = expectedClosed.size;
  const missingCriticalEnumBooleanCount =
    expectedCriticalEnumBooleanCount - presentCriticalEnumBooleanCount;

  const { issueTotals, samples } = finalizeFeatureReadinessSamples(collector);

  const groups: Record<string, GroupCoverageSnapshot> = {};
  const allGroups = [
    ...groupsFor(compiledContract, domain, 'user'),
    ...groupsFor(compiledContract, domain, 'item'),
  ];
  for (const group of allGroups) {
    const acc = group.side === 'user' ? userAcc : itemAcc;
    const stats = acc.groupStats.get(group.id)!;
    const validTokens = acc.validGroupTokens.get(group.id) ?? new Set();
    const resolvedTokens = acc.resolvedGroupTokens.get(group.id) ?? new Set();
    const missingUnique = [...validTokens].filter(
      (token) => !resolvedTokens.has(token),
    ).length;
    let cardinalityStatus: GroupCoverageSnapshot['cardinalityStatus'] = 'OK';
    if (stats.missingRequiredCandidateCount > 0) {
      cardinalityStatus = 'MISSING_REQUIRED';
    } else if (stats.exceededMaximumCandidateCount > 0) {
      cardinalityStatus = 'EXCEEDED_MAXIMUM';
    }
    groups[group.id] = {
      criticality: group.criticality,
      side: group.side,
      constructedUnique: validTokens.size,
      resolvedUnique: resolvedTokens.size,
      missingUnique,
      cardinalityStatus,
      candidateCount:
        group.side === 'user' ? 1 : itemRows.length,
      missingRequiredCandidateCount: stats.missingRequiredCandidateCount,
      exceededMaximumCandidateCount: stats.exceededMaximumCandidateCount,
      invalidValueCandidateCount: stats.invalidValueCandidateCount,
      invalidWeightCandidateCount: stats.invalidWeightCandidateCount,
    };
  }

  // Stable group order from compiled contract
  const orderedGroups: Record<string, GroupCoverageSnapshot> = {};
  for (const groupId of compiledContract.groupOrder) {
    if (groups[groupId]) orderedGroups[groupId] = groups[groupId]!;
  }

  const coverageStatus: 'READY' | 'NOT_READY' =
    reasons.size === 0 && userReadinessStatus === 'PASS' ? 'READY' : 'NOT_READY';

  // Honest v3 activation gate — do not select aggregation here (RP-05.6).
  if (compiledContract.runtimeActivation === 'INACTIVE') {
    addReason(reasons, 'FEATURE_CONTRACT_RUNTIME_INACTIVE');
  }
  if (
    compiledContract.aggregationSelectedMode === null ||
    compiledContract.aggregationStatus === 'PENDING_CONTROLLED_EXPERIMENT'
  ) {
    addReason(reasons, 'FEATURE_CONTRACT_AGGREGATION_NOT_SELECTED');
  }
  if (
    compiledContract.aggregationBlocked ||
    !compiledContract.portableActivationAllowed
  ) {
    addReason(reasons, 'FEATURE_CONTRACT_PORTABLE_ACTIVATION_BLOCKED');
  }

  const status: 'READY' | 'NOT_READY' =
    coverageStatus === 'READY' &&
    compiledContract.runtimeActivation !== 'INACTIVE' &&
    compiledContract.aggregationSelectedMode !== null &&
    compiledContract.aggregationStatus !== 'PENDING_CONTROLLED_EXPERIMENT' &&
    !compiledContract.aggregationBlocked &&
    compiledContract.portableActivationAllowed &&
    aggregationModeCompatible
      ? 'READY'
      : 'NOT_READY';

  return {
    schemaVersion: FEATURE_READINESS_SCHEMA_VERSION,
    inputFingerprint: fingerprintRecommendationFeatureReadinessInput(input),
    domain,
    status,
    coverageStatus,
    reasons: [...reasons].sort(asciiCompare),
    user: {
      resolutionStatus: user.resolutionStatus,
      readinessStatus: userReadinessStatus,
      constructedOccurrenceCount: userAcc.constructedOccurrence,
      constructedUniqueCount: userAcc.constructedUnique.size,
      artifactResolvedOccurrenceCount: userAcc.resolvedOccurrence,
      artifactResolvedUniqueCount: userAcc.resolvedUnique.size,
      missingCriticalOccurrenceCount: userAcc.missingCriticalOccurrence,
      missingCriticalUniqueCount: userAcc.missingCriticalUnique.size,
      unknownOccurrenceCount: userAcc.unknownOccurrence,
      unsupportedOccurrenceCount: userAcc.unsupportedOccurrence,
      invalidValueOccurrenceCount: userAcc.invalidValueOccurrence,
      invalidWeightOccurrenceCount: userAcc.invalidWeightOccurrence,
    },
    items: {
      candidateCount: itemRows.length,
      affectedCandidateCount: itemAcc.affectedCandidates.size,
      constructedOccurrenceCount: itemAcc.constructedOccurrence,
      constructedUniqueCount: itemAcc.constructedUnique.size,
      artifactResolvedOccurrenceCount: itemAcc.resolvedOccurrence,
      artifactResolvedUniqueCount: itemAcc.resolvedUnique.size,
      missingCriticalOccurrenceCount: itemAcc.missingCriticalOccurrence,
      missingCriticalUniqueCount: itemAcc.missingCriticalUnique.size,
      missingOptionalOccurrenceCount: itemAcc.missingOptionalOccurrence,
      missingOptionalUniqueCount: itemAcc.missingOptionalUnique.size,
      unknownOccurrenceCount: itemAcc.unknownOccurrence,
      unsupportedOccurrenceCount: itemAcc.unsupportedOccurrence,
      invalidValueOccurrenceCount: itemAcc.invalidValueOccurrence,
      invalidWeightOccurrenceCount: itemAcc.invalidWeightOccurrence,
      invalidCardinalityCandidateCount:
        itemAcc.invalidCardinalityCandidateCount,
    },
    artifact: {
      modelVersion: artifact.modelVersion,
      featureSchemaVersion: artifact.featureSchemaVersion,
      featureContractId: declaredId,
      featureContractVersion: declaredVersion,
      featureContractFingerprint: declaredFingerprint,
      featureAggregationMode: declaredAggregationMode,
      expectedContractId: compiledContract.expectedContractId,
      expectedContractVersion: compiledContract.expectedContractVersion,
      expectedTaxonomyFingerprint: compiledContract.expectedTaxonomyFingerprint,
      expectedAggregationMode,
      contractVersionCompatible,
      aggregationModeCompatible,
      expectedCriticalEnumBooleanCount,
      presentCriticalEnumBooleanCount,
      missingCriticalEnumBooleanCount,
      contractValidArtifactFeatureCount,
      contractInvalidArtifactFeatureCount,
      unsupportedArtifactFeatureCount,
      artifactFeatureNotConstructedInRequestCount,
    },
    groups: orderedGroups,
    issueTotals,
    samples,
  };
};

let compiledContractValue:
  | CompiledRecommendationFeatureReadinessContract
  | undefined;
let compiledContractInFlight:
  | Promise<CompiledRecommendationFeatureReadinessContract>
  | undefined;

export const getCompiledRecommendationFeatureReadinessContract =
  async (): Promise<CompiledRecommendationFeatureReadinessContract> => {
    if (compiledContractValue) return compiledContractValue;
    if (!compiledContractInFlight) {
      compiledContractInFlight = loadRecommendationFeatureTokenContract()
        .then((parsed) => {
          compiledContractValue =
            compileRecommendationFeatureReadinessContract(parsed);
          return compiledContractValue;
        })
        .catch((error: unknown) => {
          compiledContractInFlight = undefined;
          throw error;
        });
    }
    return compiledContractInFlight;
  };

export const setCompiledRecommendationFeatureReadinessContractForTests = (
  compiled: CompiledRecommendationFeatureReadinessContract | undefined,
): void => {
  compiledContractValue = compiled;
  compiledContractInFlight =
    compiled === undefined ? undefined : Promise.resolve(compiled);
};
