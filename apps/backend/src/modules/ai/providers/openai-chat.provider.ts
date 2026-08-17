import OpenAI from 'openai';

import {
  env,
  getAiChatRuntimeConfig,
  type AiChatRuntimeConfig,
} from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';
import { getRequestId } from '../../../observability/request-context.js';
import { AppError } from '../../../utils/app-error.js';
import {
  aiProviderAnswerSchema,
  aiScopeClassifierSchema,
} from '../ai.content-blocks.js';
import { extractJsonObject } from '../../../services/gemini-price-suggestion.provider.js';
import type { AiLocale } from '../ai.types.js';
import type {
  AiChatClassifyScopeInput,
  AiChatGenerateAnswerInput,
  AiChatProvider,
  AiChatProviderResult,
} from './ai-chat-provider.types.js';
import {
  buildAnswerPrompt,
  buildClassifierPrompt,
  composeGeneralLearningSystemInstruction,
} from './chat-prompt-builders.js';
import {
  parseSemanticPlannerResponseText,
  SEMANTIC_PLANNER_OPERATION,
  shouldRejectAsNonSemanticPayload,
} from './semantic-planner-response.js';

type OpenAiChatCompletion = {
  model?: string | null;
  choices: Array<{ message: { content: string | null } }>;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  } | null;
};

export type OpenAiChatClient = {
  chat: {
    completions: {
      create: (
        ...args: Parameters<OpenAI['chat']['completions']['create']>
      ) => Promise<OpenAiChatCompletion>;
    };
  };
};

let clientFactoryOverride: (() => OpenAiChatClient) | null = null;

export const setOpenAiChatClientFactoryForTests = (
  factory: (() => OpenAiChatClient) | null,
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
              code,
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

const createDefaultClient = (runtime: AiChatRuntimeConfig): OpenAiChatClient => {
  if (!runtime.openaiApiKey) {
    throw new AppError(
      'The learning assistant is temporarily unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  return new OpenAI({
    apiKey: runtime.openaiApiKey,
    baseURL: runtime.openaiBaseUrl ?? undefined,
    timeout: runtime.timeoutMs,
    defaultHeaders: runtime.isOpenRouter
      ? {
          'HTTP-Referer': env.appPublicBaseUrl || 'http://localhost:4000',
          'X-Title': 'ImpactLoop',
        }
      : undefined,
  }) as unknown as OpenAiChatClient;
};

const readCompletionText = (response: OpenAiChatCompletion): string => {
  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }

  return text;
};

const buildChatCompletionRequest = (input: {
  runtime: AiChatRuntimeConfig;
  temperature: number;
  maxTokens: number;
  content: string;
  systemInstruction?: string;
}) => {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (input.systemInstruction) {
    messages.push({ role: 'system', content: input.systemInstruction });
  }
  messages.push({ role: 'user', content: input.content });

  return {
    model: input.runtime.model,
    temperature: input.temperature,
    max_tokens: input.maxTokens,
    ...(input.runtime.openaiJsonMode
      ? { response_format: { type: 'json_object' as const } }
      : {}),
    messages,
  };
};

const mapOpenAiFailure = (
  error: unknown,
  runtime: AiChatRuntimeConfig,
): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  const status =
    typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : undefined;
  const message =
    error instanceof Error ? error.message.slice(0, 300) : 'Unknown OpenAI error';

  logger.warn(
    {
      requestId: getRequestId(),
      provider: 'openai',
      status,
      safeMessage: message,
      model: runtime.model,
      baseUrlHost: runtime.openaiBaseHost ?? 'api.openai.com',
    },
    'OpenAI-compatible chat provider request failed',
  );

  if (status === 401 || status === 403) {
    return new AppError(
      'The learning assistant is not configured correctly.',
      503,
      'AI_PROVIDER_AUTH_ERROR',
      { status, model: runtime.model },
    );
  }

  if (status === 429) {
    return new AppError(
      'The learning assistant is temporarily busy. Please try again shortly.',
      503,
      'AI_PROVIDER_QUOTA_EXCEEDED',
      { status, model: runtime.model },
    );
  }

  return new AppError(
    'The learning assistant is temporarily unavailable.',
    502,
    'AI_PROVIDER_ERROR',
    { status, model: runtime.model },
  );
};

