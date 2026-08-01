import { createHash } from 'node:crypto';
import { AppError } from '../../utils/app-error.js';
import { TAXONOMY_ALIAS_SOURCE } from './learner-interest-resolver.js';
import {
  resolveMaterialConceptAssignments,
  type MaterialConceptAssignment,
  type MaterialConceptAssignmentInput,
  type MaterialConceptAssignmentRegistryConcept,
  type MaterialConceptAssignmentResult,
  type MaterialConceptAssignmentSource,
} from './material-concept-assignment.js';
import {
  buildEvidenceScopedAssignmentRegistry,
  collectConflictedCanonicalKeys,
  toFreeCreateConceptIds,
} from './material-concept-assignment-publish.js';
import { TAXONOMY_CONCEPT_SEEDS } from './taxonomy-foundation.data.js';
import { isValidTaxonomyCanonicalKey, normalizeTaxonomyAlias } from './taxonomy-normalization.js';

export const MATERIAL_TAXONOMY_AUDIT_SCHEMA_VERSION = 'material-taxonomy-audit-v1' as const;
export const MATERIAL_TAXONOMY_AUDIT_EVIDENCE_HASH_VERSION = 'material-taxonomy-audit-evidence-v1' as const;
export const ALL_MATERIAL_STATUSES = ['AVAILABLE', 'PENDING_RESERVATION', 'RESERVED', 'REUSED', 'UNAVAILABLE'] as const;
export type MaterialAuditStatus = (typeof ALL_MATERIAL_STATUSES)[number];
export const OPERATIONAL_MATERIAL_STATUSES = ['AVAILABLE', 'PENDING_RESERVATION', 'RESERVED', 'UNAVAILABLE'] as const satisfies readonly MaterialAuditStatus[];
export const HISTORICAL_MATERIAL_STATUSES = ['REUSED'] as const satisfies readonly MaterialAuditStatus[];
export const PUBLIC_DISCOVERABLE_MATERIAL_STATUSES = ['AVAILABLE', 'PENDING_RESERVATION', 'RESERVED'] as const satisfies readonly MaterialAuditStatus[];
export const CHECK_MATERIAL_STATUSES = OPERATIONAL_MATERIAL_STATUSES;
export const REPORTED_ONLY_MATERIAL_STATUSES = HISTORICAL_MATERIAL_STATUSES;

export type MaterialPrimaryClassification =
  | 'CATEGORY_OWNERSHIP_BLOCKED' | 'MATERIAL_EVIDENCE_STRUCTURAL_ERROR' | 'INTERNAL_ASSIGNMENT_INVARIANT'
  | 'DUPLICATE_SEMANTIC_ASSIGNMENT' | 'UNSUPPORTED_STORED_CONCEPT_TYPE' | 'MALFORMED_STORED_CANONICAL_KEY'
  | 'WRONG_STORED_CONCEPT_TYPE' | 'INACTIVE_STORED_CONCEPT' | 'MISSING_ALL_ASSIGNMENTS' | 'MISSING_FAMILY'
  | 'STALE_FAMILY' | 'EXTRA_ASSIGNMENTS' | 'UNEXPECTED_FORM' | 'STALE_FORM' | 'MISSING_EXPECTED_FORM'
  | 'EXACT_FAMILY_AND_FORM' | 'EXACT_FAMILY_ONLY';
export type RepairReadiness = 'NO_ACTION_REQUIRED' | 'AUTO_REPAIR_ELIGIBLE' | 'MANUAL_REVIEW_REQUIRED';
export type RegistryIssueSeverity = 'critical' | 'warning';
export type RegistryIssueReach = 'CURRENTLY_REACHED' | 'DORMANT' | 'GLOBAL';
export type StoredConceptRow = { conceptId: string; canonicalKey: string; conceptType: string; status: 'ACTIVE' | 'INACTIVE' | string; createdAt?: string };
export type AuditMaterialInput = { id: string; status: MaterialAuditStatus; categoryId: string; materialType: string; title: string; updatedAt: string | Date; storedConcepts: readonly StoredConceptRow[] };
export type CategoryOwnershipForAudit = MaterialConceptAssignmentInput['category'];
export type DesiredAssignmentSuccess = { ok: true; conceptIds: string[]; engineResult: MaterialConceptAssignmentResult; family: MaterialConceptAssignment; form: MaterialConceptAssignment | null; formFromTitleFallback: boolean };
export type DesiredAssignmentBlocker = { ok: false; primary: Extract<MaterialPrimaryClassification, 'CATEGORY_OWNERSHIP_BLOCKED' | 'MATERIAL_EVIDENCE_STRUCTURAL_ERROR' | 'INTERNAL_ASSIGNMENT_INVARIANT'>; reason: string; engineResult: MaterialConceptAssignmentResult | null };
export type DesiredAssignmentOutcome = DesiredAssignmentSuccess | DesiredAssignmentBlocker;
export type MaterialTypeMatchKind = 'reviewed_mapping' | 'canonical_key' | 'reviewed_explicit_alias' | 'reviewed_label_alias' | 'unknown' | 'ambiguous_or_invalid' | 'blocked';
export type MaterialAuditSample = { materialId: string; status: MaterialAuditStatus; categoryId: string; materialTypeEvidenceHash: string; titleEvidenceHash: string; primaryClassification: MaterialPrimaryClassification; issueCodes: string[]; desiredCanonicalKeys: string[]; storedCanonicalKeys: string[]; updatedAt: string; repairReadiness: RepairReadiness };
export type BoundedIssueBucket<T> = { total: number; sampleLimit: number; truncated: boolean; samples: T[] };
export type RegistryHealthSample = { code: string; severity: RegistryIssueSeverity; reach: RegistryIssueReach; normalizedAlias?: string; canonicalKeys?: string[]; conceptIds?: string[]; mappingValueHash?: string; detail: string };
export type MaterialClassificationResult = {
  materialId: string; status: MaterialAuditStatus; categoryId: string; updatedAt: string;
  primary: MaterialPrimaryClassification; issues: string[]; allIssues: string[]; secondaryIssues: string[];
  repairReadiness: RepairReadiness; desiredCanonicalKeys: string[]; storedCanonicalKeys: string[];
  materialTypeEvidenceHash: string; titleEvidenceHash: string; formFromTitleFallback: boolean;
  titleFallbackUnknown: boolean; materialTypeMatchKind: MaterialTypeMatchKind; gatedCritical: boolean;
};

