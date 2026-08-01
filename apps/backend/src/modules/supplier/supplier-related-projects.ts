import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import {
  deriveMaterialComponentMatchReasonCodes,
  primaryMaterialComponentMatchReasonCode,
  scoreMaterialComponentRelevance,
  type BuildCandidateComponentInput,
  type BuildCandidateMaterialInput,
  type MaterialComponentMatchReasonCode,
} from '../learning-projects/learning-projects.build-candidate-ranking.js';

const RELATED_COMPONENT_POOL_LIMIT = 200;

const PUBLIC_PROJECT_WHERE: Prisma.LearningProjectWhereInput = {
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

export type SupplierRelatedProjectItemDto = {
  projectId: string;
  title: string;
  coverImageUrl: string | null;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  matchedComponentId: string;
  matchedComponentName: string;
  matchReasonCode: MaterialComponentMatchReasonCode;
  rankingScore: number;
};

export type SupplierRelatedProjectsDto = {
  materialId: string;
  relatedProjectCount: number;
  items: SupplierRelatedProjectItemDto[];
};

export type OwnedMaterialForRelatedProjects = {
  id: string;
  title: string;
  description: string;
  materialType: string;
  categoryId: string;
  tags: Array<{ tag: string }>;
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

const parseJsonStringArray = (value: Prisma.JsonValue | null | undefined) => {
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

const buildCandidateQueryTokens = (material: OwnedMaterialForRelatedProjects) => {
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

const toRankingMaterialInput = (
  material: OwnedMaterialForRelatedProjects,
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
});

const toRankingComponentInput = (component: {
  categoryId: string | null;
  componentName: string;
  materialType: string;
  searchKeywords: Prisma.JsonValue | null;
  alternativeKeywords: Prisma.JsonValue | null;
}): BuildCandidateComponentInput => {
  const searchTerms = buildComponentSearchTerms(component);
  return {
    categoryId: component.categoryId,
    componentName: component.componentName,
    materialType: component.materialType,
    searchKeywords: parseJsonStringArray(component.searchKeywords),
    alternativeKeywords: parseJsonStringArray(component.alternativeKeywords),
    searchTerms,
  };
};

const buildCandidateComponentWhere = (
  material: OwnedMaterialForRelatedProjects,
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

type ScoredProjectMatch = {
  projectId: string;
  title: string;
  coverImageUrl: string | null;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  matchedComponentId: string;
  matchedComponentName: string;
  matchReasonCode: MaterialComponentMatchReasonCode;
  rankingScore: number;
};

export const matchRelatedProjectsForMaterial = (
  material: OwnedMaterialForRelatedProjects,
  components: Array<{
    id: string;
    categoryId: string | null;
    componentName: string;
    materialType: string;
    searchKeywords: Prisma.JsonValue | null;
    alternativeKeywords: Prisma.JsonValue | null;
    project: {
      id: string;
      title: string;
      coverImageUrl: string | null;
      difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    };
  }>,
  limit: number,
): SupplierRelatedProjectsDto => {
  const rankingMaterial = toRankingMaterialInput(material);
  const bestByProject = new Map<string, ScoredProjectMatch>();

  for (const component of components) {
    const rankingComponent = toRankingComponentInput(component);
    const relevance = scoreMaterialComponentRelevance(
      rankingMaterial,
      rankingComponent,
    );
    if (relevance <= 0) {
      continue;
    }

    const codes = deriveMaterialComponentMatchReasonCodes({
      material: rankingMaterial,
      component: rankingComponent,
      relevance,
    });
    const matchReasonCode = primaryMaterialComponentMatchReasonCode(codes);
    if (!matchReasonCode) {
      continue;
    }

    const candidate: ScoredProjectMatch = {
      projectId: component.project.id,
      title: component.project.title,
      coverImageUrl: component.project.coverImageUrl,
      difficulty: component.project.difficulty,
      matchedComponentId: component.id,
      matchedComponentName: component.componentName,
      matchReasonCode,
      rankingScore: relevance,
    };

    const existing = bestByProject.get(candidate.projectId);
    if (
      !existing ||
      candidate.rankingScore > existing.rankingScore ||
      (candidate.rankingScore === existing.rankingScore &&
        candidate.matchedComponentId < existing.matchedComponentId)
    ) {
      bestByProject.set(candidate.projectId, candidate);
    }
  }

  const ranked = [...bestByProject.values()].sort((left, right) => {
    if (right.rankingScore !== left.rankingScore) {
      return right.rankingScore - left.rankingScore;
    }
    return left.projectId.localeCompare(right.projectId);
  });

  return {
    materialId: material.id,
    relatedProjectCount: ranked.length,
    items: ranked.slice(0, limit).map((item) => ({
      projectId: item.projectId,
      title: item.title,
      coverImageUrl: item.coverImageUrl,
      difficulty: item.difficulty,
      matchedComponentId: item.matchedComponentId,
      matchedComponentName: item.matchedComponentName,
      matchReasonCode: item.matchReasonCode,
      rankingScore: item.rankingScore,
    })),
  };
};

export const getRelatedProjectsForOwnedMaterial = async (
  material: OwnedMaterialForRelatedProjects,
  limit: number,
): Promise<SupplierRelatedProjectsDto> => {
  const components = await prisma.projectRequiredComponent.findMany({
    where: buildCandidateComponentWhere(material),
    orderBy: { id: 'asc' },
    take: RELATED_COMPONENT_POOL_LIMIT,
    select: {
      id: true,
      categoryId: true,
      componentName: true,
      materialType: true,
      searchKeywords: true,
      alternativeKeywords: true,
      project: {
        select: {
          id: true,
          title: true,
          coverImageUrl: true,
          difficulty: true,
        },
      },
    },
  });

  return matchRelatedProjectsForMaterial(material, components, limit);
};
