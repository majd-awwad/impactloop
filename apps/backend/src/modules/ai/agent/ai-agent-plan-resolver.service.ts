import { logger } from '../../../observability/logger.js';
import type { SafeLogValue } from '../../../observability/log-types.js';
import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import type { AiLocale } from '../ai.types.js';
import {
  AI_AGENT_PLATFORM_ROUTES,
  type AiAgentRouteDecision,
  type AiAgentRouteType,
} from './ai-agent.types.js';
import {
  detectBuildGapIntent,
  detectComponentMaterialMatchingIntent,
  detectComparisonFollowUpIntent,
  detectEducationalLearningIntent,
  detectActiveProjectBuildsIntent,
  detectBareOwnedMaterialsPossession,
  detectMaterialDetailsIntent,
  detectMaterialSearchIntent,
  detectOwnedMaterialsBuildFollowUp,
  detectOwnedMaterialsProjectIntent,
  detectOwnedMaterialsSemanticParaphrase,
  detectProjectComponentsIntent,
  detectProjectBudgetEstimationIntent,
  detectProjectBudgetEstimationFollowUp,
  detectProjectMaterialAvailabilitySelectionFollowUp,
  detectProjectsWithinBudgetIntent,
  detectProjectMaterialAvailabilityIntent,
  extractBudgetBound,
  parseProjectsWithinBudgetInput,
  resolveProjectsWithinBudgetNumericContinuation,
  extractProjectTitleQuery,
  hasRecentOwnedMaterialsProjectContext,
  hasRecentProjectBudgetConfirmation,
  isAffirmativeOwnedMaterialsContinuation,
  isExplicitMaterialSearchCommand,
  mergeMaterialSearchPlan,
  messageImpliesFreeFilter,
  parseOwnedMaterialsProjectInput,
  resolveOwnedMaterialsFromConversation,
  shouldDeferMaterialSearchForOwnedMaterialsProjectUse,
  shouldDeferMaterialSearchForProjectMaterialAvailability,
} from './ai-agent-filter-extractor.service.js';
import { buildToolInputForRoute, parseRecommendationInput } from './ai-agent-input-parser.service.js';
import {
  buildPlannerConversationContext,
  type PlannerConversationContext,
} from './ai-agent-planner-context.service.js';
import {
  materialSearchPlanFromPlanner,
  ownedMaterialsPlanFromPlanner,
  projectBudgetEstimationPlanFromPlanner,
  projectMaterialAvailabilityPlanFromPlanner,
  planLearnerAgentTurn,
  type AgentPlannerOutput,
} from './ai-agent-semantic-planner.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
import { resolveProjectFromRecentEntities } from './ai-agent-reference-resolver.service.js';
import { assessDangerousRequest } from './ai-agent-safety-guard.service.js';
import { routeToToolName } from './ai-agent-route-mapping.js';
import { resolveEntityFromContext } from './ai-agent-reference-resolver.service.js';
import { findProjectsWithinBudgetInputSchema } from './ai-tool.types.js';

export type AgentExecutionDiagnostics = {
  deterministicRoute: AiAgentRouteType;
  deterministicConfidence: number;
  semanticPlannerUsed: boolean;
  semanticRoute: AiAgentRouteType | null;
  validatedRoute: AiAgentRouteType;
  normalizedFilters: Record<string, unknown> | null;
  toolName: string | null;
  plannerConfidence: number | null;
  resolvedEntityTitle: string | null;
};

export type AgentExecutionPlan = {
  route: AiAgentRouteType;
  toolName: string | null;
  toolInput: Record<string, unknown>;
  diagnostics: AgentExecutionDiagnostics;
  clarificationReason?: string;
};

const STATIC_ROUTES = new Set<AiAgentRouteType>([
  'CONVERSATIONAL_STATIC',
  'OUT_OF_SCOPE',
  'DANGEROUS_REQUEST',
]);

const PLATFORM_ROUTES = new Set<AiAgentRouteType>(AI_AGENT_PLATFORM_ROUTES);

const OWNED_MATERIALS_CLARIFICATION_COPY = {
  ar: 'هل تريد أن أعرض مشاريع ImpactLoop التي يمكن تنفيذها باستخدام هذه المواد؟',
  en: 'Would you like me to show ImpactLoop projects that use these materials?',
} as const;

const OWNED_MATERIALS_EMPTY_CLARIFICATION_COPY = {
  ar: 'ما أسماء المواد أو المكوّنات التي لديك؟ اذكرها بشكل أوضح (مثل Arduino، أسلاك، كرتون) وسأطابقها مع مشاريع ImpactLoop.',
  en: 'What material or component names do you have? List them clearly (for example Arduino, wires, cardboard) and I will match them to ImpactLoop projects.',
} as const;

const buildOwnedMaterialsExecutionPlan = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  toolInput: Record<string, unknown>;
  semanticPlannerUsed: boolean;
  semanticRoute: AiAgentRouteType | null;
  plannerConfidence: number | null;
}): AgentExecutionPlan => ({
  route: 'OWNED_MATERIALS_PROJECT_MATCH',
  toolName: 'match_projects_by_owned_materials',
  toolInput: input.toolInput,
  diagnostics: {
    deterministicRoute: input.routeDecision.route,
    deterministicConfidence: input.routeDecision.confidence,
    semanticPlannerUsed: input.semanticPlannerUsed,
    semanticRoute: input.semanticRoute,
    validatedRoute: 'OWNED_MATERIALS_PROJECT_MATCH',
    normalizedFilters: null,
    toolName: 'match_projects_by_owned_materials',
    plannerConfidence: input.plannerConfidence,
    resolvedEntityTitle: null,
  },
});

const buildOwnedMaterialsClarificationPlan = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  locale: AiLocale;
  semanticPlannerUsed: boolean;
  semanticRoute: AiAgentRouteType | null;
  plannerConfidence: number | null;
  reason?: string;
}): AgentExecutionPlan => ({
  route: 'CLARIFICATION',
  toolName: null,
  toolInput: {},
  clarificationReason:
    input.reason ??
    OWNED_MATERIALS_CLARIFICATION_COPY[input.locale === 'ar' ? 'ar' : 'en'],
  diagnostics: {
    deterministicRoute: input.routeDecision.route,
    deterministicConfidence: input.routeDecision.confidence,
    semanticPlannerUsed: input.semanticPlannerUsed,
    semanticRoute: input.semanticRoute,
    validatedRoute: 'CLARIFICATION',
    normalizedFilters: null,
    toolName: null,
    plannerConfidence: input.plannerConfidence,
    resolvedEntityTitle: null,
  },
});

