import type { AiAgentRouteType } from './ai-agent.types.js';

const KEEP_PLATFORM_WHEN_LINKED_BUILD = new Set<string>([
  'ACTION_REQUEST',
  'OUT_OF_SCOPE',
  'DANGEROUS_REQUEST',
  'PLATFORM_GUIDANCE',
  'CONVERSATIONAL_STATIC',
]);

const MARKETPLACE_CATALOG_REQUEST =
  /(ورجيني|وريني|اعرض|لاقيلي|browse|show me|search|find).{0,40}(مواد|materials).{0,40}(متاحة|متوفرة|available|قريبة|near|مجاني|free|المنصة|marketplace)/i;

const EXPLICIT_MISSING_MATERIAL_SEARCH =
  /(لاقيلي مواد للمكونات الناقصه|دورلي على كل المواد|find materials for (?:all )?missing|show matches for)/i;

export const isExplicitMarketplaceCatalogRequest = (userMessage: string): boolean =>
  MARKETPLACE_CATALOG_REQUEST.test(userMessage) ||
  EXPLICIT_MISSING_MATERIAL_SEARCH.test(userMessage);

export const preferLinkedBuildGuideLearning = (input: {
  hasLinkedBuild: boolean;
  route: string;
  userMessage: string;
}): boolean => {
  if (!input.hasLinkedBuild) {
    return false;
  }

  if (KEEP_PLATFORM_WHEN_LINKED_BUILD.has(input.route)) {
    return false;
  }

  if (
    (input.route === 'MATERIAL_SEARCH' ||
      input.route === 'COMPONENT_MATERIAL_MATCHING' ||
      input.route === 'PROJECT_MATERIAL_MATCHING') &&
    isExplicitMarketplaceCatalogRequest(input.userMessage)
  ) {
    return false;
  }

  return true;
};

export const applyLinkedBuildGuideLearningOverride = <
  T extends {
    route: AiAgentRouteType | string;
    toolName?: string | null;
    toolInput?: Record<string, unknown>;
    semanticUnderstandingRoute?: string;
    diagnostics?: {
      validatedRoute?: string;
      toolName?: string | null;
      [key: string]: unknown;
    };
  },
>(
  plan: T,
  input: { hasLinkedBuild: boolean; userMessage: string },
): T => {
  if (
    !preferLinkedBuildGuideLearning({
      hasLinkedBuild: input.hasLinkedBuild,
      route: plan.route,
      userMessage: input.userMessage,
    })
  ) {
    return plan;
  }

  return {
    ...plan,
    route: 'GENERAL_LEARNING',
    toolName: null,
    toolInput: {},
    semanticUnderstandingRoute: 'GENERAL_LEARNING',
    diagnostics: plan.diagnostics
      ? {
          ...plan.diagnostics,
          validatedRoute: 'GENERAL_LEARNING',
          toolName: null,
        }
      : plan.diagnostics,
  };
};