const PRIMARY_SEVERITY: Record<MaterialPrimaryClassification, number> = {
  CATEGORY_OWNERSHIP_BLOCKED: 0, MATERIAL_EVIDENCE_STRUCTURAL_ERROR: 1, INTERNAL_ASSIGNMENT_INVARIANT: 2,
  DUPLICATE_SEMANTIC_ASSIGNMENT: 3, UNSUPPORTED_STORED_CONCEPT_TYPE: 4, MALFORMED_STORED_CANONICAL_KEY: 5,
  WRONG_STORED_CONCEPT_TYPE: 6, INACTIVE_STORED_CONCEPT: 7, MISSING_ALL_ASSIGNMENTS: 8, MISSING_FAMILY: 9,
  STALE_FAMILY: 10, EXTRA_ASSIGNMENTS: 11, UNEXPECTED_FORM: 12, STALE_FORM: 13, MISSING_EXPECTED_FORM: 14,
  EXACT_FAMILY_AND_FORM: 15, EXACT_FAMILY_ONLY: 16,
};
const HEALTHY_PRIMARIES = new Set<MaterialPrimaryClassification>(['EXACT_FAMILY_ONLY', 'EXACT_FAMILY_AND_FORM']);
const OPERATIONAL_SET = new Set<string>(OPERATIONAL_MATERIAL_STATUSES);
const CHECK_STATUS_SET = new Set<string>(CHECK_MATERIAL_STATUSES);
const asciiCompare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const toIso = (value: string | Date) => value instanceof Date ? value.toISOString() : value;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const hashTaxonomyEvidence = (raw: string) => `sha256:${createHash('sha256').update(normalizeTaxonomyAlias(raw)).digest('hex')}`;
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw new Error('Canonical JSON cannot contain non-finite numbers.'); return JSON.stringify(Object.is(value, -0) ? 0 : value); }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort(asciiCompare).map((key) => { if (value[key] === undefined) throw new Error(`Canonical JSON cannot contain undefined at ${key}.`); return `${JSON.stringify(key)}:${canonicalJson(value[key])}`; }).join(',')}}`;
  throw new Error(`Unsupported canonical JSON value: ${typeof value}`);
};
export const stableContentHash = (value: unknown) => `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;

export const mapPersistenceAppErrorToAuditBlocker = (error: AppError): DesiredAssignmentBlocker => {
  const reason = isRecord(error.details) && typeof error.details.reason === 'string' ? error.details.reason : error.code;
  if (error.code === 'CATEGORY_TAXONOMY_NOT_READY') return { ok: false, primary: 'CATEGORY_OWNERSHIP_BLOCKED', reason, engineResult: null };
  if (error.code === 'MATERIAL_TAXONOMY_NOT_READY') return { ok: false, primary: 'MATERIAL_EVIDENCE_STRUCTURAL_ERROR', reason, engineResult: null };
  return { ok: false, primary: 'INTERNAL_ASSIGNMENT_INVARIANT', reason: error.code === 'INTERNAL_ERROR' ? reason : `UNEXPECTED_APP_ERROR:${error.code}`, engineResult: null };
};

const reviewedMappings = () => TAXONOMY_CONCEPT_SEEDS.flatMap((seed) => seed.conceptType === 'MATERIAL_FORM'
  ? seed.mappingRules.flatMap((rule) => rule.provenance === 'REVIEWED' ? (rule.materialTypeNames ?? []).map((value) => ({ value, canonicalKey: seed.canonicalKey })) : []) : []);
const isEngineAliasSource = (source: string) => source === TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT || source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN || source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR;
const expectedNamespaceForType = (type: string): string | null => ({ MATERIAL_FAMILY: 'material-family:', MATERIAL_FORM: 'material-form:', INTEREST: 'interest:', PROJECT_TOPIC: 'project-topic:', COMPONENT: 'component:' })[type] ?? null;
const malformed = (row: StoredConceptRow) => !isValidTaxonomyCanonicalKey(row.canonicalKey) || !expectedNamespaceForType(row.conceptType) || !row.canonicalKey.startsWith(expectedNamespaceForType(row.conceptType)!);
const wrongType = (row: StoredConceptRow) => (row.conceptType === 'MATERIAL_FAMILY' || row.conceptType === 'MATERIAL_FORM') && !row.canonicalKey.startsWith(expectedNamespaceForType(row.conceptType)!);

