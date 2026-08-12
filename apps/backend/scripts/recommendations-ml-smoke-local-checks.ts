import {
  dedupeMaterialSections,
  getMaterialItemId,
} from '../src/modules/learner-home/learner-home.deduplication.js';
import type { LearnerHomeMaterialItem } from '../src/modules/learner-home/learner-home.types.js';

export const SMOKE_SCHEMA_VERSION = 'impactloop-ml-smoke-local-v1' as const;
export const DEFAULT_EVALUATION_TIME_UTC = '2026-07-23T00:00:00.000Z' as const;

export const ML_ELIGIBLE_SECTIONS = [
  'suggested_materials',
  'suggested_projects',
] as const;

export const SECTION_LIMITS_SMOKE = {
  suggested_materials: 4,
  suggested_projects: 4,
} as const;

export type SmokeLearnerAlias = `learner-${1 | 2 | 3}`;

export type SmokeMlOrderingStatus =
  | 'DETERMINISTIC'
  | 'SHADOW'
  | 'ML_RANKED'
  | 'FALLBACK_NOT_READY'
  | 'FALLBACK_FAILED';

export type SmokeRuntimeMode = 'DETERMINISTIC' | 'SHADOW' | 'ML_PRIMARY';

export type SmokeOrderingDecision = Readonly<{
  status: SmokeMlOrderingStatus;
  runtimeMode: SmokeRuntimeMode;
  diagnostics: Readonly<{
    candidateCount: number;
    scoredCount: number;
    retryCount: number;
    unmappedCandidateCount: number;
    omittedMappedCandidateCount: number;
    unknownRankedKeyCount: number;
    duplicateRankedKeyCount: number;
  }>;
}>;

export type SmokeCheckResult = Readonly<{
  ok: boolean;
  code: string;
  detail?: string;
}>;

export type SmokeSectionChecks = Readonly<{
  containment: boolean;
  uniqueness: boolean;
  finiteScores: boolean;
  limit: boolean;
  domainSeparation: boolean;
  stampTruthful: boolean;
  mappedUnmappedAppend: boolean;
  eligibility: boolean;
  crossSectionDedup: boolean;
  unknownKeysContained: boolean;
  duplicateKeysContained: boolean;
}>;

export type SmokeSectionEvaluation = Readonly<{
  learnerAlias: SmokeLearnerAlias;
  sectionKey: (typeof ML_ELIGIBLE_SECTIONS)[number];
  domain: 'material' | 'project';
  poolIds: readonly string[];
  rankedIds: readonly string[];
  orderedPoolIds: readonly string[];
  returnedIds: readonly string[];
  decision: SmokeOrderingDecision;
  /** Actual LM-08 algorithmVersion from the envelope/audit result. */
  algorithmStamp: string;
  scores: readonly number[];
  checks: SmokeSectionChecks;
  coverage: Readonly<{
    eligibleCandidateCount: number;
    mappedCandidateCount: number;
    mlRankedMappedCount: number;
    omittedMappedCount: number;
    unmappedCount: number;
    scorerFallback: boolean;
  }>;
}>;

export type SmokeRepeatabilitySnapshot = Readonly<{
  rankedIds: readonly string[];
  orderedPoolIds: readonly string[];
  visibleIds: readonly string[];
  actualStamp: string;
  status: SmokeMlOrderingStatus;
  mappedCount: number;
  unmappedCount: number;
  omittedMappedCount: number;
  unknownKeyCount: number;
  duplicateKeyCount: number;
  fallback: boolean;
  scores: readonly number[];
  diagnosticsDigest: string;
}>;

