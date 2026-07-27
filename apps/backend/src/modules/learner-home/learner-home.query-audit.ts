import { prisma } from '../../database/prisma.js';
import { LEARNER_HOME_CACHE_TTL_MS } from './learner-home.service.js';

export type LearnerHomeQueryEvent = {
  query: string;
  params: string;
  duration: number;
  target: string;
};

export type LearnerHomeQueryClass =
  | 'MaterialConcept'
  | 'Material'
  | 'LearningProject'
  | 'MaterialLike'
  | 'MaterialView'
  | 'Reservation'
  | 'ProjectSave'
  | 'ProjectLike'
  | 'ProjectFollow'
  | 'ProjectBuild'
  | 'ProjectRequiredComponent'
  | 'ProjectUserReview'
  | 'ProjectTag'
  | 'MaterialTag'
  | 'Category'
  | 'Location'
  | 'UserSavedLocation'
  | 'LearnerProfile'
  | 'LearnerInterestConcept'
  | 'TaxonomyConcept'
  | 'TaxonomyAlias'
  | 'LearningProjectConcept'
  | 'ProjectComponentConcept'
  | 'User'
  | 'Transaction'
  | 'Other';

type QueryEventLike = {
  query: string;
  params: string;
  duration: number;
  target: string;
};

let installed = false;
let active = false;
let buffer: LearnerHomeQueryEvent[] = [];

const isQueryEventsEnabled = () => process.env.PRISMA_QUERY_EVENTS === '1';

/**
 * Installs a single process-lifetime Prisma query listener.
 * Events are recorded only while the measurement gate is active.
 */
export const installLearnerHomeQueryAuditOnce = (): void => {
  if (!isQueryEventsEnabled()) {
    throw new Error(
      'PRISMA_QUERY_EVENTS must be "1" before process start to install learner-home query audit.',
    );
  }

  if (installed) {
    return;
  }

  installed = true;
  (prisma as { $on: (event: 'query', handler: (e: QueryEventLike) => void) => void }).$on(
    'query',
    (event) => {
      if (!active) {
        return;
      }
      buffer.push({
        query: event.query,
        params: event.params,
        duration: event.duration,
        target: event.target,
      });
    },
  );
};

const tableToken = (names: readonly string[]) =>
  names
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

/**
 * Classify Prisma query-event SQL using PostgreSQL @@map table names first,
 * then Prisma model identifiers. More specific tables must win before broader
 * parents (e.g. material_concepts before materials, project_required_components
 * before learning_projects).
 */
export const classifyLearnerHomeQueryEvent = (
  event: LearnerHomeQueryEvent | { query: string },
): LearnerHomeQueryClass => {
  const sql = event.query;

  if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)) {
    return 'Transaction';
  }

  const match = (names: readonly string[]) =>
    new RegExp(`\\b(?:${tableToken(names)})\\b`, 'i').test(sql);

  // Order matters: nested / join tables before their parents.
  if (match(['material_concepts', 'MaterialConcept'])) return 'MaterialConcept';
  if (match(['project_component_concepts', 'ProjectComponentConcept'])) {
    return 'ProjectComponentConcept';
  }
  if (match(['learning_project_concepts', 'LearningProjectConcept'])) {
    return 'LearningProjectConcept';
  }
  if (match(['learner_interest_concepts', 'LearnerInterestConcept'])) {
    return 'LearnerInterestConcept';
  }
  if (match(['taxonomy_aliases', 'TaxonomyAlias'])) return 'TaxonomyAlias';
  if (match(['taxonomy_concepts', 'TaxonomyConcept'])) return 'TaxonomyConcept';
  if (
    match([
      'project_required_components',
      'ProjectRequiredComponent',
    ])
  ) {
    return 'ProjectRequiredComponent';
  }
  if (match(['project_user_reviews', 'ProjectUserReview'])) {
    return 'ProjectUserReview';
  }
  if (match(['project_tags', 'ProjectTag'])) return 'ProjectTag';
  if (match(['material_tags', 'MaterialTag'])) return 'MaterialTag';
  if (match(['material_likes', 'MaterialLike'])) return 'MaterialLike';
  if (match(['material_views', 'MaterialView'])) return 'MaterialView';
  if (
    match(['project_saves', 'learning_project_saves', 'ProjectSave'])
  ) {
    return 'ProjectSave';
  }
  if (
    match(['project_likes', 'learning_project_likes', 'ProjectLike'])
  ) {
    return 'ProjectLike';
  }
  if (
    match(['project_follows', 'learning_project_follows', 'ProjectFollow'])
  ) {
    return 'ProjectFollow';
  }
  if (match(['project_builds', 'ProjectBuild'])) return 'ProjectBuild';
  if (match(['user_saved_locations', 'UserSavedLocation'])) {
    return 'UserSavedLocation';
  }
  if (match(['learner_profiles', 'LearnerProfile'])) return 'LearnerProfile';
  if (match(['categories', 'Category'])) return 'Category';
  if (match(['locations', 'Location'])) return 'Location';
  if (match(['learning_projects', 'LearningProject'])) return 'LearningProject';
  if (match(['reservations', 'Reservation'])) return 'Reservation';
  if (match(['materials', 'Material'])) return 'Material';
  if (match(['users', 'User'])) return 'User';

  return 'Other';
};

/** Strip literals/params noise for repeated-shape N+1 diagnostics. */
export const normalizeLearnerHomeQueryShape = (sql: string): string =>
  sql
    .replace(/\$\d+/g, '$?')
    .replace(/\bIN\s*\(([^)]*)\)/gi, 'IN (?...)')
    .replace(/\s+/g, ' ')
    .trim();