export const resolveDesiredMaterialAssignment = (input: { category: CategoryOwnershipForAudit | null; materialType: string; title: string; concepts: readonly MaterialConceptAssignmentRegistryConcept[] }): DesiredAssignmentOutcome => {
  if (!input.category) return { ok: false, primary: 'CATEGORY_OWNERSHIP_BLOCKED', reason: 'CATEGORY_NOT_FOUND', engineResult: null };
  try {
    const built = buildEvidenceScopedAssignmentRegistry({ concepts: input.concepts, finalMaterialType: input.materialType, categoryFamilyCanonicalKey: input.category.materialFamilyConcept?.canonicalKey ?? null });
    if (!built.ok) return { ok: false, primary: built.code === 'CATEGORY_TAXONOMY_NOT_READY' ? 'CATEGORY_OWNERSHIP_BLOCKED' : 'MATERIAL_EVIDENCE_STRUCTURAL_ERROR', reason: built.reason, engineResult: null };
    const engineResult = resolveMaterialConceptAssignments({ category: input.category, material: { materialType: input.materialType, title: input.title } }, built.registry);
    const conceptIds = toFreeCreateConceptIds(engineResult, input.concepts);
    const family = engineResult.assignments.find((a) => a.role === 'MATERIAL_FAMILY');
    if (!family) return { ok: false, primary: 'INTERNAL_ASSIGNMENT_INVARIANT', reason: 'FAMILY_MISSING_AFTER_PUBLISH', engineResult };
    const form = engineResult.assignments.find((a) => a.role === 'MATERIAL_FORM') ?? null;
    return { ok: true, conceptIds, engineResult, family, form, formFromTitleFallback: Boolean(form?.evidence.some((e) => e.field === 'material.title') && !form.evidence.some((e) => e.field === 'material.materialType')) };
  } catch (error) { if (error instanceof AppError) return mapPersistenceAppErrorToAuditBlocker(error); throw error; }
};

const sourceKind = (
  source: MaterialConceptAssignmentSource | undefined,
): MaterialTypeMatchKind => {
  switch (source) {
    case 'REVIEWED_MATERIAL_TYPE_RULE':
      return 'reviewed_mapping';
    case 'CANONICAL_KEY':
      return 'canonical_key';
    case 'REVIEWED_ALIAS':
      return 'reviewed_explicit_alias';
    case 'REVIEWED_LABEL':
      return 'reviewed_label_alias';
    default:
      return 'unknown';
  }
};
export const resolveMaterialTypeMatchKind = (desired: DesiredAssignmentSuccess): MaterialTypeMatchKind => {
  const typeEvidence = desired.form?.evidence.find((e) => e.field === 'material.materialType');
  if (typeEvidence) return sourceKind(typeEvidence.source);
  const unmatched = desired.engineResult.unmatched.find((e) => e.field === 'material.materialType');
  return unmatched && unmatched.reason !== 'UNKNOWN_VALUE' ? 'ambiguous_or_invalid' : 'unknown';
};
export const classifyCatalogDesiredFailure = (desired: DesiredAssignmentBlocker): 'ambiguous' | 'invalid' =>
  desired.reason === 'AMBIGUOUS_MAPPING' || desired.reason === 'REGISTRY_CONFLICT' ? 'ambiguous' : 'invalid';

export type MaterialTypeCatalogResolutionKind =
  | 'resolveToReviewedForm'
  | 'resolveFamilyOnly'
  | 'ambiguous'
  | 'invalidOrMissingTarget';

/** Catalog coverage counts a reviewed form only when evidence came from material.materialType. */
export const classifyMaterialTypeCatalogResolution = (
  desired: DesiredAssignmentOutcome,
): MaterialTypeCatalogResolutionKind => {
  if (!desired.ok) {
    return classifyCatalogDesiredFailure(desired) === 'ambiguous' ? 'ambiguous' : 'invalidOrMissingTarget';
  }
  const formFromMaterialType = desired.form?.evidence.some((entry) => entry.field === 'material.materialType') ?? false;
  if (desired.form && formFromMaterialType) return 'resolveToReviewedForm';
  return 'resolveFamilyOnly';
};

