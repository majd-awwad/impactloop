import { GoogleGenAI } from '@google/genai';
import { ZodError } from 'zod';

import {
  env,
  getConfiguredGeminiApiKey,
  getGeminiChatModelCandidates,
} from '../../../config/env.js';
import { getRequestId } from '../../../observability/request-context.js';
import { logger } from '../../../observability/logger.js';
import { AppError } from '../../../utils/app-error.js';
import {
  aiProviderAnswerSchema,
  aiScopeClassifierSchema,
} from '../ai.content-blocks.js';
import { GENERAL_LEARNING_SYSTEM_POLICY } from '../ai.policy.js';
import { extractJsonObject } from '../../../services/gemini-price-suggestion.provider.js';
import {
  buildAnswerUserPrompt,
  buildClassifierPrompt,
} from './chat-prompt-builders.js';
import type {
  AiChatClassifyScopeInput,
  AiChatGenerateAnswerInput,
  AiChatProvider,
  AiChatProviderResult,
} from './ai-chat-provider.types.js';
import type { AiLocale } from '../ai.types.js';

const ADMIN_PROJECT_REVIEW_MARKER = 'ADMIN_PROJECT_REVIEW_V1';

const isAdminProjectReviewInput = (input: AiChatGenerateAnswerInput): boolean =>
  input.userMessage.includes(ADMIN_PROJECT_REVIEW_MARKER);

const normalizeAdminProjectReviewProviderAnswer = (value: unknown): unknown => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  if ('blocks' in candidate) {
    return value;
  }

  if (
    typeof candidate.summary === 'string' &&
    typeof candidate.attentionLevel === 'string'
  ) {
    return {
      blocks: [
        {
          type: 'text',
          text: JSON.stringify(value),
          purpose: 'answer',
        },
      ],
    };
  }

  return value;
};

type GeminiGenerateContentResponse = {
  modelVersion?: string | null;
  text?: string | null;
  usageMetadata?: {
    promptTokenCount?: number | null;
    candidatesTokenCount?: number | null;
  } | null;
};

type GeminiChatClient = {
  models: {
    generateContent: (
      request: Parameters<GoogleGenAI['models']['generateContent']>[0],
    ) => Promise<GeminiGenerateContentResponse>;
  };
};

type GeminiFailureStage =
  | 'client_init'
  | 'classifier_request'
  | 'generation_request'
  | 'empty_response'
  | 'json_extraction'
  | 'schema_validation';

type GeminiQuotaDiagnostics = {
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string;
  retryDelay?: string;
  retryDelayMs?: number;
  model?: string;
};

type ParsedGeminiApiError = {
  name: string;
  safeMessage: string;
  status?: number | string;
  code?: string;
  reason?: string;
  quota?: GeminiQuotaDiagnostics;
};

export type GeminiProviderFailureDetails = {
  stage: GeminiFailureStage;
  model?: string;
  retryDelayMs?: number;
  quotaMetric?: string;
  quotaId?: string;
  quotaValue?: string;
};

let clientFactoryOverride: (() => GeminiChatClient) | null = null;

export const setGeminiChatClientFactoryForTests = (
  factory: (() => GeminiChatClient) | null,
) => {
  clientFactoryOverride = factory;
};

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

const readGeminiResponseText = (
  response: { text?: string | null },
  stage: GeminiFailureStage,
): string => {
  const text = response.text?.trim();
  if (!text) {
    throw new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
      { stage },
    );
  }

  return text;
};

const parseRetryDelayMs = (retryDelay?: string): number | undefined => {
  if (!retryDelay) {
    return undefined;
  }

  const match = retryDelay.trim().match(/^(\d+(?:\.\d+)?)s$/i);
  if (!match) {
    return undefined;
  }

  return Math.ceil(Number(match[1]) * 1000);
};

const readErrorDetails = (
  error: Error,
): Array<Record<string, unknown>> => {
  const directDetails = (error as { details?: unknown }).details;
  if (Array.isArray(directDetails)) {
    return directDetails.filter(
      (detail): detail is Record<string, unknown> =>
        typeof detail === 'object' && detail !== null,
    );
  }

  try {
    const parsed = JSON.parse(error.message) as {
      error?: { details?: Array<Record<string, unknown>> };
    };
    return parsed.error?.details ?? [];
  } catch {
    return [];
  }
};