export const summarizeLearnerHomeQueryEvents = (
  events: readonly LearnerHomeQueryEvent[],
) => {
  const byClass = new Map<string, number>();
  const shapeCounts = new Map<string, number>();

  for (const event of events) {
    const key = classifyLearnerHomeQueryEvent(event);
    byClass.set(key, (byClass.get(key) ?? 0) + 1);
    if (key !== 'Transaction') {
      const shape = normalizeLearnerHomeQueryShape(event.query);
      shapeCounts.set(shape, (shapeCounts.get(shape) ?? 0) + 1);
    }
  }

  const repeatedShapes = [...shapeCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([shape, count]) => ({ shape, count }))
    .sort((left, right) => right.count - left.count);

  return {
    total: events.length,
    excludingTransaction: events.filter(
      (event) => classifyLearnerHomeQueryEvent(event) !== 'Transaction',
    ).length,
    byClass: Object.fromEntries(byClass) as Partial<
      Record<LearnerHomeQueryClass, number>
    >,
    materialConcept: byClass.get('MaterialConcept') ?? 0,
    material: byClass.get('Material') ?? 0,
    learningProject: byClass.get('LearningProject') ?? 0,
    repeatedShapes,
  };
};

/**
 * Clears the buffer, activates the gate for one measured call, then deactivates.
 * Fixture/setup must run outside this helper.
 */
export const measureWithQueryAudit = async <T>(
  run: () => Promise<T>,
): Promise<{ result: T; events: LearnerHomeQueryEvent[] }> => {
  installLearnerHomeQueryAuditOnce();
  buffer = [];
  active = true;
  try {
    const result = await run();
    return { result, events: [...buffer] };
  } finally {
    active = false;
  }
};

export const percentileNearestRank = (
  samples: readonly number[],
  percentile: number,
): number | null => {
  if (samples.length === 0) {
    return null;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const rank = Math.max(
    1,
    Math.min(sorted.length, Math.ceil((percentile / 100) * sorted.length)),
  );
  return sorted[rank - 1]!;
};

export const medianSample = (samples: readonly number[]): number | null => {
  if (samples.length === 0) {
    return null;
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
};

export const canonicalizeEvaluationTimeUtc = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed.endsWith('Z')) {
    throw new Error('evaluation-time must be an ISO-8601 UTC timestamp ending in Z');
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`evaluation-time is not a parseable ISO-8601 date: ${value}`);
  }
  return new Date(parsed).toISOString();
};

/**
 * Audit-local async frozen clock: overrides no-arg `new Date()` and `Date.now()`
 * for the awaited operation, then restores the original Date in finally.
 * Does not alter performance.now().
 */
export const withFrozenEvaluationTime = async <T>(
  evaluationTimeUtc: string,
  run: () => Promise<T>,
): Promise<T> => {
  const canonical = canonicalizeEvaluationTimeUtc(evaluationTimeUtc);
  const fixedMs = Date.parse(canonical);
  const OriginalDate = Date;

  class FrozenDate extends OriginalDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(fixedMs);
        return;
      }
      // @ts-expect-error variadic passthrough to the real Date constructor
      super(...args);
    }

    static now() {
      return fixedMs;
    }

    static parse = OriginalDate.parse;
    static UTC = OriginalDate.UTC;
  }

  Object.setPrototypeOf(FrozenDate, OriginalDate);
  // eslint-disable-next-line no-global-assign -- audit-only temporary clock
  (globalThis as { Date: typeof Date }).Date = FrozenDate as unknown as typeof Date;

  try {
    return await run();
  } finally {
    (globalThis as { Date: typeof Date }).Date = OriginalDate;
  }
};

export type AuditInvariantResult = {
  name: string;
  status: 'PASS' | 'FAIL';
  expected: string | number | boolean | null;
  observed: string | number | boolean | null;
  evidence: string;
};

export const classifyAuditStatus = (input: {
  invariants: readonly AuditInvariantResult[];
  ttlGapCount: number;
  unverifiedRequiredCallerCount: number;
}): 'PASS' | 'PASS_WITH_TTL_GAPS' | 'FAILED_INVARIANT' => {
  const anyFailed = input.invariants.some((row) => row.status === 'FAIL');
  if (anyFailed || input.unverifiedRequiredCallerCount > 0) {
    return 'FAILED_INVARIANT';
  }
  if (input.ttlGapCount > 0) {
    return 'PASS_WITH_TTL_GAPS';
  }
  return 'PASS';
};

export type AuditProfile = 'configured-runtime' | 'canonical-isolated';

export const AUDIT_PROFILES = [
  'configured-runtime',
  'canonical-isolated',
] as const satisfies readonly AuditProfile[];

export const parseAuditProfile = (value: string | undefined): AuditProfile => {
  if (
    value === 'configured-runtime' ||
    value === 'canonical-isolated'
  ) {
    return value;
  }
  throw new Error(
    `--profile must be one of: ${AUDIT_PROFILES.join(', ')}`,
  );
};

export type AuditCallerRow = {
  mutation: string;
  classification: 'VERIFIED_POSITIVE' | 'TTL_ONLY_GAP' | 'UNVERIFIED_CALLER';
  scope: string;
  maxStaleWindowMs: number | null;
  evidenceTestFile: string;
  validationCommand: string;
  required: boolean;
};

/**
 * Evidence-bound required callers. VERIFIED_POSITIVE only when both an exact
 * test file and a scoped validation command are listed (not a free-form claim).
 */
