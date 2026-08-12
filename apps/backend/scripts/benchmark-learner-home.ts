import { createHash, randomUUID } from 'node:crypto';
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BASELINE_SCHEMA_VERSION =
  'learner-home-deterministic-baseline-v1' as const;
export const IDENTITY_CONTRACT_VERSION =
  'database-snapshot-identity-v1' as const;
export const DIAGNOSTIC_SCHEMA_VERSION =
  'learner-home-deterministic-baseline-diagnostic-v1' as const;

export const REQUIRED_PERSONAS = [
  'majd@learner.com',
  'israa@learner.com',
  'learner@learner.com',
] as const;

export const REQUIRED_SECTION_KEYS = [
  'suggested_materials',
  'materials_for_saved_projects',
  'suggested_projects',
  'continue_projects',
  'saved_projects',
  'free_materials_near_you',
  'popular_projects',
] as const;

const MATERIAL_DEDUPLICATED_SECTIONS = new Set([
  'suggested_materials',
  'materials_for_saved_projects',
  'free_materials_near_you',
]);

export const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/recommendation/learner-home-deterministic-baseline.v1.json',
);

const RECOMMENDATION_PROCESS_ENV = {
  RECOMMENDATION_SCORER_VERSION: 'legacy-v1',
  RECOMMENDATION_ML_RUNTIME_MODE: 'DETERMINISTIC',
  RECOMMENDATION_ML_SHADOW_ENABLED: 'false',
  RECOMMENDATION_OUTBOX_WORKER_ENABLED: 'false',
} as const;

const RECOMMENDATION_ENV_PROPERTIES = {
  recommendationScorerVersion: 'legacy-v1',
  recommendationMlRuntimeMode: 'DETERMINISTIC',
  recommendationMlShadowEnabled: false,
  recommendationOutboxWorkerEnabled: false,
} as const;

type BaselineMode = 'verify' | 'update';

export type BaselineCliOptions = {
  mode: BaselineMode;
  acceptCurrentDataset: boolean;
  evaluationTimeUtc?: string;
  warm: boolean;
  reportPath?: string;
};

type CandidateReference = {
  entityType: 'MATERIAL' | 'PROJECT';
  entityId: string;
  diagnosticDescriptor: string[];
};

type SupportingCandidateReference = CandidateReference & {
  recordId: string;
};

export type ReconstructedCandidateSnapshot = {
  counts: {
    materials: number;
    projects: number;
    total: number;
  };
  materials: CandidateReference[];
  projects: CandidateReference[];
  supportingPools: {
    savedProjects: SupportingCandidateReference[];
    continueProjects: SupportingCandidateReference[];
  };
  rankingInputFingerprint: string;
};

export type StableRecommendationItem = {
  position: number;
  itemType: 'material' | 'project' | 'continue_project';
  entityType: 'MATERIAL' | 'PROJECT';
  entityId: string;
  recordId: string;
  diagnosticDescriptor: string[];
  score: number;
  reasons: string[];
};

export type StableSection = {
  key: string;
  count: number;
  orderedItems: StableRecommendationItem[];
};

export type StablePersonaSnapshot = {
  email: string;
  databaseUserId: string;
  profileCompletion: {
    hasInterests: boolean;
    hasSavedLocation: boolean;
    hasSavedProjects: boolean;
    hasActivity: boolean;
  };
  reconstructedCandidateSnapshot: ReconstructedCandidateSnapshot;
  sections: StableSection[];
};

export type StableSnapshot = {
  evaluationTimeUtc: string;
  champion: {
    scorerVersion: string;
    algorithmName: string;
    algorithmVersion: string;
    policyVersion: string;
  };
  personas: StablePersonaSnapshot[];
};

export type BaselineFixture = {
  schemaVersion: typeof BASELINE_SCHEMA_VERSION;
  identityContract: {
    version: typeof IDENTITY_CONTRACT_VERSION;
    portability: 'frozen-database-only';
    databaseSnapshotFingerprint: string;
  };
  acceptanceMetadata: {
    acceptedAtUtc: string;
  };
  stableSnapshot: StableSnapshot;
  stableHash: string;
};

type RuntimeEnvironment = Record<string, unknown>;

type DeterministicLoaders = {
  loadScoringConfig: () => Promise<{
    RECOMMENDATION_SCORER_VERSION: string;
  }>;
  loadEnvironment: () => Promise<{ env: RuntimeEnvironment }>;
};

export class BaselineError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BaselineError';
  }
}

const fail = (code: string, message: string, details?: unknown): never => {
  throw new BaselineError(code, message, details);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const requiredRecord = (
  value: unknown,
  path: string,
): Record<string, unknown> => {
  if (!isRecord(value)) {
    return fail('FIXTURE_SCHEMA_UNSUPPORTED', `${path} must be an object.`);
  }
  return value;
};

const requiredString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail('INVALID_SNAPSHOT', `${path} must be a non-empty string.`);
  }
  return value;
};

export const canonicalizeEvaluationTime = (value: string): string => {
  if (!value.endsWith('Z')) {
    return fail(
      'INVALID_EVALUATION_TIME',
      'Evaluation time must be an ISO-8601 UTC timestamp ending in Z.',
    );
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return fail('INVALID_EVALUATION_TIME', `Invalid evaluation time: ${value}`);
  }

  return new Date(timestamp).toISOString();
};

