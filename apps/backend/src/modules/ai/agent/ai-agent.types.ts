import type { AiLocale } from '../ai.types.js';

export const SEMANTIC_ROUTES = [
  'PLATFORM_GUIDANCE',
  'SYSTEM_DATA_QUERY',
  'ACTION_REQUEST',
  'GENERAL_LEARNING',
  'OUT_OF_SCOPE',
  'CLARIFICATION_REQUIRED',
] as const;

export type SemanticRoute = (typeof SEMANTIC_ROUTES)[number];

export type PlatformGuidanceTopic =
  | 'MATERIAL_RESERVATION'
  | 'RESERVATION_CANCELLATION'
  | 'SAVE_PROJECT'
  | 'MATERIAL_DELIVERY'
  | 'RESERVATION_AFTER_SUPPLIER'
  | 'GENERAL_PLATFORM';

export const SYSTEM_DATA_TOPICS = [
  'MATERIAL_SEARCH',
  'MATERIAL_DETAILS',
  'PROJECT_SEARCH',
  'PROJECT_DETAILS',
  'PROJECT_COMPONENTS',
  'SAVED_PROJECTS',
  'ACTIVE_PROJECT_BUILDS',
  'BUILD_GAP_ANALYSIS',
  'COMPONENT_MATERIAL_MATCHING',
  'PROJECT_MATERIAL_AVAILABILITY',
  'PROJECT_BUDGET_ESTIMATION',
  'PROJECTS_WITHIN_BUDGET',
  'OWNED_MATERIALS_PROJECT_MATCH',
  'MATERIAL_COMPARISON',
  'PROJECT_COMPARISON',
  'PERSONALIZED_RECOMMENDATION',
] as const;

export type SystemDataTopic = (typeof SYSTEM_DATA_TOPICS)[number];

export const SEMANTIC_ACTION_TYPES = [
  'SAVE_MATERIAL',
  'UNSAVE_MATERIAL',
  'SAVE_PROJECT',
  'UNSAVE_PROJECT',
  'START_PROJECT_BUILD',
  'LINK_MATERIAL_TO_BUILD_COMPONENT',
  'UNLINK_MATERIAL_FROM_BUILD_COMPONENT',
  'PREPARE_MATERIAL_RESERVATION',
] as const;

export type SemanticActionType = (typeof SEMANTIC_ACTION_TYPES)[number];

export type SemanticExecutionPlan = {
  route: AiAgentRouteType;
  toolName: string | null;
  toolInput: Record<string, unknown>;
  clarificationReason?: string;
  semanticRoute: SemanticRoute;
  platformGuidanceTopic?: PlatformGuidanceTopic;
  plannerConfidence: number;
};

export type AgentTurnExecutionResultBase = {
  semanticRoute?: SemanticRoute;
};

export const AI_AGENT_ROUTE_TYPES = [
  'CONVERSATIONAL_STATIC',
  'PLATFORM_GUIDANCE',
  'GENERAL_LEARNING',
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
  'PROJECT_MATERIAL_AVAILABILITY',
  'PROJECT_BUDGET_ESTIMATION',
  'PROJECTS_WITHIN_BUDGET',
  'OWNED_MATERIALS_PROJECT_MATCH',
  'MATERIAL_COMPARISON',
  'PROJECT_COMPARISON',
  'PERSONALIZED_RECOMMENDATION',
  'ACTION_REQUEST',
  'EXTERNAL_DOMAIN_KNOWLEDGE',
  'OUT_OF_SCOPE',
  'DANGEROUS_REQUEST',
  'CLARIFICATION',
] as const;

export type AiAgentRouteType = (typeof AI_AGENT_ROUTE_TYPES)[number];

export const AI_AGENT_PLATFORM_ROUTES = [
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
  'PROJECT_MATERIAL_AVAILABILITY',
  'PROJECT_BUDGET_ESTIMATION',
  'PROJECTS_WITHIN_BUDGET',
  'OWNED_MATERIALS_PROJECT_MATCH',
  'MATERIAL_COMPARISON',
  'PROJECT_COMPARISON',
  'PERSONALIZED_RECOMMENDATION',
  'ACTION_REQUEST',
  'EXTERNAL_DOMAIN_KNOWLEDGE',
] as const satisfies readonly AiAgentRouteType[];

export type AiAgentRouteDecision = {
  route: AiAgentRouteType;
  confidence: number;
  source: 'deterministic' | 'planner';
  suggestedTool?: string;
  reason?: string;
};

export type AiToolExecutionContext = {
  authenticatedUserId: string;
  conversationId: string;
  locale: AiLocale;
  requestId: string | null;
  clientMessageId: string;
};

export const AI_AGENT_LIMITS = {
  maxReadToolCalls: 3,
  maxPreparedWriteActions: 1,
  maxMaterialResults: 10,
  maxProjectResults: 10,
  maxComparisonItems: 4,
} as const;