export const classifyMaterialTaxonomyAssignment = (input: { material: AuditMaterialInput; desired: DesiredAssignmentOutcome }): MaterialClassificationResult => {
  const material = input.material, stored = [...material.storedConcepts].sort((a, b) => asciiCompare(a.conceptId, b.conceptId));
  const issues = new Set<string>(), familyRows = stored.filter((r) => r.conceptType === 'MATERIAL_FAMILY'), formRows = stored.filter((r) => r.conceptType === 'MATERIAL_FORM');
  const otherRows = stored.filter((r) => r.conceptType !== 'MATERIAL_FAMILY' && r.conceptType !== 'MATERIAL_FORM');
  if (familyRows.length > 1 || formRows.length > 1) issues.add('DUPLICATE_SEMANTIC_ASSIGNMENT');
  if (otherRows.length) issues.add('UNSUPPORTED_STORED_CONCEPT_TYPE');
  for (const row of stored) { if (malformed(row)) issues.add('MALFORMED_STORED_CANONICAL_KEY'); if (wrongType(row)) issues.add('WRONG_STORED_CONCEPT_TYPE'); if (row.status === 'INACTIVE') issues.add('INACTIVE_STORED_CONCEPT'); }
  let desiredKeys: string[] = [], formFallback = false, titleFallbackUnknown = false, match: MaterialTypeMatchKind = 'blocked';
  if (!input.desired.ok) {
    issues.add(input.desired.primary);
    desiredKeys = input.desired.engineResult?.canonicalKeys.slice().sort(asciiCompare) ?? [];
  } else {
    const desired = input.desired, desiredIds = new Set(desired.conceptIds), storedIds = new Set(stored.map((r) => r.conceptId));
    desiredKeys = desired.engineResult.canonicalKeys.slice().sort(asciiCompare);
    formFallback = desired.formFromTitleFallback;
    match = resolveMaterialTypeMatchKind(desired);
    const typeUnknown = desired.engineResult.unmatched.some((e) => e.field === 'material.materialType' && e.reason === 'UNKNOWN_VALUE');
    const titleUnknown = desired.engineResult.unmatched.some((e) => e.field === 'material.title' && e.reason === 'UNKNOWN_VALUE');
    titleFallbackUnknown = typeUnknown && titleUnknown && desired.form === null;
    if (!stored.length) issues.add('MISSING_ALL_ASSIGNMENTS');
    if (!storedIds.has(desired.family.conceptId)) issues.add(familyRows.length ? 'STALE_FAMILY' : 'MISSING_FAMILY');
    if (desired.form) {
      if (!formRows.length) issues.add('MISSING_EXPECTED_FORM');
      else if (!formRows.some((r) => r.conceptId === desired.form!.conceptId)) issues.add('STALE_FORM');
    } else if (formRows.length) issues.add('UNEXPECTED_FORM');
    if ([...storedIds].some((id) => !desiredIds.has(id))) issues.add('EXTRA_ASSIGNMENTS');
  }
  const allIssues = [...issues].sort((a, b) => (PRIMARY_SEVERITY[a as MaterialPrimaryClassification] ?? 999) - (PRIMARY_SEVERITY[b as MaterialPrimaryClassification] ?? 999) || asciiCompare(a, b));
  const resolvedPrimary = allIssues.length === 0 && input.desired.ok
    ? (input.desired.form ? 'EXACT_FAMILY_AND_FORM' : 'EXACT_FAMILY_ONLY')
    : (allIssues[0] as MaterialPrimaryClassification);
  const secondaryIssues = allIssues.filter((issue) => issue !== resolvedPrimary);
  const healthy = HEALTHY_PRIMARIES.has(resolvedPrimary);
  return {
    materialId: material.id, status: material.status, categoryId: material.categoryId, updatedAt: toIso(material.updatedAt), primary: resolvedPrimary,
    issues: allIssues, allIssues, secondaryIssues, repairReadiness: healthy ? 'NO_ACTION_REQUIRED' : input.desired.ok ? 'AUTO_REPAIR_ELIGIBLE' : 'MANUAL_REVIEW_REQUIRED',
    desiredCanonicalKeys: desiredKeys, storedCanonicalKeys: stored.map((r) => r.canonicalKey).sort(asciiCompare),
    materialTypeEvidenceHash: hashTaxonomyEvidence(material.materialType), titleEvidenceHash: hashTaxonomyEvidence(material.title),
    formFromTitleFallback: formFallback, titleFallbackUnknown, materialTypeMatchKind: input.desired.ok ? match : 'blocked',
    gatedCritical: OPERATIONAL_SET.has(material.status) && !healthy,
  };
};

type SampleCandidate = MaterialAuditSample & { severity: number };
const insertBounded = <T>(items: T[], item: T, limit: number, compare: (a: T, b: T) => number) => { items.push(item); items.sort(compare); if (items.length > limit) items.length = limit; };
const compareSample = (a: SampleCandidate, b: SampleCandidate) => a.severity - b.severity || asciiCompare(b.updatedAt, a.updatedAt) || asciiCompare(a.materialId, b.materialId);
const toSample = (c: MaterialClassificationResult): SampleCandidate => ({
  materialId: c.materialId,
  status: c.status,
  categoryId: c.categoryId,
  materialTypeEvidenceHash: c.materialTypeEvidenceHash,
  titleEvidenceHash: c.titleEvidenceHash,
  primaryClassification: c.primary,
  issueCodes: HEALTHY_PRIMARIES.has(c.primary)
    ? [c.primary]
    : [c.primary, ...c.secondaryIssues],
  desiredCanonicalKeys: c.desiredCanonicalKeys,
  storedCanonicalKeys: c.storedCanonicalKeys,
  updatedAt: c.updatedAt,
  repairReadiness: c.repairReadiness,
  severity: PRIMARY_SEVERITY[c.primary],
});

export const buildMaterialEvidenceAliasUniverse = (concepts: readonly MaterialConceptAssignmentRegistryConcept[]): ReadonlySet<string> => {
  const values = new Set<string>();
  for (const concept of concepts) for (const alias of concept.aliases) if (alias.isActive) values.add(alias.normalizedAlias);
  for (const mapping of reviewedMappings()) values.add(normalizeTaxonomyAlias(mapping.value));
  return values;
};
export type RegistryHealth = { criticalIssueCount: number; warningIssueCount: number; criticalByCode: Record<string, number>; warningByCode: Record<string, number>; byCode: Record<string, BoundedIssueBucket<RegistryHealthSample>> };

export const compareRegistryHealthSample = (a: RegistryHealthSample, b: RegistryHealthSample): number =>
  asciiCompare(a.detail, b.detail)
  || asciiCompare(a.reach, b.reach)
  || asciiCompare(a.normalizedAlias ?? '', b.normalizedAlias ?? '')
  || asciiCompare(a.mappingValueHash ?? '', b.mappingValueHash ?? '')
  || asciiCompare((a.canonicalKeys ?? []).join('\u0000'), (b.canonicalKeys ?? []).join('\u0000'))
  || asciiCompare((a.conceptIds ?? []).join('\u0000'), (b.conceptIds ?? []).join('\u0000'));

