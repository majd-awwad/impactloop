import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalJson,
  parseEvaluationTimestamp,
  semanticSnapshotHash,
  validateLocalMlTrainingSnapshot,
  type LocalMlTrainingSnapshot,
} from '../src/modules/recommendations/local-ml-training-snapshot.schema.js';
import {
  PORTABLE_ARTIFACT_V2_MODEL_VERSION,
  PORTABLE_ARTIFACT_V2_SCHEMA_VERSION,
  validatePortableModelArtifactV2,
  type PortableArtifactV2Domain,
  type PortableArtifactV2Expectations,
  type PortableModelArtifactV2,
} from '../src/modules/recommendations/ml-model-artifact.js';
import { loadRecommendationFeatureTokenContract } from '../src/modules/recommendations/recommendation-feature-token-contract.js';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(scriptDirectory, '..', '..', '..');
export const defaultOutputRoot = resolve(
  repositoryRoot,
  'ml',
  'recommendation',
  'generated',
  'local-lightfm',
);
const aggregationContractPath = resolve(
  repositoryRoot,
  'ml',
  'recommendation',
  'aggregation-contract-v1.json',
);
const pythonModule = 'ml.recommendation.train_local_lightfm';
const domains = ['material', 'project'] as const;
const hashPattern = /^[a-f0-9]{64}$/;
const wslPythonPattern = /^wsl:([^:]+):(\/.+)$/;

type Domain = (typeof domains)[number];

type LocalAggregationContract = {
  schemaVersion: string;
  selectedMode: string;
  runtimeActivation: string;
};

export type TrainLocalOptions = {
  evaluationTime?: string;
  seed: number;
  outputRoot: string;
  python?: string;
  snapshot?: string;
};

export type PublishedSetPointer = {
  schemaVersion: 'impactloop-local-lightfm-set-v1';
  setId: string;
  datasetContentHash: string;
  seed: number;
  material: { path: string; semanticContentHash: string };
  project: { path: string; semanticContentHash: string };
  publishedAt: string;
};

export type TrainLocalDependencies = {
  validateArtifact?: typeof validatePortableModelArtifactV2;
  runPython?: typeof runPythonTrainer;
  now?: () => Date;
};

const boundedMessage = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).replaceAll(/\s+/g, ' ').slice(0, 500);

const stage = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    throw new Error(`${name}: ${boundedMessage(error)}`, { cause: error });
  }
};

const resolveFromRepository = (value: string): string =>
  isAbsolute(value) ? resolve(value) : resolve(repositoryRoot, value);

const readOption = (argv: readonly string[], name: string): string | undefined => {
  const direct = argv.indexOf(name);
  if (direct >= 0) {
    const value = argv[direct + 1];
    if (!value || value.startsWith('--')) throw new Error(`${name} requires a value`);
    return value;
  }
  const prefix = `${name}=`;
  return argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length);
};

const assertSupportedArguments = (
  argv: readonly string[],
  supported: ReadonlySet<string>,
): void => {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const name = argument?.split('=', 1)[0];
    if (!argument?.startsWith('--') || !name || !supported.has(name)) {
      throw new Error(`Unsupported argument: ${argument ?? ''}`);
    }
    if (!argument.includes('=')) index += 1;
  }
};

export const parseTrainOptions = (argv: readonly string[]): TrainLocalOptions => {
  assertSupportedArguments(
    argv,
    new Set(['--evaluation-time', '--seed', '--output', '--python', '--snapshot']),
  );
  const evaluationTime = readOption(argv, '--evaluation-time');
  const snapshotValue = readOption(argv, '--snapshot');
  if (!snapshotValue && !evaluationTime) {
    throw new Error('--evaluation-time is required unless --snapshot is provided');
  }
  if (evaluationTime) parseEvaluationTimestamp(evaluationTime);
  const seedValue = readOption(argv, '--seed');
  const seed = seedValue === undefined ? 11 : Number(seedValue);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
    throw new Error('--seed must be an integer from 0 through 4294967295');
  }
  const output = readOption(argv, '--output');
  const python = readOption(argv, '--python');
  return {
    evaluationTime,
    seed,
    outputRoot: output ? resolveFromRepository(output) : defaultOutputRoot,
    python: python
      ? wslPythonPattern.test(python)
        ? python
        : resolveFromRepository(python)
      : undefined,
    snapshot: snapshotValue ? resolveFromRepository(snapshotValue) : undefined,
  };
};

