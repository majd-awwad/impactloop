import { createHash } from 'node:crypto';

export const LOCAL_ML_SNAPSHOT_SCHEMA_VERSION =
  'impactloop-local-ml-training-snapshot-v1' as const;
export const LOCAL_ML_SNAPSHOT_EXPORT_MODE = 'LOCAL_DEMO' as const;
export const LOCAL_ML_SNAPSHOT_DIAGNOSTIC_LIMIT = 8;

export const LOCAL_ML_SNAPSHOT_EXCLUSION_REASONS = [
  'USER_CREATED_AFTER_EVALUATION',
  'USER_ACCOUNT_INACTIVE',
  'USER_ORIGIN_NOT_LOCAL_DEMO',
  'USER_NO_INTERESTS',
  'USER_PARTIALLY_MAPPED',
  'USER_UNMAPPED_INTERESTS',
  'USER_RUNTIME_REPRESENTATION_INVALID',
  'MATERIAL_CREATED_AFTER_EVALUATION',
  'MATERIAL_STATE_INELIGIBLE',
  'MATERIAL_CATEGORY_INELIGIBLE',
  'MATERIAL_MISSING_CRITICAL_FEATURE_GROUP',
  'PROJECT_CREATED_AFTER_EVALUATION',
  'PROJECT_STATE_INELIGIBLE',
  'PROJECT_CATEGORY_INELIGIBLE',
  'PROJECT_PUBLISHED_TIMESTAMP_MISSING',
  'PROJECT_PUBLISHED_AFTER_EVALUATION',
  'PROJECT_MISSING_CRITICAL_FEATURE_GROUP',
  'INTERACTION_AFTER_EVALUATION',
  'INTERACTION_ORIGIN_NOT_LOCAL_DEMO',
  'INTERACTION_USER_EXCLUDED',
  'MATERIAL_INTERACTION_ITEM_EXCLUDED',
  'PROJECT_INTERACTION_ITEM_EXCLUDED',
  'MATERIAL_VIEW_ANONYMOUS',
  'MATERIAL_VIEW_SOURCE_UNSUPPORTED',
  'PROJECT_BUILD_STATUS_INELIGIBLE',
] as const;

export type LocalMlSnapshotExclusionReason =
  (typeof LOCAL_ML_SNAPSHOT_EXCLUSION_REASONS)[number];

export type LocalDemoOrigin = 'REAL' | 'DEMO_SEED';
export type LocalDemoOriginClassification =
  | LocalDemoOrigin
  | 'TEST'
  | 'LOAD_TEST'
  | 'SYNTHETIC'
  | 'LEGACY_UNCLASSIFIED'
  | 'MISSING'
  | 'UNKNOWN';

export type LocalMlSnapshotDiagnostic = {
  reasonCode: LocalMlSnapshotExclusionReason;
  severity: 'EXCLUSION';
  total: number;
  sampleOpaqueKeys: string[];
  truncated: boolean;
};

export type LocalMlSnapshotEntityCounts = {
  sourceTotal: number;
  exported: number;
  excluded: number;
};

export type MaterialInteractionKind = 'MATERIAL_LIKE' | 'MATERIAL_VIEW';
export type ProjectInteractionKind =
  | 'PROJECT_SAVE'
  | 'PROJECT_LIKE'
  | 'PROJECT_FOLLOW'
  | 'PROJECT_BUILD_STARTED'
  | 'PROJECT_BUILD_COMPLETED';

export type LocalMlSnapshotUser = {
  userKey: string;
  featureTokens: string[];
};

export type LocalMlSnapshotMaterialItem = {
  materialKey: string;
  eligibilityState: 'AVAILABLE';
  featureTokens: string[];
};

export type LocalMlSnapshotProjectItem = {
  projectKey: string;
  eligibilityState: 'PUBLISHED';
  featureTokens: string[];
};

export type LocalMlSnapshotMaterialInteraction = {
  interactionKey: string;
  domain: 'material';
  kind: MaterialInteractionKind;
  userKey: string;
  materialKey: string;
  origin: LocalDemoOrigin;
  occurredAtUtc: string;
};