const buildOwnedMaterialsSemanticFallbackPlan = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  locale: AiLocale;
  conversationContext?: PlannerConversationContext;
}): AgentExecutionPlan | null => {
  if (detectEducationalLearningIntent(input.userMessage)) {
    return null;
  }

  const materials = resolveOwnedMaterialsFromConversation(
    input.userMessage,
    input.conversationContext?.recentMessages,
  );
  if (
    detectOwnedMaterialsSemanticParaphrase(input.userMessage) &&
    materials.length > 0
  ) {
    const toolInput = {
      ...parseOwnedMaterialsProjectInput(input.userMessage),
      materials,
    };
    return buildOwnedMaterialsExecutionPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      toolInput,
      semanticPlannerUsed: false,
      semanticRoute: null,
      plannerConfidence: null,
    });
  }

  const hasExplicitIntent = detectOwnedMaterialsProjectIntent(input.userMessage);
  const hasBuildFollowUp = detectOwnedMaterialsBuildFollowUp(input.userMessage);
  const isBarePossession = detectBareOwnedMaterialsPossession(input.userMessage);
  const isAffirmative = isAffirmativeOwnedMaterialsContinuation(input.userMessage);
  const hasProjectContext = hasRecentOwnedMaterialsProjectContext({
    recentMessages: input.conversationContext?.recentMessages,
  });

  if (materials.length > 0) {
    if (hasExplicitIntent || hasBuildFollowUp || isAffirmative) {
      const toolInput = {
        ...parseOwnedMaterialsProjectInput(input.userMessage),
        materials,
      };
      return buildOwnedMaterialsExecutionPlan({
        userMessage: input.userMessage,
        routeDecision: input.routeDecision,
        toolInput,
        semanticPlannerUsed: false,
        semanticRoute: null,
        plannerConfidence: null,
      });
    }

    if (isBarePossession) {
      if (hasProjectContext) {
        const toolInput = {
          ...parseOwnedMaterialsProjectInput(input.userMessage),
          materials,
        };
        return buildOwnedMaterialsExecutionPlan({
          userMessage: input.userMessage,
          routeDecision: input.routeDecision,
          toolInput,
          semanticPlannerUsed: false,
          semanticRoute: null,
          plannerConfidence: null,
        });
      }

      return buildOwnedMaterialsClarificationPlan({
        userMessage: input.userMessage,
        routeDecision: input.routeDecision,
        locale: input.locale,
        semanticPlannerUsed: false,
        semanticRoute: null,
        plannerConfidence: null,
      });
    }
  }

  if (
    (hasBuildFollowUp || isAffirmative) &&
    hasProjectContext &&
    materials.length > 0
  ) {
    const toolInput = {
      ...parseOwnedMaterialsProjectInput(input.userMessage),
      materials,
    };
    return buildOwnedMaterialsExecutionPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      toolInput,
      semanticPlannerUsed: false,
      semanticRoute: null,
      plannerConfidence: null,
    });
  }

  return null;
};

const isHighConfidenceDeterministicPlatformPlan = (input: {
  routeDecision: AiAgentRouteDecision;
  toolInput: Record<string, unknown>;
  userMessage: string;
}): boolean => {
  if (!PLATFORM_ROUTES.has(input.routeDecision.route)) {
    return false;
  }

  if (input.routeDecision.confidence < 0.93) {
    return false;
  }

  if (input.routeDecision.route === 'MATERIAL_SEARCH') {
    const materialIntent = detectMaterialSearchIntent(input.userMessage);
    if (!materialIntent.detected) {
      return false;
    }

    if (
      shouldDeferMaterialSearchForOwnedMaterialsProjectUse(input.userMessage) &&
      !isExplicitMaterialSearchCommand(input.userMessage)
    ) {
      return false;
    }

    if (shouldDeferMaterialSearchForProjectMaterialAvailability(input.userMessage)) {
      return false;
    }

    if (
      typeof input.toolInput.query === 'string' &&
      input.userMessage.toLowerCase().includes(String(input.toolInput.query).toLowerCase()) &&
      String(input.toolInput.query).split(/\s+/).length >= 3
    ) {
      return false;
    }
  }

  if (
    input.routeDecision.route === 'PROJECT_COMPONENTS' &&
    shouldDeferMaterialSearchForOwnedMaterialsProjectUse(input.userMessage)
  ) {
    return false;
  }

  if (
    detectComponentMaterialMatchingIntent(input.userMessage) &&
    extractProjectTitleQuery(input.userMessage)
  ) {
    return true;
  }

  if (
    input.routeDecision.route === 'COMPONENT_MATERIAL_MATCHING' ||
    input.routeDecision.route === 'PROJECT_MATERIAL_MATCHING' ||
    input.routeDecision.route === 'OWNED_MATERIALS_PROJECT_MATCH'
  ) {
    return true;
  }

  return true;
};

const shouldConsultSemanticPlannerForOwnedMaterials = (userMessage: string): boolean => {
  if (detectOwnedMaterialsProjectIntent(userMessage)) {
    return true;
  }
  if (detectBareOwnedMaterialsPossession(userMessage)) {
    return true;
  }
  if (detectOwnedMaterialsBuildFollowUp(userMessage)) {
    return true;
  }
  if (detectOwnedMaterialsSemanticParaphrase(userMessage)) {
    return true;
  }
  if (isAffirmativeOwnedMaterialsContinuation(userMessage)) {
    return true;
  }

  const parsedMessage = userMessage.trim();
  return (
    /(?:المواد|القطع|مكوّنات|مكونات).*(?:عندي|معي|معاي)/iu.test(parsedMessage) ||
    /(?:عندي|معي|معاي).*(?:مواد|قطع|مكوّن|مكون)/iu.test(parsedMessage)
  );
};

