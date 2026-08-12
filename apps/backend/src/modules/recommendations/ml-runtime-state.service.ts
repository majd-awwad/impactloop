import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  env,
  type RecommendationMlRuntimeConfig,
  type RecommendationMlRuntimeMode,
} from '../../config/env.js';
import {
  buildPortableLightFmV2Scorer,
  type LocalMlContainedScoringResult,
  type LocalMlDomain,
  type LocalMlScorerDiagnostics,
  type LocalMlScorerUnavailableReason,
  type LocalMlScoringInput,
  type PortableLightFmV2Scorer,
  type ScoredCandidate,
} from './ml-lightfm-scorer.js';
import {
  loadPortableModelArtifactV2,
  type PortableArtifactV2Expectations,
  type PortableModelArtifactV2,
} from './ml-model-artifact.js';
import {
  loadRecommendationFeatureTokenContract,
  type RecommendationFeatureTokenContract,
} from './recommendation-feature-token-contract.js';

export type RecommendationMlRuntimeDomainState =
  | 'DISABLED'
  | 'LOADING'
  | 'READY'
  | 'NOT_READY'
  | 'FAILED';

export type RecommendationMlStartupFailureCode =
  | 'PRELOAD_NOT_STARTED'
  | 'ARTIFACT_PATH_MISSING'
  | 'ARTIFACT_NOT_FOUND'
  | 'ARTIFACT_UNREADABLE'
  | 'ARTIFACT_MALFORMED'
  | 'ARTIFACT_SCHEMA_INVALID'
  | 'ARTIFACT_DOMAIN_MISMATCH'
  | 'FEATURE_CONTRACT_MISMATCH'
  | 'AGGREGATION_MODE_MISMATCH'
  | 'TAXONOMY_FINGERPRINT_MISMATCH'
  | 'MAPPING_HASH_MISMATCH'
  | 'ARTIFACT_INTEGRITY_MISMATCH'
  | 'SCORER_CONSTRUCTION_FAILED'
  | 'RUNTIME_INTERNAL_FAILURE';

export type RecommendationMlDomainDiagnostics = Readonly<{
  runtimeMode: RecommendationMlRuntimeMode;
  domain: LocalMlDomain;
  state: RecommendationMlRuntimeDomainState;
  semanticContentHash?: string;
  modelVersion?: string;
  schemaVersion?: string;
  /** Loaded aggregation mode (e.g. weighted-sum). Omitted when not READY. */
  aggregationMode?: string;
  featureContractId?: string;
  featureContractVersion?: string;
  failureCode?: RecommendationMlStartupFailureCode;
  loadCompletedAt?: string;
  artifactItemCount?: number;
}>;

export type RecommendationMlRuntimeSnapshot = Readonly<{
  mode: RecommendationMlRuntimeMode;
  material: RecommendationMlDomainDiagnostics;
  project: RecommendationMlDomainDiagnostics;
}>;

export type RecommendationMlUnavailableReason =
  | 'RUNTIME_MODE_DISABLED'
  | 'RUNTIME_MODE_NOT_PRIMARY'
  | 'RUNTIME_LOADING'
  | 'RUNTIME_NOT_READY'
  | 'RUNTIME_FAILED'
  | RecommendationMlStartupFailureCode
  | LocalMlScorerUnavailableReason;

export type RecommendationMlRequestDiagnostics = Readonly<{
  runtimeMode: RecommendationMlRuntimeMode;
  domain: LocalMlDomain;
  state: RecommendationMlRuntimeDomainState;
  candidateCount: number;
  duplicateCandidateCount: number;
  scoredCount: number;
  missingMappingCount: number;
  missingMappingKeySamples: readonly string[];
  featureMappingMissingCount: number;
  startupFailureCode?: RecommendationMlStartupFailureCode;
}>;

export type RecommendationMlRankingResult =
  | Readonly<{
      outcome: 'ML_RANKED';
      mode: 'ML_PRIMARY';
      domain: LocalMlDomain;
      scored: readonly Readonly<ScoredCandidate>[];
      rankedCandidateKeys: readonly string[];
      diagnostics: RecommendationMlRequestDiagnostics;
    }>
  | Readonly<{
      outcome: 'ML_UNAVAILABLE';
      mode: RecommendationMlRuntimeMode;
      domain: LocalMlDomain;
      reasonCode: RecommendationMlUnavailableReason;
      diagnostics: RecommendationMlRequestDiagnostics;
    }>;

type RecommendationMlUnavailableResult = Extract<
  RecommendationMlRankingResult,
  { outcome: 'ML_UNAVAILABLE' }