export const REQUIRED_INVALIDATION_EVIDENCE: AuditCallerRow[] = [
  {
    mutation: 'profile.updateLearnerProfileForUser (interests)',
    classification: 'VERIFIED_POSITIVE',
    scope: 'per-user',
    maxStaleWindowMs: null,
    evidenceTestFile: 'src/modules/profile/profile.test.ts',
    validationCommand:
      'node --import tsx --test src/modules/profile/profile.test.ts',
    required: true,
  },
  {
    mutation: 'locations saved location create/update/delete',
    classification: 'VERIFIED_POSITIVE',
    scope: 'per-user',
    maxStaleWindowMs: null,
    evidenceTestFile: 'src/modules/locations/locations.test.ts',
    validationCommand:
      'node --import tsx --test src/modules/locations/locations.test.ts',
    required: true,
  },
  {
    mutation: 'materials.likeMaterialById / unlikeMaterialById',
    classification: 'VERIFIED_POSITIVE',
    scope: 'per-user',
    maxStaleWindowMs: null,
    evidenceTestFile: 'src/modules/materials/materials.discovery.test.ts',
    validationCommand:
      'node --import tsx --test src/modules/materials/materials.discovery.test.ts',
    required: true,
  },
  {
    mutation: 'materials authenticated view (getMaterialById records view)',
    classification: 'VERIFIED_POSITIVE',
    scope: 'per-user',
    maxStaleWindowMs: null,
    evidenceTestFile:
      'src/modules/learner-home/learner-home.performance-cache-audit.test.ts',
    validationCommand:
      'node --import tsx --test src/modules/learner-home/learner-home.performance-cache-audit.test.ts',
    required: true,
  },
  {
    mutation: 'reservations create / cancel / availability transitions',
    classification: 'VERIFIED_POSITIVE',
    scope: 'global',
    maxStaleWindowMs: null,
    evidenceTestFile: 'src/modules/reservations/reservations.create.test.ts',
    validationCommand:
      'node --import tsx --test src/modules/reservations/reservations.create.test.ts src/modules/materials/materials.discovery.test.ts',
    required: true,
  },
  {
    mutation: 'learning-projects save/follow/like ±',
    classification: 'VERIFIED_POSITIVE',
    scope: 'per-user',
    maxStaleWindowMs: null,
    evidenceTestFile:
      'src/modules/learning-projects/learning-projects.mine.test.ts',
    validationCommand:
      'node --import tsx --test src/modules/learning-projects/learning-projects.mine.test.ts',
    required: true,
  },
  {
    mutation: 'learning-projects builds / material linking',
    classification: 'VERIFIED_POSITIVE',
    scope: 'per-user',
    maxStaleWindowMs: null,
    evidenceTestFile:
      'src/modules/learning-projects/learning-projects.mine.test.ts',
    validationCommand:
      'node --import tsx --test src/modules/learning-projects/learning-projects.mine.test.ts src/modules/learning-projects/learning-projects.material-linking.test.ts',
    required: true,
  },
];

export const TTL_ONLY_GAP_ROWS: AuditCallerRow[] = [
  {
    mutation: 'supplier material create/update/status/delete',
    classification: 'TTL_ONLY_GAP',
    scope: 'all-learners (Full Home response cache)',
    maxStaleWindowMs: LEARNER_HOME_CACHE_TTL_MS,
    evidenceTestFile: 'apps/backend/src/modules/supplier/supplier.service.ts',
    validationCommand: 'report-only',
    required: false,
  },
  {
    mutation: 'material concept refresh on supplier persist',
    classification: 'TTL_ONLY_GAP',
    scope: 'all-learners (Canonical scorers)',
    maxStaleWindowMs: LEARNER_HOME_CACHE_TTL_MS,
    evidenceTestFile: 'apps/backend/src/modules/supplier/supplier.service.ts',
    validationCommand: 'report-only',
    required: false,
  },
  {
    mutation: 'admin / project catalog publish-moderation',
    classification: 'TTL_ONLY_GAP',
    scope: 'all-learners',
    maxStaleWindowMs: LEARNER_HOME_CACHE_TTL_MS,
    evidenceTestFile:
      'apps/backend/src/modules/admin-learning-projects/admin-learning-projects.service.ts',
    validationCommand: 'report-only',
    required: false,
  },
];

export const buildCallerMatrix = (): AuditCallerRow[] => [
  ...REQUIRED_INVALIDATION_EVIDENCE,
  ...TTL_ONLY_GAP_ROWS,
];

export type AuditCliOptions = {
  profile: AuditProfile;
  email: string;
  evaluationTimeUtc: string;
  reportDir: string;
  coldSamples: number;
  warmSamples: number;
};

const parsePositiveInt = (raw: string, flag: string): number => {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${flag} must be a positive integer`);
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer`);
  }
  return value;
};

