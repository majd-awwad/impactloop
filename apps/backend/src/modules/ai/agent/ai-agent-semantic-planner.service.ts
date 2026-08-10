import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import {
  env,
  getConfiguredGeminiApiKey,
  getGeminiChatModelCandidates,
  isAiChatProviderOperational,
  resolveAiChatProvider,
} from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';
import { AppError } from '../../../utils/app-error.js';
import { extractJsonObject } from '../../../services/gemini-price-suggestion.provider.js';
import type { AiLocale } from '../ai.types.js';
import { PLATFORM_GUIDANCE_TOPICS } from '../ai.policy.js';
import type {
  AiAgentRouteType,
  PlatformGuidanceTopic,
  SemanticActionType,
  SemanticExecutionPlan,
  SemanticRoute,
  SystemDataTopic,
} from './ai-agent.types.js';
import { routeToToolName } from './ai-agent-route-mapping.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
import {
  detectEducationalLearningIntent,
  detectPlatformGuidanceIntent,
  extractBudgetBound,
  parseProjectsWithinBudgetInput,
} from './ai-agent-filter-extractor.service.js';
import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import { buildToolInputForRoute } from './ai-agent-input-parser.service.js';
import { getRegisteredTool, isRegisteredToolName } from './ai-tool-registry.js';
import {
  mergeMaterialSearchPlan,
  normalizeMaterialItemQuery,
  isMaterialSearchNoiseQuery,
  normalizeMaterialCategoryText,
  parseOwnedMaterialsProjectInput,
  resolveOwnedMaterialsFromConversation,
  extractProjectTitleQuery,
} from './ai-agent-filter-extractor.service.js';
import {
  summarizePlannerContextForPrompt,
  type PlannerConversationContext,
} from './ai-agent-planner-context.service.js';
import { detectBuildGuideLinkAction } from './ai-agent-reference-resolver.service.js';

const resolveSemanticActionFromMessage = (
  userMessage: string,
): SemanticActionType | null => {
  const text = userMessage.toLowerCase();
  if (
    /(احفظ|save)/i.test(text) &&
    (/(مادة|material)/i.test(text) || /(أرخص|ارخص|cheaper)/i.test(text))
  ) {
    return 'SAVE_MATERIAL';
  }
  if (
    (/(شيل|remove|الغ|إلغاء|unsave)/i.test(text) &&
      /(المحفوظات|من المحفوظ|saved)/i.test(text) &&
      !/(مشروع|project)/i.test(text)) ||
    (/(الغ|إلغاء|unsave|remove).*(حفظ|save)/i.test(text) && /(مادة|material)/i.test(text))
  ) {
    return 'UNSAVE_MATERIAL';
  }
  if (/(احجز|reserve|book)/i.test(text)) {
    return 'PREPARE_MATERIAL_RESERVATION';
  }
  if (
    /(ابدأ|start)/i.test(text) &&
    (/(مشروع|project|build)/i.test(text) || /(أسهل|اسهل|easier)/i.test(text))
  ) {
    return 'START_PROJECT_BUILD';
  }
  if (
    /(فك الربط|فك ربط|الغ.? الربط|شيل المادة المربوطة|افصل المادة عن المكون|unlink it|remove the linked material)/i.test(
      text,
    )
  ) {
    return 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT';
  }
  if (
    (/(فك الربط|فك ربط|unlink)/i.test(text) && /(مكون|component|هالمكون|هالكومبوننت)/i.test(text)) ||
    (/(الغ|إلغاء|unlink).*(ربط|link)/i.test(text) && /(مادة|material|مكون|component)/i.test(text))
  ) {
    return 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT';
  }
  if (/\bunlink\b/i.test(text) && /\b(material|component)\b/i.test(text)) {
    return 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT';
  }
  if (detectBuildGuideLinkAction(userMessage) && !/\bunlink\b/i.test(text)) {
    return 'LINK_MATERIAL_TO_BUILD_COMPONENT';
  }
  if (
    /(احفظ|save)/i.test(text) &&
    (/(مشروع|project)/i.test(text) || /(أسهل|اسهل|easier)/i.test(text))
  ) {
    return 'SAVE_PROJECT';
  }
  if (
    /(احفظ|save)/i.test(text) &&
    /(أول|الاول|ثاني|الثاني|third|ثالث)/i.test(text) &&
    !/(مادة|material|أرخص|ارخص|cheaper)/i.test(text)
  ) {
    return 'SAVE_PROJECT';
  }
  if (
    (/(شيل|remove|الغ|إلغاء|unsave)/i.test(text) &&
      /(المشاريع المحفوظة|من المحفوظ|saved project)/i.test(text)) ||
    (/(الغ|إلغاء|unsave|remove).*(حفظ|save)/i.test(text) && /(مشروع|project)/i.test(text))
  ) {
    return 'UNSAVE_PROJECT';
  }
  return null;
};

/** Production capability marker — semantic-first routing active at version 2. */
export const AI_SEMANTIC_ROUTER_VERSION = 2;

const SEMANTIC_ROUTES = [
  'PLATFORM_GUIDANCE',
  'SYSTEM_DATA_QUERY',
  'ACTION_REQUEST',
  'GENERAL_LEARNING',
  'OUT_OF_SCOPE',
  'CLARIFICATION_REQUIRED',
] as const;

const SYSTEM_DATA_TOPICS = [
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
  'LEARNER_RESERVATION_STATUS',
] as const;

const SEMANTIC_ACTION_TYPES = [
  'SAVE_MATERIAL',
  'UNSAVE_MATERIAL',
  'SAVE_PROJECT',
  'UNSAVE_PROJECT',
  'START_PROJECT_BUILD',
  'LINK_MATERIAL_TO_BUILD_COMPONENT',
  'UNLINK_MATERIAL_FROM_BUILD_COMPONENT',
  'PREPARE_MATERIAL_RESERVATION',
] as const;

const semanticEntitySchema = z
  .object({
    type: z.enum(['MATERIAL', 'PROJECT', 'BUILD', 'COMPONENT']),
    mention: z.string().trim().min(1).max(120),
    referenceType: z.enum([
      'EXPLICIT_NAME',
      'RECENT_RESULT',
      'RESULT_INDEX',
      'PRONOUN',
      'UNKNOWN',
    ]),
    resultIndex: z.number().int().nullable().optional(),
  })
  .strict();

const semanticFiltersSchema = z
  .object({
    query: z.string().trim().min(1).max(120).nullable().optional(),
    categoryText: z.string().trim().min(1).max(80).nullable().optional(),
    isFree: z.boolean().nullable().optional(),
    minPrice: z.number().nullable().optional(),
    maxPrice: z.number().nullable().optional(),
    city: z.string().trim().min(1).max(80).nullable().optional(),
    area: z.string().trim().min(1).max(80).nullable().optional(),
    nearLearner: z.boolean().nullable().optional(),
    pickupAllowed: z.boolean().nullable().optional(),
    deliveryAllowed: z.boolean().nullable().optional(),
    limit: z.number().int().positive().max(20).nullable().optional(),
  })
  .strict();

