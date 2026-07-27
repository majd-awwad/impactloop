import {
  TAXONOMY_CONCEPT_SEEDS,
  type TaxonomyConceptSeed,
} from './taxonomy-foundation.data.js';

export type CategoryOwnershipRole = 'materialFamily' | 'projectTopic';
export type CategoryOwnershipCategoryType = 'MATERIAL' | 'PROJECT' | 'BOTH';
export type CategoryOwnershipConceptType =
  | 'INTEREST'
  | 'MATERIAL_FAMILY'
  | 'MATERIAL_FORM'
  | 'PROJECT_TOPIC'
  | 'COMPONENT';
export type CategoryOwnershipConceptStatus = 'ACTIVE' | 'INACTIVE';

export type CategoryOwnershipConcept = {
  id: string;
  canonicalKey: string;
  conceptType: CategoryOwnershipConceptType;
  status: CategoryOwnershipConceptStatus;
};

export type CategoryOwnershipAuditInput = {
  id: string;
  nameEn: string;
  nameAr: string;
  categoryType: CategoryOwnershipCategoryType;
  isActive: boolean;
  parentId: string | null;
  materialFamilyConceptId: string | null;
  projectTopicConceptId: string | null;
  materialFamilyConcept: CategoryOwnershipConcept | null;
  projectTopicConcept: CategoryOwnershipConcept | null;
  _count: {
    materials: number;
    learningProjects: number;
    projectRequiredComponents: number;
  };
};

export type LegacyBackfillEvidence = {
  canonicalKey: string;
  conceptType: 'MATERIAL_FAMILY' | 'PROJECT_TOPIC';
  provenance: 'AUTHORITATIVE';
  source: string;
  matchedCategoryNameEn: string;
};

export type LegacyBackfillExpectation = {
  resolution: 'UNIQUE' | 'AMBIGUOUS';
  matches: LegacyBackfillEvidence[];
};

export type LegacyBackfillIndex = Record<
  CategoryOwnershipRole,
  ReadonlyMap<string, readonly LegacyBackfillEvidence[]>
>;

export type PersistedCategoryOwnership = {
  conceptId: string | null;
  concept: CategoryOwnershipConcept | null;
} | null;

export type CategoryOwnershipBlockingStatus =
  | 'ACTIVE_UNMAPPED'
  | 'AMBIGUOUS_REVIEWED_MAPPING'
  | 'OWNERSHIP_CONFLICT'
  | 'MISSING_TARGET_CONCEPT'
  | 'INACTIVE_TARGET_CONCEPT'
  | 'WRONG_TARGET_CONCEPT_TYPE'
  | 'CATEGORY_TYPE_SLOT_VIOLATION';

export type CategoryOwnershipReadinessStatus =
  | 'READY_SINGLE'
  | 'READY_DUAL'
  | 'ASSIGNABLE_SINGLE'
  | 'ASSIGNABLE_DUAL'
  | 'PARTIALLY_MAPPED'
  | 'INACTIVE_CATEGORY'
  | CategoryOwnershipBlockingStatus;

export type CategoryOwnershipIssue = {
  code: CategoryOwnershipBlockingStatus | 'INACTIVE_CATEGORY';
  role: CategoryOwnershipRole | null;
  detail: string;
};

export type CategoryOwnershipAuditRow = {
  category: {
    id: string;
    nameEn: string;
    nameAr: string;
    categoryType: CategoryOwnershipCategoryType;
    isActive: boolean;
    parentId: string | null;
    materialCount: number;
    learningProjectCount: number;
    requiredComponentCount: number;
  };
  requiredRoles: CategoryOwnershipRole[];
  legacyBackfillExpectation: Record<
    CategoryOwnershipRole,
    LegacyBackfillExpectation | null
  >;
  persistedOwnership: Record<CategoryOwnershipRole, PersistedCategoryOwnership>;
  readinessStatus: CategoryOwnershipReadinessStatus;
  ready: boolean;
  issues: CategoryOwnershipIssue[];
};