export type LocalMlSnapshotProjectInteraction = {
  interactionKey: string;
  domain: 'project';
  kind: ProjectInteractionKind;
  userKey: string;
  projectKey: string;
  origin: LocalDemoOrigin;
  occurredAtUtc: string;
};

export type LocalMlTrainingSnapshot = {
  metadata: {
    schemaVersion: typeof LOCAL_ML_SNAPSHOT_SCHEMA_VERSION;
    evaluationTimestampUtc: string;
    exportMode: typeof LOCAL_ML_SNAPSHOT_EXPORT_MODE;
    originPolicy: {
      included: ['REAL', 'DEMO_SEED'];
      excluded: [
        'TEST',
        'LOAD_TEST',
        'SYNTHETIC',
        'LEGACY_UNCLASSIFIED',
        'MISSING',
        'UNKNOWN',
      ];
    };
    counts: {
      users: LocalMlSnapshotEntityCounts;
      materialItems: LocalMlSnapshotEntityCounts;
      projectItems: LocalMlSnapshotEntityCounts;
      materialInteractions: LocalMlSnapshotEntityCounts & {
        byKind: Record<MaterialInteractionKind, number>;
      };
      projectInteractions: LocalMlSnapshotEntityCounts & {
        byKind: Record<ProjectInteractionKind, number>;
      };
    };
    exclusionTotals: Record<LocalMlSnapshotExclusionReason, number>;
    diagnostics: {
      sampleLimit: typeof LOCAL_ML_SNAPSHOT_DIAGNOSTIC_LIMIT;
      reasons: LocalMlSnapshotDiagnostic[];
    };
  };
  hashes: {
    semanticContent: {
      algorithm: 'sha256';
      value: string;
    };
  };
  users: LocalMlSnapshotUser[];
  materialItems: LocalMlSnapshotMaterialItem[];
  projectItems: LocalMlSnapshotProjectItem[];
  materialInteractions: LocalMlSnapshotMaterialInteraction[];
  projectInteractions: LocalMlSnapshotProjectInteraction[];
};

export class LocalMlSnapshotInputError extends Error {
  readonly code = 'LOCAL_ML_SNAPSHOT_INPUT_INVALID' as const;

  constructor(message: string) {
    super(message);
    this.name = 'LocalMlSnapshotInputError';
  }
}

export class LocalMlSnapshotInvariantError extends Error {
  constructor(
    readonly code:
      | 'INVARIANT_CANONICAL_BUILDER_FAILURE'
      | 'INVARIANT_COMPLETED_BUILD_TIMESTAMP_MISSING'
      | 'INVARIANT_CONFLICTING_SOURCE_IDENTITY'
      | 'INVARIANT_DUPLICATE_OPAQUE_KEY'
      | 'INVARIANT_INVALID_TIMESTAMP'
      | 'INVARIANT_SNAPSHOT_SCHEMA_INVALID'
      | 'INVARIANT_READ_ONLY_TRANSACTION_NOT_ENFORCED',
    readonly opaqueKey?: string,
  ) {
    super(`${code}${opaqueKey ? `:${opaqueKey}` : ''}`);
    this.name = 'LocalMlSnapshotInvariantError';
  }
}

const asciiCompare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

export const sortUniqueTokens = (tokens: readonly string[]): string[] =>
  [...new Set(tokens)].sort(asciiCompare);

export const stableOpaqueKey = (
  namespace: 'user' | 'material' | 'project' | 'interaction',
  value: string,
): string =>
  createHash('sha256')
    .update(`impactloop-${namespace}:${value}`, 'utf8')
    .digest('hex');

const RFC3339_WITH_ZONE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

