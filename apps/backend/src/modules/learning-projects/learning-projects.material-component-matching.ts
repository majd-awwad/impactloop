import type { Prisma, ProjectComponentRole } from '../../generated/prisma/client.js';

import {
  deriveMaterialComponentMatchReasonCodes,
  hasAlternativeKeywordEvidence,
  primaryMaterialComponentMatchReasonCode,
  scoreMaterialComponentRelevance,
  type BuildCandidateComponentInput,
  type BuildCandidateMaterialInput,
  type MaterialComponentMatchReasonCode,
} from './learning-projects.build-candidate-ranking.js';

export const RELATED_COMPONENT_POOL_LIMIT = 200;

export const PUBLIC_PROJECT_WHERE: Prisma.LearningProjectWhereInput = {
  status: 'PUBLISHED',
  hiddenAt: null,
  archivedAt: null,
  category: {
    isActive: true,
    categoryType: {
      in: ['PROJECT', 'BOTH'],
    },
  },
};

export type MaterialForComponentMatching = {
  id: string;
  title: string;
  description: string;
  materialType: string;
  categoryId: string;
  tags: Array<{ tag: string }>;
  conceptCanonicalKeys?: string[];
  materialTypeAliases?: string[];
};

export type LearnerMaterialMatchType = 'EXACT' | 'COMPATIBLE' | 'ALTERNATIVE';

export const MATCH_TYPE_RANK: Record<LearnerMaterialMatchType, number> = {
  EXACT: 3,
  COMPATIBLE: 2,
  ALTERNATIVE: 1,
};

const normalizeToken = (value: string) => value.trim().toLowerCase();

const isGeneralMaterialType = (value: string) => {
  const normalized = normalizeToken(value);
  return (
    normalized.length === 0 ||
    normalized === 'general' ||
    normalized === 'unspecified'
  );
};

export const parseJsonStringArray = (value: Prisma.JsonValue | null | undefined) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const buildComponentSearchTerms = (component: {
  componentName: string;
  materialType: string;
  searchKeywords: Prisma.JsonValue | null;
  alternativeKeywords: Prisma.JsonValue | null;
}) => {
  const terms = new Set<string>();
  const name = component.componentName.trim();
  if (name.length > 0) {
    terms.add(name);
  }

  for (const keyword of parseJsonStringArray(component.searchKeywords)) {
    terms.add(keyword);
  }

  for (const keyword of parseJsonStringArray(component.alternativeKeywords)) {
    terms.add(keyword);
  }

  const materialType = component.materialType.trim();
  if (!isGeneralMaterialType(materialType)) {
    terms.add(materialType);
  }

  return [...terms];
};

const buildCandidateQueryTokens = (material: MaterialForComponentMatching) => {
  const tokens = new Set<string>();
  const title = material.title.trim();
  if (title.length >= 2) {
    tokens.add(title);
    for (const part of title.split(/\s+/)) {
      if (part.trim().length >= 3) {
        tokens.add(part.trim());
      }
    }
  }

  if (!isGeneralMaterialType(material.materialType)) {
    tokens.add(material.materialType.trim());
  }

  for (const entry of material.tags) {
    const tag = entry.tag.trim();
    if (tag.length >= 2) {
      tokens.add(tag);
    }
  }

  return [...tokens].slice(0, 12);
};

export const toRankingMaterialInput = (
  material: MaterialForComponentMatching,
): BuildCandidateMaterialInput => ({
  id: material.id,
  title: material.title,
  description: material.description,
  materialType: material.materialType,
  condition: 'GOOD',
  isFree: true,
  price: null,
  pickupAllowed: true,
  deliveryAllowed: false,
  createdAt: new Date(0),
  categoryId: material.categoryId,
  city: '',
  area: null,
  tags: material.tags.map((entry) => entry.tag),
  supplierVerified: false,
  ownerCompletedHandovers: 0,
  conceptCanonicalKeys: material.conceptCanonicalKeys,
  materialTypeAliases: material.materialTypeAliases,
});