export const parseAuditCliArgs = (argv: string[]): AuditCliOptions => {
  let profile: AuditProfile | undefined;
  let email = '';
  let evaluationTimeUtc = '';
  let reportDir = '';
  let coldSamples = 5;
  let warmSamples = 10;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    const next = argv[index + 1];
    if (arg === '--profile' && next) {
      profile = parseAuditProfile(next);
      index += 1;
    } else if (arg === '--email' && next) {
      email = next;
      index += 1;
    } else if (arg === '--evaluation-time' && next) {
      evaluationTimeUtc = next;
      index += 1;
    } else if (arg === '--report-dir' && next) {
      reportDir = next;
      index += 1;
    } else if (arg === '--cold-samples' && next) {
      coldSamples = parsePositiveInt(next, '--cold-samples');
      index += 1;
    } else if (arg === '--warm-samples' && next) {
      warmSamples = parsePositiveInt(next, '--warm-samples');
      index += 1;
    }
  }

  if (!profile || !email || !evaluationTimeUtc || !reportDir) {
    throw new Error(
      'Usage: audit-learner-home-performance.ts --profile <configured-runtime|canonical-isolated> --email <email> --evaluation-time <ISO-Z> --report-dir <dir>',
    );
  }

  return {
    profile,
    email,
    evaluationTimeUtc: canonicalizeEvaluationTimeUtc(evaluationTimeUtc),
    reportDir,
    coldSamples,
    warmSamples,
  };
};

export type MlRuntimeFlagSnapshot = {
  recommendationMlShadowEnabled: boolean;
  recommendationMlMaterialServingEnabled: boolean;
  recommendationMlProjectServingEnabled: boolean;
};

export const readMlRuntimeFlagSnapshot = (flags: {
  recommendationMlShadowEnabled: boolean;
  recommendationMlMaterialServingEnabled: boolean;
  recommendationMlProjectServingEnabled: boolean;
}): MlRuntimeFlagSnapshot => ({
  recommendationMlShadowEnabled: flags.recommendationMlShadowEnabled,
  recommendationMlMaterialServingEnabled:
    flags.recommendationMlMaterialServingEnabled,
  recommendationMlProjectServingEnabled:
    flags.recommendationMlProjectServingEnabled,
});

export const restoreMlRuntimeFlagSnapshot = (
  target: {
    recommendationMlShadowEnabled: boolean;
    recommendationMlMaterialServingEnabled: boolean;
    recommendationMlProjectServingEnabled: boolean;
  },
  snapshot: MlRuntimeFlagSnapshot,
): void => {
  target.recommendationMlShadowEnabled = snapshot.recommendationMlShadowEnabled;
  target.recommendationMlMaterialServingEnabled =
    snapshot.recommendationMlMaterialServingEnabled;
  target.recommendationMlProjectServingEnabled =
    snapshot.recommendationMlProjectServingEnabled;
};

/**
 * Canonical-isolated only: temporarily disable ML shadow/serving, restore in finally.
 * Configured-runtime must never call this.
 */
export const withCanonicalIsolatedMlFlags = async <T>(
  target: {
    recommendationMlShadowEnabled: boolean;
    recommendationMlMaterialServingEnabled: boolean;
    recommendationMlProjectServingEnabled: boolean;
  },
  run: () => Promise<T>,
): Promise<T> => {
  const previous = readMlRuntimeFlagSnapshot(target);
  target.recommendationMlShadowEnabled = false;
  target.recommendationMlMaterialServingEnabled = false;
  target.recommendationMlProjectServingEnabled = false;
  try {
    return await run();
  } finally {
    restoreMlRuntimeFlagSnapshot(target, previous);
  }
};

export const evaluateCacheStateSamples = (
  samples: readonly { cacheState: string }[],
  expected: 'MISS' | 'HIT',
): { pass: boolean; failingIndexes: number[] } => {
  const failingIndexes = samples
    .map((sample, index) =>
      sample.cacheState === expected ? -1 : index,
    )
    .filter((index) => index >= 0);
  return { pass: failingIndexes.length === 0, failingIndexes };
};

export const evaluateWarmCandidateSqlSamples = (
  samples: readonly {
    cacheState: string;
    querySummary: {
      material?: number;
      learningProject?: number;
      materialConcept?: number;
    };
  }[],
): { pass: boolean; failingIndexes: number[]; evidence: string } => {
  const failingIndexes: number[] = [];
  const details: string[] = [];
  samples.forEach((sample, index) => {
    if (sample.cacheState !== 'HIT') {
      failingIndexes.push(index);
      details.push(`#${index} cacheState=${sample.cacheState}`);
      return;
    }
    const material = sample.querySummary.material ?? 0;
    const learningProject = sample.querySummary.learningProject ?? 0;
    const materialConcept = sample.querySummary.materialConcept ?? 0;
    if (material > 0 || learningProject > 0 || materialConcept > 0) {
      failingIndexes.push(index);
      details.push(
        `#${index} material=${material} learningProject=${learningProject} materialConcept=${materialConcept}`,
      );
    }
  });
  return {
    pass: failingIndexes.length === 0,
    failingIndexes,
    evidence: details.join('; ') || 'all warm HIT samples had zero candidate SQL',
  };
};

/**
 * Attribute Project-only MaterialConcept SQL into Canonical vs ML-shadow buckets.
 * Project-only never sets needsCanonicalMaterialScoring; Canonical hydration is
 * proven via profiler timing presence, not by hiding ML flags.
 */
