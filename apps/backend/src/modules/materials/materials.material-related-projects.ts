import type { Prisma, ProjectBuildStatus } from '../../generated/prisma/client.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  findLearnerAcquiredMaterialAccess,
} from './materials.acquired-access.js';
import { buildPublicMaterialWhere } from './public-material-visibility.js';
import type { MaterialRelatedProjectsQuery } from './materials.validation.js';
import {
  buildCandidateComponentWhere,
  compareScoredMaterialComponentMatches,
  MATCH_TYPE_RANK,
  MaterialForComponentMatching,
  RELATED_COMPONENT_POOL_LIMIT,
  scoreMaterialAgainstComponent,
  type LearnerMaterialMatchType,
  type ScoredMaterialComponentMatch,
} from '../learning-projects/learning-projects.material-component-matching.js';
import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';

export type MaterialRelatedProjectLearnerAction = 'START_BUILD' | 'CONTINUE_BUILD';

export type MaterialRelatedProjectItemDto = {
  project: {
    id: string;
    title: string;
    shortDescription: string | null;
    coverImageUrl: string | null;
    category: {
      id: string;
      nameEn: string;
      nameAr: string;
    };
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    estimatedDurationMinutes: number | null;
    likesCount: number;
    requiredMaterialComponentCount: number;
  };
  bestMatchedComponent: {
    componentId: string;
    componentName: string;
    componentRole: string;
    requiredQuantity: number;
    unit: string;
    canBeSubstituted: boolean;
  };
  match: {
    matchType: LearnerMaterialMatchType;
    compatibilityScore: number;
    matchReasons: ScoredMaterialComponentMatch['matchReasonCodes'];
    additionalMatchedComponentsCount: number;
  };
  learnerContext?: {
    hasActiveBuild: boolean;
    buildId: string | null;
    buildStatus: 'IN_PROGRESS' | 'COMPLETED' | null;
    action: MaterialRelatedProjectLearnerAction;
  };
};