export class OpenAiAiChatProvider implements AiChatProvider {
  readonly name = 'openai';

  private getClient(runtime: AiChatRuntimeConfig): OpenAiChatClient {
    return clientFactoryOverride?.() ?? createDefaultClient(runtime);
  }

  async classifyScope(
    input: AiChatClassifyScopeInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiScopeClassifierSchema.parse>>> {
    const startedAt = Date.now();
    const runtime = getAiChatRuntimeConfig();
    const client = this.getClient(runtime);

    try {
      const response = await withTimeout(
        client.chat.completions.create(
          buildChatCompletionRequest({
            runtime,
            temperature: 0,
            maxTokens: 256,
            content: buildClassifierPrompt(input),
            systemInstruction:
              'You classify learner messages for ImpactLoop. Respond with valid JSON only.',
          }),
        ),
        runtime.timeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      const parsed = aiScopeClassifierSchema.parse(
        extractJsonObject(readCompletionText(response)),
      );

      return {
        provider: this.name,
        model: response.model ?? runtime.model,
        data: parsed,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? null,
          outputTokens: response.usage?.completion_tokens ?? null,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw mapOpenAiFailure(error, runtime);
    }
  }

  async generateGeneralLearningAnswer(
    input: AiChatGenerateAnswerInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiProviderAnswerSchema.parse>>> {
    const startedAt = Date.now();
    const runtime = getAiChatRuntimeConfig();
    const client = this.getClient(runtime);

    try {
      const response = await withTimeout(
        client.chat.completions.create(
          buildChatCompletionRequest({
            runtime,
            temperature: 0.4,
            maxTokens: runtime.maxOutputTokens,
            content: buildAnswerPrompt(input),
            systemInstruction: composeGeneralLearningSystemInstruction(input),
          }),
        ),
        runtime.timeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      const parsed = aiProviderAnswerSchema.parse(
        extractJsonObject(readCompletionText(response)),
      );

      return {
        provider: this.name,
        model: response.model ?? runtime.model,
        data: parsed,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? null,
          outputTokens: response.usage?.completion_tokens ?? null,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      throw mapOpenAiFailure(error, runtime);
    }
  }

  async classifySemanticUnderstanding(input: {
    prompt: string;
    locale: AiLocale;
  }): Promise<AiChatProviderResult<unknown>> {
    const startedAt = Date.now();
    const runtime = getAiChatRuntimeConfig();
    const client = this.getClient(runtime);

    try {
      const response = await withTimeout(
        client.chat.completions.create(
          buildChatCompletionRequest({
            runtime,
            temperature: 0.1,
            maxTokens: 1024,
            content: input.prompt,
            systemInstruction:
              input.locale === 'ar'
                ? 'You are a strict semantic classifier for ImpactLoop learner chat. Reply with one JSON object only. Match Arabic learner intent carefully. Requests like "اشرحلي عن آخر مشروع" are PROJECT_DETAILS with referenceType RECENT_RESULT, not GENERAL_LEARNING and not OUT_OF_SCOPE.'
                : 'You are a strict semantic classifier for ImpactLoop learner chat. Return one JSON object only matching the requested semantic understanding schema. Never return answer blocks or prose.',
          }),
        ),
        runtime.timeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      const responseText = readCompletionText(response);
      const extracted = parseSemanticPlannerResponseText(responseText);
      if (shouldRejectAsNonSemanticPayload(extracted)) {
        throw new SyntaxError(
          'Semantic planner response used a non-semantic payload shape.',
        );
      }

      return {
        provider: this.name,
        model: response.model ?? runtime.model,
        data: extracted,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? null,
          outputTokens: response.usage?.completion_tokens ?? null,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.warn(
          {
            requestId: getRequestId(),
            provider: 'openai',
            operation: SEMANTIC_PLANNER_OPERATION,
            model: runtime.model,
            safeMessage: error.message.slice(0, 180),
          },
          'OpenAI-compatible semantic planner JSON extraction failed',
        );
        throw new AppError(
          'The learning assistant returned an invalid response.',
          502,
          'AI_RESPONSE_INVALID',
          { stage: 'json_extraction', model: runtime.model },
        );
      }

      throw mapOpenAiFailure(error, runtime);
    }
  }
}
