import { TAXONOMY_ALIAS_SOURCE } from './learner-interest-resolver.js';
import {
  isValidTaxonomyCanonicalKey,
  normalizeTaxonomyAlias,
} from './taxonomy-normalization.js';

export type ComponentConceptAssignmentConceptType =
  | 'INTEREST'
  | 'MATERIAL_FAMILY'
  | 'MATERIAL_FORM'
  | 'PROJECT_TOPIC'
  | 'COMPONENT';

export type ComponentConceptAssignmentConceptStatus = 'ACTIVE' | 'INACTIVE';

export type ComponentConceptAssignmentInput = {
  componentName: string;
  materialType: string;
};

export type ComponentConceptAssignmentRegistryConcept = {
  id: string;
  canonicalKey: string;
  conceptType: ComponentConceptAssignmentConceptType;
  status: ComponentConceptAssignmentConceptStatus;
  aliases: readonly {
    normalizedAlias: string;
    source: string;
    isActive: boolean;
  }[];
};

export type ComponentConceptReviewedMapping = {
  value: string;
  canonicalKey: string;
  provenance: 'REVIEWED';
  source: string;
};

export type ComponentConceptAssignmentRegistry = {
  concepts: readonly ComponentConceptAssignmentRegistryConcept[];
  componentNameMappings: readonly ComponentConceptReviewedMapping[];
  componentTypeMappings: readonly ComponentConceptReviewedMapping[];
};

export type ComponentConceptAssignmentStatus =
  | 'READY'
  | 'UNMAPPED'
  | 'AMBIGUOUS';

export type ComponentConceptAssignmentSource =
  | 'CANONICAL_KEY'
  | 'REVIEWED_COMPONENT_NAME_RULE'
  | 'REVIEWED_COMPONENT_TYPE_RULE'
  | 'REVIEWED_ALIAS'
  | 'REVIEWED_LABEL';

export type ComponentConceptUnmatchedReason =
  | 'INVALID_INPUT'
  | 'UNKNOWN_VALUE'
  | 'AMBIGUOUS_MAPPING'
  | 'INACTIVE_TARGET'
  | 'WRONG_CONCEPT_TYPE'
  | 'INVALID_CANONICAL_TARGET'
  | 'MAPPING_TARGET_MISSING'
  | 'REGISTRY_CONFLICT'
  | 'CONFLICTING_EVIDENCE';

export type ComponentConceptAssignmentEvidence = {
  field: 'component.componentName' | 'component.materialType';
  rawValue: string;
  normalizedValue: string;
  source: ComponentConceptAssignmentSource;
};

export type ComponentConceptAssignment = {
  conceptId: string;
  canonicalKey: string;
  conceptType: 'COMPONENT';
  source: ComponentConceptAssignmentSource;
  evidenceField: 'component.componentName' | 'component.materialType';
  normalizedEvidence: string;
  evidence: ComponentConceptAssignmentEvidence[];
};

export type ComponentConceptUnmatchedEvidence = {
  field: 'component.componentName' | 'component.materialType';
  rawValue: string | null;
  normalizedValue: string;
  reason: ComponentConceptUnmatchedReason;
  candidateCanonicalKeys: string[];
};

export type ComponentConceptAssignmentResult = {
  status: ComponentConceptAssignmentStatus;
  canonicalKeys: string[];
  assignments: ComponentConceptAssignment[];
  unmatched: ComponentConceptUnmatchedEvidence[];
  summary: {
    assignmentCount: number;
    unmatchedEvidenceCount: number;
  };
};

export type ComponentConceptAssignmentDiff = {
  identical: boolean;
  toCreate: string[];
  toDelete: string[];
};

export const COMPONENT_CONCEPT_DIAGNOSTIC_SAMPLE_LIMIT = 20;

export type ComponentConceptDiagnosticReason =
  | ComponentConceptUnmatchedReason
  | 'MISSING_REPAIRED'
  | 'STALE_REPAIRED';

export type ComponentConceptDiagnosticSample = {
  componentId: string;
  evidenceField:
    | 'component.componentName'
    | 'component.materialType'
    | 'assignment.conceptId';
  normalizedValue: string;
  candidateCanonicalKeys: string[];
};

