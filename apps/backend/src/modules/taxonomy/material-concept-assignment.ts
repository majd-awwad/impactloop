import { TAXONOMY_ALIAS_SOURCE } from './learner-interest-resolver.js';
import {
  isValidTaxonomyCanonicalKey,
  normalizeTaxonomyAlias,
} from './taxonomy-normalization.js';

export type MaterialConceptAssignmentConceptType =
  | 'INTEREST'
  | 'MATERIAL_FAMILY'
  | 'MATERIAL_FORM'
  | 'PROJECT_TOPIC'
  | 'COMPONENT';

export type MaterialConceptAssignmentConceptStatus = 'ACTIVE' | 'INACTIVE';

export type MaterialConceptAssignmentInput = {
  category: {
    id: string;
    categoryType: 'MATERIAL' | 'PROJECT' | 'BOTH';
    isActive: boolean;
    materialFamilyConceptId: string | null;
    materialFamilyConcept: {
      id: string;
      canonicalKey: string;
      conceptType: MaterialConceptAssignmentConceptType;
      status: MaterialConceptAssignmentConceptStatus;
    } | null;
  };
  material: {
    materialType: string;
    title: string;
  };
};

export type MaterialConceptAssignmentRegistryConcept = {
  id: string;
  canonicalKey: string;
  conceptType: MaterialConceptAssignmentConceptType;
  status: MaterialConceptAssignmentConceptStatus;
  aliases: readonly {
    normalizedAlias: string;
    source: string;
    isActive: boolean;
  }[];
};

export type MaterialConceptAssignmentRegistry = {
  concepts: readonly MaterialConceptAssignmentRegistryConcept[];
  materialTypeMappings: readonly {
    value: string;
    canonicalKey: string;
    provenance: 'REVIEWED';
    source: string;
  }[];
};

export type MaterialConceptAssignmentStatus =
  | 'READY_WITH_FORMS'
  | 'READY_FAMILY_ONLY'
  | 'BLOCKED_INVALID_CATEGORY_OWNERSHIP';

export type MaterialConceptAssignmentSource =
  | 'CATEGORY_OWNERSHIP'
  | 'CANONICAL_KEY'
  | 'REVIEWED_MATERIAL_TYPE_RULE'
  | 'REVIEWED_ALIAS'
  | 'REVIEWED_LABEL';

export type MaterialConceptAssignmentRole =
  | 'MATERIAL_FAMILY'
  | 'MATERIAL_FORM';

export type MaterialConceptUnmatchedReason =
  | 'INVALID_INPUT'
  | 'UNKNOWN_VALUE'
  | 'AMBIGUOUS_MAPPING'
  | 'INACTIVE_TARGET'
  | 'WRONG_CONCEPT_TYPE'
  | 'INVALID_CANONICAL_TARGET'
  | 'MAPPING_TARGET_MISSING'
  | 'REGISTRY_CONFLICT'
  | 'CONFLICTING_EVIDENCE'
  | 'CATEGORY_INACTIVE'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'CATEGORY_OWNERSHIP_MISSING'
  | 'CATEGORY_OWNERSHIP_CONFLICT'
  | 'CATEGORY_OWNERSHIP_INVALID_TARGET';

export type MaterialConceptAssignmentEvidence = {
  field: string;
  rawValue: string;
  normalizedValue: string;
  source: MaterialConceptAssignmentSource;
};

export type MaterialConceptAssignment = {
  conceptId: string;
  canonicalKey: string;
  conceptType: 'MATERIAL_FAMILY' | 'MATERIAL_FORM';
  role: MaterialConceptAssignmentRole;
  source: MaterialConceptAssignmentSource;
  evidenceField: string;
  normalizedEvidence: string;
  evidence: MaterialConceptAssignmentEvidence[];
};

export type MaterialConceptUnmatchedEvidence = {
  field: string;
  rawValue: string | null;
  normalizedValue: string;
  reason: MaterialConceptUnmatchedReason;
  candidateCanonicalKeys: string[];
};