export type SmokeJsonReport = Readonly<{
  schemaVersion: typeof SMOKE_SCHEMA_VERSION;
  evaluationTimeUtc: string;
  runtimeMode: SmokeRuntimeMode;
  artifacts: Readonly<{
    material: Readonly<{
      semanticContentHash?: string;
      modelVersion?: string;
      schemaVersion?: string;
      state: string;
    }>;
    project: Readonly<{
      semanticContentHash?: string;
      modelVersion?: string;
      schemaVersion?: string;
      state: string;
    }>;
  }>;
  domains: Readonly<{
    material: Readonly<{ readiness: string; failureCode?: string }>;
    project: Readonly<{ readiness: string; failureCode?: string }>;
  }>;
  learners: readonly Readonly<{ alias: SmokeLearnerAlias }>[];
  sections: readonly Readonly<{
    learnerAlias: SmokeLearnerAlias;
    sectionKey: string;
    domain: 'material' | 'project';
    counts: SmokeSectionEvaluation['coverage'];
    checks: SmokeSectionEvaluation['checks'];
    stamp: string;
    fallback: boolean;
    status: SmokeMlOrderingStatus;
    boundedRankedIds: readonly string[];
  }>[];
  hardFailures: readonly string[];
  diagnostics: readonly string[];
  success: boolean;
}>;

const DISALLOWED_PII_KEYS = new Set([
  'email',
  'emails',
  'name',
  'displayName',
  'publicName',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'interests',
  'rawInterests',
  'city',
  'area',
  'location',
  'phone',
]);

export const mlDecisionToken = (status: SmokeMlOrderingStatus): string => {
  switch (status) {
    case 'ML_RANKED':
      return 'ml-primary';
    case 'FALLBACK_NOT_READY':
      return 'fb-not-ready';
    case 'FALLBACK_FAILED':
      return 'fb-failed';
    default:
      return 'deterministic';
  }
};

export const buildSectionAlgorithmStamp = (input: {
  sectionKey: (typeof ML_ELIGIBLE_SECTIONS)[number];
  runtimeMode: SmokeRuntimeMode;
  decision: SmokeOrderingDecision;
  effectiveBase?: string;
}): string => {
  if (input.runtimeMode !== 'ML_PRIMARY') {
    return `learner-home-v1:${input.effectiveBase ?? 'legacy-v1'}`;
  }
  const token = input.sectionKey === 'suggested_materials' ? 'sm' : 'sp';
  const base = input.effectiveBase ?? 'legacy-v1';
  return `learner-home-v1:base=${base};${token}=${mlDecisionToken(input.decision.status)}`;
};

export const assertContainment = (
  returnedIds: readonly string[],
  poolIds: readonly string[],
): SmokeCheckResult => {
  const pool = new Set(poolIds);
  const unknown = returnedIds.filter((id) => !pool.has(id));
  if (unknown.length > 0) {
    return {
      ok: false,
      code: 'OUT_OF_POOL_CANDIDATE',
      detail: `unknown_count=${unknown.length}`,
    };
  }
  return { ok: true, code: 'CONTAINMENT_OK' };
};

export const assertUniqueness = (ids: readonly string[]): SmokeCheckResult => {
  if (new Set(ids).size !== ids.length) {
    return { ok: false, code: 'DUPLICATE_RESULT' };
  }
  return { ok: true, code: 'UNIQUENESS_OK' };
};

export const assertFiniteScores = (
  scores: readonly number[],
): SmokeCheckResult => {
  const bad = scores.filter((score) => !Number.isFinite(score));
  if (bad.length > 0) {
    return {
      ok: false,
      code: 'NONFINITE_SCORE',
      detail: `nonfinite_count=${bad.length}`,
    };
  }
  return { ok: true, code: 'FINITE_SCORES_OK' };
};

export const assertLimitPreserved = (
  returnedCount: number,
  limit: number,
): SmokeCheckResult => {
  if (returnedCount > limit) {
    return {
      ok: false,
      code: 'LIMIT_EXCEEDED',
      detail: `returned=${returnedCount} limit=${limit}`,
    };
  }
  return { ok: true, code: 'LIMIT_OK' };
};

export const assertDomainSeparation = (input: {
  domain: 'material' | 'project';
  returnedIds: readonly string[];
  foreignPoolIds: readonly string[];
}): SmokeCheckResult => {
  const foreign = new Set(input.foreignPoolIds);
  const crossed = input.returnedIds.filter((id) => foreign.has(id));
  if (crossed.length > 0) {
    return {
      ok: false,
      code: 'DOMAIN_CROSSING',
      detail: `crossed=${crossed.length} domain=${input.domain}`,
    };
  }
  return { ok: true, code: 'DOMAIN_SEPARATION_OK' };
};