export type MaterialRelatedProjectsDto = {
  materialId: string;
  items: MaterialRelatedProjectItemDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const materialForMatchingSelect = {
  id: true,
  title: true,
  description: true,
  materialType: true,
  categoryId: true,
  tags: {
    select: {
      tag: true,
    },
  },
} as const;

const resolveMaterialForRelatedProjects = async (
  materialId: string,
  viewer?: AccessTokenPayload,
): Promise<MaterialForComponentMatching> => {
  let material = await prisma.material.findFirst({
    where: {
      id: materialId,
      ...buildPublicMaterialWhere(),
    },
    select: materialForMatchingSelect,
  });

  if (!material && viewer?.roles.includes('LEARNER')) {
    const acquiredReservation = await findLearnerAcquiredMaterialAccess({
      requesterId: viewer.sub,
      materialId,
    });

    if (acquiredReservation) {
      material = await prisma.material.findFirst({
        where: {
          id: materialId,
          category: {
            isActive: true,
            categoryType: { in: ['MATERIAL', 'BOTH'] },
          },
        },
        select: materialForMatchingSelect,
      });
    }
  }

  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  return material;
};

export type RankedProjectMatch = {
  project: {
    id: string;
    title: string;
    shortDescription: string | null;
    coverImageUrl: string | null;
    difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    estimatedDurationMinutes: number | null;
    createdAt: Date;
    category: {
      id: string;
      nameEn: string;
      nameAr: string;
    };
    requiredMaterialComponentCount: number;
  };
  bestMatch: ScoredMaterialComponentMatch;
  additionalMatchedComponentsCount: number;
};

type ComponentForMatching = {
  id: string;
  categoryId: string | null;
  componentName: string;
  materialType: string;
  searchKeywords: Prisma.JsonValue | null;
  alternativeKeywords: Prisma.JsonValue | null;
  componentRole: ScoredMaterialComponentMatch['componentRole'];
  quantity: { toNumber(): number };
  unit: string;
  canBeSubstituted: boolean;
  isRequired: boolean;
  createdAt: Date;
  project: RankedProjectMatch['project'];
};

export const buildMatchedProjectsForMaterial = (
  material: MaterialForComponentMatching,
  components: ComponentForMatching[],
): RankedProjectMatch[] => {
  const matchesByProject = new Map<string, ScoredMaterialComponentMatch[]>();
  const componentPositionByProject = new Map<string, number>();

  for (const component of components) {
    const position = componentPositionByProject.get(component.project.id) ?? 0;
    componentPositionByProject.set(component.project.id, position + 1);

    const scored = scoreMaterialAgainstComponent({
      material,
      component: {
        id: component.id,
        categoryId: component.categoryId,
        componentName: component.componentName,
        materialType: component.materialType,
        searchKeywords: component.searchKeywords,
        alternativeKeywords: component.alternativeKeywords,
        componentRole: component.componentRole,
        quantity: component.quantity as never,
        unit: component.unit,
        canBeSubstituted: component.canBeSubstituted,
        isRequired: component.isRequired,
        componentPosition: position,
        projectId: component.project.id,
      },
    });

    if (!scored) {
      continue;
    }

    const existing = matchesByProject.get(component.project.id) ?? [];
    existing.push(scored);
    matchesByProject.set(component.project.id, existing);
  }

  const matched: RankedProjectMatch[] = [];

  for (const [projectId, projectMatches] of matchesByProject.entries()) {
    const sortedMatches = [...projectMatches].sort(compareScoredMaterialComponentMatches);
    const bestMatch = sortedMatches[0];
    if (!bestMatch) {
      continue;
    }

    const project = components.find((component) => component.project.id === projectId)
      ?.project;
    if (!project) {
      continue;
    }

    matched.push({
      project,
      bestMatch,
      additionalMatchedComponentsCount: sortedMatches.length - 1,
    });
  }

  return matched;
};

export const compareMatchedProjectsForRanking = (
  left: RankedProjectMatch,
  right: RankedProjectMatch,
  likesByProjectId: Map<string, number>,
) => {
  if (right.bestMatch.compatibilityScore !== left.bestMatch.compatibilityScore) {
    return right.bestMatch.compatibilityScore - left.bestMatch.compatibilityScore;
  }

  const matchTypeDelta =
    MATCH_TYPE_RANK[right.bestMatch.matchType] -
    MATCH_TYPE_RANK[left.bestMatch.matchType];
  if (matchTypeDelta !== 0) {
    return matchTypeDelta;
  }

  const leftLikes = likesByProjectId.get(left.project.id) ?? 0;
  const rightLikes = likesByProjectId.get(right.project.id) ?? 0;
  if (rightLikes !== leftLikes) {
    return rightLikes - leftLikes;
  }

  if (right.project.createdAt.getTime() !== left.project.createdAt.getTime()) {
    return right.project.createdAt.getTime() - left.project.createdAt.getTime();
  }

  return left.project.id.localeCompare(right.project.id);
};

export const sortMatchedProjectsForMaterial = (
  matched: RankedProjectMatch[],
  likesByProjectId: Map<string, number>,
): RankedProjectMatch[] =>
  [...matched].sort((left, right) =>
    compareMatchedProjectsForRanking(left, right, likesByProjectId),
  );

const mapLearnerBuildContext = (
  build:
    | {
        id: string;
        status: ProjectBuildStatus;
      }
    | undefined,
): NonNullable<MaterialRelatedProjectItemDto['learnerContext']> => {
  if (!build) {
    return {
      hasActiveBuild: false,
      buildId: null,
      buildStatus: null,
      action: 'START_BUILD' as const,
    };
  }

  if (build.status === 'IN_PROGRESS') {
    return {
      hasActiveBuild: true,
      buildId: build.id,
      buildStatus: build.status,
      action: 'CONTINUE_BUILD' as const,
    };
  }

  return {
    hasActiveBuild: false,
    buildId: build.id,
    buildStatus: build.status === 'COMPLETED' ? 'COMPLETED' : null,
    action: 'START_BUILD' as const,
  };
};

export const getMaterialRelatedProjects = async (
  materialId: string,
  query: MaterialRelatedProjectsQuery,
  viewer?: AccessTokenPayload,
): Promise<MaterialRelatedProjectsDto> => {
  const material = await resolveMaterialForRelatedProjects(materialId, viewer);

  const components = await prisma.projectRequiredComponent.findMany({
    where: buildCandidateComponentWhere(material),
    orderBy: [{ projectId: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    take: RELATED_COMPONENT_POOL_LIMIT,
    select: {
      id: true,
      categoryId: true,
      componentName: true,
      materialType: true,
      searchKeywords: true,
      alternativeKeywords: true,
      componentRole: true,
      quantity: true,
      unit: true,
      canBeSubstituted: true,
      isRequired: true,
      createdAt: true,
      project: {
        select: {
          id: true,
          title: true,
          shortDescription: true,
          coverImageUrl: true,
          difficulty: true,
          estimatedDurationMinutes: true,
          createdAt: true,
          category: {
            select: {
              id: true,
              nameEn: true,
              nameAr: true,
            },
          },
          _count: {
            select: {
              requiredComponents: {
                where: {
                  componentRole: { not: 'TOOL' },
                },
              },
            },
          },
        },
      },
    },
  });

  const normalizedComponents = components.map((component) => ({
    ...component,
    project: {
      id: component.project.id,
      title: component.project.title,
      shortDescription: component.project.shortDescription,
      coverImageUrl: component.project.coverImageUrl,
      difficulty: component.project.difficulty,
      estimatedDurationMinutes: component.project.estimatedDurationMinutes,
      createdAt: component.project.createdAt,
      category: component.project.category,
      requiredMaterialComponentCount:
        component.project._count.requiredComponents,
    },
  }));

  const matched = buildMatchedProjectsForMaterial(material, normalizedComponents);
  const matchedProjectIds = matched.map((item) => item.project.id);
  const rankingLikesByProjectId =
    await learningProjectsRepository.countLikesByProjectIds(matchedProjectIds);

  const ranked = sortMatchedProjectsForMaterial(matched, rankingLikesByProjectId);
  const total = ranked.length;
  const skip = (query.page - 1) * query.limit;
  const pageItems = ranked.slice(skip, skip + query.limit);
  const projectIds = pageItems.map((item) => item.project.id);

  const buildsByProjectId = viewer?.roles.includes('LEARNER')
    ? await prisma.projectBuild.findMany({
        where: {
          learnerId: viewer.sub,
          projectId: { in: projectIds },
        },
        select: {
          id: true,
          projectId: true,
          status: true,
        },
      })
    : [];

  const buildByProjectId = new Map(
    buildsByProjectId.map((build) => [build.projectId, build]),
  );

  return {
    materialId: material.id,
    items: pageItems.map((item) => {
      const learnerBuild = buildByProjectId.get(item.project.id);
      const learnerContext = viewer?.roles.includes('LEARNER')
        ? mapLearnerBuildContext(learnerBuild)
        : undefined;

      return {
        project: {
          id: item.project.id,
          title: item.project.title,
          shortDescription: item.project.shortDescription,
          coverImageUrl: item.project.coverImageUrl,
          category: item.project.category,
          difficulty: item.project.difficulty,
          estimatedDurationMinutes: item.project.estimatedDurationMinutes,
          likesCount: rankingLikesByProjectId.get(item.project.id) ?? 0,
          requiredMaterialComponentCount:
            item.project.requiredMaterialComponentCount,
        },
        bestMatchedComponent: {
          componentId: item.bestMatch.componentId,
          componentName: item.bestMatch.componentName,
          componentRole: item.bestMatch.componentRole,
          requiredQuantity: item.bestMatch.requiredQuantity,
          unit: item.bestMatch.unit,
          canBeSubstituted: item.bestMatch.canBeSubstituted,
        },
        match: {
          matchType: item.bestMatch.matchType,
          compatibilityScore: item.bestMatch.compatibilityScore,
          matchReasons: item.bestMatch.matchReasonCodes,
          additionalMatchedComponentsCount: item.additionalMatchedComponentsCount,
        },
        ...(learnerContext ? { learnerContext } : {}),
      };
    }),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};
