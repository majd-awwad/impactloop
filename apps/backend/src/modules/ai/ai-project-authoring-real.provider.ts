import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { ZodError, z } from 'zod';

import {
  env,
  getAiChatRuntimeConfig,
  getConfiguredGeminiApiKey,
  getGeminiChatModelCandidates,
} from '../../config/env.js';
import { logger } from '../../observability/logger.js';
import { AppError } from '../../utils/app-error.js';

import {
  aiAuthoringClarificationProviderJsonSchema,
  type AiProjectAuthoringClarificationBlock,
} from './ai.content-blocks.js';
import type { AiLocale } from './ai.types.js';
import type { SequentialStage } from './ai-project-authoring-sequential.policy.js';
import type {
  SequentialComponent,
  SequentialStep,
} from './ai-project-authoring-sequential.policy.js';
import { MAX_PROPOSAL_STEPS } from './ai-project-authoring-proposal.policy.js';
import { reindexWorkingSteps } from './ai-project-authoring-sequential.policy.js';
import {
  computeAuthoringTopicState,
  getAuthoringProviderSchemaIssues,
  parseAuthoringProviderPayload,
  recordAuthoringValidationDiagnostic,
} from './ai-project-authoring-clarification.shared.js';

type OpenAiAuthoringClient = {
  chat: {
    completions: {
      create: (
        ...args: Parameters<OpenAI['chat']['completions']['create']>
      ) => Promise<OpenAI.Chat.Completions.ChatCompletion>;
    };
  };
};
let openAiAuthoringClientFactoryOverride: (() => OpenAiAuthoringClient) | null = null;

export const setAuthoringOpenAiClientFactoryForTests = (
  factory: (() => OpenAiAuthoringClient) | null,
) => {
  openAiAuthoringClientFactoryOverride = factory;
};

export const PROJECT_AUTHORING_TOPIC_KEYS = [
  'project_goal',
  'expected_behavior',
  'target_user',
  'learner_skill_level',
  'available_materials',
  'required_technology',
  'power_source',
  'project_scale',
  'budget',
  'available_tools',
  'estimated_time',
  'indoor_or_outdoor',
  'safety_constraints',
  'preferred_reused_materials',
  'connectivity_or_control',
  'success_criteria',
] as const;

export const PROJECT_AUTHORING_MAX_CLARIFICATION_QUESTIONS = 4;

export type RealAuthoringClarificationInput = {
  locale: AiLocale;
  ideaText: string;
  projectTitle: string | null;
  projectShortDescription: string | null;
  projectDescription: string | null;
  categoryName: string | null;
  difficulty: string | null;
  componentNames: string[];
  stepTitles: string[];
  answeredQuestionKeys: string[];
  answeredQuestionCount: number;
  currentAnswer: string | null;
  latestClarification: AiProjectAuthoringClarificationBlock | null;
  recentAuthoringAnswers?: string[];
  repairAttempt: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
};

export type RealAuthoringClarificationProviderResult = {
  provider: string;
  model: string | null;
  data: import('./ai.content-blocks.js').AiAuthoringClarificationProviderResult;
  usage: { inputTokens: number | null; outputTokens: number | null };
  latencyMs: number;
};

export const PROJECT_AUTHORING_CLARIFICATION_SYSTEM_POLICY = [
  'You are ImpactLoop project authoring clarification assistant.',
  'Your only job is to analyze a learner project idea and return one schema-valid clarification result.',
  'Use only the trusted context supplied in the user message.',
  'Ask at most one high-impact clarification question per response.',
  'Never ask a question whose key already appears in answeredQuestionKeys or satisfiedTopics.',
  'Ask only from unresolvedTopics supplied in the user message.',
  'Never ask irrelevant topics (for example power source or Arduino for a cardboard craft project).',
  'Allowed question keys:',
  PROJECT_AUTHORING_TOPIC_KEYS.join(', '),
  `Maximum answered clarification questions: ${PROJECT_AUTHORING_MAX_CLARIFICATION_QUESTIONS}.`,
  'When unresolvedTopics is empty or serverReadinessRecommended is true, return READY_FOR_PROPOSAL with nextQuestion null.',
  'FREE_TEXT questions must use options: []. SINGLE_CHOICE requires 2-4 unique options. MULTI_CHOICE requires 2-6 unique options.',
  'Record unresolved uncertainty as assumptions or warnings, not fabricated answers.',
  'Match the conversation locale. Preserve mixed technical terms such as Arduino and LED naturally in Arabic.',
  'Do not generate the full project, title, description, components, numbered steps, actions, IDs, or field updates.',
  'Do not claim ImpactLoop material availability.',
  'Do not search the web or cite external sources.',
  'Return strict JSON only with keys clarification and assistantText.',
  'clarification.type must be project_authoring_clarification.',
  'assistantText is required and must be a non-empty string.',
  'clarification.nextQuestion must be an object or null; never serialize it as a string.',
  'clarification.remainingTopics must be an unquoted integer from 0 to 20.',
  'knownFacts, assumptions, warnings, and nextQuestion.options must be arrays.',
  'knownFacts[].source must be IDEA, DRAFT, LEARNER_ANSWER, or PROFILE exactly.',
  'clarification.status must be NEEDS_CLARIFICATION or READY_FOR_PROPOSAL exactly.',
  'nextQuestion.answerType must be FREE_TEXT, SINGLE_CHOICE, or MULTI_CHOICE exactly.',
  'Do not wrap JSON in markdown.',
  'Do not emit tool calls, function calls, XML, or special tokens such as <|tool_call_start|>.',
  'The first character must be { and the final character must be }.',
  'Examples:',
  '- Electronics beginner Arduino watering: ask expected_behavior or power_source if missing.',
  '- Recycled cardboard organizer: ask project_goal or project_scale, not power or microcontroller.',
  '- Detailed USB-powered Arduino soil alert without pump: prefer READY_FOR_PROPOSAL.',
  '- Arabic mixed technical idea: respond in Arabic while keeping Arduino/LED readable.',
].join('\n');

type RealProviderName = 'gemini' | 'openai';

type RealClarificationInvoker = (input: {
  provider: RealProviderName;
  systemInstruction: string;
  userPrompt: string;
}) => Promise<{
  text: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}>;

let invokerOverride: RealClarificationInvoker | null = null;
let componentInvokerOverride: RealClarificationInvoker | null = null;
let stepInvokerOverride: RealClarificationInvoker | null = null;
let scalarInvokerOverride: RealClarificationInvoker | null = null;
let invokerCallCountForTests = 0;
let componentInvokerCallCountForTests = 0;
let stepInvokerCallCountForTests = 0;
let scalarInvokerCallCountForTests = 0;

export const setAuthoringRealClarificationInvokerForTests = (
  invoker: RealClarificationInvoker | null,
) => {
  invokerOverride = invoker;
  invokerCallCountForTests = 0;
};

export const setAuthoringRealComponentInvokerForTests = (
  invoker: RealClarificationInvoker | null,
) => {
  componentInvokerOverride = invoker;
  componentInvokerCallCountForTests = 0;
};

export const setAuthoringRealStepInvokerForTests = (
  invoker: RealClarificationInvoker | null,
) => {
  stepInvokerOverride = invoker;
  stepInvokerCallCountForTests = 0;
};

export const setAuthoringRealScalarInvokerForTests = (
  invoker: RealClarificationInvoker | null,
) => {
  scalarInvokerOverride = invoker;
  scalarInvokerCallCountForTests = 0;
};

export const getAuthoringRealClarificationInvokerCallCountForTests = () =>
  invokerCallCountForTests;

export const getAuthoringRealComponentInvokerCallCountForTests = () =>
  componentInvokerCallCountForTests;

export const getAuthoringRealStepInvokerCallCountForTests = () =>
  stepInvokerCallCountForTests;

export const getAuthoringRealScalarInvokerCallCountForTests = () =>
  scalarInvokerCallCountForTests;

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  code: string,
): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new AppError(
              'The learning assistant timed out. Please try again.',
              504,
              'AI_PROVIDER_TIMEOUT',
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

type OpenAiFailure = {
  status: number | null;
  code: string | null;
  type: string | null;
  message: string;
  body: string | null;
};

const truncateUpstreamDiagnostic = (value: string, maxLength = 1200): string =>
  value
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(authorization|cookie|api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email]')
    .slice(0, maxLength);

const readOpenAiFailure = (error: unknown): OpenAiFailure => {
  const record = error && typeof error === 'object'
    ? (error as Record<string, unknown>)
    : {};
  const body = record.error ?? record.body ?? record.responseBody ?? null;
  let safeBody: string | null = null;
  if (body != null) {
    try {
      safeBody = truncateUpstreamDiagnostic(
        typeof body === 'string' ? body : JSON.stringify(body),
      );
    } catch {
      safeBody = '[unserializable upstream error body]';
    }
  }

  return {
    status: typeof record.status === 'number' ? record.status : null,
    code: typeof record.code === 'string' ? record.code : null,
    type: typeof record.type === 'string' ? record.type : null,
    message: truncateUpstreamDiagnostic(
      error instanceof Error ? error.message : String(error ?? 'Unknown OpenAI-compatible error'),
      300,
    ),
    body: safeBody,
  };
};

const logOpenAiAuthoringFailure = (
  failure: OpenAiFailure,
  runtime: ReturnType<typeof getAiChatRuntimeConfig>,
) => {
  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    return;
  }

  logger.warn(
    {
      operation: 'ai_authoring_openai_compatible_request',
      upstreamStatus: failure.status,
      upstreamErrorCode: failure.code,
      upstreamErrorType: failure.type,
      upstreamMessage: failure.message,
      configuredModel: runtime.model,
      resolvedProviderModel: null,
      requestEndpoint: `${runtime.openaiBaseUrl ?? 'https://api.openai.com/v1'}/chat/completions`,
      upstreamResponseBody: failure.body,
    },
    'AI authoring OpenAI-compatible provider request failed',
  );
};

const mapOpenAiFailure = (
  error: unknown,
  runtime: ReturnType<typeof getAiChatRuntimeConfig>,
): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
      error instanceof ZodError
        ? { providerSchemaIssues: getAuthoringProviderSchemaIssues(error) }
        : undefined,
    );
  }

  const failure = readOpenAiFailure(error);
  logOpenAiAuthoringFailure(failure, runtime);
  const message = failure.message.toLowerCase();

  if (failure.status === 401 || failure.status === 403) {
    return new AppError(
      'The learning assistant is not configured correctly.',
      503,
      'AI_PROVIDER_AUTH_ERROR',
      { status: failure.status, model: runtime.model },
    );
  }

  if (failure.status === 400) {
    return new AppError(
      'The learning assistant request is not compatible with the configured model.',
      502,
      'AI_PROVIDER_REQUEST_INVALID',
      { status: failure.status, model: runtime.model },
    );
  }

  if (failure.status === 404) {
    return new AppError(
      'The configured learning assistant model is not available.',
      503,
      'AI_PROVIDER_MODEL_UNAVAILABLE',
      { status: failure.status, model: runtime.model },
    );
  }

  if (failure.status === 429 || message.includes('rate limit')) {
    return new AppError(
      'The learning assistant is temporarily busy. Please try again shortly.',
      429,
      'AI_PROVIDER_RATE_LIMITED',
      { status: failure.status, model: runtime.model },
    );
  }

  return new AppError(
    'The learning assistant is temporarily unavailable.',
    502,
    'AI_PROVIDER_ERROR',
    { status: failure.status, model: runtime.model },
  );
};

const mapGeminiFailure = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }

  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error);
  if (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted')
  ) {
    return new AppError(
      'The learning assistant is temporarily busy. Please try again shortly.',
      429,
      'AI_PROVIDER_RATE_LIMITED',
    );
  }

  if (
    message.includes('api key not valid') ||
    message.includes('permission denied')
  ) {
    return new AppError(
      'The learning assistant is not configured correctly.',
      503,
      'AI_PROVIDER_AUTH_ERROR',
    );
  }

  return new AppError(
    'The learning assistant is temporarily unavailable.',
    502,
    'AI_PROVIDER_ERROR',
  );
};

const readGeminiText = (response: { text?: string | null }) => {
  const text = response.text?.trim();
  if (!text) {
    throw new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }
  return text;
};