export const attributeProjectOnlyMaterialConceptSql = (input: {
  materialConceptSqlCount: number;
  loadCanonicalMaterialConceptsMs: number | null | undefined;
  mlShadowEnabled: boolean;
}): {
  totalMaterialConceptSql: number;
  canonicalMaterialConceptSql: number;
  mlShadowMaterialConceptSql: number;
  findings: Array<{
    code:
      | 'CANONICAL_PROJECT_ONLY_ZERO_HYDRATION'
      | 'ML_SHADOW_MATERIAL_CONCEPT_LOAD';
    status: 'PASS' | 'FAIL' | 'OBSERVED' | 'ABSENT';
    evidence: string;
  }>;
} => {
  const hadCanonicalTiming =
    typeof input.loadCanonicalMaterialConceptsMs === 'number' &&
    Number.isFinite(input.loadCanonicalMaterialConceptsMs);

  let canonicalMaterialConceptSql = 0;
  let mlShadowMaterialConceptSql = 0;

  if (hadCanonicalTiming) {
    canonicalMaterialConceptSql = Math.max(1, input.materialConceptSqlCount);
    if (input.mlShadowEnabled && input.materialConceptSqlCount > 1) {
      mlShadowMaterialConceptSql = input.materialConceptSqlCount - 1;
      canonicalMaterialConceptSql = 1;
    }
  } else if (input.mlShadowEnabled) {
    mlShadowMaterialConceptSql = input.materialConceptSqlCount;
  } else {
    canonicalMaterialConceptSql = input.materialConceptSqlCount;
  }

  const findings: Array<{
    code:
      | 'CANONICAL_PROJECT_ONLY_ZERO_HYDRATION'
      | 'ML_SHADOW_MATERIAL_CONCEPT_LOAD';
    status: 'PASS' | 'FAIL' | 'OBSERVED' | 'ABSENT';
    evidence: string;
  }> = [
    {
      code: 'CANONICAL_PROJECT_ONLY_ZERO_HYDRATION',
      status: canonicalMaterialConceptSql === 0 ? 'PASS' : 'FAIL',
      evidence: hadCanonicalTiming
        ? `loadCanonicalMaterialConceptsMs=${input.loadCanonicalMaterialConceptsMs}; canonicalSql=${canonicalMaterialConceptSql}`
        : `no loadCanonicalMaterialConcepts timing; canonicalSql=${canonicalMaterialConceptSql}`,
    },
    {
      code: 'ML_SHADOW_MATERIAL_CONCEPT_LOAD',
      status:
        mlShadowMaterialConceptSql > 0
          ? 'OBSERVED'
          : input.mlShadowEnabled
            ? 'ABSENT'
            : 'ABSENT',
      evidence: `mlShadowEnabled=${input.mlShadowEnabled}; mlShadowSql=${mlShadowMaterialConceptSql}; totalSql=${input.materialConceptSqlCount}`,
    },
  ];

  return {
    totalMaterialConceptSql: input.materialConceptSqlCount,
    canonicalMaterialConceptSql,
    mlShadowMaterialConceptSql,
    findings,
  };
};

/**
 * Call-graph SQL bounds for Learner Home candidate/context loading
 * (learner-home.repository.ts). These are not arbitrary ceilings.
 *
 * fixed: exact request-level maximum from the named loader(s).
 * chunk: ceil(uniqueIds / chunkSize) (+ optional ML-shadow findMany).
 * nested_batch: nested Prisma include must emit ≤ maxPaths batched queries
 *   (one per distinct parent loader path); never once-per-parent-row.
 */
export type CallGraphSqlBound =
  | {
      kind: 'fixed';
      max: number;
      reason: string;
      scaleWith?: 'materials' | 'projects' | 'components';
    }
  | {
      kind: 'chunk';
      chunkSize: number;
      reason: string;
      scaleWith: 'materials';
    }
  | {
      kind: 'nested_batch';
      maxPaths: number;
      reason: string;
      scaleWith: 'materials' | 'projects' | 'components';
    };

export const CALL_GRAPH_SQL_BOUNDS: Partial<
  Record<LearnerHomeQueryClass, CallGraphSqlBound>
