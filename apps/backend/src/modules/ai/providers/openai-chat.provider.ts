import OpenAI from 'openai';

import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/app-error.js';
import {
  aiProviderAnswerSchema,
  aiScopeClassifierSchema,
} from '../ai.content-blocks.js';
import { extractJsonObject } from '../../../services/gemini-price-suggestion.provider.js';
import type {
  AiChatClassifyScopeInput,
  AiChatGenerateAnswerInput,
  AiChatProvider,
  AiChatProviderResult,
} from './ai-chat-provider.types.js';
import {
  buildAnswerPrompt,
  buildClassifierPrompt,
} from './chat-prompt-builders.js';

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

const createDefaultClient = (): OpenAiChatClient => {
  if (!env.openaiApiKey) {
    throw new AppError(
      'The learning assistant is temporarily unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  return new OpenAI({
    apiKey: env.openaiApiKey,
    timeout: env.aiChatTimeoutMs,
  }) as unknown as OpenAiChatClient;
};

const readCompletionText = (
  response: OpenAiChatCompletion,
): string => {
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

export class OpenAiAiChatProvider implements AiChatProvider {
  readonly name = 'openai';

  private getClient(): OpenAiChatClient {
    return clientFactoryOverride?.() ?? createDefaultClient();
  }

  async classifyScope(
    input: AiChatClassifyScopeInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiScopeClassifierSchema.parse>>> {
    const startedAt = Date.now();
    const client = this.getClient();

    try {
      const response = await withTimeout(
        client.chat.completions.create({
          model: env.aiChatModel,
          temperature: 0,
          max_tokens: 256,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: buildClassifierPrompt(input),
            },
          ],
        }),
        env.aiChatTimeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      const parsed = aiScopeClassifierSchema.parse(
        extractJsonObject(readCompletionText(response)),
      );

      return {
        provider: this.name,
        model: response.model ?? env.aiChatModel,
        data: parsed,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? null,
          outputTokens: response.usage?.completion_tokens ?? null,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'The learning assistant is temporarily unavailable.',
        502,
        'AI_PROVIDER_ERROR',
      );
    }
  }

  async generateGeneralLearningAnswer(
    input: AiChatGenerateAnswerInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiProviderAnswerSchema.parse>>> {
    const startedAt = Date.now();
    const client = this.getClient();

    try {
      const response = await withTimeout(
        client.chat.completions.create({
          model: env.aiChatModel,
          temperature: 0.4,
          max_tokens: env.aiChatMaxOutputTokens,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'user',
              content: buildAnswerPrompt(input),
            },
          ],
        }),
        env.aiChatTimeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      const parsed = aiProviderAnswerSchema.parse(
        extractJsonObject(readCompletionText(response)),
      );

      return {
        provider: this.name,
        model: response.model ?? env.aiChatModel,
        data: parsed,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? null,
          outputTokens: response.usage?.completion_tokens ?? null,
        },
        latencyMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'The learning assistant is temporarily unavailable.',
        502,
        'AI_PROVIDER_ERROR',
      );
    }
  }
}