const logOpenAiAuthoringResponse = (
  response: OpenAI.Chat.Completions.ChatCompletion,
  runtime: ReturnType<typeof getAiChatRuntimeConfig>,
  diagnosticStage?: string,
) => {
  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    return;
  }

  const rawResponse = response as unknown as Record<string, unknown>;
  const choices = Array.isArray(rawResponse.choices) ? rawResponse.choices : [];
  const choice = choices[0] && typeof choices[0] === 'object'
    ? (choices[0] as Record<string, unknown>)
    : null;
  const message = choice?.message && typeof choice.message === 'object'
    ? (choice.message as Record<string, unknown>)
    : null;
  const content = message?.content;
  const providerMetadata = rawResponse.provider ?? rawResponse.metadata ?? rawResponse.error ?? null;
  let safeProviderMetadata: string | null = null;
  if (providerMetadata != null) {
    try {
      safeProviderMetadata = truncateUpstreamDiagnostic(
        typeof providerMetadata === 'string'
          ? providerMetadata
          : JSON.stringify(providerMetadata),
      );
    } catch {
      safeProviderMetadata = '[unserializable provider metadata]';
    }
  }

  logger.debug(
    {
      operation: 'ai_authoring_openai_compatible_response',
      upstreamStatus: 200,
      responseId: typeof rawResponse.id === 'string' ? rawResponse.id : null,
      resolvedProviderModel:
        typeof rawResponse.model === 'string' ? rawResponse.model : null,
      configuredModel: runtime.model,
      choiceCount: choices.length,
      finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
      messageKeys: message ? Object.keys(message).slice(0, 20) : [],
      messageContentType: typeof content,
      messageContentLength: typeof content === 'string' ? content.length : 0,
      messageContentEmpty: typeof content !== 'string' || content.trim().length === 0,
      messageContentStartsWithJsonObject:
        typeof content === 'string' ? content.trimStart().startsWith('{') : false,
      messageHasReasoning: Boolean(message?.reasoning),
      messageHasReasoningDetails: Boolean(message?.reasoning_details),
      usageCompletionCount: response.usage?.completion_tokens ?? null,
      providerErrorMetadata: safeProviderMetadata,
      authoringStage: diagnosticStage ?? null,
      authoringOperation:
        diagnosticStage === 'COMPONENTS'
          ? 'component_generation'
          : diagnosticStage
            ? 'scalar_generation'
            : 'authoring_generation',
    },
    'AI authoring OpenAI-compatible provider response received',
  );
};

const readOpenAiText = (
  response: OpenAI.Chat.Completions.ChatCompletion,
  runtime: ReturnType<typeof getAiChatRuntimeConfig>,
  diagnosticStage?: string,
) => {
  logOpenAiAuthoringResponse(response, runtime, diagnosticStage);
  const content = response.choices[0]?.message?.content;
  const text = typeof content === 'string' ? content.trim() : '';
  if (!text) {
    throw new AppError(
      'The learning assistant returned an empty response. Please try again.',
      502,
      'AI_PROVIDER_EMPTY_RESPONSE',
    );
  }
  return text;
};

const getGeminiClient = () => {
  const apiKey = getConfiguredGeminiApiKey();
  if (!apiKey) {
    throw new AppError(
      'The learning assistant is temporarily unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  return new GoogleGenAI({ apiKey });
};

const getOpenAiClient = (runtime: ReturnType<typeof getAiChatRuntimeConfig>) => {
  if (!runtime.openaiApiKey) {
    throw new AppError(
      'The learning assistant is temporarily unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  return openAiAuthoringClientFactoryOverride?.() ?? new OpenAI({
    apiKey: runtime.openaiApiKey,
    baseURL: runtime.openaiBaseUrl ?? undefined,
    timeout: runtime.timeoutMs,
    defaultHeaders: runtime.isOpenRouter
      ? {
          'HTTP-Referer': env.appPublicBaseUrl || 'http://localhost:4000',
          'X-Title': 'ImpactLoop',
        }
      : undefined,
  });
};

const supportsAuthoringStrictStructuredOutput = (
  runtime: ReturnType<typeof getAiChatRuntimeConfig>,
) => runtime.isOpenRouter && /^openai\/gpt-4\.1-nano(?:$|[-:])/i.test(runtime.model);

const toOpenAiCompatibleStructuredSchema = (
  schema: unknown,
  isRoot = true,
): unknown => {
  if (Array.isArray(schema)) {
    return schema.map((item) => toOpenAiCompatibleStructuredSchema(item, false));
  }
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  const record = schema as Record<string, unknown>;
  const normalized = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      // OpenAI Structured Outputs accepts anyOf but rejects Zod's discriminated-union oneOf.
      // Both retain every branch generated from the source Zod validator.
      key === 'oneOf' ? 'anyOf' : key,
      toOpenAiCompatibleStructuredSchema(value, false),
    ]),
  );
  const properties = record.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    if (isRoot && Array.isArray(normalized.anyOf)) {
      // The provider forbids a union at the root. Keep the generated discriminated
      // union intact in an internal envelope and unwrap it before source Zod validation.
      return {
        type: 'object',
        properties: { result: { anyOf: normalized.anyOf } },
        required: ['result'],
        additionalProperties: false,
      };
    }
    return normalized;
  }

  const propertyNames = Object.keys(properties);
  const required = Array.isArray(record.required)
    ? record.required.filter((name): name is string => typeof name === 'string')
    : [];
  const requiredSet = new Set(required);
  const normalizedProperties = normalized.properties as Record<string, unknown>;

  return {
    ...normalized,
    properties: Object.fromEntries(
      propertyNames.map((name) => [
        name,
        requiredSet.has(name)
          ? normalizedProperties[name]
          : { anyOf: [normalizedProperties[name], { type: 'null' }] },
      ]),
    ),
    // OpenAI Structured Outputs requires all declared properties to be required.
    // Optional Zod properties remain optional to the application as nullable transport fields.
    required: propertyNames,
  };
};

const buildAuthoringOpenAiResponseFormat = (
  runtime: ReturnType<typeof getAiChatRuntimeConfig>,
  structuredOutput?: { name: string; schema: unknown },
) => {
  if (supportsAuthoringStrictStructuredOutput(runtime) && structuredOutput) {
    return {
      response_format: {
        type: 'json_schema' as const,
        json_schema: {
          name: structuredOutput.name,
          strict: true,
          schema: toOpenAiCompatibleStructuredSchema(structuredOutput.schema),
        },
      },
    };
  }

  return runtime.openaiJsonMode
    ? { response_format: { type: 'json_object' as const } }
    : {};
};

/** Step plans need far more tokens than the chat default (1024). */
const STEP_PLAN_MAX_OUTPUT_TOKENS = Math.max(env.aiChatMaxOutputTokens, 8192);

const callGeminiStructured = async (
  systemInstruction: string,
  userPrompt: string,
  options?: { maxOutputTokens?: number },
) => {
  const startedAt = Date.now();
  const candidates = getGeminiChatModelCandidates();
  let lastError: unknown;
  const ai = getGeminiClient();
  const maxOutputTokens = options?.maxOutputTokens ?? env.aiChatMaxOutputTokens;

  for (const model of candidates) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            temperature: 0.2,
            maxOutputTokens,
            responseMimeType: 'application/json',
            systemInstruction,
          },
        }),
        env.aiChatTimeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      return {
        text: readGeminiText(response),
        model: response.modelVersion ?? model,
        inputTokens: response.usageMetadata?.promptTokenCount ?? null,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message.toLowerCase() : String(error);
      if (
        !message.includes('not found') &&
        !message.includes('no longer available')
      ) {
        throw mapGeminiFailure(error);
      }
    }
  }

  throw mapGeminiFailure(lastError);
};

const callOpenAiStructured = async (
  systemInstruction: string,
  userPrompt: string,
  options?: {
    maxOutputTokens?: number;
    structuredOutput?: { name: string; schema: unknown };
    diagnosticStage?: string;
  },
) => {
  const startedAt = Date.now();
  const runtime = getAiChatRuntimeConfig();
  const client = getOpenAiClient(runtime);
  const maxTokens = options?.maxOutputTokens ?? runtime.maxOutputTokens;

  try {
    const response = await withTimeout(
      client.chat.completions.create({
        model: runtime.model,
        temperature: 0.2,
        max_tokens: maxTokens,
        ...buildAuthoringOpenAiResponseFormat(runtime, options?.structuredOutput),
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
      }),
      runtime.timeoutMs,
      'AI_PROVIDER_TIMEOUT',
    );

    return {
      text: readOpenAiText(response, runtime, options?.diagnosticStage),
      model: response.model ?? runtime.model,
      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    throw mapOpenAiFailure(error, runtime);
  }
};

const invokeRealProvider = async (
  provider: RealProviderName,
  systemInstruction: string,
  userPrompt: string,
  options?: {
    maxOutputTokens?: number;
    structuredOutput?: { name: string; schema: unknown };
    diagnosticStage?: string;
  },
) => {
  if (invokerOverride) {
    invokerCallCountForTests += 1;
    const response = await invokerOverride({
      provider,
      systemInstruction,
      userPrompt,
    });
    return {
      ...response,
      latencyMs: 1,
    };
  }

  if (provider === 'openai') {
    return callOpenAiStructured(systemInstruction, userPrompt, options);
  }

  return callGeminiStructured(systemInstruction, userPrompt, options);
};

const invokeRealComponentProvider = async (
  provider: RealProviderName,
  systemInstruction: string,
  userPrompt: string,
) => {
  if (componentInvokerOverride) {
    componentInvokerCallCountForTests += 1;
    const response = await componentInvokerOverride({
      provider,
      systemInstruction,
      userPrompt,
    });
    return {
      ...response,
      latencyMs: 1,
    };
  }

  return invokeRealProvider(provider, systemInstruction, userPrompt, {
    structuredOutput: {
      name: 'impactloop_authoring_component_list',
      schema: componentListProviderJsonSchema,
    },
    diagnosticStage: 'COMPONENTS',
  });
};

const invokeRealStepProvider = async (
  provider: RealProviderName,
  systemInstruction: string,
  userPrompt: string,
) => {
  if (stepInvokerOverride) {
    stepInvokerCallCountForTests += 1;
    const response = await stepInvokerOverride({
      provider,
      systemInstruction,
      userPrompt,
    });
    return {
      ...response,
      latencyMs: 1,
    };
  }

  return invokeRealProvider(provider, systemInstruction, userPrompt, {
    maxOutputTokens: STEP_PLAN_MAX_OUTPUT_TOKENS,
  });
};

const invokeRealScalarProvider = async (
  provider: RealProviderName,
  systemInstruction: string,
  userPrompt: string,
  options?: {
    structuredOutput?: { name: string; schema: unknown };
    diagnosticStage?: string;
  },
) => {
  if (scalarInvokerOverride) {
    scalarInvokerCallCountForTests += 1;
    const response = await scalarInvokerOverride({
      provider,
      systemInstruction,
      userPrompt,
    });
    return {
      ...response,
      latencyMs: 1,
    };
  }

  return invokeRealProvider(provider, systemInstruction, userPrompt, options);
};

export const buildAuthoringClarificationPrompt = (
  input: RealAuthoringClarificationInput,
) => {
  const remainingBudget = Math.max(
    0,
    PROJECT_AUTHORING_MAX_CLARIFICATION_QUESTIONS - input.answeredQuestionCount,
  );

  const topicState = computeAuthoringTopicState({
    ideaText: input.ideaText,
    projectTitle: input.projectTitle,
    projectShortDescription: input.projectShortDescription,
    projectDescription: input.projectDescription,
    categoryName: input.categoryName,
    difficulty: input.difficulty,
    answeredQuestionKeys: input.answeredQuestionKeys,
    answeredQuestionCount: input.answeredQuestionCount,
  });

  const payload = {
    locale: input.locale,
    ideaText: input.ideaText,
    draft: {
      title: input.projectTitle,
      shortDescription: input.projectShortDescription,
      description: input.projectDescription,
      categoryName: input.categoryName,
      difficulty: input.difficulty,
      componentNames: input.componentNames,
      stepTitles: input.stepTitles,
    },
    projectDomain: topicState.domain,
    satisfiedTopics: topicState.satisfiedTopics,
    unresolvedTopics: topicState.unresolvedTopics,
    answeredQuestionKeys: input.answeredQuestionKeys,
    answeredQuestionCount: input.answeredQuestionCount,
    remainingQuestionBudget: remainingBudget,
    serverReadinessRecommended: topicState.unresolvedTopics.length === 0,
    currentAnswer: input.currentAnswer,
    recentAuthoringAnswers: input.recentAuthoringAnswers ?? [],
    latestClarification: input.latestClarification,
    repairAttempt: input.repairAttempt,
    repairIssue: input.repairIssue ?? null,
    previousInvalidOutput: input.previousInvalidOutput ?? null,
    requiredOutputShape: {
      clarification: {
        type: 'project_authoring_clarification',
        status: 'NEEDS_CLARIFICATION | READY_FOR_PROPOSAL',
        summary: 'string',
        knownFacts: [
          {
            key: 'stable_key',
            label: 'string',
            value: 'string',
            source: 'IDEA | DRAFT | LEARNER_ANSWER | PROFILE',
          },
        ],
        nextQuestion:
          '{ key, prompt, answerType, options } | null when READY_FOR_PROPOSAL',
        remainingTopics: 'number',
        assumptions: ['string'],
        warnings: ['string'],
      },
      assistantText: 'short learner-facing message',
    },
  };

  if (input.repairAttempt && input.repairIssue) {
    return JSON.stringify({
      repair: {
        issue: input.repairIssue,
        allowedUnresolvedTopicKeys: topicState.unresolvedTopics,
        remainingQuestionBudget: remainingBudget,
        satisfiedTopics: topicState.satisfiedTopics,
      },
      context: payload,
    });
  }

  return JSON.stringify(payload);
};

export const generateRealAuthoringClarification = async (
  input: RealAuthoringClarificationInput,
  provider: RealProviderName,
): Promise<RealAuthoringClarificationProviderResult> => {
  const startedAt = Date.now();
  const userPrompt = buildAuthoringClarificationPrompt(input);
  const attempt = input.repairAttempt ? 2 : 1;

  try {
    const response = await invokeRealProvider(
      provider,
      PROJECT_AUTHORING_CLARIFICATION_SYSTEM_POLICY,
      userPrompt,
      {
        structuredOutput: {
          name: 'impactloop_authoring_clarification',
          schema: aiAuthoringClarificationProviderJsonSchema,
        },
      },
    );

    let raw: unknown;
    try {
      raw = parseStructuredProviderJson(response.text);
    } catch (error) {
      recordAuthoringValidationDiagnostic({
        provider,
        attempt,
        stage: 'json_extraction',
        issues: [
          {
            path: '(root)',
            code: 'json_extraction_failed',
            message:
              error instanceof Error ? error.message : 'Could not extract JSON object',
          },
        ],
      });
      throw error;
    }

    const parsed = parseAuthoringProviderPayload({
      raw,
      provider,
      attempt,
    });

    return {
      provider,
      model: response.model,
      data: parsed,
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
      latencyMs: response.latencyMs ?? Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw provider === 'openai'
      ? mapOpenAiFailure(error, getAiChatRuntimeConfig())
      : mapGeminiFailure(error);
  }
};
const providerComponentRoleSchema = z.enum(['MATERIAL', 'TOOL', 'CONSUMABLE']);
const providerComponentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(10000),
  unit: z.string().trim().min(1).max(40),
  role: providerComponentRoleSchema,
  required: z.boolean(),
  notes: z.string().trim().max(500).nullable().optional(),
});