export const semanticUnderstandingSchema = z
  .object({
    schemaVersion: z.literal(1),
    route: z.enum(SEMANTIC_ROUTES),
    topic: z
      .union([z.enum(PLATFORM_GUIDANCE_TOPICS), z.enum(SYSTEM_DATA_TOPICS)])
      .nullable(),
    action: z.enum(SEMANTIC_ACTION_TYPES).nullable(),
    entities: z.array(semanticEntitySchema).max(12).default([]),
    filters: semanticFiltersSchema.optional(),
    confidence: z.number().min(0).max(1),
    needsClarification: z.boolean().default(false),
    clarificationQuestion: z.string().trim().min(1).max(500).nullable(),
    toolCall: z
      .object({
        name: z.string().trim().min(1),
        arguments: z.record(z.string(), z.unknown()).default({}),
      })
      .nullable()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.needsClarification && !value.clarificationQuestion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'clarificationQuestion is required when needsClarification is true',
      });
    }
    if (value.route === 'PLATFORM_GUIDANCE' && !value.topic) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'topic is required for PLATFORM_GUIDANCE',
      });
    }
    if (value.route === 'SYSTEM_DATA_QUERY' && !value.topic && !value.toolCall) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'topic or toolCall is required for SYSTEM_DATA_QUERY',
      });
    }
    if (value.route === 'ACTION_REQUEST' && !value.action && !value.needsClarification) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'action is required for ACTION_REQUEST unless needsClarification',
      });
    }
  });

export type SemanticUnderstanding = z.infer<typeof semanticUnderstandingSchema>;

export type SemanticPlannerFailureReason =
  | 'provider_unavailable'
  | 'semantic_invalid';

export type SemanticPlannerResult =
  | { status: 'success'; understanding: SemanticUnderstanding }
  | { status: 'failure'; reason: SemanticPlannerFailureReason };

const SEMANTIC_PLANNER_PROVIDER_FAILURE_CODES = new Set([
  'AI_DISABLED',
  'AI_PROVIDER_AUTH_ERROR',
  'AI_PROVIDER_ERROR',
  'AI_PROVIDER_MODEL_UNAVAILABLE',
  'AI_PROVIDER_QUOTA_EXCEEDED',
  'AI_PROVIDER_TIMEOUT',
  'AI_RESPONSE_INVALID',
]);

export const isSemanticPlannerProviderFailure = (
  error: unknown,
): boolean => {
  if (error instanceof AppError) {
    return SEMANTIC_PLANNER_PROVIDER_FAILURE_CODES.has(error.code);
  }

  if (error instanceof SyntaxError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('fetch failed') ||
      message.includes('429') ||
      message.includes('quota')
    );
  }

  return false;
};

const toSemanticPlannerFailure = (
  reason: SemanticPlannerFailureReason = 'provider_unavailable',
): SemanticPlannerResult => ({
  status: 'failure',
  reason,
});

const normalizeSemanticPlannerOverrideResult = (
  result: SemanticPlannerResult | SemanticUnderstanding | null,
): SemanticPlannerResult => {
  if (result === null) {
    return toSemanticPlannerFailure();
  }

  if ('status' in result) {
    return result;
  }

  return { status: 'success', understanding: result };
};

const ACTION_CONFIDENCE_THRESHOLD = 0.72;

const LEGACY_PLANNER_SYSTEM_DATA_ROUTES = new Set<string>(SYSTEM_DATA_TOPICS);

const SEMANTIC_FILTER_KEYS = new Set([
  'query',
  'categoryText',
  'isFree',
  'minPrice',
  'maxPrice',
  'city',
  'area',
  'nearLearner',
  'pickupAllowed',
  'deliveryAllowed',
  'limit',
] as const);

const SEMANTIC_FILTER_ALIASES: Record<string, string> = {
  freeOnly: 'isFree',
};

const TOPIC_DEFAULT_TOOL_NAMES: Partial<Record<string, string>> = {
  MATERIAL_SEARCH: 'search_available_materials',
  PROJECT_SEARCH: 'search_learning_projects',
};

const compactNullableRecord = (
  value: unknown,
): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const compact: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== null && entry !== undefined) {
      compact[key] = entry;
    }
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
};

const normalizeSemanticFilters = (
  value: unknown,
): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === null || entry === undefined) {
      continue;
    }

    const targetKey = SEMANTIC_FILTER_ALIASES[key] ?? key;
    if ((SEMANTIC_FILTER_KEYS as Set<string>).has(targetKey)) {
      if (targetKey === 'maxPrice' || targetKey === 'minPrice') {
        const numeric =
          typeof entry === 'string' ? Number(entry.trim()) : entry;
        if (typeof numeric === 'number' && !Number.isNaN(numeric)) {
          normalized[targetKey] = numeric;
        }
        continue;
      }
      normalized[targetKey] = entry;
      continue;
    }

    if (key === 'materialType' && typeof entry === 'string' && entry.trim()) {
      normalized.query = entry.trim();
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizePlannerToolArguments = (
  toolName: string,
  argumentsValue: Record<string, unknown>,
): Record<string, unknown> => {
  const normalized: Record<string, unknown> = { ...argumentsValue };

  if (toolName === 'search_learning_projects') {
    if (typeof normalized.level === 'string' && !normalized.difficulty) {
      const level = normalized.level.trim().toUpperCase();
      if (level === 'BEGINNER' || level === 'INTERMEDIATE' || level === 'ADVANCED') {
        normalized.difficulty = level;
      }
      delete normalized.level;
    }
    if (typeof normalized.difficulty === 'string') {
      const difficulty = normalized.difficulty.trim().toUpperCase();
      if (
        difficulty === 'BEGINNER' ||
        difficulty === 'INTERMEDIATE' ||
        difficulty === 'ADVANCED'
      ) {
        normalized.difficulty = difficulty;
      }
    }
  }

  for (const key of ['maxPrice', 'minPrice', 'limit']) {
    const entry = normalized[key];
    if (typeof entry === 'string' && entry.trim()) {
      const numeric = Number(entry.trim());
      if (!Number.isNaN(numeric)) {
        normalized[key] = numeric;
      }
    }
  }

  return normalized;
};

const normalizeSemanticToolCall = (
  value: unknown,
  topic?: unknown,
): SemanticUnderstanding['toolCall'] => {
  if (topic === 'LEARNER_RESERVATION_STATUS') {
    return null;
  }

  if (typeof value === 'string' && value.trim()) {
    const name = value.trim();
    if (name === 'get_learner_reservations') {
      return null;
    }
    return { name, arguments: {} };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const name =
    typeof source.name === 'string'
      ? source.name.trim()
      : typeof source.tool === 'string'
        ? source.tool.trim()
        : '';

  if (!name || name === 'get_learner_reservations') {
    return null;
  }

  const argumentsValue =
    source.arguments &&
    typeof source.arguments === 'object' &&
    !Array.isArray(source.arguments)
      ? normalizePlannerToolArguments(
          name,
          source.arguments as Record<string, unknown>,
        )
      : {};

  return { name, arguments: argumentsValue };
};

const normalizeSemanticTopic = (
  route: unknown,
  topic: unknown,
): unknown => {
  if (route === 'SYSTEM_DATA_QUERY' && topic === 'MATERIAL_RESERVATION') {
    return 'LEARNER_RESERVATION_STATUS';
  }
  return topic;
};

const inferToolCallForTopic = (
  route: unknown,
  topic: unknown,
  toolCall: SemanticUnderstanding['toolCall'],
): SemanticUnderstanding['toolCall'] => {
  if (toolCall?.name || route !== 'SYSTEM_DATA_QUERY' || typeof topic !== 'string') {
    return toolCall;
  }

  const defaultToolName = TOPIC_DEFAULT_TOOL_NAMES[topic];
  if (!defaultToolName) {
    return toolCall;
  }

  return { name: defaultToolName, arguments: {} };
};

const normalizeSemanticEntities = (
  value: unknown,
): SemanticUnderstanding['entities'] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const entities: SemanticUnderstanding['entities'] = [];
  for (const entry of value) {
    const parsed = semanticEntitySchema.safeParse(entry);
    if (parsed.success) {
      entities.push(parsed.data);
    }
  }
  return entities;
};

/**
 * Normalizes raw Gemini / legacy planner JSON into the v2 semantic contract
 * before strict Zod validation. Rejects unrelated payload shapes upstream.
 */
export const coerceSemanticUnderstandingFromGemini = (
  raw: unknown,
): unknown => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }

  const source = raw as Record<string, unknown>;
  let route = source.route;

  if (typeof route === 'string' && LEGACY_PLANNER_SYSTEM_DATA_ROUTES.has(route)) {
    const topic = route;
    const normalizedToolCall = inferToolCallForTopic(
      'SYSTEM_DATA_QUERY',
      topic,
      normalizeSemanticToolCall(source.toolCall, topic),
    );
    return {
      schemaVersion: 1,
      route: 'SYSTEM_DATA_QUERY',
      topic,
      action: null,
      entities: normalizeSemanticEntities(source.entities),
      filters: normalizeSemanticFilters(source.filters),
      confidence: typeof source.confidence === 'number' ? source.confidence : 0.85,
      needsClarification:
        source.needsClarification === true || source.clarificationNeeded === true,
      clarificationQuestion:
        typeof source.clarificationQuestion === 'string'
          ? source.clarificationQuestion
          : typeof source.clarificationReason === 'string'
            ? source.clarificationReason
            : null,
      toolCall: normalizedToolCall,
    };
  }

  if (route === 'CLARIFICATION') {
    route = 'CLARIFICATION_REQUIRED';
  }

  const needsClarification =
    source.needsClarification === true || source.clarificationNeeded === true;
  const topic = normalizeSemanticTopic(route, source.topic ?? null);
  const normalizedToolCall = inferToolCallForTopic(
    route,
    topic,
    normalizeSemanticToolCall(source.toolCall, topic),
  );

  return {
    schemaVersion: source.schemaVersion ?? 1,
    route,
    topic,
    action: source.action ?? null,
    entities: normalizeSemanticEntities(source.entities),
    filters: normalizeSemanticFilters(source.filters),
    confidence: typeof source.confidence === 'number' ? source.confidence : 0.85,
    needsClarification,
    clarificationQuestion:
      typeof source.clarificationQuestion === 'string'
        ? source.clarificationQuestion
        : typeof source.clarificationReason === 'string'
          ? source.clarificationReason
          : null,
    toolCall: normalizedToolCall,
  };
};