>;

type AggregationContract = Readonly<{
  schemaVersion: string;
  selectedMode: string;
}>;

type InternalDomainState = Readonly<{
  diagnostics: RecommendationMlDomainDiagnostics;
  scorer?: PortableLightFmV2Scorer;
}>;

type InternalSnapshot = Readonly<{
  publicSnapshot: RecommendationMlRuntimeSnapshot;
  material: InternalDomainState;
  project: InternalDomainState;
}>;

type RuntimeDependencies = {
  getConfig: () => RecommendationMlRuntimeConfig;
  loadFeatureContract: () => Promise<RecommendationFeatureTokenContract>;
  loadAggregationContract: () => Promise<AggregationContract>;
  loadArtifact: (
    artifactPath: string,
    expectations: PortableArtifactV2Expectations,
  ) => Promise<PortableModelArtifactV2>;
  buildScorer: (artifact: PortableModelArtifactV2) => PortableLightFmV2Scorer;
  now: () => Date;
};

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../..',
);
const aggregationContractPath = path.join(
  repositoryRoot,
  'ml/recommendation/aggregation-contract-v1.json',
);

const runtimeConfigFromEnv = (): RecommendationMlRuntimeConfig => ({
  mode: env.recommendationMlRuntimeMode,
  explicitMode: env.recommendationMlRuntimeModeExplicit,
  materialArtifactPath: env.recommendationMlMaterialArtifactPath,
  projectArtifactPath: env.recommendationMlProjectArtifactPath,
});

const loadAggregationContract = async (): Promise<AggregationContract> => {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(aggregationContractPath, 'utf8')) as unknown;
  } catch {
    throw new Error('aggregation_contract_invalid');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('aggregation_contract_invalid');
  }
  const value = raw as Record<string, unknown>;
  if (
    value.schemaVersion !== 'impactloop-local-aggregation-contract-v1' ||
    value.selectedMode !== 'weighted-sum'
  ) {
    throw new Error('aggregation_contract_invalid');
  }
  return Object.freeze({
    schemaVersion: value.schemaVersion,
    selectedMode: value.selectedMode,
  });
};

const defaultDependencies: RuntimeDependencies = {
  getConfig: runtimeConfigFromEnv,
  loadFeatureContract: () => loadRecommendationFeatureTokenContract(),
  loadAggregationContract,
  loadArtifact: loadPortableModelArtifactV2,
  buildScorer: buildPortableLightFmV2Scorer,
  now: () => new Date(),
};

let dependencies: RuntimeDependencies = defaultDependencies;

const freezeDiagnostics = (
  diagnostics: RecommendationMlDomainDiagnostics,
): RecommendationMlDomainDiagnostics => Object.freeze({ ...diagnostics });

const publicSnapshotFromStates = (
  mode: RecommendationMlRuntimeMode,
  material: InternalDomainState,
  project: InternalDomainState,
): RecommendationMlRuntimeSnapshot =>
  Object.freeze({
    mode,
    material: material.diagnostics,
    project: project.diagnostics,
  });

const internalSnapshot = (
  mode: RecommendationMlRuntimeMode,
  material: InternalDomainState,
  project: InternalDomainState,
): InternalSnapshot =>
  Object.freeze({
    publicSnapshot: publicSnapshotFromStates(mode, material, project),
    material,
    project,
  });

const domainState = (
  diagnostics: RecommendationMlDomainDiagnostics,
  scorer?: PortableLightFmV2Scorer,
): InternalDomainState =>
  Object.freeze({
    diagnostics: freezeDiagnostics(diagnostics),
    ...(scorer ? { scorer } : {}),
  });

const initialSnapshot = (
  mode: RecommendationMlRuntimeMode,
): InternalSnapshot => {
  const state: RecommendationMlRuntimeDomainState =
    mode === 'DETERMINISTIC' ? 'DISABLED' : 'NOT_READY';
  const failureCode =
    mode === 'DETERMINISTIC' ? undefined : ('PRELOAD_NOT_STARTED' as const);
  const material = domainState({
    runtimeMode: mode,
    domain: 'material',
    state,
    ...(failureCode ? { failureCode } : {}),
  });
  const project = domainState({
    runtimeMode: mode,
    domain: 'project',
    state,
    ...(failureCode ? { failureCode } : {}),
  });
  return internalSnapshot(mode, material, project);
};

let publishedSnapshot = initialSnapshot(env.recommendationMlRuntimeMode);
let preloadPromise: Promise<RecommendationMlRuntimeSnapshot> | undefined;

