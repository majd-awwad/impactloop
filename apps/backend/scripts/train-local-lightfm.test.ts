import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import {
  LOCAL_ML_SNAPSHOT_EXCLUSION_REASONS,
  LOCAL_ML_SNAPSHOT_SCHEMA_VERSION,
  finalizeLocalMlTrainingSnapshot,
  serializeLocalMlTrainingSnapshot,
  stableOpaqueKey,
  type LocalMlTrainingSnapshot,
} from '../src/modules/recommendations/local-ml-training-snapshot.schema.js';
import {
  PORTABLE_ARTIFACT_V2_MODEL_VERSION,
  PORTABLE_ARTIFACT_V2_SCHEMA_VERSION,
  computePortableArtifactV2FeatureMappingHash,
  computePortableArtifactV2ItemMappingHash,
  computePortableArtifactV2SemanticContentHash,
  validatePortableModelArtifactV2,
  type PortableArtifactV2Expectations,
  type PortableModelArtifactV2,
} from '../src/modules/recommendations/ml-model-artifact.js';
import { parseTrainOptions, runLocalTraining } from './train-local-lightfm.js';

const taxonomyFingerprint =
  'c84173df47de8dfc547e5d68277fbf789b9e0a27561be08221e5e0d88d3db370';
const datasetContentHash = 'd'.repeat(64);
const temporaryRoots: string[] = [];

after(async () => {
  await Promise.all(
    temporaryRoots.map((path) => rm(path, { recursive: true, force: true })),
  );
});

const expectations = (
  domain: 'material' | 'project',
  datasetHash = datasetContentHash,
): PortableArtifactV2Expectations => ({
  expectedDomain: domain,
  featureContractId: 'recommendation-feature-token-contract-v3',
  featureContractVersion: '3.0.0',
  aggregationMode: 'weighted-sum',
  taxonomyFingerprint,
  expectedDatasetContentHash: datasetHash,
});