export const parseEvaluationTimestamp = (value: string): Date => {
  const match = RFC3339_WITH_ZONE.exec(value);
  if (!match) {
    throw new LocalMlSnapshotInputError(
      'Evaluation timestamp must be RFC3339 and include a timezone.',
    );
  }

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw, secondRaw, fraction = '', zone] =
    match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const second = Number(secondRaw);
  const millisecond = Number((fraction + '000').slice(0, 3));

  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const sign = zone[0] === '-' ? -1 : 1;
    const zoneHour = Number(zone.slice(1, 3));
    const zoneMinute = Number(zone.slice(4, 6));
    if (zoneHour > 23 || zoneMinute > 59) {
      throw new LocalMlSnapshotInputError('Evaluation timestamp timezone is invalid.');
    }
    offsetMinutes = sign * (zoneHour * 60 + zoneMinute);
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    throw new LocalMlSnapshotInputError('Evaluation timestamp is invalid.');
  }

  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, millisecond);
  if (
    local.getUTCFullYear() !== year ||
    local.getUTCMonth() !== month - 1 ||
    local.getUTCDate() !== day ||
    local.getUTCHours() !== hour ||
    local.getUTCMinutes() !== minute ||
    local.getUTCSeconds() !== second
  ) {
    throw new LocalMlSnapshotInputError('Evaluation timestamp calendar date is invalid.');
  }

  const parsed = new Date(local.getTime() - offsetMinutes * 60_000);
  if (!Number.isFinite(parsed.getTime())) {
    throw new LocalMlSnapshotInputError('Evaluation timestamp is invalid.');
  }
  return parsed;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

export const canonicalJson = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new LocalMlSnapshotInvariantError('INVARIANT_INVALID_TIMESTAMP');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (isPlainRecord(value)) {
    return `{${Object.keys(value)
      .sort(asciiCompare)
      .map((key) => {
        const entry = value[key];
        if (entry === undefined) {
          throw new LocalMlSnapshotInvariantError('INVARIANT_INVALID_TIMESTAMP');
        }
        return `${JSON.stringify(key)}:${canonicalJson(entry)}`;
      })
      .join(',')}}`;
  }
  throw new LocalMlSnapshotInvariantError('INVARIANT_INVALID_TIMESTAMP');
};

export const semanticSnapshotHash = (
  snapshot: Omit<LocalMlTrainingSnapshot, 'hashes'> & {
    hashes: { semanticContent: { algorithm: 'sha256'; value?: string } };
  },
): string => {
  const hashInput = {
    ...snapshot,
    hashes: { semanticContent: { algorithm: snapshot.hashes.semanticContent.algorithm } },
  };
  return createHash('sha256').update(canonicalJson(hashInput), 'utf8').digest('hex');
};

const failSchemaValidation = (): never => {
  throw new LocalMlSnapshotInvariantError(
    'INVARIANT_SNAPSHOT_SCHEMA_INVALID',
    'snapshot',
  );
};

const isUtcMillisecondTimestamp = (value: string): boolean => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
};

const isAsciiSorted = (values: readonly string[]): boolean =>
  values.every(
    (value, index) =>
      index === 0 || asciiCompare(values[index - 1]!, value) <= 0,
  );

const assertEntityCounts = (counts: LocalMlSnapshotEntityCounts): void => {
  if (
    !Number.isInteger(counts.sourceTotal) ||
    !Number.isInteger(counts.exported) ||
    !Number.isInteger(counts.excluded) ||
    counts.sourceTotal < 0 ||
    counts.exported < 0 ||
    counts.excluded < 0 ||
    counts.sourceTotal !== counts.exported + counts.excluded
  ) {
    failSchemaValidation();
  }
};