export const validateSemanticUnderstanding = (
  raw: unknown,
): SemanticUnderstanding | null => {
  const coerced = coerceSemanticUnderstandingFromGemini(raw);
  const parsed = semanticUnderstandingSchema.safeParse(coerced);
  if (!parsed.success) {
    return null;
  }

  const data = parsed.data;

  if (data.toolCall?.name) {
    if (!isRegisteredToolName(data.toolCall.name)) {
      if (data.topic === 'LEARNER_RESERVATION_STATUS') {
        return { ...data, toolCall: undefined };
      }
      return null;
    }
    try {
      const sanitized = sanitizePlannerArguments(
        data.toolCall.name,
        data.toolCall.arguments ?? {},
      );
      return { ...data, toolCall: { name: data.toolCall.name, arguments: sanitized } };
    } catch {
      if (data.filters && Object.keys(data.filters).length > 0) {
        return {
          ...data,
          toolCall: { name: data.toolCall.name, arguments: {} },
        };
      }
      return null;
    }
  }

  return data;
};

const systemDataTopicToRoute = (
  topic: SystemDataTopic,
): AiAgentRouteType => topic as AiAgentRouteType;

export const mapSemanticToExecutionPlan = (
  understanding: SemanticUnderstanding,
): SemanticExecutionPlan => {
  if (
    understanding.route === 'ACTION_REQUEST' &&
    (understanding.needsClarification ||
      understanding.confidence < ACTION_CONFIDENCE_THRESHOLD)
  ) {
    return {
      route: 'CLARIFICATION',
      toolName: null,
      toolInput: {},
      clarificationReason:
        understanding.clarificationQuestion ??
        'Please clarify what action you want me to perform.',
      semanticRoute: 'CLARIFICATION_REQUIRED',
      plannerConfidence: understanding.confidence,
    };
  }

  if (understanding.route === 'CLARIFICATION_REQUIRED' || understanding.needsClarification) {
    return {
      route: 'CLARIFICATION',
      toolName: null,
      toolInput: {},
      clarificationReason:
        understanding.clarificationQuestion ??
        'Please clarify your request.',
      semanticRoute: 'CLARIFICATION_REQUIRED',
      plannerConfidence: understanding.confidence,
    };
  }

  if (understanding.route === 'PLATFORM_GUIDANCE') {
    return {
      route: 'PLATFORM_GUIDANCE',
      toolName: null,
      toolInput: {},
      semanticRoute: 'PLATFORM_GUIDANCE',
      platformGuidanceTopic: understanding.topic as PlatformGuidanceTopic,
      plannerConfidence: understanding.confidence,
    };
  }

  if (understanding.route === 'GENERAL_LEARNING') {
    return {
      route: 'GENERAL_LEARNING',
      toolName: null,
      toolInput: {},
      semanticRoute: 'GENERAL_LEARNING',
      plannerConfidence: understanding.confidence,
    };
  }

  if (understanding.route === 'OUT_OF_SCOPE') {
    return {
      route: 'OUT_OF_SCOPE',
      toolName: null,
      toolInput: {},
      semanticRoute: 'OUT_OF_SCOPE',
      plannerConfidence: understanding.confidence,
    };
  }

  if (understanding.route === 'ACTION_REQUEST') {
    return {
      route: 'ACTION_REQUEST',
      toolName: 'prepare_action',
      toolInput: {
        action: understanding.action,
        entities: understanding.entities,
      },
      semanticRoute: 'ACTION_REQUEST',
      plannerConfidence: understanding.confidence,
    };
  }

  if (understanding.topic === 'LEARNER_RESERVATION_STATUS') {
    return {
      route: 'MATERIAL_DETAILS',
      toolName: null,
      toolInput: {},
      semanticRoute: 'SYSTEM_DATA_QUERY',
      plannerConfidence: understanding.confidence,
    };
  }

  const granularRoute = systemDataTopicToRoute(
    (understanding.topic ??
      'MATERIAL_SEARCH') as SystemDataTopic,
  );
  const toolName =
    understanding.toolCall?.name ?? routeToToolName(granularRoute);
  let toolInput: Record<string, unknown> = {};

  if (understanding.filters) {
    for (const [key, value] of Object.entries(understanding.filters)) {
      if (value !== null && value !== undefined) {
        toolInput[key] = value;
      }
    }
  }

  if (understanding.toolCall?.name && isRegisteredToolName(understanding.toolCall.name)) {
    try {
      toolInput = {
        ...toolInput,
        ...sanitizePlannerArguments(
          understanding.toolCall.name,
          understanding.toolCall.arguments ?? {},
        ),
      };
    } catch {
      if (Object.keys(toolInput).length === 0) {
        toolInput = {};
      }
    }
  }

  return {
    route: granularRoute,
    toolName,
    toolInput,
    semanticRoute: 'SYSTEM_DATA_QUERY',
    plannerConfidence: understanding.confidence,
  };
};

