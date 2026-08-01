import { threadId } from 'node:worker_threads';

import test, { type TestOptions } from 'node:test';

import { env } from '../../config/env.js';
import { invalidateAllLearnerHomeResponseCaches } from '../learner-home/learner-home.service.js';
import { resetMlShadowTestStateForTests } from './ml-shadow.service.js';

export type RecommendationFlagState = {
  shadow: boolean;
  materialServing: boolean;
  projectServing: boolean;
  materialPath: string;
  projectPath: string;
};

export const captureRecommendationFlags = (): RecommendationFlagState => ({
  shadow: env.recommendationMlShadowEnabled,
  materialServing: env.recommendationMlMaterialServingEnabled,
  projectServing: env.recommendationMlProjectServingEnabled,
  materialPath: env.recommendationMlMaterialArtifactPath,
  projectPath: env.recommendationMlProjectArtifactPath,
});

export const applyRecommendationFlags = (flags: RecommendationFlagState): void => {
  env.recommendationMlShadowEnabled = flags.shadow;
  env.recommendationMlMaterialServingEnabled = flags.materialServing;
  env.recommendationMlProjectServingEnabled = flags.projectServing;
  env.recommendationMlMaterialArtifactPath = flags.materialPath;
  env.recommendationMlProjectArtifactPath = flags.projectPath;
};

export const RECOMMENDATION_PROCESS_ENV_KEYS = [
  'PREFLIGHT_MODE',
  'RECOMMENDATION_ML_SHADOW_ENABLED',
  'RECOMMENDATION_ML_MATERIAL_SERVING_ENABLED',
  'RECOMMENDATION_ML_PROJECT_SERVING_ENABLED',
  'RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH',
  'RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH',
] as const;

export type ProcessEnvPresence = 'absent' | 'empty' | 'value';

export type ProcessEnvEntry = { presence: ProcessEnvPresence; value?: string };

export type ProcessEnvSnapshot = Record<
  (typeof RECOMMENDATION_PROCESS_ENV_KEYS)[number],
  ProcessEnvEntry
>;

export type RecommendationTestIsolateProbe = {
  pid: number;
  threadId: number;
  testFileLabel: string;
};

const captureProcessEnvKey = (
  key: (typeof RECOMMENDATION_PROCESS_ENV_KEYS)[number],
): ProcessEnvEntry => {
  if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
    return { presence: 'absent' };
  }
  const value = process.env[key];
  if (value === '') {
    return { presence: 'empty' };
  }
  return { presence: 'value', value };
};

export const captureRecommendationProcessEnv = (): ProcessEnvSnapshot => {
  const snapshot = {} as ProcessEnvSnapshot;
  for (const key of RECOMMENDATION_PROCESS_ENV_KEYS) {
    snapshot[key] = captureProcessEnvKey(key);
  }
  return snapshot;
};

export const restoreRecommendationProcessEnv = (snapshot: ProcessEnvSnapshot): void => {
  for (const key of RECOMMENDATION_PROCESS_ENV_KEYS) {
    const entry = snapshot[key];
    if (entry.presence === 'absent') {
      delete process.env[key];
    } else if (entry.presence === 'empty') {
      process.env[key] = '';
    } else {
      process.env[key] = entry.value ?? '';
    }
  }
};

export const resetAllRecommendationTestStateForTests = (): void => {
  resetMlShadowTestStateForTests();
  invalidateAllLearnerHomeResponseCaches();
};

export const readRecommendationTestIsolateProbe = (
  testFileLabel: string,
): RecommendationTestIsolateProbe => ({
  pid: process.pid,
  threadId: threadId,
  testFileLabel,
});

let recommendationEnvLock = Promise.resolve();
let recommendationIsolationDepth = 0;

const runWithRecommendationIsolationSnapshots = async <T>(
  run: () => Promise<T>,
): Promise<T> => {
  const processSnapshot = captureRecommendationProcessEnv();
  const envSnapshot = captureRecommendationFlags();

  try {
    resetAllRecommendationTestStateForTests();
    return await run();
  } finally {
    applyRecommendationFlags(envSnapshot);
    restoreRecommendationProcessEnv(processSnapshot);
    resetAllRecommendationTestStateForTests();
  }
};

export const withRecommendationTestIsolation = async <T>(
  run: () => Promise<T>,
): Promise<T> => {
  if (recommendationIsolationDepth > 0) {
    return runWithRecommendationIsolationSnapshots(run);
  }

  let releaseLock!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const prior = recommendationEnvLock;
  recommendationEnvLock = prior.then(() => gate).catch(() => gate);
  await prior;

  recommendationIsolationDepth += 1;
  try {
    return await runWithRecommendationIsolationSnapshots(run);
  } finally {
    recommendationIsolationDepth -= 1;
    releaseLock();
  }
};

export const isolatedRecommendationTest = (
  name: string,
  fn: () => Promise<void> | void,
  options?: TestOptions,
): void => {
  test(
    name,
    { ...options, concurrency: false },
    async () => {
      await withRecommendationTestIsolation(async () => {
        await fn();
      });
    },
  );
};