export const CATEGORY_OWNERSHIP_READINESS_STATUSES = [
  'READY_SINGLE',
  'READY_DUAL',
  'ASSIGNABLE_SINGLE',
  'ASSIGNABLE_DUAL',
  'ACTIVE_UNMAPPED',
  'PARTIALLY_MAPPED',
  'AMBIGUOUS_REVIEWED_MAPPING',
  'OWNERSHIP_CONFLICT',
  'MISSING_TARGET_CONCEPT',
  'INACTIVE_TARGET_CONCEPT',
  'WRONG_TARGET_CONCEPT_TYPE',
  'CATEGORY_TYPE_SLOT_VIOLATION',
  'INACTIVE_CATEGORY',
] as const satisfies readonly CategoryOwnershipReadinessStatus[];

export type CategoryOwnershipReport = {
  generatedAt: string;
  categories: CategoryOwnershipAuditRow[];
  summary: {
    totalCategories: number;
    activeCategories: number;
    readyActiveCategories: number;
    notReadyActiveCategories: number;
    inactiveCategories: number;
    statusCounts: Record<CategoryOwnershipReadinessStatus, number>;
    allActiveReady: boolean;
  };
  resultCode:
    | 'CATEGORY_TAXONOMY_OWNERSHIP_READY'
    | 'CATEGORY_TAXONOMY_OWNERSHIP_NOT_READY';
};

const requiredConceptType: Record<
  CategoryOwnershipRole,
  'MATERIAL_FAMILY' | 'PROJECT_TOPIC'
> = {
  materialFamily: 'MATERIAL_FAMILY',
  projectTopic: 'PROJECT_TOPIC',
};

const appendEvidence = (
  index: Map<string, LegacyBackfillEvidence[]>,
  categoryNameEn: string,
  evidence: Omit<LegacyBackfillEvidence, 'matchedCategoryNameEn'>,
) => {
  const existing = index.get(categoryNameEn) ?? [];
  existing.push({ ...evidence, matchedCategoryNameEn: categoryNameEn });
  index.set(categoryNameEn, existing);
};

export const buildAuthoritativeLegacyCategoryIndex = (
  seeds: readonly TaxonomyConceptSeed[] = TAXONOMY_CONCEPT_SEEDS,
): LegacyBackfillIndex => {
  const materialFamily = new Map<string, LegacyBackfillEvidence[]>();
  const projectTopic = new Map<string, LegacyBackfillEvidence[]>();

  for (const seed of seeds) {
    for (const rule of seed.mappingRules) {
      if (rule.provenance !== 'AUTHORITATIVE') {
        continue;
      }

      if (seed.conceptType === 'MATERIAL_FAMILY') {
        for (const categoryNameEn of rule.materialCategoryNames ?? []) {
          appendEvidence(materialFamily, categoryNameEn, {
            canonicalKey: seed.canonicalKey,
            conceptType: 'MATERIAL_FAMILY',
            provenance: 'AUTHORITATIVE',
            source: rule.source,
          });
        }
      }

      if (seed.conceptType === 'PROJECT_TOPIC') {
        for (const categoryNameEn of rule.projectCategoryNames ?? []) {
          appendEvidence(projectTopic, categoryNameEn, {
            canonicalKey: seed.canonicalKey,
            conceptType: 'PROJECT_TOPIC',
            provenance: 'AUTHORITATIVE',
            source: rule.source,
          });
        }
      }
    }
  }

  return { materialFamily, projectTopic };
};

export const deriveRequiredOwnershipRoles = (
  categoryType: CategoryOwnershipCategoryType,
): CategoryOwnershipRole[] => {
  if (categoryType === 'MATERIAL') {
    return ['materialFamily'];
  }
  if (categoryType === 'PROJECT') {
    return ['projectTopic'];
  }
  return ['materialFamily', 'projectTopic'];
};