export const assertMappedUnmappedAppend = (input: {
  originalIds: readonly string[];
  rankedMappedIds: readonly string[];
  combinedIds: readonly string[];
}): SmokeCheckResult => {
  const rankedSet = new Set(input.rankedMappedIds);
  const expectedTail = input.originalIds.filter((id) => !rankedSet.has(id));
  const expected = [...input.rankedMappedIds, ...expectedTail];
  if (
    expected.length !== input.combinedIds.length ||
    expected.some((id, index) => id !== input.combinedIds[index])
  ) {
    return { ok: false, code: 'APPEND_ORDER_MISMATCH' };
  }
  return { ok: true, code: 'APPEND_ORDER_OK' };
};

/**
 * Extract the section-domain token from an independently supplied LM-08 stamp
 * (full-home `sm=`/`sp=` or section stamp). Returns undefined when absent.
 */
export const extractSectionTokenFromActualStamp = (
  actualStamp: string,
  sectionKey: (typeof ML_ELIGIBLE_SECTIONS)[number],
): string | undefined => {
  const key = sectionKey === 'suggested_materials' ? 'sm' : 'sp';
  const match = actualStamp.match(new RegExp(`(?:^|[;:])${key}=([^;]+)`));
  return match?.[1];
};

/**
 * Compare an independently supplied actual LM-08 stamp against the ordering
 * decision. The stamp must not be constructed from the same decision object
 * used for the expectation.
 */
export const assertStampTruthful = (input: {
  actualStamp: string;
  decision: SmokeOrderingDecision;
  sectionKey: (typeof ML_ELIGIBLE_SECTIONS)[number];
}): SmokeCheckResult => {
  const key = input.sectionKey === 'suggested_materials' ? 'sm' : 'sp';
  const otherKey = key === 'sm' ? 'sp' : 'sm';
  const expected = mlDecisionToken(input.decision.status);
  const actualToken = extractSectionTokenFromActualStamp(
    input.actualStamp,
    input.sectionKey,
  );
  const otherToken = extractSectionTokenFromActualStamp(
    input.actualStamp,
    input.sectionKey === 'suggested_materials'
      ? 'suggested_projects'
      : 'suggested_materials',
  );

  if (actualToken === undefined) {
    // Full-home stamps always emit both tokens under ML_PRIMARY; missing key is a misroute.
    if (otherToken === expected) {
      return {
        ok: false,
        code: 'STAMP_DOMAIN_MISROUTE',
        detail: `missing_${key}_has_${otherKey}=${otherToken}`,
      };
    }
    return {
      ok: false,
      code: 'STAMP_MISMATCH',
      detail: `missing_${key}_token`,
    };
  }

  if (
    (input.decision.status === 'FALLBACK_NOT_READY' ||
      input.decision.status === 'FALLBACK_FAILED' ||
      input.decision.status === 'DETERMINISTIC' ||
      input.decision.status === 'SHADOW') &&
    actualToken === 'ml-primary'
  ) {
    return { ok: false, code: 'FALLBACK_CLAIMS_ML_SUCCESS' };
  }
  if (input.decision.status === 'ML_RANKED' && actualToken !== 'ml-primary') {
    return {
      ok: false,
      code: 'ML_APPLIED_WITHOUT_STAMP',
      detail: `actual=${actualToken}`,
    };
  }
  if (actualToken !== expected) {
    if (otherToken === expected) {
      return {
        ok: false,
        code: 'STAMP_DOMAIN_MISROUTE',
        detail: `${key}=${actualToken}_${otherKey}=${otherToken}`,
      };
    }
    return {
      ok: false,
      code: 'STAMP_MISMATCH',
      detail: `expected=${expected} actual=${actualToken}`,
    };
  }
  return { ok: true, code: 'STAMP_TRUTHFUL' };
};

export type SmokeMaterialDedupItem = Readonly<{
  id: string;
  title?: string;
  score?: number;
  reasons?: readonly string[];
}>;

