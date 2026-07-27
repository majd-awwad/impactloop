import { AppError } from '../../../utils/app-error.js';
import { prisma } from '../../../database/prisma.js';
import { getCategories } from '../../categories/categories.service.js';
import { getLearnerHomeSection } from '../../learner-home/learner-home.service.js';
import { normalizeMaterialTitleKey } from '../../learner-home/learner-home.deduplication.js';
import type { LearnerHomeSectionItem } from '../../learner-home/learner-home.types.js';
import {
  getRequiredComponentMaterialCandidates,
  estimateProjectMaterialBudget,
  findProjectsWithinBudget,
  type ProjectMaterialBudgetEstimate,
} from '../../learning-projects/learning-projects.build-material-linking.js';
import {
  getBuildItemMaterialCandidatesById,
  getLearningProjectById,
  getLearningProjects,
  getOwnedProjectBuildByBuildId,
  getSavedLearningProjects,
  listActiveProjectBuildsForLearner,
} from '../../learning-projects/learning-projects.service.js';
import * as learningProjectsRepository from '../../learning-projects/learning-projects.repository.js';
import { getMaterialById, getMaterials } from '../../materials/materials.service.js';
import type { MaterialsQuery } from '../../materials/materials.validation.js';
import type { LearningProjectsQuery } from '../../learning-projects/learning-projects.validation.js';

import type { AiContentBlock } from '../ai.content-blocks.js';
import type { AiLocale } from '../ai.types.js';
import {
  isGenericProjectBrowseQuery,
  isMaterialSearchNoiseQuery,
  normalizeMaterialCategoryText,
  normalizeMaterialItemQuery,
  normalizeOwnedMaterialForMatching,
  ownedMaterialAliasGroups,
  stripProjectBudgetCostSuffix,
  stripProjectBudgetCostPrefix,
  tokenizeProjectQuery,
} from './ai-agent-filter-extractor.service.js';
import type { AiToolExecutionContext } from './ai-agent.types.js';
import { shouldHideE2eFixtureTitle } from '../e2e-fixture-guard.js';
import { localizeRecommendationReasons } from './ai-agent-reason-localizer.service.js';
import {
  buildLearnerViewer,
  loadLearnerAgentContext,
  requireLearnerCoordinates,
} from './ai-tool-context.service.js';
import {
  mapMaterialToCard,
  mapProjectToCard,
  toBuildChecklistBlock,
  toComparisonBlock,
  toComponentListBlock,
  toComponentMatchesBlock,
  toMaterialDetailsBlock,
  toMaterialResultsBlock,
  toProjectDetailsBlock,
  toProjectResultsBlock,
  toRecommendationsBlock,
  toProjectBudgetEstimateBlock,
} from './ai-tool-mappers.js';
import {
  compareMaterialIdsInputSchema,
  compareProjectIdsInputSchema,
  componentIdInputSchema,
  findMaterialsForProjectInputSchema,
  findProjectsWithinBudgetInputSchema,
  matchAvailableMaterialsForProjectInputSchema,
  materialIdInputSchema,
  matchProjectsByOwnedMaterialsInputSchema,
  personalizedRecommendationsInputSchema,
  projectIdInputSchema,
  searchAvailableMaterialsInputSchema,
  searchLearningProjectsInputSchema,
} from './ai-tool.types.js';
import { resolveLatestBuildId } from './ai-agent-reference-resolver.service.js';

type RecommendationMappedItem = {
  itemType: 'MATERIAL' | 'PROJECT' | 'ACTION';
  itemId: string;
  title: string;
  reasons: string[];
  thumbnailUrl?: string | null;
  priceLabel?: string;
  categoryLabel?: string;
  distanceKm?: number | null;
  difficulty?: string;
  estimatedTimeLabel?: string;
  savedByLearner?: boolean;
  activeBuildId?: string | null;
};

const withLocalizedReasons = (
  reasons: string[],
  locale: Parameters<typeof mapMaterialToCard>[1],
) =>
  localizeRecommendationReasons(
    reasons.length > 0 ? reasons : ['Recommended for you'],
    locale,
  );

const mapRecommendationSectionItems = (
  items: LearnerHomeSectionItem[],
  locale: Parameters<typeof mapMaterialToCard>[1],
  seen: Set<string>,
): RecommendationMappedItem[] =>
  items
    .map((item): RecommendationMappedItem | null => {
      if (item.type === 'material') {
        const material = item.material as Parameters<typeof mapMaterialToCard>[0];
        const itemId = material.id ?? '';
        if (!itemId || seen.has(itemId) || shouldHideE2eFixtureTitle(material.title)) {
          return null;
        }
        seen.add(itemId);
        const card = mapMaterialToCard(material, locale);
        return {
          itemType: 'MATERIAL' as const,
          itemId,
          title: card.title,
          reasons: withLocalizedReasons(item.reasons, locale),
          thumbnailUrl: card.thumbnailUrl,
          priceLabel: card.priceLabel,
          categoryLabel: card.categoryLabel,
          distanceKm: card.distanceKm,
        };
      }

      if (item.type === 'project') {
        const project = item.project as Parameters<typeof mapProjectToCard>[0];
        const itemId = project.id ?? '';
        if (!itemId || seen.has(itemId) || shouldHideE2eFixtureTitle(project.title)) {
          return null;
        }
        seen.add(itemId);
        const card = mapProjectToCard(project, locale);
        return {
          itemType: 'PROJECT' as const,
          itemId,
          title: card.title,
          reasons: withLocalizedReasons(item.reasons, locale),
          thumbnailUrl: card.thumbnailUrl,
          difficulty: card.difficulty,
          estimatedTimeLabel: card.estimatedTimeLabel,
          savedByLearner: card.savedByLearner,
          activeBuildId: card.activeBuildId,
        };
      }

      const build = item.build as { id?: string; project?: { title?: string } };
      const itemId = build.id ?? '';
      if (!itemId || seen.has(itemId)) {
        return null;
      }
      seen.add(itemId);
      return {
        itemType: 'ACTION' as const,
        itemId,
        title: build.project?.title ?? 'Continue build',
        reasons: localizeRecommendationReasons(item.reasons, locale),
      };
    })
    .filter((entry): entry is RecommendationMappedItem => entry !== null);

