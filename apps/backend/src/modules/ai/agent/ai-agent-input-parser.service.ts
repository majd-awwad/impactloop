import type { AiAgentRouteType } from './ai-agent.types.js';
import type {
  compareMaterialIdsInputSchema,
  compareProjectIdsInputSchema,
  findMaterialsForProjectInputSchema,
  personalizedRecommendationsInputSchema,
  searchAvailableMaterialsInputSchema,
  searchLearningProjectsInputSchema,
} from './ai-tool.types.js';
import {
  classifyRecommendationSubtype,
  extractProjectTitleQuery,
  mergeMaterialSearchPlan,
  parseOwnedMaterialsProjectInput,
} from './ai-agent-filter-extractor.service.js';
import { extractRequestedResultCount } from './ai-agent-number-parser.service.js';
import type { z } from 'zod';

const includesAny = (text: string, terms: string[]): boolean =>
  terms.some((term) => text.includes(term));

export const parseMaterialSearchInput = (
  userMessage: string,
): z.infer<typeof searchAvailableMaterialsInputSchema> =>
  mergeMaterialSearchPlan(userMessage);

export const parseProjectSearchInput = (
  userMessage: string,
): z.infer<typeof searchLearningProjectsInputSchema> => {
  const normalized = userMessage.toLowerCase();
  const requestedCount = extractRequestedResultCount(userMessage);
  const explicitTitle = extractProjectTitleQuery(userMessage);
  const input: z.infer<typeof searchLearningProjectsInputSchema> = {
    limit: requestedCount ?? (explicitTitle ? 5 : 10),
  };

  if (explicitTitle) {
    input.query = explicitTitle;
    return input;
  }

  if (includesAny(normalized, ['beginner', 'مبتدئ', 'مبتدئين'])) {
    input.difficulty = 'BEGINNER';
  } else if (includesAny(normalized, ['intermediate', 'متوسط'])) {
    input.difficulty = 'INTERMEDIATE';
  } else if (includesAny(normalized, ['advanced', 'متقدم'])) {
    input.difficulty = 'ADVANCED';
  }

  if (includesAny(normalized, ['arduino', 'اردوينو', 'أردوينو'])) {
    input.interests = ['arduino'];
    input.query = 'Arduino';
  }

  if (includesAny(normalized, ['robot', 'robotics', 'روبوت'])) {
    input.query = input.query ?? 'robot';
  }

  return input;
};

export const parseProjectComponentsInput = (userMessage: string) => {
  const projectQuery = extractProjectTitleQuery(userMessage);
  return {
    projectQuery,
  };
};

export const parseRecommendationInput = (
  userMessage: string,
): z.infer<typeof personalizedRecommendationsInputSchema> => {
  const subtype = classifyRecommendationSubtype(userMessage);
  if (subtype === 'MIXED') {
    return { type: 'MIXED', limit: 6 };
  }
  if (subtype === 'NEXT_ACTIONS') {
    return { type: 'NEXT_ACTIONS', limit: 6 };
  }
  if (subtype === 'PROJECTS') {
    return { type: 'PROJECTS', limit: 6 };
  }
  return { type: 'MATERIALS', limit: 6 };
};

export const buildToolInputForRoute = (
  route: AiAgentRouteType,
  userMessage: string,
): Record<string, unknown> => {
  switch (route) {
    case 'MATERIAL_SEARCH':
      return parseMaterialSearchInput(userMessage);
    case 'PROJECT_SEARCH':
      return parseProjectSearchInput(userMessage);
    case 'PROJECT_COMPONENTS':
      return parseProjectComponentsInput(userMessage);
    case 'PERSONALIZED_RECOMMENDATION':
      return parseRecommendationInput(userMessage);
    case 'OWNED_MATERIALS_PROJECT_MATCH':
      return parseOwnedMaterialsProjectInput(userMessage);
    case 'PROJECT_MATERIAL_AVAILABILITY': {
      const projectQuery = extractProjectTitleQuery(userMessage);
      return projectQuery
        ? { projectQuery, limitPerComponent: 3 }
        : {};
    }
    case 'SAVED_PROJECTS':
    case 'ACTIVE_PROJECT_BUILDS':
      return {};
    default:
      return {};
  }
};

export type ParsedComparisonRequest =
  | z.infer<typeof compareMaterialIdsInputSchema>
  | z.infer<typeof compareProjectIdsInputSchema>;

export const parseComparisonFromContext = (input: {
  subject: 'MATERIAL' | 'PROJECT';
  resolvedIds: string[];
}): ParsedComparisonRequest | null => {
  if (input.resolvedIds.length < 2) {
    return null;
  }

  const ids = input.resolvedIds.slice(0, 4);

  if (input.subject === 'MATERIAL') {
    return { materialIds: ids };
  }

  return { projectIds: ids };
};

export const parseFindMaterialsForProjectInput = (input: {
  projectId: string;
  buildId?: string;
  onlyMissing?: boolean;
  nearLearner?: boolean;
}): z.infer<typeof findMaterialsForProjectInputSchema> => ({
  projectId: input.projectId,
  buildId: input.buildId,
  onlyMissing: input.onlyMissing ?? true,
  nearLearner: input.nearLearner,
  limitPerComponent: 3,
});
