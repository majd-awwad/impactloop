import { AppError } from '../../utils/app-error.js';
import { TAXONOMY_CONCEPT_SEEDS } from './taxonomy-foundation.data.js';
import {
  resolveMaterialConceptAssignments,
  type MaterialConceptAssignmentInput,
  type MaterialConceptAssignmentRegistry,
  type MaterialConceptAssignmentRegistryConcept,
  type MaterialConceptAssignmentResult,
  type MaterialConceptUnmatchedEvidence,
  type MaterialConceptUnmatchedReason,
} from './material-concept-assignment.js';
import {
  isValidTaxonomyCanonicalKey,
  normalizeTaxonomyAlias,
} from './taxonomy-normalization.js';

export const CATEGORY_TAXONOMY_NOT_READY_MESSAGE =
  'This category is not ready for material publishing. Please choose another category or contact support.';

export const MATERIAL_TAXONOMY_NOT_READY_MESSAGE =
  'This material could not be published because taxonomy configuration is incomplete. Please try a different material type or contact support.';

export const MATERIAL_CONCEPT_ASSIGNMENT_INTERNAL_MESSAGE =
  'Material concept assignment failed due to an internal error.';

const MATERIAL_TYPE_STRUCTURAL_REASONS = new Set<MaterialConceptUnmatchedReason>([
  'AMBIGUOUS_MAPPING',
  'INACTIVE_TARGET',
  'WRONG_CONCEPT_TYPE',
  'INVALID_CANONICAL_TARGET',
  'REGISTRY_CONFLICT',
  'MAPPING_TARGET_MISSING',
]);

const TITLE_ALLOWED_STRUCTURAL_REASONS = new Set<MaterialConceptUnmatchedReason>([
  'UNKNOWN_VALUE',
  'WRONG_CONCEPT_TYPE',
  'INACTIVE_TARGET',
  'AMBIGUOUS_MAPPING',
  'INVALID_CANONICAL_TARGET',
  'REGISTRY_CONFLICT',
  'CONFLICTING_EVIDENCE',
]);

const isExactRepeatedDefinition = (
  left: MaterialConceptAssignmentRegistryConcept,
  right: MaterialConceptAssignmentRegistryConcept,
): boolean =>
  left.canonicalKey === right.canonicalKey
  && left.id === right.id
  && left.conceptType === right.conceptType
  && left.status === right.status;

export const collectConflictedCanonicalKeys = (
  concepts: readonly MaterialConceptAssignmentRegistryConcept[],
): ReadonlySet<string> => {
  const byKey = new Map<string, MaterialConceptAssignmentRegistryConcept[]>();
  for (const concept of concepts) {
    const rows = byKey.get(concept.canonicalKey) ?? [];
    rows.push(concept);
    byKey.set(concept.canonicalKey, rows);
  }

  const conflicted = new Set<string>();
  for (const [canonicalKey, rows] of byKey) {
    const distinct: MaterialConceptAssignmentRegistryConcept[] = [];
    for (const row of rows) {
      if (!distinct.some((item) => isExactRepeatedDefinition(item, row))) {
        distinct.push(row);
      }
    }
    if (distinct.length > 1) {
      conflicted.add(canonicalKey);
    }
  }
  return conflicted;
};

const hasValidMaterialFormTarget = (
  concept: MaterialConceptAssignmentRegistryConcept | undefined,
): concept is MaterialConceptAssignmentRegistryConcept =>
  concept !== undefined
  && concept.status === 'ACTIVE'
  && concept.conceptType === 'MATERIAL_FORM'
  && isValidTaxonomyCanonicalKey(concept.canonicalKey)
  && concept.canonicalKey.startsWith('material-form:');

const reviewedFoundationMaterialTypeMappings = () =>
  TAXONOMY_CONCEPT_SEEDS.flatMap((seed) =>
    seed.conceptType === 'MATERIAL_FORM'
      ? seed.mappingRules.flatMap((rule) =>
          rule.provenance === 'REVIEWED'
            ? (rule.materialTypeNames ?? []).map((value) => ({
                value,
                canonicalKey: seed.canonicalKey,
                provenance: 'REVIEWED' as const,
                source: rule.source,
              }))
            : [])
      : []);

export type EvidenceScopedRegistryBuildResult =
  | { ok: true; registry: MaterialConceptAssignmentRegistry }
  | {
      ok: false;
      code: 'MATERIAL_TAXONOMY_NOT_READY' | 'CATEGORY_TAXONOMY_NOT_READY';
      reason: string;
    };