const componentListProviderResponseSchema = z.object({
  kind: z.literal('COMPONENT_LIST'),
  components: z.array(providerComponentSchema).min(1).max(30),
  explanation: z.string().trim().min(8).max(4000),
});

// This is the single transport schema for provider output. The mapped
// SequentialComponent shape is intentionally derived only after this source
// schema has validated the model response.
const componentListProviderJsonSchema = z.toJSONSchema(
  componentListProviderResponseSchema,
);

const stepPlanProviderResponseSchema = z.object({
  kind: z.literal('STEP_PLAN'),
  steps: z
    .array(
      z.object({
        order: z.number().int().positive(),
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().min(32).max(2000),
        safetyNote: z.string().trim().max(500).nullable().optional(),
        componentRefs: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
      }),
    )
    .min(2)
    .max(30),
  explanation: z.string().trim().min(8).max(4000),
});

const SHALLOW_STEP_DESCRIPTION_PATTERNS = [
  /^connect the (circuit|components)\.?$/i,
  /^write the code\.?$/i,
  /^test the project\.?$/i,
  /^build the project\.?$/i,
  /^prepare the materials\.?$/i,
  /^جهّز المواد\.?$/,
  /^نفّذ المشروع\.?$/,
  /^اختبر النتيجة\.?$/,
];

const VAGUE_COMPONENT_NAME_PATTERNS = [
  /^electronic parts?$/i,
  /^wiring tools?$/i,
  /^project supplies?$/i,
  /^مواد عامة$/,
  /^أدوات عامة$/,
];

const ARABIC_SCRIPT_PATTERN = /[\u0600-\u06FF]/;

const assertParsedComponentListQuality = (
  input: RealAuthoringComponentListInput,
  components: SequentialComponent[],
) => {
  const issues: string[] = [];
  const corpus = [
    input.ideaText,
    input.projectTitle,
    input.projectDescription ?? '',
    ...input.learnerConstraints,
  ].join('\n');
  const looksArabic = input.locale === 'ar' || ARABIC_SCRIPT_PATTERN.test(corpus);

  if (looksArabic) {
    const arabicComponents = components.filter((component) =>
      ARABIC_SCRIPT_PATTERN.test(`${component.componentName} ${component.notes ?? ''}`),
    ).length;
    if (arabicComponents < Math.ceil(components.length / 2)) {
      issues.push('Arabic projects require Arabic component names and notes.');
    }
  }

  for (const component of components) {
    const name = component.componentName.trim();
    if (VAGUE_COMPONENT_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
      issues.push(`Component "${name}" is too vague.`);
    }
    if ((component.notes ?? '').trim().length < 8) {
      issues.push(`Component "${name}" needs a clearer purpose in notes.`);
    }
  }

  const hardware =
    /\b(arduino|ldr|led|breadboard|sensor|microcontroller|resistor)\b/i.test(corpus) ||
    /(اردوينو|حساس|ليد|بريدبورد|مقاومة)/i.test(corpus);
  if (hardware && components.length < 5) {
    issues.push(
      `Hardware projects need a circuit-complete component list; received ${components.length}.`,
    );
  }

  if (issues.length > 0) {
    throw new AppError(issues.join(' '), 502, 'AI_COMPONENT_PROPOSAL_INVALID', { issues });
  }
};

const ARABIC_STEP_ACTION_PATTERN =
  /(وصّل|وصل|توصيل|ثبّت|ثبت|تثبيت|ضع|اربط|اكتب|عرّف|عرف|تعريف|اقرأ|قراءة|ارفع|رفع|اختبر|اختبار|عاير|معايرة|تحقق|سجّل|سجل|جهّز|جهز|فحص|اضبط|ضبط|اختر|شغّل|تشغيل|ركّب|ركب|أدخل|ادخل)/i;

const ENGLISH_STEP_ACTION_PATTERN =
  /\b(connect|wire|upload|open|place|read|test|adjust|write|attach|insert|solder|mount|prepare|inspect|set|define|build|install|control|add|choose|turn|verify|calibrate|record)\b/i;

const STEP_OUTCOME_PATTERN =
  /\b(verify|confirm|check|should|until|expect|تأكد|تحقق|يجب|حتى|النتيجة|بنجاح|correctly)\b/i;

export type StepPlanProjectType =
  | 'HARDWARE_ELECTRONICS'
  | 'CRAFT_PHYSICAL'
  | 'GENERAL_PHYSICAL'
  | 'GENERIC';

export type StepPlanImplementationPhase = {
  key: string;
  labelEn: string;
  labelAr: string;
  patterns: RegExp[];
};

export type StepPlanQualityRequirements = {
  projectType: StepPlanProjectType;
  structuralMinimum: number;
  minimumMeaningfulSteps: number;
  expectedPhaseCount: number;
  preferredRangeMin: number;
  preferredRangeMax: number;
  safeMaximum: number;
  requiredPhases: StepPlanImplementationPhase[];
  contentLanguage: 'ar' | 'en';
  requiresArabicSteps: boolean;
};

export type StepPlanQualityContext = {
  locale: AiLocale;
  ideaText: string;
  projectTitle: string;
  projectShortDescription: string;
  projectDescription: string | null;
  difficulty: string;
  estimatedMinutes: number | null;
  components: SequentialComponent[];
  recentAnswers?: string[];
  requestedStepCount?: number | null;
};

const HARDWARE_ELECTRONICS_PHASES: StepPlanImplementationPhase[] = [
  {
    key: 'preparation',
    labelEn: 'prepare and inspect components',
    labelAr: 'تجهيز وفحص المكونات',
    patterns: [/جهّز|جهز|فحص|inspect|prepare|سليمة|تحقق/i],
  },
  {
    key: 'divider_concept',
    labelEn: 'LDR voltage divider understanding',
    labelAr: 'فهم مقسم جهد LDR',
    patterns: [/مقسم|voltage divider|divider|10k|10\s*k|كيلو أوم/i],
  },
  {
    key: 'breadboard_setup',
    labelEn: 'breadboard placement',
    labelAr: 'تثبيت على Breadboard',
    patterns: [/breadboard|لوحة تجارب|بريدبورد/i],
  },
  {
    key: 'ldr_wiring',
    labelEn: 'LDR and divider resistor wiring',
    labelAr: 'توصيل LDR والمقاومة',
    patterns: [/ldr|حساس|photoresistor|10k|10\s*k/i, /وصّل|wire|connect|توصيل/i],
  },
  {
    key: 'analog_input',
    labelEn: 'analog input connection',
    labelAr: 'توصيل مدخل Analog',
    patterns: [/analog|a0|analogread|قياس/i],
  },
  {
    key: 'led_wiring',
    labelEn: 'LED and current-limiting resistor wiring',
    labelAr: 'توصيل LED ومقاومة الحماية',
    patterns: [/led|مصباح|220/i, /وصّل|wire|connect|توصيل/i],
  },
  {
    key: 'code_setup',
    labelEn: 'code pin definitions',
    labelAr: 'تعريف الأرجل في الكود',
    patterns: [/arduino ide|كود|code|sketch|تعريف|define|pin/i],
  },
  {
    key: 'sensor_reading',
    labelEn: 'read sensor values',
    labelAr: 'قراءة قيمة الحساس',
    patterns: [/serial|analogread|قراءة|monitor|طبع/i],
  },
  {
    key: 'threshold_control',
    labelEn: 'threshold and LED control',
    labelAr: 'ضبط Threshold والتحكم بالإضاءة',
    patterns: [/threshold|عتبة|تحكم|تشغيل|control/i],
  },
  {
    key: 'upload_test',
    labelEn: 'upload and bright/dark testing',
    labelAr: 'رفع الكود والاختبار',
    patterns: [/upload|رفع|usb|اختبار|test|ضوء|ظلام/i],
  },
  {
    key: 'calibration',
    labelEn: 'calibration or troubleshooting',
    labelAr: 'معايرة أو استكشاف أخطاء',
    patterns: [/معاير|calibrat|troubleshoot|استكشاف|اضبط/i],
  },
];

const CRAFT_PHYSICAL_PHASES: StepPlanImplementationPhase[] = [
  {
    key: 'workspace',
    labelEn: 'workspace preparation',
    labelAr: 'تجهيز مساحة العمل',
    patterns: [/جهّز|prepare|مساحة|workspace/i],
  },
  {
    key: 'materials',
    labelEn: 'material gathering',
    labelAr: 'تجميع المواد',
    patterns: [/مواد|materials|قطع/i],
  },
  {
    key: 'assembly',
    labelEn: 'main assembly',
    labelAr: 'التجميع الرئيسي',
    patterns: [/ثبّت|assemble|بناء|build|قص/i],
  },
  {
    key: 'finish_test',
    labelEn: 'finishing and verification',
    labelAr: 'الإنهاء والتحقق',
    patterns: [/اختبار|test|راجع|verify|تحقق/i],
  },
];