export const buildSemanticPlannerPrompt = (input: {
  userMessage: string;
  locale: AiLocale;
  conversationContext?: PlannerConversationContext;
}) =>
  [
    'You classify learner messages for ImpactLoop unified chat.',
    'Return strict JSON only matching the semantic understanding schema.',
    'Understand Arabic (MSA and Levantine dialect), English, and code-switching.',
    'Semantic routes (choose exactly one):',
    '- PLATFORM_GUIDANCE: how-to questions about ImpactLoop workflows (reserve, save, delivery) without asking you to perform the action',
    '- SYSTEM_DATA_QUERY: search or read learner/platform data (materials, projects, builds, budgets, owned-materials matching)',
    '- ACTION_REQUEST: imperative requests to save, reserve, link, start build, etc. (requires confirmation)',
    '- GENERAL_LEARNING: educational explanations without platform data lookup',
    '- OUT_OF_SCOPE: weather, news, sports, unrelated general knowledge',
    '- CLARIFICATION_REQUIRED: ambiguous message needing more detail',
    'Platform guidance topics:',
    PLATFORM_GUIDANCE_TOPICS.join(', '),
    'System data topics:',
    SYSTEM_DATA_TOPICS.join(', '),
    'Action types:',
    SEMANTIC_ACTION_TYPES.join(', '),
    'Never include userId, coordinates, conversationId, or arbitrary database IDs.',
    'Never invent inventory facts.',
    'Always include every top-level field: schemaVersion, route, topic, action, entities, filters, confidence, needsClarification, clarificationQuestion, toolCall.',
    'toolCall must be an object { name, arguments } or null — never a bare tool name string.',
    'filters may only use: query, categoryText, isFree, minPrice, maxPrice, city, area, nearLearner, pickupAllowed, deliveryAllowed, limit.',
    'Use null for topic, action, and clarificationQuestion when not applicable.',
    'Representative examples (meaning only):',
    '- "شو أعمل عشان أطلب قطعة من المواد الموجودة؟" -> PLATFORM_GUIDANCE, topic MATERIAL_RESERVATION',
    '- "وين بروح بالتطبيق إذا لقيت مادة وعجبتني؟" -> PLATFORM_GUIDANCE, topic MATERIAL_RESERVATION (navigation to reserve, not project matching)',
    '- "كيف بقدر أنشر مادة عندي؟" -> PLATFORM_GUIDANCE, topic GENERAL_PLATFORM (supplier publish workflow guidance only)',
    '- "ورجيني مواد إلكترونية متاحة ممكن أستخدمها مع Arduino" -> SYSTEM_DATA_QUERY, topic MATERIAL_SEARCH, toolCall.name search_available_materials, filters.categoryText electronics, filters.query arduino',
    '- "ورجيني مواد إلكترونية قريبة مني وسعرها أقل من 20 شيكل" -> SYSTEM_DATA_QUERY, topic MATERIAL_SEARCH, toolCall.name search_available_materials, filters.nearLearner true, filters.maxPrice 20 (read saved location only; never update profile)',
    '- "هل عندي حجوزات معلقة؟" -> SYSTEM_DATA_QUERY, topic LEARNER_RESERVATION_STATUS, toolCall null (learner reservation read, not platform how-to guidance)',
    '- "ورجيني مشاريع تعلم مناسبة للمبتدئين في الإلكترونيات" -> SYSTEM_DATA_QUERY, topic PROJECT_SEARCH, toolCall.name search_learning_projects',
    '- When latestMaterialResultSet exists in trusted context and the user narrows those results (e.g. free only, "from them"), use SYSTEM_DATA_QUERY + MATERIAL_SEARCH with filters on the prior result set — never GENERAL_LEARNING',
    '- "بس ورجيني المجاني منهم" after material results -> SYSTEM_DATA_QUERY, topic MATERIAL_SEARCH, filters.isFree true (continuation on latestMaterialResultSet, not a fresh unrelated search)',
    '- "Only show me the free ones." after material results -> SYSTEM_DATA_QUERY, topic MATERIAL_SEARCH, filters.isFree true',
    '- Arduino/ESP32/robotics mentioned only as intended use for materials is MATERIAL_SEARCH, not PROJECT_MATERIAL_AVAILABILITY, unless the user names a specific published learning project or build',
    '- "اشرحلي كيف بشتغل حساس الضوء LDR" -> GENERAL_LEARNING',
    '- "شو الطقس اليوم؟" -> OUT_OF_SCOPE',
    '- "بدي آخذ هالخشبة" without trusted prior material -> CLARIFICATION_REQUIRED with a focused question',
    'Output shape:',
    JSON.stringify(
      {
        schemaVersion: 1,
        route: 'SYSTEM_DATA_QUERY',
        topic: 'MATERIAL_SEARCH',
        action: null,
        entities: [],
        filters: { categoryText: 'electronics', query: 'arduino' },
        confidence: 0.93,
        needsClarification: false,
        clarificationQuestion: null,
        toolCall: { name: 'search_available_materials', arguments: {} },
      },
      null,
      2,
    ),
    `Locale: ${input.locale}`,
    input.conversationContext
      ? `Trusted conversation context:\n${summarizePlannerContextForPrompt(input.conversationContext)}`
      : 'Trusted conversation context: none',
    `User message: ${JSON.stringify(input.userMessage)}`,
  ].join('\n\n');

const buildMockSemanticUnderstanding = (input: {
  userMessage: string;
  locale: AiLocale;
}): SemanticUnderstanding | null => {
  const scope = classifyScopeDeterministic(input.userMessage);
  if (scope.classification === 'OUT_OF_SCOPE') {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'OUT_OF_SCOPE',
      topic: null,
      action: null,
      entities: [],
      confidence: scope.confidence,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }

  const guidanceTopic = detectPlatformGuidanceIntent(input.userMessage);
  if (guidanceTopic) {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'PLATFORM_GUIDANCE',
      topic: guidanceTopic,
      action: null,
      entities: [],
      confidence: 0.94,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }

  if (detectEducationalLearningIntent(input.userMessage)) {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'GENERAL_LEARNING',
      topic: null,
      action: null,
      entities: [],
      confidence: 0.9,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }

  const routeDecision = resolveAgentRoute({
    userMessage: input.userMessage,
    locale: input.locale,
  });

  if (routeDecision.route === 'PLATFORM_GUIDANCE') {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'PLATFORM_GUIDANCE',
      topic: detectPlatformGuidanceIntent(input.userMessage) ?? 'GENERAL_PLATFORM',
      action: null,
      entities: [],
      confidence: routeDecision.confidence,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }

  if (routeDecision.route === 'OUT_OF_SCOPE') {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'OUT_OF_SCOPE',
      topic: null,
      action: null,
      entities: [],
      confidence: routeDecision.confidence,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }

  if (routeDecision.route === 'GENERAL_LEARNING') {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'GENERAL_LEARNING',
      topic: null,
      action: null,
      entities: [],
      confidence: routeDecision.confidence,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }

  if (routeDecision.route === 'ACTION_REQUEST') {
    const action = resolveSemanticActionFromMessage(input.userMessage);
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'ACTION_REQUEST',
      topic: null,
      action: action ?? 'PREPARE_MATERIAL_RESERVATION',
      entities: [],
      confidence: routeDecision.confidence,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }

  if (routeDecision.route === 'CLARIFICATION') {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'CLARIFICATION_REQUIRED',
      topic: null,
      action: null,
      entities: [],
      confidence: routeDecision.confidence,
      needsClarification: true,
      clarificationQuestion: 'Please clarify your request.',
      toolCall: null,
    });
  }

  const systemTopic = SYSTEM_DATA_TOPICS.find(
    (topic) => topic === routeDecision.route,
  );
  if (!systemTopic) {
    return null;
  }

  const toolName = routeDecision.suggestedTool ?? routeToToolName(routeDecision.route);
  const toolCall = toolName
    ? tryBuildValidatedToolCall(toolName, routeDecision.route, input.userMessage)
    : null;

  return validateSemanticUnderstanding({
    schemaVersion: 1,
    route: 'SYSTEM_DATA_QUERY',
    topic: systemTopic,
    action: null,
    entities: [],
    confidence: routeDecision.confidence,
    needsClarification: false,
    clarificationQuestion: null,
    toolCall,
  });
};