export type SmokeMaterialDedupSections = Readonly<{
  materialsForSavedProjects: readonly SmokeMaterialDedupItem[];
  suggestedMaterials: readonly SmokeMaterialDedupItem[];
  freeMaterialsNearYou: readonly SmokeMaterialDedupItem[];
}>;

export const MATERIAL_SECTION_LIMITS_SMOKE = {
  materialsForSavedProjects: 4,
  suggestedMaterials: 4,
  freeMaterialsNearYou: 4,
} as const;

const toDedupMaterialItems = (
  items: readonly SmokeMaterialDedupItem[],
): LearnerHomeMaterialItem[] =>
  items.map((item) => ({
    type: 'material' as const,
    score: item.score ?? 0,
    reasons: [...(item.reasons ?? [])],
    material: { id: item.id, title: item.title ?? item.id },
  }));

const idsOfDedupItems = (
  items: readonly SmokeMaterialDedupItem[],
): string[] => items.map((item) => item.id).filter(Boolean);

/**
 * Validate final Material sections against the existing LM-08
 * `dedupeMaterialSections` authority (priority + fallback-when-exhausted).
 * Does not impose blanket cross-section uniqueness.
 */
export const assertMaterialCrossSectionDedup = (input: {
  preDedup: SmokeMaterialDedupSections;
  actual: SmokeMaterialDedupSections;
  limits?: {
    materialsForSavedProjects: number;
    suggestedMaterials: number;
    freeMaterialsNearYou: number;
  };
}): SmokeCheckResult => {
  const limits = input.limits ?? MATERIAL_SECTION_LIMITS_SMOKE;
  const expected = dedupeMaterialSections({
    materialsForSavedProjects: toDedupMaterialItems(
      input.preDedup.materialsForSavedProjects,
    ),
    suggestedMaterials: toDedupMaterialItems(input.preDedup.suggestedMaterials),
    freeMaterialsNearYou: toDedupMaterialItems(
      input.preDedup.freeMaterialsNearYou,
    ),
    limits,
  });

  const expectedIds = {
    materialsForSavedProjects: expected.materialsForSavedProjects.map(
      getMaterialItemId,
    ),
    suggestedMaterials: expected.suggestedMaterials.map(getMaterialItemId),
    freeMaterialsNearYou: expected.freeMaterialsNearYou.map(getMaterialItemId),
  };
  const actualIds = {
    materialsForSavedProjects: idsOfDedupItems(
      input.actual.materialsForSavedProjects,
    ),
    suggestedMaterials: idsOfDedupItems(input.actual.suggestedMaterials),
    freeMaterialsNearYou: idsOfDedupItems(input.actual.freeMaterialsNearYou),
  };

  const same = (left: readonly string[], right: readonly string[]) =>
    left.length === right.length && left.every((id, index) => id === right[index]);

  if (!same(expectedIds.materialsForSavedProjects, actualIds.materialsForSavedProjects)) {
    return {
      ok: false,
      code: 'CROSS_SECTION_DEDUP_VIOLATION',
      detail: 'materials_for_saved_projects_mismatch',
    };
  }
  if (!same(expectedIds.suggestedMaterials, actualIds.suggestedMaterials)) {
    return {
      ok: false,
      code: 'CROSS_SECTION_DEDUP_VIOLATION',
      detail: 'suggested_materials_mismatch',
    };
  }
  if (!same(expectedIds.freeMaterialsNearYou, actualIds.freeMaterialsNearYou)) {
    return {
      ok: false,
      code: 'CROSS_SECTION_DEDUP_VIOLATION',
      detail: 'free_materials_near_you_mismatch',
    };
  }
  return { ok: true, code: 'CROSS_SECTION_DEDUP_OK' };
};

/**
 * Unknown ranked keys are diagnostics when contained. Hard-fail only when an
 * unknown key becomes accepted into the ordered pool or visible section.
 */