export const toRankingComponentInput = (component: {
  componentName: string;
  materialType: string;
  categoryId: string | null;
  searchKeywords: Prisma.JsonValue | null;
  alternativeKeywords: Prisma.JsonValue | null;
  conceptCanonicalKeys?: string[];
  satisfiedByFormKeys?: string[];
}): BuildCandidateComponentInput => {
  const searchTerms = buildComponentSearchTerms(component);
  return {
    categoryId: component.categoryId,
    componentName: component.componentName,
    materialType: component.materialType,
    searchKeywords: parseJsonStringArray(component.searchKeywords),
    alternativeKeywords: parseJsonStringArray(component.alternativeKeywords),
    searchTerms,
    conceptCanonicalKeys: component.conceptCanonicalKeys,
    satisfiedByFormKeys: component.satisfiedByFormKeys,
  };
};

export const buildCandidateComponentWhere = (
  material: MaterialForComponentMatching,
): Prisma.ProjectRequiredComponentWhereInput => {
  const tokens = buildCandidateQueryTokens(material);
  const textClauses: Prisma.ProjectRequiredComponentWhereInput[] = tokens.flatMap(
    (token) => [
      {
        componentName: {
          contains: token,
          mode: 'insensitive' as const,
        },
      },
      {
        materialType: {
          contains: token,
          mode: 'insensitive' as const,
        },
      },
    ],
  );

  const narrowing: Prisma.ProjectRequiredComponentWhereInput[] = [
    { categoryId: material.categoryId },
    ...textClauses,
  ];

  return {
    componentRole: { not: 'TOOL' },
    project: {
      is: PUBLIC_PROJECT_WHERE,
    },
    OR: narrowing,
  };
};

export const classifyLearnerMaterialMatchType = (input: {
  matchReasonCodes: readonly MaterialComponentMatchReasonCode[];
  canBeSubstituted: boolean;
  alternativeKeywordMatched: boolean;
}): LearnerMaterialMatchType | null => {
  if (
    input.matchReasonCodes.includes('EXACT_NAME') ||
    input.matchReasonCodes.includes('CONCEPT_EXACT') ||
    input.matchReasonCodes.includes('TYPE_EXACT')
  ) {
    return 'EXACT';
  }

  if (
    input.matchReasonCodes.includes('CONCEPT_COMPATIBLE') ||
    input.matchReasonCodes.includes('TYPE_ALIAS')
  ) {
    return 'COMPATIBLE';
  }

  if (
    input.canBeSubstituted &&
    input.alternativeKeywordMatched &&
    !input.matchReasonCodes.includes('NAME_MATCH') &&
    !input.matchReasonCodes.includes('STRONG_MATCH') &&
    !input.matchReasonCodes.includes('MATERIAL_TYPE_MATCH')
  ) {
    return 'ALTERNATIVE';
  }

  if (input.matchReasonCodes.length > 0) {
    return 'COMPATIBLE';
  }

  return null;
};

export type ScoredMaterialComponentMatch = {
  projectId: string;
  componentId: string;
  componentName: string;
  componentRole: ProjectComponentRole;
  requiredQuantity: number;
  unit: string;
  canBeSubstituted: boolean;
  isRequired: boolean;
  componentPosition: number;
  matchReasonCodes: MaterialComponentMatchReasonCode[];
  matchReasonCode: MaterialComponentMatchReasonCode;
  matchType: LearnerMaterialMatchType;
  compatibilityScore: number;
};