export const parseCliArgs = (
  args: string[],
  fixturePath = FIXTURE_PATH,
  npmEnvironment: NodeJS.ProcessEnv = process.env,
): BaselineCliOptions => {
  const normalizedArgs = [...args];
  const hasArgument = (argument: string) => normalizedArgs.includes(argument);
  const takeForwardedValue = (): string | undefined => {
    const index = normalizedArgs.findIndex(
      (entry, entryIndex) => entryIndex > 0 && !entry.startsWith('--'),
    );
    if (index < 0) return undefined;
    return normalizedArgs.splice(index, 1)[0];
  };
  const appendNpmBoolean = (environmentKey: string, argument: string) => {
    if (npmEnvironment[environmentKey] === 'true' && !hasArgument(argument)) {
      normalizedArgs.push(argument);
    }
  };
  const appendNpmValue = (environmentKey: string, argument: string) => {
    if (hasArgument(argument)) return;
    const configured = npmEnvironment[environmentKey];
    if (!configured) return;
    const value = configured === 'true' ? takeForwardedValue() : configured;
    if (value) normalizedArgs.push(argument, value);
  };

  // npm 11 treats unknown `npm run ... -- --flag value` options as npm config
  // and exposes them through npm_config_* instead of forwarding the flag.
  // Reconstruct only this command's documented flags; the strict parser below
  // still rejects every unrecognized or leftover positional argument.
  appendNpmBoolean(
    'npm_config_accept_current_dataset',
    '--accept-current-dataset',
  );
  appendNpmBoolean('npm_config_warm', '--warm');
  appendNpmValue('npm_config_evaluation_time', '--evaluation-time');
  appendNpmValue('npm_config_report', '--report');

  const mode = normalizedArgs[0];
  if (mode !== 'verify' && mode !== 'update') {
    return fail(
      'CLI_USAGE',
      'Usage: recommendations:baseline <verify|update> [--warm] [--report <path>] [--accept-current-dataset --evaluation-time <UTC timestamp>]',
    );
  }

  let acceptCurrentDataset = false;
  let evaluationTimeUtc: string | undefined;
  let warm = false;
  let reportPath: string | undefined;
  const seen = new Set<string>();

  for (let index = 1; index < normalizedArgs.length; index += 1) {
    const argument = normalizedArgs[index]!;
    if (seen.has(argument)) {
      return fail('CLI_USAGE', `Duplicate argument: ${argument}`);
    }

    switch (argument) {
      case '--accept-current-dataset':
        acceptCurrentDataset = true;
        seen.add(argument);
        break;
      case '--warm':
        warm = true;
        seen.add(argument);
        break;
      case '--evaluation-time': {
        seen.add(argument);
        const value = normalizedArgs[index + 1];
        if (!value || value.startsWith('--')) {
          return fail('CLI_USAGE', '--evaluation-time requires a value.');
        }
        evaluationTimeUtc = canonicalizeEvaluationTime(value);
        index += 1;
        break;
      }
      case '--report': {
        seen.add(argument);
        const value = normalizedArgs[index + 1];
        if (!value || value.startsWith('--')) {
          return fail('CLI_USAGE', '--report requires a path.');
        }
        reportPath = resolve(value);
        index += 1;
        break;
      }
      default:
        return fail('CLI_USAGE', `Unknown argument: ${argument}`);
    }
  }

  if (reportPath && reportPath === resolve(fixturePath)) {
    return fail(
      'CLI_USAGE',
      'The diagnostic report path cannot be the committed fixture path.',
    );
  }

  if (mode === 'verify') {
    if (acceptCurrentDataset) {
      return fail(
        'CLI_USAGE',
        '--accept-current-dataset is valid only in update mode.',
      );
    }
    if (evaluationTimeUtc) {
      return fail(
        'CLI_USAGE',
        'verify does not accept --evaluation-time; it uses the committed fixture value.',
      );
    }
  } else {
    if (!acceptCurrentDataset) {
      return fail(
        'CLI_USAGE',
        'update requires --accept-current-dataset.',
      );
    }
    if (!evaluationTimeUtc) {
      return fail('CLI_USAGE', 'update requires --evaluation-time.');
    }
  }

  return {
    mode,
    acceptCurrentDataset,
    evaluationTimeUtc,
    warm,
    reportPath,
  };
};

const canonicalJson = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return fail('INVALID_SNAPSHOT', 'Canonical JSON cannot contain non-finite numbers.');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => {
        const entry = value[key];
        if (entry === undefined) {
          return fail(
            'INVALID_SNAPSHOT',
            `Canonical JSON cannot contain undefined at ${key}.`,
          );
        }
        return `${JSON.stringify(key)}:${canonicalJson(entry)}`;
      });
    return `{${entries.join(',')}}`;
  }

  return fail(
    'INVALID_SNAPSHOT',
    `Unsupported canonical JSON value: ${typeof value}`,
  );
};

