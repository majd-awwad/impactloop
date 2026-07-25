import { isValidTaxonomyCanonicalKey } from './taxonomy-normalization.js';

export type ProjectConceptAssignmentConceptType =
  | 'INTEREST'
  | 'MATERIAL_FAMILY'
  | 'MATERIAL_FORM'
  | 'PROJECT_TOPIC'
  | 'COMPONENT';

export type ProjectConceptAssignmentConceptStatus = 'ACTIVE' | 'INACTIVE';

export type ProjectConceptAssignmentInput = {
  category: {
    id: string;
    categoryType: 'MATERIAL' | 'PROJECT' | 'BOTH';
    isActive: boolean;
    projectTopicConceptId: string | null;
    projectTopicConcept: {
      id: string;
      canonicalKey: string;
      conceptType: ProjectConceptAssignmentConceptType;
      status: ProjectConceptAssignmentConceptStatus;
    } | null;
  };
};

export type ProjectConceptAssignmentStatus =
  | 'READY'
  | 'BLOCKED_INVALID_CATEGORY_OWNERSHIP';

export type ProjectConceptUnmatchedReason =
  | 'INACTIVE_TARGET'
  | 'WRONG_CONCEPT_TYPE'
  | 'CATEGORY_INACTIVE'
  | 'CATEGORY_TYPE_MISMATCH'
  | 'CATEGORY_OWNERSHIP_MISSING'
  | 'CATEGORY_OWNERSHIP_CONFLICT'
  | 'CATEGORY_OWNERSHIP_INVALID_TARGET';

export type ProjectConceptUnmatchedEvidence = {
  field: string;
  rawValue: string | null;
  normalizedValue: string;
  reason: ProjectConceptUnmatchedReason;
  candidateCanonicalKeys: string[];
};

export type ProjectConceptAssignment = {
  conceptId: string;
  canonicalKey: string;
  conceptType: 'PROJECT_TOPIC';
  source: 'CATEGORY_OWNERSHIP';
  evidenceField: 'category.projectTopicConceptId';
  normalizedEvidence: string;
};

export type ProjectConceptAssignmentResult = {
  status: ProjectConceptAssignmentStatus;
  canonicalKeys: string[];
  assignments: ProjectConceptAssignment[];
  unmatched: ProjectConceptUnmatchedEvidence[];
  summary: {
    topicAssignmentCount: number;
    unmatchedEvidenceCount: number;
  };
};

const asciiCompare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const validateCategoryOwnership = (
  category: ProjectConceptAssignmentInput['category'],
): ProjectConceptUnmatchedEvidence[] => {
  const unmatched: ProjectConceptUnmatchedEvidence[] = [];
  const add = (
    field: string,
    rawValue: string | null,
    normalizedValue: string,
    reason: ProjectConceptUnmatchedReason,
    candidateCanonicalKeys: readonly string[] = [],
  ) =>
    unmatched.push({
      field,
      rawValue,
      normalizedValue,
      reason,
      candidateCanonicalKeys: [...new Set(candidateCanonicalKeys)].sort(asciiCompare),
    });

  if (!category.isActive) {
    add('category.isActive', String(category.isActive), 'false', 'CATEGORY_INACTIVE');
  }
  if (category.categoryType === 'MATERIAL') {
    add(
      'category.categoryType',
      category.categoryType,
      category.categoryType,
      'CATEGORY_TYPE_MISMATCH',
    );
  }
  if (category.projectTopicConceptId === null) {
    add(
      'category.projectTopicConceptId',
      null,
      '',
      'CATEGORY_OWNERSHIP_MISSING',
    );
  }
  if (category.projectTopicConceptId !== null && category.projectTopicConcept === null) {
    add(
      'category.projectTopicConcept',
      null,
      category.projectTopicConceptId,
      'CATEGORY_OWNERSHIP_INVALID_TARGET',
    );
  }
  if (category.projectTopicConceptId === null && category.projectTopicConcept !== null) {
    add(
      'category.projectTopicConcept',
      category.projectTopicConcept.id,
      category.projectTopicConcept.canonicalKey,
      'CATEGORY_OWNERSHIP_CONFLICT',
    );
  }

  const concept = category.projectTopicConcept;
  if (concept) {
    if (
      category.projectTopicConceptId !== null
      && concept.id !== category.projectTopicConceptId
    ) {
      add(
        'category.projectTopicConceptId',
        category.projectTopicConceptId,
        concept.id,
        'CATEGORY_OWNERSHIP_CONFLICT',
      );
    }
    if (concept.status !== 'ACTIVE') {
      add(
        'category.projectTopicConcept.status',
        concept.status,
        concept.status,
        'INACTIVE_TARGET',
        [concept.canonicalKey],
      );
    }
    if (concept.conceptType !== 'PROJECT_TOPIC') {
      add(
        'category.projectTopicConcept.conceptType',
        concept.conceptType,
        concept.conceptType,
        'WRONG_CONCEPT_TYPE',
        [concept.canonicalKey],
      );
    }
    if (
      !isValidTaxonomyCanonicalKey(concept.canonicalKey)
      || !concept.canonicalKey.startsWith('project-topic:')
    ) {
      add(
        'category.projectTopicConcept.canonicalKey',
        concept.canonicalKey,
        concept.canonicalKey,
        'CATEGORY_OWNERSHIP_INVALID_TARGET',
      );
    }
  }

  return unmatched;
};

const buildResult = (
  status: ProjectConceptAssignmentStatus,
  assignments: ProjectConceptAssignment[],
  unmatched: ProjectConceptUnmatchedEvidence[],
): ProjectConceptAssignmentResult => ({
  status,
  canonicalKeys: assignments.map(({ canonicalKey }) => canonicalKey),
  assignments,
  unmatched,
  summary: {
    topicAssignmentCount: assignments.length,
    unmatchedEvidenceCount: unmatched.length,
  },
});

/**
 * Pure Project-topic assignment from category ownership.
 * No free-text matching; no label/alias/title/ID-as-input resolution.
 */
export const resolveProjectConceptAssignments = (
  input: ProjectConceptAssignmentInput,
): ProjectConceptAssignmentResult => {
  const categoryDiagnostics = validateCategoryOwnership(input.category);
  if (categoryDiagnostics.length > 0) {
    return buildResult('BLOCKED_INVALID_CATEGORY_OWNERSHIP', [], categoryDiagnostics);
  }

  const topic = input.category.projectTopicConcept!;
  return buildResult(
    'READY',
    [
      {
        conceptId: topic.id,
        canonicalKey: topic.canonicalKey,
        conceptType: 'PROJECT_TOPIC',
        source: 'CATEGORY_OWNERSHIP',
        evidenceField: 'category.projectTopicConceptId',
        normalizedEvidence: topic.canonicalKey,
      },
    ],
    [],
  );
};

/**
 * Converts a READY engine result into exactly one concept ID.
 * Callers that need HTTP errors must map BLOCKED / cardinality failures.
 */
export const toProjectTopicConceptIds = (
  result: ProjectConceptAssignmentResult,
): string[] => {
  if (result.status === 'BLOCKED_INVALID_CATEGORY_OWNERSHIP') {
    throw new Error('BLOCKED_INVALID_CATEGORY_OWNERSHIP');
  }
  if (result.assignments.length !== 1) {
    throw new Error('TOPIC_CARDINALITY');
  }
  const conceptId = result.assignments[0]!.conceptId;
  if (!conceptId || conceptId.trim().length === 0) {
    throw new Error('TOPIC_CONCEPT_ID_BLANK');
  }
  return [conceptId];
};
