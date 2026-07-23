import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

import {
  env,
  getConfiguredGeminiApiKey,
  getGeminiChatModelCandidates,
  isAiChatProviderOperational,
} from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';
import { extractJsonObject } from '../../../services/gemini-price-suggestion.provider.js';
import type { AiLocale } from '../ai.types.js';
import type { AiAgentRouteType } from './ai-agent.types.js';
import { getRegisteredTool, isRegisteredToolName } from './ai-tool-registry.js';
import {
  mergeMaterialSearchPlan,
  normalizeMaterialItemQuery,
  parseOwnedMaterialsProjectInput,
  resolveOwnedMaterialsFromConversation,
} from './ai-agent-filter-extractor.service.js';
import {
  summarizePlannerContextForPrompt,
  type PlannerConversationContext,
} from './ai-agent-planner-context.service.js';

const PLANNER_ROUTES = [
  'GENERAL_LEARNING',
  'MATERIAL_SEARCH',
  'MATERIAL_DETAILS',
  'PROJECT_SEARCH',
  'PROJECT_DETAILS',
  'PROJECT_COMPONENTS',
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

    const toolName =
      parsed.data.toolCall?.name ?? 'match_projects_by_owned_materials';
    if (toolName !== 'match_projects_by_owned_materials') {
      return null;
    }

    try {
      sanitizePlannerArguments(
        toolName,
        parsed.data.toolCall?.arguments ?? {},
      );
    } catch {
      return null;
    }

    return parsed.data;
  }

  return null;
};

export const planLearnerAgentTurn = async (input: {
  userMessage: string;
  locale: AiLocale;
  deterministicRoute: AiAgentRouteType;
  deterministicArguments: Record<string, unknown>;
  conversationContext?: PlannerConversationContext;
}): Promise<AgentPlannerOutput | null> => {
  if (plannerOverrideForTests) {
    return plannerOverrideForTests(input);
  }

  if (!isAiChatProviderOperational() || env.aiChatProvider !== 'gemini') {
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