export const projectLooksHardwareOrientedForSteps = (corpus: string) =>
  /\b(arduino|ldr|led|breadboard|sensor|voltage|gpio|analog|digital pin|microcontroller|resistor)\b/i.test(
    corpus,
  ) || /(اردوينو|حساس|صمام|مقاومة|توصيل|بريدبورد|ليد)/i.test(corpus);

const projectLooksCraftOriented = (corpus: string) =>
  /\b(cardboard|paper craft|glue gun|fabric|felt|paint|scissors|craft)\b/i.test(corpus) ||
  /(ورق مقوى|كرتون|لاصق|شمع|خياطة|رسم|حرف|أكريليك)/i.test(corpus);

const projectCorpusFromQualityContext = (input: StepPlanQualityContext) =>
  [
    input.ideaText,
    input.projectTitle,
    input.projectShortDescription,
    input.projectDescription ?? '',
    ...(input.recentAnswers ?? []),
  ].join('\n');

const normalizeStepTitleKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[!.؟?،,]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

const descriptionWordSet = (value: string) =>
  new Set(
    normalizeStepTitleKey(value)
      .split(/\s+/)
      .filter((token) => token.length >= 4),
  );

const descriptionSimilarity = (left: string, right: string) => {
  const leftWords = descriptionWordSet(left);
  const rightWords = descriptionWordSet(right);
  if (leftWords.size === 0 || rightWords.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(leftWords.size, rightWords.size);
};

const computeExpectedPhaseCount = (
  input: StepPlanQualityContext,
  projectType: StepPlanProjectType,
  minimumMeaningfulSteps: number,
  requiredPhases: StepPlanImplementationPhase[],
): number => {
  const safeMaximum = MAX_PROPOSAL_STEPS;
  if (projectType === 'CRAFT_PHYSICAL') {
    return Math.min(
      safeMaximum,
      Math.max(minimumMeaningfulSteps, requiredPhases.length || 4),
    );
  }
  if (projectType === 'HARDWARE_ELECTRONICS') {
    const groupedPhases = requiredPhases.length;
    const componentDepth = Math.min(3, Math.floor(input.components.length / 3));
    const durationDepth =
      (input.estimatedMinutes ?? 0) >= 240
        ? 2
        : (input.estimatedMinutes ?? 0) >= 180
          ? 1
          : 0;
    const meaningfulGroupedPhaseCount = Math.min(
      safeMaximum,
      groupedPhases + componentDepth + durationDepth - 1,
    );
    return Math.max(minimumMeaningfulSteps, meaningfulGroupedPhaseCount);
  }
  if (projectType === 'GENERAL_PHYSICAL') {
    return Math.min(
      safeMaximum,
      Math.max(minimumMeaningfulSteps, 6 + Math.floor(input.components.length / 2)),
    );
  }
  return minimumMeaningfulSteps;
};

const OVERLOADED_MAJOR_TASK_GROUPS = [
  { key: 'wiring', patterns: [/wire|connect.*breadboard|وصل.*breadboard|توصيل.*breadboard/i] },
  { key: 'coding', patterns: [/write.*code|اكتب كود|arduino ide|analogread|serial monitor/i] },
  { key: 'upload', patterns: [/upload the|upload via|ارفع الكود|رفع البرنامج/i] },
  { key: 'calibration', patterns: [/calibrat|معاير|threshold|عتبة/i] },
  {
    key: 'testing',
    patterns: [/test in light|final test|اختبر النتيجة|اختبر المشروع|verify success/i],
  },
] as const;

export const detectOverloadedSteps = (steps: SequentialStep[]) => {
  const issues: string[] = [];
  for (const step of steps) {
    const mainDescription = step.description.split('\n\n')[0] ?? step.description;
    const text = `${step.title} ${mainDescription}`;
    const matchedGroups = OVERLOADED_MAJOR_TASK_GROUPS.filter(({ patterns }) =>
      patterns.some((pattern) => pattern.test(text)),
    ).map((group) => group.key);
    if (new Set(matchedGroups).size >= 3) {
      issues.push(
        `Step "${step.title}" overloads multiple independent major phases (${matchedGroups.join(', ')}).`,
      );
    }
  }
  return issues;
};

export const computeStepPlanQualityRequirements = (
  input: StepPlanQualityContext,
): StepPlanQualityRequirements => {
  const corpus = projectCorpusFromQualityContext(input);
  const requiresArabicSteps =
    input.locale === 'ar' || ARABIC_SCRIPT_PATTERN.test(corpus);
  const contentLanguage: 'ar' | 'en' = requiresArabicSteps ? 'ar' : 'en';
  const structuralMinimum = 2;
  const safeMaximum = MAX_PROPOSAL_STEPS;

  if (input.requestedStepCount != null && input.requestedStepCount >= structuralMinimum) {
    const exact = input.requestedStepCount;
    const projectType = projectLooksHardwareOrientedForSteps(corpus)
      ? 'HARDWARE_ELECTRONICS'
      : projectLooksCraftOriented(corpus)
        ? 'CRAFT_PHYSICAL'
        : input.components.length >= 4
          ? 'GENERAL_PHYSICAL'
          : 'GENERIC';
    const requiredPhases = projectLooksHardwareOrientedForSteps(corpus)
      ? HARDWARE_ELECTRONICS_PHASES
      : projectLooksCraftOriented(corpus)
        ? CRAFT_PHYSICAL_PHASES
        : [];
    return {
      projectType,
      structuralMinimum,
      minimumMeaningfulSteps: exact,
      expectedPhaseCount: exact,
      preferredRangeMin: exact,
      preferredRangeMax: exact,
      safeMaximum,
      requiredPhases,
      contentLanguage,
      requiresArabicSteps,
    };
  }

  if (projectLooksHardwareOrientedForSteps(corpus)) {
    const minimumMeaningfulSteps = 8;
    const requiredPhases = HARDWARE_ELECTRONICS_PHASES;
    const expectedPhaseCount = computeExpectedPhaseCount(
      input,
      'HARDWARE_ELECTRONICS',
      minimumMeaningfulSteps,
      requiredPhases,
    );
    const preferredRangeMin = Math.min(
      safeMaximum,
      Math.max(minimumMeaningfulSteps + 2, Math.ceil(expectedPhaseCount * 0.65)),
    );
    return {
      projectType: 'HARDWARE_ELECTRONICS',
      structuralMinimum,
      minimumMeaningfulSteps,
      expectedPhaseCount,
      preferredRangeMin,
      preferredRangeMax: Math.min(safeMaximum, Math.max(preferredRangeMin + 2, expectedPhaseCount + 1)),
      safeMaximum,
      requiredPhases,
      contentLanguage,
      requiresArabicSteps,
    };
  }

  if (projectLooksCraftOriented(corpus)) {
    const minimumMeaningfulSteps = 4;
    const requiredPhases = CRAFT_PHYSICAL_PHASES;
    const expectedPhaseCount = computeExpectedPhaseCount(
      input,
      'CRAFT_PHYSICAL',
      minimumMeaningfulSteps,
      requiredPhases,
    );
    return {
      projectType: 'CRAFT_PHYSICAL',
      structuralMinimum,
      minimumMeaningfulSteps,
      expectedPhaseCount,
      preferredRangeMin: 4,
      preferredRangeMax: 6,
      safeMaximum,
      requiredPhases,
      contentLanguage,
      requiresArabicSteps,
    };
  }

  if (input.components.length >= 4) {
    const minimumMeaningfulSteps = 6;
    const expectedPhaseCount = computeExpectedPhaseCount(
      input,
      'GENERAL_PHYSICAL',
      minimumMeaningfulSteps,
      [],
    );
    return {
      projectType: 'GENERAL_PHYSICAL',
      structuralMinimum,
      minimumMeaningfulSteps,
      expectedPhaseCount,
      preferredRangeMin: 6,
      preferredRangeMax: 10,
      safeMaximum,
      requiredPhases: [],
      contentLanguage,
      requiresArabicSteps,
    };
  }

  const minimumMeaningfulSteps = 4;
  return {
    projectType: 'GENERIC',
    structuralMinimum,
    minimumMeaningfulSteps,
    expectedPhaseCount: minimumMeaningfulSteps,
    preferredRangeMin: 4,
    preferredRangeMax: 6,
    safeMaximum,
    requiredPhases: [],
    contentLanguage,
    requiresArabicSteps,
  };
};

const collectMissingImplementationPhases = (
  planText: string,
  requirements: StepPlanQualityRequirements,
) =>
  requirements.requiredPhases
    .filter((phase) => !phase.patterns.some((pattern) => pattern.test(planText)))
    .map((phase) => (requirements.contentLanguage === 'ar' ? phase.labelAr : phase.labelEn));

const minimumPhasesRequired = (requirements: StepPlanQualityRequirements) => {
  if (requirements.requiredPhases.length === 0) {
    return 0;
  }
  return Math.min(
    requirements.requiredPhases.length,
    Math.max(4, Math.ceil(requirements.minimumMeaningfulSteps * 0.6)),
  );
};

export type StepPlanQualityEvaluation =
  | { ok: true }
  | {
      ok: false;
      issues: string[];
      requiredMinimum: number;
      receivedSteps: number;
      missingPhases: string[];
    };

export const evaluateStepPlanQuality = (
  steps: SequentialStep[],
  requirements: StepPlanQualityRequirements,
  components: SequentialComponent[],
): StepPlanQualityEvaluation => {
  const issues: string[] = [];
  const planText = steps.map((step) => `${step.title} ${step.description}`).join('\n');
  const receivedSteps = steps.length;

  if (requirements.requiresArabicSteps) {
    const arabicSteps = steps.filter((step) =>
      ARABIC_SCRIPT_PATTERN.test(`${step.title} ${step.description}`),
    ).length;
    if (arabicSteps < Math.ceil(steps.length / 2)) {
      issues.push('Arabic projects require Arabic step titles and descriptions.');
    }
  }

  if (receivedSteps < requirements.minimumMeaningfulSteps) {
    issues.push(
      `INSUFFICIENT_STEP_COUNT: Project complexity requires at least ${requirements.minimumMeaningfulSteps} meaningful steps; received ${receivedSteps}.`,
    );
  }

  if (receivedSteps > requirements.safeMaximum) {
    issues.push(
      `Step plan exceeds the safe maximum of ${requirements.safeMaximum} steps without justification.`,
    );
  }

  const titleKeys = steps.map((step) => normalizeStepTitleKey(step.title));
  if (new Set(titleKeys).size !== titleKeys.length) {
    issues.push('Duplicate or near-duplicate step titles are not allowed.');
  }

  for (let index = 0; index < steps.length; index += 1) {
    const normalizedDescription = normalizeStepTitleKey(steps[index]!.description);
    for (let other = index + 1; other < steps.length; other += 1) {
      const otherDescription = normalizeStepTitleKey(steps[other]!.description);
      if (
        normalizedDescription === otherDescription ||
        descriptionSimilarity(steps[index]!.description, steps[other]!.description) >= 0.95
      ) {
        issues.push(
          `Steps "${steps[index]!.title}" and "${steps[other]!.title}" are too similar.`,
        );
      }
    }
  }

  const missingPhases = collectMissingImplementationPhases(planText, requirements);
  const phasesRequired = minimumPhasesRequired(requirements);
  if (receivedSteps >= requirements.minimumMeaningfulSteps && phasesRequired > 0) {
    const coveredCount = requirements.requiredPhases.length - missingPhases.length;
    if (coveredCount < phasesRequired) {
      issues.push(
        `MISSING_REQUIRED_PHASES: Step plan is missing required implementation phases: ${missingPhases.slice(0, 6).join(', ')}.`,
      );
    }
  }

  for (const step of steps) {
    const description = step.description.trim();
    if (SHALLOW_STEP_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(description))) {
      issues.push(`Step "${step.title}" description is too generic.`);
    }
    const hasAction =
      ENGLISH_STEP_ACTION_PATTERN.test(description) ||
      ARABIC_STEP_ACTION_PATTERN.test(description);
    const hasOutcome = STEP_OUTCOME_PATTERN.test(description);
    const referencesComponent = components.some((component) => {
      const name = component.componentName.trim().toLowerCase();
      if (name.length < 3) {
        return false;
      }
      return description.toLowerCase().includes(name.slice(0, Math.min(name.length, 12)));
    });
    const referencesHardware =
      projectLooksHardwareOrientedForSteps(planText) ||
      referencesComponent ||
      /\b(arduino|breadboard|ldr|led|sensor|gpio|analog|digital)\b/i.test(description) ||
      /(اردوينو|بريدبورد|حساس|ليد|مقاومة)/i.test(description);
    const hasImplementationGuidance =
      description.length >= 48 &&
      (hasAction || referencesComponent || /[A-Za-z0-9]{2,}|[\u0600-\u06FF]{3,}/.test(description));
    if (!hasAction || !hasImplementationGuidance) {
      issues.push(`Step "${step.title}" needs concrete action and implementation guidance.`);
    }
    if (requirements.projectType === 'HARDWARE_ELECTRONICS' && !referencesHardware) {
      issues.push(`Step "${step.title}" must reference project components or hardware context.`);
    }
    if (!hasOutcome && description.length < 64) {
      issues.push(`Step "${step.title}" should explain how to confirm success.`);
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues,
      requiredMinimum: requirements.minimumMeaningfulSteps,
      receivedSteps,
      missingPhases,
    };
  }
  return { ok: true };
};