const buildDeterministicFallbackPlan = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  locale: AiLocale;
  conversationContext?: PlannerConversationContext;
}): AgentExecutionPlan => {
  let route = input.routeDecision.route;
  let toolInput = buildToolInputForRoute(route, input.userMessage);

  if (
    route === 'MATERIAL_SEARCH' &&
    shouldDeferMaterialSearchForOwnedMaterialsProjectUse(input.userMessage) &&
    !isExplicitMaterialSearchCommand(input.userMessage)
  ) {
    const ownedFallback = buildOwnedMaterialsSemanticFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    if (ownedFallback) {
      return ownedFallback;
    }
  }

  if (
    route === 'PROJECT_COMPONENTS' &&
    shouldDeferMaterialSearchForOwnedMaterialsProjectUse(input.userMessage)
  ) {
    const ownedFallback = buildOwnedMaterialsSemanticFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    if (ownedFallback) {
      return ownedFallback;
    }
  }

  if (route === 'CLARIFICATION' || route === 'GENERAL_LEARNING') {
    const ownedFallback = buildOwnedMaterialsSemanticFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    if (ownedFallback) {
      return ownedFallback;
    }

    if (detectEducationalLearningIntent(input.userMessage)) {
      route = 'GENERAL_LEARNING';
      toolInput = {};
    } else if (detectMaterialSearchIntent(input.userMessage).detected) {
      route = 'MATERIAL_SEARCH';
      toolInput = mergeMaterialSearchPlan(input.userMessage);
    } else if (detectProjectComponentsIntent(input.userMessage)) {
      route = 'PROJECT_COMPONENTS';
      toolInput = buildToolInputForRoute(route, input.userMessage);
    } else if (detectComponentMaterialMatchingIntent(input.userMessage)) {
      route = 'COMPONENT_MATERIAL_MATCHING';
      toolInput = {};
    }
  }

  if (route === 'MATERIAL_SEARCH') {
    const deterministic = mergeMaterialSearchPlan(input.userMessage);
    toolInput = {
      ...deterministic,
      ...toolInput,
      ...(messageImpliesFreeFilter(input.userMessage) ? { isFree: true } : {}),
      limit: (toolInput.limit as number | undefined) ?? deterministic.limit ?? 10,
    };

    if (typeof toolInput.query === 'string') {
      const normalizedQuery = toolInput.query.trim().toLowerCase();
      const normalizedMessage = input.userMessage.trim().toLowerCase();
      if (
        normalizedMessage.includes(normalizedQuery) &&
        normalizedQuery.split(/\s+/).length >= 3
      ) {
        delete toolInput.query;
      }
    }
  }

  if (route === 'PROJECTS_WITHIN_BUDGET') {
    const parsed = parseProjectsWithinBudgetInput(input.userMessage);
    const budgetBound = extractBudgetBound(input.userMessage);
    if (!budgetBound?.maxBudgetNis) {
      return buildProjectsWithinBudgetClarificationPlan({
        routeDecision: input.routeDecision,
        locale: input.locale,
        semanticPlannerUsed: false,
        semanticRoute: null,
        plannerConfidence: null,
      });
    }
    toolInput = parsed;
  }

  if (route === 'PROJECT_BUDGET_ESTIMATION') {
    const contextual = resolveContextualProjectBudgetToolInput({
      userMessage: input.userMessage,
      conversationContext: input.conversationContext,
    });
    if (contextual) {
      toolInput = { ...toolInput, ...contextual };
    }
    if (!toolInput.projectId && !toolInput.projectQuery) {
      return buildProjectBudgetClarificationPlan({
        routeDecision: input.routeDecision,
        locale: input.locale,
        semanticPlannerUsed: false,
        semanticRoute: null,
        plannerConfidence: null,
      });
    }
  }

  const toolName = routeToToolName(route, input.routeDecision.suggestedTool);

  return {
    route,
    toolName,
    toolInput,
    diagnostics: {
      deterministicRoute: input.routeDecision.route,
      deterministicConfidence: input.routeDecision.confidence,
      semanticPlannerUsed: false,
      semanticRoute: null,
      validatedRoute: route,
      normalizedFilters: route === 'MATERIAL_SEARCH' ? toolInput : null,
      toolName,
      plannerConfidence: null,
      resolvedEntityTitle: null,
    },
  };
};

const resolveEntityIdsFromPlanner = (
  planner: AgentPlannerOutput,
  context: PlannerConversationContext | undefined,
): { projectId?: string; materialId?: string; componentId?: string; title?: string } => {
  if (!context) {
    return {};
  }

  for (const entity of planner.entities) {
    const resolved = resolveEntityFromContext({
      context,
      type: entity.type,
      mention: entity.mention,
      referenceType: entity.referenceType,
      resultIndex: entity.resultIndex ?? null,
    });

    if (!resolved) {
      continue;
    }

    if (entity.type === 'PROJECT') {
      return { projectId: resolved.entity.id, title: resolved.entity.title };
    }
    if (entity.type === 'MATERIAL') {
      return { materialId: resolved.entity.id, title: resolved.entity.title };
    }
    if (entity.type === 'COMPONENT') {
      return { componentId: resolved.entity.id, title: resolved.entity.title };
    }
  }

  return {};
};

const applyOwnedMaterialsPlannerDecision = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  planner: AgentPlannerOutput;
  conversationContext?: PlannerConversationContext;
  locale: AiLocale;
}): AgentExecutionPlan | null => {
  if (isExplicitMaterialSearchCommand(input.userMessage)) {
    return null;
  }

  const isOwnedMaterialsDecision =
    input.planner.route === 'OWNED_MATERIALS_PROJECT_MATCH' ||
    input.planner.toolCall?.name === 'match_projects_by_owned_materials';

  if (!isOwnedMaterialsDecision) {
    return null;
  }

  if (detectEducationalLearningIntent(input.userMessage)) {
    return null;
  }

  if (input.planner.clarificationNeeded) {
    return buildOwnedMaterialsClarificationPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      locale: input.locale,
      semanticPlannerUsed: true,
      semanticRoute: input.planner.route,
      plannerConfidence: input.planner.confidence,
      reason: input.planner.clarificationReason,
    });
  }

  const toolInput =
    ownedMaterialsPlanFromPlanner(
      input.userMessage,
      input.planner,
      input.conversationContext,
    ) ?? null;

  if (!toolInput || !Array.isArray(toolInput.materials) || toolInput.materials.length === 0) {
    return buildOwnedMaterialsClarificationPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      locale: input.locale,
      semanticPlannerUsed: true,
      semanticRoute: input.planner.route,
      plannerConfidence: input.planner.confidence,
      reason:
        OWNED_MATERIALS_EMPTY_CLARIFICATION_COPY[
          input.locale === 'ar' ? 'ar' : 'en'
        ],
    });
  }

  return buildOwnedMaterialsExecutionPlan({
    userMessage: input.userMessage,
    routeDecision: input.routeDecision,
    toolInput,
    semanticPlannerUsed: true,
    semanticRoute: input.planner.route,
    plannerConfidence: input.planner.confidence,
  });
};

const buildProjectBudgetClarificationPlan = (input: {
  routeDecision: AiAgentRouteDecision;
  locale: AiLocale;
  semanticPlannerUsed: boolean;
  semanticRoute: AiAgentRouteType | null;
  plannerConfidence: number | null;
}): AgentExecutionPlan => ({
  route: 'CLARIFICATION',
  toolName: null,
  toolInput: {},
  clarificationReason:
    input.locale === 'ar'
      ? 'أي مشروع تريد أن أحسب تقدير موادّه؟'
      : 'Which project should I estimate the available material cost for?',
  diagnostics: {
    deterministicRoute: input.routeDecision.route,
    deterministicConfidence: input.routeDecision.confidence,
    semanticPlannerUsed: input.semanticPlannerUsed,
    semanticRoute: input.semanticRoute,
    validatedRoute: 'CLARIFICATION',
    normalizedFilters: null,
    toolName: null,
    plannerConfidence: input.plannerConfidence,
    resolvedEntityTitle: null,
  },
});