export const resolveLegacyBackfillExpectation = (
  index: LegacyBackfillIndex,
  role: CategoryOwnershipRole,
  categoryNameEn: string,
): LegacyBackfillExpectation | null => {
  const matches = [...(index[role].get(categoryNameEn) ?? [])];
  if (matches.length === 0) {
    return null;
  }
  return {
    resolution: matches.length === 1 ? 'UNIQUE' : 'AMBIGUOUS',
    matches,
  };
};

type RoleValidation = {
  persistedValid: boolean;
  assignable: boolean;
};

const persistedOwnershipFor = (
  category: CategoryOwnershipAuditInput,
  role: CategoryOwnershipRole,
): PersistedCategoryOwnership => {
  const conceptId = role === 'materialFamily'
    ? category.materialFamilyConceptId
    : category.projectTopicConceptId;
  const concept = role === 'materialFamily'
    ? category.materialFamilyConcept
    : category.projectTopicConcept;

  if (conceptId === null && concept === null) {
    return null;
  }
  return { conceptId, concept };
};

const validateRequiredRole = (input: {
  role: CategoryOwnershipRole;
  persisted: PersistedCategoryOwnership;
  legacy: LegacyBackfillExpectation | null;
  conceptsByCanonicalKey: ReadonlyMap<string, CategoryOwnershipConcept>;
  issues: CategoryOwnershipIssue[];
}): RoleValidation => {
  const { role, persisted, legacy, conceptsByCanonicalKey, issues } = input;
  const expectedType = requiredConceptType[role];

  if (persisted?.conceptId !== null && persisted?.conceptId !== undefined) {
    const concept = persisted.concept;
    let valid = true;

    if (!concept || concept.id !== persisted.conceptId) {
      issues.push({
        code: 'MISSING_TARGET_CONCEPT',
        role,
        detail: `Persisted ${role} concept ${persisted.conceptId} could not be resolved.`,
      });
      valid = false;
    } else {
      if (concept.conceptType !== expectedType) {
        issues.push({
          code: 'WRONG_TARGET_CONCEPT_TYPE',
          role,
          detail: `Persisted ${role} concept ${concept.canonicalKey} has type ${concept.conceptType}; expected ${expectedType}.`,
        });
        valid = false;
      }
      if (concept.status !== 'ACTIVE') {
        issues.push({
          code: 'INACTIVE_TARGET_CONCEPT',
          role,
          detail: `Persisted ${role} concept ${concept.canonicalKey} is ${concept.status}.`,
        });
        valid = false;
      }

      const conflictingLegacyTargets = legacy?.matches.filter(
        ({ canonicalKey }) => canonicalKey !== concept.canonicalKey,
      ) ?? [];
      if (conflictingLegacyTargets.length > 0) {
        issues.push({
          code: 'OWNERSHIP_CONFLICT',
          role,
          detail: `Persisted ${role} concept ${concept.canonicalKey} conflicts with matching legacy target(s): ${conflictingLegacyTargets.map(({ canonicalKey }) => canonicalKey).join(', ')}.`,
        });
        valid = false;
      }
    }

    return { persistedValid: valid, assignable: false };
  }

  if (persisted?.concept !== null && persisted?.concept !== undefined) {
    issues.push({
      code: 'MISSING_TARGET_CONCEPT',
      role,
      detail: `The ${role} relation is populated without its foreign-key value.`,
    });
    return { persistedValid: false, assignable: false };
  }

  if (!legacy) {
    issues.push({
      code: 'ACTIVE_UNMAPPED',
      role,
      detail: `No authoritative legacy backfill mapping exists for ${role}.`,
    });
    return { persistedValid: false, assignable: false };
  }

  if (legacy.resolution === 'AMBIGUOUS') {
    issues.push({
      code: 'AMBIGUOUS_REVIEWED_MAPPING',
      role,
      detail: `Multiple authoritative legacy mappings exist for ${role}: ${legacy.matches.map(({ canonicalKey }) => canonicalKey).join(', ')}.`,
    });
    return { persistedValid: false, assignable: false };
  }

  const expectedCanonicalKey = legacy.matches[0]!.canonicalKey;
  const target = conceptsByCanonicalKey.get(expectedCanonicalKey);
  if (!target) {
    issues.push({
      code: 'MISSING_TARGET_CONCEPT',
      role,
      detail: `Legacy ${role} target ${expectedCanonicalKey} does not exist.`,
    });
    return { persistedValid: false, assignable: false };
  }

  let assignable = true;
  if (target.conceptType !== expectedType) {
    issues.push({
      code: 'WRONG_TARGET_CONCEPT_TYPE',
      role,
      detail: `Legacy ${role} target ${expectedCanonicalKey} has type ${target.conceptType}; expected ${expectedType}.`,
    });
    assignable = false;
  }
  if (target.status !== 'ACTIVE') {
    issues.push({
      code: 'INACTIVE_TARGET_CONCEPT',
      role,
      detail: `Legacy ${role} target ${expectedCanonicalKey} is ${target.status}.`,
    });
    assignable = false;
  }

  return { persistedValid: false, assignable };
};