export const assertStepPlanQuality = (
  steps: SequentialStep[],
  requirements: StepPlanQualityRequirements,
  components: SequentialComponent[],
) => {
  const evaluation = evaluateStepPlanQuality(steps, requirements, components);
  if (!evaluation.ok) {
    throw new AppError(evaluation.issues.join(' '), 502, 'AI_AUTHORING_STEP_QUALITY_INVALID', {
      issues: evaluation.issues,
      requiredMinimum: evaluation.requiredMinimum,
      receivedSteps: evaluation.receivedSteps,
      missingPhases: evaluation.missingPhases,
    });
  }
};

export const buildStepQualityRepairIssue = (input: {
  requirements: StepPlanQualityRequirements;
  receivedSteps: number;
  issues: string[];
  missingPhases: string[];
  steps?: SequentialStep[];
}) => {
  const range = `${input.requirements.preferredRangeMin}-${input.requirements.preferredRangeMax}`;
  const missingPhaseText =
    input.missingPhases.length > 0
      ? `Missing implementation phases: ${input.missingPhases.join(', ')}.`
      : 'Expand using meaningful implementation phases, not artificial splitting.';
  const overloadedFromSteps =
    input.steps != null ? detectOverloadedSteps(input.steps) : [];
  const overloadedText = [
    ...input.issues
      .filter((issue) => issue.includes('OVERLOADED_STEPS'))
      .map((issue) => issue.replace(/^OVERLOADED_STEPS:\s*/i, '')),
    ...overloadedFromSteps,
  ].join(' ');
  return [
    `Previous step plan contained ${input.receivedSteps} meaningful steps.`,
    `This project requires at least ${input.requirements.minimumMeaningfulSteps} meaningful steps.`,
    `Expected meaningful grouped phase count is about ${input.requirements.expectedPhaseCount}; this is guidance only and not a hard minimum.`,
    `Preferred range is ${range}; it is guidance only and not a hard maximum.`,
    `Safe maximum is ${input.requirements.safeMaximum}.`,
    `Aim for approximately ${input.requirements.expectedPhaseCount} meaningfully grouped steps; ${input.requirements.minimumMeaningfulSteps} is only the hard minimum.`,
    `Do not stop once the minimum is reached. Do not target exactly ${input.requirements.minimumMeaningfulSteps}.`,
    `Do not combine independent major phases (wiring, coding, upload, calibration, testing) into overloaded steps.`,
    overloadedText
      ? `Overloaded steps detected: ${overloadedText}`
      : 'Give each major implementation phase its own beginner-friendly step when needed.',
    missingPhaseText,
    `Issues: ${JSON.stringify(input.issues).slice(0, 1200)}`,
  ].join(' ');
};

const assertParsedStepPlanQuality = (
  input: RealAuthoringStepPlanInput,
  steps: SequentialStep[],
) => {
  const requirements =
    input.qualityRequirements ??
    computeStepPlanQualityRequirements({
      locale: input.locale,
      ideaText: input.ideaText,
      projectTitle: input.projectTitle,
      projectShortDescription: input.projectShortDescription,
      projectDescription: input.projectDescription,
      difficulty: input.difficulty,
      estimatedMinutes: input.durationMinutes,
      components: input.components,
      recentAnswers: input.recentMessages,
      requestedStepCount: input.requestedStepCount ?? null,
    });
  assertStepPlanQuality(steps, requirements, input.components);
};

export type RealAuthoringComponentListInput = {
  locale: AiLocale;
  projectId: string | null;
  ideaText: string;
  projectTitle: string;
  projectShortDescription: string;
  projectDescription: string | null;
  difficulty: string | null;
  durationMinutes: number | null;
  learnerConstraints: string[];
  recentMessages: string[];
  clarification: AiProjectAuthoringClarificationBlock;
  repairAttempt: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
  suggestAnother?: boolean;
  previousComponents?: SequentialComponent[];
  feedback?: string | null;
};

export type RealAuthoringStepPlanInput = {
  locale: AiLocale;
  projectId: string | null;
  ideaText: string;
  projectTitle: string;
  projectShortDescription: string;
  projectDescription: string | null;
  difficulty: string;
  durationMinutes: number | null;
  learnerConstraints: string[];
  recentMessages: string[];
  components: SequentialComponent[];
  clarification: AiProjectAuthoringClarificationBlock;
  repairAttempt: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
  suggestAnother?: boolean;
  previousSteps?: SequentialStep[];
  feedback?: string | null;
  requestedStepCount?: number | null;
  qualityRequirements?: StepPlanQualityRequirements;
};

export type RealAuthoringStructuredProviderResult<T> = {
  provider: string;
  model: string | null;
  data: T;
  usage: { inputTokens: number | null; outputTokens: number | null };
  latencyMs: number;
};

export const PROJECT_AUTHORING_COMPONENT_LIST_SYSTEM_POLICY = [
  'You are ImpactLoop project authoring component assistant.',
  'Generate one schema-valid component list for the learner project using only supplied context.',
  'Choose the number of components from actual project needs. Do not pad to a fixed count.',
  'The list must be circuit-complete or project-complete for the described build.',
  'Each component needs: name, quantity, unit, role (MATERIAL | TOOL | CONSUMABLE), required, notes.',
  'Use MATERIAL for required build parts, TOOL for reusable equipment, CONSUMABLE for expendables.',
  'Notes must explain why the project needs the component and acceptable alternatives when relevant.',
  'Do not use vague filler names such as electronic parts, wiring tools, or project supplies.',
  'Do not duplicate components under slightly different names.',
  'Respect explicit learner constraints and exclusions in the context.',
  'Do not include components the learner explicitly excluded.',
  'Match content language to the learner idea and messages, not UI locale alone.',
  'For Arabic projects, write Arabic names/notes while keeping natural technical terms like Arduino, LDR, LED, Breadboard.',
  'Do not claim ImpactLoop inventory availability.',
  'Return strict JSON only with keys: kind, components, explanation.',
  'kind must be COMPONENT_LIST.',
  'Do not wrap JSON in markdown.',
].join('\n');

export const PROJECT_AUTHORING_STEP_PLAN_SYSTEM_POLICY = [
  'You are ImpactLoop project authoring step-plan assistant.',
  'Generate one schema-valid ordered step plan using only supplied context and canonical components.',
  'Choose a useful step count from project complexity. Do not default to three steps.',
  'Follow stepPlanQualityRequirements in the user prompt for minimum meaningful steps, expected phase count, preferred range guidance, and safe maximum.',
  'The minimum is a lower bound only. The preferred range is guidance, not a hard maximum or exact target.',
  'Generate as many meaningful steps as needed for full beginner-friendly coverage up to safeMaximum.',
  'Do not stop once the minimum is reached. Do not target exactly the minimum count.',
  'For hardware projects, use stepPlanQualityRequirements.expectedPhaseCount as semantic depth guidance and group one primary learning objective per step.',
  'Do not split one trivial action into multiple fake steps.',
  'Do not combine independent major phases (wiring, coding, upload, calibration, testing) into one overloaded step.',
  'Each step needs: order (positive integer), title, description, safetyNote (null when unused), componentRefs (array of allowed catalog ids or exact catalog names).',
  'componentRefs must reference only values from allowedComponentRefs in the prompt. Prefer catalog id when present; exact catalog name is also accepted.',
  'Do not invent database IDs. Do not invent unrelated components.',
  'Each description must explain: what to do, how/where, why it is needed, and how to verify success.',
  'Reject shallow one-line instructions. Long vague paragraphs are also invalid.',
  'Do not split one trivial action into multiple fake steps.',
  'Respect learner constraints, exclusions, and difficulty level.',
  'Match content language to the learner idea and messages, not UI locale alone.',
  'For Arabic projects, write Arabic titles/descriptions while keeping natural technical terms (Arduino, LDR, LED, Breadboard, USB).',
  'Do not invent unrelated software, finance, or database workflows for hardware projects.',
  'Return strict JSON only with keys: kind, steps, explanation.',
  'kind must be STEP_PLAN.',
  'Do not wrap JSON in markdown. Do not include prose outside the JSON object.',
].join('\n');

const mapProviderRole = (
  role: z.infer<typeof providerComponentRoleSchema>,
): SequentialComponent['componentRole'] =>
  role === 'MATERIAL' ? 'REQUIRED_MATERIAL' : role;

const mapProviderComponent = (
  component: z.infer<typeof providerComponentSchema>,
): SequentialComponent => ({
  componentName: component.name,
  materialType: 'General',
  quantity: component.quantity,
  unit: component.unit,
  componentRole: mapProviderRole(component.role),
  isRequired: component.required,
  canBeSubstituted: true,
  searchKeywords: component.name.split(/\s+/).filter(Boolean).slice(0, 4),
  notes: component.notes ?? null,
});

export type ComponentReferenceCatalogEntry = {
  id: string;
  canonicalName: string;
  normalizedName: string;
  role: SequentialComponent['componentRole'];
  aliases: string[];
};

export type ResolveComponentRefsResult = {
  refs: string[];
  unknown: string[];
  ambiguous: string[];
};

const ARABIC_CHAR_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/أ|إ|آ/g, 'ا'],
  [/ى/g, 'ي'],
  [/ة/g, 'ه'],
];

