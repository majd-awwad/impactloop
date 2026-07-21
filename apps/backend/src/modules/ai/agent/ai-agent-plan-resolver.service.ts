import { logger } from '../../../observability/logger.js';
import type { SafeLogValue } from '../../../observability/log-types.js';
import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import type { AiLocale } from '../ai.types.js';
import type { AiAgentRouteDecision, AiAgentRouteType } from './ai-agent.types.js';
import {
  detectBuildGapIntent,
  detectComponentMaterialMatchingIntent,
  detectComparisonFollowUpIntent,
  detectEducationalLearningIntent,
  detectActiveProjectBuildsIntent,
  detectMaterialDetailsIntent,
  detectMaterialSearchIntent,
  detectProjectComponentsIntent,
  extractProjectTitleQuery,
  mergeMaterialSearchPlan,
  messageImpliesFreeFilter,
} from './ai-agent-filter-extractor.service.js';
import { buildToolInputForRoute, parseRecommendationInput } from './ai-agent-input-parser.service.js';
import {
  buildPlannerConversationContext,
  type PlannerConversationContext,
} from './ai-agent-planner-context.service.js';
import {
  materialSearchPlanFromPlanner,
  planLearnerAgentTurn,
  type AgentPlannerOutput,
} from './ai-agent-semantic-planner.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
import { assessDangerousRequest } from './ai-agent-safety-guard.service.js';
import { routeToToolName } from './ai-agent-route-mapping.js';
import { resolveEntityFromContext } from './ai-agent-reference-resolver.service.js';

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

const PLATFORM_ROUTES = new Set<AiAgentRouteType>([
  'MATERIAL_SEARCH',
  'MATERIAL_DETAILS',
  'PROJECT_SEARCH',
  'PROJECT_DETAILS',
  'PROJECT_COMPONENTS',
  'SAVED_PROJECTS',
  'ACTIVE_PROJECT_BUILDS',
  'BUILD_CHECKLIST',
  'BUILD_GAP_ANALYSIS',
  'COMPONENT_MATERIAL_MATCHING',
  'PROJECT_MATERIAL_MATCHING',
  'MATERIAL_COMPARISON',
  'PROJECT_COMPARISON',
  'PERSONALIZED_RECOMMENDATION',
  'ACTION_REQUEST',
  'EXTERNAL_DOMAIN_KNOWLEDGE',
]);

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
      typeof input.toolInput.query === 'string' &&
      input.userMessage.toLowerCase().includes(String(input.toolInput.query).toLowerCase()) &&
      String(input.toolInput.query).split(/\s+/).length >= 3
    ) {
      return false;
    }
  }

  if (
    detectComponentMaterialMatchingIntent(input.userMessage) &&
    extractProjectTitleQuery(input.userMessage)
  ) {
    return true;
  }

  if (
    input.routeDecision.route === 'COMPONENT_MATERIAL_MATCHING' ||
    input.routeDecision.route === 'PROJECT_MATERIAL_MATCHING'
  ) {
    return true;
  }

  return true;
};

const buildDeterministicFallbackPlan = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
}): AgentExecutionPlan => {
  let route = input.routeDecision.route;
  let toolInput = buildToolInputForRoute(route, input.userMessage);

  if (route === 'CLARIFICATION' || route === 'GENERAL_LEARNING') {
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

const applyPlannerPlan = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  planner: AgentPlannerOutput;
  conversationContext?: PlannerConversationContext;
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

  return preserveDeterministicDomainLearning({
    userMessage: input.userMessage,
    plan: input.plan,
  });
};

const reconcilePlannerWithPlatformIntent = (input: {
  userMessage: string;
  routeDecision: AiAgentRouteDecision;
  plan: AgentExecutionPlan;
}): AgentExecutionPlan => {
  const domainPreservedPlan = preserveDeterministicDomainLearning({
    userMessage: input.userMessage,
    plan: input.plan,
  });

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
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  if (
    input.plan.route !== 'GENERAL_LEARNING' &&
    input.plan.route !== 'CLARIFICATION'
  ) {
    return preserveDeterministicDomainLearning({
      userMessage: input.userMessage,
      plan: input.plan,
    });
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
    });
    fallback.diagnostics.semanticPlannerUsed = input.plan.diagnostics.semanticPlannerUsed;
    fallback.diagnostics.semanticRoute = input.plan.diagnostics.semanticRoute;
    return fallback;
  }

  return preserveDeterministicDomainLearning({
    userMessage: input.userMessage,
    plan: input.plan,
  });
};

export const resolveAgentExecutionPlan = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId?: string;
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

  const conversationContext = input.conversationId
    ? await buildPlannerConversationContext(input.conversationId)
    : undefined;

  const skipPlanner =
    isHighConfidenceDeterministicPlatformPlan({
      routeDecision,
      toolInput: deterministicToolInput,
      userMessage: input.userMessage,
    }) && routeDecision.source === 'deterministic';

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
      });
    } else {
      plan = buildDeterministicFallbackPlan({
        userMessage: input.userMessage,
        routeDecision,
      });
    }
  } else {
    plan = buildDeterministicFallbackPlan({
      userMessage: input.userMessage,
      routeDecision,
    });
  }

  plan = reconcilePlannerWithPlatformIntent({
    userMessage: input.userMessage,
    routeDecision,
    plan,
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