const dedupeMappedMaterialRecommendations = (
  items: RecommendationMappedItem[],
  limit: number,
): RecommendationMappedItem[] => {
  const selected: RecommendationMappedItem[] = [];
  const seenIds = new Set<string>();
  const seenTitleKeys = new Set<string>();

  for (const item of items) {
    if (selected.length >= limit) {
      break;
    }

    if (item.itemType !== 'MATERIAL') {
      selected.push(item);
      continue;
    }

    const titleKey = normalizeMaterialTitleKey(item.title);
    if (seenIds.has(item.itemId)) {
      continue;
    }
    if (titleKey.length > 0 && seenTitleKeys.has(titleKey)) {
      continue;
    }

    seenIds.add(item.itemId);
    if (titleKey.length > 0) {
      seenTitleKeys.add(titleKey);
    }
    selected.push(item);
  }

  return selected;
};

const loadRecommendationSectionItems = async (
  userId: string,
  sectionKey: Parameters<typeof getLearnerHomeSection>[1],
  limit: number,
  locale: Parameters<typeof mapMaterialToCard>[1],
  seen = new Set<string>(),
) => {
  const section = await getLearnerHomeSection(userId, sectionKey, limit);
  return mapRecommendationSectionItems(section.items, locale, seen);
};

const resolvePrimaryProjectRecommendations = async (input: {
  userId: string;
  limit: number;
  locale: Parameters<typeof mapMaterialToCard>[1];
  preferNextActions?: boolean;
}): Promise<{
  recommendationType: 'PROJECTS' | 'NEXT_ACTIONS';
  items: RecommendationMappedItem[];
}> => {
  const seen = new Set<string>();
  const continueItems = await loadRecommendationSectionItems(
    input.userId,
    'continue_projects',
    input.limit,
    input.locale,
    seen,
  );

  if (continueItems.length > 0) {
    return {
      recommendationType: 'NEXT_ACTIONS',
      items: continueItems,
    };
  }

  const suggestedItems = await loadRecommendationSectionItems(
    input.userId,
    'suggested_projects',
    input.limit,
    input.locale,
    seen,
  );
  if (suggestedItems.length > 0) {
    return {
      recommendationType: 'PROJECTS',
      items: suggestedItems,
    };
  }

  const savedItems = await loadRecommendationSectionItems(
    input.userId,
    'saved_projects',
    input.limit,
    input.locale,
    seen,
  );
  if (savedItems.length > 0) {
    return {
      recommendationType: 'PROJECTS',
      items: savedItems,
    };
  }

  if (input.preferNextActions) {
    return { recommendationType: 'NEXT_ACTIONS', items: [] };
  }

  return { recommendationType: 'PROJECTS', items: [] };
};

const resolveCategoryId = async (categoryText?: string): Promise<string | undefined> => {
  if (!categoryText) {
    return undefined;
  }

  const categories = await getCategories({
    type: 'MATERIAL',
    rootOnly: true,
    discoveryOnly: true,
  });
  const normalized = categoryText.trim().toLowerCase();
  const match = categories.find(
    (category) =>
      category.nameEn.toLowerCase().includes(normalized) ||
      category.nameAr.toLowerCase().includes(normalized),
  );

  return match?.id;
};

const toMaterialsQuery = async (
  input: ReturnType<typeof searchAvailableMaterialsInputSchema.parse>,
  context: AiToolExecutionContext,
  options?: { queryLimit?: number },
): Promise<MaterialsQuery> => {
  const limit = options?.queryLimit ?? Math.min(input.limit ?? 10, 10);
  const query: MaterialsQuery = {
    page: 1,
    limit,
    status: 'AVAILABLE',
    priceType: input.isFree === true ? 'FREE' : input.isFree === false ? 'PAID' : 'ANY',
    q: input.query,
    categoryId: input.categoryId,
    condition: input.condition as MaterialsQuery['condition'],
    city: input.city,
    area: input.area,
    pickupAllowed: input.pickupAllowed,
    deliveryAvailable: input.deliveryAllowed,
    sort: input.sort === 'price_asc' || input.sort === 'price_desc' ? 'newest' : input.sort ?? 'newest',
  };

  if (!query.categoryId && input.categoryText) {
    query.categoryId = await resolveCategoryId(input.categoryText);
  }

  if (input.nearLearner) {
    const coordinates = await requireLearnerCoordinates(context.authenticatedUserId);
    query.latitude = coordinates.latitude;
    query.longitude = coordinates.longitude;
    query.sort = 'nearest';
    if (input.maxDistanceKm) {
      // Repository distance filter uses viewer coordinates; maxDistanceKm applied post-filter.
    }
  }

  return query;
};

const filterByMaxPrice = <T extends { price?: number | null; isFree: boolean }>(
  items: T[],
  maxPrice?: number,
): T[] => {
  if (maxPrice == null) {
    return items;
  }

  return items.filter((item) => item.isFree || (item.price ?? Infinity) <= maxPrice);
};

export { filterByMaxPrice };

const resolveMaterialSearchFetchLimit = (input: {
  limit: number;
  maxPrice?: number;
  maxDistanceKm?: number;
  nearLearner?: boolean;
}): number => {
  const needsPostFilter =
    input.maxPrice != null ||
    input.maxDistanceKm != null ||
    input.nearLearner === true;

  return needsPostFilter ? Math.min(Math.max(input.limit * 10, 50), 100) : input.limit;
};

export { resolveMaterialSearchFetchLimit };

const filterByDistance = <T>(
  items: T[],
  maxDistanceKm?: number,
): T[] => {
  if (maxDistanceKm == null) {
    return items;
  }

  return items.filter((item) => {
    const record = item as {
      distanceKm?: number | null;
      approximateDistanceKm?: number | null;
    };
    const distance = record.distanceKm ?? record.approximateDistanceKm;
    return distance == null || distance <= maxDistanceKm;
  });
};

type OwnedMaterialsComponentRecord = {
  id: string;
  componentName: string;
  materialType: string;
  searchKeywords: unknown;
  alternativeKeywords: unknown;
  isRequired: boolean;
};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const isGeneralOwnedMaterialType = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === 'general' ||
    normalized === 'unspecified'
  );
};