export const normalizeComponentRefKey = (value: string) => {
  let normalized = value.trim().toLowerCase();
  for (const [pattern, replacement] of ARABIC_CHAR_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized
    .replace(/[Ωω]/g, 'ohm')
    .replace(/\bكيلو\s*أوم\b/g, 'kohm')
    .replace(/\bكيلو\s*اوم\b/g, 'kohm')
    .replace(/\bك\s*أوم\b/g, 'kohm')
    .replace(/\bك\s*اوم\b/g, 'kohm')
    .replace(/\bأوم\b/g, 'ohm')
    .replace(/\bاوم\b/g, 'ohm')
    .replace(/\bk\s*ohm\b/g, 'kohm')
    .replace(/\b10\s*k\b/g, '10k')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractParentheticalAliases = (componentName: string) => {
  const aliases = new Set<string>();
  const matches = componentName.matchAll(/\(([^)]+)\)/g);
  for (const match of matches) {
    const inner = match[1]?.trim();
    if (inner) {
      aliases.add(inner);
      for (const part of inner.split(/\s*(?:\/|,|أو|or)\s*/i)) {
        const trimmed = part.trim();
        if (trimmed.length >= 2) {
          aliases.add(trimmed);
        }
      }
    }
  }
  const withoutParens = componentName.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (withoutParens.length >= 2) {
    aliases.add(withoutParens);
  }
  return [...aliases];
};

const SAFE_SEMANTIC_ALIAS_GROUPS: Array<{
  componentPattern: RegExp;
  aliases: string[];
}> = [
  {
    componentPattern: /ldr|photoresistor|حساس\s*ضوء/i,
    aliases: ['ldr', 'photoresistor', 'light dependent resistor', 'حساس ضوء', 'حساس الضوء'],
  },
  {
    componentPattern: /\bled\b|مصباح/i,
    aliases: ['led', 'مصباح led', 'مصباح', 'white led', 'red led'],
  },
  {
    componentPattern: /breadboard|لوحة\s*تجارب/i,
    aliases: ['breadboard', 'لوحة تجارب', 'لوحة التجارب'],
  },
  {
    componentPattern: /jumper|أسلاك\s*توصيل/i,
    aliases: ['jumper wire', 'jumper wires', 'أسلاك توصيل', 'اسلاك توصيل'],
  },
  {
    componentPattern: /usb\s*cable|كابل\s*usb/i,
    aliases: ['usb cable', 'usb', 'كابل usb'],
  },
  {
    componentPattern: /arduino/i,
    aliases: ['arduino', 'arduino uno'],
  },
  {
    componentPattern: /10\s*k|10k|10\s*كيلو/i,
    aliases: ['10k', '10k ohm', '10kohm', '10 k ohm', '10k ohm resistor', 'مقاومة 10k', 'مقاومة 10 كيلو اوم'],
  },
  {
    componentPattern: /220|٢٢٠/i,
    aliases: ['220', '220 ohm', '220ohm', '220 ohm resistor', 'مقاومة 220', 'مقاومة 220 اوم'],
  },
  {
    componentPattern: /مسدس\s*شمع|hot\s*glue/i,
    aliases: ['مسدس شمع', 'hot glue gun', 'glue gun'],
  },
  {
    componentPattern: /هيكل|أكريليك|acrylic|housing/i,
    aliases: ['مواد هيكل خارجي', 'أكريليك', 'acrylic', 'housing', 'خشب', 'wood'],
  },
];

const registerAlias = (map: Map<string, string>, alias: string, componentId: string) => {
  const key = normalizeComponentRefKey(alias);
  if (!key) {
    return;
  }
  map.set(key, componentId);
};

export const buildComponentReferenceCatalog = (
  components: SequentialComponent[],
): ComponentReferenceCatalogEntry[] =>
  components
    .filter((component): component is SequentialComponent & { id: string } =>
      Boolean(component.id?.trim()),
    )
    .map((component) => {
      const canonicalName = component.componentName.trim();
      const aliases = new Set<string>([
        canonicalName,
        ...extractParentheticalAliases(canonicalName),
        ...(component.searchKeywords ?? []),
      ]);
      for (const group of SAFE_SEMANTIC_ALIAS_GROUPS) {
        if (group.componentPattern.test(canonicalName)) {
          for (const alias of group.aliases) {
            aliases.add(alias);
          }
        }
      }
      return {
        id: component.id.trim(),
        canonicalName,
        normalizedName: normalizeComponentRefKey(canonicalName),
        role: component.componentRole,
        aliases: [...aliases].filter((alias) => alias.trim().length > 0),
      };
    });

const resolveSingleComponentRef = (
  ref: string,
  catalog: ComponentReferenceCatalogEntry[],
  aliasToId: Map<string, string>,
): { status: 'resolved'; id: string } | { status: 'unknown' } | { status: 'ambiguous' } => {
  const trimmed = ref.trim();
  if (!trimmed) {
    return { status: 'unknown' };
  }
  const exactId = catalog.find((entry) => entry.id === trimmed);
  if (exactId) {
    return { status: 'resolved', id: exactId.id };
  }
  const normalizedRef = normalizeComponentRefKey(trimmed);
  if (!normalizedRef) {
    return { status: 'unknown' };
  }
  const exactCanonical = catalog.find((entry) => entry.normalizedName === normalizedRef);
  if (exactCanonical) {
    return { status: 'resolved', id: exactCanonical.id };
  }
  const aliasId = aliasToId.get(normalizedRef);
  if (aliasId) {
    const aliasOwners = catalog.filter((entry) =>
      entry.aliases.some((alias) => normalizeComponentRefKey(alias) === normalizedRef),
    );
    if (aliasOwners.length === 1) {
      return { status: 'resolved', id: aliasOwners[0]!.id };
    }
    if (aliasOwners.length > 1) {
      return { status: 'ambiguous' };
    }
    return { status: 'resolved', id: aliasId };
  }
  const semanticMatches = catalog.filter((entry) =>
    SAFE_SEMANTIC_ALIAS_GROUPS.some(
      (group) =>
        group.componentPattern.test(entry.canonicalName) &&
        group.aliases.some((alias) => normalizeComponentRefKey(alias) === normalizedRef),
    ),
  );
  if (semanticMatches.length === 1) {
    return { status: 'resolved', id: semanticMatches[0]!.id };
  }
  if (semanticMatches.length > 1) {
    return { status: 'ambiguous' };
  }
  return { status: 'unknown' };
};

export const resolveStepComponentRefs = (
  refs: string[] | undefined,
  catalog: ComponentReferenceCatalogEntry[],
): ResolveComponentRefsResult => {
  if (!refs || refs.length === 0) {
    return { refs: [], unknown: [], ambiguous: [] };
  }
  const aliasToId = new Map<string, string>();
  for (const entry of catalog) {
    registerAlias(aliasToId, entry.canonicalName, entry.id);
    for (const alias of entry.aliases) {
      registerAlias(aliasToId, alias, entry.id);
    }
  }
  const resolved: string[] = [];
  const unknown: string[] = [];
  const ambiguous: string[] = [];
  for (const ref of refs) {
    const outcome = resolveSingleComponentRef(ref, catalog, aliasToId);
    if (outcome.status === 'resolved') {
      resolved.push(outcome.id);
      continue;
    }
    if (outcome.status === 'ambiguous') {
      ambiguous.push(ref.trim());
      continue;
    }
    unknown.push(ref.trim());
  }
  return {
    refs: [...new Set(resolved)],
    unknown: [...new Set(unknown)],
    ambiguous: [...new Set(ambiguous)],
  };
};

export const normalizeStepComponentRefs = (
  refs: string[] | undefined,
  catalog: SequentialComponent[],
): string[] | undefined => {
  const componentCatalog = buildComponentReferenceCatalog(catalog);
  const resolved = resolveStepComponentRefs(refs, componentCatalog);
  if (resolved.unknown.length > 0 || resolved.ambiguous.length > 0) {
    return [
      ...resolved.refs,
      ...resolved.unknown,
      ...resolved.ambiguous,
    ];
  }
  return resolved.refs.length > 0 ? resolved.refs : refs && refs.length === 0 ? refs : resolved.refs;
};

export const applyResolvedComponentRefsToSteps = (
  steps: SequentialStep[],
  components: SequentialComponent[],
): { steps: SequentialStep[]; unknown: string[]; ambiguous: string[] } => {
  const catalog = buildComponentReferenceCatalog(components);
  const unknown = new Set<string>();
  const ambiguous = new Set<string>();
  const normalizedSteps = steps.map((step) => {
    const resolved = resolveStepComponentRefs(step.componentRefs, catalog);
    for (const ref of resolved.unknown) {
      unknown.add(ref);
    }
    for (const ref of resolved.ambiguous) {
      ambiguous.add(ref);
    }
    return {
      ...step,
      componentRefs:
        resolved.refs.length > 0
          ? resolved.refs
          : step.componentRefs && step.componentRefs.length === 0
            ? []
            : undefined,
    };
  });
  return {
    steps: normalizedSteps,
    unknown: [...unknown],
    ambiguous: [...ambiguous],
  };
};

const FORBIDDEN_PROSE_TERM_ALIASES: Record<string, RegExp[]> = {
  wood: [/خشب/i, /\bwood(?:en)?\b/i],
  leather: [/جلد/i, /\bleather\b/i],
  zipper: [/سحاب/i, /سوستة/i, /\bzipper\b/i],
  electronics: [/\belectronics?\b/i, /الكترون/i, /إلكترون/i],
};

export const filterComponentConsistencyFalsePositives = (
  issues: string[],
  components: SequentialComponent[],
  steps: SequentialStep[],
): string[] => {
  const stepText = steps.map((step) => `${step.title} ${step.description}`).join('\n');
  const catalogText = components
    .map((component) => `${component.componentName} ${component.notes ?? ''}`)
    .join('\n');
  return issues.filter((issue) => {
    if (issue === 'Duplicate component names are not allowed.') {
      const asciiStrippedNames = components.map((component) =>
        component.componentName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim(),
      );
      const emptyAsciiCollisions = asciiStrippedNames.filter((name) => name.length === 0).length;
      return emptyAsciiCollisions < 2;
    }
    const proseMatch = issue.match(/references "([^"]+)"/i);
    if (!proseMatch) {
      return true;
    }
    const term = proseMatch[1]?.trim().toLowerCase() ?? '';
    const patterns = FORBIDDEN_PROSE_TERM_ALIASES[term];
    if (!patterns) {
      return true;
    }
    const allowedByCatalog = patterns.some((pattern) => pattern.test(catalogText));
    if (!allowedByCatalog) {
      return true;
    }
    return !patterns.some((pattern) => pattern.test(stepText));
  });
};

const mapProviderSteps = (
  steps: z.infer<typeof stepPlanProviderResponseSchema>['steps'],
  catalog: SequentialComponent[],
): SequentialStep[] => {
  const mapped = reindexWorkingSteps(
    [...steps]
      .sort((left, right) => left.order - right.order)
      .map((step) => ({
        title: step.title,
        description: step.safetyNote
          ? `${step.description}\n\n${step.safetyNote}`
          : step.description,
        componentRefs: step.componentRefs,
      })),
  );
  const resolved = applyResolvedComponentRefsToSteps(mapped, catalog);
  if (resolved.unknown.length > 0 || resolved.ambiguous.length > 0) {
    const unknownComponents = [...resolved.unknown, ...resolved.ambiguous];
    throw new AppError(
      `Step plan references unknown components: ${unknownComponents.join(', ')}`,
      409,
      'AI_STEP_COMPONENT_INCONSISTENT',
      {
        unknownComponents,
        ambiguousComponents: resolved.ambiguous,
        issues: [
          ...resolved.unknown.map(
            (ref) => `Step plan references unknown component "${ref}".`,
          ),
          ...resolved.ambiguous.map(
            (ref) => `Step plan references ambiguous component "${ref}".`,
          ),
        ],
      },
    );
  }
  return resolved.steps;
};

export const buildAuthoringComponentListPrompt = (
  input: RealAuthoringComponentListInput,
) =>
  JSON.stringify({
    locale: input.locale,
    projectId: input.projectId,
    ideaText: input.ideaText,
    project: {
      title: input.projectTitle,
      shortDescription: input.projectShortDescription,
      description: input.projectDescription,
      difficulty: input.difficulty,
      durationMinutes: input.durationMinutes,
    },
    learnerConstraints: input.learnerConstraints,
    recentMessages: input.recentMessages,
    clarification: input.clarification,
    suggestAnother: input.suggestAnother ?? false,
    previousComponents: input.previousComponents?.map((component) => ({
      name: component.componentName,
      quantity: component.quantity,
      unit: component.unit,
      role: component.componentRole,
      required: component.isRequired,
      notes: component.notes,
    })),
    feedback: input.feedback ?? null,
    repairAttempt: input.repairAttempt,
    repairIssue: input.repairIssue ?? null,
    previousInvalidOutput: input.previousInvalidOutput ?? null,
    requiredOutputShape: {
      kind: 'COMPONENT_LIST',
      components: [
        {
          name: 'string',
          quantity: 1,
          unit: 'piece',
          role: 'MATERIAL | TOOL | CONSUMABLE',
          required: true,
          notes: 'string',
        },
      ],
      explanation: 'string',
    },
  });

