import {
  evaluateProjectMaterialTaxonomyEvidence,
  type ProjectMaterialTaxonomyMatchKind,
  type TaxonomyMatchEvidence,
} from './project-material-concept-matching.js';

export type BuildCandidateScoreBreakdown = {
  relevance: number;
  convenience: number;
  cost: number;
  condition: number;
  supplierTrust: number;
  freshnessMs: number;
};

export type BuildCandidateMaterialInput = {
  id: string;
  title: string;
  description: string;
  materialType: string;
  condition: string;
  isFree: boolean;
  price: number | null;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
  createdAt: Date;
  categoryId: string;
  city: string;
  area: string | null;
  tags: string[];
  supplierVerified: boolean;
  ownerCompletedHandovers: number;
  /** Active MaterialConcept canonical keys when available. */
  conceptCanonicalKeys?: string[];
  /** Normalized aliases of the material's MaterialType (optional). */
  materialTypeAliases?: string[];
};

export type BuildCandidateComponentInput = {
  categoryId: string | null;
  componentName: string;
  materialType: string;
  searchKeywords: string[];
  alternativeKeywords: string[];
  searchTerms: string[];
  /** Active ProjectComponentConcept canonical keys when available. */
  conceptCanonicalKeys?: string[];
  /** MATERIAL_FORM keys reachable via SATISFIED_BY from component concepts. */
  satisfiedByFormKeys?: string[];
};

