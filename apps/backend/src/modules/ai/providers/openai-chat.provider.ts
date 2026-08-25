import OpenAI from 'openai';
import { ZodError } from 'zod';

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

const ADMIN_PROJECT_REVIEW_MARKER = 'ADMIN_PROJECT_REVIEW_V1';

const GENERAL_LEARNING_ANSWER_STRUCTURED_OUTPUT = {
  name: 'impactloop_general_learning_answer',
  schema: {
    type: 'object',
    properties: {
      blocks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['text'] },
            text: { type: 'string' },
            purpose: {
              type: 'string',
              enum: ['answer', 'refusal', 'clarification', 'safety'],
            },
          },
          required: ['type', 'text', 'purpose'],
          additionalProperties: false,
        },
      },
    },
    required: ['blocks'],
    additionalProperties: false,
  },
} as const;

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
  imageInputs?: AiChatGenerateAnswerInput['imageInputs'];
  structuredOutput?: AiChatGenerateAnswerInput['structuredOutput'];
}) => {
  const messages: Array<Record<string, unknown>> = [];
  if (input.systemInstruction) {
    messages.push({ role: 'system', content: input.systemInstruction });
  }
  const imageInputs = input.imageInputs ?? [];
  messages.push({
    role: 'user',
    content:
      imageInputs.length > 0
        ? [
            { type: 'text', text: input.content },
            ...imageInputs.map((image) => ({
              type: 'image_url',
              image_url: {
                url: `data:${image.mimeType};base64,${image.dataBase64}`,
              },
            })),
          ]
        : input.content,
  });

  return {
    model: input.runtime.model,
    temperature: input.temperature,
    max_tokens: input.maxTokens,
    ...buildOpenAiResponseFormat(input.runtime, input.structuredOutput),
    messages,
  } as unknown as Parameters<
    OpenAiChatClient['chat']['completions']['create']
  >[0];
};

/**
 * The current OpenRouter deployment is deliberately allow-listed. A compatible
 * endpoint alone is not evidence that every model on it accepts vision input.
 */
export const supportsOpenAiCompatibleImageInputs = (
  runtime: AiChatRuntimeConfig,
): boolean =>
  (runtime.isOpenRouter && /^openai\/gpt-4\.1-nano(?:$|[-:])/i.test(runtime.model)) ||
  (!runtime.openaiBaseUrl && /^gpt-4\.1-nano(?:$|[-:])/i.test(runtime.model));

const supportsOpenAiCompatibleStrictStructuredOutput = (
  runtime: AiChatRuntimeConfig,
): boolean =>
  runtime.isOpenRouter && /^openai\/gpt-4\.1-nano(?:$|[-:])/i.test(runtime.model);

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
      // OpenAI-compatible structured outputs accept anyOf but not Zod's oneOf.
      key === 'oneOf' ? 'anyOf' : key,
      toOpenAiCompatibleStructuredSchema(value, false),
    ]),
  );
  const properties = record.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    if (isRoot && Array.isArray(normalized.anyOf)) {
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
    // OpenAI-compatible strict mode requires all declared properties.
    required: propertyNames,
  };
};

const buildOpenAiResponseFormat = (
  runtime: AiChatRuntimeConfig,
  structuredOutput?: AiChatGenerateAnswerInput['structuredOutput'],
) => {
  if (structuredOutput && supportsOpenAiCompatibleStrictStructuredOutput(runtime)) {
    return {
      response_format: {
        type: 'json_schema' as const,
        json_schema: {
          name: structuredOutput.name,
          strict: true,
          schema: toOpenAiCompatibleStructuredSchema(
            structuredOutput.schema,
          ) as Record<string, unknown>,
        },
      },
    };
  }

  return runtime.openaiJsonMode
    ? { response_format: { type: 'json_object' as const } }
    : {};
};

