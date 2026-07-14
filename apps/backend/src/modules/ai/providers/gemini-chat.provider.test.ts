import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { AppError } from '../../../utils/app-error.js';
import {
  GeminiAiChatProvider,
  setGeminiChatClientFactoryForTests,
} from './gemini-chat.provider.js';

describe('GeminiAiChatProvider error mapping', () => {
  afterEach(() => {
    setGeminiChatClientFactoryForTests(null);
  });

  test('maps invalid API key errors to AI_PROVIDER_AUTH_ERROR', async () => {
    setGeminiChatClientFactoryForTests(() => ({
      models: {
        generateContent: async () => {
          throw new Error(
            JSON.stringify({
              error: {
                code: 400,
                message: 'API key not valid. Please pass a valid API key.',
                status: 'INVALID_ARGUMENT',
                details: [{ reason: 'API_KEY_INVALID' }],
              },
            }),
          );
        },
      },
    }));

    const provider = new GeminiAiChatProvider();

    await assert.rejects(
      () =>
        provider.generateGeneralLearningAnswer({
          locale: 'ar',
          userMessage: 'اشرحلي Arduino Uno بطريقة بسيطة',
          history: [],
          scopeClassification: 'DOMAIN_KNOWLEDGE',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_PROVIDER_AUTH_ERROR');
        return true;
      },
    );
  });

  test('maps schema validation failures to AI_RESPONSE_INVALID', async () => {
    setGeminiChatClientFactoryForTests(() => ({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({ blocks: [] }),
          modelVersion: 'gemini-2.5-flash',
        }),
      },
    }));

    const provider = new GeminiAiChatProvider();

    await assert.rejects(
      () =>
        provider.generateGeneralLearningAnswer({
          locale: 'en',
          userMessage: 'Explain Arduino Uno',
          history: [],
          scopeClassification: 'DOMAIN_KNOWLEDGE',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        return true;
      },
    );
  });

  test('does not map INVALID_ARGUMENT JSON mode errors to model unavailable', async () => {
    setGeminiChatClientFactoryForTests(() => ({
      models: {
        generateContent: async () => {
          throw new Error(
            JSON.stringify({
              error: {
                code: 400,
                message:
                  'Invalid JSON payload received. Unknown name "responseSchema" at model: failed to parse request.',
                status: 'INVALID_ARGUMENT',
                details: [{ reason: 'INVALID_JSON_PAYLOAD' }],
              },
            }),
          );
        },
      },
    }));

    const provider = new GeminiAiChatProvider();

    await assert.rejects(
      () =>
        provider.generateGeneralLearningAnswer({
          locale: 'en',
          userMessage: 'Explain Arduino Uno simply',
          history: [],
          scopeClassification: 'DOMAIN_KNOWLEDGE',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.notEqual(error.code, 'AI_PROVIDER_MODEL_UNAVAILABLE');
        assert.equal(error.code, 'AI_PROVIDER_ERROR');
        return true;
      },
    );
  });
});

describe('GeminiAiChatProvider model fallback', () => {
  afterEach(() => {
    setGeminiChatClientFactoryForTests(null);
    delete process.env.AI_CHAT_MODEL;
  });

  test('falls back when the primary chat model is unavailable', async () => {
    const attemptedModels: string[] = [];

    setGeminiChatClientFactoryForTests(() => ({
      models: {
        generateContent: async (request: { model?: string }) => {
          const model = request.model ?? 'unknown';
          attemptedModels.push(model);

          if (model === 'gemini-2.5-flash') {
            throw new Error(
              JSON.stringify({
                error: {
                  code: 404,
                  message:
                    'This model models/gemini-2.5-flash is no longer available to new users.',
                  status: 'NOT_FOUND',
                },
              }),
            );
          }

          return {
            text: JSON.stringify({
              blocks: [
                {
                  type: 'text',
                  text: 'Arduino Uno is a beginner microcontroller board.',
                  purpose: 'answer',
                },
              ],
            }),
            modelVersion: model,
            usageMetadata: {
              promptTokenCount: 42,
              candidatesTokenCount: 18,
            },
          };
        },
      },
    }));

    process.env.AI_CHAT_MODEL = 'gemini-2.5-flash';

    const provider = new GeminiAiChatProvider();
    const result = await provider.generateGeneralLearningAnswer({
      locale: 'en',
      userMessage: 'Explain Arduino Uno simply',
      history: [],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    });

    assert.deepEqual(attemptedModels.slice(0, 2), [
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ]);
    assert.equal(result.model, 'gemini-2.5-flash-lite');
  });

  test('does not fall back to another model on RESOURCE_EXHAUSTED', async () => {
    const attemptedModels: string[] = [];

    setGeminiChatClientFactoryForTests(() => ({
      models: {
        generateContent: async (request: { model?: string }) => {
          attemptedModels.push(request.model ?? 'unknown');
          throw new Error(
            JSON.stringify({
              error: {
                code: 429,
                message: 'You exceeded your current quota, please check your plan and billing details.',
                status: 'RESOURCE_EXHAUSTED',
                details: [
                  {
                    '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
                    violations: [
                      {
                        quotaMetric:
                          'generativelanguage.googleapis.com/generate_content_free_tier_requests',
                        quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier',
                        quotaValue: '5',
                      },
                    ],
                  },
                  {
                    '@type': 'type.googleapis.com/google.rpc.RetryInfo',
                    retryDelay: '34s',
                  },
                ],
              },
            }),
          );
        },
      },
    }));

    delete process.env.AI_CHAT_MODEL;
    process.env.AI_CHAT_MODEL = 'gemini-2.5-flash-lite';

    const provider = new GeminiAiChatProvider();

    await assert.rejects(
      () =>
        provider.generateGeneralLearningAnswer({
          locale: 'en',
          userMessage: 'Explain Arduino Uno simply',
          history: [],
          scopeClassification: 'DOMAIN_KNOWLEDGE',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_PROVIDER_QUOTA_EXCEEDED');
        assert.equal(
          (error.details as { retryDelayMs?: number } | undefined)?.retryDelayMs,
          34000,
        );
        assert.equal(
          (error.details as { quotaMetric?: string } | undefined)?.quotaMetric,
          'generativelanguage.googleapis.com/generate_content_free_tier_requests',
        );
        return true;
      },
    );

    assert.deepEqual(attemptedModels, ['gemini-2.5-flash-lite']);
  });
});