export type ComponentConceptLifecycleDiagnostics = {
  sampleLimit: typeof COMPONENT_CONCEPT_DIAGNOSTIC_SAMPLE_LIMIT;
  summary: {
    componentCount: number;
    assignedCount: number;
    unmappedCount: number;
    missingRepairedCount: number;
    staleRepairedCount: number;
    countsByReason: Partial<Record<ComponentConceptDiagnosticReason, number>>;
  };
  samplesByReason: Partial<
    Record<ComponentConceptDiagnosticReason, ComponentConceptDiagnosticSample[]>
  >;
};

type ConceptIndex = Map<string, ComponentConceptAssignmentRegistryConcept[]>;

type EvidenceMatch = {
  concept: ComponentConceptAssignmentRegistryConcept;
  source: ComponentConceptAssignmentSource;
  normalizedValue: string;
};

type EvidenceResolution =
  | { status: 'MATCHED'; match: EvidenceMatch }
  | {
      status: 'UNMATCHED';
      reason: ComponentConceptUnmatchedReason;
      normalizedValue: string;
      candidateCanonicalKeys: string[];
    };

type CandidateResolution =
  | { status: 'NO_MATCH' }
  | { status: 'MATCHED'; concept: ComponentConceptAssignmentRegistryConcept }
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
): string[] =>
  [...new Set(candidates.map(({ canonicalKey }) => canonicalKey))].sort(
    asciiCompare,
  );

const appendCandidate = (
  index: ConceptIndex,
  key: string,
  concept: ComponentConceptAssignmentRegistryConcept,
) => {
  const existing = index.get(key) ?? [];
  existing.push(concept);
  index.set(key, existing);
};

const isExactRepeatedDefinition = (
  left: ComponentConceptAssignmentRegistryConcept,
  right: ComponentConceptAssignmentRegistryConcept,
): boolean =>
  left.canonicalKey === right.canonicalKey
  && left.id === right.id
  && left.conceptType === right.conceptType
  && left.status === right.status;