const PLANNER_ROUTES = [
  'GENERAL_LEARNING',
  'MATERIAL_SEARCH',
  'MATERIAL_DETAILS',
  'PROJECT_SEARCH',
  'PROJECT_DETAILS',
  'PROJECT_COMPONENTS',
  'PROJECT_MATERIAL_AVAILABILITY',
  'PROJECT_BUDGET_ESTIMATION',
  'OWNED_MATERIALS_PROJECT_MATCH',
  'SAVED_PROJECTS',
  'ACTIVE_PROJECT_BUILDS',
  'BUILD_GAP_ANALYSIS',
  'COMPONENT_MATERIAL_MATCHING',
  'MATERIAL_COMPARISON',
  'PROJECT_COMPARISON',
  'PERSONALIZED_RECOMMENDATION',
  'ACTION_REQUEST',
  'OUT_OF_SCOPE',
  'CLARIFICATION',
] as const;

const plannerEntitySchema = z
  .object({
    type: z.enum(['MATERIAL', 'PROJECT', 'BUILD', 'COMPONENT']),
    mention: z.string().trim().min(1),
    referenceType: z.enum([
      'EXPLICIT_NAME',
      'RECENT_RESULT',
      'RESULT_INDEX',
      'PRONOUN',
      'UNKNOWN',
    ]),
    resultIndex: z.number().int().nullable().optional(),
  })
  .strict();

const plannerFiltersSchema = z
  .object({
    query: z.string().trim().min(1).nullable().optional(),
    categoryText: z.string().trim().min(1).nullable().optional(),
    isFree: z.boolean().nullable().optional(),
    minPrice: z.number().nullable().optional(),
    maxPrice: z.number().nullable().optional(),
    city: z.string().trim().min(1).nullable().optional(),
    area: z.string().trim().min(1).nullable().optional(),
    nearLearner: z.boolean().nullable().optional(),
    pickupAllowed: z.boolean().nullable().optional(),
    deliveryAllowed: z.boolean().nullable().optional(),
    limit: z.number().int().positive().max(20).nullable().optional(),
  })
  .strict();

export const agentPlannerOutputSchema = z
  .object({
    route: z.enum(PLANNER_ROUTES),
    confidence: z.number().min(0).max(1),
    entities: z.array(plannerEntitySchema).default([]),
    filters: plannerFiltersSchema.optional(),
    toolCall: z
      .object({
        name: z.string().trim().min(1),
        arguments: z.record(z.string(), z.unknown()).default({}),
      })
      .optional(),
    clarificationNeeded: z.boolean().default(false),
    clarificationReason: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.clarificationNeeded && !value.clarificationReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'clarificationReason is required when clarificationNeeded is true',
      });
    }
  });

export type AgentPlannerOutput = z.infer<typeof agentPlannerOutputSchema>;

const FORBIDDEN_ARGUMENT_KEYS = new Set([
  'userId',
  'userid',
  'coordinates',
  'latitude',
  'longitude',
  'lat',
  'lng',
  'materialId',
  'projectId',
  'buildId',
  'componentId',
  'conversationId',
]);

const buildPlannerPrompt = (input: {
  userMessage: string;
  locale: AiLocale;
  deterministicRoute: AiAgentRouteType;
  deterministicArguments: Record<string, unknown>;
  conversationContext?: PlannerConversationContext;
}) =>
  [
    'You plan learner-agent turns for ImpactLoop.',
    'Return strict JSON only.',
    'Understand Arabic (MSA and Levantine dialect), English, and code-switching.',
    'Within ImpactLoop assistant context, material-related requests are usually platform inventory searches unless the user clearly asks how/why/explain without requesting inventory.',
    'Examples:',
    '- "مواد الها علاقة بالالكترونيات" -> MATERIAL_SEARCH, categoryText electronics',
    '- "عندكم breadboard؟" -> MATERIAL_SEARCH, query breadboard',
    '- "كيف بستخدم breadboard؟" -> GENERAL_LEARNING',
    '- "ما هي فلسطين؟" -> OUT_OF_SCOPE',
    '- "Obstacle Robot شو مكونات مشروع ال" with recent project "Obstacle Avoidance Robot" -> PROJECT_COMPONENTS, entity mention Obstacle Robot, referenceType RECENT_RESULT',
    '- "لقيت Arduino وشوية أسلاك، في إشي بالمشاريع الموجودة بقدر أعمله؟" -> OWNED_MATERIALS_PROJECT_MATCH, tool match_projects_by_owned_materials, materials ["Arduino","wires"]',
    '- "I have leftover LEDs, resistors and wires. Could I reuse them here?" -> OWNED_MATERIALS_PROJECT_MATCH, tool match_projects_by_owned_materials, materials ["LEDs","resistors","wires"]',
    '- "بدي أعمل Obstacle Avoidance Robot، شو المواد المتوفرة؟" -> PROJECT_MATERIAL_AVAILABILITY, tool match_available_materials_for_project, projectQuery "Obstacle Avoidance Robot"',
    '- "What available materials can help me build the Line Follower Robot?" -> PROJECT_MATERIAL_AVAILABILITY, tool match_available_materials_for_project, projectQuery "Line Follower Robot"',
    '- "كم بكلفني مشروع Obstacle Avoidance Robot؟" -> PROJECT_BUDGET_ESTIMATION, tool estimate_project_material_budget, projectQuery "Obstacle Avoidance Robot"',
    '- "How much would the available materials for the Line Follower Robot cost?" -> PROJECT_BUDGET_ESTIMATION, tool estimate_project_material_budget, projectQuery "Line Follower Robot"',
    '- "احسبلي تكلفة المواد المتوفرة لمشروع Electronic LED Dice" -> PROJECT_BUDGET_ESTIMATION, tool estimate_project_material_budget, projectQuery "Electronic LED Dice"',
    '- After project_results for Obstacle Avoidance Robot, "طيب كم تكلفة المواد إله؟" -> PROJECT_BUDGET_ESTIMATION, entity mention Obstacle Avoidance Robot, referenceType RECENT_RESULT',
    '- After component_matches for a project, "كم مجموعهم تقريباً؟" -> PROJECT_BUDGET_ESTIMATION, referenceType RECENT_RESULT for that project',
    '- "اشرحلي كيف Arduino بشتغل" -> GENERAL_LEARNING',
    'Do not copy the full user sentence into query.',
    'Use trustedEntities IDs only when referenceType is RECENT_RESULT/RESULT_INDEX and the entity is clearly identified.',
    'Never invent inventory facts.',
    'Output shape:',
    JSON.stringify(
      {
        route: 'MATERIAL_SEARCH',
        confidence: 0.93,
        entities: [],
        filters: {
          categoryText: 'electronics',
          isFree: null,
          query: null,
        },
        clarificationNeeded: false,
      },
      null,
      2,
    ),
    'Allowed platform tools when needed:',
    '- search_available_materials',
    '- search_learning_projects',
    '- get_project_required_components',
    '- analyze_build_gaps',
    '- find_materials_for_component',
    '- get_personalized_recommendations',
    '- match_projects_by_owned_materials: use when the learner mentions materials/components they have or found and wants to know what they can build, make, reuse, or which published ImpactLoop Learning Hub projects fit those materials. Accept indirect/conversational wording, dialect, and follow-ups where materials appear in recent messages. Extract only material/component names from the current message and bounded recent context; never invent materials, projects, ownership records, reservations, or readiness scores. toolCall.arguments shape: { materials: string[], category?: string, difficulty?: "BEGINNER"|"INTERMEDIATE"|"ADVANCED", limit?: number }.',
    '- match_available_materials_for_project: use when the learner names or refers to a published Learning Hub project and wants to know which currently available ImpactLoop material listings match its required components, without starting a build. Never invent a project ID. toolCall.arguments shape: { projectQuery?: string, limitPerComponent?: number }.',
    '- estimate_project_material_budget: Estimate the NIS subtotal of currently available ImpactLoop material listings for the required components of one real Learning Hub project. Use when the learner asks how much a named project, its materials, its available components, or the cheapest currently available component set would cost, including Arabic/English natural wording and follow-ups after project cards or material-availability results. Do not calculate prices yourself; return the project reference to the deterministic tool. Never invent a project ID or price. toolCall.arguments shape: { projectQuery?: string, limitPerComponent?: number }.',
    'For bare possession statements without a clear build/project intent (for example only "I have Arduino and wires"), set route CLARIFICATION with clarificationNeeded true and ask whether to show ImpactLoop projects that use those materials.',
    'Never include userId, coordinates, conversationId, or arbitrary database IDs in filters.',
    `Locale: ${input.locale}`,
    `Deterministic route guess: ${input.deterministicRoute}`,
    `Deterministic arguments guess: ${JSON.stringify(input.deterministicArguments)}`,
    input.conversationContext
      ? `Trusted conversation context:\n${summarizePlannerContextForPrompt(input.conversationContext)}`
      : 'Trusted conversation context: none',
    `User message: ${JSON.stringify(input.userMessage)}`,
  ].join('\n\n');