export const buildAuthoringStepPlanPrompt = (input: RealAuthoringStepPlanInput) => {
  const componentReferenceCatalog = buildComponentReferenceCatalog(input.components);
  const qualityRequirements =
    input.qualityRequirements ??
    computeStepPlanQualityRequirements({
      locale: input.locale,
      ideaText: input.ideaText,
      projectTitle: input.projectTitle,
      projectShortDescription: input.projectShortDescription,
      projectDescription: input.projectDescription,
      difficulty: input.difficulty,
      estimatedMinutes: input.durationMinutes,
      components: input.components,
      recentAnswers: input.recentMessages,
      requestedStepCount: input.requestedStepCount ?? null,
    });
  const allowedComponentRefs = componentReferenceCatalog.flatMap((entry) => [
    entry.id,
    entry.canonicalName,
    ...entry.aliases,
  ]);
  const repairInstructions = input.repairAttempt
    ? {
        mustFix: input.repairIssue ?? 'Previous step plan was invalid.',
        previousInvalidOutput: input.previousInvalidOutput ?? null,
        doNotRepeat:
          'Do not repeat unknown componentRefs, invalid JSON structure, field names, language, shallow steps, or an insufficient step count. Return one complete schema-valid STEP_PLAN object using only saved catalog ids or exact catalog names/aliases.',
        language:
          input.locale === 'ar'
            ? 'Write Arabic titles and descriptions. Keep natural English technical terms where appropriate.'
            : 'Match the project language. Keep natural technical terms.',
      }
    : null;

  return JSON.stringify({
    locale: input.locale,
    projectId: input.projectId,
    ideaText: input.ideaText,
    project: {
      title: input.projectTitle,
      shortDescription: input.projectShortDescription,
      description: input.projectDescription,
      difficulty: input.difficulty,
      durationMinutes: input.durationMinutes,
    },
    learnerConstraints: input.learnerConstraints,
    recentMessages: input.recentMessages,
    canonicalComponents: input.components.map((component) => ({
      id: component.id ?? null,
      name: component.componentName,
      quantity: component.quantity,
      unit: component.unit,
      role: component.componentRole,
      required: component.isRequired,
      notes: component.notes,
    })),
    componentReferenceCatalog: componentReferenceCatalog.map((entry) => ({
      id: entry.id,
      canonicalName: entry.canonicalName,
      normalizedName: entry.normalizedName,
      role: entry.role,
      aliases: entry.aliases,
    })),
    allowedComponentRefs,
    stepPlanQualityRequirements: {
      projectType: qualityRequirements.projectType,
      structuralMinimum: qualityRequirements.structuralMinimum,
      minimumMeaningfulSteps: qualityRequirements.minimumMeaningfulSteps,
      expectedPhaseCount: qualityRequirements.expectedPhaseCount,
      preferredRange: {
        min: qualityRequirements.preferredRangeMin,
        max: qualityRequirements.preferredRangeMax,
      },
      safeMaximum: qualityRequirements.safeMaximum,
      requiredPhases: qualityRequirements.requiredPhases.map((phase) => ({
        key: phase.key,
        label:
          qualityRequirements.contentLanguage === 'ar' ? phase.labelAr : phase.labelEn,
      })),
      contentLanguage: qualityRequirements.contentLanguage,
      requiresArabicSteps: qualityRequirements.requiresArabicSteps,
      semanticDepthTarget: qualityRequirements.expectedPhaseCount,
      guidance: {
        minimumIsLowerBoundOnly: true,
        preferredRangeIsGuidanceNotMaximum: true,
        semanticDepthTargetIsGuidanceNotExactCount: true,
        doNotStopAtMinimum: true,
        doNotTargetExactlyMinimum: true,
        onePrimaryObjectivePerStep: true,
        expandOverloadedSteps: true,
        generateAsManyStepsAsNeeded: true,
        hardwareDepthHint:
          qualityRequirements.projectType === 'HARDWARE_ELECTRONICS'
            ? `Group related sub-actions only when they share one learning objective. For this hardware project, aim for about ${qualityRequirements.expectedPhaseCount} meaningfully grouped steps—not ${qualityRequirements.minimumMeaningfulSteps}.`
            : null,
      },
      detailContract:
        'Each step must include concrete action, project-specific component/object, implementation guidance, purpose or expected result, and verification guidance.',
    },
    clarification: input.clarification,
    suggestAnother: input.suggestAnother ?? false,
    previousSteps: input.previousSteps?.map((step, index) => ({
      order: index + 1,
      title: step.title,
      description: step.description,
      componentRefs: step.componentRefs ?? [],
    })),
    feedback: input.feedback ?? null,
    repairAttempt: input.repairAttempt,
    repairIssue: input.repairIssue ?? null,
    previousInvalidOutput: input.previousInvalidOutput ?? null,
    repairInstructions,
    requiredOutputShape: {
      kind: 'STEP_PLAN',
      steps: [
        {
          order: 1,
          title: 'string',
          description: 'string (what/how/why/verify; min ~48 chars)',
          safetyNote: null,
          componentRefs: ['allowed-catalog-id-or-exact-canonical-name-or-alias'],
        },
      ],
      explanation: 'string',
    },
  });
};

const clipInvalidOutput = (text: string) => text.slice(0, 8000);

const extractBalancedJsonObject = (text: string): string | null => {
  const start = text.indexOf('{');
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }
  return null;
};

/** Step-plan JSON parse: strip one fence, then balanced object. Rejects prose soup. */
export const parseStepPlanProviderJson = (text: string): unknown => {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AppError(
      'The step plan response was empty.',
      502,
      'AI_AUTHORING_STEP_JSON_INVALID',
      { previousInvalidOutput: '' },
    );
  }

  const wholeFence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  let candidate = (wholeFence?.[1] ?? trimmed).trim();
  if (!wholeFence) {
    const embeddedFence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (embeddedFence?.[1]) {
      candidate = embeddedFence[1].trim();
    }
  }

  const tryParse = (value: string) => {
    try {
      return { ok: true as const, value: JSON.parse(value) as unknown };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  };

  const direct = tryParse(candidate);
  if (direct.ok) {
    return direct.value;
  }

  const balanced = extractBalancedJsonObject(candidate);
  if (balanced) {
    const nested = tryParse(balanced);
    if (nested.ok) {
      return nested.value;
    }
  }

  throw new AppError(
    'The step plan response was not valid JSON.',
    502,
    'AI_AUTHORING_STEP_JSON_INVALID',
    {
      previousInvalidOutput: clipInvalidOutput(text),
      cause: direct.error,
    },
  );
};

const parseStructuredProviderJson = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const parse = (value: string): unknown | null => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  };

  const direct = parse(candidate);
  if (direct !== null) {
    return direct;
  }

  const balanced = extractBalancedJsonObject(candidate);
  if (balanced) {
    const extracted = parse(balanced);
    if (extracted !== null) {
      return extracted;
    }
  }

  throw new AppError(
    'The learning assistant returned an invalid response.',
    502,
    'AI_RESPONSE_INVALID',
    {
      responseFailure: 'JSON_PARSE',
      cause: 'Could not extract a valid JSON object from the provider response.',
    },
  );
};

const matchingStructuredSchemaBranch = (
  value: unknown,
  schema: Record<string, unknown>,
): Record<string, unknown> => {
  const alternatives = [schema.oneOf, schema.anyOf]
    .find(Array.isArray) as Record<string, unknown>[] | undefined;
  if (!alternatives || !value || typeof value !== 'object' || Array.isArray(value)) {
    return schema;
  }

  const payload = value as Record<string, unknown>;
  return alternatives.find((candidate) => {
    const properties = candidate.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
      return false;
    }
    return Object.entries(properties as Record<string, unknown>).every(([key, property]) => {
      if (!property || typeof property !== 'object' || Array.isArray(property)) {
        return true;
      }
      const expected = (property as Record<string, unknown>).const;
      return expected === undefined || payload[key] === expected;
    });
  }) ?? schema;
};

const normalizeStructuredOutputOptionalNulls = (
  value: unknown,
  sourceSchema: unknown,
): unknown => {
  if (!sourceSchema || typeof sourceSchema !== 'object' || Array.isArray(sourceSchema)) {
    return value;
  }

  const schema = matchingStructuredSchemaBranch(
    value,
    sourceSchema as Record<string, unknown>,
  );
  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeStructuredOutputOptionalNulls(item, schema.items),
    );
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const properties = schema.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return value;
  }

  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter((name): name is string => typeof name === 'string')
      : [],
  );
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item === null && !required.has(key)) {
      continue;
    }
    result[key] = normalizeStructuredOutputOptionalNulls(
      item,
      (properties as Record<string, unknown>)[key],
    );
  }
  return result;
};

const unwrapStructuredOutputEnvelope = (value: unknown): unknown =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.prototype.hasOwnProperty.call(value, 'result')
    ? (value as Record<string, unknown>).result
    : value;

const logComponentProviderValidationFailure = (input: {
  provider: RealProviderName;
  model: string | null;
  failure: 'JSON_PARSE' | 'SCHEMA_VALIDATION' | 'QUALITY_VALIDATION';
  issues?: Array<Record<string, unknown>>;
}) => {
  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    return;
  }

  logger.warn(
    {
      operation: 'component_generation',
      expectedAuthoringStage: 'COMPONENTS',
      provider: input.provider,
      model: input.model,
      responseFailure: input.failure,
      providerSchemaIssues: input.issues ?? [],
    },
    'AI authoring component response validation failed',
  );
};

export const generateRealAuthoringComponentList = async (
  input: RealAuthoringComponentListInput,
  provider: RealProviderName,
): Promise<
  RealAuthoringStructuredProviderResult<{
    components: SequentialComponent[];
    explanation: string;
  }>
> => {
  const startedAt = Date.now();
  const userPrompt = buildAuthoringComponentListPrompt(input);

  try {
    const response = await invokeRealComponentProvider(
      provider,
      PROJECT_AUTHORING_COMPONENT_LIST_SYSTEM_POLICY,
      userPrompt,
    );
    let rawProviderResponse: unknown;
    try {
      rawProviderResponse = normalizeStructuredOutputOptionalNulls(
        unwrapStructuredOutputEnvelope(parseStructuredProviderJson(response.text)),
        componentListProviderJsonSchema,
      );
    } catch (error) {
      logComponentProviderValidationFailure({
        provider,
        model: response.model,
        failure: 'JSON_PARSE',
      });
      throw error;
    }

    let parsed: z.infer<typeof componentListProviderResponseSchema>;
    try {
      parsed = componentListProviderResponseSchema.parse(rawProviderResponse);
    } catch (error) {
      if (error instanceof ZodError) {
        const providerSchemaIssues = getAuthoringProviderSchemaIssues(
          error,
          rawProviderResponse,
        );
        logComponentProviderValidationFailure({
          provider,
          model: response.model,
          failure: 'SCHEMA_VALIDATION',
          issues: providerSchemaIssues,
        });
        throw new AppError(
          'The learning assistant returned an invalid response.',
          502,
          'AI_RESPONSE_INVALID',
          { providerSchemaIssues },
        );
      }
      throw error;
    }
    const components = parsed.components.map(mapProviderComponent);
    try {
      assertParsedComponentListQuality(input, components);
    } catch (error) {
      logComponentProviderValidationFailure({
        provider,
        model: response.model,
        failure: 'QUALITY_VALIDATION',
      });
      throw error;
    }

    return {
      provider,
      model: response.model,
      data: {
        components,
        explanation: parsed.explanation,
      },
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
      latencyMs: response.latencyMs ?? Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw provider === 'openai'
      ? mapOpenAiFailure(error, getAiChatRuntimeConfig())
      : mapGeminiFailure(error);
  }
};
export const generateRealAuthoringStepPlan = async (
  input: RealAuthoringStepPlanInput,
  provider: RealProviderName,
): Promise<
  RealAuthoringStructuredProviderResult<{
    steps: SequentialStep[];
    explanation: string;
  }>
> => {
  const startedAt = Date.now();
  const userPrompt = buildAuthoringStepPlanPrompt(input);
  let rawText: string | null = null;

  try {
    const response = await invokeRealStepProvider(
      provider,
      PROJECT_AUTHORING_STEP_PLAN_SYSTEM_POLICY,
      userPrompt,
    );
    rawText = response.text;
    let rawJson: unknown;
    try {
      rawJson = parseStepPlanProviderJson(response.text);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'The step plan response was not valid JSON.',
        502,
        'AI_AUTHORING_STEP_JSON_INVALID',
        {
          previousInvalidOutput: clipInvalidOutput(response.text),
          cause: error instanceof Error ? error.message : String(error),
        },
      );
    }

    let parsed: z.infer<typeof stepPlanProviderResponseSchema>;
    try {
      parsed = stepPlanProviderResponseSchema.parse(rawJson);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(
          `The step plan JSON did not match the required schema: ${error.issues
            .map((issue) => issue.message)
            .slice(0, 6)
            .join('; ')}`,
          502,
          'AI_AUTHORING_STEP_SCHEMA_INVALID',
          {
            previousInvalidOutput: clipInvalidOutput(response.text),
            issues: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
            })),
          },
        );
      }
      throw error;
    }

    if (parsed.kind !== 'STEP_PLAN') {
      throw new AppError(
        'The step plan root kind must be STEP_PLAN.',
        502,
        'AI_AUTHORING_STEP_SCHEMA_INVALID',
        { previousInvalidOutput: clipInvalidOutput(response.text) },
      );
    }

    const steps = mapProviderSteps(parsed.steps, input.components);
    assertParsedStepPlanQuality(input, steps);

    return {
      provider,
      model: response.model,
      data: {
        steps,
        explanation: parsed.explanation,
      },
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
      latencyMs: response.latencyMs ?? Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'AI_PROVIDER_TIMEOUT') {
        throw new AppError(
          input.locale === 'ar'
            ? 'انتهت مهلة إنشاء خطة الخطوات. حاول مرة أخرى.'
            : 'Step plan generation timed out. Please try again.',
          504,
          'AI_AUTHORING_STEP_GENERATION_TIMEOUT',
        );
      }
      if (rawText) {
        const details =
          error.details && typeof error.details === 'object'
            ? (error.details as Record<string, unknown>)
            : {};
        if (
          details.previousInvalidOutput == null &&
          (error.code === 'AI_AUTHORING_STEP_QUALITY_INVALID' ||
            error.code === 'AI_AUTHORING_STEP_SCHEMA_INVALID' ||
            error.code === 'AI_AUTHORING_STEP_JSON_INVALID')
        ) {
          throw new AppError(error.message, error.statusCode, error.code, {
            ...details,
            previousInvalidOutput: clipInvalidOutput(rawText),
          });
        }
      }
      throw error;
    }
    if (error instanceof ZodError) {
      throw new AppError(
        'The step plan JSON did not match the required schema.',
        502,
        'AI_AUTHORING_STEP_SCHEMA_INVALID',
        {
          previousInvalidOutput: rawText ? clipInvalidOutput(rawText) : null,
          issues: error.issues,
        },
      );
    }
    throw provider === 'openai'
      ? mapOpenAiFailure(error, getAiChatRuntimeConfig())
      : mapGeminiFailure(error);
  }
};

