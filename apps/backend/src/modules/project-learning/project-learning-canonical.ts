import {
  canonicalJson,
  stableContentHash,
} from '../taxonomy/component-taxonomy-audit.js';

export const PROJECT_LEARNING_HASH_SCHEMA_VERSION = 1;

export { canonicalJson, stableContentHash };

export const computeProjectLearningContentHash = (snapshot: unknown): string =>
  stableContentHash({
    hashSchemaVersion: PROJECT_LEARNING_HASH_SCHEMA_VERSION,
    snapshot,
  });