export type MaterialConceptAssignmentResult = {
  status: MaterialConceptAssignmentStatus;
  canonicalKeys: string[];
  assignments: MaterialConceptAssignment[];
  unmatched: MaterialConceptUnmatchedEvidence[];
  summary: {
    familyAssignmentCount: number;
    formAssignmentCount: number;
    unmatchedEvidenceCount: number;
  };
};

type ConceptIndex = Map<string, MaterialConceptAssignmentRegistryConcept[]>;

type EvidenceMatch = {
  concept: MaterialConceptAssignmentRegistryConcept;
  source: Exclude<MaterialConceptAssignmentSource, 'CATEGORY_OWNERSHIP'>;
  normalizedValue: string;
};

type EvidenceResolution =
  | { status: 'MATCHED'; match: EvidenceMatch }
  | {
      status: 'UNMATCHED';
      reason: MaterialConceptUnmatchedReason;
      normalizedValue: string;
      candidateCanonicalKeys: string[];
    };

type CandidateResolution =
  | { status: 'NO_MATCH' }
  | { status: 'MATCHED'; concept: MaterialConceptAssignmentRegistryConcept }
  | {
      status: 'UNMATCHED';
      reason:
        | 'AMBIGUOUS_MAPPING'
        | 'INACTIVE_TARGET'
        | 'WRONG_CONCEPT_TYPE'
        | 'INVALID_CANONICAL_TARGET'
        | 'REGISTRY_CONFLICT';
      candidateCanonicalKeys: string[];
    };

const asciiCompare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const sortedCanonicalKeys = (
  candidates: readonly { canonicalKey: string }[],
): string[] => [
  ...new Set(candidates.map(({ canonicalKey }) => canonicalKey)),
].sort(asciiCompare);

const appendCandidate = (
  index: ConceptIndex,
  key: string,
  concept: MaterialConceptAssignmentRegistryConcept,
) => {
  const existing = index.get(key) ?? [];
  existing.push(concept);
  index.set(key, existing);
};

const isExactRepeatedDefinition = (
  left: MaterialConceptAssignmentRegistryConcept,
  right: MaterialConceptAssignmentRegistryConcept,
): boolean =>
  left.canonicalKey === right.canonicalKey
  && left.id === right.id
  && left.conceptType === right.conceptType
  && left.status === right.status;