> = {
  // loadLearnerInterests → learnerProfile.findUnique
  LearnerProfile: {
    kind: 'fixed',
    max: 1,
    reason: 'loadLearnerInterests: one learnerProfile.findUnique per request',
  },
  // loadDefaultSavedLocation → userSavedLocation.findFirst (+ nested location)
  UserSavedLocation: {
    kind: 'fixed',
    max: 1,
    reason: 'loadDefaultSavedLocation: one userSavedLocation.findFirst',
  },
  Location: {
    kind: 'fixed',
    max: 4,
    reason:
      'nested location on saved-location + material pool rows; batched IN expected (≤4 parent loaders)',
    scaleWith: 'materials',
  },
  // loadLearnerBehaviorRows parallel fanout (one findMany each)
  MaterialLike: {
    kind: 'fixed',
    max: 1,
    reason: 'loadLearnerBehaviorRows: one materialLike.findMany',
  },
  MaterialView: {
    kind: 'fixed',
    max: 1,
    reason: 'loadLearnerBehaviorRows: one materialView.findMany',
  },
  Reservation: {
    kind: 'fixed',
    max: 2,
    reason:
      'behavior reservation.findMany + getHeldQuantitiesByMaterialIds groupBy',
  },
  ProjectSave: {
    kind: 'fixed',
    max: 3,
    reason:
      'behavior projectSave.findMany + findSavedProjectIds + optional hasSavedProjects',
  },
  ProjectLike: {
    kind: 'fixed',
    max: 2,
    reason: 'behavior projectLike.findMany + findLikedProjectIds',
  },
  ProjectFollow: {
    kind: 'fixed',
    max: 2,
    reason: 'behavior projectFollow.findMany + findFollowedProjectIds',
  },
  ProjectBuild: {
    kind: 'fixed',
    max: 2,
    reason: 'behavior in-progress builds + loadInProgressBuilds path',
  },
  ProjectUserReview: {
    kind: 'fixed',
    max: 1,
    reason: 'loadReviewSummaries: one projectUserReview.groupBy per annotation set',
  },
  // loadMaterialCandidatesForLearner: count + ≤4 id pools + 1 rows
  Material: {
    kind: 'fixed',
    max: 8,
    reason:
      'countAvailableMaterials + ≤4 loadMaterialPoolIds + loadMaterialPoolRows (+ rare fallback)',
    scaleWith: 'materials',
  },
  // loadProjectPool / consolidated project context
  LearningProject: {
    kind: 'fixed',
    max: 4,
    reason:
      'loadProjectPool + behavior/saved/build project parents; not once-per-project',
    scaleWith: 'projects',
  },
  // Nested includes: one batched query per parent loader path, never per row.
  // Path counts come from loadLearnerBehaviorRows + pool loaders in
  // learner-home.repository.ts (not arbitrary ceilings).
  ProjectRequiredComponent: {
    kind: 'nested_batch',
    maxPaths: 3,
    reason:
      'nested on loadProjectPool + saved-project behavior + in-progress builds (3 parent paths)',
    scaleWith: 'projects',
  },
  Category: {
    kind: 'nested_batch',
    maxPaths: 9,
    reason:
      'nested category on material pool + 3 material behavior loaders + project pool + 4 project behavior loaders',
    scaleWith: 'materials',
  },
  MaterialTag: {
    kind: 'nested_batch',
    maxPaths: 4,
    reason:
      'nested material.tags on material pool + likes/views/reservations behavior (4 paths)',
    scaleWith: 'materials',
  },
  ProjectTag: {
    kind: 'nested_batch',
    maxPaths: 5,
    reason:
      'nested project.tags on project pool + saves/likes/follows/builds behavior (5 paths)',
    scaleWith: 'projects',
  },
  MaterialConcept: {
    kind: 'chunk',
    chunkSize: 200,
    reason: 'loadMaterialConceptsForScoring chunks by MATERIAL_CONCEPT_HYDRATION_CHUNK_SIZE',
    scaleWith: 'materials',
  },
  LearnerInterestConcept: {
    kind: 'fixed',
    max: 2,
    reason: 'interest taxonomy resolution; request-level, not per candidate',
  },
  TaxonomyConcept: {
    kind: 'fixed',
    max: 4,
    reason: 'taxonomy joins for interests/concepts; request-level batched',
  },
  TaxonomyAlias: {
    kind: 'fixed',
    max: 2,
    reason: 'taxonomy alias lookup; request-level',
  },
  LearningProjectConcept: {
    kind: 'fixed',
    max: 2,
    reason: 'optional project concept joins; request-level batched',
  },
  ProjectComponentConcept: {
    kind: 'fixed',
    max: 2,
    reason: 'optional component concept joins; request-level batched',
  },
  User: {
    kind: 'fixed',
    max: 2,
    reason: 'optional author/user joins; batched IN expected',
  },
};

export const MATERIAL_CONCEPT_CHUNK_BOUND = 200;

export type NPlusOneContext = {
  label: string;
  events: readonly LearnerHomeQueryEvent[];
  materialCandidateCount: number;
  projectCandidateCount: number;
  requiredComponentCount: number;
};

export type NPlusOneShapeComparison = {
  shape: string;
  queryClass: LearnerHomeQueryClass;
  smallCandidateCount: number;
  largeCandidateCount: number;
  smallRepetition: number;
  largeRepetition: number;
  allowedFormula: string;
  result: 'PASS' | 'FAIL' | 'UNCLASSIFIED_REPEATED_QUERY';
  evidence: string;
};

const countShapes = (
  events: readonly LearnerHomeQueryEvent[],
): Map<string, { count: number; queryClass: LearnerHomeQueryClass }> => {
  const map = new Map<string, { count: number; queryClass: LearnerHomeQueryClass }>();
  for (const event of events) {
    const queryClass = classifyLearnerHomeQueryEvent(event);
    if (queryClass === 'Transaction') {
      continue;
    }
    const shape = normalizeLearnerHomeQueryShape(event.query);
    const existing = map.get(shape);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(shape, { count: 1, queryClass });
    }
  }
  return map;
};

const allowedForClass = (
  queryClass: LearnerHomeQueryClass,
  materialCount: number,
  mlShadowEnabled: boolean,
  chunkSize: number,
): { allowed: number; formula: string } | null => {
  if (queryClass === 'Other') {
    return null;
  }
  const bound = CALL_GRAPH_SQL_BOUNDS[queryClass];
  if (!bound) {
    return { allowed: 1, formula: 'undocumented class defaults to 1' };
  }
  if (bound.kind === 'chunk') {
    const allowed =
      Math.max(1, Math.ceil(materialCount / bound.chunkSize)) +
      (mlShadowEnabled ? 1 : 0);
    return {
      allowed,
      formula: `ceil(materials/${bound.chunkSize})${mlShadowEnabled ? '+1(ml-shadow)' : ''}=${allowed}; ${bound.reason}`,
    };
  }
  if (bound.kind === 'nested_batch') {
    return {
      allowed: bound.maxPaths,
      formula: `nested_batch≤${bound.maxPaths}; ${bound.reason}`,
    };
  }
  return {
    allowed: bound.max,
    formula: `fixed≤${bound.max}; ${bound.reason}`,
  };
};

const entityCount = (
  scaleWith: 'materials' | 'projects' | 'components' | undefined,
  ctx: NPlusOneContext,
): number => {
  if (scaleWith === 'projects') return ctx.projectCandidateCount;
  if (scaleWith === 'components') return ctx.requiredComponentCount;
  return ctx.materialCandidateCount;
};