export const scoreMaterialAgainstComponent = (input: {
  material: MaterialForComponentMatching;
  component: {
    id: string;
    categoryId: string | null;
    componentName: string;
    materialType: string;
    searchKeywords: Prisma.JsonValue | null;
    alternativeKeywords: Prisma.JsonValue | null;
    componentRole: ProjectComponentRole;
    quantity: Prisma.Decimal;
    unit: string;
    canBeSubstituted: boolean;
    isRequired: boolean;
    componentPosition: number;
    projectId: string;
    conceptCanonicalKeys?: string[];
    satisfiedByFormKeys?: string[];
  };
}): ScoredMaterialComponentMatch | null => {
  const rankingMaterial = toRankingMaterialInput(input.material);
  const rankingComponent = toRankingComponentInput(input.component);
  const relevance = scoreMaterialComponentRelevance(rankingMaterial, rankingComponent);
  if (relevance <= 0) {
    return null;
  }

  const matchReasonCodes = deriveMaterialComponentMatchReasonCodes({
    material: rankingMaterial,
    component: rankingComponent,
    relevance,
  });
  const matchReasonCode = primaryMaterialComponentMatchReasonCode(matchReasonCodes);
  if (!matchReasonCode) {
    return null;
  }

  const hasTaxonomyOrTypeSignal = matchReasonCodes.some((code) =>
    [
      'CONCEPT_EXACT',
      'CONCEPT_COMPATIBLE',
      'TYPE_EXACT',
      'TYPE_ALIAS',
      'MATERIAL_TYPE_MATCH',
      'EXACT_NAME',
    ].includes(code),
  );
  const componentType = input.component.materialType.trim().toLowerCase();
  const materialType = input.material.materialType.trim().toLowerCase();
  const typesConflict =
    componentType.length > 0 &&
    materialType.length > 0 &&
    componentType !== 'general' &&
    componentType !== 'unspecified' &&
    materialType !== 'general' &&
    materialType !== 'unspecified' &&
    componentType !== materialType &&
    !materialType.includes(componentType) &&
    !componentType.includes(materialType);

  const alternativeKeywordMatched = hasAlternativeKeywordEvidence(
    rankingMaterial,
    rankingComponent.alternativeKeywords,
  );

  // A listing with a different canonical type (e.g. Raspberry Pi Kit) must not
  // satisfy an accessory requirement (Heatsink) via title keyword alone.
  // Explicit project alternatives remain allowed when substitution is enabled.
  if (
    typesConflict &&
    !hasTaxonomyOrTypeSignal &&
    !(input.component.canBeSubstituted && alternativeKeywordMatched)
  ) {
    return null;
  }

  const matchType = classifyLearnerMaterialMatchType({
    matchReasonCodes,
    canBeSubstituted: input.component.canBeSubstituted,
    alternativeKeywordMatched,
  });
  if (!matchType) {
    return null;
  }

  return {
    projectId: input.component.projectId,
    componentId: input.component.id,
    componentName: input.component.componentName,
    componentRole: input.component.componentRole,
    requiredQuantity: input.component.quantity.toNumber(),
    unit: input.component.unit,
    canBeSubstituted: input.component.canBeSubstituted,
    isRequired: input.component.isRequired,
    componentPosition: input.component.componentPosition,
    matchReasonCodes,
    matchReasonCode,
    matchType,
    compatibilityScore: relevance,
  };
};

export const compareScoredMaterialComponentMatches = (
  left: ScoredMaterialComponentMatch,
  right: ScoredMaterialComponentMatch,
) => {
  if (right.compatibilityScore !== left.compatibilityScore) {
    return right.compatibilityScore - left.compatibilityScore;
  }

  const matchTypeDelta =
    MATCH_TYPE_RANK[right.matchType] - MATCH_TYPE_RANK[left.matchType];
  if (matchTypeDelta !== 0) {
    return matchTypeDelta;
  }

  if (left.isRequired !== right.isRequired) {
    return left.isRequired ? -1 : 1;
  }

  if (left.componentPosition !== right.componentPosition) {
    return left.componentPosition - right.componentPosition;
  }

  return left.componentId.localeCompare(right.componentId);
};