const resolveArtifactPath = (configuredPath: string): string =>
  path.isAbsolute(configuredPath)
    ? path.normalize(configuredPath)
    : path.resolve(repositoryRoot, configuredPath);

const errorCode = (error: unknown): string | undefined =>
  error && typeof error === 'object' && 'code' in error
    ? String(error.code)
    : undefined;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '';

const classifyExpectedFailure = (
  error: unknown,
): RecommendationMlStartupFailureCode | undefined => {
  const code = errorCode(error);
  if (code === 'ENOENT') return 'ARTIFACT_NOT_FOUND';
  if (
    code === 'EACCES' ||
    code === 'EPERM' ||
    code === 'EISDIR' ||
    code === 'ENOTDIR' ||
    code === 'EIO' ||
    code === 'EBUSY' ||
    code === 'EMFILE' ||
    code === 'ENFILE'
  ) {
    return 'ARTIFACT_UNREADABLE';
  }
  if (code?.startsWith('CONTRACT_LOAD_')) {
    return 'FEATURE_CONTRACT_MISMATCH';
  }
  if (error instanceof SyntaxError) return 'ARTIFACT_MALFORMED';

  const message = errorMessage(error);
  if (message.includes('artifact_v2_domain')) {
    return 'ARTIFACT_DOMAIN_MISMATCH';
  }
  if (message.includes('artifact_v2_feature_contract')) {
    return 'FEATURE_CONTRACT_MISMATCH';
  }
  if (message.includes('artifact_v2_aggregation_mode')) {
    return 'AGGREGATION_MODE_MISMATCH';
  }
  if (message.includes('taxonomy_fingerprint')) {
    return 'TAXONOMY_FINGERPRINT_MISMATCH';
  }
  if (
    message.includes('feature_mapping_hash') ||
    message.includes('item_mapping_hash')
  ) {
    return 'MAPPING_HASH_MISMATCH';
  }
  if (message.includes('semantic_content_hash_mismatch')) {
    return 'ARTIFACT_INTEGRITY_MISMATCH';
  }
  if (
    message.startsWith('user_feature_mapping_') ||
    message.startsWith('item_feature_mapping_') ||
    message.startsWith('item_mapping_')
  ) {
    return 'ARTIFACT_SCHEMA_INVALID';
  }
  if (message.startsWith('artifact_v2_')) return 'ARTIFACT_SCHEMA_INVALID';
  if (message.startsWith('CONTRACT_LOAD_')) {
    return 'FEATURE_CONTRACT_MISMATCH';
  }
  if (message === 'aggregation_contract_invalid') {
    return 'AGGREGATION_MODE_MISMATCH';
  }
  return undefined;
};

const loadDomain = async (
  mode: RecommendationMlRuntimeMode,
  domain: LocalMlDomain,
  configuredPath: string,
  featureContractPromise: Promise<RecommendationFeatureTokenContract>,
  aggregationContractPromise: Promise<AggregationContract>,
): Promise<InternalDomainState> => {
  const completed = (): string => dependencies.now().toISOString();
  if (!configuredPath) {
    return domainState({
      runtimeMode: mode,
      domain,
      state: 'NOT_READY',
      failureCode: 'ARTIFACT_PATH_MISSING',
      loadCompletedAt: completed(),
    });
  }

  try {
    const [featureContract, aggregationContract] = await Promise.all([
      featureContractPromise,
      aggregationContractPromise,
    ]);
    const expectations: PortableArtifactV2Expectations = {
      expectedDomain: domain,
      featureContractId: featureContract.contractId,
      featureContractVersion: featureContract.contractVersion,
      aggregationMode: aggregationContract.selectedMode,
      taxonomyFingerprint:
        featureContract.taxonomyCompatibility.taxonomyVocabularyFingerprint,
    };
    let artifact: PortableModelArtifactV2;
    try {
      artifact = await dependencies.loadArtifact(
        resolveArtifactPath(configuredPath),
        expectations,
      );
    } catch (error) {
      const failureCode = classifyExpectedFailure(error);
      if (!failureCode) throw error;
      return domainState({
        runtimeMode: mode,
        domain,
        state: 'NOT_READY',
        failureCode,
        loadCompletedAt: completed(),
      });
    }

    try {
      const scorer = dependencies.buildScorer(artifact);
      if (scorer.domain !== domain) {
        return domainState({
          runtimeMode: mode,
          domain,
          state: 'NOT_READY',
          failureCode: 'ARTIFACT_DOMAIN_MISMATCH',
          loadCompletedAt: completed(),
        });
      }
      return domainState(
        {
          runtimeMode: mode,
          domain,
          state: 'READY',
          semanticContentHash: scorer.metadata.semanticContentHash,
          modelVersion: scorer.metadata.modelVersion,
          schemaVersion: scorer.metadata.schemaVersion,
          aggregationMode: aggregationContract.selectedMode,
          featureContractId: featureContract.contractId,
          featureContractVersion: featureContract.contractVersion,
          artifactItemCount: scorer.metadata.itemCount,
          loadCompletedAt: completed(),
        },
        scorer,
      );
    } catch {
      return domainState({
        runtimeMode: mode,
        domain,
        state: 'FAILED',
        failureCode: 'SCORER_CONSTRUCTION_FAILED',
        loadCompletedAt: completed(),
      });
    }
  } catch (error) {
    const expected = classifyExpectedFailure(error);
    return domainState({
      runtimeMode: mode,
      domain,
      state: expected ? 'NOT_READY' : 'FAILED',
      failureCode: expected ?? 'RUNTIME_INTERNAL_FAILURE',
      loadCompletedAt: completed(),
    });
  }
};