const extractGeminiQuotaDiagnostics = (
  error: unknown,
  model?: string,
): GeminiQuotaDiagnostics | undefined => {
  if (!(error instanceof Error)) {
    return model ? { model } : undefined;
  }

  const diagnostics: GeminiQuotaDiagnostics = { model };

  for (const detail of readErrorDetails(error)) {
    const type = String(detail['@type'] ?? '');

    if (type.includes('QuotaFailure')) {
      const violations = detail.violations;
      if (Array.isArray(violations) && violations.length > 0) {
        const violation = violations[0] as Record<string, unknown>;
        diagnostics.quotaMetric =
          typeof violation.quotaMetric === 'string'
            ? violation.quotaMetric
            : undefined;
        diagnostics.quotaId =
          typeof violation.quotaId === 'string' ? violation.quotaId : undefined;
        diagnostics.quotaValue =
          violation.quotaValue !== undefined
            ? String(violation.quotaValue)
            : undefined;
      }
    }

    if (type.includes('RetryInfo')) {
      const retryDelay =
        typeof detail.retryDelay === 'string' ? detail.retryDelay : undefined;
      diagnostics.retryDelay = retryDelay;
      diagnostics.retryDelayMs = parseRetryDelayMs(retryDelay);
    }
  }

  return diagnostics;
};

const parseGeminiApiError = (error: unknown): ParsedGeminiApiError => {
  if (!(error instanceof Error)) {
    return {
      name: 'UnknownError',
      safeMessage: 'Unknown Gemini chat provider error',
    };
  }

  const base: ParsedGeminiApiError = {
    name: error.name,
    safeMessage: error.message.slice(0, 300),
    status:
      typeof (error as { status?: number | string }).status === 'number' ||
      typeof (error as { status?: number | string }).status === 'string'
        ? (error as { status?: number | string }).status
        : undefined,
    code:
      typeof (error as { code?: number | string }).code === 'number' ||
      typeof (error as { code?: number | string }).code === 'string'
        ? String((error as { code?: number | string }).code)
        : undefined,
    quota: extractGeminiQuotaDiagnostics(error),
  };

  try {
    const parsed = JSON.parse(error.message) as {
      error?: {
        code?: number | string;
        message?: string;
        status?: string;
        details?: Array<Record<string, unknown>>;
      };
    };

    const details = parsed.error?.details ?? [];
    const firstReason = details.find(
      (detail) => typeof detail.reason === 'string',
    );

    return {
      name: error.name,
      safeMessage: parsed.error?.message?.slice(0, 300) ?? base.safeMessage,
      status: parsed.error?.code ?? parsed.error?.status ?? base.status,
      code: parsed.error?.status ?? base.code,
      reason:
        typeof firstReason?.reason === 'string' ? firstReason.reason : undefined,
      quota: extractGeminiQuotaDiagnostics(error),
    };
  } catch {
    return base;
  }
};

const isGeminiModelUnavailableError = (error: unknown): boolean => {
  if (isGeminiQuotaOrRateLimitError(error)) {
    return false;
  }

  const parsed = parseGeminiApiError(error);
  const statusText = String(parsed.status ?? '').toUpperCase();
  const codeText = String(parsed.code ?? '').toUpperCase();
  const reason = String(parsed.reason ?? '').toUpperCase();
  const message = parsed.safeMessage.toLowerCase();

  return (
    statusText === '404' ||
    codeText === 'NOT_FOUND' ||
    reason.includes('MODEL_NOT_FOUND') ||
    message.includes('no longer available') ||
    (message.includes('model') && message.includes('not found'))
  );
};

const isGeminiQuotaOrRateLimitError = (error: unknown): boolean => {
  const parsed = parseGeminiApiError(error);
  const statusText = String(parsed.status ?? '').toUpperCase();
  const codeText = String(parsed.code ?? '').toUpperCase();
  const reason = String(parsed.reason ?? '').toUpperCase();
  const message = parsed.safeMessage.toLowerCase();

  return (
    statusText === '429' ||
    codeText === 'RESOURCE_EXHAUSTED' ||
    reason.includes('RATE_LIMIT') ||
    reason.includes('QUOTA') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted') ||
    message.includes('exceeded your current quota')
  );
};