const buildProjectsWithinBudgetClarificationPlan = (input: {
  routeDecision: AiAgentRouteDecision;
  locale: AiLocale;
  semanticPlannerUsed: boolean;
  semanticRoute: AiAgentRouteType | null;
  plannerConfidence: number | null;
}): AgentExecutionPlan => ({
  route: 'CLARIFICATION',
  toolName: null,
  toolInput: {},
  clarificationReason:
    input.locale === 'ar'
      ? 'ما الحد الأقصى لميزانيتك بالشيكل؟'
      : 'What is your maximum budget in NIS?',
  diagnostics: {
    deterministicRoute: input.routeDecision.route,
    deterministicConfidence: input.routeDecision.confidence,
    semanticPlannerUsed: input.semanticPlannerUsed,
    semanticRoute: input.semanticRoute,
    validatedRoute: 'CLARIFICATION',
    normalizedFilters: null,
    toolName: null,
    plannerConfidence: input.plannerConfidence,
    resolvedEntityTitle: null,
  },
});

const projectsWithinBudgetPlanFromPlanner = (
  userMessage: string,
  planner: AgentPlannerOutput,
): Record<string, unknown> | null => {
  if (planner.toolCall?.name !== 'find_projects_within_budget') {
    return null;
  }

  const toolArgs =
    planner.toolCall?.name === 'find_projects_within_budget'
      ? planner.toolCall.arguments
      : {};
  const deterministic = parseProjectsWithinBudgetInput(userMessage);

  return findProjectsWithinBudgetInputSchema.parse({
    maxBudgetNis:
      typeof toolArgs.maxBudgetNis === 'number'
        ? toolArgs.maxBudgetNis
        : deterministic.maxBudgetNis,
    comparisonMode:
      toolArgs.comparisonMode === 'LT' || toolArgs.comparisonMode === 'LTE'
        ? toolArgs.comparisonMode
        : deterministic.comparisonMode,
    category:
      typeof toolArgs.category === 'string' ? toolArgs.category : deterministic.category,
    difficulty:
      toolArgs.difficulty === 'BEGINNER' ||
      toolArgs.difficulty === 'INTERMEDIATE' ||
      toolArgs.difficulty === 'ADVANCED'
        ? toolArgs.difficulty
        : deterministic.difficulty,
    query: typeof toolArgs.query === 'string' ? toolArgs.query : deterministic.query,
    projectLimit:
      typeof toolArgs.projectLimit === 'number'
        ? toolArgs.projectLimit
        : deterministic.projectLimit,
    includePartial:
      typeof toolArgs.includePartial === 'boolean'
        ? toolArgs.includePartial
        : deterministic.includePartial,
    candidateProjectIds: Array.isArray(toolArgs.candidateProjectIds)
      ? toolArgs.candidateProjectIds
      : deterministic.candidateProjectIds,
  });
};

const buildProjectsWithinBudgetExecutionPlan = (input: {
  routeDecision: AiAgentRouteDecision;
  toolInput: Record<string, unknown>;
  semanticPlannerUsed: boolean;
  semanticRoute: AiAgentRouteType | null;
  plannerConfidence: number | null;
}): AgentExecutionPlan => ({
  route: 'PROJECTS_WITHIN_BUDGET',
  toolName: 'find_projects_within_budget',
  toolInput: input.toolInput,
  diagnostics: {
    deterministicRoute: input.routeDecision.route,
    deterministicConfidence: input.routeDecision.confidence,
    semanticPlannerUsed: input.semanticPlannerUsed,
    semanticRoute: input.semanticRoute,
    validatedRoute: 'PROJECTS_WITHIN_BUDGET',
    normalizedFilters: input.toolInput,
    toolName: 'find_projects_within_budget',
    plannerConfidence: input.plannerConfidence,
    resolvedEntityTitle: null,
  },
});

const BUDGET_CONTEXT_PROJECT_BLOCK_TYPES = new Set([
  'project_results',
  'component_list',
  'component_matches',
  'project_details',
  'project_budget_estimate',
]);

const resolveSingleBudgetContextProject = (
  projectCandidates: Array<{
    type: 'PROJECT';
    id: string;
    title: string;
    resultIndex: number;
    parentContext?: string;
    status?: string;
    blockType: string;
    messageId: string;
    recencyOrder: number;
  }>,
): { id: string; title: string } | null => {
  const grounded = projectCandidates.filter((candidate) =>
    BUDGET_CONTEXT_PROJECT_BLOCK_TYPES.has(candidate.blockType),
  );
  if (grounded.length === 0) {
    return null;
  }

  const latestOrder = Math.max(...grounded.map((candidate) => candidate.recencyOrder));
  const latestGrounded = [
    ...new Map(
      grounded
        .filter((candidate) => candidate.recencyOrder === latestOrder)
        .map((project) => [project.id, project]),
    ).values(),
  ];

  if (latestGrounded.length === 1) {
    return { id: latestGrounded[0]!.id, title: latestGrounded[0]!.title };
  }

  return null;
};

const resolveContextualProjectBudgetToolInput = (input: {
  userMessage: string;
  conversationContext?: PlannerConversationContext;
}): Record<string, unknown> | null => {
  const projectQuery = extractProjectTitleQuery(input.userMessage);
  if (projectQuery) {
    return { projectQuery, limitPerComponent: 5 };
  }

  const projectCandidates = (input.conversationContext?.entities ?? [])
    .filter((entity) => entity.type === 'PROJECT')
    .map((entity) => ({
      type: 'PROJECT' as const,
      id: entity.id,
      title: entity.title,
      resultIndex: entity.resultIndex,
      parentContext: entity.parentContext,
      status: entity.status,
      blockType: entity.blockType ?? 'project_results',
      messageId: entity.messageId ?? '',
      recencyOrder: entity.recencyOrder ?? 0,
    }));

  const resolved = resolveProjectFromRecentEntities({
    userMessage: input.userMessage,
    recentProjects: projectCandidates,
  });

  if (resolved?.entity.id) {
    return { projectId: resolved.entity.id, limitPerComponent: 5 };
  }

  if (
    hasRecentProjectBudgetConfirmation({
      recentMessages: input.conversationContext?.recentMessages ?? [],
    }) &&
    (isAffirmativeOwnedMaterialsContinuation(input.userMessage) ||
      detectProjectMaterialAvailabilitySelectionFollowUp(input.userMessage))
  ) {
    const contextual = resolveSingleBudgetContextProject(projectCandidates);
    if (contextual) {
      return { projectId: contextual.id, limitPerComponent: 5 };
    }
  }

  if (detectProjectBudgetEstimationFollowUp(input.userMessage)) {
    const contextual = resolveSingleBudgetContextProject(projectCandidates);
    if (contextual) {
      return { projectId: contextual.id, limitPerComponent: 5 };
    }
  }

  return null;
};