/**
 * Broader N+1 check across two measured candidate contexts.
 * Does not claim No N+1 from a single Full Home sample.
 */
export const evaluateBroaderNPlusOne = (input: {
  small: NPlusOneContext;
  large: NPlusOneContext;
  materialConceptChunkSize?: number;
  minMaterialCandidatesToVerify?: number;
  mlShadowEnabled?: boolean;
  /**
   * When false, only absolute call-graph bounds / once-per-entity /
   * unclassified repeats are checked (used for Full Home cold, which adds
   * behavior loaders and must not be compared for growth against pool-only
   * fixtures).
   */
  compareGrowth?: boolean;
}): {
  status: 'PASS' | 'FAIL' | 'N_PLUS_ONE_UNVERIFIED';
  evidence: string;
  shapeComparisons: NPlusOneShapeComparison[];
  violations: NPlusOneShapeComparison[];
} => {
  const chunkSize =
    input.materialConceptChunkSize ?? MATERIAL_CONCEPT_CHUNK_BOUND;
  const minMaterials = input.minMaterialCandidatesToVerify ?? 10;
  const mlShadowEnabled = input.mlShadowEnabled === true;
  const compareGrowth = input.compareGrowth !== false;
  const shapeComparisons: NPlusOneShapeComparison[] = [];

  const coverageOk =
    input.large.materialCandidateCount >= minMaterials &&
    input.large.projectCandidateCount > 1 &&
    input.large.requiredComponentCount > 1 &&
    (!compareGrowth ||
      input.small.materialCandidateCount < input.large.materialCandidateCount ||
      input.small.projectCandidateCount < input.large.projectCandidateCount);

  if (!coverageOk) {
    return {
      status: 'N_PLUS_ONE_UNVERIFIED',
      evidence: `insufficient coverage small(materials=${input.small.materialCandidateCount},projects=${input.small.projectCandidateCount},components=${input.small.requiredComponentCount}) large(materials=${input.large.materialCandidateCount},projects=${input.large.projectCandidateCount},components=${input.large.requiredComponentCount}); need materials≥${minMaterials}, projects>1, components>1${compareGrowth ? ', and distinct sizes' : ''}`,
      shapeComparisons,
      violations: [],
    };
  }

  const smallShapes = countShapes(input.small.events);
  const largeShapes = countShapes(input.large.events);
  const allShapes = new Set([...smallShapes.keys(), ...largeShapes.keys()]);

  for (const shape of allShapes) {
    const smallEntry = smallShapes.get(shape);
    const largeEntry = largeShapes.get(shape);
    const queryClass =
      largeEntry?.queryClass ?? smallEntry?.queryClass ?? 'Other';
    const smallRepetition = smallEntry?.count ?? 0;
    const largeRepetition = largeEntry?.count ?? 0;

    // Only evaluate shapes that repeat in at least one context.
    if (smallRepetition <= 1 && largeRepetition <= 1) {
      continue;
    }

    const scaleWith = CALL_GRAPH_SQL_BOUNDS[queryClass]?.scaleWith;
    const smallEntity = entityCount(scaleWith, input.small);
    const largeEntity = entityCount(scaleWith, input.large);

    if (queryClass === 'Other') {
      const comparison: NPlusOneShapeComparison = {
        shape: shape.slice(0, 200),
        queryClass,
        smallCandidateCount: smallEntity,
        largeCandidateCount: largeEntity,
        smallRepetition,
        largeRepetition,
        allowedFormula: 'repeated Other is never allowed',
        result: 'UNCLASSIFIED_REPEATED_QUERY',
        evidence: 'UNCLASSIFIED_REPEATED_QUERY',
      };
      shapeComparisons.push(comparison);
      continue;
    }

    const allowance = allowedForClass(
      queryClass,
      input.large.materialCandidateCount,
      mlShadowEnabled,
      chunkSize,
    )!;

    let result: NPlusOneShapeComparison['result'] = 'PASS';
    let evidence = allowance.formula;

    if (largeRepetition > allowance.allowed) {
      result = 'FAIL';
      evidence = `exceeds call-graph bound: observed=${largeRepetition} allowed=${allowance.allowed}; ${allowance.formula}`;
    }

    const bound = CALL_GRAPH_SQL_BOUNDS[queryClass];
    if (
      compareGrowth &&
      result === 'PASS' &&
      bound?.kind !== 'chunk' &&
      smallRepetition >= 1 &&
      largeRepetition > smallRepetition &&
      largeEntity > smallEntity &&
      smallEntity > 0
    ) {
      const repRatio = largeRepetition / smallRepetition;
      const entityRatio = largeEntity / smallEntity;
      if (repRatio >= entityRatio * 0.5 && largeRepetition >= 2) {
        result = 'FAIL';
        evidence = `grows with ${scaleWith ?? 'candidates'}: smallRep=${smallRepetition} largeRep=${largeRepetition} smallN=${smallEntity} largeN=${largeEntity}; ${allowance.formula}`;
      }
    }

    if (
      result === 'PASS' &&
      bound?.kind !== 'chunk' &&
      largeEntity > 1 &&
      largeRepetition >= largeEntity
    ) {
      result = 'FAIL';
      evidence = `once-per-${scaleWith ?? 'candidate'} pattern: rep=${largeRepetition} entities=${largeEntity}; ${allowance.formula}`;
    }

    shapeComparisons.push({
      shape: shape.slice(0, 200),
      queryClass,
      smallCandidateCount: smallEntity,
      largeCandidateCount: largeEntity,
      smallRepetition,
      largeRepetition,
      allowedFormula: allowance.formula,
      result,
      evidence,
    });
  }

  const largeConceptTotal = [...largeShapes.values()]
    .filter((entry) => entry.queryClass === 'MaterialConcept')
    .reduce((sum, entry) => sum + entry.count, 0);
  const conceptAllowance = allowedForClass(
    'MaterialConcept',
    input.large.materialCandidateCount,
    mlShadowEnabled,
    chunkSize,
  )!;
  if (largeConceptTotal > conceptAllowance.allowed) {
    shapeComparisons.push({
      shape: 'MaterialConcept(byClass)',
      queryClass: 'MaterialConcept',
      smallCandidateCount: input.small.materialCandidateCount,
      largeCandidateCount: input.large.materialCandidateCount,
      smallRepetition: [...smallShapes.values()]
        .filter((entry) => entry.queryClass === 'MaterialConcept')
        .reduce((sum, entry) => sum + entry.count, 0),
      largeRepetition: largeConceptTotal,
      allowedFormula: conceptAllowance.formula,
      result: 'FAIL',
      evidence: `MaterialConcept class total ${largeConceptTotal} > ${conceptAllowance.allowed}`,
    });
  }

  const violations = shapeComparisons.filter((row) => row.result !== 'PASS');
  if (violations.length > 0) {
    return {
      status: 'FAIL',
      evidence: violations
        .map(
          (row) =>
            `${row.result}:${row.queryClass} smallRep=${row.smallRepetition} largeRep=${row.largeRepetition} smallN=${row.smallCandidateCount} largeN=${row.largeCandidateCount} :: ${row.evidence}`,
        )
        .join(' | '),
      shapeComparisons,
      violations,
    };
  }

  return {
    status: 'PASS',
    evidence: `dual-context ok small=${input.small.label}(m=${input.small.materialCandidateCount},p=${input.small.projectCandidateCount},c=${input.small.requiredComponentCount}) large=${input.large.label}(m=${input.large.materialCandidateCount},p=${input.large.projectCandidateCount},c=${input.large.requiredComponentCount}); compareGrowth=${compareGrowth}; no proportional/unclassified growth`,
    shapeComparisons,
    violations,
  };
};