const tokenizeForOwnedMaterialMatch = (value: string) =>
  normalizeOwnedMaterialForMatching(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .map((token) => (token.length > 4 && token.endsWith('s') ? token.slice(0, -1) : token));

const hasOwnedMaterialTokenOverlap = (left: string, right: string) => {
  const leftTokens = tokenizeForOwnedMaterialMatch(left);
  const rightTokens = tokenizeForOwnedMaterialMatch(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return false;
  }

  const [shorter, longer] =
    leftTokens.length <= rightTokens.length
      ? [leftTokens, rightTokens]
      : [rightTokens, leftTokens];

  return shorter.every((token) => longer.includes(token));
};

const resolveOwnedMaterialAliasKey = (value: string): string => {
  const normalized = normalizeOwnedMaterialForMatching(value);

  for (const group of ownedMaterialAliasGroups()) {
    const canonical = normalizeOwnedMaterialForMatching(group[0] ?? '');
    for (const alias of group) {
      const aliasNorm = normalizeOwnedMaterialForMatching(alias);
      if (
        normalized === aliasNorm ||
        hasOwnedMaterialTokenOverlap(normalized, aliasNorm)
      ) {
        return canonical;
      }
    }
  }

  return normalized;
};

const ownedMaterialMatchesTerm = (material: string, term: string): boolean => {
  const materialNorm = normalizeOwnedMaterialForMatching(material);
  const termNorm = normalizeOwnedMaterialForMatching(term);

  if (!materialNorm || !termNorm) {
    return false;
  }

  if (materialNorm === termNorm) {
    return true;
  }

  if (resolveOwnedMaterialAliasKey(material) === resolveOwnedMaterialAliasKey(term)) {
    return true;
  }

  if (hasOwnedMaterialTokenOverlap(materialNorm, termNorm)) {
    return true;
  }

  if (termNorm.length >= 4 && materialNorm.includes(termNorm)) {
    return true;
  }

  if (materialNorm.length >= 4 && termNorm.includes(materialNorm)) {
    return true;
  }

  return false;
};

const ownedComponentTerms = (component: OwnedMaterialsComponentRecord): string[] => {
  const terms = new Set<string>();
  terms.add(component.componentName);

  if (!isGeneralOwnedMaterialType(component.materialType)) {
    terms.add(component.materialType);
  }

  for (const keyword of [
    ...asStringArray(component.searchKeywords),
    ...asStringArray(component.alternativeKeywords),
  ]) {
    if (keyword.trim().length > 0) {
      terms.add(keyword);
    }
  }

  return [...terms];
};

const ownedComponentMatchesMaterials = (
  component: OwnedMaterialsComponentRecord,
  materials: string[],
): boolean =>
  materials.some((material) =>
    ownedComponentTerms(component).some((term) =>
      ownedMaterialMatchesTerm(material, term),
    ),
  );

const computeOwnedMaterialsReadinessPercent = (
  matchedCount: number,
  totalCount: number,
): number => {
  if (totalCount <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, Math.round((matchedCount / totalCount) * 100)),
  );
};

const buildOwnedMaterialsMatchExplanation = (
  title: string,
  readinessPercent: number,
  locale: AiLocale,
): string =>
  locale === 'ar'
    ? `${title} — تقدير تغطية المكونات: ${readinessPercent}%`
    : `${title} — estimated component coverage: ${readinessPercent}%`;

const normalizeProjectTitleKey = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

type ResolvedPublishedLearnerProject =
  | { kind: 'exact'; project: Awaited<ReturnType<typeof getLearningProjectById>> }
  | {
      kind: 'ambiguous';
      projects: Awaited<ReturnType<typeof getLearningProjects>>['items'];
      projectQuery: string;
      usedTokenFallback: boolean;
    };

type LearningProjectListItem = Awaited<
  ReturnType<typeof getLearningProjects>
>['items'][number];

const collectProjectEvidenceTokens = (project: LearningProjectListItem): Set<string> => {
  const tokens = new Set<string>();
  const tagLabels = (project.tags ?? []).map((tag) =>
    typeof tag === 'string' ? tag : tag.tag,
  );
  const parts = [
    project.title,
    project.shortDescription ?? '',
    ...tagLabels,
    project.category?.nameEn ?? '',
    project.category?.nameAr ?? '',
  ];

  for (const part of parts) {
    for (const token of tokenizeProjectQuery(part)) {
      tokens.add(token);
    }
  }

  return tokens;
};

const narrowToDominantProjectCandidates = (
  query: string,
  projects: LearningProjectListItem[],
): LearningProjectListItem[] => {
  if (projects.length <= 1) {
    return projects;
  }

  const queryTokens = tokenizeProjectQuery(query);
  const scored = projects
    .map((project) => ({
      project,
      evidence: scoreProjectQueryTokenEvidence(queryTokens, project),
    }))
    .filter(({ evidence }) => passesProjectQueryTokenThreshold(queryTokens, evidence))
    .sort((left, right) => {
      if (right.evidence.matchedTokens !== left.evidence.matchedTokens) {
        return right.evidence.matchedTokens - left.evidence.matchedTokens;
      }

      return left.project.title.localeCompare(right.project.title);
    });

  if (scored.length === 0) {
    return [];
  }

  const top = scored[0]!;
  const tied = scored.filter(
    (entry) => entry.evidence.matchedTokens === top.evidence.matchedTokens,
  );
  if (tied.length === 1 && top.evidence.matchedTokens >= 2) {
    return [top.project];
  }

  return tied.map((entry) => entry.project);
};

const scoreProjectQueryTokenEvidence = (
  queryTokens: string[],
  project: LearningProjectListItem,
): { matchedTokens: number; longestMatched: boolean } => {
  if (queryTokens.length === 0) {
    return { matchedTokens: 0, longestMatched: false };
  }

  const evidence = collectProjectEvidenceTokens(project);
  let matchedTokens = 0;
  for (const token of queryTokens) {
    if (evidence.has(token)) {
      matchedTokens += 1;
    }
  }

  const longestToken = [...queryTokens].sort((left, right) => right.length - left.length)[0]!;
  return {
    matchedTokens,
    longestMatched: evidence.has(longestToken),
  };
};

const passesProjectQueryTokenThreshold = (
  queryTokens: string[],
  evidence: { matchedTokens: number; longestMatched: boolean },
): boolean => {
  if (queryTokens.length === 0) {
    return false;
  }

  if (queryTokens.length === 1) {
    return evidence.matchedTokens >= 1;
  }

  const matchedRatio = evidence.matchedTokens / queryTokens.length;
  if (evidence.matchedTokens >= 2 && matchedRatio >= 0.5) {
    return true;
  }

  return evidence.longestMatched && matchedRatio >= 0.5;
};