const mapOpenAiFailure = (
  error: unknown,
  runtime: AiChatRuntimeConfig,
): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return new AppError(
      'The learning assistant returned an invalid response.',
      502,
      'AI_RESPONSE_INVALID',
      {
        stage: error instanceof ZodError ? 'schema_validation' : 'json_extraction',
        model: runtime.model,
      },
    );
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

  if (status === 402) {
    return new AppError(
      'The learning assistant account does not have enough credits.',
      503,
      'AI_PROVIDER_QUOTA_EXCEEDED',
      { status, model: runtime.model },
    );
  }

  if (status === 400) {
    return new AppError(
      'The learning assistant request is not compatible with the configured model.',
      502,
      'AI_PROVIDER_REQUEST_INVALID',
      { status, model: runtime.model },
    );
  }

  if (status === 404) {
    return new AppError(
      'The configured learning assistant model is not available.',
      503,
      'AI_PROVIDER_MODEL_UNAVAILABLE',
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

  get supportsImageInputs(): boolean {
    return supportsOpenAiCompatibleImageInputs(getAiChatRuntimeConfig());
  }

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
    const isAdminReview = isAdminProjectReviewInput(input);
    const imageInputs = input.imageInputs ?? [];
    const structuredOutput =
      input.structuredOutput ??
      (isAdminReview ? undefined : GENERAL_LEARNING_ANSWER_STRUCTURED_OUTPUT);

    try {
      if (imageInputs.length > 0) {
        logger.info(
          {
            requestId: getRequestId(),
            provider: this.name,
            operation: isAdminReview
              ? 'admin_learning_project_ai_review'
              : 'general_learning_answer',
            model: runtime.model,
            baseUrlHost: runtime.openaiBaseHost ?? 'api.openai.com',
            imageInputCount: imageInputs.length,
          },
          'OpenAI-compatible multimodal request dispatched',
        );
      }

      const response = await withTimeout(
        client.chat.completions.create(
          buildChatCompletionRequest({
            runtime,
            temperature: 0.4,
            maxTokens: runtime.maxOutputTokens,
            // Admin review already contains its complete trusted/untrusted prompt.
            content: isAdminReview ? input.userMessage : buildAnswerPrompt(input),
            systemInstruction: composeGeneralLearningSystemInstruction(input),
            imageInputs,
            structuredOutput,
          }),
        ),
        runtime.timeoutMs,
        'AI_PROVIDER_TIMEOUT',
      );

      const parseAnswer = (candidate: OpenAiChatCompletion) => {
        const parsedResponse = extractJsonObject(readCompletionText(candidate));
        return aiProviderAnswerSchema.parse(
          isAdminReview
            ? normalizeAdminProjectReviewProviderAnswer(parsedResponse)
            : parsedResponse,
        );
      };

      let finalResponse = response;
      let parsed: ReturnType<typeof aiProviderAnswerSchema.parse>;

      try {
        parsed = parseAnswer(response);
      } catch (error) {
        if (
          isAdminReview ||
          !(error instanceof ZodError || error instanceof SyntaxError)
        ) {
          throw error;
        }

        logger.warn(
          {
            requestId: getRequestId(),
            provider: this.name,
            operation: 'general_learning_answer_repair',
            stage:
              error instanceof ZodError
                ? 'schema_validation'
                : 'json_extraction',
            model: runtime.model,
          },
          'OpenAI-compatible answer validation failed; retrying with strict schema',
        );

        finalResponse = await withTimeout(
          client.chat.completions.create(
            buildChatCompletionRequest({
              runtime,
              temperature: 0,
              maxTokens: runtime.maxOutputTokens,
              content: [
                buildAnswerPrompt(input),
                '',
                'Your previous response could not be parsed by the application.',
                'Return the answer again as strict JSON matching the required schema. Do not add markdown fences or commentary outside the JSON object.',
              ].join('\n'),
              systemInstruction: composeGeneralLearningSystemInstruction(input),
              imageInputs,
              structuredOutput: GENERAL_LEARNING_ANSWER_STRUCTURED_OUTPUT,
            }),
          ),
          runtime.timeoutMs,
          'AI_PROVIDER_TIMEOUT',
        );
        parsed = parseAnswer(finalResponse);
      }

      if (imageInputs.length > 0) {
        logger.info(
          {
            requestId: getRequestId(),
            provider: this.name,
            operation: isAdminReview
              ? 'admin_learning_project_ai_review'
              : 'general_learning_answer',
            status: 200,
            configuredModel: runtime.model,
            model: response.model ?? runtime.model,
            imageInputCount: imageInputs.length,
          },
          'OpenAI-compatible multimodal request succeeded',
        );
      }

      return {
        provider: this.name,
        model: finalResponse.model ?? runtime.model,
        data: parsed,
        usage: {
          inputTokens:
            (response.usage?.prompt_tokens ?? 0) +
              (finalResponse === response
                ? 0
                : (finalResponse.usage?.prompt_tokens ?? 0)) ||
            null,
          outputTokens:
            (response.usage?.completion_tokens ?? 0) +
              (finalResponse === response
                ? 0
                : (finalResponse.usage?.completion_tokens ?? 0)) ||
            null,
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