const collectConflictedCanonicalKeys = (
  concepts: readonly ComponentConceptAssignmentRegistryConcept[],
): ReadonlySet<string> => {
  const byKey = new Map<string, ComponentConceptAssignmentRegistryConcept[]>();
  for (const concept of concepts) {
    appendCandidate(byKey, concept.canonicalKey, concept);
  }

  const conflicted = new Set<string>();
  for (const [canonicalKey, rows] of byKey) {
    const distinct: ComponentConceptAssignmentRegistryConcept[] = [];
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
  candidates: readonly ComponentConceptAssignmentRegistryConcept[],
): ComponentConceptAssignmentRegistryConcept[] => {
  const unique: ComponentConceptAssignmentRegistryConcept[] = [];
  for (const candidate of candidates) {
    if (!unique.some((item) => isExactRepeatedDefinition(item, candidate))) {
      unique.push(candidate);
    }
  }
  return unique
    .slice()
    .sort((left, right) => asciiCompare(left.canonicalKey, right.canonicalKey));
};

const hasValidComponentCanonicalIdentity = (
  concept: ComponentConceptAssignmentRegistryConcept,
): boolean =>
  isValidTaxonomyCanonicalKey(concept.canonicalKey)
  && concept.canonicalKey.startsWith('component:');

const resolveCandidates = (
  candidates: readonly ComponentConceptAssignmentRegistryConcept[],
  conflictedCanonicalKeys: ReadonlySet<string>,
): CandidateResolution => {
  const unique = dedupeExactConcepts(candidates);
  if (unique.length === 0) {
    return { status: 'NO_MATCH' };
  }

  const conflicted = [
    ...new Set(
      unique
        .map(({ canonicalKey }) => canonicalKey)
        .filter((canonicalKey) => conflictedCanonicalKeys.has(canonicalKey)),
    ),
  ].sort(asciiCompare);
  if (conflicted.length > 0) {
    return {
      status: 'UNMATCHED',
      reason: 'REGISTRY_CONFLICT',
      candidateCanonicalKeys: conflicted,
    };
  }

  const components = unique.filter(
    ({ conceptType }) => conceptType === 'COMPONENT',
  );
  if (components.length > 1) {
    return {
      status: 'UNMATCHED',
      reason: 'AMBIGUOUS_MAPPING',
      candidateCanonicalKeys: sortedCanonicalKeys(components),
    };
  }
  if (components.length === 1) {
    const component = components[0]!;
    if (!hasValidComponentCanonicalIdentity(component)) {
      return {
        status: 'UNMATCHED',
        reason: 'INVALID_CANONICAL_TARGET',
        candidateCanonicalKeys: [component.canonicalKey],
      };
    }
    return component.status === 'ACTIVE'
      ? { status: 'MATCHED', concept: component }
      : {
          status: 'UNMATCHED',
          reason: 'INACTIVE_TARGET',
          candidateCanonicalKeys: [component.canonicalKey],
        };
  }

  return {
    status: 'UNMATCHED',
    reason: 'WRONG_CONCEPT_TYPE',
    candidateCanonicalKeys: sortedCanonicalKeys(unique),
  };
};

const buildMappingIndex = (
  mappings: readonly ComponentConceptReviewedMapping[],
) => {
  const index = new Map<string, ComponentConceptReviewedMapping[]>();
  for (const mapping of mappings) {
    const normalizedValue = normalizeTaxonomyAlias(mapping.value);
    if (normalizedValue.length === 0 || mapping.provenance !== 'REVIEWED') {
      continue;
    }
    const existing = index.get(normalizedValue) ?? [];
    existing.push(mapping);
    index.set(normalizedValue, existing);
  }
  return index;
};

const buildIndexes = (registry: ComponentConceptAssignmentRegistry) => {
  const canonical = new Map<string, ComponentConceptAssignmentRegistryConcept[]>();
  const explicitAliases = new Map<
    string,
    ComponentConceptAssignmentRegistryConcept[]
  >();
  const labelAliases = new Map<
    string,
    ComponentConceptAssignmentRegistryConcept[]
  >();
  const conflictedCanonicalKeys = collectConflictedCanonicalKeys(
    registry.concepts,
  );

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

  return {
    canonical,
    explicitAliases,
    labelAliases,
    nameMappings: buildMappingIndex(registry.componentNameMappings),
    typeMappings: buildMappingIndex(registry.componentTypeMappings),
    conflictedCanonicalKeys,
  };
};

type AssignmentIndexes = ReturnType<typeof buildIndexes>;

const unmatchedResolution = (
  normalizedValue: string,
  reason: ComponentConceptUnmatchedReason,
  candidateCanonicalKeys: readonly string[] = [],
): EvidenceResolution => ({
  status: 'UNMATCHED',
  reason,
  normalizedValue,
  candidateCanonicalKeys: [...new Set(candidateCanonicalKeys)].sort(
    asciiCompare,
  ),
});

const fromCandidateResolution = (
  resolution: CandidateResolution,
  source: ComponentConceptAssignmentSource,
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
  mappings: Map<string, ComponentConceptReviewedMapping[]>,
  indexes: AssignmentIndexes,
  source: 'REVIEWED_COMPONENT_NAME_RULE' | 'REVIEWED_COMPONENT_TYPE_RULE',
): EvidenceResolution | null => {
  const rules = mappings.get(normalizedValue) ?? [];
  if (rules.length === 0) {
    return null;
  }

  const canonicalKeys = [
    ...new Set(rules.map(({ canonicalKey }) => canonicalKey)),
  ].sort(asciiCompare);
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
    return unmatchedResolution(normalizedValue, 'MAPPING_TARGET_MISSING', [
      canonicalKey,
    ]);
  }

  return fromCandidateResolution(
    resolveCandidates(targets, indexes.conflictedCanonicalKeys),
    source,
    normalizedValue,
  );
};

const invalidTextResolution = (rawValue: unknown): EvidenceResolution | null => {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return unmatchedResolution('', 'INVALID_INPUT');
  }
  return null;
};