/**
 * Builds an engine registry from the full persisted concept set.
 * Fail-closed only for defects relevant to the current finalMaterialType /
 * category-family identity — never a global taxonomy-health gate.
 */
export const buildEvidenceScopedAssignmentRegistry = (input: {
  concepts: readonly MaterialConceptAssignmentRegistryConcept[];
  finalMaterialType: string;
  categoryFamilyCanonicalKey: string | null;
}): EvidenceScopedRegistryBuildResult => {
  const conceptsByCanonicalKey = new Map<string, MaterialConceptAssignmentRegistryConcept[]>();
  for (const concept of input.concepts) {
    const rows = conceptsByCanonicalKey.get(concept.canonicalKey) ?? [];
    rows.push(concept);
    conceptsByCanonicalKey.set(concept.canonicalKey, rows);
  }

  const conflictedKeys = collectConflictedCanonicalKeys(input.concepts);
  if (
    input.categoryFamilyCanonicalKey !== null
    && conflictedKeys.has(input.categoryFamilyCanonicalKey)
  ) {
    return {
      ok: false,
      code: 'CATEGORY_TAXONOMY_NOT_READY',
      reason: 'CATEGORY_FAMILY_REGISTRY_CONFLICT',
    };
  }

  const normalizedFinalMaterialType = normalizeTaxonomyAlias(input.finalMaterialType);
  const materialTypeMappings: MaterialConceptAssignmentRegistry['materialTypeMappings'][number][] =
    [];

  for (const mapping of reviewedFoundationMaterialTypeMappings()) {
    const targets = conceptsByCanonicalKey.get(mapping.canonicalKey) ?? [];
    const primary = targets[0];
    const targetValid =
      targets.length === 1
      && hasValidMaterialFormTarget(primary)
      && !conflictedKeys.has(mapping.canonicalKey);

    const mappingMatchesCurrent =
      normalizeTaxonomyAlias(mapping.value) === normalizedFinalMaterialType;

    if (targetValid) {
      materialTypeMappings.push(mapping);
      continue;
    }

    if (mappingMatchesCurrent) {
      return {
        ok: false,
        code: 'MATERIAL_TAXONOMY_NOT_READY',
        reason: 'CURRENT_MATERIAL_TYPE_MAPPING_TARGET_INVALID',
      };
    }
    // Unrelated invalid mapping: omit from registry; do not block create.
  }

  return {
    ok: true,
    registry: {
      concepts: input.concepts,
      materialTypeMappings,
    },
  };
};

const throwCategoryTaxonomyNotReady = (reason: string): never => {
  throw new AppError(
    CATEGORY_TAXONOMY_NOT_READY_MESSAGE,
    409,
    'CATEGORY_TAXONOMY_NOT_READY',
    { reason },
  );
};

const throwMaterialTaxonomyNotReady = (reason: string): never => {
  throw new AppError(
    MATERIAL_TAXONOMY_NOT_READY_MESSAGE,
    409,
    'MATERIAL_TAXONOMY_NOT_READY',
    { reason },
  );
};

const throwInternalAssignmentError = (reason: string): never => {
  throw new AppError(
    MATERIAL_CONCEPT_ASSIGNMENT_INTERNAL_MESSAGE,
    500,
    'INTERNAL_ERROR',
    { reason },
  );
};

const assertUnmatchedAllowed = (
  unmatched: readonly MaterialConceptUnmatchedEvidence[],
): void => {
  for (const item of unmatched) {
    if (item.reason === 'INVALID_INPUT') {
      throwInternalAssignmentError('ENGINE_INVALID_INPUT');
    }

    if (item.field === 'material.materialType') {
      if (item.reason === 'UNKNOWN_VALUE') {
        continue;
      }
      if (MATERIAL_TYPE_STRUCTURAL_REASONS.has(item.reason)) {
        throwMaterialTaxonomyNotReady(item.reason);
      }
      throwMaterialTaxonomyNotReady(item.reason);
    }

    if (item.field === 'material.title') {
      if (TITLE_ALLOWED_STRUCTURAL_REASONS.has(item.reason)) {
        continue;
      }
      throwMaterialTaxonomyNotReady(item.reason);
    }
  }
};