const failurePrecedence: readonly CategoryOwnershipBlockingStatus[] = [
  'CATEGORY_TYPE_SLOT_VIOLATION',
  'MISSING_TARGET_CONCEPT',
  'INACTIVE_TARGET_CONCEPT',
  'WRONG_TARGET_CONCEPT_TYPE',
  'OWNERSHIP_CONFLICT',
  'AMBIGUOUS_REVIEWED_MAPPING',
  'ACTIVE_UNMAPPED',
];

export const auditCategoryTaxonomyOwnership = (input: {
  category: CategoryOwnershipAuditInput;
  conceptsByCanonicalKey: ReadonlyMap<string, CategoryOwnershipConcept>;
  legacyIndex?: LegacyBackfillIndex;
}): CategoryOwnershipAuditRow => {
  const { category, conceptsByCanonicalKey } = input;
  const legacyIndex = input.legacyIndex ?? buildAuthoritativeLegacyCategoryIndex();
  const requiredRoles = deriveRequiredOwnershipRoles(category.categoryType);
  const legacyBackfillExpectation = {
    materialFamily: resolveLegacyBackfillExpectation(legacyIndex, 'materialFamily', category.nameEn),
    projectTopic: resolveLegacyBackfillExpectation(legacyIndex, 'projectTopic', category.nameEn),
  };
  const persistedOwnership = {
    materialFamily: persistedOwnershipFor(category, 'materialFamily'),
    projectTopic: persistedOwnershipFor(category, 'projectTopic'),
  };
  const issues: CategoryOwnershipIssue[] = [];

  if (
    category.categoryType === 'MATERIAL'
    && persistedOwnership.projectTopic !== null
  ) {
    issues.push({
      code: 'CATEGORY_TYPE_SLOT_VIOLATION',
      role: 'projectTopic',
      detail: 'A MATERIAL category must not populate projectTopic ownership.',
    });
  }
  if (
    category.categoryType === 'PROJECT'
    && persistedOwnership.materialFamily !== null
  ) {
    issues.push({
      code: 'CATEGORY_TYPE_SLOT_VIOLATION',
      role: 'materialFamily',
      detail: 'A PROJECT category must not populate materialFamily ownership.',
    });
  }

  const roleValidation = new Map<CategoryOwnershipRole, RoleValidation>();
  for (const role of requiredRoles) {
    roleValidation.set(role, validateRequiredRole({
      role,
      persisted: persistedOwnership[role],
      legacy: legacyBackfillExpectation[role],
      conceptsByCanonicalKey,
      issues,
    }));
  }

  let readinessStatus: CategoryOwnershipReadinessStatus;
  if (!category.isActive) {
    issues.unshift({
      code: 'INACTIVE_CATEGORY',
      role: null,
      detail: 'The category is inactive and does not block active-category readiness.',
    });
    readinessStatus = 'INACTIVE_CATEGORY';
  } else {
    const primaryFailure = failurePrecedence.find((code) =>
      issues.some((issue) => issue.code === code));
    if (primaryFailure) {
      readinessStatus = primaryFailure;
    } else if (category.categoryType === 'BOTH') {
      const validations = requiredRoles.map((role) => roleValidation.get(role)!);
      const persistedCount = validations.filter(({ persistedValid }) => persistedValid).length;
      const assignableCount = validations.filter(({ assignable }) => assignable).length;
      if (persistedCount === 2) {
        readinessStatus = 'READY_DUAL';
      } else if (persistedCount === 1 && assignableCount === 1) {
        readinessStatus = 'PARTIALLY_MAPPED';
      } else {
        readinessStatus = 'ASSIGNABLE_DUAL';
      }
    } else {
      const validation = roleValidation.get(requiredRoles[0]!)!;
      readinessStatus = validation.persistedValid ? 'READY_SINGLE' : 'ASSIGNABLE_SINGLE';
    }
  }

  return {
    category: {
      id: category.id,
      nameEn: category.nameEn,
      nameAr: category.nameAr,
      categoryType: category.categoryType,
      isActive: category.isActive,
      parentId: category.parentId,
      materialCount: category._count.materials,
      learningProjectCount: category._count.learningProjects,
      requiredComponentCount: category._count.projectRequiredComponents,
    },
    requiredRoles,
    legacyBackfillExpectation,
    persistedOwnership,
    readinessStatus,
    ready: readinessStatus === 'READY_SINGLE' || readinessStatus === 'READY_DUAL',
    issues,
  };
};