const resolveFieldEvidence = (
  rawValue: string,
  indexes: AssignmentIndexes,
  mappings: Map<string, ComponentConceptReviewedMapping[]>,
  mappingSource:
    | 'REVIEWED_COMPONENT_NAME_RULE'
    | 'REVIEWED_COMPONENT_TYPE_RULE',
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

  if (
    trimmed.includes(':')
    && (
      !isValidTaxonomyCanonicalKey(trimmed)
      || !trimmed.startsWith('component:')
    )
  ) {
    const looksLikeCanonical = /^(interest|material-family|material-form|project-topic|component):/u
      .test(trimmed);
    if (looksLikeCanonical || !isValidTaxonomyCanonicalKey(trimmed)) {
      if (trimmed.startsWith('component:') && !isValidTaxonomyCanonicalKey(trimmed)) {
        return unmatchedResolution(
          trimmed,
          'INVALID_CANONICAL_TARGET',
          [trimmed],
        );
      }
      if (looksLikeCanonical && !trimmed.startsWith('component:')) {
        const wrongTypeTargets = indexes.canonical.get(trimmed) ?? [];
        if (wrongTypeTargets.length > 0) {
          return fromCandidateResolution(
            resolveCandidates(
              wrongTypeTargets,
              indexes.conflictedCanonicalKeys,
            ),
            'CANONICAL_KEY',
            trimmed,
          ) ?? unmatchedResolution(trimmed, 'WRONG_CONCEPT_TYPE', [trimmed]);
        }
        return unmatchedResolution(trimmed, 'WRONG_CONCEPT_TYPE', [trimmed]);
      }
    }
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

  const mapping = resolveReviewedMapping(
    normalizedValue,
    mappings,
    indexes,
    mappingSource,
  );
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

const toUnmatchedEvidence = (
  field: ComponentConceptUnmatchedEvidence['field'],
  rawValue: string | null,
  resolution: Extract<EvidenceResolution, { status: 'UNMATCHED' }>,
): ComponentConceptUnmatchedEvidence => ({
  field,
  rawValue,
  normalizedValue: resolution.normalizedValue,
  reason: resolution.reason,
  candidateCanonicalKeys: resolution.candidateCanonicalKeys,
});

const buildResult = (
  status: ComponentConceptAssignmentStatus,
  assignments: ComponentConceptAssignment[],
  unmatched: ComponentConceptUnmatchedEvidence[],
): ComponentConceptAssignmentResult => ({
  status,
  canonicalKeys: assignments.map(({ canonicalKey }) => canonicalKey),
  assignments,
  unmatched,
  summary: {
    assignmentCount: assignments.length,
    unmatchedEvidenceCount: unmatched.length,
  },
});

/**
 * Pure required-component concept assignment from reviewed foundation evidence.
 * Semantic identity is the resolved COMPONENT canonical key; evidence fields are not identity.
 * Cardinality is exactly 0 or 1 assignment.
 */
export const resolveComponentConceptAssignments = (
  input: ComponentConceptAssignmentInput,
  registry: ComponentConceptAssignmentRegistry,
): ComponentConceptAssignmentResult => {
  const indexes = buildIndexes(registry);
  const unmatched: ComponentConceptUnmatchedEvidence[] = [];

  const nameResolution = resolveFieldEvidence(
    input.componentName,
    indexes,
    indexes.nameMappings,
    'REVIEWED_COMPONENT_NAME_RULE',
  );
  const typeResolution = resolveFieldEvidence(
    input.materialType,
    indexes,
    indexes.typeMappings,
    'REVIEWED_COMPONENT_TYPE_RULE',
  );

  const validMatches: Array<{
    field: ComponentConceptAssignmentEvidence['field'];
    rawValue: string;
    match: EvidenceMatch;
  }> = [];

  if (nameResolution.status === 'MATCHED') {
    validMatches.push({
      field: 'component.componentName',
      rawValue: input.componentName,
      match: nameResolution.match,
    });
  } else {
    unmatched.push(
      toUnmatchedEvidence(
        'component.componentName',
        input.componentName,
        nameResolution,
      ),
    );
  }

  if (typeResolution.status === 'MATCHED') {
    validMatches.push({
      field: 'component.materialType',
      rawValue: input.materialType,
      match: typeResolution.match,
    });
  } else {
    unmatched.push(
      toUnmatchedEvidence(
        'component.materialType',
        input.materialType,
        typeResolution,
      ),
    );
  }

  const distinctIds = [
    ...new Set(validMatches.map(({ match }) => match.concept.id)),
  ].sort(asciiCompare);

  if (distinctIds.length > 1) {
    unmatched.push({
      field: 'component.componentName',
      rawValue: input.componentName,
      normalizedValue: normalizeTaxonomyAlias(input.componentName),
      reason: 'CONFLICTING_EVIDENCE',
      candidateCanonicalKeys: [
        ...new Set(validMatches.map(({ match }) => match.concept.canonicalKey)),
      ].sort(asciiCompare),
    });
    return buildResult('AMBIGUOUS', [], unmatched);
  }

  if (distinctIds.length === 0) {
    const hasAmbiguity = unmatched.some(
      (item) =>
        item.reason === 'AMBIGUOUS_MAPPING'
        || item.reason === 'REGISTRY_CONFLICT'
        || item.reason === 'CONFLICTING_EVIDENCE',
    );
    return buildResult(hasAmbiguity ? 'AMBIGUOUS' : 'UNMAPPED', [], unmatched);
  }

  const chosen = validMatches[0]!;
  const evidence = validMatches.map(({ field, rawValue, match }) => ({
    field,
    rawValue,
    normalizedValue: match.normalizedValue,
    source: match.source,
  }));

  return buildResult(
    'READY',
    [
      {
        conceptId: chosen.match.concept.id,
        canonicalKey: chosen.match.concept.canonicalKey,
        conceptType: 'COMPONENT',
        source: chosen.match.source,
        evidenceField: chosen.field,
        normalizedEvidence: chosen.match.normalizedValue,
        evidence,
      },
    ],
    unmatched,
  );
};

export const toComponentConceptIds = (
  result: ComponentConceptAssignmentResult,
): string[] => {
  if (result.assignments.length > 1) {
    throw new Error('COMPONENT_CARDINALITY');
  }
  if (result.assignments.length === 0) {
    return [];
  }
  const conceptId = result.assignments[0]!.conceptId;
  if (!conceptId || conceptId.trim().length === 0) {
    throw new Error('COMPONENT_CONCEPT_ID_BLANK');
  }
  return [conceptId];
};

/**
 * Deterministic assignment-set diff. Comparison identity is conceptId sets only.
 */
export const diffComponentConceptAssignments = (
  currentConceptIds: readonly string[],
  expectedConceptIds: readonly string[],
): ComponentConceptAssignmentDiff => {
  const currentSet = new Set(
    currentConceptIds.filter((id) => id.trim().length > 0),
  );
  const expectedSet = new Set(
    expectedConceptIds.filter((id) => id.trim().length > 0),
  );

  const toCreate = [...expectedSet]
    .filter((conceptId) => !currentSet.has(conceptId))
    .sort(asciiCompare);
  const toDelete = [...currentSet]
    .filter((conceptId) => !expectedSet.has(conceptId))
    .sort(asciiCompare);

  return {
    identical: toCreate.length === 0 && toDelete.length === 0,
    toCreate,
    toDelete,
  };
};

export const createEmptyComponentConceptLifecycleDiagnostics = ():
  ComponentConceptLifecycleDiagnostics => ({
  sampleLimit: COMPONENT_CONCEPT_DIAGNOSTIC_SAMPLE_LIMIT,
  summary: {
    componentCount: 0,
    assignedCount: 0,
    unmappedCount: 0,
    missingRepairedCount: 0,
    staleRepairedCount: 0,
    countsByReason: {},
  },
  samplesByReason: {},
});

export const recordComponentConceptDiagnosticSample = (
  diagnostics: ComponentConceptLifecycleDiagnostics,
  reason: ComponentConceptDiagnosticReason,
  sample: ComponentConceptDiagnosticSample,
) => {
  diagnostics.summary.countsByReason[reason] =
    (diagnostics.summary.countsByReason[reason] ?? 0) + 1;

  const samples = diagnostics.samplesByReason[reason] ?? [];
  if (samples.length < diagnostics.sampleLimit) {
    samples.push({
      ...sample,
      candidateCanonicalKeys: [...sample.candidateCanonicalKeys]
        .sort(asciiCompare)
        .slice(0, diagnostics.sampleLimit),
    });
    diagnostics.samplesByReason[reason] = samples;
  }
};