const buildProjectBudgetFallbackPlan = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  locale: AiLocale;
  conversationContext?: PlannerConversationContext;
  semanticPlannerUsed?: boolean;
  semanticRoute?: AiAgentRouteType | null;
  plannerConfidence?: number | null;
}): AgentExecutionPlan => {
  const toolInput =
    resolveContextualProjectBudgetToolInput({
      userMessage: input.userMessage,
      conversationContext: input.conversationContext,
    }) ?? buildToolInputForRoute('PROJECT_BUDGET_ESTIMATION', input.userMessage);

  if (!toolInput.projectId && !toolInput.projectQuery) {
    return buildProjectBudgetClarificationPlan({
      routeDecision: input.routeDecision,
      locale: input.locale,
      semanticPlannerUsed: input.semanticPlannerUsed ?? false,
      semanticRoute: input.semanticRoute ?? null,
      plannerConfidence: input.plannerConfidence ?? null,
    });
  }

  const fallback = buildDeterministicFallbackPlan({
    userMessage: input.userMessage,
    routeDecision: {
      ...input.routeDecision,
      route: 'PROJECT_BUDGET_ESTIMATION',
      suggestedTool: 'estimate_project_material_budget',
      confidence: 0.94,
    },
    locale: input.locale,
    conversationContext: input.conversationContext,
  });
  fallback.toolInput = {
    ...toolInput,
    limitPerComponent: toolInput.limitPerComponent ?? 5,
  };
  fallback.toolName = 'estimate_project_material_budget';
  fallback.route = 'PROJECT_BUDGET_ESTIMATION';
  fallback.diagnostics.validatedRoute = 'PROJECT_BUDGET_ESTIMATION';
  fallback.diagnostics.toolName = 'estimate_project_material_budget';
  if (input.semanticPlannerUsed != null) {
    fallback.diagnostics.semanticPlannerUsed = input.semanticPlannerUsed;
  }
  if (input.semanticRoute != null) {
    fallback.diagnostics.semanticRoute = input.semanticRoute;
  }
  if (input.plannerConfidence != null) {
    fallback.diagnostics.plannerConfidence = input.plannerConfidence;
  }
  return fallback;
};

const applyPlannerPlan = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  planner: AgentPlannerOutput;
  conversationContext?: PlannerConversationContext;
  locale: AiLocale;
}): AgentExecutionPlan => {
  const resolvedEntities = resolveEntityIdsFromPlanner(
    input.planner,
    input.conversationContext,
  );

  if (input.planner.clarificationNeeded) {
    return {
      route: 'CLARIFICATION',
      toolName: null,
      toolInput: {},
      clarificationReason: input.planner.clarificationReason,
      diagnostics: {
        deterministicRoute: input.routeDecision.route,
        deterministicConfidence: input.routeDecision.confidence,
        semanticPlannerUsed: true,
        semanticRoute: input.planner.route,
        validatedRoute: 'CLARIFICATION',
        normalizedFilters: null,
        toolName: null,
        plannerConfidence: input.planner.confidence,
        resolvedEntityTitle: resolvedEntities.title ?? null,
      },
    };
  }

  if (input.planner.route === 'OUT_OF_SCOPE') {
    return {
      route: 'OUT_OF_SCOPE',
      toolName: null,
      toolInput: {},
      diagnostics: {
        deterministicRoute: input.routeDecision.route,
        deterministicConfidence: input.routeDecision.confidence,
        semanticPlannerUsed: true,
        semanticRoute: input.planner.route,
        validatedRoute: 'OUT_OF_SCOPE',
        normalizedFilters: null,
        toolName: null,
        plannerConfidence: input.planner.confidence,
        resolvedEntityTitle: null,
      },
    };
  }

  if (isExplicitMaterialSearchCommand(input.userMessage)) {
    const toolInput =
      materialSearchPlanFromPlanner(input.userMessage, input.planner) ??
      mergeMaterialSearchPlan(input.userMessage);
    return {
      route: 'MATERIAL_SEARCH',
      toolName: 'search_available_materials',
      toolInput,
      diagnostics: {
        deterministicRoute: input.routeDecision.route,
        deterministicConfidence: input.routeDecision.confidence,
        semanticPlannerUsed: true,
        semanticRoute: input.planner.route,
        validatedRoute: 'MATERIAL_SEARCH',
        normalizedFilters: toolInput,
        toolName: 'search_available_materials',
        plannerConfidence: input.planner.confidence,
        resolvedEntityTitle: resolvedEntities.title ?? null,
      },
    };
  }

  const ownedMaterialsPlan = applyOwnedMaterialsPlannerDecision(input);
  if (ownedMaterialsPlan) {
    return ownedMaterialsPlan;
  }

  const projectsWithinBudgetToolInput = projectsWithinBudgetPlanFromPlanner(
    input.userMessage,
    input.planner,
  );

  if (
    input.planner.toolCall?.name === 'find_projects_within_budget' ||
    projectsWithinBudgetToolInput ||
    detectProjectsWithinBudgetIntent(input.userMessage)
  ) {
    let toolInput =
      projectsWithinBudgetToolInput ?? parseProjectsWithinBudgetInput(input.userMessage);
    const budgetBound = extractBudgetBound(input.userMessage);

    if (!budgetBound?.maxBudgetNis || Number(toolInput.maxBudgetNis) <= 0) {
      return buildProjectsWithinBudgetClarificationPlan({
        routeDecision: input.routeDecision,
        locale: input.locale,
        semanticPlannerUsed: true,
        semanticRoute: input.planner.route,
        plannerConfidence: input.planner.confidence,
      });
    }

    toolInput = findProjectsWithinBudgetInputSchema.parse(toolInput);

    return buildProjectsWithinBudgetExecutionPlan({
      routeDecision: input.routeDecision,
      toolInput,
      semanticPlannerUsed: true,
      semanticRoute: input.planner.route,
      plannerConfidence: input.planner.confidence,
    });
  }

  const budgetToolInput = projectBudgetEstimationPlanFromPlanner(
    input.userMessage,
    input.planner,
  );

  if (
    input.planner.route === 'PROJECT_BUDGET_ESTIMATION' ||
    input.planner.toolCall?.name === 'estimate_project_material_budget' ||
    budgetToolInput
  ) {
    let toolInput =
      budgetToolInput ??
      buildToolInputForRoute('PROJECT_BUDGET_ESTIMATION', input.userMessage);

    if (resolvedEntities.projectId) {
      toolInput.projectId = resolvedEntities.projectId;
    }
    if (resolvedEntities.materialId) {
      toolInput.materialId = resolvedEntities.materialId;
    }
    if (resolvedEntities.componentId) {
      toolInput.componentId = resolvedEntities.componentId;
    }

    if (!toolInput.projectId && !toolInput.projectQuery) {
      const contextual = resolveContextualProjectBudgetToolInput({
        userMessage: input.userMessage,
        conversationContext: input.conversationContext,
      });
      if (contextual) {
        toolInput = { ...toolInput, ...contextual };
      }
    }

    if (!toolInput.projectId && !toolInput.projectQuery) {
      return buildProjectBudgetClarificationPlan({
        routeDecision: input.routeDecision,
        locale: input.locale,
        semanticPlannerUsed: true,
        semanticRoute: input.planner.route,
        plannerConfidence: input.planner.confidence,
      });
    }

    return {
      route: 'PROJECT_BUDGET_ESTIMATION',
      toolName: 'estimate_project_material_budget',
      toolInput,
      diagnostics: {
        deterministicRoute: input.routeDecision.route,
        deterministicConfidence: input.routeDecision.confidence,
        semanticPlannerUsed: true,
        semanticRoute: input.planner.route,
        validatedRoute: 'PROJECT_BUDGET_ESTIMATION',
        normalizedFilters: null,
        toolName: 'estimate_project_material_budget',
        plannerConfidence: input.planner.confidence,
        resolvedEntityTitle: resolvedEntities.title ?? null,
      },
    };
  }

  if (
    input.planner.route === 'MATERIAL_SEARCH' &&
    shouldDeferMaterialSearchForOwnedMaterialsProjectUse(input.userMessage) &&
    !isExplicitMaterialSearchCommand(input.userMessage)
  ) {
    const ownedFallback = buildOwnedMaterialsSemanticFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    if (ownedFallback) {
      return {
        ...ownedFallback,
        diagnostics: {
          ...ownedFallback.diagnostics,
          semanticPlannerUsed: true,
          semanticRoute: input.planner.route,
          plannerConfidence: input.planner.confidence,
        },
      };
    }
  }

  if (input.planner.route === 'GENERAL_LEARNING') {
    return {
      route: 'GENERAL_LEARNING',
      toolName: null,
      toolInput: {},
      diagnostics: {
        deterministicRoute: input.routeDecision.route,
        deterministicConfidence: input.routeDecision.confidence,
        semanticPlannerUsed: true,
        semanticRoute: input.planner.route,
        validatedRoute: 'GENERAL_LEARNING',
        normalizedFilters: null,
        toolName: null,
        plannerConfidence: input.planner.confidence,
        resolvedEntityTitle: null,
      },
    };
  }

  let route = input.planner.route as AiAgentRouteType;
  let toolInput: Record<string, unknown> = {};

  if (route === 'MATERIAL_SEARCH') {
    toolInput =
      materialSearchPlanFromPlanner(input.userMessage, input.planner) ??
      mergeMaterialSearchPlan(input.userMessage);
  } else if (route === 'OWNED_MATERIALS_PROJECT_MATCH') {
    toolInput =
      ownedMaterialsPlanFromPlanner(
        input.userMessage,
        input.planner,
        input.conversationContext,
      ) ?? buildToolInputForRoute(route, input.userMessage);
  } else if (route === 'PROJECT_MATERIAL_AVAILABILITY') {
    toolInput =
      projectMaterialAvailabilityPlanFromPlanner(input.userMessage, input.planner) ??
      buildToolInputForRoute(route, input.userMessage);
  } else if (route === 'PROJECT_BUDGET_ESTIMATION') {
    toolInput =
      projectBudgetEstimationPlanFromPlanner(input.userMessage, input.planner) ??
      buildToolInputForRoute(route, input.userMessage);
  } else if (input.planner.toolCall) {
    route = input.planner.route as AiAgentRouteType;
    toolInput = { ...input.planner.toolCall.arguments };
  } else {
    toolInput = buildToolInputForRoute(route, input.userMessage);
  }

  if (resolvedEntities.projectId) {
    toolInput.projectId = resolvedEntities.projectId;
  }
  if (resolvedEntities.materialId) {
    toolInput.materialId = resolvedEntities.materialId;
  }
  if (resolvedEntities.componentId) {
    toolInput.componentId = resolvedEntities.componentId;
  }

  const toolName =
    input.planner.toolCall?.name ?? routeToToolName(route, input.routeDecision.suggestedTool);

  return {
    route,
    toolName,
    toolInput,
    diagnostics: {
      deterministicRoute: input.routeDecision.route,
      deterministicConfidence: input.routeDecision.confidence,
      semanticPlannerUsed: true,
      semanticRoute: input.planner.route,
      validatedRoute: route,
      normalizedFilters: route === 'MATERIAL_SEARCH' ? toolInput : null,
      toolName,
      plannerConfidence: input.planner.confidence,
      resolvedEntityTitle: resolvedEntities.title ?? null,
    },
  };
};