const scalarStageSchema = z.enum([
  'TITLE',
  'SHORT_DESCRIPTION',
  'FULL_DESCRIPTION',
  'DIFFICULTY',
  'ESTIMATED_DURATION',
]);

const projectDifficultySchema = z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']);

const scalarRevisedProposalSchema = z.object({
  kind: z.literal('REVISED_PROPOSAL'),
  stage: scalarStageSchema,
  value: z.union([
    z.string().trim().min(1).max(8000),
    z.number().int().positive().max(10000),
  ]),
  explanation: z.string().trim().min(8).max(4000),
});

const scalarFollowUpSchema = z.object({
  kind: z.literal('FOLLOW_UP_QUESTION'),
  question: z.string().trim().min(8).max(1200),
  explanation: z.string().trim().max(4000).optional(),
});

const scalarProviderResponseSchema = z.discriminatedUnion('kind', [
  scalarRevisedProposalSchema,
  scalarFollowUpSchema,
]);

const scalarDifficultyProviderResponseSchema = z.discriminatedUnion('kind', [
  scalarRevisedProposalSchema.extend({
    stage: z.literal('DIFFICULTY'),
    value: projectDifficultySchema,
  }),
  scalarFollowUpSchema,
]);

const scalarProviderContractForStage = (
  stage: z.infer<typeof scalarStageSchema>,
) => {
  const schema = stage === 'DIFFICULTY'
    ? scalarDifficultyProviderResponseSchema
    : scalarProviderResponseSchema;

  return {
    schema,
    jsonSchema: z.toJSONSchema(schema),
  };
};

const logScalarProviderSchemaValidationFailure = (
  error: ZodError,
  provider: RealProviderName,
  scalarStage: z.infer<typeof scalarStageSchema>,
  response: unknown,
) => {
  if ((process.env.NODE_ENV ?? 'development') !== 'development') {
    return;
  }

  logger.debug(
    {
      operation: 'ai_authoring_scalar_provider_schema',
      provider,
      scalarStage,
      providerSchemaIssues: getAuthoringProviderSchemaIssues(error, response),
    },
    'AI authoring scalar provider schema validation failed',
  );
};

export type RealAuthoringScalarInput = {
  locale: AiLocale;
  projectId?: string | null;
  stage: SequentialStage;
  canonicalProject: {
    title: string;
    shortDescription: string;
    description: string | null;
    difficulty: string | null;
    estimatedMinutes: number | null;
  };
  currentProposal: { value: string | number };
  learnerFeedback: string;
  projectConstraints: string[];
  clarificationContext: string[];
  suggestAnother: boolean;
  repairAttempt: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
};

export type RealAuthoringScalarResult =
  | {
      kind: 'REVISED_PROPOSAL';
      stage: z.infer<typeof scalarStageSchema>;
      value: string | number;
      explanation: string;
    }
  | {
      kind: 'FOLLOW_UP_QUESTION';
      question: string;
      explanation?: string;
    };

export const PROJECT_AUTHORING_SCALAR_SYSTEM_POLICY = [
  'You are ImpactLoop project authoring scalar assistant.',
  'Generate one schema-valid scalar proposal for the requested authoring stage.',
  'Use only the trusted context supplied in the user message.',
  'Supported stages: TITLE, SHORT_DESCRIPTION, FULL_DESCRIPTION, DIFFICULTY, ESTIMATED_DURATION.',
  'TITLE must be a concise project title, not the raw learner idea or feedback.',
  'SHORT_DESCRIPTION must be a concise summary, not the learner request verbatim.',
  'FULL_DESCRIPTION must be a meaningful project description respecting learner constraints.',
  'DIFFICULTY must be exactly BEGINNER, INTERMEDIATE, or ADVANCED.',
  'ESTIMATED_DURATION value must be a positive integer number of minutes.',
  'Never translate machine-readable enum identifiers, even when the requested locale is Arabic.',
  'Localize only human-facing fields such as explanation and question.',
  'kind and stage must remain their canonical uppercase enum identifiers exactly.',
  'For DIFFICULTY, value must be exactly BEGINNER, INTERMEDIATE, or ADVANCED; never localize it.',
  'When repairing, preserve every already-valid machine-readable field exactly and correct only the reported issue.',
  'When learnerFeedback includes duration constraints (e.g. greater than 60 minutes), satisfy them.',
  'When suggestAnother is true, return a materially different value from currentProposal.',
  'Never copy learnerFeedback into value.',
  'Never return explanation text as value.',
  'Return strict JSON only.',
  'For REVISED_PROPOSAL include keys: kind, stage, value, explanation.',
  'For FOLLOW_UP_QUESTION include keys: kind, question; optional explanation.',
  'kind must be exactly REVISED_PROPOSAL or FOLLOW_UP_QUESTION.',
  'REVISED_PROPOSAL.stage must be TITLE, SHORT_DESCRIPTION, FULL_DESCRIPTION, DIFFICULTY, or ESTIMATED_DURATION exactly.',
  'REVISED_PROPOSAL.value must be a string or a positive integer; never quote numeric minutes.',
  'REVISED_PROPOSAL.explanation must be a non-empty string.',
  'FOLLOW_UP_QUESTION.question must be a non-empty string.',
  'Do not wrap JSON in markdown.',
].join('\n');

export const buildAuthoringScalarPrompt = (input: RealAuthoringScalarInput) =>
  JSON.stringify({
    projectId: input.projectId ?? null,
    stage: input.stage,
    locale: input.locale,
    canonicalProject: input.canonicalProject,
    currentProposal: input.currentProposal,
    learnerFeedback: input.learnerFeedback,
    projectConstraints: input.projectConstraints,
    clarificationContext: input.clarificationContext,
    suggestAnother: input.suggestAnother,
    repairAttempt: input.repairAttempt,
    repairIssue: input.repairIssue ?? null,
    previousInvalidOutput: input.previousInvalidOutput ?? null,
    requiredOutputShape: {
      kind: 'REVISED_PROPOSAL | FOLLOW_UP_QUESTION',
      stage: input.stage,
      value: input.stage === 'DIFFICULTY'
        ? 'BEGINNER | INTERMEDIATE | ADVANCED (canonical token; never localized)'
        : 'string or positive integer minutes',
      explanation: 'string',
      question: 'string when kind is FOLLOW_UP_QUESTION',
    },
  });

const normalizeScalarProviderValue = (
  stage: z.infer<typeof scalarStageSchema>,
  value: string | number,
): string | number => {
  if (stage === 'ESTIMATED_DURATION') {
    if (typeof value === 'number') {
      return value;
    }
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new AppError(
        'Estimated duration must be a positive number of minutes.',
        502,
        'AI_PROVIDER_RESPONSE_INVALID',
      );
    }
    return parsed;
  }

  if (stage === 'DIFFICULTY') {
    const normalized = `${value}`.trim().toUpperCase();
    const parsed = projectDifficultySchema.safeParse(normalized);
    if (!parsed.success) {
      throw new AppError(
        'Difficulty must be BEGINNER, INTERMEDIATE, or ADVANCED.',
        502,
        'AI_PROVIDER_RESPONSE_INVALID',
      );
    }
    return parsed.data;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(
      'Scalar proposal value cannot be empty.',
      502,
      'AI_PROVIDER_RESPONSE_INVALID',
    );
  }

  if (stage === 'TITLE' && value.trim().length > 200) {
    throw new AppError(
      'Title exceeds maximum length.',
      502,
      'AI_PROVIDER_RESPONSE_INVALID',
    );
  }

  return value.trim();
};

export const generateRealAuthoringScalarProposal = async (
  input: RealAuthoringScalarInput,
  provider: RealProviderName,
): Promise<RealAuthoringStructuredProviderResult<RealAuthoringScalarResult>> => {
  const startedAt = Date.now();
  const userPrompt = buildAuthoringScalarPrompt(input);
  const providerContract = scalarProviderContractForStage(input.stage);

  try {
    const response = await invokeRealScalarProvider(
      provider,
      PROJECT_AUTHORING_SCALAR_SYSTEM_POLICY,
      userPrompt,
      {
        structuredOutput: {
          name: 'impactloop_authoring_scalar_proposal',
          schema: providerContract.jsonSchema,
        },
        diagnosticStage: input.stage,
      },
    );
    let parsed: z.infer<typeof scalarProviderResponseSchema>;
    const rawProviderResponse = normalizeStructuredOutputOptionalNulls(
      unwrapStructuredOutputEnvelope(parseStructuredProviderJson(response.text)),
      providerContract.jsonSchema,
    );
    try {
      parsed = providerContract.schema.parse(rawProviderResponse);
    } catch (error) {
      if (error instanceof ZodError) {
        logScalarProviderSchemaValidationFailure(
          error,
          provider,
          input.stage,
          rawProviderResponse,
        );
        throw new AppError(
          'The learning assistant returned an invalid response.',
          502,
          'AI_RESPONSE_INVALID',
          { providerSchemaIssues: getAuthoringProviderSchemaIssues(error, rawProviderResponse) },
        );
      }
      throw error;
    }

    if (parsed.kind === 'FOLLOW_UP_QUESTION') {
      return {
        provider,
        model: response.model,
        data: {
          kind: 'FOLLOW_UP_QUESTION',
          question: parsed.question,
          explanation: parsed.explanation,
        },
        usage: {
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
        },
        latencyMs: response.latencyMs ?? Date.now() - startedAt,
      };
    }

    if (parsed.stage !== input.stage) {
      throw new AppError(
        'Scalar provider returned the wrong stage.',
        502,
        'AI_PROVIDER_RESPONSE_INVALID',
      );
    }

    const value = normalizeScalarProviderValue(parsed.stage, parsed.value);

    return {
      provider,
      model: response.model,
      data: {
        kind: 'REVISED_PROPOSAL',
        stage: parsed.stage,
        value,
        explanation: parsed.explanation,
      },
      usage: {
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
      },
      latencyMs: response.latencyMs ?? Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw provider === 'openai'
      ? mapOpenAiFailure(error, getAiChatRuntimeConfig())
      : mapGeminiFailure(error);
  }
};