export const assertUnknownKeysContained = (input: {
  decision: SmokeOrderingDecision;
  poolIds: readonly string[];
  orderedPoolIds: readonly string[];
  returnedIds: readonly string[];
}): SmokeCheckResult => {
  const ordered = assertContainment(input.orderedPoolIds, input.poolIds);
  if (!ordered.ok) {
    return {
      ok: false,
      code: 'UNKNOWN_KEYS_ACCEPTED',
      detail: 'ordered_out_of_pool',
    };
  }
  const visible = assertContainment(input.returnedIds, input.poolIds);
  if (!visible.ok) {
    return {
      ok: false,
      code: 'UNKNOWN_KEYS_ACCEPTED',
      detail: 'visible_out_of_pool',
    };
  }
  // Diagnosed unknown keys remain informational when containment holds.
  void input.decision.diagnostics.unknownRankedKeyCount;
  return { ok: true, code: 'UNKNOWN_KEYS_CONTAINED' };
};

/**
 * Duplicate ranked keys are diagnostics when LM-08 rejects/falls back and the
 * visible result stays unique with a truthful stamp. Hard-fail when duplicates
 * are accepted as ML success or produce duplicate visible candidates.
 */
export const assertDuplicateKeysContained = (input: {
  decision: SmokeOrderingDecision;
  returnedIds: readonly string[];
  actualStamp: string;
  sectionKey: (typeof ML_ELIGIBLE_SECTIONS)[number];
}): SmokeCheckResult => {
  const duplicateCount = input.decision.diagnostics.duplicateRankedKeyCount;
  if (duplicateCount > 0 && input.decision.status === 'ML_RANKED') {
    return {
      ok: false,
      code: 'DUPLICATE_KEYS_ACCEPTED',
      detail: 'ml_ranked_with_duplicate_keys',
    };
  }
  if (duplicateCount > 0) {
    const stamp = assertStampTruthful({
      actualStamp: input.actualStamp,
      decision: input.decision,
      sectionKey: input.sectionKey,
    });
    if (!stamp.ok) {
      return {
        ok: false,
        code: 'DUPLICATE_KEYS_ACCEPTED',
        detail: stamp.code,
      };
    }
  }
  const unique = assertUniqueness(input.returnedIds);
  if (!unique.ok) {
    return {
      ok: false,
      code: 'DUPLICATE_KEYS_ACCEPTED',
      detail: 'visible_duplicates',
    };
  }
  return { ok: true, code: 'DUPLICATE_KEYS_CONTAINED' };
};

export const compareRepeatabilitySnapshots = (
  first: SmokeRepeatabilitySnapshot,
  second: SmokeRepeatabilitySnapshot,
): SmokeCheckResult => {
  const fields: Array<keyof SmokeRepeatabilitySnapshot> = [
    'rankedIds',
    'orderedPoolIds',
    'visibleIds',
    'actualStamp',
    'status',
    'mappedCount',
    'unmappedCount',
    'omittedMappedCount',
    'unknownKeyCount',
    'duplicateKeyCount',
    'fallback',
    'scores',
    'diagnosticsDigest',
  ];
  for (const field of fields) {
    const left = first[field];
    const right = second[field];
    const equal = Array.isArray(left)
      ? Array.isArray(right) &&
        left.length === right.length &&
        left.every((value, index) => value === right[index])
      : left === right;
    if (!equal) {
      return {
        ok: false,
        code: 'UNSTABLE_RANKING',
        detail: `field=${field}`,
      };
    }
  }
  return { ok: true, code: 'REPEATABILITY_OK' };
};

export const classifyHardFailure = (code: string): boolean => {
  const hard = new Set([
    'OUT_OF_POOL_CANDIDATE',
    'DUPLICATE_RESULT',
    'NONFINITE_SCORE',
    'DOMAIN_CROSSING',
    'FALLBACK_CLAIMS_ML_SUCCESS',
    'ML_APPLIED_WITHOUT_STAMP',
    'STAMP_MISMATCH',
    'STAMP_DOMAIN_MISROUTE',
    'READY_WITHOUT_ARTIFACT',
    'RUNTIME_MODE_NOT_ML_PRIMARY',
    'DOMAIN_NOT_READY',
    'LEARNER_RESOLUTION_FAILED',
    'SECTION_EVALUATION_BROKEN',
    'UNSTABLE_RANKING',
    'LIMIT_EXCEEDED',
    'ARTIFACTS_MISSING',
    'DB_UNREADABLE',
    'CRASH',
    'UNKNOWN_KEYS_ACCEPTED',
    'DUPLICATE_KEYS_ACCEPTED',
    'APPEND_ORDER_MISMATCH',
    'CROSS_SECTION_DEDUP_VIOLATION',
    'ELIGIBILITY_VIOLATION',
    'MATERIAL_ML_NOT_APPLIED',
    'PROJECT_ML_NOT_APPLIED',
  ]);
  return hard.has(code);
};