const sanitizePlannerArguments = (
  toolName: string,
  argumentsValue: Record<string, unknown>,
): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(argumentsValue)) {
    if (FORBIDDEN_ARGUMENT_KEYS.has(key) || value === null || value === undefined) {
      continue;
    }
    sanitized[key] = value;
  }

  const tool = getRegisteredTool(toolName);
  if (!tool) {
    return sanitized;
  }

  return tool.inputSchema.parse(sanitized) as Record<string, unknown>;
};

const tryBuildValidatedToolCall = (
  toolName: string,
  route: AiAgentRouteType,
  userMessage: string,
): SemanticUnderstanding['toolCall'] => {
  let toolInput: Record<string, unknown>;
  if (route === 'PROJECTS_WITHIN_BUDGET') {
    const budgetBound = extractBudgetBound(userMessage);
    if (!budgetBound?.maxBudgetNis) {
      return null;
    }
    toolInput = parseProjectsWithinBudgetInput(userMessage) as Record<string, unknown>;
  } else {
    toolInput = buildToolInputForRoute(route, userMessage);
  }

  if (Object.keys(toolInput).length === 0) {
    return null;
  }

  try {
    return {
      name: toolName,
      arguments: sanitizePlannerArguments(toolName, toolInput),
    };
  } catch {
    return null;
  }
};

let plannerClientFactoryOverride: (() => GoogleGenAI) | null = null;
let plannerOverrideForTests:
  | ((input: {
      userMessage: string;
      locale: AiLocale;
      deterministicRoute: AiAgentRouteType;
      deterministicArguments: Record<string, unknown>;
      conversationContext?: PlannerConversationContext;
    }) => Promise<AgentPlannerOutput | null>)
  | null = null;

let semanticUnderstandingOverrideForTests:
  | ((input: {
      userMessage: string;
      locale: AiLocale;
      conversationContext?: PlannerConversationContext;
    }) => Promise<SemanticPlannerResult | SemanticUnderstanding | null>)
  | null = null;

export const setSemanticUnderstandingOverrideForTests = (
  override:
    | ((input: {
        userMessage: string;
        locale: AiLocale;
        conversationContext?: PlannerConversationContext;
      }) => Promise<SemanticPlannerResult | SemanticUnderstanding | null>)
    | null,
) => {
  semanticUnderstandingOverrideForTests = override;
};

export const setAgentPlannerClientFactoryForTests = (
  factory: (() => GoogleGenAI) | null,
) => {
  plannerClientFactoryOverride = factory;
};

export const setSemanticPlannerOverrideForTests = (
  override:
    | ((input: {
        userMessage: string;
        locale: AiLocale;
        deterministicRoute: AiAgentRouteType;
        deterministicArguments: Record<string, unknown>;
        conversationContext?: PlannerConversationContext;
      }) => Promise<AgentPlannerOutput | null>)
    | null,
) => {
  plannerOverrideForTests = override;
};

export const validatePlannerOutput = (raw: unknown): AgentPlannerOutput | null => {
  const parsed = agentPlannerOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  if (parsed.data.clarificationNeeded) {
    return parsed.data;
  }

  if (parsed.data.toolCall?.name === 'estimate_project_material_budget') {
    try {
      const argumentsValue = sanitizePlannerArguments(
        'estimate_project_material_budget',
        parsed.data.toolCall.arguments ?? {},
      );
      return {
        ...parsed.data,
        route: 'PROJECT_BUDGET_ESTIMATION',
        clarificationNeeded: false,
        toolCall: {
          name: 'estimate_project_material_budget',
          arguments: argumentsValue,
        },
      };
    } catch {
      return null;
    }
  }

  if (parsed.data.toolCall?.name === 'match_available_materials_for_project') {
    try {
      const argumentsValue = sanitizePlannerArguments(
        'match_available_materials_for_project',
        parsed.data.toolCall.arguments ?? {},
      );
      return {
        ...parsed.data,
        route: 'PROJECT_MATERIAL_AVAILABILITY',
        clarificationNeeded: false,
        toolCall: {
          name: 'match_available_materials_for_project',
          arguments: argumentsValue,
        },
      };
    } catch {
      return null;
    }
  }

  if (
    parsed.data.route === 'OUT_OF_SCOPE' ||
    parsed.data.route === 'GENERAL_LEARNING' ||
    parsed.data.route === 'CLARIFICATION'
  ) {
    return parsed.data;
  }

  if (parsed.data.toolCall) {
    if (!isRegisteredToolName(parsed.data.toolCall.name)) {
      return null;
    }

    try {
      sanitizePlannerArguments(
        parsed.data.toolCall.name,
        parsed.data.toolCall.arguments ?? {},
      );
    } catch {
      return null;
    }

    return parsed.data;
  }

  if (parsed.data.route === 'MATERIAL_SEARCH' && parsed.data.filters) {
    return parsed.data;
  }

  if (parsed.data.route === 'OWNED_MATERIALS_PROJECT_MATCH') {
    if (parsed.data.clarificationNeeded) {
      return parsed.data;
    }

    const toolCall = parsed.data.toolCall as
      | { name: string; arguments: Record<string, unknown> }
      | undefined;
    const toolName = toolCall?.name ?? 'match_projects_by_owned_materials';
    if (toolName !== 'match_projects_by_owned_materials') {
      return null;
    }

    try {
      sanitizePlannerArguments(
        toolName,
        toolCall?.arguments ?? {},
      );
    } catch {
      return null;
    }

    return parsed.data;
  }

  return null;
};