const assertAssignmentsConsistentWithRegistry = (
  result: MaterialConceptAssignmentResult,
  concepts: readonly MaterialConceptAssignmentRegistryConcept[],
): void => {
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  const conflictedKeys = collectConflictedCanonicalKeys(concepts);

  for (const assignment of result.assignments) {
    const concept = byId.get(assignment.conceptId);
    if (concept === undefined) {
      return throwInternalAssignmentError('ASSIGNMENT_CONCEPT_MISSING');
    }
    if (concept.canonicalKey !== assignment.canonicalKey) {
      return throwInternalAssignmentError('ASSIGNMENT_CANONICAL_MISMATCH');
    }
    if (concept.conceptType !== assignment.conceptType) {
      return throwInternalAssignmentError('ASSIGNMENT_TYPE_MISMATCH');
    }
    if (conflictedKeys.has(concept.canonicalKey)) {
      if (assignment.role === 'MATERIAL_FAMILY') {
        return throwCategoryTaxonomyNotReady('CATEGORY_FAMILY_REGISTRY_CONFLICT');
      }
      return throwMaterialTaxonomyNotReady('REGISTRY_CONFLICT');
    }
  }
};

/**
 * Converts a publishable engine result into ordered free-create concept IDs:
 * family first, optional form second. Never empty.
 */
export const toFreeCreateConceptIds = (
  result: MaterialConceptAssignmentResult,
  concepts: readonly MaterialConceptAssignmentRegistryConcept[],
): string[] => {
  if (result.status === 'BLOCKED_INVALID_CATEGORY_OWNERSHIP') {
    throwCategoryTaxonomyNotReady('BLOCKED_INVALID_CATEGORY_OWNERSHIP');
  }

  assertUnmatchedAllowed(result.unmatched);
  assertAssignmentsConsistentWithRegistry(result, concepts);

  const family = result.assignments.filter(({ role }) => role === 'MATERIAL_FAMILY');
  const forms = result.assignments.filter(({ role }) => role === 'MATERIAL_FORM');

  if (family.length !== 1) {
    throwInternalAssignmentError('FAMILY_CARDINALITY');
  }
  if (forms.length > 1) {
    throwInternalAssignmentError('FORM_CARDINALITY');
  }
  if (result.status === 'READY_WITH_FORMS' && forms.length !== 1) {
    throwInternalAssignmentError('READY_WITH_FORMS_MISSING_FORM');
  }
  if (result.status === 'READY_FAMILY_ONLY' && forms.length !== 0) {
    throwInternalAssignmentError('READY_FAMILY_ONLY_UNEXPECTED_FORM');
  }

  const conceptIds = forms.length === 1
    ? [family[0]!.conceptId, forms[0]!.conceptId]
    : [family[0]!.conceptId];

  if (new Set(conceptIds).size !== conceptIds.length) {
    throwInternalAssignmentError('DUPLICATE_CONCEPT_IDS');
  }

  return conceptIds;
};

export const resolveFreeMaterialConceptIds = (input: {
  category: MaterialConceptAssignmentInput['category'];
  materialType: string;
  title: string;
  concepts: readonly MaterialConceptAssignmentRegistryConcept[];
}): string[] => {
  const registryBuild = buildEvidenceScopedAssignmentRegistry({
    concepts: input.concepts,
    finalMaterialType: input.materialType,
    categoryFamilyCanonicalKey: input.category.materialFamilyConcept?.canonicalKey ?? null,
  });

  if (registryBuild.ok === false) {
    if (registryBuild.code === 'CATEGORY_TAXONOMY_NOT_READY') {
      return throwCategoryTaxonomyNotReady(registryBuild.reason);
    }
    return throwMaterialTaxonomyNotReady(registryBuild.reason);
  }

  const result = resolveMaterialConceptAssignments(
    {
      category: input.category,
      material: {
        materialType: input.materialType,
        title: input.title,
      },
    },
    registryBuild.registry,
  );

  return toFreeCreateConceptIds(result, input.concepts);
};

export const projectLoadedConceptsForAssignment = (
  concepts: readonly {
    id: string;
    canonicalKey: string;
    conceptType: string;
    status: string;
    aliases: readonly {
      normalizedAlias: string;
      source: string;
      isActive: boolean;
    }[];
  }[],
): MaterialConceptAssignmentRegistryConcept[] =>
  concepts.map((concept) => ({
    id: concept.id,
    canonicalKey: concept.canonicalKey,
    conceptType: concept.conceptType as MaterialConceptAssignmentRegistryConcept['conceptType'],
    status: concept.status as MaterialConceptAssignmentRegistryConcept['status'],
    aliases: concept.aliases.map((alias) => ({
      normalizedAlias: alias.normalizedAlias,
      source: alias.source,
      isActive: alias.isActive,
    })),
  }));