const namespaceTypeMismatch = (concept: MaterialConceptAssignmentRegistryConcept): boolean => {
  const expected = expectedNamespaceForType(concept.conceptType);
  if (!expected || !isValidTaxonomyCanonicalKey(concept.canonicalKey)) return false;
  return !concept.canonicalKey.startsWith(expected);
};

export const classifyReviewedMappingTargetState = (input: {
  canonicalKey: string;
  conflicts: ReadonlySet<string>;
  targets: readonly MaterialConceptAssignmentRegistryConcept[];
}): 'CONFLICTED' | 'INVALID_CANONICAL' | 'MISSING' | 'INACTIVE' | 'WRONG_TYPE' | null => {
  if (input.conflicts.has(input.canonicalKey)) return 'CONFLICTED';
  if (!isValidTaxonomyCanonicalKey(input.canonicalKey) || !input.canonicalKey.startsWith('material-form:')) {
    return 'INVALID_CANONICAL';
  }
  if (!input.targets.length) return 'MISSING';
  if (input.targets.some((target) => target.status !== 'ACTIVE')) return 'INACTIVE';
  if (input.targets.some((target) => target.conceptType !== 'MATERIAL_FORM')) return 'WRONG_TYPE';
  return null;
};

export const auditRegistryHealth = (input: { concepts: readonly MaterialConceptAssignmentRegistryConcept[]; reachedNormalizedEvidence: ReadonlySet<string>; sampleLimit?: number }): RegistryHealth => {
  const sampleLimit = input.sampleLimit ?? 20;
  const criticalByCode: Record<string, number> = {}, warningByCode: Record<string, number> = {};
  const buckets = new Map<string, RegistryHealthSample[]>();
  const totals = new Map<string, number>();
  const add = (sample: RegistryHealthSample) => {
    const normalized: RegistryHealthSample = {
      code: sample.code,
      severity: sample.severity,
      reach: sample.reach,
      detail: sample.detail,
    };
    if (sample.normalizedAlias !== undefined) normalized.normalizedAlias = sample.normalizedAlias;
    if (sample.mappingValueHash !== undefined) normalized.mappingValueHash = sample.mappingValueHash;
    if (sample.canonicalKeys !== undefined) normalized.canonicalKeys = [...sample.canonicalKeys].sort(asciiCompare);
    if (sample.conceptIds !== undefined) normalized.conceptIds = [...sample.conceptIds].sort(asciiCompare);
    const counts = normalized.severity === 'critical' ? criticalByCode : warningByCode;
    counts[normalized.code] = (counts[normalized.code] ?? 0) + 1;
    totals.set(normalized.code, (totals.get(normalized.code) ?? 0) + 1);
    const bucket = buckets.get(normalized.code) ?? [];
    insertBounded(bucket, normalized, sampleLimit, compareRegistryHealthSample);
    buckets.set(normalized.code, bucket);
  };
  const conflicts = collectConflictedCanonicalKeys(input.concepts), byKey = new Map<string, MaterialConceptAssignmentRegistryConcept[]>();
  for (const concept of input.concepts) {
    const rows = byKey.get(concept.canonicalKey) ?? []; rows.push(concept); byKey.set(concept.canonicalKey, rows);
    if (!isValidTaxonomyCanonicalKey(concept.canonicalKey)) {
      add({ code: 'MALFORMED_CANONICAL_KEY', severity: 'critical', reach: 'GLOBAL', canonicalKeys: [concept.canonicalKey], conceptIds: [concept.id], detail: 'Persisted concept has malformed canonical key' });
    } else if (namespaceTypeMismatch(concept)) {
      add({
        code: 'CANONICAL_NAMESPACE_TYPE_MISMATCH',
        severity: 'critical',
        reach: 'GLOBAL',
        canonicalKeys: [concept.canonicalKey],
        conceptIds: [concept.id],
        detail: `Concept type ${concept.conceptType} does not match canonical namespace`,
      });
    }
    for (const alias of concept.aliases) if (alias.isActive && concept.status === 'INACTIVE') add({ code: 'ACTIVE_ALIAS_INACTIVE_TARGET', severity: concept.conceptType === 'MATERIAL_FORM' && isEngineAliasSource(alias.source) ? 'critical' : 'warning', reach: input.reachedNormalizedEvidence.has(alias.normalizedAlias) ? 'CURRENTLY_REACHED' : 'DORMANT', normalizedAlias: alias.normalizedAlias, canonicalKeys: [concept.canonicalKey], conceptIds: [concept.id], detail: `Active alias targets inactive ${concept.conceptType}` });
  }
  for (const key of [...conflicts].sort(asciiCompare)) add({ code: 'CONFLICTED_CANONICAL_KEY', severity: 'critical', reach: 'GLOBAL', canonicalKeys: [key], detail: 'Conflicting persisted definitions for canonical key' });
  const mappingKeys = new Map<string, Set<string>>();
  for (const mapping of reviewedMappings()) {
    const keys = mappingKeys.get(normalizeTaxonomyAlias(mapping.value)) ?? new Set<string>(); keys.add(mapping.canonicalKey); mappingKeys.set(normalizeTaxonomyAlias(mapping.value), keys);
    const targets = byKey.get(mapping.canonicalKey) ?? [];
    const state = classifyReviewedMappingTargetState({ canonicalKey: mapping.canonicalKey, conflicts, targets });
    if (state) add({ code: `REVIEWED_MAPPING_TARGET_${state}`, severity: 'critical', reach: 'GLOBAL', canonicalKeys: [mapping.canonicalKey], mappingValueHash: hashTaxonomyEvidence(mapping.value), detail: `Reviewed materialType mapping target is ${state.toLowerCase()}` });
  }
  for (const [value, keys] of [...mappingKeys.entries()].sort(([a], [b]) => asciiCompare(a, b))) if (keys.size > 1) add({ code: 'REVIEWED_MAPPING_TARGET_CONFLICTED', severity: 'critical', reach: 'GLOBAL', canonicalKeys: [...keys].sort(asciiCompare), mappingValueHash: hashTaxonomyEvidence(value), detail: 'Reviewed materialType mapping resolves to multiple canonical keys' });
  const aliases = new Map<string, Map<string, { concept: MaterialConceptAssignmentRegistryConcept; source: string }>>();
  for (const concept of input.concepts) for (const alias of concept.aliases) if (alias.isActive && isEngineAliasSource(alias.source)) { const targets = aliases.get(alias.normalizedAlias) ?? new Map(); if (!targets.has(concept.id)) targets.set(concept.id, { concept, source: alias.source }); aliases.set(alias.normalizedAlias, targets); }
  for (const [alias, targets] of [...aliases.entries()].sort(([a], [b]) => asciiCompare(a, b))) {
    const forms = [...targets.values()].filter(({ concept }) => concept.conceptType === 'MATERIAL_FORM');
    const others = [...targets.values()].filter(({ concept }) => concept.conceptType !== 'MATERIAL_FORM');
    const reach: RegistryIssueReach = input.reachedNormalizedEvidence.has(alias) ? 'CURRENTLY_REACHED' : 'DORMANT';
    const details = [...targets.values()], ids = details.map(({ concept }) => concept.id).sort(asciiCompare), keys = details.map(({ concept }) => concept.canonicalKey).sort(asciiCompare);
    if (forms.length > 1) add({ code: 'AMBIGUOUS_MATERIAL_FORM_ALIAS', severity: 'critical', reach, normalizedAlias: alias, conceptIds: ids, canonicalKeys: keys, detail: 'Engine-indexed alias resolves to multiple material forms' });
    else if (forms.length === 1 && others.length) add({ code: 'CROSS_DOMAIN_SHARED_ALIAS', severity: 'warning', reach, normalizedAlias: alias, conceptIds: ids, canonicalKeys: keys, detail: 'Engine-indexed alias is shared by a material form and another type' });
    else if (!forms.length && others.length > 1) add({ code: 'NON_FORM_SHARED_ALIAS', severity: 'warning', reach, normalizedAlias: alias, conceptIds: ids, canonicalKeys: keys, detail: 'Engine-indexed alias is shared only by non-form concepts' });
  }
  const byCode: RegistryHealth['byCode'] = {};
  for (const code of [...buckets.keys()].sort(asciiCompare)) {
    const samples = buckets.get(code) ?? [];
    byCode[code] = { total: totals.get(code) ?? 0, sampleLimit, truncated: (totals.get(code) ?? 0) > samples.length, samples };
  }
  return { criticalIssueCount: Object.values(criticalByCode).reduce((a, b) => a + b, 0), warningIssueCount: Object.values(warningByCode).reduce((a, b) => a + b, 0), criticalByCode, warningByCode, byCode };
};