const artifactFixture = (domain: 'material' | 'project'): PortableModelArtifactV2 => {
  const dimension = domain === 'material' ? 16 : 32;
  const featureMapping = {
    user: [{ token: 'interest:arduino', index: 0 }],
    item: [
      {
        token:
          domain === 'material'
            ? 'material-family:electronics'
            : 'project-topic:robotics',
        index: 0,
      },
    ],
  };
  const itemMapping = [
    { itemKey: domain === 'material' ? 'a'.repeat(64) : 'b'.repeat(64), index: 0 },
  ];
  const artifact: PortableModelArtifactV2 = {
    schemaVersion: PORTABLE_ARTIFACT_V2_SCHEMA_VERSION,
    domain,
    modelVersion: PORTABLE_ARTIFACT_V2_MODEL_VERSION,
    featureContractId: 'recommendation-feature-token-contract-v3',
    featureContractVersion: '3.0.0',
    aggregationMode: 'weighted-sum',
    taxonomyFingerprint,
    datasetContentHash,
    featureMapping,
    featureMappingHash: computePortableArtifactV2FeatureMappingHash(featureMapping),
    itemMapping,
    itemMappingHash: computePortableArtifactV2ItemMappingHash(itemMapping),
    trainingConfiguration: {
      randomSeed: 11,
      loss: 'warp',
      epochs: 10,
      noComponents: dimension,
      learningRate: '0.03',
      userAlpha: '0.000001',
      itemAlpha: '0.000001',
      numThreads: 1,
      interactionWeighting: 'unit-per-snapshot-event',
      duplicateInteractionAggregation: 'sum',
    },
    modelDimensions: {
      embeddingDimension: dimension,
      userFeatureCount: 1,
      itemFeatureCount: 1,
      itemCount: 1,
    },
    modelComponents: {
      userFeatureEmbeddings: [Array<string>(dimension).fill('0.1')],
      itemFeatureEmbeddings: [Array<string>(dimension).fill('0.2')],
      userFeatureBiases: ['0.01'],
      itemFeatureBiases: ['0.02'],
    },
    semanticContentHash: '',
    createdAt: '2026-07-26T12:00:00.000Z',
  };
  artifact.semanticContentHash = computePortableArtifactV2SemanticContentHash(artifact);
  return artifact;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

describe('LM-06 portable v2 validator', () => {
  test('accepts an exact artifact and excludes createdAt from semantic hashing', () => {
    const artifact = artifactFixture('material');
    assert.equal(validatePortableModelArtifactV2(artifact, expectations('material')), artifact);
    const changed = { ...artifact, createdAt: '2026-07-26T12:01:00.000Z' };
    assert.equal(
      computePortableArtifactV2SemanticContentHash(changed),
      artifact.semanticContentHash,
    );
    validatePortableModelArtifactV2(changed, expectations('material'));
  });

  const cases: Array<[string, (artifact: any) => void]> = [
    ['missing feature mapping', (artifact) => delete artifact.featureMapping],
    ['missing item mapping', (artifact) => delete artifact.itemMapping],
    [
      'duplicate feature token',
      (artifact) => artifact.featureMapping.user.push({ token: 'interest:arduino', index: 1 }),
    ],
    [
      'duplicate feature index',
      (artifact) => artifact.featureMapping.user.push({ token: 'interest:robotics', index: 0 }),
    ],
    [
      'duplicate item key',
      (artifact) => artifact.itemMapping.push({ itemKey: artifact.itemMapping[0].itemKey, index: 1 }),
    ],
    [
      'duplicate item index',
      (artifact) => artifact.itemMapping.push({ itemKey: 'c'.repeat(64), index: 0 }),
    ],
    ['negative mapping index', (artifact) => (artifact.itemMapping[0].index = -1)],
    ['non-contiguous mapping index', (artifact) => (artifact.itemMapping[0].index = 1)],
    ['invalid mapping index', (artifact) => (artifact.itemMapping[0].index = 0.5)],
    ['prohibited identity feature', (artifact) => (artifact.featureMapping.user[0].token = 'identity:user-1')],
    [
      'nonfinite model component',
      (artifact) => (artifact.modelComponents.userFeatureEmbeddings[0][0] = 'NaN'),
    ],
    [
      'positive infinity model component',
      (artifact) => (artifact.modelComponents.itemFeatureBiases[0] = 'Infinity'),
    ],
    [
      'negative infinity model component',
      (artifact) => (artifact.modelComponents.itemFeatureBiases[0] = '-Infinity'),
    ],
    [
      'component shape mismatch',
      (artifact) => artifact.modelComponents.userFeatureEmbeddings[0].pop(),
    ],
    ['missing component array', (artifact) => delete artifact.modelComponents.itemFeatureBiases],
    ['feature contract mismatch', (artifact) => (artifact.featureContractVersion = '99.0.0')],
    ['aggregation mismatch', (artifact) => (artifact.aggregationMode = 'unsupported')],
    ['taxonomy mismatch', (artifact) => (artifact.taxonomyFingerprint = '0'.repeat(64))],
    ['mapping hash mismatch', (artifact) => (artifact.featureMappingHash = '0'.repeat(64))],
    ['item mapping hash mismatch', (artifact) => (artifact.itemMappingHash = '0'.repeat(64))],
    ['integrity tampering', (artifact) => (artifact.semanticContentHash = '0'.repeat(64))],
    ['unsupported schema', (artifact) => (artifact.schemaVersion = 'unsupported-v99')],
    ['unsupported model version', (artifact) => (artifact.modelVersion = 'unsupported-model')],
    ['missing required metadata', (artifact) => delete artifact.createdAt],
  ];

  for (const [name, mutate] of cases) {
    test(`rejects ${name}`, () => {
      const artifact: any = clone(artifactFixture('material'));
      mutate(artifact);
      assert.throws(() => validatePortableModelArtifactV2(artifact, expectations('material')));
    });
  }

  test('rejects domain and dataset expectation mismatches', () => {
    const material = artifactFixture('material');
    assert.throws(() => validatePortableModelArtifactV2(material, expectations('project')));
    assert.throws(() =>
      validatePortableModelArtifactV2(material, expectations('material', 'e'.repeat(64))),
    );
  });
});

const zeroExclusions = () =>
  Object.fromEntries(LOCAL_ML_SNAPSHOT_EXCLUSION_REASONS.map((reason) => [reason, 0]));

const syntheticSnapshot = (): LocalMlTrainingSnapshot => {
  const users = ['u-1', 'u-2'].map((value, index) => ({
    userKey: stableOpaqueKey('user', value),
    featureTokens: [index === 0 ? 'interest:arduino' : 'interest:robotics'],
  }));
  users.sort((left, right) => left.userKey.localeCompare(right.userKey));
  const materialItems = ['m-1', 'm-2'].map((value, index) => ({
    materialKey: stableOpaqueKey('material', value),
    eligibilityState: 'AVAILABLE' as const,
    featureTokens: [
      'material-condition:good',
      `material-delivery-allowed:${index === 0 ? 'false' : 'true'}`,
      'material-family:electronics',
      `material-is-free:${index === 0 ? 'false' : 'true'}`,
      `material-pickup-allowed:${index === 0 ? 'true' : 'false'}`,
    ].sort(),
  }));
  materialItems.sort((left, right) => left.materialKey.localeCompare(right.materialKey));
  const projectItems = ['p-1', 'p-2'].map((value, index) => ({
    projectKey: stableOpaqueKey('project', value),
    eligibilityState: 'PUBLISHED' as const,
    featureTokens: [
      `project-difficulty:${index === 0 ? 'beginner' : 'advanced'}`,
      `project-topic:${index === 0 ? 'robotics' : 'electronics'}`,
    ].sort(),
  }));
  projectItems.sort((left, right) => left.projectKey.localeCompare(right.projectKey));
  const materialInteractions = users.map((user, index) => ({
    interactionKey: stableOpaqueKey('interaction', `material-${index}`),
    domain: 'material' as const,
    kind: 'MATERIAL_LIKE' as const,
    userKey: user.userKey,
    materialKey: materialItems[index]!.materialKey,
    origin: 'DEMO_SEED' as const,
    occurredAtUtc: `2026-07-26T10:0${index}:00.000Z`,
  }));
  const projectInteractions = users.map((user, index) => ({
    interactionKey: stableOpaqueKey('interaction', `project-${index}`),
    domain: 'project' as const,
    kind: 'PROJECT_SAVE' as const,
    userKey: user.userKey,
    projectKey: projectItems[index]!.projectKey,
    origin: 'DEMO_SEED' as const,
    occurredAtUtc: `2026-07-26T10:0${index}:00.000Z`,
  }));
  materialInteractions.sort(
    (left, right) =>
      `${left.occurredAtUtc}\0${left.interactionKey}`.localeCompare(
        `${right.occurredAtUtc}\0${right.interactionKey}`,
      ),
  );
  projectInteractions.sort(
    (left, right) =>
      `${left.occurredAtUtc}\0${left.interactionKey}`.localeCompare(
        `${right.occurredAtUtc}\0${right.interactionKey}`,
      ),
  );
  return finalizeLocalMlTrainingSnapshot({
    metadata: {
      schemaVersion: LOCAL_ML_SNAPSHOT_SCHEMA_VERSION,
      evaluationTimestampUtc: '2026-07-26T12:00:00.000Z',
      exportMode: 'LOCAL_DEMO',
      originPolicy: {
        included: ['REAL', 'DEMO_SEED'],
        excluded: [
          'TEST',
          'LOAD_TEST',
          'SYNTHETIC',
          'LEGACY_UNCLASSIFIED',
          'MISSING',
          'UNKNOWN',
        ],
      },
      counts: {
        users: { sourceTotal: 2, exported: 2, excluded: 0 },
        materialItems: { sourceTotal: 2, exported: 2, excluded: 0 },
        projectItems: { sourceTotal: 2, exported: 2, excluded: 0 },
        materialInteractions: {
          sourceTotal: 2,
          exported: 2,
          excluded: 0,
          byKind: { MATERIAL_LIKE: 2, MATERIAL_VIEW: 0 },
        },
        projectInteractions: {
          sourceTotal: 2,
          exported: 2,
          excluded: 0,
          byKind: {
            PROJECT_SAVE: 2,
            PROJECT_LIKE: 0,
            PROJECT_FOLLOW: 0,
            PROJECT_BUILD_STARTED: 0,
            PROJECT_BUILD_COMPLETED: 0,
          },
        },
      },
      exclusionTotals: zeroExclusions() as any,
      diagnostics: { sampleLimit: 8, reasons: [] },
    },
    users,
    materialItems,
    projectItems,
    materialInteractions,
    projectInteractions,
  });
};

let successfulRuns:
  | Promise<{
      root: string;
      snapshotPath: string;
      outputA: string;
      resultA: Awaited<ReturnType<typeof runLocalTraining>>;
      resultB: Awaited<ReturnType<typeof runLocalTraining>>;
    }>
  | undefined;

const prepareSuccessfulRuns = () => {
  successfulRuns ??= (async () => {
    const root = await mkdtemp(join(tmpdir(), 'impactloop-lm06-'));
    temporaryRoots.push(root);
    const snapshotPath = join(root, 'snapshot.json');
    await writeFile(snapshotPath, serializeLocalMlTrainingSnapshot(syntheticSnapshot()), 'utf8');
    const outputA = join(root, 'output-a');
    const outputB = join(root, 'output-b');
    const validationPointerStates: boolean[] = [];
    const resultA = await runLocalTraining(
      { snapshot: snapshotPath, outputRoot: outputA, seed: 11, python: process.env.IMPACTLOOP_ML_PYTHON },
      {
        validateArtifact: (raw, expected) => {
          validationPointerStates.push(existsSync(join(outputA, 'current.json')));
          return validatePortableModelArtifactV2(raw, expected);
        },
      },
    );
    assert.deepEqual(validationPointerStates, [false, false]);
    const resultB = await runLocalTraining({
      snapshot: snapshotPath,
      outputRoot: outputB,
      seed: 11,
      python: process.env.IMPACTLOOP_ML_PYTHON,
    });
    return { root, snapshotPath, outputA, resultA, resultB };
  })();
  return successfulRuns;
};

describe('LM-06 local training orchestration', () => {
  test('preserves a WSL-qualified Python interpreter override', () => {
    const python = 'wsl:Ubuntu:/home/majd/.impactloop-envs/recommendation-py311/bin/python';
    assert.equal(
      parseTrainOptions(['--snapshot', 'snapshot.json', '--python', python]).python,
      python,
    );
  });

  test('synthetic successful path trains, validates, publishes, and reproduces', async () => {
    const { snapshotPath, outputA, resultA, resultB } = await prepareSuccessfulRuns();
    assert.equal(resultA.material.domain, 'material');
    assert.equal(resultA.project.domain, 'project');
    assert.equal(resultA.material.aggregationMode, 'weighted-sum');
    assert.equal(resultA.project.aggregationMode, 'weighted-sum');
    assert.equal(resultA.material.taxonomyFingerprint, taxonomyFingerprint);
    assert.equal(resultA.project.taxonomyFingerprint, taxonomyFingerprint);
    assert.equal(resultA.material.datasetContentHash, resultA.project.datasetContentHash);
    assert.notDeepEqual(resultA.material.itemMapping, resultA.project.itemMapping);
    assert.equal(
      resultA.material.semanticContentHash,
      resultB.material.semanticContentHash,
    );
    assert.equal(
      resultA.project.semanticContentHash,
      resultB.project.semanticContentHash,
    );
    assert.ok(existsSync(join(outputA, 'current.json')));
    assert.ok(existsSync(join(outputA, resultA.pointer.material.path)));
    assert.ok(existsSync(join(outputA, resultA.pointer.project.path)));
    const duplicate = await runLocalTraining({
      snapshot: snapshotPath,
      outputRoot: outputA,
      seed: 11,
      python: process.env.IMPACTLOOP_ML_PYTHON,
    });
    assert.equal(duplicate.pointer.setId, resultA.pointer.setId);
    assert.equal(
      JSON.parse(await readFile(join(outputA, 'current.json'), 'utf8')).setId,
      resultA.pointer.setId,
    );
  });

  test('atomic publication failure preserves the previous complete set', async () => {
    const { snapshotPath, outputA, resultA } = await prepareSuccessfulRuns();
    const pointerPath = join(outputA, 'current.json');
    const previousPointer = await readFile(pointerPath, 'utf8');
    const materialSource = join(outputA, resultA.pointer.material.path);
    const projectSource = join(outputA, resultA.pointer.project.path);
    let validationCount = 0;
    await assert.rejects(() =>
      runLocalTraining(
        { snapshot: snapshotPath, outputRoot: outputA, seed: 11 },
        {
          runPython: async ({ outputDirectory }) => {
            await copyFile(materialSource, join(outputDirectory, 'material-lightfm-v2.json'));
            await copyFile(projectSource, join(outputDirectory, 'project-lightfm-v2.json'));
          },
          validateArtifact: (raw, expected) => {
            validationCount += 1;
            if (expected.expectedDomain === 'project') throw new Error('injected_project_failure');
            return validatePortableModelArtifactV2(raw, expected);
          },
        },
      ),
    );
    assert.equal(validationCount, 2);
    assert.equal(await readFile(pointerPath, 'utf8'), previousPointer);
    assert.ok(existsSync(materialSource));
    assert.ok(existsSync(projectSource));
    const staging = join(outputA, '.staging');
    assert.deepEqual(existsSync(staging) ? await readdir(staging) : [], []);
  });

  test('existing set content mismatch fails closed without changing current', async () => {
    const { root, snapshotPath, outputA, resultA } = await prepareSuccessfulRuns();
    const pointerPath = join(outputA, 'current.json');
    const previousPointer = await readFile(pointerPath, 'utf8');
    const currentMaterialPath = join(outputA, resultA.pointer.material.path);
    const currentProjectPath = join(outputA, resultA.pointer.project.path);
    const [previousMaterial, previousProject] = await Promise.all([
      readFile(currentMaterialPath, 'utf8'),
      readFile(currentProjectPath, 'utf8'),
    ]);

    const seed29Output = join(root, 'output-seed-29');
    const expected = await runLocalTraining({
      snapshot: snapshotPath,
      outputRoot: seed29Output,
      seed: 29,
      python: process.env.IMPACTLOOP_ML_PYTHON,
    });
    assert.notEqual(expected.pointer.setId, resultA.pointer.setId);
    assert.notEqual(
      expected.material.semanticContentHash,
      resultA.material.semanticContentHash,
    );
    assert.notEqual(
      expected.project.semanticContentHash,
      resultA.project.semanticContentHash,
    );

    const conflictingSet = join(outputA, 'sets', expected.pointer.setId);
    assert.equal(existsSync(conflictingSet), false);
    await mkdir(conflictingSet, { recursive: true });
    const conflictingMaterialPath = join(conflictingSet, 'material-lightfm-v2.json');
    const conflictingProjectPath = join(conflictingSet, 'project-lightfm-v2.json');
    await Promise.all([
      copyFile(currentMaterialPath, conflictingMaterialPath),
      copyFile(currentProjectPath, conflictingProjectPath),
    ]);
    const [conflictingMaterial, conflictingProject] = await Promise.all([
      readFile(conflictingMaterialPath, 'utf8'),
      readFile(conflictingProjectPath, 'utf8'),
    ]);

    const trainedMaterialPath = join(seed29Output, expected.pointer.material.path);
    const trainedProjectPath = join(seed29Output, expected.pointer.project.path);
    await assert.rejects(
      () =>
        runLocalTraining(
          { snapshot: snapshotPath, outputRoot: outputA, seed: 29 },
          {
            runPython: async ({ outputDirectory }) => {
              await Promise.all([
                copyFile(
                  trainedMaterialPath,
                  join(outputDirectory, 'material-lightfm-v2.json'),
                ),
                copyFile(
                  trainedProjectPath,
                  join(outputDirectory, 'project-lightfm-v2.json'),
                ),
              ]);
            },
          },
        ),
      /set_publication: existing_set_content_mismatch/,
    );

    assert.equal(await readFile(pointerPath, 'utf8'), previousPointer);
    assert.equal(await readFile(currentMaterialPath, 'utf8'), previousMaterial);
    assert.equal(await readFile(currentProjectPath, 'utf8'), previousProject);
    assert.equal(await readFile(conflictingMaterialPath, 'utf8'), conflictingMaterial);
    assert.equal(await readFile(conflictingProjectPath, 'utf8'), conflictingProject);
    const pointer = JSON.parse(previousPointer) as typeof resultA.pointer;
    assert.equal(pointer.setId, resultA.pointer.setId);
    assert.equal(
      pointer.material.semanticContentHash,
      resultA.material.semanticContentHash,
    );
    assert.equal(
      pointer.project.semanticContentHash,
      resultA.project.semanticContentHash,
    );
    assert.notEqual(pointer.setId, expected.pointer.setId);
    const staging = join(outputA, '.staging');
    assert.deepEqual(existsSync(staging) ? await readdir(staging) : [], []);
  });
});
