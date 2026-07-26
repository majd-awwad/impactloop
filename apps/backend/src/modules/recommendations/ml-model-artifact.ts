import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { canonicalJson } from './local-ml-training-snapshot.schema.js';

export const PORTABLE_ARTIFACT_VERSION = 'impactloop-lightfm-portable-v1';
export const PORTABLE_FEATURE_SCHEMA = 'slice-3-approved-features-v1';
export const RUNTIME_FEATURE_SCHEMA = 'runtime-approved-features-v2';
export const BENCHMARK_A_ARTIFACT_CONTRACT = {
  catalogSnapshotHash: '94c3165783ba4fca06d959f9b9d566434793c03f79858c089ab9cbe26dcd4186',
  trainingDatasetHash: '99523dc1037e076b7472358581d7388cec3eb68b777555f8000e6d79879f4eb4',
  mappingHashes: {
    material: '9134fa696422546d1edafc2c88defcdacee39b19801e45c6094d6ce3bd8f82e3',
    project: '6e06d51dda79194108f14bdd89694819cd603ae5e72b7d8e44ae24bb19685448',
  },
} as const;

export type PortableFeature = { name: string; embedding: string[]; bias: string };
export type PortableModelArtifact = {
  artifact_version: string; model_version: string; domain: 'material' | 'project';
  feature_schema_version: string; latent_dimension: number; catalog_snapshot_hash: string;
  training_dataset_hash: string; mapping_hash: string; hyperparameters: Record<string, string>;
  python_version: string; lightfm_version: string; exported_at_utc: string;
  user_features: PortableFeature[]; item_features: PortableFeature[]; content_hash: string;
};

export const PORTABLE_ARTIFACT_V2_SCHEMA_VERSION =
  'impactloop-lightfm-portable-v2' as const;
export const PORTABLE_ARTIFACT_V2_MODEL_VERSION =
  'lm-06-local-lightfm-v1' as const;

export type PortableArtifactV2Domain = 'material' | 'project';
export type PortableArtifactV2MappingEntry = { token: string; index: number };
export type PortableArtifactV2ItemMappingEntry = {
  itemKey: string;
  index: number;
};
export type PortableModelArtifactV2 = {
  schemaVersion: typeof PORTABLE_ARTIFACT_V2_SCHEMA_VERSION;
  domain: PortableArtifactV2Domain;
  modelVersion: typeof PORTABLE_ARTIFACT_V2_MODEL_VERSION;
  featureContractId: string;
  featureContractVersion: string;
  aggregationMode: string;
  taxonomyFingerprint: string;
  datasetContentHash: string;
  featureMapping: {
    user: PortableArtifactV2MappingEntry[];
    item: PortableArtifactV2MappingEntry[];
  };
  featureMappingHash: string;
  itemMapping: PortableArtifactV2ItemMappingEntry[];
  itemMappingHash: string;
  trainingConfiguration: {
    randomSeed: number;
    loss: 'warp';
    epochs: 10;
    noComponents: 16 | 32;
    learningRate: '0.03';
    userAlpha: '0.000001';
    itemAlpha: '0.000001';
    numThreads: 1;
    interactionWeighting: 'unit-per-snapshot-event';
    duplicateInteractionAggregation: 'sum';
  };
  modelDimensions: {
    embeddingDimension: number;
    userFeatureCount: number;
    itemFeatureCount: number;
    itemCount: number;
  };
  modelComponents: {
    userFeatureEmbeddings: string[][];
    itemFeatureEmbeddings: string[][];
    userFeatureBiases: string[];
    itemFeatureBiases: string[];
  };
  semanticContentHash: string;
  createdAt: string;
};

export type PortableArtifactV2Expectations = {
  expectedDomain: PortableArtifactV2Domain;
  featureContractId: string;
  featureContractVersion: string;
  aggregationMode: string;
  taxonomyFingerprint: string;
  expectedDatasetContentHash?: string;
};

const sha256Canonical = (value: unknown): string =>
  createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');

export const computePortableArtifactV2FeatureMappingHash = (
  mapping: PortableModelArtifactV2['featureMapping'],
): string => sha256Canonical(mapping);

export const computePortableArtifactV2ItemMappingHash = (
  mapping: PortableModelArtifactV2['itemMapping'],
): string => sha256Canonical(mapping);