export const validateLocalMlTrainingSnapshot = (
  snapshot: Omit<LocalMlTrainingSnapshot, 'hashes'>,
): void => {
  if (
    snapshot.metadata.schemaVersion !== LOCAL_ML_SNAPSHOT_SCHEMA_VERSION ||
    snapshot.metadata.exportMode !== LOCAL_ML_SNAPSHOT_EXPORT_MODE ||
    !isUtcMillisecondTimestamp(snapshot.metadata.evaluationTimestampUtc)
  ) {
    failSchemaValidation();
  }

  const opaqueKeyPattern = /^[a-f0-9]{64}$/;
  const validateFeatureRows = (
    rows: ReadonlyArray<{ featureTokens: string[] }>,
    keys: readonly string[],
  ): void => {
    if (!isAsciiSorted(keys) || new Set(keys).size !== keys.length) {
      failSchemaValidation();
    }
    for (const [index, row] of rows.entries()) {
      if (
        !opaqueKeyPattern.test(keys[index] ?? '') ||
        row.featureTokens.length === 0 ||
        !isAsciiSorted(row.featureTokens) ||
        new Set(row.featureTokens).size !== row.featureTokens.length
      ) {
        failSchemaValidation();
      }
    }
  };
  validateFeatureRows(snapshot.users, snapshot.users.map((row) => row.userKey));
  validateFeatureRows(
    snapshot.materialItems,
    snapshot.materialItems.map((row) => row.materialKey),
  );
  validateFeatureRows(
    snapshot.projectItems,
    snapshot.projectItems.map((row) => row.projectKey),
  );

  const validateInteractions = (
    rows: ReadonlyArray<{ interactionKey: string; occurredAtUtc: string }>,
  ): void => {
    const ordering = rows.map(
      (row) => `${row.occurredAtUtc}\u0000${row.interactionKey}`,
    );
    if (!isAsciiSorted(ordering)) failSchemaValidation();
    for (const row of rows) {
      if (
        !opaqueKeyPattern.test(row.interactionKey) ||
        !isUtcMillisecondTimestamp(row.occurredAtUtc)
      ) {
        failSchemaValidation();
      }
    }
  };
  validateInteractions(snapshot.materialInteractions);
  validateInteractions(snapshot.projectInteractions);

  const counts = snapshot.metadata.counts;
  for (const value of Object.values(counts)) assertEntityCounts(value);
  if (
    counts.users.exported !== snapshot.users.length ||
    counts.materialItems.exported !== snapshot.materialItems.length ||
    counts.projectItems.exported !== snapshot.projectItems.length ||
    counts.materialInteractions.exported !== snapshot.materialInteractions.length ||
    counts.projectInteractions.exported !== snapshot.projectInteractions.length ||
    Object.values(counts.materialInteractions.byKind).reduce(
      (sum, value) => sum + value,
      0,
    ) !== counts.materialInteractions.exported ||
    Object.values(counts.projectInteractions.byKind).reduce(
      (sum, value) => sum + value,
      0,
    ) !== counts.projectInteractions.exported
  ) {
    failSchemaValidation();
  }

  const reasonCodes = snapshot.metadata.diagnostics.reasons.map(
    (row) => row.reasonCode,
  );
  if (!isAsciiSorted(reasonCodes) || new Set(reasonCodes).size !== reasonCodes.length) {
    failSchemaValidation();
  }
  for (const reason of LOCAL_ML_SNAPSHOT_EXCLUSION_REASONS) {
    const total = snapshot.metadata.exclusionTotals[reason];
    if (!Number.isInteger(total) || total < 0) failSchemaValidation();
    const diagnostic = snapshot.metadata.diagnostics.reasons.find(
      (row) => row.reasonCode === reason,
    );
    if (total === 0 ? diagnostic !== undefined : diagnostic?.total !== total) {
      failSchemaValidation();
    }
  }
  const sumExclusions = (
    reasons: readonly LocalMlSnapshotExclusionReason[],
  ): number =>
    reasons.reduce(
      (sum, reason) => sum + snapshot.metadata.exclusionTotals[reason],
      0,
    );
  if (
    sumExclusions([
      'USER_CREATED_AFTER_EVALUATION',
      'USER_ACCOUNT_INACTIVE',
      'USER_ORIGIN_NOT_LOCAL_DEMO',
      'USER_NO_INTERESTS',
      'USER_PARTIALLY_MAPPED',
      'USER_UNMAPPED_INTERESTS',
      'USER_RUNTIME_REPRESENTATION_INVALID',
    ]) !== counts.users.excluded ||
    sumExclusions([
      'MATERIAL_CREATED_AFTER_EVALUATION',
      'MATERIAL_STATE_INELIGIBLE',
      'MATERIAL_CATEGORY_INELIGIBLE',
      'MATERIAL_MISSING_CRITICAL_FEATURE_GROUP',
    ]) !== counts.materialItems.excluded ||
    sumExclusions([
      'PROJECT_CREATED_AFTER_EVALUATION',
      'PROJECT_STATE_INELIGIBLE',
      'PROJECT_CATEGORY_INELIGIBLE',
      'PROJECT_PUBLISHED_TIMESTAMP_MISSING',
      'PROJECT_PUBLISHED_AFTER_EVALUATION',
      'PROJECT_MISSING_CRITICAL_FEATURE_GROUP',
    ]) !== counts.projectItems.excluded ||
    sumExclusions([
      'INTERACTION_AFTER_EVALUATION',
      'INTERACTION_ORIGIN_NOT_LOCAL_DEMO',
      'INTERACTION_USER_EXCLUDED',
      'MATERIAL_INTERACTION_ITEM_EXCLUDED',
      'PROJECT_INTERACTION_ITEM_EXCLUDED',
      'MATERIAL_VIEW_ANONYMOUS',
      'MATERIAL_VIEW_SOURCE_UNSUPPORTED',
      'PROJECT_BUILD_STATUS_INELIGIBLE',
    ]) !==
      counts.materialInteractions.excluded + counts.projectInteractions.excluded
  ) {
    failSchemaValidation();
  }
  for (const diagnostic of snapshot.metadata.diagnostics.reasons) {
    if (
      diagnostic.severity !== 'EXCLUSION' ||
      !Number.isInteger(diagnostic.total) ||
      diagnostic.total <= 0 ||
      diagnostic.sampleOpaqueKeys.length > LOCAL_ML_SNAPSHOT_DIAGNOSTIC_LIMIT ||
      !isAsciiSorted(diagnostic.sampleOpaqueKeys) ||
      diagnostic.truncated !==
        (diagnostic.total > diagnostic.sampleOpaqueKeys.length) ||
      diagnostic.sampleOpaqueKeys.some((key) => !opaqueKeyPattern.test(key))
    ) {
      failSchemaValidation();
    }
  }
};

