import type { AiLocale } from '../ai.types.js';

export const AI_AGENT_ROUTE_TYPES = [
  'CONVERSATIONAL_STATIC',
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
