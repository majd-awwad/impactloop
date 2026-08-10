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
import { resolveGeneralLearningSystemPolicy } from '../ai.policy.js';
import { extractJsonObject } from '../../../services/gemini-price-suggestion.provider.js';
import {
  buildAnswerUserPrompt,
  buildClassifierPrompt,
} from './chat-prompt-builders.js';
import { isExternalRetrievalSynthesisInput } from '../ai-external-knowledge.service.js';
import type {
  AiChatClassifyScopeInput,
  AiChatGenerateAnswerInput,
  AiChatProvider,
  AiChatProviderResult,
} from './ai-chat-provider.types.js';
import type { AiLocale } from '../ai.types.js';
import {
  parseSemanticPlannerResponseText,
  SEMANTIC_PLANNER_OPERATION,
  shouldRejectAsNonSemanticPayload,
} from './semantic-planner-response.js';

export {
  SEMANTIC_PLANNER_OPERATION,
  isLearnerAnswerBlocksPayload,
  isAdminReviewDirectPayload,
  shouldRejectAsNonSemanticPayload,
  parseSemanticPlannerResponseText,
} from './semantic-planner-response.js';

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
  status?: number | string;
  code?: string;
  reason?: string;
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

const isGeminiApiKeyAuthError = (error: unknown): boolean => {
  const parsed = parseGeminiApiError(error);
  const statusText = String(parsed.status ?? '').toUpperCase();
  const codeText = String(parsed.code ?? '').toUpperCase();
  const reason = String(parsed.reason ?? '').toUpperCase();
  const message = parsed.safeMessage.toLowerCase();

  return (
    reason.includes('API_KEY_INVALID') ||
    statusText === '401' ||
    codeText === 'UNAUTHENTICATED' ||
    message.includes('api key not valid') ||
    message.includes('api key invalid')
  );
};

/**
 * Project/API/key permission failures that are NOT tied to a specific model.
 * These must fail fast without trying fallback models.
 */
const isGeminiProjectOrApiPermissionError = (error: unknown): boolean => {
  if (isGeminiApiKeyAuthError(error)) {
    return true;
  }

  const parsed = parseGeminiApiError(error);
  const statusText = String(parsed.status ?? '').toUpperCase();
  const codeText = String(parsed.code ?? '').toUpperCase();
  const reason = String(parsed.reason ?? '').toUpperCase();
  const message = parsed.safeMessage.toLowerCase();

  const isPermissionStatus =
    statusText === '403' ||
    codeText === 'PERMISSION_DENIED' ||
    reason.includes('PERMISSION_DENIED') ||
    message.includes('permission denied');

  if (!isPermissionStatus) {
    return false;
  }

  return (
    message.includes('your project has been denied') ||
    message.includes('api has not been used') ||
    message.includes('api is not enabled') ||
    message.includes('has not been enabled') ||
    message.includes('service_disabled') ||
    message.includes('billing') ||
    message.includes('consumer_invalid') ||
    message.includes('api key restriction') ||
    message.includes('requests from this api key') ||
    reason.includes('SERVICE_DISABLED') ||
    reason.includes('CONSUMER_INVALID') ||
    reason.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
    // Generic 403/PERMISSION_DENIED with no identifiable model resource.
    (!/\bmodels?\/[a-z0-9._-]+/i.test(parsed.safeMessage) &&
      !/\bmodel[s]?\b.*\b(not found|unavailable|not supported|denied|no longer)/i.test(
        message,
      ))
  );
};

/**
 * True only when the failure is demonstrably about the requested model resource.
 */
const isGeminiModelSpecificAccessDenial = (error: unknown): boolean => {
  if (isGeminiProjectOrApiPermissionError(error) || isGeminiApiKeyAuthError(error)) {
    return false;
  }

  const parsed = parseGeminiApiError(error);
  const statusText = String(parsed.status ?? '').toUpperCase();
  const codeText = String(parsed.code ?? '').toUpperCase();
  const reason = String(parsed.reason ?? '').toUpperCase();
  const message = parsed.safeMessage.toLowerCase();
  const mentionsModelResource =
    /\bmodels?\/[a-z0-9._-]+/i.test(parsed.safeMessage) ||
    /\bmodels\/[a-z0-9._-]+/i.test(message);

  const isPermission =
    statusText === '403' ||
    codeText === 'PERMISSION_DENIED' ||
    reason.includes('PERMISSION_DENIED') ||
    message.includes('permission denied');

  if (!isPermission) {
    return false;
  }

  return (
    mentionsModelResource ||
    message.includes('permission denied on model') ||
    message.includes('denied access to model') ||
    (message.includes('model') &&
      (message.includes('not supported') ||
        message.includes('not available') ||
        message.includes('no longer available')))
  );
};

const isGeminiModelUnavailableError = (error: unknown): boolean => {
  if (
    isGeminiQuotaOrRateLimitError(error) ||
    isGeminiApiKeyAuthError(error) ||
    isGeminiProjectOrApiPermissionError(error)
  ) {
    return false;
  }

  if (isGeminiModelSpecificAccessDenial(error)) {
    return true;
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
    (message.includes('model') && message.includes('not found')) ||
    (message.includes('model') && message.includes('not supported'))
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
  let lastModel: string | undefined;

  for (const model of candidates) {
    lastModel = model;
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
        throw mapGeminiFailureToAppError(error, 'generation_request', model);
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

  throw mapGeminiFailureToAppError(
    lastError ?? new Error('No Gemini chat model candidates are available.'),
    'generation_request',
    lastModel ?? candidates[0],
  );
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
    status: parsed.status,
    code: parsed.code,
    reason: parsed.reason,
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
  const message = parsed.safeMessage.toLowerCase();

  if (isGeminiApiKeyAuthError(error) || isGeminiProjectOrApiPermissionError(error)) {
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
  const prompt =
    isAdminProjectReviewInput(input) || isExternalRetrievalSynthesisInput(input.userMessage)
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
      const { policy: systemInstruction } = resolveGeneralLearningSystemPolicy(
        input.userMessage,
      );

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
              systemInstruction,
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
