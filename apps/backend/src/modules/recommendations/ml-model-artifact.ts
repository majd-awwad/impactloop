import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

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