const performPreload = async (
  config: RecommendationMlRuntimeConfig,
): Promise<RecommendationMlRuntimeSnapshot> => {
  if (!config.materialArtifactPath && !config.projectArtifactPath) {
    const missing = (domain: LocalMlDomain): InternalDomainState =>
      domainState({
        runtimeMode: config.mode,
        domain,
        state: 'NOT_READY',
        failureCode: 'ARTIFACT_PATH_MISSING',
        loadCompletedAt: dependencies.now().toISOString(),
      });
    publishedSnapshot = internalSnapshot(
      config.mode,
      missing('material'),
      missing('project'),
    );
    return publishedSnapshot.publicSnapshot;
  }
  const featureContractPromise = dependencies.loadFeatureContract();
  const aggregationContractPromise = dependencies.loadAggregationContract();
  const [material, project] = await Promise.all([
    loadDomain(
      config.mode,
      'material',
      config.materialArtifactPath,
      featureContractPromise,
      aggregationContractPromise,
    ),
    loadDomain(
      config.mode,
      'project',
      config.projectArtifactPath,
      featureContractPromise,
      aggregationContractPromise,
    ),
  ]);
  publishedSnapshot = internalSnapshot(config.mode, material, project);
  return publishedSnapshot.publicSnapshot;
};

export const preloadRecommendationMlRuntime = (): Promise<RecommendationMlRuntimeSnapshot> => {
  if (preloadPromise) return preloadPromise;

  const config = dependencies.getConfig();
  if (config.mode === 'DETERMINISTIC') {
    publishedSnapshot = initialSnapshot('DETERMINISTIC');
    preloadPromise = Promise.resolve(publishedSnapshot.publicSnapshot);
    return preloadPromise;
  }

  const loading = (domain: LocalMlDomain): InternalDomainState =>
    domainState({ runtimeMode: config.mode, domain, state: 'LOADING' });
  publishedSnapshot = internalSnapshot(
    config.mode,
    loading('material'),
    loading('project'),
  );

  preloadPromise = Promise.resolve()
    .then(() => performPreload(config))
    .catch(() => {
      const failed = (domain: LocalMlDomain): InternalDomainState =>
        domainState({
          runtimeMode: config.mode,
          domain,
          state: 'FAILED',
          failureCode: 'RUNTIME_INTERNAL_FAILURE',
          loadCompletedAt: dependencies.now().toISOString(),
        });
      publishedSnapshot = internalSnapshot(
        config.mode,
        failed('material'),
        failed('project'),
      );
      return publishedSnapshot.publicSnapshot;
    });
  return preloadPromise;
};

export const getRecommendationMlRuntimeSnapshot = (): RecommendationMlRuntimeSnapshot =>
  publishedSnapshot.publicSnapshot;

const domainFromSnapshot = (
  snapshot: InternalSnapshot,
  domain: LocalMlDomain,
): InternalDomainState =>
  domain === 'material' ? snapshot.material : snapshot.project;