export const redactForOutput = <T>(value: T): T => {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) {
      if (DISALLOWED_PII_KEYS.has(key)) continue;
      if (/email/i.test(key) || /password/i.test(key) || /token/i.test(key)) {
        continue;
      }
      out[key] = walk(child);
    }
    return out;
  };
  return walk(value) as T;
};

export const aliasForIndex = (index: number): SmokeLearnerAlias => {
  if (index < 0 || index > 2) {
    throw new Error(`learner_alias_out_of_range:${index}`);
  }
  return `learner-${(index + 1) as 1 | 2 | 3}`;
};

export const formatHumanReport = (report: SmokeJsonReport): string => {
  const lines: string[] = [];
  lines.push(`LM-09 local ML smoke: ${report.success ? 'PASS' : 'FAIL'}`);
  lines.push(`runtimeMode=${report.runtimeMode}`);
  lines.push(
    `material=${report.domains.material.readiness} project=${report.domains.project.readiness}`,
  );
  lines.push(
    `artifacts material.hash=${report.artifacts.material.semanticContentHash ?? 'none'} project.hash=${report.artifacts.project.semanticContentHash ?? 'none'}`,
  );
  lines.push(
    `learners=${report.learners.map((learner) => learner.alias).join(',')}`,
  );
  for (const section of report.sections) {
    lines.push(
      `section ${section.learnerAlias}/${section.sectionKey} domain=${section.domain} status=${section.status} fallback=${section.fallback} stamp=${section.stamp}`,
    );
    lines.push(
      `  counts eligible=${section.counts.eligibleCandidateCount} mapped=${section.counts.mappedCandidateCount} mlRanked=${section.counts.mlRankedMappedCount} omitted=${section.counts.omittedMappedCount} unmapped=${section.counts.unmappedCount}`,
    );
    lines.push(
      `  checks containment=${section.checks.containment} unique=${section.checks.uniqueness} finite=${section.checks.finiteScores} limit=${section.checks.limit} domainSep=${section.checks.domainSeparation} stamp=${section.checks.stampTruthful} append=${section.checks.mappedUnmappedAppend} eligibility=${section.checks.eligibility} dedup=${section.checks.crossSectionDedup} stableIds=${section.boundedRankedIds.length}`,
    );
  }
  if (report.hardFailures.length > 0) {
    lines.push('hardFailures:');
    for (const failure of report.hardFailures) lines.push(`  - ${failure}`);
  }
  if (report.diagnostics.length > 0) {
    lines.push('diagnostics:');
    for (const diagnostic of report.diagnostics) lines.push(`  - ${diagnostic}`);
  }
  return lines.join('\n');
};

export const toJsonReport = (report: SmokeJsonReport): string =>
  `${JSON.stringify(redactForOutput(report), null, 2)}\n`;

export const collectHardFailures = (
  sections: readonly SmokeSectionEvaluation[],
  setupFailures: readonly string[],
  stabilityFailures: readonly string[],
): string[] => {
  const failures = [...setupFailures, ...stabilityFailures];
  for (const section of sections) {
    if (!section.checks.containment) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:OUT_OF_POOL_CANDIDATE`);
    }
    if (!section.checks.uniqueness) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:DUPLICATE_RESULT`);
    }
    if (!section.checks.finiteScores) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:NONFINITE_SCORE`);
    }
    if (!section.checks.limit) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:LIMIT_EXCEEDED`);
    }
    if (!section.checks.domainSeparation) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:DOMAIN_CROSSING`);
    }
    if (!section.checks.stampTruthful) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:STAMP_UNTRUTHFUL`);
    }
    if (!section.checks.mappedUnmappedAppend) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:APPEND_ORDER_MISMATCH`);
    }
    if (!section.checks.eligibility) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:ELIGIBILITY_VIOLATION`);
    }
    if (!section.checks.crossSectionDedup) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:CROSS_SECTION_DEDUP_VIOLATION`);
    }
    if (!section.checks.unknownKeysContained) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:UNKNOWN_KEYS_ACCEPTED`);
    }
    if (!section.checks.duplicateKeysContained) {
      failures.push(`${section.learnerAlias}/${section.sectionKey}:DUPLICATE_KEYS_ACCEPTED`);
    }
  }
  return failures;
};