const plannerOutputToSemanticUnderstanding = (
  planner: AgentPlannerOutput,
): SemanticUnderstanding | null => {
  if (planner.clarificationNeeded) {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'CLARIFICATION_REQUIRED',
      topic: null,
      action: null,
      entities: planner.entities,
      confidence: planner.confidence,
      needsClarification: true,
      clarificationQuestion: planner.clarificationReason ?? 'Please clarify.',
      toolCall: null,
    });
  }
  if (planner.route === 'GENERAL_LEARNING') {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'GENERAL_LEARNING',
      topic: null,
      action: null,
      entities: planner.entities,
      confidence: planner.confidence,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }
  if (planner.route === 'OUT_OF_SCOPE') {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'OUT_OF_SCOPE',
      topic: null,
      action: null,
      entities: planner.entities,
      confidence: planner.confidence,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }
  if (planner.route === 'ACTION_REQUEST') {
    return validateSemanticUnderstanding({
      schemaVersion: 1,
      route: 'ACTION_REQUEST',
      topic: null,
      action: 'PREPARE_MATERIAL_RESERVATION',
      entities: planner.entities,
      confidence: planner.confidence,
      needsClarification: false,
      clarificationQuestion: null,
      toolCall: null,
    });
  }
  const systemTopic = SYSTEM_DATA_TOPICS.find((topic) => topic === planner.route);
  if (!systemTopic) {
    return null;
  }
  let toolCall: SemanticUnderstanding['toolCall'] = null;
  if (planner.toolCall?.name && isRegisteredToolName(planner.toolCall.name)) {
    try {
      toolCall = {
        name: planner.toolCall.name,
        arguments: sanitizePlannerArguments(
          planner.toolCall.name,
          planner.toolCall.arguments ?? {},
        ),
      };
    } catch {
      toolCall = null;
    }
  }

  return validateSemanticUnderstanding({
    schemaVersion: 1,
    route: 'SYSTEM_DATA_QUERY',
    topic: systemTopic,
    action: null,
    entities: planner.entities,
    filters: planner.filters,
    confidence: planner.confidence,
    needsClarification: false,
    clarificationQuestion: null,
    toolCall,
  });
};

export const buildMockSemanticUnderstandingForTests = buildMockSemanticUnderstanding;

export const planSemanticUnderstanding = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationContext?: PlannerConversationContext;
}): Promise<SemanticPlannerResult> => {
  if (semanticUnderstandingOverrideForTests) {
    try {
      return normalizeSemanticPlannerOverrideResult(
        await semanticUnderstandingOverrideForTests(input),
      );
    } catch (error) {
      if (isSemanticPlannerProviderFailure(error)) {
        return toSemanticPlannerFailure();
      }
      throw error;
    }
  }

  if (plannerOverrideForTests) {
    const legacyPlanner = await plannerOverrideForTests({
      userMessage: input.userMessage,
      locale: input.locale,
      deterministicRoute: 'GENERAL_LEARNING',
      deterministicArguments: {},
      conversationContext: input.conversationContext,
    });
    if (legacyPlanner) {
      const understanding = plannerOutputToSemanticUnderstanding(legacyPlanner);
      if (!understanding) {
        return toSemanticPlannerFailure();
      }
      return { status: 'success', understanding };
    }
  }

  if (!isAiChatProviderOperational()) {
    return toSemanticPlannerFailure();
  }

  if (resolveAiChatProvider() === 'mock') {
    const understanding = buildMockSemanticUnderstanding(input);
    if (!understanding) {
      return toSemanticPlannerFailure('semantic_invalid');
    }
    return {
      status: 'success',
      understanding,
    };
  }

  const chatProvider = resolveAiChatProvider();
  if (chatProvider !== 'gemini' && chatProvider !== 'openai') {
    return toSemanticPlannerFailure();
  }

  try {
    const { getAiChatProvider } = await import(
      '../providers/ai-chat-provider.factory.js'
    );
    const { providerSupportsSemanticUnderstanding } = await import(
      '../providers/ai-chat-provider.types.js'
    );
    const provider = getAiChatProvider();
    if (!providerSupportsSemanticUnderstanding(provider)) {
      return toSemanticPlannerFailure();
    }
    const result = await provider.classifySemanticUnderstanding({
      prompt: buildSemanticPlannerPrompt(input),
      locale: input.locale,
    });
    const understanding = validateSemanticUnderstanding(result.data);
    if (!understanding) {
      logger.warn(
        { userMessageLength: input.userMessage.length, provider: chatProvider },
        'AI semantic understanding planner returned invalid output',
      );
      return toSemanticPlannerFailure('semantic_invalid');
    }
    return { status: 'success', understanding };
  } catch (error) {
    const details =
      error instanceof AppError &&
      typeof error.details === 'object' &&
      error.details !== null
        ? (error.details as Record<string, unknown>)
        : null;
    logger.warn(
      {
        errorCode: error instanceof AppError ? error.code : undefined,
        statusCode: error instanceof AppError ? error.statusCode : undefined,
        stage: typeof details?.stage === 'string' ? details.stage : undefined,
        model: typeof details?.model === 'string' ? details.model : undefined,
        safeMessage:
          error instanceof Error ? error.message.slice(0, 180) : 'unknown',
      },
      'AI semantic understanding planner failed',
    );
    if (isSemanticPlannerProviderFailure(error)) {
      return toSemanticPlannerFailure();
    }
    throw error;
  }
};