export const preserveDeterministicDomainLearning = (input: {
  userMessage: string;
  plan: AgentExecutionPlan;
}): AgentExecutionPlan => {
  const deterministicScope = classifyScopeDeterministic(input.userMessage);
  if (
    deterministicScope.classification === 'DOMAIN_KNOWLEDGE' &&
    input.plan.route === 'OUT_OF_SCOPE'
  ) {
    return {
      ...input.plan,
      route: 'GENERAL_LEARNING',
      toolName: null,
      toolInput: {},
    };
  }

  return input.plan;
};

const reconcilePlannerWithPlatformIntent = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  plan: AgentExecutionPlan;
  locale: AiLocale;
  conversationContext?: PlannerConversationContext;
}): AgentExecutionPlan => {
  const domainPreservedPlan = preserveDeterministicDomainLearning({
    userMessage: input.userMessage,
    plan: input.plan,
  });

  if (input.plan.route === 'OWNED_MATERIALS_PROJECT_MATCH') {
    if (isExplicitMaterialSearchCommand(input.userMessage)) {
      const fallback = buildDeterministicFallbackPlan({
        userMessage: input.userMessage,
        routeDecision: {
          ...input.routeDecision,
          route: 'MATERIAL_SEARCH',
          suggestedTool: 'search_available_materials',
          confidence: 0.96,
        },
        locale: input.locale,
        conversationContext: input.conversationContext,
      });
      fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
      fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
      return fallback;
    }

    if (detectEducationalLearningIntent(input.userMessage)) {
      return {
        ...domainPreservedPlan,
        route: 'GENERAL_LEARNING',
        toolName: null,
        toolInput: {},
      };
    }
    return domainPreservedPlan;
  }

  if (
    input.plan.route === 'CLARIFICATION' &&
    (input.plan.clarificationReason?.includes('ImpactLoop') ||
      input.plan.clarificationReason?.includes('مشاريع ImpactLoop'))
  ) {
    return domainPreservedPlan;
  }

  if (detectEducationalLearningIntent(input.userMessage)) {
    return domainPreservedPlan;
  }

  if (detectComparisonFollowUpIntent(input.userMessage)) {
    return domainPreservedPlan;
  }

  if (
    detectActiveProjectBuildsIntent(input.userMessage) &&
    input.plan.route !== 'ACTIVE_PROJECT_BUILDS'
  ) {
    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'ACTIVE_PROJECT_BUILDS',
        suggestedTool: 'get_active_project_builds',
        confidence: 0.94,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (
    detectMaterialDetailsIntent(input.userMessage) &&
    input.plan.route !== 'MATERIAL_DETAILS'
  ) {
    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'MATERIAL_DETAILS',
        suggestedTool: 'get_material_details',
        confidence: 0.92,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (input.plan.route === 'PERSONALIZED_RECOMMENDATION') {
    const expected = parseRecommendationInput(input.userMessage);
    const currentType = input.plan.toolInput.type as string | undefined;
    if (currentType !== expected.type) {
      return {
        ...input.plan,
        toolInput: expected,
      };
    }
  }

  if (
    detectProjectComponentsIntent(input.userMessage) &&
    !detectBuildGapIntent(input.userMessage) &&
    (input.plan.route === 'GENERAL_LEARNING' ||
      input.plan.route === 'CLARIFICATION' ||
      input.plan.route === 'BUILD_GAP_ANALYSIS')
  ) {
    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'PROJECT_COMPONENTS',
        suggestedTool: 'get_project_required_components',
        confidence: 0.94,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (
    detectProjectsWithinBudgetIntent(input.userMessage) &&
    (input.plan.route === 'GENERAL_LEARNING' ||
      input.plan.route === 'CLARIFICATION' ||
      input.plan.route === 'MATERIAL_SEARCH' ||
      input.plan.route === 'PROJECT_SEARCH' ||
      input.plan.route === 'PROJECT_BUDGET_ESTIMATION')
  ) {
    const budgetBound = extractBudgetBound(input.userMessage);
    if (!budgetBound?.maxBudgetNis) {
      return buildProjectsWithinBudgetClarificationPlan({
        routeDecision: input.routeDecision,
        locale: input.locale,
        semanticPlannerUsed: input.plan.diagnostics.semanticPlannerUsed,
        semanticRoute: input.plan.diagnostics.semanticRoute,
        plannerConfidence: input.plan.diagnostics.plannerConfidence,
      });
    }

    return buildProjectsWithinBudgetExecutionPlan({
      routeDecision: input.routeDecision,
      toolInput: parseProjectsWithinBudgetInput(input.userMessage),
      semanticPlannerUsed: input.plan.diagnostics.semanticPlannerUsed,
      semanticRoute: input.plan.diagnostics.semanticRoute,
      plannerConfidence: input.plan.diagnostics.plannerConfidence,
    });
  }

  if (
    detectProjectBudgetEstimationIntent(input.userMessage) &&
    (input.plan.route === 'GENERAL_LEARNING' ||
      input.plan.route === 'CLARIFICATION' ||
      input.plan.route === 'MATERIAL_SEARCH' ||
      input.plan.route === 'PROJECT_MATERIAL_AVAILABILITY' ||
      input.plan.route === 'PROJECT_SEARCH')
  ) {
    return buildProjectBudgetFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      locale: input.locale,
      conversationContext: input.conversationContext,
      semanticPlannerUsed: input.plan.diagnostics.semanticPlannerUsed,
      semanticRoute: input.plan.diagnostics.semanticRoute,
      plannerConfidence: input.plan.diagnostics.plannerConfidence,
    });
  }

  if (
    detectProjectMaterialAvailabilityIntent(input.userMessage) &&
    (input.plan.route === 'GENERAL_LEARNING' ||
      input.plan.route === 'CLARIFICATION' ||
      input.plan.route === 'MATERIAL_SEARCH')
  ) {
    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'PROJECT_MATERIAL_AVAILABILITY',
        suggestedTool: 'match_available_materials_for_project',
        confidence: 0.94,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (
    input.plan.route !== 'GENERAL_LEARNING' &&
    input.plan.route !== 'CLARIFICATION'
  ) {
    if (
      input.plan.route === 'MATERIAL_SEARCH' &&
      shouldDeferMaterialSearchForOwnedMaterialsProjectUse(input.userMessage) &&
      !isExplicitMaterialSearchCommand(input.userMessage)
    ) {
      const ownedSemanticFallback = buildOwnedMaterialsSemanticFallbackPlan({
        userMessage: input.userMessage,
        routeDecision: input.routeDecision,
        locale: input.locale,
        conversationContext: input.conversationContext,
      });
      if (ownedSemanticFallback) {
        ownedSemanticFallback.diagnostics.semanticPlannerUsed =
          input.plan.diagnostics.semanticPlannerUsed;
        ownedSemanticFallback.diagnostics.semanticRoute =
          input.plan.diagnostics.semanticRoute ?? 'OWNED_MATERIALS_PROJECT_MATCH';
        return ownedSemanticFallback;
      }

      if (input.plan.diagnostics.semanticRoute === 'OWNED_MATERIALS_PROJECT_MATCH') {
        const ownedFallback = buildDeterministicFallbackPlan({
          userMessage: input.userMessage,
          routeDecision: {
            ...input.routeDecision,
            route: 'OWNED_MATERIALS_PROJECT_MATCH',
            suggestedTool: 'match_projects_by_owned_materials',
            confidence: 0.95,
          },
          locale: input.locale,
          conversationContext: input.conversationContext,
        });
        ownedFallback.diagnostics.semanticPlannerUsed =
          input.plan.diagnostics.semanticPlannerUsed;
        ownedFallback.diagnostics.semanticRoute =
          input.plan.diagnostics.semanticRoute;
        return ownedFallback;
      }
    }

    if (detectProjectBudgetEstimationIntent(input.userMessage)) {
      return buildProjectBudgetFallbackPlan({
        userMessage: input.userMessage,
        routeDecision: input.routeDecision,
        locale: input.locale,
        conversationContext: input.conversationContext,
        semanticPlannerUsed: input.plan.diagnostics.semanticPlannerUsed,
        semanticRoute: input.plan.diagnostics.semanticRoute,
        plannerConfidence: input.plan.diagnostics.plannerConfidence,
      });
    }

    return domainPreservedPlan;
  }

  if (detectBuildGapIntent(input.userMessage)) {
    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'BUILD_GAP_ANALYSIS',
        suggestedTool: 'analyze_build_gaps',
        confidence: 0.93,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (
    /(قارن|مقارنة|compare)/i.test(input.userMessage) &&
    /(مادتين|مواد|مادة|materials?)/i.test(input.userMessage)
  ) {
    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'MATERIAL_COMPARISON',
        suggestedTool: 'compare_materials',
        confidence: 0.94,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (detectProjectComponentsIntent(input.userMessage)) {
    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'PROJECT_COMPONENTS',
        suggestedTool: 'get_project_required_components',
        confidence: 0.94,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (detectProjectBudgetEstimationIntent(input.userMessage)) {
    return buildProjectBudgetFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: input.routeDecision,
      locale: input.locale,
      conversationContext: input.conversationContext,
      semanticPlannerUsed: input.plan.diagnostics.semanticPlannerUsed,
      semanticRoute: input.plan.diagnostics.semanticRoute,
      plannerConfidence: input.plan.diagnostics.plannerConfidence,
    });
  }

  if (detectProjectMaterialAvailabilityIntent(input.userMessage)) {
    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'PROJECT_MATERIAL_AVAILABILITY',
        suggestedTool: 'match_available_materials_for_project',
        confidence: 0.94,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (detectOwnedMaterialsProjectIntent(input.userMessage)) {
    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'OWNED_MATERIALS_PROJECT_MATCH',
        suggestedTool: 'match_projects_by_owned_materials',
        confidence: 0.95,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (detectMaterialSearchIntent(input.userMessage).detected) {
    if (detectComparisonFollowUpIntent(input.userMessage)) {
      return input.plan;
    }

    const fallback = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        ...input.routeDecision,
        route: 'MATERIAL_SEARCH',
        suggestedTool: 'search_available_materials',
        confidence: 0.94,
      },
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  const ownedSemanticFallback = buildOwnedMaterialsSemanticFallbackPlan({
    userMessage: input.userMessage,
    routeDecision: input.routeDecision,
    locale: input.locale,
    conversationContext: input.conversationContext,
  });
  if (ownedSemanticFallback) {
    ownedSemanticFallback.diagnostics.semanticPlannerUsed =
      input.plan.diagnostics.semanticPlannerUsed;
    ownedSemanticFallback.diagnostics.semanticRoute =
      input.plan.diagnostics.semanticRoute;
    return ownedSemanticFallback;
  }

  return domainPreservedPlan;
};

export const resolveAgentExecutionPlan = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId?: string;
  conversationContext?: PlannerConversationContext;
}): Promise<AgentExecutionPlan> => {
  const dangerous = assessDangerousRequest(input.userMessage);
  if (dangerous.isDangerous) {
    return {
      route: 'DANGEROUS_REQUEST',
      toolName: null,
      toolInput: {},
      diagnostics: {
        deterministicRoute: 'DANGEROUS_REQUEST',
        deterministicConfidence: 0.98,
        semanticPlannerUsed: false,
        semanticRoute: null,
        validatedRoute: 'DANGEROUS_REQUEST',
        normalizedFilters: null,
        toolName: null,
        plannerConfidence: null,
        resolvedEntityTitle: null,
      },
    };
  }

  const routeDecision = resolveAgentRoute({
    userMessage: input.userMessage,
    locale: input.locale,
  });

  if (STATIC_ROUTES.has(routeDecision.route)) {
    return {
      route: routeDecision.route,
      toolName: null,
      toolInput: {},
      diagnostics: {
        deterministicRoute: routeDecision.route,
        deterministicConfidence: routeDecision.confidence,
        semanticPlannerUsed: false,
        semanticRoute: null,
        validatedRoute: routeDecision.route,
        normalizedFilters: null,
        toolName: null,
        plannerConfidence: null,
        resolvedEntityTitle: null,
      },
    };
  }

  const deterministicToolInput = buildToolInputForRoute(
    routeDecision.route,
    input.userMessage,
  );

  const conversationContext =
    input.conversationContext ??
    (input.conversationId
      ? await buildPlannerConversationContext(input.conversationId)
      : undefined);

  const numericBudgetContinuation = conversationContext
    ? resolveProjectsWithinBudgetNumericContinuation(
        input.userMessage,
        conversationContext,
      )
    : null;
  if (numericBudgetContinuation) {
    return buildProjectsWithinBudgetExecutionPlan({
      routeDecision: {
        route: 'PROJECTS_WITHIN_BUDGET',
        confidence: 0.95,
        source: 'deterministic',
        suggestedTool: 'find_projects_within_budget',
      },
      toolInput: numericBudgetContinuation,
      semanticPlannerUsed: false,
      semanticRoute: null,
      plannerConfidence: null,
    });
  }

  if (
    conversationContext &&
    hasRecentProjectBudgetConfirmation(conversationContext) &&
    (isAffirmativeOwnedMaterialsContinuation(input.userMessage) ||
      detectProjectMaterialAvailabilitySelectionFollowUp(input.userMessage))
  ) {
    const confirmationPlan = buildProjectBudgetFallbackPlan({
      userMessage: input.userMessage,
      routeDecision: {
        route: 'PROJECT_BUDGET_ESTIMATION',
        confidence: 0.96,
        source: 'deterministic',
        suggestedTool: 'estimate_project_material_budget',
      },
      locale: input.locale,
      conversationContext,
    });
    if (confirmationPlan.toolInput.projectId) {
      return confirmationPlan;
    }
  }

  const skipPlanner =
    isHighConfidenceDeterministicPlatformPlan({
      routeDecision,
      toolInput: deterministicToolInput,
      userMessage: input.userMessage,
    }) &&
    routeDecision.source === 'deterministic' &&
    !shouldConsultSemanticPlannerForOwnedMaterials(input.userMessage);

  let plan: AgentExecutionPlan;

  if (!skipPlanner) {
    const planner = await planLearnerAgentTurn({
      userMessage: input.userMessage,
      locale: input.locale,
      deterministicRoute: routeDecision.route,
      deterministicArguments: deterministicToolInput,
      conversationContext,
    });

    if (planner) {
      plan = applyPlannerPlan({
        userMessage: input.userMessage,
        routeDecision,
        planner,
        conversationContext,
        locale: input.locale,
      });
    } else {
      plan = buildDeterministicFallbackPlan({
        userMessage: input.userMessage,
        routeDecision,
        locale: input.locale,
        conversationContext,
      });
    }
  } else {
    plan = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision,
      locale: input.locale,
      conversationContext,
    });
  }

  plan = reconcilePlannerWithPlatformIntent({
    userMessage: input.userMessage,
    routeDecision,
    plan,
    locale: input.locale,
    conversationContext,
  });

  if (envIsDevelopment()) {
    logger.info(
      {
        deterministicRoute: plan.diagnostics.deterministicRoute,
        deterministicConfidence: plan.diagnostics.deterministicConfidence,
        semanticPlannerUsed: plan.diagnostics.semanticPlannerUsed,
        semanticRoute: plan.diagnostics.semanticRoute,
        validatedRoute: plan.diagnostics.validatedRoute,
        normalizedFilters: plan.diagnostics.normalizedFilters as SafeLogValue | null,
        toolName: plan.diagnostics.toolName,
        plannerConfidence: plan.diagnostics.plannerConfidence,
        resolvedEntityTitle: plan.diagnostics.resolvedEntityTitle,
      },
      'learner agent understanding diagnostics',
    );
  }

  return plan;
};

const envIsDevelopment = () => process.env.NODE_ENV !== 'production';