export type MaterialTaxonomyAuditAccumulator = {
  sampleLimit: number; aliasUniverse?: ReadonlySet<string>; totalMaterials: number; primaryBuckets: Map<string, SampleCandidate[]>; issueBuckets: Map<string, SampleCandidate[]>; primaryTotals: Map<string, number>; issueTotals: Map<string, number>; gatedIssueTotals: Map<string, number>;
  repairTotals: Record<RepairReadiness, number>; statusTotals: Record<MaterialAuditStatus, number>; statusFailureTotals: Record<MaterialAuditStatus, number>; titleFallbackFormCount: number; titleFallbackUnknownCount: number; materialTypeMatchCounts: Record<MaterialTypeMatchKind, number>; reachedNormalizedEvidence: Set<string>; distinctMaterialTypes: Set<string>;
};
const blankStatusTotals = (): Record<MaterialAuditStatus, number> => ({ AVAILABLE: 0, PENDING_RESERVATION: 0, RESERVED: 0, REUSED: 0, UNAVAILABLE: 0 });
const blankMatchTotals = (): Record<MaterialTypeMatchKind, number> => ({ reviewed_mapping: 0, canonical_key: 0, reviewed_explicit_alias: 0, reviewed_label_alias: 0, unknown: 0, ambiguous_or_invalid: 0, blocked: 0 });
export const createMaterialTaxonomyAuditAccumulator = (sampleLimit: number, aliasUniverse?: ReadonlySet<string>): MaterialTaxonomyAuditAccumulator => ({ sampleLimit, aliasUniverse, totalMaterials: 0, primaryBuckets: new Map(), issueBuckets: new Map(), primaryTotals: new Map(), issueTotals: new Map(), gatedIssueTotals: new Map(), repairTotals: { NO_ACTION_REQUIRED: 0, AUTO_REPAIR_ELIGIBLE: 0, MANUAL_REVIEW_REQUIRED: 0 }, statusTotals: blankStatusTotals(), statusFailureTotals: blankStatusTotals(), titleFallbackFormCount: 0, titleFallbackUnknownCount: 0, materialTypeMatchCounts: blankMatchTotals(), reachedNormalizedEvidence: new Set(), distinctMaterialTypes: new Set() });
export const accumulateMaterialClassification = (acc: MaterialTaxonomyAuditAccumulator, classification: MaterialClassificationResult, materialTypeRaw: string, titleRaw: string): void => {
  acc.totalMaterials++; acc.statusTotals[classification.status]++; acc.repairTotals[classification.repairReadiness]++; acc.materialTypeMatchCounts[classification.materialTypeMatchKind]++;
  acc.primaryTotals.set(classification.primary, (acc.primaryTotals.get(classification.primary) ?? 0) + 1);
  const sample = toSample(classification), primarySamples = acc.primaryBuckets.get(classification.primary) ?? []; insertBounded(primarySamples, sample, acc.sampleLimit, compareSample); acc.primaryBuckets.set(classification.primary, primarySamples);
  for (const issue of classification.allIssues) {
    acc.issueTotals.set(issue, (acc.issueTotals.get(issue) ?? 0) + 1);
    if (CHECK_STATUS_SET.has(classification.status)) {
      acc.gatedIssueTotals.set(issue, (acc.gatedIssueTotals.get(issue) ?? 0) + 1);
    }
    const samples = acc.issueBuckets.get(issue) ?? [];
    insertBounded(samples, sample, acc.sampleLimit, compareSample);
    acc.issueBuckets.set(issue, samples);
  }
  if (classification.gatedCritical) acc.statusFailureTotals[classification.status]++;
  if (classification.formFromTitleFallback) acc.titleFallbackFormCount++; if (classification.titleFallbackUnknown) acc.titleFallbackUnknownCount++;
  const type = normalizeTaxonomyAlias(materialTypeRaw), title = normalizeTaxonomyAlias(titleRaw);
  if (type) acc.distinctMaterialTypes.add(hashTaxonomyEvidence(materialTypeRaw));
  for (const value of [type, title]) if (value && (!acc.aliasUniverse || acc.aliasUniverse.has(value))) acc.reachedNormalizedEvidence.add(value);
};