export const evaluateCanonicalHydrationRequirement = (input: {
  profile: AuditProfile;
  processScorerVersion: string;
  requestedMaterialScoringMode: string;
  effectiveMaterialScoringMode: string;
  fallbackCode: string | null;
  cacheable: boolean;
  loadCanonicalMaterialConceptsMs: number | null | undefined;
  materialCandidateCount: number;
  materialConceptSqlCount: number;
}): AuditInvariantResult[] => {
  if (input.profile !== 'canonical-isolated') {
    return [];
  }

  const results: AuditInvariantResult[] = [];
  const processOk = input.processScorerVersion === 'canonical-taxonomy-v3';
  results.push({
    name: 'canonical_isolated_process_scorer',
    status: processOk ? 'PASS' : 'FAIL',
    expected: 'canonical-taxonomy-v3',
    observed: input.processScorerVersion,
    evidence: 'RECOMMENDATION_SCORER_VERSION must be set before module import',
  });

  results.push({
    name: 'canonical_isolated_requested_mode',
    status:
      input.requestedMaterialScoringMode === 'canonical-taxonomy-v3'
        ? 'PASS'
        : 'FAIL',
    expected: 'canonical-taxonomy-v3',
    observed: input.requestedMaterialScoringMode,
    evidence: 'hydration audit requested mode',
  });

  results.push({
    name: 'canonical_isolated_effective_mode',
    status:
      input.effectiveMaterialScoringMode === 'canonical-taxonomy-v3'
        ? 'PASS'
        : 'FAIL',
    expected: 'canonical-taxonomy-v3',
    observed: input.effectiveMaterialScoringMode,
    evidence: 'hydration audit effective mode',
  });

  results.push({
    name: 'canonical_isolated_fallback_null',
    status: input.fallbackCode === null ? 'PASS' : 'FAIL',
    expected: null,
    observed: input.fallbackCode,
    evidence: 'hydration audit fallbackCode',
  });

  results.push({
    name: 'canonical_isolated_cacheable',
    status: input.cacheable ? 'PASS' : 'FAIL',
    expected: true,
    observed: input.cacheable,
    evidence: 'hydration audit cacheable',
  });

  const timingOk =
    typeof input.loadCanonicalMaterialConceptsMs === 'number' &&
    Number.isFinite(input.loadCanonicalMaterialConceptsMs) &&
    input.loadCanonicalMaterialConceptsMs >= 0;
  results.push({
    name: 'canonical_isolated_hydration_timing',
    status: timingOk ? 'PASS' : 'FAIL',
    expected: 'finite non-negative number',
    observed:
      input.loadCanonicalMaterialConceptsMs === null ||
      input.loadCanonicalMaterialConceptsMs === undefined
        ? null
        : input.loadCanonicalMaterialConceptsMs,
    evidence:
      'loadCanonicalMaterialConceptsMs must exist for canonical-isolated PASS',
  });

  if (input.materialCandidateCount > 0) {
    results.push({
      name: 'canonical_isolated_material_concept_sql_positive',
      status: input.materialConceptSqlCount > 0 ? 'PASS' : 'FAIL',
      expected: '>0',
      observed: input.materialConceptSqlCount,
      evidence: `materialCandidates=${input.materialCandidateCount}`,
    });
  }

  return results;
};