const compareCategories = (
  left: CategoryOwnershipAuditInput,
  right: CategoryOwnershipAuditInput,
) => {
  const typeOrder: Record<CategoryOwnershipCategoryType, number> = {
    MATERIAL: 0,
    PROJECT: 1,
    BOTH: 2,
  };
  return typeOrder[left.categoryType] - typeOrder[right.categoryType]
    || (left.nameEn < right.nameEn ? -1 : left.nameEn > right.nameEn ? 1 : 0)
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
};

export const buildCategoryTaxonomyOwnershipReport = (input: {
  categories: readonly CategoryOwnershipAuditInput[];
  taxonomyConcepts: readonly CategoryOwnershipConcept[];
  seeds?: readonly TaxonomyConceptSeed[];
  generatedAt?: string;
}): CategoryOwnershipReport => {
  const conceptsByCanonicalKey = new Map(
    input.taxonomyConcepts.map((concept) => [concept.canonicalKey, concept]),
  );
  const legacyIndex = buildAuthoritativeLegacyCategoryIndex(input.seeds);
  const categories = [...input.categories]
    .sort(compareCategories)
    .map((category) => auditCategoryTaxonomyOwnership({
      category,
      conceptsByCanonicalKey,
      legacyIndex,
    }));

  const statusCounts = Object.fromEntries(
    CATEGORY_OWNERSHIP_READINESS_STATUSES.map((status) => [status, 0]),
  ) as Record<CategoryOwnershipReadinessStatus, number>;
  for (const category of categories) {
    statusCounts[category.readinessStatus] += 1;
  }

  const active = categories.filter(({ category }) => category.isActive);
  const readyActiveCategories = active.filter(({ ready }) => ready).length;
  const allActiveReady = readyActiveCategories === active.length;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    categories,
    summary: {
      totalCategories: categories.length,
      activeCategories: active.length,
      readyActiveCategories,
      notReadyActiveCategories: active.length - readyActiveCategories,
      inactiveCategories: categories.length - active.length,
      statusCounts,
      allActiveReady,
    },
    resultCode: allActiveReady
      ? 'CATEGORY_TAXONOMY_OWNERSHIP_READY'
      : 'CATEGORY_TAXONOMY_OWNERSHIP_NOT_READY',
  };
};