const requestDiagnostics = (
  snapshot: InternalSnapshot,
  domain: LocalMlDomain,
  candidateCount: number,
  scorerDiagnostics?: LocalMlScorerDiagnostics,
): RecommendationMlRequestDiagnostics => {
  const state = domainFromSnapshot(snapshot, domain).diagnostics;
  return Object.freeze({
    runtimeMode: snapshot.publicSnapshot.mode,
    domain,
    state: state.state,
    candidateCount,
    duplicateCandidateCount: scorerDiagnostics?.duplicateCandidateCount ?? 0,
    scoredCount: scorerDiagnostics?.scoredCount ?? 0,
    missingMappingCount: scorerDiagnostics?.missingMappingCount ?? 0,
    missingMappingKeySamples: Object.freeze([
      ...(scorerDiagnostics?.missingMappingKeySamples ?? []),
    ]),
    featureMappingMissingCount:
      scorerDiagnostics?.featureMappingMissingCount ?? 0,
    ...(state.failureCode ? { startupFailureCode: state.failureCode } : {}),
  });
};

const unavailableForState = (
  snapshot: InternalSnapshot,
  input: LocalMlScoringInput,
  reasonCode?: RecommendationMlUnavailableReason,
): RecommendationMlUnavailableResult => {
  const state = domainFromSnapshot(snapshot, input.domain).diagnostics;
  const resolvedReason =
    reasonCode ??
    state.failureCode ??
    (state.state === 'LOADING'
      ? 'RUNTIME_LOADING'
      : state.state === 'FAILED'
        ? 'RUNTIME_FAILED'
        : 'RUNTIME_NOT_READY');
  return Object.freeze({
    outcome: 'ML_UNAVAILABLE' as const,
    mode: snapshot.publicSnapshot.mode,
    domain: input.domain,
    reasonCode: resolvedReason,
    diagnostics: requestDiagnostics(
      snapshot,
      input.domain,
      input.candidates.length,
    ),
  });
};

const scoreCapturedSnapshot = (
  snapshot: InternalSnapshot,
  input: LocalMlScoringInput,
): LocalMlContainedScoringResult | RecommendationMlUnavailableResult => {
  const domain = domainFromSnapshot(snapshot, input.domain);
  if (domain.diagnostics.state !== 'READY' || !domain.scorer) {
    return unavailableForState(snapshot, input);
  }
  return domain.scorer.score(input);
};

export const scoreRecommendationMlRuntimeForShadow = (
  input: LocalMlScoringInput,
): LocalMlContainedScoringResult | RecommendationMlUnavailableResult => {
  const snapshot = publishedSnapshot;
  if (snapshot.publicSnapshot.mode === 'DETERMINISTIC') {
    return unavailableForState(snapshot, input, 'RUNTIME_MODE_DISABLED');
  }
  return scoreCapturedSnapshot(snapshot, input);
};

export const rankMlPrimaryCandidates = (
  input: LocalMlScoringInput,
): RecommendationMlRankingResult => {
  const snapshot = publishedSnapshot;
  if (snapshot.publicSnapshot.mode === 'DETERMINISTIC') {
    return unavailableForState(snapshot, input, 'RUNTIME_MODE_DISABLED');
  }
  if (snapshot.publicSnapshot.mode !== 'ML_PRIMARY') {
    return unavailableForState(snapshot, input, 'RUNTIME_MODE_NOT_PRIMARY');
  }

  const result = scoreCapturedSnapshot(snapshot, input);
  if (result.outcome === 'ML_UNAVAILABLE') return result;
  if (result.outcome === 'UNAVAILABLE') {
    return Object.freeze({
      outcome: 'ML_UNAVAILABLE' as const,
      mode: 'ML_PRIMARY' as const,
      domain: input.domain,
      reasonCode: result.reasonCode,
      diagnostics: requestDiagnostics(
        snapshot,
        input.domain,
        input.candidates.length,
        result.diagnostics,
      ),
    });
  }
  return Object.freeze({
    outcome: 'ML_RANKED' as const,
    mode: 'ML_PRIMARY' as const,
    domain: input.domain,
    scored: result.scored,
    rankedCandidateKeys: result.rankedCandidateKeys,
    diagnostics: requestDiagnostics(
      snapshot,
      input.domain,
      input.candidates.length,
      result.diagnostics,
    ),
  });
};

/** @deprecated Alias — use rankMlPrimaryCandidates. */
export const rankMlLocalCandidates = rankMlPrimaryCandidates;

export const setRecommendationMlRuntimeDependenciesForTests = (
  overrides: Partial<RuntimeDependencies>,
): void => {
  dependencies = { ...defaultDependencies, ...overrides };
};

export const resetRecommendationMlRuntimeForTests = (): void => {
  dependencies = defaultDependencies;
  preloadPromise = undefined;
  publishedSnapshot = initialSnapshot(env.recommendationMlRuntimeMode);
};
