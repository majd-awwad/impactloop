import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import {
  buildCandidateComponentWhere,
  MaterialForComponentMatching,
  parseJsonStringArray,
  PUBLIC_PROJECT_WHERE,
  RELATED_COMPONENT_POOL_LIMIT,
  toRankingComponentInput,
  toRankingMaterialInput,
} from '../learning-projects/learning-projects.material-component-matching.js';
import {
  deriveMaterialComponentMatchReasonCodes,
  primaryMaterialComponentMatchReasonCode,
  scoreMaterialComponentRelevance,
  type MaterialComponentMatchReasonCode,
} from '../learning-projects/learning-projects.build-candidate-ranking.js';

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

export type OwnedMaterialForRelatedProjects = MaterialForComponentMatching;

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

// Re-export shared constants for tests that may need them.
export { PUBLIC_PROJECT_WHERE, parseJsonStringArray };