const generateContentWithModelFallback = async <
  T extends GeminiGenerateContentResponse,
>(
  ai: GeminiChatClient,
  operation: string,
  buildRequest: (
    model: string,
  ) => Parameters<GeminiChatClient['models']['generateContent']>[0],
): Promise<{ response: T; model: string }> => {
  const candidates = getGeminiChatModelCandidates();
  let lastError: unknown;

  for (const model of candidates) {
    try {
      const response = (await ai.models.generateContent(
        buildRequest(model),
      )) as unknown as T;

      if (model !== candidates[0]) {
        logger.info(
          {
            requestId: getRequestId(),
            provider: 'gemini',
            operation,
            requestedModel: candidates[0],
            resolvedModel: model,
          },
          'Gemini chat model fallback succeeded',
        );
      }

      return { response, model };
    } catch (error) {
      lastError = error;

      if (isGeminiQuotaOrRateLimitError(error)) {
        logger.warn(
          {
            requestId: getRequestId(),
            provider: 'gemini',
            operation,
            model,
            safeMessage: parseGeminiApiError(error).safeMessage,
          },
          'Gemini chat model quota or rate limit reached, trying fallback model',
        );
        continue;
      }

      if (!isGeminiModelUnavailableError(error)) {
        throw error;
      }

      logger.warn(
        {
          requestId: getRequestId(),
          provider: 'gemini',
          operation,
          model,
          safeMessage: parseGeminiApiError(error).safeMessage,
        },
        'Gemini chat model unavailable, trying fallback',
      );
    }
  }

  throw lastError ?? new Error('No Gemini chat model candidates are available.');
};

const buildProviderFailureDetails = (
  error: unknown,
  stage: GeminiFailureStage,
  model?: string,
): GeminiProviderFailureDetails => {
  const parsed = parseGeminiApiError(error);
  return {
    stage,
    model: model ?? parsed.quota?.model,
    retryDelayMs: parsed.quota?.retryDelayMs,
    quotaMetric: parsed.quota?.quotaMetric,
    quotaId: parsed.quota?.quotaId,
    quotaValue: parsed.quota?.quotaValue,
  };
};

const mapGeminiFailureToAppError = (
  error: unknown,
  stage: GeminiFailureStage,
  model?: string,
): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
      buildProviderFailureDetails(error, stage, model),
    );
  }

  if (error instanceof SyntaxError) {
    return new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
      buildProviderFailureDetails(error, 'json_extraction', model),
    );
  }

  const parsed = parseGeminiApiError(error);
  const failureDetails = buildProviderFailureDetails(error, stage, model);
  const statusText = String(parsed.status ?? '').toUpperCase();
  const codeText = String(parsed.code ?? '').toUpperCase();
  const reason = String(parsed.reason ?? '').toUpperCase();
  const message = parsed.safeMessage.toLowerCase();

  if (
    reason.includes('API_KEY_INVALID') ||
    message.includes('api key not valid') ||
    statusText === '401' ||
    statusText === '403' ||
    message.includes('permission denied')
  ) {
    return new AppError(
      'The learning assistant is not configured correctly.',
      503,
      'AI_PROVIDER_AUTH_ERROR',
      failureDetails,
    );
  }

  if (isGeminiQuotaOrRateLimitError(error)) {
    return new AppError(
      'The learning assistant is temporarily busy. Please try again shortly.',
      503,
      'AI_PROVIDER_QUOTA_EXCEEDED',
      failureDetails,
    );
  }

  if (isGeminiModelUnavailableError(error)) {
    return new AppError(
      'The learning assistant model is unavailable right now.',
      503,
      'AI_PROVIDER_MODEL_UNAVAILABLE',
      failureDetails,
    );
  }

  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnreset') ||
    message.includes('enotfound')
  ) {
    return new AppError(
      'Could not reach the learning assistant provider.',
      503,
      'AI_PROVIDER_ERROR',
      failureDetails,
    );
  }

  return new AppError(
    'The learning assistant is temporarily unavailable.',
    502,
    'AI_PROVIDER_ERROR',
    failureDetails,
  );
};