const findBoundedTokenFallbackCandidates = async (
  query: string,
  viewer: ReturnType<typeof buildLearnerViewer>,
): Promise<LearningProjectListItem[]> => {
  const queryTokens = tokenizeProjectQuery(query);
  if (queryTokens.length === 0 || isGenericProjectBrowseQuery(query)) {
    return [];
  }

  const candidateMap = new Map<string, LearningProjectListItem>();
  for (const token of queryTokens) {
    if (token.length < 3) {
      continue;
    }

    const searchResult = await getLearningProjects(
      { page: 1, limit: 20, q: token },
      viewer,
    );
    for (const project of searchResult.items) {
      candidateMap.set(project.id, project);
    }
  }

  return narrowToDominantProjectCandidates(
    query,
    [...candidateMap.values()]
      .map((project) => ({
        project,
        evidence: scoreProjectQueryTokenEvidence(queryTokens, project),
      }))
      .filter(({ evidence }) => passesProjectQueryTokenThreshold(queryTokens, evidence))
      .sort((left, right) => {
        if (right.evidence.matchedTokens !== left.evidence.matchedTokens) {
          return right.evidence.matchedTokens - left.evidence.matchedTokens;
        }

        return left.project.title.localeCompare(right.project.title);
      })
      .slice(0, 5)
      .map((entry) => entry.project),
  );
};

const buildAmbiguousProjectChoiceMessage = (
  projectQuery: string,
  locale: AiLocale,
  usedTokenFallback: boolean,
): string => {
  if (usedTokenFallback) {
    return locale === 'ar'
      ? `وجدت عدة مشاريع حقيقية على ImpactLoop قد تطابق "${projectQuery}". أي مشروع تقصد؟`
      : `I found multiple real ImpactLoop projects that may match "${projectQuery}". Which one do you mean?`;
  }

  return locale === 'ar'
    ? 'وجدت أكثر من مشروع يطابق طلبك. اختر المشروع الذي تقصده:'
    : 'I found more than one matching project. Please choose the project you mean:';
};

const buildApproximateProjectBudgetConfirmationMessage = (
  projectTitle: string,
  locale: AiLocale,
): string =>
  locale === 'ar'
    ? `هل تقصد مشروع ${projectTitle}؟`
    : `Did you mean the ${projectTitle} project?`;

const buildProjectBudgetResolutionClarificationMessage = (
  projectQuery: string,
  projects: Array<{ title: string }>,
  locale: AiLocale,
  usedTokenFallback: boolean,
): string => {
  if (projects.length === 1) {
    return buildApproximateProjectBudgetConfirmationMessage(projects[0]!.title, locale);
  }

  return buildAmbiguousProjectChoiceMessage(projectQuery, locale, usedTokenFallback);
};

const resolvePublishedLearnerProjectQuery = async (
  input: { projectId?: string; projectQuery?: string },
  viewer: ReturnType<typeof buildLearnerViewer>,
): Promise<ResolvedPublishedLearnerProject> => {
  if (input.projectId) {
    const project = await getLearningProjectById(input.projectId, viewer);
    return { kind: 'exact', project };
  }

  const query = stripProjectBudgetCostPrefix(
    stripProjectBudgetCostSuffix(input.projectQuery!.trim()),
  );
  const normalizedQuery = normalizeProjectTitleKey(query);
  const searchResult = await getLearningProjects({ page: 1, limit: 8, q: query }, viewer);

  const exactMatches = searchResult.items.filter(
    (project) => normalizeProjectTitleKey(project.title) === normalizedQuery,
  );
  if (exactMatches.length >= 1) {
    return {
      kind: 'exact',
      project: await getLearningProjectById(exactMatches[0]!.id, viewer),
    };
  }

  if (searchResult.items.length === 0) {
    const fallbackCandidates = await findBoundedTokenFallbackCandidates(query, viewer);
    const narrowedFallback = narrowToDominantProjectCandidates(query, fallbackCandidates);
    if (narrowedFallback.length === 0) {
      throw new AppError(
        'No published learning project found.',
        404,
        'NO_MATCHING_RESULTS',
      );
    }

    return {
      kind: 'ambiguous',
      projects: narrowedFallback,
      projectQuery: query,
      usedTokenFallback: true,
    };
  }

  if (searchResult.items.length === 1) {
    const only = searchResult.items[0]!;
    if (normalizeProjectTitleKey(only.title) === normalizedQuery) {
      return {
        kind: 'exact',
        project: await getLearningProjectById(only.id, viewer),
      };
    }
    return {
      kind: 'ambiguous',
      projects: narrowToDominantProjectCandidates(query, [only]),
      projectQuery: query,
      usedTokenFallback: false,
    };
  }

  return {
    kind: 'ambiguous',
    projects: narrowToDominantProjectCandidates(
      query,
      searchResult.items.slice(0, 5),
    ),
    projectQuery: query,
    usedTokenFallback: false,
  };
};

const resolvePublishedProjectForMaterialAvailability = async (
  input: { projectId?: string; projectQuery?: string },
  viewer: ReturnType<typeof buildLearnerViewer>,
) => resolvePublishedLearnerProjectQuery(input, viewer);

const mapCandidateMaterialToCardInput = (material: {
  id: string;
  title: string;
  condition: string | null;
  isFree: boolean;
  price: number | null;
  currency: string | null;
  category: { id: string; nameEn: string; nameAr: string };
  city?: string | null;
  area?: string | null;
  imageUrl: string | null;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
}) => ({
  id: material.id,
  title: material.title,
  condition: material.condition,
  isFree: material.isFree,
  price: material.price,
  currency: material.currency,
  category: material.category,
  location: { city: material.city ?? null, area: material.area ?? null },
  imageUrl: material.imageUrl,
  pickupAllowed: material.pickupAllowed,
  deliveryAllowed: material.deliveryAllowed,
});