export const loadAndValidateSnapshot = async (
  path: string,
): Promise<LocalMlTrainingSnapshot> => {
  const raw = JSON.parse(await readFile(path, 'utf8')) as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('snapshot_not_object');
  }
  const snapshot = raw as LocalMlTrainingSnapshot;
  if (
    snapshot.hashes?.semanticContent?.algorithm !== 'sha256' ||
    typeof snapshot.hashes.semanticContent.value !== 'string' ||
    !hashPattern.test(snapshot.hashes.semanticContent.value)
  ) {
    throw new Error('snapshot_semantic_hash_missing');
  }
  const { hashes: _hashes, ...content } = snapshot;
  validateLocalMlTrainingSnapshot(content);
  const actual = semanticSnapshotHash({
    ...content,
    hashes: { semanticContent: { algorithm: 'sha256' } },
  });
  if (actual !== snapshot.hashes.semanticContent.value) {
    throw new Error('snapshot_semantic_hash_mismatch');
  }
  return snapshot;
};

const loadContracts = async (): Promise<{
  featureContract: Awaited<ReturnType<typeof loadRecommendationFeatureTokenContract>>;
  aggregation: LocalAggregationContract;
}> => {
  const [featureContract, aggregationRaw] = await Promise.all([
    loadRecommendationFeatureTokenContract(),
    readFile(aggregationContractPath, 'utf8'),
  ]);
  const aggregation = JSON.parse(aggregationRaw) as LocalAggregationContract;
  if (
    aggregation.schemaVersion !== 'impactloop-local-aggregation-contract-v1' ||
    aggregation.selectedMode !== 'weighted-sum' ||
    aggregation.runtimeActivation !== 'INACTIVE'
  ) {
    throw new Error('local_aggregation_contract_invalid');
  }
  return { featureContract, aggregation };
};

const expectationsFor = (
  domain: Domain,
  datasetContentHash: string,
  contracts: Awaited<ReturnType<typeof loadContracts>>,
): PortableArtifactV2Expectations => ({
  expectedDomain: domain,
  featureContractId: contracts.featureContract.contractId,
  featureContractVersion: contracts.featureContract.contractVersion,
  aggregationMode: contracts.aggregation.selectedMode,
  taxonomyFingerprint:
    contracts.featureContract.taxonomyCompatibility.taxonomyVocabularyFingerprint,
  expectedDatasetContentHash: datasetContentHash,
});

const resolvePython = (explicit?: string): string => {
  if (explicit) return explicit;
  if (process.env.IMPACTLOOP_ML_PYTHON?.trim()) {
    return process.env.IMPACTLOOP_ML_PYTHON.trim();
  }
  const candidates = [
    resolve(repositoryRoot, 'ml', 'recommendation', 'conda-env', 'python.exe'),
    resolve(repositoryRoot, 'ml', 'recommendation', '.venv311', 'Scripts', 'python.exe'),
    resolve(repositoryRoot, 'ml', 'recommendation', '.venv', 'Scripts', 'python.exe'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? 'python';
};

const windowsPathForWsl = (path: string): string => {
  const match = /^([a-zA-Z]):[\\/](.*)$/.exec(resolve(path));
  if (!match) throw new Error(`wsl_path_unsupported: ${path}`);
  return `/mnt/${match[1]!.toLowerCase()}/${match[2]!.replaceAll('\\', '/')}`;
};

export const runPythonTrainer = async (input: {
  python: string;
  snapshotPath: string;
  outputDirectory: string;
  seed: number;
}): Promise<void> => {
  await new Promise<void>((accept, reject) => {
    const pythonArguments = [
      '-m',
      pythonModule,
      '--snapshot',
      input.snapshotPath,
      '--output-dir',
      input.outputDirectory,
      '--seed',
      String(input.seed),
    ];
    const wslPython = wslPythonPattern.exec(input.python);
    const executable = wslPython ? 'wsl.exe' : input.python;
    const arguments_ = wslPython
      ? [
          '-d',
          wslPython[1]!,
          '--cd',
          windowsPathForWsl(repositoryRoot),
          '--',
          'env',
          `PYTHONHASHSEED=${input.seed}`,
          wslPython[2]!,
          ...pythonArguments.map((argument) =>
            /^[a-zA-Z]:[\\/]/.test(argument) ? windowsPathForWsl(argument) : argument,
          ),
        ]
      : pythonArguments;
    const child = spawn(
      executable,
      arguments_,
      {
        cwd: repositoryRoot,
        env: { ...process.env, PYTHONHASHSEED: String(input.seed) },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let stdout = '';
    let stderr = '';
    const append = (current: string, chunk: Buffer): string =>
      `${current}${chunk.toString('utf8')}`.slice(-4_000);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk);
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) accept();
      else reject(new Error(`python_exit_${code ?? 'unknown'}: ${boundedMessage(stderr || stdout)}`));
    });
  });
};