export const stableHash = (value: unknown): string =>
  `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;

const fixtureHashInput = (fixture: Omit<BaselineFixture, 'stableHash'>) => ({
  schemaVersion: fixture.schemaVersion,
  identityContract: fixture.identityContract,
  stableSnapshot: fixture.stableSnapshot,
});

export const parseAndValidateFixture = (text: string): BaselineFixture => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return fail(
      'FIXTURE_SCHEMA_UNSUPPORTED',
      'The baseline fixture is not valid JSON.',
      error,
    );
  }

  const fixture = requiredRecord(parsed, 'fixture');
  if (fixture.schemaVersion !== BASELINE_SCHEMA_VERSION) {
    return fail(
      'FIXTURE_SCHEMA_UNSUPPORTED',
      `Unsupported fixture schema: ${String(fixture.schemaVersion)}`,
    );
  }

  const identity = requiredRecord(fixture.identityContract, 'identityContract');
  if (
    identity.version !== IDENTITY_CONTRACT_VERSION ||
    identity.portability !== 'frozen-database-only'
  ) {
    return fail(
      'FIXTURE_SCHEMA_UNSUPPORTED',
      'Unsupported fixture identity contract.',
    );
  }
  requiredString(
    identity.databaseSnapshotFingerprint,
    'identityContract.databaseSnapshotFingerprint',
  );

  const stableSnapshot = requiredRecord(
    fixture.stableSnapshot,
    'stableSnapshot',
  );
  const evaluationTimeUtc = requiredString(
    stableSnapshot.evaluationTimeUtc,
    'stableSnapshot.evaluationTimeUtc',
  );
  if (canonicalizeEvaluationTime(evaluationTimeUtc) !== evaluationTimeUtc) {
    return fail(
      'INVALID_EVALUATION_TIME',
      'Fixture evaluationTimeUtc must use canonical UTC ISO format.',
    );
  }
  if (!Array.isArray(stableSnapshot.personas)) {
    return fail(
      'FIXTURE_SCHEMA_UNSUPPORTED',
      'stableSnapshot.personas must be an array.',
    );
  }
  requiredRecord(stableSnapshot.champion, 'stableSnapshot.champion');
  requiredRecord(fixture.acceptanceMetadata, 'acceptanceMetadata');
  const fixtureStableHash = requiredString(fixture.stableHash, 'stableHash');

  const typed = fixture as unknown as BaselineFixture;
  const computedHash = stableHash(
    fixtureHashInput({
      schemaVersion: typed.schemaVersion,
      identityContract: typed.identityContract,
      acceptanceMetadata: typed.acceptanceMetadata,
      stableSnapshot: typed.stableSnapshot,
    }),
  );
  if (computedHash !== fixtureStableHash) {
    return fail(
      'FIXTURE_HASH_INVALID',
      'The committed fixture stableHash does not match its stable content.',
      { expected: fixtureStableHash, actual: computedHash },
    );
  }

  return typed;
};

type PropertySnapshot = {
  present: boolean;
  value: unknown;
};

const snapshotProperties = (
  target: Record<string, unknown>,
  keys: readonly string[],
): Map<string, PropertySnapshot> =>
  new Map(
    keys.map((key) => [
      key,
      {
        present: Object.prototype.hasOwnProperty.call(target, key),
        value: target[key],
      },
    ]),
  );

const restoreProperties = (
  target: Record<string, unknown>,
  snapshot: Map<string, PropertySnapshot>,
): void => {
  for (const [key, original] of snapshot) {
    if (original.present) {
      target[key] = original.value;
    } else {
      delete target[key];
    }
  }
};

const applyRequiredProcessEnvironment = (): void => {
  for (const [key, value] of Object.entries(RECOMMENDATION_PROCESS_ENV)) {
    process.env[key] = value;
  }
};

const assertDeterministicConfiguration = (
  scorerVersion: string,
  env: RuntimeEnvironment,
): void => {
  if (scorerVersion !== 'legacy-v1') {
    return fail(
      'CONFIGURATION_MISMATCH',
      `Active scorer must be legacy-v1, received ${scorerVersion}.`,
    );
  }

  for (const [key, value] of Object.entries(RECOMMENDATION_PROCESS_ENV)) {
    if (process.env[key] !== value) {
      return fail(
        'CONFIGURATION_MISMATCH',
        `${key} must be ${value} before recommendation runtime import.`,
      );
    }
  }

  for (const [key, value] of Object.entries(RECOMMENDATION_ENV_PROPERTIES)) {
    if (env[key] !== value) {
      return fail(
        'CONFIGURATION_MISMATCH',
        `${key} must be ${String(value)} before recommendation runtime import.`,
      );
    }
  }
};

export const withDeterministicProcessState = async <T>(
  evaluationTimeUtc: string,
  loaders: DeterministicLoaders,
  run: (context: {
    evaluationTimeUtc: string;
    evaluationTimeMs: number;
    scorerVersion: string;
    env: RuntimeEnvironment;
  }) => Promise<T>,
): Promise<T> => {
  const canonicalTime = canonicalizeEvaluationTime(evaluationTimeUtc);
  const evaluationTimeMs = Date.parse(canonicalTime);
  const originalDateNow = Date.now;
  const processEnvironmentSnapshot = snapshotProperties(
    process.env as Record<string, unknown>,
    Object.keys(RECOMMENDATION_PROCESS_ENV),
  );
  let mutableEnvironment: RuntimeEnvironment | undefined;
  let mutableEnvironmentSnapshot: Map<string, PropertySnapshot> | undefined;

  try {
    Date.now = () => evaluationTimeMs;
    applyRequiredProcessEnvironment();

    const scoringConfig = await loaders.loadScoringConfig();
    if (scoringConfig.RECOMMENDATION_SCORER_VERSION !== 'legacy-v1') {
      return fail(
        'CONFIGURATION_MISMATCH',
        'The scorer constant was not initialized as legacy-v1.',
      );
    }

    const environmentModule = await loaders.loadEnvironment();
    mutableEnvironment = environmentModule.env;
    mutableEnvironmentSnapshot = snapshotProperties(
      mutableEnvironment,
      Object.keys(RECOMMENDATION_ENV_PROPERTIES),
    );

    Object.assign(mutableEnvironment, RECOMMENDATION_ENV_PROPERTIES);
    applyRequiredProcessEnvironment();
    assertDeterministicConfiguration(
      scoringConfig.RECOMMENDATION_SCORER_VERSION,
      mutableEnvironment,
    );

    return await run({
      evaluationTimeUtc: canonicalTime,
      evaluationTimeMs,
      scorerVersion: scoringConfig.RECOMMENDATION_SCORER_VERSION,
      env: mutableEnvironment,
    });
  } finally {
    if (mutableEnvironment && mutableEnvironmentSnapshot) {
      restoreProperties(mutableEnvironment, mutableEnvironmentSnapshot);
    }
    restoreProperties(
      process.env as Record<string, unknown>,
      processEnvironmentSnapshot,
    );
    Date.now = originalDateNow;
  }
};

const normalizeDescriptorValue = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const materialDescriptor = (material: Record<string, unknown>): string[] => [
  normalizeDescriptorValue(material.title),
  normalizeDescriptorValue(material.materialType),
  normalizeDescriptorValue(material.categoryNameEn),
  normalizeDescriptorValue(material.city),
];

const projectDescriptor = (project: Record<string, unknown>): string[] => [
  normalizeDescriptorValue(project.title),
  normalizeDescriptorValue(project.categoryNameEn),
  normalizeDescriptorValue(project.difficulty),
];

const responseMaterialDescriptor = (
  material: Record<string, unknown>,
): string[] => {
  const category = isRecord(material.category) ? material.category : {};
  return [
    normalizeDescriptorValue(material.title),
    normalizeDescriptorValue(material.materialType),
    normalizeDescriptorValue(category.nameEn),
    normalizeDescriptorValue(material.city),
  ];
};

const responseProjectDescriptor = (
  project: Record<string, unknown>,
): string[] => {
  const category = isRecord(project.category) ? project.category : {};
  return [
    normalizeDescriptorValue(project.title),
    normalizeDescriptorValue(category.nameEn),
    normalizeDescriptorValue(project.difficulty),
  ];
};

const toStableData = (value: unknown): unknown => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return fail('INVALID_SNAPSHOT', 'Ranking input contains a non-finite number.');
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toStableData);
  }
  if (isRecord(value)) {
    if (typeof value.toJSON === 'function') {
      return toStableData(value.toJSON());
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, toStableData(entry)]),
    );
  }
  return fail(
    'INVALID_SNAPSHOT',
    `Unsupported ranking input value: ${typeof value}`,
  );
};

type CandidateBuildInput = {
  interests: unknown;
  savedLocation: unknown;
  projectContext: Record<string, unknown>;
  materials: Record<string, unknown>[];
};

export const buildReconstructedCandidateSnapshot = (
  input: CandidateBuildInput,
): ReconstructedCandidateSnapshot => {
  const projects = Array.isArray(input.projectContext.projects)
    ? input.projectContext.projects.map((entry, index) =>
        requiredRecord(entry, `projectContext.projects[${index}]`),
      )
    : fail('INVALID_SNAPSHOT', 'projectContext.projects must be an array.');
  const savedProjects = Array.isArray(input.projectContext.savedProjects)
    ? input.projectContext.savedProjects
    : [];
  const inProgressBuilds = Array.isArray(input.projectContext.inProgressBuilds)
    ? input.projectContext.inProgressBuilds
    : [];

  const materials = input.materials.map((material, index) => ({
    entityType: 'MATERIAL' as const,
    entityId: requiredString(material.id, `materials[${index}].id`),
    diagnosticDescriptor: materialDescriptor(material),
  }));
  const projectReferences = projects.map((project, index) => ({
    entityType: 'PROJECT' as const,
    entityId: requiredString(project.id, `projects[${index}].id`),
    diagnosticDescriptor: projectDescriptor(project),
  }));

  const supportingSavedProjects = savedProjects.map((entry, index) => {
    const item = requiredRecord(entry, `savedProjects[${index}]`);
    const project = requiredRecord(
      item.project,
      `savedProjects[${index}].project`,
    );
    const entityId = requiredString(
      project.id,
      `savedProjects[${index}].project.id`,
    );
    return {
      entityType: 'PROJECT' as const,
      entityId,
      recordId: entityId,
      diagnosticDescriptor: responseProjectDescriptor(project),
    };
  });

  const supportingContinueProjects = inProgressBuilds.map((entry, index) => {
    const build = requiredRecord(entry, `inProgressBuilds[${index}]`);
    const project = requiredRecord(
      build.project,
      `inProgressBuilds[${index}].project`,
    );
    return {
      entityType: 'PROJECT' as const,
      entityId: requiredString(
        build.projectId,
        `inProgressBuilds[${index}].projectId`,
      ),
      recordId: requiredString(build.id, `inProgressBuilds[${index}].id`),
      diagnosticDescriptor: responseProjectDescriptor(project),
    };
  });

  const rankingInputFingerprint = stableHash({
    interests: toStableData(input.interests),
    savedLocation: toStableData(input.savedLocation),
    behavior: toStableData(input.projectContext.behavior),
    hasSavedProjects: Boolean(input.projectContext.hasSavedProjects),
    materials: toStableData(input.materials),
    projects: toStableData(projects),
    savedProjects: toStableData(savedProjects),
    inProgressBuilds: toStableData(inProgressBuilds),
  });

  return {
    counts: {
      materials: materials.length,
      projects: projectReferences.length,
      total: materials.length + projectReferences.length,
    },
    materials,
    projects: projectReferences,
    supportingPools: {
      savedProjects: supportingSavedProjects,
      continueProjects: supportingContinueProjects,
    },
    rankingInputFingerprint,
  };
};

const descriptorMaps = (snapshot: ReconstructedCandidateSnapshot) => {
  const materials = new Map(
    snapshot.materials.map((candidate) => [
      candidate.entityId,
      candidate.diagnosticDescriptor,
    ]),
  );
  const projects = new Map(
    [
      ...snapshot.projects,
      ...snapshot.supportingPools.savedProjects,
      ...snapshot.supportingPools.continueProjects,
    ].map((candidate) => [candidate.entityId, candidate.diagnosticDescriptor]),
  );
  return { materials, projects };
};

export const projectAuthoritativeResponse = (
  responseValue: unknown,
  candidates: ReconstructedCandidateSnapshot,
): Pick<StablePersonaSnapshot, 'profileCompletion' | 'sections'> => {
  const response = requiredRecord(responseValue, 'response');
  const completion = requiredRecord(
    response.profileCompletion,
    'response.profileCompletion',
  );
  const profileCompletion = {
    hasInterests: completion.hasInterests === true,
    hasSavedLocation: completion.hasSavedLocation === true,
    hasSavedProjects: completion.hasSavedProjects === true,
    hasActivity: completion.hasActivity === true,
  };
  if (!Array.isArray(response.sections)) {
    return fail('INVALID_SNAPSHOT', 'response.sections must be an array.');
  }

  const descriptors = descriptorMaps(candidates);
  const sections = response.sections.map((sectionValue, sectionIndex) => {
    const section = requiredRecord(
      sectionValue,
      `response.sections[${sectionIndex}]`,
    );
    const key = requiredString(
      section.key,
      `response.sections[${sectionIndex}].key`,
    );
    if (!(REQUIRED_SECTION_KEYS as readonly string[]).includes(key)) {
      return fail('INVALID_SNAPSHOT', `Unsupported Learner Home section: ${key}`);
    }
    if (!Array.isArray(section.items)) {
      return fail(
        'INVALID_SNAPSHOT',
        `response.sections[${sectionIndex}].items must be an array.`,
      );
    }

    const orderedItems = section.items.map((itemValue, itemIndex) => {
      const item = requiredRecord(
        itemValue,
        `response.sections[${sectionIndex}].items[${itemIndex}]`,
      );
      const itemType = item.type;
      if (
        itemType !== 'material' &&
        itemType !== 'project' &&
        itemType !== 'continue_project'
      ) {
        return fail(
          'INVALID_SNAPSHOT',
          `Unsupported recommendation item type: ${String(itemType)}`,
        );
      }
      if (typeof item.score !== 'number' || !Number.isFinite(item.score)) {
        return fail(
          'INVALID_SNAPSHOT',
          `Non-finite score at section ${key}, position ${itemIndex + 1}.`,
        );
      }
      if (!Array.isArray(item.reasons) || item.reasons.some((reason) => typeof reason !== 'string')) {
        return fail(
          'INVALID_SNAPSHOT',
          `Invalid reasons at section ${key}, position ${itemIndex + 1}.`,
        );
      }

      const entity = requiredRecord(
        itemType === 'material'
          ? item.material
          : itemType === 'project'
            ? item.project
            : item.build,
        `response.sections[${sectionIndex}].items[${itemIndex}].entity`,
      );
      const entityType = itemType === 'material' ? 'MATERIAL' : 'PROJECT';
      const entityId = requiredString(
        itemType === 'continue_project' ? entity.projectId : entity.id,
        `response.sections[${sectionIndex}].items[${itemIndex}].entityId`,
      );
      const recordId = requiredString(
        entity.id,
        `response.sections[${sectionIndex}].items[${itemIndex}].recordId`,
      );
      const diagnosticDescriptor =
        entityType === 'MATERIAL'
          ? descriptors.materials.get(entityId) ?? responseMaterialDescriptor(entity)
          : descriptors.projects.get(entityId) ?? responseProjectDescriptor(entity);

      return {
        position: itemIndex + 1,
        itemType,
        entityType,
        entityId,
        recordId,
        diagnosticDescriptor,
        score: Object.is(item.score, -0) ? 0 : item.score,
        reasons: [...(item.reasons as string[])],
      } satisfies StableRecommendationItem;
    });

    return {
      key,
      count: orderedItems.length,
      orderedItems,
    };
  });

  return { profileCompletion, sections };
};

const duplicateValues = (values: string[]): string[] => [
  ...new Set(values.filter((value, index) => values.indexOf(value) !== index)),
];

export const validateSnapshotInvariants = (
  snapshot: StablePersonaSnapshot,
): void => {
  const candidates = snapshot.reconstructedCandidateSnapshot;
  if (
    candidates.counts.materials !== candidates.materials.length ||
    candidates.counts.projects !== candidates.projects.length ||
    candidates.counts.total !== candidates.materials.length + candidates.projects.length
  ) {
    return fail(
      'INVALID_SNAPSHOT',
      `Candidate counts are inconsistent for ${snapshot.email}.`,
    );
  }

  const duplicateMaterials = duplicateValues(
    candidates.materials.map((candidate) => candidate.entityId),
  );
  const duplicateProjects = duplicateValues(
    candidates.projects.map((candidate) => candidate.entityId),
  );
  if (duplicateMaterials.length > 0 || duplicateProjects.length > 0) {
    return fail(
      'DUPLICATE_IDENTITY',
      `Duplicate reconstructed candidate identities for ${snapshot.email}.`,
      { materials: duplicateMaterials, projects: duplicateProjects },
    );
  }

  const materialSectionIdentities: string[] = [];
  for (const section of snapshot.sections) {
    const identities = section.orderedItems.map(
      (item) => `${item.entityType}:${item.entityId}`,
    );
    const duplicates = duplicateValues(identities);
    if (duplicates.length > 0) {
      return fail(
        'DUPLICATE_IDENTITY',
        `Duplicate identities in ${snapshot.email}/${section.key}.`,
        duplicates,
      );
    }
    if (MATERIAL_DEDUPLICATED_SECTIONS.has(section.key)) {
      materialSectionIdentities.push(
        ...section.orderedItems
          .filter((item) => item.entityType === 'MATERIAL')
          .map((item) => item.entityId),
      );
    }
  }

  const duplicatedAcrossMaterialSections = duplicateValues(
    materialSectionIdentities,
  );
  if (duplicatedAcrossMaterialSections.length > 0) {
    return fail(
      'DUPLICATE_IDENTITY',
      `Material identities repeat across deduplicated sections for ${snapshot.email}.`,
      duplicatedAcrossMaterialSections,
    );
  }
};

export const findDifferences = (
  expected: unknown,
  actual: unknown,
  path = '$',
  limit = 20,
): Array<{ path: string; expected: unknown; actual: unknown }> => {
  const differences: Array<{ path: string; expected: unknown; actual: unknown }> = [];

  const visit = (left: unknown, right: unknown, currentPath: string): void => {
    if (differences.length >= limit || Object.is(left, right)) return;
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) {
        differences.push({
          path: `${currentPath}.length`,
          expected: left.length,
          actual: right.length,
        });
      }
      for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
        visit(left[index], right[index], `${currentPath}[${index}]`);
      }
      return;
    }
    if (isRecord(left) && isRecord(right)) {
      for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
        visit(left[key], right[key], `${currentPath}.${key}`);
      }
      return;
    }
    differences.push({ path: currentPath, expected: left, actual: right });
  };

  visit(expected, actual, path);
  return differences;
};

export const buildFixture = (input: {
  stableSnapshot: StableSnapshot;
  databaseSnapshotFingerprint: string;
  acceptedAtUtc: string;
}): BaselineFixture => {
  const withoutHash: Omit<BaselineFixture, 'stableHash'> = {
    schemaVersion: BASELINE_SCHEMA_VERSION,
    identityContract: {
      version: IDENTITY_CONTRACT_VERSION,
      portability: 'frozen-database-only',
      databaseSnapshotFingerprint: input.databaseSnapshotFingerprint,
    },
    acceptanceMetadata: {
      acceptedAtUtc: input.acceptedAtUtc,
    },
    stableSnapshot: input.stableSnapshot,
  };
  return {
    ...withoutHash,
    stableHash: stableHash(fixtureHashInput(withoutHash)),
  };
};

const writeJsonAtomically = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
};

const sameCanonicalValue = (left: unknown, right: unknown): boolean =>
  canonicalJson(left) === canonicalJson(right);

const authoritativeProjection = (snapshot: StablePersonaSnapshot) => ({
  email: snapshot.email,
  databaseUserId: snapshot.databaseUserId,
  profileCompletion: snapshot.profileCompletion,
  sections: snapshot.sections,
});

const candidateProjection = (snapshot: StablePersonaSnapshot) => ({
  email: snapshot.email,
  databaseUserId: snapshot.databaseUserId,
  reconstructedCandidateSnapshot: snapshot.reconstructedCandidateSnapshot,
});

const databaseSnapshotFingerprint = (
  personas: StablePersonaSnapshot[],
): string =>
  stableHash({
    version: IDENTITY_CONTRACT_VERSION,
    personas: personas.map(candidateProjection),
  });

type RuntimeModules = {
  prisma: Record<string, any>;
  getRequestId: () => string | undefined;
  getLearnerHome: (userId: string) => Promise<unknown>;
  invalidateLearnerHomeCache: (userId: string) => void;
  repository: Record<string, any>;
  normalizeInterests: (interests: string[]) => string[];
  algorithmName: string;
  algorithmVersion: string;
  policyVersion: string;
};

type BaselineUser = { id: string; email: string };

const loadRuntimeModules = async (): Promise<RuntimeModules> => {
  const [
    prismaModule,
    requestContext,
    learnerHome,
    repository,
    scoring,
    recommendationEvents,
  ] = await Promise.all([
    import('../src/database/prisma.js'),
    import('../src/observability/request-context.js'),
    import('../src/modules/learner-home/learner-home.service.js'),
    import('../src/modules/learner-home/learner-home.repository.js'),
    import('../src/modules/learner-home/learner-home.scoring.js'),
    import('../src/modules/recommendation-events/recommendation-events.service.js'),
  ]);

  return {
    prisma: prismaModule.prisma as unknown as Record<string, any>,
    getRequestId: requestContext.getRequestId,
    getLearnerHome: learnerHome.getLearnerHome,
    invalidateLearnerHomeCache: learnerHome.invalidateLearnerHomeCache,
    repository,
    normalizeInterests: scoring.normalizeInterests,
    algorithmName: recommendationEvents.RECOMMENDATION_ALGORITHM_NAME,
    algorithmVersion: recommendationEvents.RECOMMENDATION_ALGORITHM_VERSION,
    policyVersion: recommendationEvents.RECOMMENDATION_POLICY_VERSION,
  };
};

const resolveRequiredUsers = async (
  prisma: Record<string, any>,
): Promise<BaselineUser[]> => {
  const rows = (await prisma.user.findMany({
    where: { email: { in: [...REQUIRED_PERSONAS] } },
    select: { id: true, email: true },
  })) as BaselineUser[];

  const byEmail = new Map<string, BaselineUser[]>();
  for (const row of rows) {
    byEmail.set(row.email, [...(byEmail.get(row.email) ?? []), row]);
  }

  return REQUIRED_PERSONAS.map((email) => {
    const matches = byEmail.get(email) ?? [];
    if (matches.length !== 1) {
      return fail(
        'PERSONA_MISSING_OR_DUPLICATE',
        `Expected exactly one seeded persona for ${email}, found ${matches.length}.`,
      );
    }
    return matches[0]!;
  });
};

const reconstructCandidates = async (
  runtime: RuntimeModules,
  userId: string,
): Promise<ReconstructedCandidateSnapshot> => {
  const [rawInterests, savedLocation, projectContextValue] = await Promise.all([
    runtime.repository.loadLearnerInterests(userId),
    runtime.repository.loadDefaultSavedLocation(userId),
    runtime.repository.loadLearnerHomeProjectContext(userId, 4),
  ]);
  const projectContext = requiredRecord(projectContextValue, 'projectContext');
  const behavior = requiredRecord(projectContext.behavior, 'projectContext.behavior');
  const interests = runtime.normalizeInterests(rawInterests as string[]);
  const materialsValue = await runtime.repository.loadMaterialCandidatesForLearner({
    interests,
    savedComponents: Array.isArray(behavior.savedProjectComponents)
      ? behavior.savedProjectComponents
      : [],
    behavior,
    savedLocation,
    poolCap: runtime.repository.HOME_MATERIAL_POOL_CAP,
  });
  if (!Array.isArray(materialsValue)) {
    return fail('INVALID_SNAPSHOT', 'Material candidates must be an array.');
  }
  const materials = materialsValue.map((entry, index) =>
    requiredRecord(entry, `materials[${index}]`),
  );

  return buildReconstructedCandidateSnapshot({
    interests,
    savedLocation,
    projectContext,
    materials,
  });
};

const assertNoRequestContext = (runtime: RuntimeModules): void => {
  const requestId = runtime.getRequestId();
  if (requestId !== undefined) {
    return fail(
      'REQUEST_CONTEXT_ACTIVE',
      `Baseline execution must not have request correlation context (${requestId}).`,
    );
  }
};

const observabilityCounts = async (prisma: Record<string, any>) => ({
  recommendationEventOutbox: await prisma.recommendationEventOutbox.count(),
  recommendationGeneration: await prisma.recommendationGeneration.count(),
  recommendationCandidateTrace: await prisma.recommendationCandidateTrace.count(),
  recommendationRequest: await prisma.recommendationRequest.count(),
  recommendationImpression: await prisma.recommendationImpression.count(),
});

const runColdPass = async (
  runtime: RuntimeModules,
  users: BaselineUser[],
): Promise<{
  personas: StablePersonaSnapshot[];
  durationsMs: Record<string, number>;
}> => {
  const personas: StablePersonaSnapshot[] = [];
  const durationsMs: Record<string, number> = {};

  for (const user of users) {
    const reconstructedCandidateSnapshot = await reconstructCandidates(
      runtime,
      user.id,
    );
    assertNoRequestContext(runtime);
    runtime.invalidateLearnerHomeCache(user.id);
    const startedAt = performance.now();
    const response = await runtime.getLearnerHome(user.id);
    durationsMs[user.email] = performance.now() - startedAt;
    const authoritative = projectAuthoritativeResponse(
      response,
      reconstructedCandidateSnapshot,
    );
    const snapshot: StablePersonaSnapshot = {
      email: user.email,
      databaseUserId: user.id,
      reconstructedCandidateSnapshot,
      ...authoritative,
    };
    validateSnapshotInvariants(snapshot);
    personas.push(snapshot);
  }

  return { personas, durationsMs };
};

const recaptureCandidates = async (
  runtime: RuntimeModules,
  users: BaselineUser[],
  authority: StablePersonaSnapshot[],
): Promise<StablePersonaSnapshot[]> => {
  const results: StablePersonaSnapshot[] = [];
  for (const [index, user] of users.entries()) {
    results.push({
      ...authority[index]!,
      reconstructedCandidateSnapshot: await reconstructCandidates(runtime, user.id),
    });
  }
  return results;
};

const runWarmPass = async (
  runtime: RuntimeModules,
  users: BaselineUser[],
  coldAuthority: StablePersonaSnapshot[],
): Promise<Record<string, { durationMs: number; matchesCold: boolean }>> => {
  const results: Record<string, { durationMs: number; matchesCold: boolean }> = {};
  for (const [index, user] of users.entries()) {
    assertNoRequestContext(runtime);
    const startedAt = performance.now();
    const response = await runtime.getLearnerHome(user.id);
    const durationMs = performance.now() - startedAt;
    const projected = projectAuthoritativeResponse(
      response,
      coldAuthority[index]!.reconstructedCandidateSnapshot,
    );
    const matchesCold = sameCanonicalValue(
      projected,
      {
        profileCompletion: coldAuthority[index]!.profileCompletion,
        sections: coldAuthority[index]!.sections,
      },
    );
    if (!matchesCold) {
      return fail(
        'WARM_CACHE_DIVERGENCE',
        `Warm Learner Home response diverged for ${user.email}.`,
      );
    }
    results[user.email] = { durationMs, matchesCold };
  }
  return results;
};

const ensureColdPassesMatch = (
  first: StablePersonaSnapshot[],
  second: StablePersonaSnapshot[],
): void => {
  const firstCandidates = first.map(candidateProjection);
  const secondCandidates = second.map(candidateProjection);
  if (!sameCanonicalValue(firstCandidates, secondCandidates)) {
    return fail(
      'DATASET_DRIFT_DURING_RUN',
      'Reconstructed candidate evidence changed between cold runs.',
      findDifferences(firstCandidates, secondCandidates),
    );
  }

  const firstResponses = first.map(authoritativeProjection);
  const secondResponses = second.map(authoritativeProjection);
  if (!sameCanonicalValue(firstResponses, secondResponses)) {
    return fail(
      'DETERMINISM_REGRESSION',
      'Authoritative Learner Home output changed between cold runs.',
      findDifferences(firstResponses, secondResponses),
    );
  }
};

const verifyAcceptedFixture = (
  accepted: BaselineFixture,
  generated: BaselineFixture,
): void => {
  if (
    accepted.identityContract.databaseSnapshotFingerprint !==
    generated.identityContract.databaseSnapshotFingerprint
  ) {
    return fail(
      'DATASET_CONTRACT_MISMATCH',
      'The connected database does not match the accepted frozen database snapshot.',
      {
        expected: accepted.identityContract.databaseSnapshotFingerprint,
        actual: generated.identityContract.databaseSnapshotFingerprint,
      },
    );
  }

  if (accepted.stableHash !== generated.stableHash) {
    return fail(
      'RANKING_BASELINE_MISMATCH',
      'Authoritative deterministic Learner Home output differs from the accepted baseline.',
      findDifferences(accepted.stableSnapshot, generated.stableSnapshot),
    );
  }
};

const executeBaseline = async (input: {
  options: BaselineCliOptions;
  evaluationTimeUtc: string;
  acceptedFixture?: BaselineFixture;
  realDateNow: () => number;
}): Promise<void> => {
  await withDeterministicProcessState(
    input.evaluationTimeUtc,
    {
      loadScoringConfig: () =>
        import('../src/config/recommendation-scoring-version.js'),
      loadEnvironment: () => import('../src/config/env.js'),
    },
    async ({ evaluationTimeUtc, scorerVersion }) => {
      const runtime = await loadRuntimeModules();
      try {
        assertNoRequestContext(runtime);
        const users = await resolveRequiredUsers(runtime.prisma);
        const countsBefore = await observabilityCounts(runtime.prisma);
        const firstCold = await runColdPass(runtime, users);
        const secondCold = await runColdPass(runtime, users);
        ensureColdPassesMatch(firstCold.personas, secondCold.personas);

        const warm = input.options.warm
          ? await runWarmPass(runtime, users, firstCold.personas)
          : undefined;
        const finalCandidates = await recaptureCandidates(
          runtime,
          users,
          firstCold.personas,
        );
        const initialDatabaseFingerprint = databaseSnapshotFingerprint(
          firstCold.personas,
        );
        const finalDatabaseFingerprint = databaseSnapshotFingerprint(finalCandidates);
        if (initialDatabaseFingerprint !== finalDatabaseFingerprint) {
          return fail(
            'DATASET_DRIFT_DURING_RUN',
            'The reconstructed database contract changed during baseline execution.',
            {
              before: initialDatabaseFingerprint,
              after: finalDatabaseFingerprint,
            },
          );
        }

        const countsAfter = await observabilityCounts(runtime.prisma);
        if (!sameCanonicalValue(countsBefore, countsAfter)) {
          return fail(
            'READ_ONLY_VIOLATION',
            'Recommendation observability table counts changed during baseline execution.',
            findDifferences(countsBefore, countsAfter),
          );
        }

        const stableSnapshot: StableSnapshot = {
          evaluationTimeUtc,
          champion: {
            scorerVersion,
            algorithmName: runtime.algorithmName,
            algorithmVersion: runtime.algorithmVersion,
            policyVersion: runtime.policyVersion,
          },
          personas: firstCold.personas,
        };
        const generatedFixture = buildFixture({
          stableSnapshot,
          databaseSnapshotFingerprint: initialDatabaseFingerprint,
          acceptedAtUtc: new Date(input.realDateNow()).toISOString(),
        });

        if (input.options.mode === 'verify') {
          verifyAcceptedFixture(input.acceptedFixture!, generatedFixture);
        } else {
          writeJsonAtomically(FIXTURE_PATH, generatedFixture);
        }

        const report = {
          schemaVersion: DIAGNOSTIC_SCHEMA_VERSION,
          mode: input.options.mode,
          executedAtUtc: new Date(input.realDateNow()).toISOString(),
          evaluationTimeUtc,
          fixtureScope: 'exact-accepted-frozen-database-only',
          databaseSnapshotFingerprint: initialDatabaseFingerprint,
          stableHash: generatedFixture.stableHash,
          coldRuns: [firstCold.durationsMs, secondCold.durationsMs],
          ...(warm ? { warm } : {}),
          readOnlyCounts: {
            before: countsBefore,
            after: countsAfter,
          },
          status: input.options.mode === 'verify' ? 'VERIFIED' : 'UPDATED',
        };

        if (input.options.reportPath) {
          writeJsonAtomically(input.options.reportPath, report);
        }
        console.log(JSON.stringify(report, null, 2));
      } finally {
        await runtime.prisma.$disconnect();
      }
    },
  );
};

export const runCli = async (args: string[]): Promise<void> => {
  const options = parseCliArgs(args);
  const realDateNow = Date.now;
  let acceptedFixture: BaselineFixture | undefined;
  let evaluationTimeUtc = options.evaluationTimeUtc;

  if (options.mode === 'verify') {
    let fixtureText: string;
    try {
      fixtureText = readFileSync(FIXTURE_PATH, 'utf8');
    } catch (error) {
      return fail(
        'FIXTURE_MISSING',
        `Unable to read committed fixture at ${FIXTURE_PATH}.`,
        error,
      );
    }
    acceptedFixture = parseAndValidateFixture(fixtureText);
    evaluationTimeUtc = acceptedFixture.stableSnapshot.evaluationTimeUtc;
  }

  await executeBaseline({
    options,
    evaluationTimeUtc: evaluationTimeUtc!,
    acceptedFixture,
    realDateNow,
  });
};

const isDirectExecution = (): boolean => {
  const entry = process.argv[1];
  return Boolean(
    entry && pathToFileURL(resolve(entry)).href === import.meta.url,
  );
};

if (isDirectExecution()) {
  void runCli(process.argv.slice(2)).catch((error: unknown) => {
    if (error instanceof BaselineError) {
      console.error(
        JSON.stringify(
          {
            status: 'FAILED',
            code: error.code,
            message: error.message,
            ...(error.details === undefined ? {} : { details: error.details }),
          },
          null,
          2,
        ),
      );
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  });
}