export const collectDiagnostics = (
  sections: readonly SmokeSectionEvaluation[],
): string[] => {
  const diagnostics: string[] = [];
  const bySection = new Map<string, string[][]>();
  for (const section of sections) {
    const key = section.sectionKey;
    const list = bySection.get(key) ?? [];
    list.push([...section.returnedIds]);
    bySection.set(key, list);
    if (section.coverage.unmappedCount > 0) {
      diagnostics.push(
        `${section.learnerAlias}/${section.sectionKey}:unmapped_appended=${section.coverage.unmappedCount}`,
      );
    }
    if (section.coverage.mappedCandidateCount === 0) {
      diagnostics.push(
        `${section.learnerAlias}/${section.sectionKey}:sparse_or_missing_item_mappings`,
      );
    }
    if (
      section.decision.status === 'ML_RANKED' &&
      section.poolIds.length > 1 &&
      section.returnedIds.join('\0') ===
        section.poolIds.slice(0, section.returnedIds.length).join('\0')
    ) {
      diagnostics.push(
        `${section.learnerAlias}/${section.sectionKey}:ml_order_equals_deterministic_prefix`,
      );
    }
  }
  for (const [sectionKey, orders] of bySection) {
    if (orders.length < 2) continue;
    const first = orders[0]?.join('\0') ?? '';
    if (orders.every((order) => order.join('\0') === first)) {
      diagnostics.push(
        `${sectionKey}:learners_share_identical_order (may be sparse features or equal vectors)`,
      );
    } else {
      diagnostics.push(`${sectionKey}:personalization_order_differs_across_learners`);
    }
  }
  return diagnostics;
};

export const parseSmokeArgs = (
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): {
  json: boolean;
  evaluationTimeUtc?: string;
  materialArtifactPath?: string;
  projectArtifactPath?: string;
} => {
  let json =
    env.npm_config_json === 'true' ||
    env.RECOMMENDATIONS_ML_SMOKE_JSON === '1' ||
    env.SMOKE_JSON === '1';
  let evaluationTimeUtc =
    env.npm_config_evaluation_time?.trim() ||
    env.RECOMMENDATIONS_ML_SMOKE_EVALUATION_TIME?.trim() ||
    undefined;
  let materialArtifactPath =
    env.npm_config_material_artifact?.trim() || undefined;
  let projectArtifactPath =
    env.npm_config_project_artifact?.trim() || undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === '--json' || arg === '--format=json') {
      json = true;
      continue;
    }
    if (arg === '--format') {
      const value = argv[++index];
      if (value === 'json') {
        json = true;
        continue;
      }
      throw new Error(`Unsupported --format value: ${value ?? ''}`);
    }
    if (arg === '--evaluation-time') {
      evaluationTimeUtc = argv[++index];
      continue;
    }
    if (arg.startsWith('--evaluation-time=')) {
      evaluationTimeUtc = arg.slice('--evaluation-time='.length);
      continue;
    }
    if (arg === '--material-artifact') {
      materialArtifactPath = argv[++index];
      continue;
    }
    if (arg.startsWith('--material-artifact=')) {
      materialArtifactPath = arg.slice('--material-artifact='.length);
      continue;
    }
    if (arg === '--project-artifact') {
      projectArtifactPath = argv[++index];
      continue;
    }
    if (arg.startsWith('--project-artifact=')) {
      projectArtifactPath = arg.slice('--project-artifact='.length);
      continue;
    }
    throw new Error(`Unsupported argument: ${arg}`);
  }
  return { json, evaluationTimeUtc, materialArtifactPath, projectArtifactPath };
};