const logGeminiFailure = (
  error: unknown,
  operation: string,
  stage: GeminiFailureStage,
  model?: string,
): void => {
  const parsed =
    error instanceof AppError
      ? {
          name: 'AppError',
          safeMessage: error.message,
          status: error.statusCode,
          code: error.code,
          reason: undefined,
          quota: undefined,
        }
      : parseGeminiApiError(error);

  const failureDetails =
    error instanceof AppError &&
    typeof error.details === 'object' &&
    error.details !== null
      ? (error.details as GeminiProviderFailureDetails)
      : buildProviderFailureDetails(error, stage, model);

  logger.warn(
    {
      requestId: getRequestId(),
      provider: 'gemini',
      operation,
      stage,
      model: failureDetails.model ?? model ?? getGeminiChatModelCandidates()[0],
      errorName: parsed.name,
      status: parsed.status,
      code: parsed.code,
      reason: parsed.reason,
      safeMessage: parsed.safeMessage,
      quotaMetric: failureDetails.quotaMetric ?? parsed.quota?.quotaMetric,
      quotaId: failureDetails.quotaId ?? parsed.quota?.quotaId,
      quotaValue: failureDetails.quotaValue ?? parsed.quota?.quotaValue,
      retryDelay: parsed.quota?.retryDelay,
      retryDelayMs: failureDetails.retryDelayMs ?? parsed.quota?.retryDelayMs,
    },
    'Gemini chat provider request failed',
  );
};

const toProviderError = (
  error: unknown,
  operation: string,
  stage: GeminiFailureStage,
  model?: string,
): AppError => {
  const mapped = mapGeminiFailureToAppError(error, stage, model);
  if (!(error instanceof AppError)) {
    logGeminiFailure(error, operation, stage, model);
  }
  return mapped;
};

export const buildGeminiAnswerContents = (
  input: AiChatGenerateAnswerInput,
): string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> => {
  const prompt = isAdminProjectReviewInput(input)
    ? input.userMessage
    : buildAnswerUserPrompt(input);
  const imageInputs = input.imageInputs ?? [];
  if (imageInputs.length === 0) {
    return prompt;
  }

  return [
    { text: prompt },
    ...imageInputs.map((image) => ({
      inlineData: {
        mimeType: image.mimeType,
        data: image.dataBase64,
      },
    })),
  ];
};

/** Marks semantic-planner JSON requests; must not share learner answer-block parsing. */
export const SEMANTIC_PLANNER_OPERATION = 'classifySemanticUnderstanding';

export const isLearnerAnswerBlocksPayload = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return Array.isArray(candidate.blocks);
};

export const isAdminReviewDirectPayload = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.summary === 'string' &&
    typeof candidate.attentionLevel === 'string' &&
    !('route' in candidate)
  );
};

export const shouldRejectAsNonSemanticPayload = (value: unknown): boolean =>
  isLearnerAnswerBlocksPayload(value) || isAdminReviewDirectPayload(value);

/**
 * Semantic planner JSON extraction: direct object text or bounded fenced JSON only.
 * Rejects prose wrappers that are not safely fenced.
 */
export const parseSemanticPlannerResponseText = (content: string): unknown => {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new SyntaxError('Semantic planner response was empty.');
  }

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }

  throw new SyntaxError(
    'Semantic planner response was not a direct JSON object or fenced JSON block.',
  );
};

export class GeminiAiChatProvider implements AiChatProvider {
  readonly name = 'gemini';

  private getClient(): GeminiChatClient {
    const geminiApiKey = getConfiguredGeminiApiKey();
    if (!geminiApiKey) {
      throw new AppError(
        'The learning assistant is temporarily unavailable.',
        503,
        'AI_DISABLED',
      );
    }

    try {
      return (
        clientFactoryOverride?.() ?? new GoogleGenAI({ apiKey: geminiApiKey })
      );
    } catch (error) {
      throw toProviderError(error, 'client_init', 'client_init');
    }
  }