export const planLearnerAgentTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  deterministicRoute: AiAgentRouteType;
  deterministicArguments: Record<string, unknown>;
  conversationContext?: PlannerConversationContext;
}): Promise<AgentPlannerOutput | null> => {
  if (AI_SEMANTIC_ROUTER_VERSION >= 2) {
    const plannerResult = await planSemanticUnderstanding({
      userMessage: input.userMessage,
      locale: input.locale,
      conversationContext: input.conversationContext,
    });
    if (plannerResult.status === 'failure') {
      return null;
    }
    const understanding = plannerResult.understanding;
    const execution = mapSemanticToExecutionPlan(understanding);
    if (execution.route === 'CLARIFICATION') {
      return {
        route: 'CLARIFICATION',
        confidence: understanding.confidence,
        entities: understanding.entities,
        clarificationNeeded: true,
        clarificationReason: execution.clarificationReason,
      };
    }
    if (execution.route === 'PLATFORM_GUIDANCE') {
      return {
        route: 'GENERAL_LEARNING',
        confidence: understanding.confidence,
        entities: understanding.entities,
        clarificationNeeded: false,
      };
    }
    if (execution.route === 'GENERAL_LEARNING') {
      return {
        route: 'GENERAL_LEARNING',
        confidence: understanding.confidence,
        entities: understanding.entities,
        clarificationNeeded: false,
      };
    }
    if (execution.route === 'OUT_OF_SCOPE') {
      return {
        route: 'OUT_OF_SCOPE',
        confidence: understanding.confidence,
        entities: understanding.entities,
        clarificationNeeded: false,
      };
    }
    if (execution.route === 'ACTION_REQUEST') {
      return {
        route: 'ACTION_REQUEST',
        confidence: understanding.confidence,
        entities: understanding.entities,
        clarificationNeeded: false,
      };
    }
    return {
      route: execution.route as AgentPlannerOutput['route'],
      confidence: understanding.confidence,
      entities: understanding.entities,
      filters: understanding.filters,
      toolCall: execution.toolName
        ? {
            name: execution.toolName,
            arguments: execution.toolInput,
          }
        : undefined,
      clarificationNeeded: false,
    };
  }

  if (plannerOverrideForTests) {
    return plannerOverrideForTests(input);
  }

  if (!isAiChatProviderOperational() || resolveAiChatProvider() !== 'gemini') {
    return null;
  }

  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const client = plannerClientFactoryOverride?.() ?? new GoogleGenAI({ apiKey });
  const models = getGeminiChatModelCandidates();

  try {
    let lastError: unknown;
    for (const model of models) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: buildPlannerPrompt(input),
          config: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            systemInstruction:
              'You are a strict semantic planner. Output valid JSON only. Separate platform inventory intent from general education and out-of-scope requests.',
          },
        });

        const content = response.text?.trim();
        if (!content) {
          return null;
        }

        const raw = extractJsonObject(content);
        return validatePlannerOutput(raw);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error('No Gemini planner model candidates are available.');
  } catch (error) {
    logger.warn(
      {
        route: input.deterministicRoute,
        error: error instanceof Error ? error.message.slice(0, 180) : 'unknown',
      },
      'AI semantic planner failed',
    );
    return null;
  }
};

const compactFilters = (
  filters: AgentPlannerOutput['filters'],
): Record<string, unknown> => {
  if (!filters) {
    return {};
  }

  const compact: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined) {
      compact[key] = value;
    }
  }
  return compact;
};

export const materialSearchPlanFromPlanner = (
  userMessage: string,
  planner: AgentPlannerOutput,
): Record<string, unknown> | null => {
  if (planner.route !== 'MATERIAL_SEARCH') {
    return null;
  }

  const deterministic = mergeMaterialSearchPlan(userMessage);
  const plannerFilters = compactFilters(planner.filters);
  const toolArgs =
    planner.toolCall?.name === 'search_available_materials'
      ? planner.toolCall.arguments
      : {};

  const merged = {
    ...deterministic,
    ...plannerFilters,
    ...toolArgs,
    limit:
      (plannerFilters.limit as number | undefined) ??
      (toolArgs.limit as number | undefined) ??
      deterministic.limit ??
      10,
  };

  if (merged.query && typeof merged.query === 'string') {
    merged.query = normalizeMaterialItemQuery(merged.query as string);
    if (isMaterialSearchNoiseQuery(merged.query as string | undefined)) {
      delete merged.query;
    }
  }

  if (merged.categoryText && typeof merged.categoryText === 'string') {
    merged.categoryText = normalizeMaterialCategoryText(merged.categoryText as string);
  }

  if (merged.query && typeof merged.query === 'string') {
    const normalizedQuery = merged.query.trim().toLowerCase();
    const normalizedMessage = userMessage.trim().toLowerCase();
    if (
      normalizedMessage.includes(normalizedQuery) &&
      normalizedQuery.split(/\s+/).length >= 3
    ) {
      delete merged.query;
    }
  }

  return sanitizePlannerArguments('search_available_materials', merged);
};

export const ownedMaterialsPlanFromPlanner = (
  userMessage: string,
  planner: AgentPlannerOutput,
  conversationContext?: PlannerConversationContext,
): Record<string, unknown> | null => {
  if (
    planner.route !== 'OWNED_MATERIALS_PROJECT_MATCH' &&
    planner.toolCall?.name !== 'match_projects_by_owned_materials'
  ) {
    return null;
  }

  const deterministic = parseOwnedMaterialsProjectInput(userMessage);
  const toolArgs =
    planner.toolCall?.name === 'match_projects_by_owned_materials'
      ? planner.toolCall.arguments
      : {};
  const contextMaterials = resolveOwnedMaterialsFromConversation(
    userMessage,
    conversationContext?.recentMessages,
  );
  const plannerMaterials = Array.isArray(toolArgs.materials)
    ? toolArgs.materials.filter(
        (value): value is string => typeof value === 'string' && value.trim().length > 0,
      )
    : [];

  const mergedMaterials =
    plannerMaterials.length > 0
      ? plannerMaterials
      : [...deterministic.materials, ...contextMaterials];
  const seen = new Set<string>();
  const materials: string[] = [];
  for (const material of mergedMaterials) {
    const trimmed = material.trim().slice(0, 80);
    if (trimmed.length === 0) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    materials.push(trimmed);
    if (materials.length >= 12) {
      break;
    }
  }

  if (materials.length === 0) {
    return null;
  }

  return sanitizePlannerArguments('match_projects_by_owned_materials', {
    materials,
    category:
      (typeof toolArgs.category === 'string' ? toolArgs.category : undefined) ??
      deterministic.category,
    difficulty:
      (toolArgs.difficulty as string | undefined) ?? deterministic.difficulty,
    limit:
      (toolArgs.limit as number | undefined) ??
      deterministic.limit ??
      10,
  });
};

export const projectMaterialAvailabilityPlanFromPlanner = (
  userMessage: string,
  planner: AgentPlannerOutput,
): Record<string, unknown> | null => {
  if (
    planner.route !== 'PROJECT_MATERIAL_AVAILABILITY' &&
    planner.toolCall?.name !== 'match_available_materials_for_project'
  ) {
    return null;
  }

  const toolArgs =
    planner.toolCall?.name === 'match_available_materials_for_project'
      ? planner.toolCall.arguments
      : {};
  const projectQuery =
    (typeof toolArgs.projectQuery === 'string' ? toolArgs.projectQuery.trim() : '') ||
    extractProjectTitleQuery(userMessage);

  if (!projectQuery) {
    return null;
  }

  return sanitizePlannerArguments('match_available_materials_for_project', {
    projectQuery: projectQuery.slice(0, 120),
    limitPerComponent:
      typeof toolArgs.limitPerComponent === 'number'
        ? toolArgs.limitPerComponent
        : 3,
  });
};

export const projectBudgetEstimationPlanFromPlanner = (
  userMessage: string,
  planner: AgentPlannerOutput,
): Record<string, unknown> | null => {
  if (
    planner.route !== 'PROJECT_BUDGET_ESTIMATION' &&
    planner.toolCall?.name !== 'estimate_project_material_budget'
  ) {
    return null;
  }

  const toolArgs =
    planner.toolCall?.name === 'estimate_project_material_budget'
      ? planner.toolCall.arguments
      : {};
  const projectQuery =
    (typeof toolArgs.projectQuery === 'string' ? toolArgs.projectQuery.trim() : '') ||
    extractProjectTitleQuery(userMessage);

  if (!projectQuery) {
    return null;
  }

  return sanitizePlannerArguments('estimate_project_material_budget', {
    projectQuery: projectQuery.slice(0, 120),
    limitPerComponent:
      typeof toolArgs.limitPerComponent === 'number'
        ? toolArgs.limitPerComponent
        : 5,
  });
};