export const computePortableArtifactV2SemanticContentHash = (
  artifact: PortableModelArtifactV2,
): string => {
  const {
    semanticContentHash: _semanticContentHash,
    createdAt: _createdAt,
    ...semanticContent
  } = artifact;
  return sha256Canonical(semanticContent);
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

const exactKeys = (
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void => {
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (
    actual.length !== orderedExpected.length ||
    actual.some((key, index) => key !== orderedExpected[index])
  ) {
    throw new Error(`${label}_fields`);
  }
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const OPAQUE_KEY_PATTERN = /^[a-f0-9]{64}$/;

function assertHash(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw new Error(label);
  }
}

const validateV2FeatureMappingSide = (
  value: unknown,
  side: 'user' | 'item',
): PortableArtifactV2MappingEntry[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${side}_feature_mapping_missing_or_empty`);
  }
  const tokens = new Set<string>();
  const indices = new Set<number>();
  let priorToken: string | undefined;
  for (const [position, raw] of value.entries()) {
    if (!isPlainRecord(raw)) throw new Error(`${side}_feature_mapping_entry`);
    exactKeys(raw, ['token', 'index'], `${side}_feature_mapping_entry`);
    const token = raw.token;
    const index = raw.index;
    if (typeof token !== 'string' || token.length === 0 || tokens.has(token)) {
      throw new Error(`${side}_feature_mapping_token`);
    }
    if (/identity:/i.test(token)) {
      throw new Error(`${side}_feature_mapping_prohibited`);
    }
    if (
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      index !== position ||
      indices.has(index as number)
    ) {
      throw new Error(`${side}_feature_mapping_index`);
    }
    if (priorToken !== undefined && priorToken >= token) {
      throw new Error(`${side}_feature_mapping_order`);
    }
    priorToken = token;
    tokens.add(token);
    indices.add(index as number);
  }
  return value as PortableArtifactV2MappingEntry[];
};

const validateV2ItemMapping = (
  value: unknown,
): PortableArtifactV2ItemMappingEntry[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('item_mapping_missing_or_empty');
  }
  const keys = new Set<string>();
  const indices = new Set<number>();
  let priorKey: string | undefined;
  for (const [position, raw] of value.entries()) {
    if (!isPlainRecord(raw)) throw new Error('item_mapping_entry');
    exactKeys(raw, ['itemKey', 'index'], 'item_mapping_entry');
    const itemKey = raw.itemKey;
    const index = raw.index;
    if (
      typeof itemKey !== 'string' ||
      !OPAQUE_KEY_PATTERN.test(itemKey) ||
      keys.has(itemKey)
    ) {
      throw new Error('item_mapping_key');
    }
    if (
      !Number.isInteger(index) ||
      (index as number) < 0 ||
      index !== position ||
      indices.has(index as number)
    ) {
      throw new Error('item_mapping_index');
    }
    if (priorKey !== undefined && priorKey >= itemKey) {
      throw new Error('item_mapping_order');
    }
    priorKey = itemKey;
    keys.add(itemKey);
    indices.add(index as number);
  }
  return value as PortableArtifactV2ItemMappingEntry[];
};

const validateDecimal = (value: unknown, label: string): void => {
  if (
    typeof value !== 'string' ||
    !DECIMAL_PATTERN.test(value) ||
    !Number.isFinite(Number(value))
  ) {
    throw new Error(label);
  }
};

const validateComponentMatrix = (
  value: unknown,
  rows: number,
  columns: number,
  label: string,
): string[][] => {
  if (!Array.isArray(value) || value.length !== rows) {
    throw new Error(`${label}_shape`);
  }
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== columns) {
      throw new Error(`${label}_shape`);
    }
    for (const coordinate of row) validateDecimal(coordinate, `${label}_nonfinite`);
  }
  return value as string[][];
};

const validateComponentVector = (
  value: unknown,
  length: number,
  label: string,
): string[] => {
  if (!Array.isArray(value) || value.length !== length) {
    throw new Error(`${label}_shape`);
  }
  for (const coordinate of value) validateDecimal(coordinate, `${label}_nonfinite`);
  return value as string[];
};

export const validatePortableModelArtifactV2 = (
  raw: unknown,
  expected: PortableArtifactV2Expectations,
): PortableModelArtifactV2 => {
  if (!isPlainRecord(raw)) throw new Error('artifact_v2_not_object');
  exactKeys(
    raw,
    [
      'schemaVersion',
      'domain',
      'modelVersion',
      'featureContractId',
      'featureContractVersion',
      'aggregationMode',
      'taxonomyFingerprint',
      'datasetContentHash',
      'featureMapping',
      'featureMappingHash',
      'itemMapping',
      'itemMappingHash',
      'trainingConfiguration',
      'modelDimensions',
      'modelComponents',
      'semanticContentHash',
      'createdAt',
    ],
    'artifact_v2',
  );

  if (raw.schemaVersion !== PORTABLE_ARTIFACT_V2_SCHEMA_VERSION) {
    throw new Error('artifact_v2_schema_version');
  }
  if (raw.modelVersion !== PORTABLE_ARTIFACT_V2_MODEL_VERSION) {
    throw new Error('artifact_v2_model_version');
  }
  if (
    (raw.domain !== 'material' && raw.domain !== 'project') ||
    raw.domain !== expected.expectedDomain
  ) {
    throw new Error('artifact_v2_domain');
  }
  if (
    raw.featureContractId !== expected.featureContractId ||
    raw.featureContractVersion !== expected.featureContractVersion
  ) {
    throw new Error('artifact_v2_feature_contract');
  }
  if (raw.aggregationMode !== expected.aggregationMode) {
    throw new Error('artifact_v2_aggregation_mode');
  }
  assertHash(raw.taxonomyFingerprint, 'artifact_v2_taxonomy_fingerprint');
  if (raw.taxonomyFingerprint !== expected.taxonomyFingerprint) {
    throw new Error('artifact_v2_taxonomy_fingerprint_mismatch');
  }
  assertHash(raw.datasetContentHash, 'artifact_v2_dataset_content_hash');
  if (
    expected.expectedDatasetContentHash !== undefined &&
    raw.datasetContentHash !== expected.expectedDatasetContentHash
  ) {
    throw new Error('artifact_v2_dataset_content_hash_mismatch');
  }

  if (!isPlainRecord(raw.featureMapping)) {
    throw new Error('artifact_v2_feature_mapping');
  }
  exactKeys(raw.featureMapping, ['user', 'item'], 'artifact_v2_feature_mapping');
  const userMapping = validateV2FeatureMappingSide(raw.featureMapping.user, 'user');
  const itemFeatureMapping = validateV2FeatureMappingSide(
    raw.featureMapping.item,
    'item',
  );
  const allTokens = [...userMapping, ...itemFeatureMapping].map((entry) => entry.token);
  if (new Set(allTokens).size !== allTokens.length) {
    throw new Error('artifact_v2_feature_mapping_duplicate_token');
  }
  assertHash(raw.featureMappingHash, 'artifact_v2_feature_mapping_hash');
  if (
    raw.featureMappingHash !==
    computePortableArtifactV2FeatureMappingHash(
      raw.featureMapping as PortableModelArtifactV2['featureMapping'],
    )
  ) {
    throw new Error('artifact_v2_feature_mapping_hash_mismatch');
  }

  const itemMapping = validateV2ItemMapping(raw.itemMapping);
  assertHash(raw.itemMappingHash, 'artifact_v2_item_mapping_hash');
  if (
    raw.itemMappingHash !==
    computePortableArtifactV2ItemMappingHash(itemMapping)
  ) {
    throw new Error('artifact_v2_item_mapping_hash_mismatch');
  }

  if (!isPlainRecord(raw.trainingConfiguration)) {
    throw new Error('artifact_v2_training_configuration');
  }
  exactKeys(
    raw.trainingConfiguration,
    [
      'randomSeed',
      'loss',
      'epochs',
      'noComponents',
      'learningRate',
      'userAlpha',
      'itemAlpha',
      'numThreads',
      'interactionWeighting',
      'duplicateInteractionAggregation',
    ],
    'artifact_v2_training_configuration',
  );
  const training = raw.trainingConfiguration;
  const expectedComponents = raw.domain === 'material' ? 16 : 32;
  if (
    !Number.isInteger(training.randomSeed) ||
    (training.randomSeed as number) < 0 ||
    (training.randomSeed as number) > 0xffff_ffff ||
    training.loss !== 'warp' ||
    training.epochs !== 10 ||
    training.noComponents !== expectedComponents ||
    training.learningRate !== '0.03' ||
    training.userAlpha !== '0.000001' ||
    training.itemAlpha !== '0.000001' ||
    training.numThreads !== 1 ||
    training.interactionWeighting !== 'unit-per-snapshot-event' ||
    training.duplicateInteractionAggregation !== 'sum'
  ) {
    throw new Error('artifact_v2_training_configuration_value');
  }

  if (!isPlainRecord(raw.modelDimensions)) {
    throw new Error('artifact_v2_model_dimensions');
  }
  exactKeys(
    raw.modelDimensions,
    ['embeddingDimension', 'userFeatureCount', 'itemFeatureCount', 'itemCount'],
    'artifact_v2_model_dimensions',
  );
  const dimensions = raw.modelDimensions;
  for (const key of Object.keys(dimensions)) {
    const value = dimensions[key];
    if (!Number.isInteger(value) || (value as number) <= 0) {
      throw new Error('artifact_v2_model_dimensions_value');
    }
  }
  if (
    dimensions.embeddingDimension !== expectedComponents ||
    dimensions.userFeatureCount !== userMapping.length ||
    dimensions.itemFeatureCount !== itemFeatureMapping.length ||
    dimensions.itemCount !== itemMapping.length
  ) {
    throw new Error('artifact_v2_model_dimensions_mapping_mismatch');
  }

  if (!isPlainRecord(raw.modelComponents)) {
    throw new Error('artifact_v2_model_components');
  }
  exactKeys(
    raw.modelComponents,
    [
      'userFeatureEmbeddings',
      'itemFeatureEmbeddings',
      'userFeatureBiases',
      'itemFeatureBiases',
    ],
    'artifact_v2_model_components',
  );
  validateComponentMatrix(
    raw.modelComponents.userFeatureEmbeddings,
    userMapping.length,
    expectedComponents,
    'artifact_v2_user_embeddings',
  );
  validateComponentMatrix(
    raw.modelComponents.itemFeatureEmbeddings,
    itemFeatureMapping.length,
    expectedComponents,
    'artifact_v2_item_embeddings',
  );
  validateComponentVector(
    raw.modelComponents.userFeatureBiases,
    userMapping.length,
    'artifact_v2_user_biases',
  );
  validateComponentVector(
    raw.modelComponents.itemFeatureBiases,
    itemFeatureMapping.length,
    'artifact_v2_item_biases',
  );

  assertHash(raw.semanticContentHash, 'artifact_v2_semantic_content_hash');
  if (
    typeof raw.createdAt !== 'string' ||
    !raw.createdAt.endsWith('Z') ||
    !Number.isFinite(new Date(raw.createdAt).getTime())
  ) {
    throw new Error('artifact_v2_created_at');
  }
  const artifact = raw as PortableModelArtifactV2;
  if (
    artifact.semanticContentHash !==
    computePortableArtifactV2SemanticContentHash(artifact)
  ) {
    throw new Error('artifact_v2_semantic_content_hash_mismatch');
  }
  return artifact;
};

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const validateFeatures = (features: unknown, dimension: number, side: string): PortableFeature[] => {
  if (!Array.isArray(features)) throw new Error(`${side}_features_missing`);
  const names = new Set<string>();
  for (const feature of features as PortableFeature[]) {
    if (!feature || typeof feature.name !== 'string' || names.has(feature.name)) throw new Error(`${side}_feature_duplicate_or_invalid`);
    names.add(feature.name);
    if (!Array.isArray(feature.embedding) || feature.embedding.length !== dimension) throw new Error(`${side}_feature_dimension`);
    if (![feature.bias, ...feature.embedding].map(Number).every(Number.isFinite)) throw new Error(`${side}_feature_non_finite`);
    if (/identity:|material_type|hidden|cohort|SYNTHETIC_CATALOG_EXTENSION/i.test(feature.name)) throw new Error(`${side}_feature_prohibited`);
  }
  return features as PortableFeature[];
};

export const validatePortableModelArtifact = (raw: unknown, expectedDomain?: 'material' | 'project'): PortableModelArtifact => {
  if (!raw || typeof raw !== 'object') throw new Error('artifact_not_object');
  const artifact = raw as PortableModelArtifact;
  if (artifact.artifact_version !== PORTABLE_ARTIFACT_VERSION) throw new Error('artifact_version');
  if (![PORTABLE_FEATURE_SCHEMA, RUNTIME_FEATURE_SCHEMA].includes(artifact.feature_schema_version)) throw new Error('feature_schema');
  if (!['material', 'project'].includes(artifact.domain) || (expectedDomain && artifact.domain !== expectedDomain)) throw new Error('artifact_domain');
  if (artifact.catalog_snapshot_hash !== BENCHMARK_A_ARTIFACT_CONTRACT.catalogSnapshotHash) throw new Error('benchmark_a_snapshot_hash');
  if (artifact.training_dataset_hash !== BENCHMARK_A_ARTIFACT_CONTRACT.trainingDatasetHash) throw new Error('benchmark_a_training_hash');
  if (artifact.mapping_hash !== BENCHMARK_A_ARTIFACT_CONTRACT.mappingHashes[artifact.domain]) throw new Error('benchmark_a_mapping_hash');
  if (!Number.isInteger(artifact.latent_dimension) || artifact.latent_dimension <= 0) throw new Error('latent_dimension');
  validateFeatures(artifact.user_features, artifact.latent_dimension, 'user');
  validateFeatures(artifact.item_features, artifact.latent_dimension, 'item');
  if (artifact.feature_schema_version === RUNTIME_FEATURE_SCHEMA && artifact.user_features.some((feature) => !feature.name.startsWith('interest:'))) throw new Error('runtime_user_feature_contract');
  const { content_hash: claimed, ...content } = artifact;
  const actual = createHash('sha256').update(canonical(content)).digest('hex');
  if (claimed !== actual) throw new Error('artifact_content_hash');
  return artifact;
};

export const loadPortableModelArtifact = async (path: string, domain: 'material' | 'project') =>
  validatePortableModelArtifact(JSON.parse(await readFile(path, 'utf8')), domain);