export type BuildCandidateLearnerContext = {
  city?: string | null;
  area?: string | null;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const isGeneralMaterialType = (value: string) => {
  const normalized = normalizeText(value);
  return (
    normalized.length === 0 ||
    normalized === 'general' ||
    normalized === 'unspecified'
  );
};

const haystackForMaterial = (material: BuildCandidateMaterialInput) =>
  normalizeText(
    [
      material.title,
      material.description,
      material.materialType,
      ...material.tags,
    ].join(' '),
  );

const normalizeToken = (token: string) => {
  if (token.length > 4 && token.endsWith('s')) {
    return token.slice(0, -1);
  }

  return token;
};

const tokenize = (value: string) =>
  normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .map(normalizeToken);

/** Tokens that alone must not create strong motor/sensor family collisions. */
const BROAD_LEXICAL_TOKENS = new Set([
  'motor',
  'motors',
  'sensor',
  'sensors',
  'board',
  'boards',
  'module',
  'modules',
  'driver',
  'drivers',
  'kit',
  'cable',
  'with',
  'and',
]);

const hasStrongTokenOverlap = (left: string, right: string) => {
  const leftTokens = tokenize(left).filter(
    (token) => !BROAD_LEXICAL_TOKENS.has(token),
  );
  const rightTokens = tokenize(right);

  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const [shorter, longer] =
    leftTokens.length <= rightTokens.length
      ? [leftTokens, rightTokens]
      : [rightTokens, leftTokens];

  return shorter.every((token) => longer.includes(token));
};

export type MaterialComponentMatchReasonCode =
  | 'CONCEPT_EXACT'
  | 'CONCEPT_COMPATIBLE'
  | 'TYPE_EXACT'
  | 'TYPE_ALIAS'
  | 'EXACT_NAME'
  | 'NAME_MATCH'
  | 'STRONG_MATCH'
  | 'MATERIAL_TYPE_MATCH'
  | 'CATEGORY_MATCH'
  | 'KEYWORD_MATCH'
  | 'LEXICAL_FALLBACK';

const MATCH_REASON_PRIORITY: readonly MaterialComponentMatchReasonCode[] = [
  'CONCEPT_EXACT',
  'CONCEPT_COMPATIBLE',
  'TYPE_EXACT',
  'TYPE_ALIAS',
  'EXACT_NAME',
  'NAME_MATCH',
  'STRONG_MATCH',
  'MATERIAL_TYPE_MATCH',
  'CATEGORY_MATCH',
  'KEYWORD_MATCH',
  'LEXICAL_FALLBACK',
] as const;

export const resolveTaxonomyMatchEvidence = (
  material: BuildCandidateMaterialInput,
  component: BuildCandidateComponentInput,
): TaxonomyMatchEvidence | null =>
  evaluateProjectMaterialTaxonomyEvidence({
    componentConceptKeys: component.conceptCanonicalKeys ?? [],
    materialConceptKeys: material.conceptCanonicalKeys ?? [],
    satisfiedByFormKeys: component.satisfiedByFormKeys ?? [],
    componentMaterialType: component.materialType,
    materialMaterialType: material.materialType,
    materialTypeAliases: material.materialTypeAliases,
  });

/** Shared material↔component relevance used by learner candidates and supplier related-projects. */
export const scoreMaterialComponentRelevance = (
  material: BuildCandidateMaterialInput,
  component: BuildCandidateComponentInput,
) => {
  let score = 0;
  const taxonomyEvidence = resolveTaxonomyMatchEvidence(material, component);
  if (taxonomyEvidence) {
    score += taxonomyEvidence.scoreBoost;
  }

  const normalizedTitle = normalizeText(material.title);
  const normalizedName = normalizeText(component.componentName);
  const haystack = haystackForMaterial(material);
  const componentTypeNorm = normalizeText(component.materialType);
  const materialTypeNorm = normalizeText(material.materialType);
  const typesConflictWithListing =
    !taxonomyEvidence &&
    !isGeneralMaterialType(component.materialType) &&
    !isGeneralMaterialType(material.materialType) &&
    componentTypeNorm !== materialTypeNorm &&
    !materialTypeNorm.includes(componentTypeNorm) &&
    !componentTypeNorm.includes(materialTypeNorm);

  if (normalizedName.length > 0) {
    if (normalizedTitle === normalizedName) {
      score += 400;
    } else if (
      !typesConflictWithListing &&
      normalizedTitle.includes(normalizedName)
    ) {
      score += 280;
    } else if (
      !typesConflictWithListing &&
      hasStrongTokenOverlap(normalizedName, normalizedTitle)
    ) {
      score += 280;
    }
  }

  if (
    component.categoryId &&
    material.categoryId === component.categoryId
  ) {
    score += 150;
  }

  const componentType = normalizeText(component.materialType);
  const materialType = normalizeText(material.materialType);
  // Avoid double-counting when TYPE_EXACT / TYPE_ALIAS already applied a boost.
  const typeAlreadyBoosted =
    taxonomyEvidence?.kind === 'TYPE_EXACT' ||
    taxonomyEvidence?.kind === 'TYPE_ALIAS';
  if (
    !typeAlreadyBoosted &&
    !isGeneralMaterialType(component.materialType) &&
    (materialType.includes(componentType) || componentType.includes(materialType))
  ) {
    score += 120;
  }

  const keywordTerms = [
    ...component.searchKeywords,
    ...component.alternativeKeywords,
    ...component.searchTerms,
  ]
    .map(normalizeText)
    .filter((term) => term.length >= 2);

  const uniqueKeywordTerms = [...new Set(keywordTerms)];
  let keywordHits = 0;

  for (const term of uniqueKeywordTerms) {
    if (term === normalizedName || isGeneralMaterialType(term)) {
      continue;
    }
    // Skip ultra-broad single tokens that collide across motor/sensor families.
    if (BROAD_LEXICAL_TOKENS.has(term)) {
      continue;
    }

    if (haystack.includes(term)) {
      keywordHits += 1;
      score += Math.min(80, 40 + term.length);
    }
  }

  score += Math.min(keywordHits, 3) * 10;

  for (const tag of material.tags) {
    const normalizedTag = normalizeText(tag);
    if (
      normalizedName.length > 0 &&
      (normalizedTag.includes(normalizedName) || normalizedName.includes(normalizedTag))
    ) {
      score += 50;
      break;
    }
  }

  return score;
};

export const hasAlternativeKeywordEvidence = (
  material: BuildCandidateMaterialInput,
  alternativeKeywords: readonly string[],
) => {
  if (alternativeKeywords.length === 0) {
    return false;
  }

  const haystack = haystackForMaterial(material);
  return alternativeKeywords.some((keyword) =>
    haystack.includes(normalizeText(keyword)),
  );
};

export const deriveMaterialComponentMatchReasonCodes = (input: {
  material: BuildCandidateMaterialInput;
  component: BuildCandidateComponentInput;
  relevance: number;
  taxonomyEvidence?: TaxonomyMatchEvidence | null;
}): MaterialComponentMatchReasonCode[] => {
  const codes = new Set<MaterialComponentMatchReasonCode>();
  const taxonomyEvidence =
    input.taxonomyEvidence ??
    resolveTaxonomyMatchEvidence(input.material, input.component);

  if (taxonomyEvidence) {
    codes.add(taxonomyEvidence.kind);
  }

  const normalizedName = normalizeText(input.component.componentName);
  const normalizedTitle = normalizeText(input.material.title);
  const haystack = haystackForMaterial(input.material);
  const componentTypeNorm = normalizeText(input.component.materialType);
  const materialTypeNorm = normalizeText(input.material.materialType);
  const typesConflictWithListing =
    !taxonomyEvidence &&
    !isGeneralMaterialType(input.component.materialType) &&
    !isGeneralMaterialType(input.material.materialType) &&
    componentTypeNorm !== materialTypeNorm &&
    !materialTypeNorm.includes(componentTypeNorm) &&
    !componentTypeNorm.includes(materialTypeNorm);

  if (normalizedName.length > 0) {
    if (normalizedTitle === normalizedName) {
      codes.add('EXACT_NAME');
    } else if (
      !typesConflictWithListing &&
      normalizedTitle.includes(normalizedName)
    ) {
      codes.add('NAME_MATCH');
    } else if (
      !typesConflictWithListing &&
      hasStrongTokenOverlap(normalizedName, normalizedTitle)
    ) {
      codes.add('STRONG_MATCH');
    }
  }

  if (
    !codes.has('EXACT_NAME') &&
    !codes.has('NAME_MATCH') &&
    !codes.has('STRONG_MATCH') &&
    !taxonomyEvidence &&
    input.relevance >= 280
  ) {
    codes.add('STRONG_MATCH');
  }

  if (
    input.component.categoryId &&
    input.material.categoryId === input.component.categoryId
  ) {
    codes.add('CATEGORY_MATCH');
  }

  const componentType = normalizeText(input.component.materialType);
  const materialType = normalizeText(input.material.materialType);
  if (
    !isGeneralMaterialType(input.component.materialType) &&
    (materialType.includes(componentType) || componentType.includes(materialType))
  ) {
    codes.add('MATERIAL_TYPE_MATCH');
  }

  const keywords = [
    ...input.component.searchKeywords,
    ...input.component.alternativeKeywords,
  ];
  if (
    keywords.some((keyword) => haystack.includes(normalizeText(keyword)))
  ) {
    codes.add('KEYWORD_MATCH');
  }

  if (
    codes.size === 0 &&
    input.relevance > 0
  ) {
    codes.add('LEXICAL_FALLBACK');
  } else if (
    !taxonomyEvidence &&
    (codes.has('KEYWORD_MATCH') ||
      codes.has('NAME_MATCH') ||
      codes.has('STRONG_MATCH') ||
      codes.has('EXACT_NAME') ||
      codes.has('MATERIAL_TYPE_MATCH'))
  ) {
    // Inspectable lexical path when taxonomy did not decide.
    if (
      !codes.has('CONCEPT_EXACT') &&
      !codes.has('CONCEPT_COMPATIBLE') &&
      !codes.has('TYPE_EXACT') &&
      !codes.has('TYPE_ALIAS')
    ) {
      codes.add('LEXICAL_FALLBACK');
    }
  }

  return MATCH_REASON_PRIORITY.filter((code) => codes.has(code));
};

export const primaryMaterialComponentMatchReasonCode = (
  codes: readonly MaterialComponentMatchReasonCode[],
): MaterialComponentMatchReasonCode | null => codes[0] ?? null;

export type { ProjectMaterialTaxonomyMatchKind, TaxonomyMatchEvidence };

const scoreConvenience = (
  material: BuildCandidateMaterialInput,
  learner: BuildCandidateLearnerContext,
) => {
  let score = 0;
  const learnerCity = normalizeText(learner.city ?? '');
  const learnerArea = normalizeText(learner.area ?? '');
  const materialCity = normalizeText(material.city);
  const materialArea = normalizeText(material.area ?? '');

  if (learnerCity.length > 0 && materialCity === learnerCity) {
    score += 120;
  }

  if (
    learnerCity.length > 0 &&
    learnerArea.length > 0 &&
    materialCity === learnerCity &&
    materialArea.length > 0 &&
    materialArea === learnerArea
  ) {
    score += 60;
  }

  if (material.pickupAllowed) {
    score += 40;
  }

  if (material.deliveryAllowed) {
    score += 30;
  }

  return score;
};

const scoreCost = (material: BuildCandidateMaterialInput) => {
  if (material.isFree) {
    return 100;
  }

  if (material.price == null || material.price <= 0) {
    return 35;
  }

  return Math.max(0, 50 - Math.min(material.price, 50));
};

const scoreCondition = (condition: string) => {
  switch (condition.trim().toUpperCase()) {
    case 'NEW':
    case 'LIKE_NEW':
      return 80;
    case 'GOOD':
      return 60;
    case 'USED':
      return 40;
    case 'NEEDS_REPAIR':
      return 15;
    default:
      return 25;
  }
};

const scoreSupplierTrust = (material: BuildCandidateMaterialInput) => {
  let score = 0;

  if (material.supplierVerified) {
    score += 20;
  }

  score += Math.min(material.ownerCompletedHandovers, 5) * 2;

  return score;
};

export const scoreBuildMaterialCandidate = (
  material: BuildCandidateMaterialInput,
  component: BuildCandidateComponentInput,
  learner: BuildCandidateLearnerContext,
): BuildCandidateScoreBreakdown => ({
  relevance: scoreMaterialComponentRelevance(material, component),
  convenience: scoreConvenience(material, learner),
  cost: scoreCost(material),
  condition: scoreCondition(material.condition),
  supplierTrust: scoreSupplierTrust(material),
  freshnessMs: material.createdAt.getTime(),
});

export const compareBuildMaterialCandidateScores = (
  left: BuildCandidateScoreBreakdown,
  right: BuildCandidateScoreBreakdown,
) => {
  const keys: Array<keyof Omit<BuildCandidateScoreBreakdown, 'freshnessMs'>> = [
    'relevance',
    'convenience',
    'cost',
    'condition',
    'supplierTrust',
  ];

  for (const key of keys) {
    if (right[key] !== left[key]) {
      return right[key] - left[key];
    }
  }

  return right.freshnessMs - left.freshnessMs;
};

export const rankBuildMaterialCandidates = <T extends BuildCandidateMaterialInput>(
  materials: T[],
  component: BuildCandidateComponentInput,
  learner: BuildCandidateLearnerContext,
  limit: number,
) =>
  [...materials]
    .map((material) => ({
      material,
      score: scoreBuildMaterialCandidate(material, component, learner),
    }))
    .sort((left, right) =>
      compareBuildMaterialCandidateScores(left.score, right.score),
    )
    .slice(0, limit);

export const buildCandidateMatchHints = (input: {
  material: BuildCandidateMaterialInput;
  component: BuildCandidateComponentInput;
  learner: BuildCandidateLearnerContext;
  score: BuildCandidateScoreBreakdown;
}) => {
  const hints = new Set<string>();
  const taxonomyEvidence = resolveTaxonomyMatchEvidence(
    input.material,
    input.component,
  );
  if (taxonomyEvidence?.kind === 'CONCEPT_EXACT') {
    hints.add('Concept match');
  } else if (taxonomyEvidence?.kind === 'CONCEPT_COMPATIBLE') {
    hints.add('Compatible concept');
  } else if (
    taxonomyEvidence?.kind === 'TYPE_EXACT' ||
    taxonomyEvidence?.kind === 'TYPE_ALIAS'
  ) {
    hints.add('Material type match');
  }

  const normalizedName = normalizeText(input.component.componentName);
  const normalizedTitle = normalizeText(input.material.title);
  const haystack = haystackForMaterial(input.material);

  if (
    normalizedName.length > 0 &&
    (normalizedTitle === normalizedName ||
      normalizedTitle.includes(normalizedName) ||
      hasStrongTokenOverlap(normalizedName, normalizedTitle))
  ) {
    hints.add(
      normalizedTitle === normalizedName ||
        normalizedTitle.includes(normalizedName)
        ? normalizedTitle === normalizedName
          ? 'Strong match'
          : 'Name match'
        : 'Strong match',
    );
  } else if (!taxonomyEvidence && input.score.relevance >= 280) {
    hints.add('Strong match');
  }

  if (
    input.component.categoryId &&
    input.material.categoryId === input.component.categoryId
  ) {
    hints.add('Category match');
  }

  const keywords = [
    ...input.component.searchKeywords,
    ...input.component.alternativeKeywords,
  ];
  if (
    keywords.some((keyword) =>
      haystack.includes(normalizeText(keyword)),
    )
  ) {
    hints.add('Keyword match');
  }

  const componentType = normalizeText(input.component.materialType);
  const materialType = normalizeText(input.material.materialType);
  if (
    !isGeneralMaterialType(input.component.materialType) &&
    (materialType.includes(componentType) || componentType.includes(materialType))
  ) {
    hints.add('Material type match');
  }

  if (input.material.isFree) {
    hints.add('Free');
  }

  const learnerCity = normalizeText(input.learner.city ?? '');
  if (
    learnerCity.length > 0 &&
    normalizeText(input.material.city) === learnerCity
  ) {
    hints.add('Same city');
  }

  if (input.material.pickupAllowed) {
    hints.add('Pickup available');
  }

  if (input.material.deliveryAllowed) {
    hints.add('Delivery available');
  }

  if (hints.size === 0) {
    hints.add('Possible option');
  }

  return [...hints];
};