  async classifyScope(
    input: AiChatClassifyScopeInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiScopeClassifierSchema.parse>>> {
    const startedAt = Date.now();
    const ai = this.getClient();

    try {
      const { response, model } = await withTimeout(
        generateContentWithModelFallback(ai, 'classifyScope', (modelName) => ({
          model: modelName,
          contents: buildClassifierPrompt(input),
          config: {
            temperature: 0,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
            systemInstruction:
              'You classify learner messages for ImpactLoop. Respond with valid JSON only.',
          },
        })),
        env.aiChatTimeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      const parsed = aiScopeClassifierSchema.parse(
        extractJsonObject(
          readGeminiResponseText(response, 'classifier_request'),
        ),
      );

      return {
        provider: this.name,
        model: response.modelVersion ?? model,
        data: parsed,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? null,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        logGeminiFailure(error, 'classifyScope', 'schema_validation');
        throw mapGeminiFailureToAppError(error, 'schema_validation');
      }

      if (error instanceof SyntaxError) {
        logGeminiFailure(error, 'classifyScope', 'json_extraction');
        throw mapGeminiFailureToAppError(error, 'json_extraction');
      }

      throw toProviderError(error, 'classifyScope', 'classifier_request');
    }
  }

  async generateGeneralLearningAnswer(
    input: AiChatGenerateAnswerInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiProviderAnswerSchema.parse>>> {
    const startedAt = Date.now();
    const ai = this.getClient();

    try {
      const { response, model } = await withTimeout(
        generateContentWithModelFallback(
          ai,
          'generateGeneralLearningAnswer',
          (modelName) => ({
            model: modelName,
            contents: buildGeminiAnswerContents(input),
            config: {
              temperature: 0.4,
              maxOutputTokens: env.aiChatMaxOutputTokens,
              responseMimeType: 'application/json',
              systemInstruction: GENERAL_LEARNING_SYSTEM_POLICY,
            },
          }),
        ),
        env.aiChatTimeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      const responseText = readGeminiResponseText(response, 'generation_request');
      const extracted = extractJsonObject(responseText);
      const normalized = isAdminProjectReviewInput(input)
        ? normalizeAdminProjectReviewProviderAnswer(extracted)
        : extracted;

      const parsed = aiProviderAnswerSchema.parse(normalized);

      return {
        provider: this.name,
        model: response.modelVersion ?? model,
        data: parsed,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? null,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        logGeminiFailure(error, 'generateGeneralLearningAnswer', 'schema_validation');
        throw mapGeminiFailureToAppError(error, 'schema_validation');
      }

      if (error instanceof SyntaxError) {
        logGeminiFailure(error, 'generateGeneralLearningAnswer', 'json_extraction');
        throw mapGeminiFailureToAppError(error, 'json_extraction');
      }

      throw toProviderError(
        error,
        'generateGeneralLearningAnswer',
        'generation_request',
      );
    }
  }

  async classifySemanticUnderstanding(input: {
    prompt: string;
    locale: AiLocale;
  }): Promise<AiChatProviderResult<unknown>> {
    const startedAt = Date.now();
    const ai = this.getClient();

    try {
      const { response, model } = await withTimeout(
        generateContentWithModelFallback(ai, SEMANTIC_PLANNER_OPERATION, (modelName) => ({
          model: modelName,
          contents: input.prompt,
          config: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
            systemInstruction:
              'You are a strict semantic classifier for ImpactLoop learner chat. Return one JSON object only matching the requested semantic understanding schema. Never return answer blocks or prose.',
          },
        })),
        env.aiChatTimeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      const responseText = readGeminiResponseText(response, 'generation_request');
      const extracted = parseSemanticPlannerResponseText(responseText);
      if (shouldRejectAsNonSemanticPayload(extracted)) {
        throw new SyntaxError('Semantic planner response used a non-semantic payload shape.');
      }

      return {
        provider: this.name,
        model: response.modelVersion ?? model,
        data: extracted,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? null,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        logGeminiFailure(error, SEMANTIC_PLANNER_OPERATION, 'json_extraction');
        throw mapGeminiFailureToAppError(error, 'json_extraction');
      }

      throw toProviderError(error, SEMANTIC_PLANNER_OPERATION, 'generation_request');
    }
  }
}