const collectConflictedCanonicalKeys = (
  concepts: readonly MaterialConceptAssignmentRegistryConcept[],
): ReadonlySet<string> => {
  const byKey = new Map<string, MaterialConceptAssignmentRegistryConcept[]>();
  for (const concept of concepts) {
    appendCandidate(byKey, concept.canonicalKey, concept);
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

const dedupeExactConcepts = (
  candidates: readonly MaterialConceptAssignmentRegistryConcept[],
): MaterialConceptAssignmentRegistryConcept[] => {
  const unique: MaterialConceptAssignmentRegistryConcept[] = [];
  for (const candidate of candidates) {
    if (!unique.some((item) => isExactRepeatedDefinition(item, candidate))) {
      unique.push(candidate);
    }
  }
  return unique
    .slice()
    .sort((left, right) => asciiCompare(left.canonicalKey, right.canonicalKey));
};

const hasValidMaterialFormCanonicalIdentity = (
  concept: MaterialConceptAssignmentRegistryConcept,
): boolean =>
  isValidTaxonomyCanonicalKey(concept.canonicalKey)
  && concept.canonicalKey.startsWith('material-form:');

const resolveCandidates = (
  candidates: readonly MaterialConceptAssignmentRegistryConcept[],
  conflictedCanonicalKeys: ReadonlySet<string>,
): CandidateResolution => {
  const unique = dedupeExactConcepts(candidates);
  if (unique.length === 0) {
    return { status: 'NO_MATCH' };
  }

  const conflicted = [...new Set(
    unique
      .map(({ canonicalKey }) => canonicalKey)
      .filter((canonicalKey) => conflictedCanonicalKeys.has(canonicalKey)),
  )].sort(asciiCompare);
  if (conflicted.length > 0) {
    return {
      status: 'UNMATCHED',
      reason: 'REGISTRY_CONFLICT',
      candidateCanonicalKeys: conflicted,
    };
  }

  const forms = unique.filter(({ conceptType }) => conceptType === 'MATERIAL_FORM');
  if (forms.length > 1) {
    return {
      status: 'UNMATCHED',
      reason: 'AMBIGUOUS_MAPPING',
      candidateCanonicalKeys: sortedCanonicalKeys(forms),
    };
  }
  if (forms.length === 1) {
    const form = forms[0]!;
    if (!hasValidMaterialFormCanonicalIdentity(form)) {
      return {
        status: 'UNMATCHED',
        reason: 'INVALID_CANONICAL_TARGET',
        candidateCanonicalKeys: [form.canonicalKey],
      };
    }
    return form.status === 'ACTIVE'
      ? { status: 'MATCHED', concept: form }
      : {
          status: 'UNMATCHED',
          reason: 'INACTIVE_TARGET',
          candidateCanonicalKeys: [form.canonicalKey],
        };
  }

  return {
    status: 'UNMATCHED',
    reason: 'WRONG_CONCEPT_TYPE',
    candidateCanonicalKeys: sortedCanonicalKeys(unique),
  };
};

const buildIndexes = (registry: MaterialConceptAssignmentRegistry) => {
  const canonical = new Map<string, MaterialConceptAssignmentRegistryConcept[]>();
  const explicitAliases = new Map<string, MaterialConceptAssignmentRegistryConcept[]>();
  const labelAliases = new Map<string, MaterialConceptAssignmentRegistryConcept[]>();
  const mappings = new Map<
    string,
    MaterialConceptAssignmentRegistry['materialTypeMappings'][number][]
  >();
  const conflictedCanonicalKeys = collectConflictedCanonicalKeys(registry.concepts);

  for (const concept of registry.concepts) {
    appendCandidate(canonical, concept.canonicalKey, concept);
    for (const alias of concept.aliases) {
      if (!alias.isActive || alias.normalizedAlias.length === 0) {
        continue;
      }
      if (alias.source === TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT) {
        appendCandidate(explicitAliases, alias.normalizedAlias, concept);
      } else if (
        alias.source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN
        || alias.source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR
      ) {
        appendCandidate(labelAliases, alias.normalizedAlias, concept);
      }
    }
  }

  for (const mapping of registry.materialTypeMappings) {
    const normalizedValue = normalizeTaxonomyAlias(mapping.value);
    if (normalizedValue.length === 0 || mapping.provenance !== 'REVIEWED') {
      continue;
    }
    const existing = mappings.get(normalizedValue) ?? [];
    existing.push(mapping);
    mappings.set(normalizedValue, existing);
  }

  return {
    canonical,
    explicitAliases,
    labelAliases,
    mappings,
    conflictedCanonicalKeys,
  };
};

type AssignmentIndexes = ReturnType<typeof buildIndexes>;

const unmatchedResolution = (
  normalizedValue: string,
  reason: MaterialConceptUnmatchedReason,
  candidateCanonicalKeys: readonly string[] = [],
): EvidenceResolution => ({
  status: 'UNMATCHED',
  reason,
  normalizedValue,
  candidateCanonicalKeys: [...new Set(candidateCanonicalKeys)].sort(asciiCompare),
});

const fromCandidateResolution = (
  resolution: CandidateResolution,
  source: EvidenceMatch['source'],
  normalizedValue: string,
): EvidenceResolution | null => {
  if (resolution.status === 'NO_MATCH') {
    return null;
  }
  if (resolution.status === 'UNMATCHED') {
    return unmatchedResolution(
      normalizedValue,
      resolution.reason,
      resolution.candidateCanonicalKeys,
    );
  }
  return {
    status: 'MATCHED',
    match: { concept: resolution.concept, source, normalizedValue },
  };
};

const resolveReviewedMapping = (
  normalizedValue: string,
  indexes: AssignmentIndexes,
): EvidenceResolution | null => {
  const rules = indexes.mappings.get(normalizedValue) ?? [];
  if (rules.length === 0) {
    return null;
  }

  const canonicalKeys = [...new Set(rules.map(({ canonicalKey }) => canonicalKey))]
    .sort(asciiCompare);
  if (canonicalKeys.length > 1) {
    return unmatchedResolution(
      normalizedValue,
      'AMBIGUOUS_MAPPING',
      canonicalKeys,
    );
  }

  const canonicalKey = canonicalKeys[0]!;
  const targets = indexes.canonical.get(canonicalKey) ?? [];
  if (targets.length === 0) {
    return unmatchedResolution(
      normalizedValue,
      'MAPPING_TARGET_MISSING',
      [canonicalKey],
    );
  }

  return fromCandidateResolution(
    resolveCandidates(targets, indexes.conflictedCanonicalKeys),
    'REVIEWED_MATERIAL_TYPE_RULE',
    normalizedValue,
  );
};

const invalidTextResolution = (rawValue: unknown): EvidenceResolution | null => {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return unmatchedResolution('', 'INVALID_INPUT');
  }
  return null;
};

const resolveMaterialTypeEvidence = (
  rawValue: string,
  indexes: AssignmentIndexes,
): EvidenceResolution => {
  const invalid = invalidTextResolution(rawValue);
  if (invalid) {
    return invalid;
  }

  const trimmed = rawValue.trim();
  const normalizedValue = normalizeTaxonomyAlias(trimmed);
  if (normalizedValue.length === 0) {
    return unmatchedResolution('', 'INVALID_INPUT');
  }

  const canonical = fromCandidateResolution(
    resolveCandidates(
      indexes.canonical.get(trimmed) ?? [],
      indexes.conflictedCanonicalKeys,
    ),
    'CANONICAL_KEY',
    trimmed,
  );
  if (canonical) {
    return canonical;
  }

  const mapping = resolveReviewedMapping(normalizedValue, indexes);
  if (mapping) {
    return mapping;
  }

  const explicitAlias = fromCandidateResolution(
    resolveCandidates(
      indexes.explicitAliases.get(normalizedValue) ?? [],
      indexes.conflictedCanonicalKeys,
    ),
    'REVIEWED_ALIAS',
    normalizedValue,
  );
  if (explicitAlias) {
    return explicitAlias;
  }

  const labelAlias = fromCandidateResolution(
    resolveCandidates(
      indexes.labelAliases.get(normalizedValue) ?? [],
      indexes.conflictedCanonicalKeys,
    ),
    'REVIEWED_LABEL',
    normalizedValue,
  );
  return labelAlias ?? unmatchedResolution(normalizedValue, 'UNKNOWN_VALUE');
};

const resolveTitleEvidence = (
  rawValue: string,
  indexes: AssignmentIndexes,
): EvidenceResolution => {
  const invalid = invalidTextResolution(rawValue);
  if (invalid) {
    return invalid;
  }

  const normalizedValue = normalizeTaxonomyAlias(rawValue);
  if (normalizedValue.length === 0) {
    return unmatchedResolution('', 'INVALID_INPUT');
  }

  const explicitAlias = fromCandidateResolution(
    resolveCandidates(
      indexes.explicitAliases.get(normalizedValue) ?? [],
      indexes.conflictedCanonicalKeys,
    ),
    'REVIEWED_ALIAS',
    normalizedValue,
  );
  if (explicitAlias) {
    return explicitAlias;
  }

  const labelAlias = fromCandidateResolution(
    resolveCandidates(
      indexes.labelAliases.get(normalizedValue) ?? [],
      indexes.conflictedCanonicalKeys,
    ),
    'REVIEWED_LABEL',
    normalizedValue,
  );
  return labelAlias ?? unmatchedResolution(normalizedValue, 'UNKNOWN_VALUE');
};

const diagnostic = (
  field: string,
  rawValue: string | null,
  resolution: Extract<EvidenceResolution, { status: 'UNMATCHED' }>,
): MaterialConceptUnmatchedEvidence => ({
  field,
  rawValue,
  normalizedValue: resolution.normalizedValue,
  reason: resolution.reason,
  candidateCanonicalKeys: resolution.candidateCanonicalKeys,
});

const validateCategoryOwnership = (
  category: MaterialConceptAssignmentInput['category'],
): MaterialConceptUnmatchedEvidence[] => {
  const unmatched: MaterialConceptUnmatchedEvidence[] = [];
  const add = (
    field: string,
    rawValue: string | null,
    normalizedValue: string,
    reason: MaterialConceptUnmatchedReason,
    candidateCanonicalKeys: readonly string[] = [],
  ) => unmatched.push({
    field,
    rawValue,
    normalizedValue,
    reason,
    candidateCanonicalKeys: [...new Set(candidateCanonicalKeys)].sort(asciiCompare),
  });

  if (!category.isActive) {
    add('category.isActive', String(category.isActive), 'false', 'CATEGORY_INACTIVE');
  }
  if (category.categoryType === 'PROJECT') {
    add(
      'category.categoryType',
      category.categoryType,
      category.categoryType,
      'CATEGORY_TYPE_MISMATCH',
    );
  }
  if (category.materialFamilyConceptId === null) {
    add(
      'category.materialFamilyConceptId',
      null,
      '',
      'CATEGORY_OWNERSHIP_MISSING',
    );
  }
  if (category.materialFamilyConceptId !== null && category.materialFamilyConcept === null) {
    add(
      'category.materialFamilyConcept',
      null,
      category.materialFamilyConceptId,
      'CATEGORY_OWNERSHIP_INVALID_TARGET',
    );
  }
  if (category.materialFamilyConceptId === null && category.materialFamilyConcept !== null) {
    add(
      'category.materialFamilyConcept',
      category.materialFamilyConcept.id,
      category.materialFamilyConcept.canonicalKey,
      'CATEGORY_OWNERSHIP_CONFLICT',
    );
  }

  const concept = category.materialFamilyConcept;
  if (concept) {
    if (
      category.materialFamilyConceptId !== null
      && concept.id !== category.materialFamilyConceptId
    ) {
      add(
        'category.materialFamilyConceptId',
        category.materialFamilyConceptId,
        concept.id,
        'CATEGORY_OWNERSHIP_CONFLICT',
      );
    }
    if (concept.status !== 'ACTIVE') {
      add(
        'category.materialFamilyConcept.status',
        concept.status,
        concept.status,
        'INACTIVE_TARGET',
        [concept.canonicalKey],
      );
    }
    if (concept.conceptType !== 'MATERIAL_FAMILY') {
      add(
        'category.materialFamilyConcept.conceptType',
        concept.conceptType,
        concept.conceptType,
        'WRONG_CONCEPT_TYPE',
        [concept.canonicalKey],
      );
    }
    if (
      !isValidTaxonomyCanonicalKey(concept.canonicalKey)
      || !concept.canonicalKey.startsWith('material-family:')
    ) {
      add(
        'category.materialFamilyConcept.canonicalKey',
        concept.canonicalKey,
        concept.canonicalKey,
        'CATEGORY_OWNERSHIP_INVALID_TARGET',
      );
    }
  }

  return unmatched;
};

const assignmentEvidence = (
  field: 'material.materialType' | 'material.title',
  rawValue: string,
  match: EvidenceMatch,
): MaterialConceptAssignmentEvidence => ({
  field,
  rawValue,
  normalizedValue: match.normalizedValue,
  source: match.source,
});

const formAssignment = (
  match: EvidenceMatch,
  field: 'material.materialType' | 'material.title',
  rawValue: string,
): MaterialConceptAssignment => ({
  conceptId: match.concept.id,
  canonicalKey: match.concept.canonicalKey,
  conceptType: 'MATERIAL_FORM',
  role: 'MATERIAL_FORM',
  source: match.source,
  evidenceField: field,
  normalizedEvidence: match.normalizedValue,
  evidence: [assignmentEvidence(field, rawValue, match)],
});

const buildResult = (
  status: MaterialConceptAssignmentStatus,
  assignments: MaterialConceptAssignment[],
  unmatched: MaterialConceptUnmatchedEvidence[],
): MaterialConceptAssignmentResult => ({
  status,
  canonicalKeys: assignments.map(({ canonicalKey }) => canonicalKey),
  assignments,
  unmatched,
  summary: {
    familyAssignmentCount: assignments.filter(({ role }) => role === 'MATERIAL_FAMILY').length,
    formAssignmentCount: assignments.filter(({ role }) => role === 'MATERIAL_FORM').length,
    unmatchedEvidenceCount: unmatched.length,
  },
});

export const resolveMaterialConceptAssignments = (
  input: MaterialConceptAssignmentInput,
  registry: MaterialConceptAssignmentRegistry,
): MaterialConceptAssignmentResult => {
  const categoryDiagnostics = validateCategoryOwnership(input.category);
  if (categoryDiagnostics.length > 0) {
    return buildResult(
      'BLOCKED_INVALID_CATEGORY_OWNERSHIP',
      [],
      categoryDiagnostics,
    );
  }

  const family = input.category.materialFamilyConcept!;
  const familyAssignment: MaterialConceptAssignment = {
    conceptId: family.id,
    canonicalKey: family.canonicalKey,
    conceptType: 'MATERIAL_FAMILY',
    role: 'MATERIAL_FAMILY',
    source: 'CATEGORY_OWNERSHIP',
    evidenceField: 'category.materialFamilyConceptId',
    normalizedEvidence: family.canonicalKey,
    evidence: [{
      field: 'category.materialFamilyConceptId',
      rawValue: input.category.materialFamilyConceptId!,
      normalizedValue: family.canonicalKey,
      source: 'CATEGORY_OWNERSHIP',
    }],
  };

  const indexes = buildIndexes(registry);
  const unmatched: MaterialConceptUnmatchedEvidence[] = [];
  const primary = resolveMaterialTypeEvidence(input.material.materialType, indexes);
  let form: MaterialConceptAssignment | null = null;

  if (primary.status === 'MATCHED') {
    form = formAssignment(
      primary.match,
      'material.materialType',
      input.material.materialType,
    );

    const title = resolveTitleEvidence(input.material.title, indexes);
    if (title.status === 'MATCHED') {
      if (title.match.concept.canonicalKey === primary.match.concept.canonicalKey) {
        form.evidence.push(
          assignmentEvidence('material.title', input.material.title, title.match),
        );
      } else {
        unmatched.push({
          field: 'material.title',
          rawValue: input.material.title,
          normalizedValue: title.match.normalizedValue,
          reason: 'CONFLICTING_EVIDENCE',
          candidateCanonicalKeys: [
            primary.match.concept.canonicalKey,
            title.match.concept.canonicalKey,
          ].sort(asciiCompare),
        });
      }
    } else {
      unmatched.push(diagnostic('material.title', input.material.title, title));
    }
  } else {
    unmatched.push(diagnostic('material.materialType', input.material.materialType, primary));
    if (primary.reason === 'UNKNOWN_VALUE') {
      const title = resolveTitleEvidence(input.material.title, indexes);
      if (title.status === 'MATCHED') {
        form = formAssignment(title.match, 'material.title', input.material.title);
      } else {
        unmatched.push(diagnostic('material.title', input.material.title, title));
      }
    }
  }

  const assignments = form
    ? [familyAssignment, form]
    : [familyAssignment];
  return buildResult(
    form ? 'READY_WITH_FORMS' : 'READY_FAMILY_ONLY',
    assignments,
    unmatched,
  );
};