export const finalizeLocalMlTrainingSnapshot = (
  snapshot: Omit<LocalMlTrainingSnapshot, 'hashes'>,
): LocalMlTrainingSnapshot => {
  validateLocalMlTrainingSnapshot(snapshot);
  const unhashed = {
    ...snapshot,
    hashes: { semanticContent: { algorithm: 'sha256' as const } },
  };
  const value = semanticSnapshotHash(unhashed);
  return {
    ...snapshot,
    hashes: { semanticContent: { algorithm: 'sha256', value } },
  };
};

export const serializeLocalMlTrainingSnapshot = (
  snapshot: LocalMlTrainingSnapshot,
): string => `${JSON.stringify(snapshot, null, 2)}\n`;

type DiagnosticBucket = { total: number; samples: string[] };

export class LocalMlSnapshotDiagnosticsCollector {
  private readonly buckets = new Map<
    LocalMlSnapshotExclusionReason,
    DiagnosticBucket
  >();

  record(reasonCode: LocalMlSnapshotExclusionReason, opaqueKey: string): void {
    this.recordMany(reasonCode, 1, [opaqueKey]);
  }

  recordMany(
    reasonCode: LocalMlSnapshotExclusionReason,
    total: number,
    opaqueKeys: readonly string[],
  ): void {
    if (!Number.isInteger(total) || total < 0) {
      throw new LocalMlSnapshotInvariantError('INVARIANT_INVALID_TIMESTAMP');
    }
    const bucket = this.buckets.get(reasonCode) ?? { total: 0, samples: [] };
    bucket.total += total;
    bucket.samples = sortUniqueTokens([...bucket.samples, ...opaqueKeys]).slice(
      0,
      LOCAL_ML_SNAPSHOT_DIAGNOSTIC_LIMIT,
    );
    this.buckets.set(reasonCode, bucket);
  }

  totals(): Record<LocalMlSnapshotExclusionReason, number> {
    return Object.fromEntries(
      LOCAL_ML_SNAPSHOT_EXCLUSION_REASONS.map((reason) => [
        reason,
        this.buckets.get(reason)?.total ?? 0,
      ]),
    ) as Record<LocalMlSnapshotExclusionReason, number>;
  }

  diagnostics(): LocalMlSnapshotDiagnostic[] {
    return [...LOCAL_ML_SNAPSHOT_EXCLUSION_REASONS]
      .sort(asciiCompare)
      .filter((reason) => (this.buckets.get(reason)?.total ?? 0) > 0)
      .map((reasonCode) => {
        const bucket = this.buckets.get(reasonCode)!;
        return {
          reasonCode,
          severity: 'EXCLUSION' as const,
          total: bucket.total,
          sampleOpaqueKeys: [...bucket.samples],
          truncated: bucket.total > bucket.samples.length,
        };
      });
  }
}