const matchProjectsByOwnedMaterials = async (
  input: ReturnType<typeof matchProjectsByOwnedMaterialsInputSchema.parse>,
  locale: AiLocale,
) => {
  const materials = [...new Set(input.materials.map((material) => material.trim()))].filter(
    (material) => material.length > 0,
  );

  if (materials.length === 0) {
    throw new AppError(
      'Tell me which materials you have.',
      400,
      'AI_ROUTE_UNCLEAR',
    );
  }

  const limit = Math.min(input.limit ?? 10, 10);
  const projects = await prisma.learningProject.findMany({
    where: {
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
      category: {
        isActive: true,
        categoryType: {
          in: ['PROJECT', 'BOTH'],
        },
        ...(input.category
          ? {
              OR: [
                {
                  nameEn: {
                    contains: input.category,
                    mode: 'insensitive',
                  },
                },
                {
                  nameAr: {
                    contains: input.category,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      },
      ...(input.difficulty ? { difficulty: input.difficulty } : {}),
      requiredComponents: {
        some: {
          isRequired: true,
        },
      },
    },
    include: {
      category: {
        select: {
          nameEn: true,
          nameAr: true,
        },
      },
      requiredComponents: {
        where: {
          isRequired: true,
        },
        select: {
          id: true,
          componentName: true,
          materialType: true,
          searchKeywords: true,
          alternativeKeywords: true,
          isRequired: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  const matches = projects
    .map((project) => {
      const requiredComponents = project.requiredComponents;
      const totalRequired = requiredComponents.length;
      if (totalRequired === 0) {
        return null;
      }

      const matchedComponents = requiredComponents.filter((component) =>
        ownedComponentMatchesMaterials(component, materials),
      );
      if (matchedComponents.length === 0) {
        return null;
      }

      const matchedNames = matchedComponents.map(
        (component) => component.componentName,
      );
      const matchedIds = new Set(matchedComponents.map((component) => component.id));
      const missingNames = requiredComponents
        .filter((component) => !matchedIds.has(component.id))
        .map((component) => component.componentName);
      const readinessPercent = computeOwnedMaterialsReadinessPercent(
        matchedComponents.length,
        totalRequired,
      );

      return {
        project,
        readinessPercent,
        matchedNames,
        missingNames,
        matchedCount: matchedComponents.length,
        totalRequired,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry != null)
    .sort((left, right) => {
      if (right.readinessPercent !== left.readinessPercent) {
        return right.readinessPercent - left.readinessPercent;
      }
      if (right.matchedCount !== left.matchedCount) {
        return right.matchedCount - left.matchedCount;
      }
      return left.project.title.localeCompare(right.project.title);
    })
    .slice(0, limit);

  if (matches.length === 0) {
    throw new AppError(
      'No matching projects found.',
      404,
      'NO_MATCHING_RESULTS',
    );
  }

  return {
    block: {
      type: 'project_results' as const,
      items: matches.map((match) => ({
        ...mapProjectToCard(
          {
            id: match.project.id,
            title: match.project.title,
            coverImageUrl: match.project.coverImageUrl,
            difficulty: match.project.difficulty,
            estimatedDurationMinutes: match.project.estimatedDurationMinutes,
          },
          locale,
        ),
        categoryLabel:
          locale === 'ar'
            ? match.project.category.nameAr
            : match.project.category.nameEn,
        readinessPercent: match.readinessPercent,
        matchedComponentCount: match.matchedCount,
        totalRequiredComponentCount: match.totalRequired,
        matchedComponents: match.matchedNames,
        missingComponents: match.missingNames,
        matchExplanation: buildOwnedMaterialsMatchExplanation(
          match.project.title,
          match.readinessPercent,
          locale,
        ),
      })),
    },
    count: matches.length,
  };
};

const mapLearningProjectsQuery = (
  input: ReturnType<typeof searchLearningProjectsInputSchema.parse>,
): LearningProjectsQuery => ({
  page: 1,
  limit: Math.min(input.limit ?? 10, 10),
  q: input.query,
  difficulty: input.difficulty,
  tag: input.interests?.[0] ?? input.category,
});

const formatBudgetSearchSummary = (
  estimate: ProjectMaterialBudgetEstimate,
  locale: AiLocale,
): string => {
  const coverage = `${estimate.pricedComponentCount}/${estimate.requiredComponentCount}`;
  if (locale === 'ar') {
    return `${estimate.estimatedSubtotalNis} شيكل · تغطية ${coverage}`;
  }
  return `${estimate.estimatedSubtotalNis} NIS · ${coverage} covered`;
};

const mapBudgetSearchProjectCard = (
  estimate: ProjectMaterialBudgetEstimate,
  locale: AiLocale,
) => ({
  ...mapProjectToCard(
    {
      id: estimate.projectId,
      title: estimate.projectTitle,
      coverImageUrl: estimate.projectImageUrl,
      difficulty: estimate.difficulty ?? undefined,
      estimatedDurationMinutes: null,
    },
    locale,
  ),
  categoryLabel: estimate.categoryLabel ?? undefined,
  summary: formatBudgetSearchSummary(estimate, locale),
  matchedComponentCount: estimate.pricedComponentCount,
  totalRequiredComponentCount: estimate.requiredComponentCount,
  missingComponents: estimate.components
    .filter((line) => line.status === 'NO_AVAILABLE_MATCH')
    .map((line) => line.componentName),
});

export const executeLearnerAgentTool = async (
  toolName: string,
  rawInput: unknown,
  context: AiToolExecutionContext,
): Promise<unknown> => {
  const viewer = buildLearnerViewer(context);
  const locale = context.locale;

  switch (toolName) {
    case 'get_learner_context': {
      const snapshot = await loadLearnerAgentContext(context.authenticatedUserId);
      return snapshot;
    }

    case 'search_available_materials': {
      const parsedInput = searchAvailableMaterialsInputSchema.parse(rawInput ?? {});
      const input = {
        ...parsedInput,
        query: normalizeMaterialItemQuery(parsedInput.query),
        categoryText: normalizeMaterialCategoryText(parsedInput.categoryText),
      };
      if (isMaterialSearchNoiseQuery(input.query)) {
        delete input.query;
      }

      const limit = Math.min(input.limit ?? 10, 10);
      const fetchLimit = resolveMaterialSearchFetchLimit({
        limit,
        maxPrice: input.maxPrice,
        maxDistanceKm: input.maxDistanceKm,
        nearLearner: input.nearLearner,
      });
      const query = await toMaterialsQuery(input, context, { queryLimit: fetchLimit });
      const result = await getMaterials(query, viewer);
      let items = [...result.items].filter(
        (item) => !shouldHideE2eFixtureTitle(item.title),
      );
      items = filterByMaxPrice(items, input.maxPrice);
      items = filterByDistance(items, input.maxDistanceKm);
      items = items.slice(0, limit);

      if (items.length === 0) {
        throw new AppError('No matching materials found.', 404, 'NO_MATCHING_RESULTS');
      }

      return {
        block: toMaterialResultsBlock(items, locale),
        count: items.length,
      };
    }

    case 'get_material_details': {
      const input = materialIdInputSchema.parse(rawInput);
      try {
        const material = await getMaterialById(input.materialId, viewer);
        return { block: toMaterialDetailsBlock(material, locale) };
      } catch (error) {
        if (error instanceof AppError && error.code === 'NOT_FOUND') {
          throw new AppError('Material not found.', 404, 'MATERIAL_NOT_FOUND');
        }
        throw error;
      }
    }

    case 'search_learning_projects': {
      const input = searchLearningProjectsInputSchema.parse(rawInput ?? {});
      const explicitQuery = input.query?.trim();

      if (explicitQuery && explicitQuery.length >= 2) {
        const resolved = await resolvePublishedLearnerProjectQuery(
          { projectQuery: explicitQuery },
          viewer,
        );

        if (resolved.kind === 'exact') {
          return {
            block: toProjectResultsBlock([resolved.project], locale),
            count: 1,
          };
        }

        return {
          blocks: [
            {
              type: 'text' as const,
              text: buildAmbiguousProjectChoiceMessage(
                explicitQuery,
                locale,
                resolved.usedTokenFallback,
              ),
              purpose: 'clarification' as const,
            },
            toProjectResultsBlock(resolved.projects, locale),
          ],
          count: resolved.projects.length,
        };
      }

      const limit = Math.min(input.limit ?? 10, 10);
      const result = await getLearningProjects(mapLearningProjectsQuery(input), viewer);
      const items = result.items.slice(0, limit);

      if (items.length === 0) {
        throw new AppError('No matching projects found.', 404, 'NO_MATCHING_RESULTS');
      }

      return {
        block: toProjectResultsBlock(items, locale),
        count: items.length,
      };
    }

    case 'match_projects_by_owned_materials': {
      const input = matchProjectsByOwnedMaterialsInputSchema.parse(rawInput ?? {});
      return matchProjectsByOwnedMaterials(input, locale);
    }

    case 'get_learning_project_details': {
      const input = projectIdInputSchema.parse(rawInput);
      try {
        const project = await getLearningProjectById(input.projectId, viewer);
        return { block: toProjectDetailsBlock(project, locale) };
      } catch (error) {
        if (error instanceof AppError && error.code === 'NOT_FOUND') {
          throw new AppError('Project not found.', 404, 'PROJECT_NOT_FOUND');
        }
        throw error;
      }
    }

    case 'get_project_required_components': {
      const input = projectIdInputSchema.parse(rawInput);
      const project = await getLearningProjectById(input.projectId, viewer);
      if (project.requiredComponents.length === 0) {
        throw new AppError(
          'This project has no required components listed.',
          404,
          'NO_MATCHING_RESULTS',
        );
      }

      return {
        block: toComponentListBlock(
          {
            id: project.id,
            title: project.title,
            coverImageUrl: project.coverImageUrl,
          },
          project.requiredComponents.map((component) => ({
            id: component.id,
            componentName: component.componentName,
            quantity: component.quantity,
            unit: component.unit,
            isRequired: component.isRequired,
            alternativesAllowed: component.canBeSubstituted,
            category: null,
          })),
          locale,
        ),
      };
    }

    case 'get_saved_projects': {
      const result = await getSavedLearningProjects(
        { page: 1, limit: 10 },
        viewer,
      );

      if (result.items.length === 0) {
        throw new AppError('No saved projects found.', 404, 'NO_MATCHING_RESULTS');
      }

      return {
        block: toProjectResultsBlock(
          result.items.map((project) => ({ ...project, isSaved: true })),
          locale,
        ),
        count: result.items.length,
      };
    }

    case 'get_active_project_builds': {
      const builds = await listActiveProjectBuildsForLearner(
        context.authenticatedUserId,
      );

      if (builds.length === 0) {
        throw new AppError('No active project builds found.', 404, 'NO_MATCHING_RESULTS');
      }

      const projects = await Promise.all(
        builds.map((build) => getLearningProjectById(build.projectId, viewer)),
      );

      return {
        block: toProjectResultsBlock(
          projects.map((project, index) => ({
            ...project,
            activeBuildId: builds[index]!.id,
          })),
          locale,
        ),
        count: builds.length,
      };
    }

    case 'get_build_checklist': {
      const input = zBuildIdInput(rawInput);
      const build = await getOwnedProjectBuildByBuildId(
        input.buildId,
        context.authenticatedUserId,
      );
      if (!build) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }
      return { block: toBuildChecklistBlock(build) };
    }

    case 'analyze_build_gaps': {
      const input = zBuildIdInput(rawInput);
      const build = await getOwnedProjectBuildByBuildId(
        input.buildId,
        context.authenticatedUserId,
      );
      if (!build) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }
      const missing = build.items.filter((item) => !item.isReadyForBuild);

      return {
        block: toBuildChecklistBlock(build),
        satisfiedCount: build.progress.ready,
        missingComponents: missing.map((item) => ({
          componentId: item.requiredComponentId,
          name: item.component.componentName,
          status: item.status,
          readinessLabel: item.readinessLabel,
        })),
      };
    }

    case 'find_materials_for_component': {
      const input = componentIdInputSchema.parse(rawInput);
      const buildId =
        input.buildId ?? (await resolveLatestBuildId(context.conversationId));
      if (!buildId) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }

      const build = await getOwnedProjectBuildByBuildId(
        buildId,
        context.authenticatedUserId,
      );
      if (!build) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }
      const item = build.items.find(
        (entry) =>
          entry.id === input.componentId ||
          entry.requiredComponentId === input.componentId,
      );

      if (!item) {
        throw new AppError('Component not found.', 404, 'COMPONENT_NOT_FOUND');
      }

      const candidates = await getBuildItemMaterialCandidatesById(
        build.projectId,
        context.authenticatedUserId,
        item.id,
      );

      let materials = [...candidates.items.map((candidate) => ({
        id: candidate.id,
        title: candidate.title,
        condition: candidate.condition,
        isFree: candidate.isFree,
        price: candidate.price,
        currency: candidate.currency,
        category: candidate.category,
        location: { city: candidate.city, area: candidate.area },
        imageUrl: candidate.imageUrl,
        pickupAllowed: candidate.pickupAllowed,
        deliveryAllowed: candidate.deliveryAllowed,
      }))];

      materials = filterByMaxPrice(materials, input.maxPrice);
      materials = filterByDistance(materials, input.maxDistanceKm);
      if (input.isFree) {
        materials = materials.filter((material) => material.isFree);
      }

      if (materials.length === 0) {
        throw new AppError('No matching materials found.', 404, 'NO_MATCHING_RESULTS');
      }

      return {
        block: toComponentMatchesBlock(
          [
            {
              componentId: item.requiredComponentId,
              componentName: item.component.componentName,
              materials: materials.slice(0, input.limit ?? 5),
            },
          ],
          locale,
          build.id,
        ),
      };
    }

    case 'find_materials_for_project': {
      const input = findMaterialsForProjectInputSchema.parse(rawInput);
      const build =
        input.buildId != null
          ? await getOwnedProjectBuildByBuildId(input.buildId, context.authenticatedUserId)
          : await learningProjectsRepository
              .findProjectBuild(input.projectId, context.authenticatedUserId)
              .then((record) => (record ? getOwnedProjectBuildByBuildId(record.id, context.authenticatedUserId) : null));

      if (!build) {
        throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
      }

      const project = await getLearningProjectById(input.projectId, viewer);
      const targetItems = input.onlyMissing
        ? build.items.filter((item) => !item.isReadyForBuild)
        : build.items;

      if (targetItems.length === 0) {
        throw new AppError('No missing components found.', 404, 'NO_MATCHING_RESULTS');
      }

      const groups = [];
      for (const item of targetItems.slice(0, 8)) {
        const candidates = await getBuildItemMaterialCandidatesById(
          project.id,
          context.authenticatedUserId,
          item.id,
        );

        let materials = [...candidates.items];
        if (input.isFree) {
          materials = materials.filter((material) => material.isFree);
        }
        materials = filterByDistance(materials, input.maxDistanceKm);

        if (materials.length === 0) {
          continue;
        }

        groups.push({
          componentId: item.requiredComponentId,
          componentName: item.component.componentName,
          materials: materials.slice(0, input.limitPerComponent ?? 3).map((material) => ({
            id: material.id,
            title: material.title,
            condition: material.condition,
            isFree: material.isFree,
            price: material.price,
            currency: material.currency,
            category: material.category,
            location: { city: material.city, area: material.area },
            imageUrl: material.imageUrl,
            pickupAllowed: material.pickupAllowed,
            deliveryAllowed: material.deliveryAllowed,
          })),
        });
      }

      if (groups.length === 0) {
        throw new AppError('No matching materials found.', 404, 'NO_MATCHING_RESULTS');
      }

      return {
        block: toComponentMatchesBlock(groups, locale, build?.id),
      };
    }

    case 'match_available_materials_for_project': {
      const input = matchAvailableMaterialsForProjectInputSchema.parse(rawInput);
      const resolved = await resolvePublishedProjectForMaterialAvailability(
        input,
        viewer,
      );

      if (resolved.kind === 'ambiguous') {
        return {
          blocks: [
            {
              type: 'text' as const,
              text: buildAmbiguousProjectChoiceMessage(
                input.projectQuery ?? resolved.projectQuery,
                locale,
                resolved.usedTokenFallback,
              ),
              purpose: 'clarification' as const,
            },
            toProjectResultsBlock(resolved.projects, locale),
          ],
        };
      }

      const project = await getLearningProjectById(resolved.project.id, viewer);
      const requiredComponents = project.requiredComponents.filter(
        (component) => component.isRequired !== false,
      );

      if (requiredComponents.length === 0) {
        return {
          blocks: [
            {
              type: 'text' as const,
              text:
                locale === 'ar'
                  ? `مشروع ${project.title} لا يتضمن مكونات مطلوبة مسجّلة حالياً على ImpactLoop.`
                  : `${project.title} does not list any required components on ImpactLoop yet.`,
              purpose: 'answer' as const,
            },
            toProjectResultsBlock([project], locale),
          ],
        };
      }

      const limitPerComponent = input.limitPerComponent ?? 3;
      const groups: Array<{
        componentId: string;
        componentName: string;
        materials: ReturnType<typeof mapCandidateMaterialToCardInput>[];
      }> = [];

      for (const component of requiredComponents.slice(0, 12)) {
        const candidates = await getRequiredComponentMaterialCandidates({
          projectId: project.id,
          learnerId: context.authenticatedUserId,
          componentId: component.id,
        });

        const seen = new Set<string>();
        const materials: ReturnType<typeof mapCandidateMaterialToCardInput>[] = [];
        for (const material of candidates.items) {
          if (seen.has(material.id)) {
            continue;
          }
          seen.add(material.id);
          materials.push(
            mapCandidateMaterialToCardInput({
              ...material,
              city: material.city,
              area: material.area,
            }),
          );
          if (materials.length >= limitPerComponent) {
            break;
          }
        }

        groups.push({
          componentId: component.id,
          componentName: component.componentName,
          materials,
        });
      }

      return {
        blocks: [
          toProjectResultsBlock([project], locale),
          toComponentMatchesBlock(groups, locale),
        ],
      };
    }

    case 'estimate_project_material_budget': {
      const input = matchAvailableMaterialsForProjectInputSchema.parse(rawInput);
      const resolved = await resolvePublishedProjectForMaterialAvailability(
        input,
        viewer,
      );

      if (resolved.kind === 'ambiguous') {
        return {
          blocks: [
            {
              type: 'text' as const,
              text: buildProjectBudgetResolutionClarificationMessage(
                input.projectQuery ?? resolved.projectQuery,
                resolved.projects,
                locale,
                resolved.usedTokenFallback,
              ),
              purpose: 'clarification' as const,
            },
            toProjectResultsBlock(resolved.projects, locale),
          ],
        };
      }

      const project = await getLearningProjectById(resolved.project.id, viewer);
      const requiredComponents = project.requiredComponents.filter(
        (component) => component.isRequired !== false,
      );

      if (requiredComponents.length === 0) {
        return {
          blocks: [
            {
              type: 'text' as const,
              text:
                locale === 'ar'
                  ? `مشروع ${project.title} لا يتضمن مكونات مطلوبة مسجّلة حالياً على ImpactLoop، لذلك لا يمكن تقدير تكلفة المواد المتوفرة له.`
                  : `${project.title} does not list any required components on ImpactLoop yet, so an available-material budget cannot be estimated.`,
              purpose: 'answer' as const,
            },
            toProjectResultsBlock([project], locale),
          ],
        };
      }

      const estimate = await estimateProjectMaterialBudget({
        projectId: project.id,
        learnerId: context.authenticatedUserId,
        candidateLimitPerComponent: input.limitPerComponent ?? 5,
      });

      return {
        blocks: [
          toProjectResultsBlock([project], locale),
          toProjectBudgetEstimateBlock(estimate, locale),
        ],
      };
    }

    case 'find_projects_within_budget': {
      const input = findProjectsWithinBudgetInputSchema.parse(rawInput);
      const result = await findProjectsWithinBudget({
        learnerId: context.authenticatedUserId,
        ...input,
      });

      const blocks: AiContentBlock[] = [];
      const completeItems = result.complete.map((entry) =>
        mapBudgetSearchProjectCard(entry.estimate, locale),
      );
      const partialItems = result.partial.map((entry) =>
        mapBudgetSearchProjectCard(entry.estimate, locale),
      );
      const boundLabel =
        input.comparisonMode === 'LT'
          ? locale === 'ar'
            ? `أقل من ${input.maxBudgetNis} شيكل`
            : `under ${input.maxBudgetNis} NIS`
          : locale === 'ar'
            ? `بحد أقصى ${input.maxBudgetNis} شيكل`
            : `up to ${input.maxBudgetNis} NIS`;

      if (completeItems.length === 0 && partialItems.length === 0) {
        blocks.push({
          type: 'text',
          text:
            locale === 'ar'
              ? `لم أجد مشاريع منشورة على ImpactLoop تطابق ميزانيتك (${boundLabel}) ضمن مجموعة المرشحين الحالية.`
              : `I did not find published ImpactLoop projects matching your budget (${boundLabel}) in the current candidate pool.`,
          purpose: 'answer',
        });
      } else {
        if (completeItems.length > 0) {
          blocks.push({
            type: 'text',
            text:
              locale === 'ar'
                ? 'مشاريع مغطاة بالكامل ضمن ميزانيتك'
                : 'Fully covered projects within your budget',
            purpose: 'answer',
          });
          blocks.push({
            type: 'project_results',
            items: completeItems,
          });
        }
        if (partialItems.length > 0) {
          blocks.push({
            type: 'text',
            text:
              locale === 'ar'
                ? 'تقديرات جزئية ضمن الميزانية — المكونات الناقصة غير مشمولة'
                : 'Partial estimates under budget — missing components are not included',
            purpose: 'answer',
          });
          blocks.push({
            type: 'project_results',
            items: partialItems,
          });
        }
      }

      return {
        blocks,
        metrics: result.metrics,
        count: completeItems.length + partialItems.length,
      };
    }

    case 'compare_materials': {
      const input = compareMaterialIdsInputSchema.parse(rawInput);
      const items = [];

      for (const materialId of input.materialIds) {
        const material = await getMaterialById(materialId, viewer);
        const card = mapMaterialToCard(material, locale);
        items.push({
          id: material.id,
          title: material.title,
          facts: [
            card.priceLabel,
            card.condition ? `Condition: ${card.condition}` : 'Condition: n/a',
            card.locationLabel ? `Location: ${card.locationLabel}` : 'Location: n/a',
            card.quantityLabel ? `Quantity: ${card.quantityLabel}` : 'Quantity: n/a',
            card.distanceKm != null ? `Distance: ${card.distanceKm.toFixed(1)} km` : 'Distance: n/a',
          ],
        });
      }

      return { block: toComparisonBlock('MATERIAL', items) };
    }

    case 'compare_projects': {
      const input = compareProjectIdsInputSchema.parse(rawInput);
      const items = [];

      for (const projectId of input.projectIds) {
        const project = await getLearningProjectById(projectId, viewer);
        const card = mapProjectToCard(project, locale);
        items.push({
          id: project.id,
          title: project.title,
          facts: [
            card.difficulty ? `Difficulty: ${card.difficulty}` : 'Difficulty: n/a',
            card.estimatedTimeLabel
              ? `Estimated time: ${card.estimatedTimeLabel}`
              : 'Estimated time: n/a',
            `Components: ${project.requiredComponents.length}`,
            `Steps: ${project.steps.length}`,
          ],
        });
      }

      return { block: toComparisonBlock('PROJECT', items) };
    }

    case 'get_personalized_recommendations': {
      const input = personalizedRecommendationsInputSchema.parse(rawInput ?? {});
      const limit = input.limit ?? 6;

      if (input.type === 'MATERIALS') {
        const materialItems = await loadRecommendationSectionItems(
          context.authenticatedUserId,
          'suggested_materials',
          limit,
          locale,
        );
        const mapped = dedupeMappedMaterialRecommendations(materialItems, limit);
        if (mapped.length === 0) {
          throw new AppError('No recommendations available.', 404, 'NO_MATCHING_RESULTS');
        }
        return {
          block: toRecommendationsBlock('MATERIALS', mapped),
        };
      }

      if (input.type === 'NEXT_ACTIONS') {
        const primary = await resolvePrimaryProjectRecommendations({
          userId: context.authenticatedUserId,
          limit,
          locale,
          preferNextActions: true,
        });
        if (primary.items.length === 0) {
          throw new AppError('No recommendations available.', 404, 'NO_MATCHING_RESULTS');
        }
        return {
          block: toRecommendationsBlock(primary.recommendationType, primary.items),
        };
      }

      if (input.type === 'MIXED') {
        const primary = await resolvePrimaryProjectRecommendations({
          userId: context.authenticatedUserId,
          limit: 3,
          locale,
        });
        const materialItems = await loadRecommendationSectionItems(
          context.authenticatedUserId,
          'suggested_materials',
          6,
          locale,
        );
        const materials = dedupeMappedMaterialRecommendations(materialItems, 3);
        const blocks: AiContentBlock[] = [];

        if (primary.items.length > 0) {
          blocks.push(
            toRecommendationsBlock(primary.recommendationType, primary.items),
          );
        }
        if (materials.length > 0) {
          blocks.push(toRecommendationsBlock('MATERIALS', materials));
        }

        if (blocks.length === 0) {
          throw new AppError('No recommendations available.', 404, 'NO_MATCHING_RESULTS');
        }

        return blocks.length === 1 ? { block: blocks[0]! } : { blocks };
      }

      const primary = await resolvePrimaryProjectRecommendations({
        userId: context.authenticatedUserId,
        limit,
        locale,
      });
      if (primary.items.length === 0) {
        throw new AppError('No recommendations available.', 404, 'NO_MATCHING_RESULTS');
      }

      const blocks: AiContentBlock[] = [
        toRecommendationsBlock(primary.recommendationType, primary.items),
      ];

      const relatedMaterials = dedupeMappedMaterialRecommendations(
        await loadRecommendationSectionItems(
          context.authenticatedUserId,
          'materials_for_saved_projects',
          6,
          locale,
        ),
        3,
      );
      if (relatedMaterials.length > 0) {
        blocks.push(toRecommendationsBlock('MATERIALS', relatedMaterials));
      }

      return blocks.length === 1 ? { block: blocks[0]! } : { blocks };
    }

    default:
      throw new AppError(
        `Unsupported tool: ${toolName}`,
        501,
        'AI_TOOL_EXECUTION_FAILED',
      );
  }
};

const zBuildIdInput = (rawInput: unknown) => {
  const parsed = rawInput as { buildId?: string };
  if (!parsed?.buildId) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }
  return { buildId: parsed.buildId };
};