const readArtifact = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8')) as unknown;

const setIdFor = (
  material: PortableModelArtifactV2,
  project: PortableModelArtifactV2,
  seed: number,
): string =>
  createHash('sha256')
    .update(
      canonicalJson({
        datasetContentHash: material.datasetContentHash,
        materialSemanticContentHash: material.semanticContentHash,
        projectSemanticContentHash: project.semanticContentHash,
        seed,
      }),
      'utf8',
    )
    .digest('hex');

const writePointerAtomically = async (
  outputRoot: string,
  runId: string,
  pointer: PublishedSetPointer,
): Promise<void> => {
  const destination = join(outputRoot, 'current.json');
  const temporary = join(outputRoot, `current.json.${runId}.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(pointer, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }
};

export const runLocalTraining = async (
  options: TrainLocalOptions,
  dependencies: TrainLocalDependencies = {},
): Promise<{
  pointer: PublishedSetPointer;
  material: PortableModelArtifactV2;
  project: PortableModelArtifactV2;
  outputRoot: string;
}> => {
  const validateArtifact = dependencies.validateArtifact ?? validatePortableModelArtifactV2;
  const invokePython = dependencies.runPython ?? runPythonTrainer;
  const now = dependencies.now ?? (() => new Date());
  const outputRoot = resolve(options.outputRoot);
  const runId = randomUUID();
  const stagingRoot = join(outputRoot, '.staging');
  const runRoot = join(stagingRoot, runId);
  const stagingSet = join(runRoot, 'set');
  const stagedSnapshot = join(runRoot, 'snapshot.json');
  let primaryFailure: unknown;
  let result:
    | {
        pointer: PublishedSetPointer;
        material: PortableModelArtifactV2;
        project: PortableModelArtifactV2;
        outputRoot: string;
      }
    | undefined;

  await mkdir(stagingRoot, { recursive: true });
  await mkdir(runRoot, { recursive: false });
  await mkdir(stagingSet, { recursive: false });
  try {
    if (options.snapshot) {
      await stage('snapshot_copy', async () => copyFile(options.snapshot!, stagedSnapshot));
    } else {
      await stage('snapshot_export', async () => {
        const exporter = await import('./export-local-ml-training-snapshot.js');
        const exported = await exporter.buildLocalMlSnapshotFromDatabase(
          parseEvaluationTimestamp(options.evaluationTime!),
        );
        await exporter.writeSnapshotAtomically(stagedSnapshot, exported.snapshot);
      });
    }
    const snapshot = await stage('snapshot_validation', () =>
      loadAndValidateSnapshot(stagedSnapshot),
    );
    const contracts = await stage('contract_validation', loadContracts);
    await stage('python_training', () =>
      invokePython({
        python: resolvePython(options.python),
        snapshotPath: stagedSnapshot,
        outputDirectory: stagingSet,
        seed: options.seed,
      }),
    );

    const materialPath = join(stagingSet, 'material-lightfm-v2.json');
    const projectPath = join(stagingSet, 'project-lightfm-v2.json');
    const material = await stage('material_artifact_validation', async () =>
      validateArtifact(
        await readArtifact(materialPath),
        expectationsFor('material', snapshot.hashes.semanticContent.value, contracts),
      ),
    );
    const project = await stage('project_artifact_validation', async () =>
      validateArtifact(
        await readArtifact(projectPath),
        expectationsFor('project', snapshot.hashes.semanticContent.value, contracts),
      ),
    );

    const setId = setIdFor(material, project, options.seed);
    const finalSet = join(outputRoot, 'sets', setId);
    await stage('set_publication', async () => {
      await mkdir(dirname(finalSet), { recursive: true });
      if (existsSync(finalSet)) {
        const existingMaterial = validateArtifact(
          await readArtifact(join(finalSet, 'material-lightfm-v2.json')),
          expectationsFor('material', snapshot.hashes.semanticContent.value, contracts),
        );
        const existingProject = validateArtifact(
          await readArtifact(join(finalSet, 'project-lightfm-v2.json')),
          expectationsFor('project', snapshot.hashes.semanticContent.value, contracts),
        );
        if (
          existingMaterial.semanticContentHash !== material.semanticContentHash ||
          existingProject.semanticContentHash !== project.semanticContentHash ||
          existingMaterial.datasetContentHash !== snapshot.hashes.semanticContent.value ||
          existingProject.datasetContentHash !== snapshot.hashes.semanticContent.value ||
          setIdFor(existingMaterial, existingProject, options.seed) !== setId
        ) {
          throw new Error('existing_set_content_mismatch');
        }
        await rm(stagingSet, { recursive: true, force: false });
      } else {
        await rename(stagingSet, finalSet);
      }
    });

    const pointer: PublishedSetPointer = {
      schemaVersion: 'impactloop-local-lightfm-set-v1',
      setId,
      datasetContentHash: snapshot.hashes.semanticContent.value,
      seed: options.seed,
      material: {
        path: `sets/${setId}/material-lightfm-v2.json`,
        semanticContentHash: material.semanticContentHash,
      },
      project: {
        path: `sets/${setId}/project-lightfm-v2.json`,
        semanticContentHash: project.semanticContentHash,
      },
      publishedAt: now().toISOString(),
    };
    await stage('pointer_publication', () =>
      writePointerAtomically(outputRoot, runId, pointer),
    );
    result = { pointer, material, project, outputRoot };
  } catch (error) {
    primaryFailure = error;
  }

  let cleanupFailure: unknown;
  try {
    await rm(runRoot, { recursive: true, force: false });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') cleanupFailure = error;
  }
  if (primaryFailure) {
    if (cleanupFailure) {
      throw new Error(
        `${boundedMessage(primaryFailure)}; cleanup: ${boundedMessage(cleanupFailure)}`,
        { cause: primaryFailure },
      );
    }
    throw primaryFailure;
  }
  if (cleanupFailure) {
    throw new Error(`cleanup_after_publication: ${boundedMessage(cleanupFailure)}`);
  }
  return result!;
};

const validateArtifactCommand = async (argv: readonly string[]): Promise<void> => {
  assertSupportedArguments(
    argv,
    new Set(['--artifact', '--expected-domain', '--expected-dataset-content-hash']),
  );
  const artifactValue = readOption(argv, '--artifact');
  const domain = readOption(argv, '--expected-domain');
  const datasetHash = readOption(argv, '--expected-dataset-content-hash');
  if (!artifactValue) throw new Error('--artifact is required');
  if (domain !== 'material' && domain !== 'project') {
    throw new Error('--expected-domain must be material or project');
  }
  if (datasetHash !== undefined && !hashPattern.test(datasetHash)) {
    throw new Error('--expected-dataset-content-hash must be lowercase SHA-256');
  }
  const contracts = await loadContracts();
  const expectations = expectationsFor(domain, datasetHash ?? '', contracts);
  if (datasetHash === undefined) delete expectations.expectedDatasetContentHash;
  const path = resolveFromRepository(artifactValue);
  const artifact = validatePortableModelArtifactV2(await readArtifact(path), expectations);
  process.stdout.write(
    `${JSON.stringify({
      status: 'PASS',
      path,
      domain: artifact.domain,
      semanticContentHash: artifact.semanticContentHash,
      datasetContentHash: artifact.datasetContentHash,
    })}\n`,
  );
};

const summary = (result: Awaited<ReturnType<typeof runLocalTraining>>): unknown => ({
  status: 'PASS',
  schemaVersion: PORTABLE_ARTIFACT_V2_SCHEMA_VERSION,
  modelVersion: PORTABLE_ARTIFACT_V2_MODEL_VERSION,
  seed: result.pointer.seed,
  aggregationMode: result.material.aggregationMode,
  featureContract: {
    id: result.material.featureContractId,
    version: result.material.featureContractVersion,
  },
  taxonomyFingerprint: result.material.taxonomyFingerprint,
  datasetContentHash: result.pointer.datasetContentHash,
  setId: result.pointer.setId,
  currentPath: join(result.outputRoot, 'current.json'),
  domains: Object.fromEntries(
    domains.map((domain) => {
      const artifact = result[domain];
      return [
        domain,
        {
          items: artifact.modelDimensions.itemCount,
          userFeatures: artifact.modelDimensions.userFeatureCount,
          itemFeatures: artifact.modelDimensions.itemFeatureCount,
          outputPath: join(result.outputRoot, result.pointer[domain].path),
          featureMappingHash: artifact.featureMappingHash,
          itemMappingHash: artifact.itemMappingHash,
          semanticContentHash: artifact.semanticContentHash,
        },
      ];
    }),
  ),
});

async function main(): Promise<void> {
  const [command = 'train', ...argv] = process.argv.slice(2);
  if (command === 'validate-artifact') {
    await validateArtifactCommand(argv);
    return;
  }
  if (command !== 'train') throw new Error(`Unsupported command: ${command}`);
  const result = await runLocalTraining(parseTrainOptions(argv));
  process.stdout.write(`${JSON.stringify(summary(result))}\n`);
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  main().catch((error: unknown) => {
    process.stderr.write(`Local ML training failed: ${boundedMessage(error)}\n`);
    process.exitCode = 1;
  });
}