export type MaterialTypeCatalogCoverage = { totalActive: number; withAtLeastOneMaterial: number; withActivePaidPriceRule: number; resolveToReviewedForm: number; resolveFamilyOnly: number; ambiguous: number; invalidOrMissingTarget: number };
export type MaterialTaxonomyAuditReport = {
  schemaVersion: typeof MATERIAL_TAXONOMY_AUDIT_SCHEMA_VERSION; generatedAt: string; evidenceHashVersion: typeof MATERIAL_TAXONOMY_AUDIT_EVIDENCE_HASH_VERSION;
  scope: { populations: { operational: readonly MaterialAuditStatus[]; historical: readonly MaterialAuditStatus[]; publicDiscoverable: readonly MaterialAuditStatus[]; all: readonly MaterialAuditStatus[] }; checkStatuses: readonly MaterialAuditStatus[]; reportedOnlyStatuses: readonly MaterialAuditStatus[]; consistency: { isolation: 'RepeatableRead'; limitation: string }; sampleLimit: number; publicDiscoverabilityNotes: string };
  execution: { batchSize: number; timeoutMs: number; checkMode: boolean; outputMode: 'json' | 'text' };
  summary: { totalMaterials: number; operationalMaterials: number; historicalMaterials: number; gatedCriticalFailures: number; perStatusTotals: Record<MaterialAuditStatus, number>; perStatusFailureTotals: Record<MaterialAuditStatus, number>; perPrimaryCounts: Record<string, number>; perIssueCounts: Record<string, number>; perGatedIssueCounts: Record<string, number>; checkPassed: boolean };
  assignmentCoverage: { exactFamilyOnly: number; exactFamilyAndForm: number; missingAll: number; missingFamily: number; missingExpectedForm: number };
  staleness: { staleFamily: number; staleForm: number; unexpectedForm: number; extraAssignments: number; duplicateSemantic: number; inactiveStored: number; wrongOrUnsupportedStored: number; blockers: number };
  registryHealth: RegistryHealth; ruleCoverage: { materialTypeCatalog: MaterialTypeCatalogCoverage; persistedMaterialTypes: { distinctNormalizedValues: number; matchCounts: Record<MaterialTypeMatchKind, number> }; titleFallback: { desiredFormsFromTitleFallback: number; titleFallbackUnknown: number } }; repairReadiness: Record<RepairReadiness, number>; samples: { byPrimary: Record<string, BoundedIssueBucket<MaterialAuditSample>>; byIssue: Record<string, BoundedIssueBucket<MaterialAuditSample>> }; contentHash: string;
};
const bucketsToReport = (buckets: Map<string, SampleCandidate[]>, totals: Map<string, number>, limit: number): Record<string, BoundedIssueBucket<MaterialAuditSample>> => Object.fromEntries([...buckets].map(([code, samples]) => [code, { total: totals.get(code) ?? 0, sampleLimit: limit, truncated: (totals.get(code) ?? 0) > samples.length, samples: samples.map(({ severity: _severity, ...sample }) => sample) }]));
export const buildMaterialTaxonomyAuditReport = (input: { generatedAt?: string; sampleLimit: number; batchSize: number; timeoutMs: number; checkMode: boolean; outputMode: 'json' | 'text'; accumulator: MaterialTaxonomyAuditAccumulator; concepts: readonly MaterialConceptAssignmentRegistryConcept[]; materialTypeCatalog: MaterialTypeCatalogCoverage }): MaterialTaxonomyAuditReport => {
  const acc = input.accumulator, registryHealth = auditRegistryHealth({ concepts: input.concepts, reachedNormalizedEvidence: acc.reachedNormalizedEvidence, sampleLimit: input.sampleLimit });
  const perPrimaryCounts = Object.fromEntries(Object.keys(PRIMARY_SEVERITY).map((code) => [code, acc.primaryTotals.get(code) ?? 0]));
  const perIssueCounts = Object.fromEntries([...acc.issueTotals].sort(([a], [b]) => asciiCompare(a, b)));
  const perGatedIssueCounts = Object.fromEntries([...acc.gatedIssueTotals].sort(([a], [b]) => asciiCompare(a, b)));
  const issue = (code: string) => acc.issueTotals.get(code) ?? 0;
  const operationalMaterials = OPERATIONAL_MATERIAL_STATUSES.reduce((sum, status) => sum + acc.statusTotals[status], 0), historicalMaterials = HISTORICAL_MATERIAL_STATUSES.reduce((sum, status) => sum + acc.statusTotals[status], 0), gatedCriticalFailures = OPERATIONAL_MATERIAL_STATUSES.reduce((sum, status) => sum + acc.statusFailureTotals[status], 0);
  const report = {
    schemaVersion: MATERIAL_TAXONOMY_AUDIT_SCHEMA_VERSION, generatedAt: input.generatedAt ?? new Date().toISOString(), evidenceHashVersion: MATERIAL_TAXONOMY_AUDIT_EVIDENCE_HASH_VERSION,
    scope: { populations: { operational: OPERATIONAL_MATERIAL_STATUSES, historical: HISTORICAL_MATERIAL_STATUSES, publicDiscoverable: PUBLIC_DISCOVERABLE_MATERIAL_STATUSES, all: ALL_MATERIAL_STATUSES }, checkStatuses: CHECK_MATERIAL_STATUSES, reportedOnlyStatuses: REPORTED_ONLY_MATERIAL_STATUSES, consistency: { isolation: 'RepeatableRead' as const, limitation: 'Report reflects a single Prisma RepeatableRead snapshot. Timeout fails the command instead of returning a partial report.' }, sampleLimit: input.sampleLimit, publicDiscoverabilityNotes: 'Public list/detail require public status and an active MATERIAL or BOTH category.' },
    execution: { batchSize: input.batchSize, timeoutMs: input.timeoutMs, checkMode: input.checkMode, outputMode: input.outputMode },
    summary: { totalMaterials: acc.totalMaterials, operationalMaterials, historicalMaterials, gatedCriticalFailures, perStatusTotals: { ...acc.statusTotals }, perStatusFailureTotals: { ...acc.statusFailureTotals }, perPrimaryCounts, perIssueCounts, perGatedIssueCounts, checkPassed: gatedCriticalFailures === 0 && registryHealth.criticalIssueCount === 0 },
    assignmentCoverage: { exactFamilyOnly: acc.primaryTotals.get('EXACT_FAMILY_ONLY') ?? 0, exactFamilyAndForm: acc.primaryTotals.get('EXACT_FAMILY_AND_FORM') ?? 0, missingAll: issue('MISSING_ALL_ASSIGNMENTS'), missingFamily: issue('MISSING_FAMILY'), missingExpectedForm: issue('MISSING_EXPECTED_FORM') },
    staleness: { staleFamily: issue('STALE_FAMILY'), staleForm: issue('STALE_FORM'), unexpectedForm: issue('UNEXPECTED_FORM'), extraAssignments: issue('EXTRA_ASSIGNMENTS'), duplicateSemantic: issue('DUPLICATE_SEMANTIC_ASSIGNMENT'), inactiveStored: issue('INACTIVE_STORED_CONCEPT'), wrongOrUnsupportedStored: issue('WRONG_STORED_CONCEPT_TYPE') + issue('UNSUPPORTED_STORED_CONCEPT_TYPE') + issue('MALFORMED_STORED_CANONICAL_KEY'), blockers: issue('CATEGORY_OWNERSHIP_BLOCKED') + issue('MATERIAL_EVIDENCE_STRUCTURAL_ERROR') + issue('INTERNAL_ASSIGNMENT_INVARIANT') },
    registryHealth, ruleCoverage: { materialTypeCatalog: input.materialTypeCatalog, persistedMaterialTypes: { distinctNormalizedValues: acc.distinctMaterialTypes.size, matchCounts: { ...acc.materialTypeMatchCounts } }, titleFallback: { desiredFormsFromTitleFallback: acc.titleFallbackFormCount, titleFallbackUnknown: acc.titleFallbackUnknownCount } }, repairReadiness: { ...acc.repairTotals }, samples: { byPrimary: bucketsToReport(acc.primaryBuckets, acc.primaryTotals, input.sampleLimit), byIssue: bucketsToReport(acc.issueBuckets, acc.issueTotals, input.sampleLimit) },
  };
  const { generatedAt: _generatedAt, execution: _execution, ...hashPayload } = report;
  return { ...report, contentHash: stableContentHash(hashPayload) };
};
export const evaluateCheckGate = (report: MaterialTaxonomyAuditReport) => report.summary.checkPassed;
export const renderMaterialTaxonomyAuditTextReport = (report: MaterialTaxonomyAuditReport): string => [
  'Material taxonomy coverage and staleness audit', `Generated: ${report.generatedAt}`, `Schema: ${report.schemaVersion}`, '',
  'Summary', `  totalMaterials: ${report.summary.totalMaterials}`, `  gatedCriticalFailures: ${report.summary.gatedCriticalFailures}`, `  registryCriticalIssues: ${report.registryHealth.criticalIssueCount}`, `  registryWarningIssues: ${report.registryHealth.warningIssueCount}`,
  `Result: ${report.execution.checkMode ? report.summary.checkPassed ? 'CHECK_PASS' : 'CHECK_FAIL' : 'REPORT_OK'}`, `contentHash: ${report.contentHash}`, '',
].join('\n');
