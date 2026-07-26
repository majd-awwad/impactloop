import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { AppError } from '../../../utils/app-error.js';
import {
  GeminiAiChatProvider,
  buildGeminiAnswerContents,
  setGeminiChatClientFactoryForTests,
} from './gemini-chat.provider.js';
import { ADMIN_PROJECT_REVIEW_MARKER } from '../../admin-learning-projects/admin-learning-projects.ai-review.js';

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

          if (model === 'gemini-3.1-flash-lite') {
            throw new Error(
              JSON.stringify({
                error: {
                  code: 404,
                  message:
                    'This model models/gemini-3.1-flash-lite is no longer available to new users.',
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

    process.env.AI_CHAT_MODEL = 'gemini-3.1-flash-lite';

    const provider = new GeminiAiChatProvider();
    const result = await provider.generateGeneralLearningAnswer({
      locale: 'en',
      userMessage: 'Explain Arduino Uno simply',
      history: [],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    });

    assert.deepEqual(attemptedModels.slice(0, 2), [
      'gemini-3.1-flash-lite',
      'gemini-2.0-flash-lite',
    ]);
    assert.equal(result.model, 'gemini-2.0-flash-lite');
  });

  test('tries fallback models before surfacing RESOURCE_EXHAUSTED', async () => {
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
    process.env.AI_CHAT_MODEL = 'gemini-3.1-flash-lite';

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

    assert.deepEqual(attemptedModels, [
      'gemini-3.1-flash-lite',
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash',
    ]);
  });
});

const MINIMAL_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=';

const MINIMAL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('GeminiAiChatProvider multimodal contents', () => {
  afterEach(() => {
    setGeminiChatClientFactoryForTests(null);
  });

  test('text-only calls keep string contents shape', async () => {
    let capturedContents: unknown;

    setGeminiChatClientFactoryForTests(() => ({
      models: {
        generateContent: async (request: { contents?: unknown }) => {
          capturedContents = request.contents;
          return {
            text: JSON.stringify({
              blocks: [
                {
                  type: 'text',
                  purpose: 'answer',
                  text: JSON.stringify({
                    summary: 'ok',
                    attentionLevel: 'LOW',
                    strengths: [],
                    importantConcerns: [],
                    safetyNotes: [],
                    improvementSuggestions: [],
                    manualReviewNotes: [],
                  }),
                },
              ],
            }),
            modelVersion: 'gemini-2.5-flash',
          };
        },
      },
    }));

    const provider = new GeminiAiChatProvider();
    await provider.generateGeneralLearningAnswer({
      locale: 'en',
      userMessage: 'Explain Arduino Uno',
      history: [],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    });

    assert.equal(typeof capturedContents, 'string');
    assert.ok((capturedContents as string).includes('Explain Arduino Uno'));
  });

  test('one image produces text and inlineData parts with correct mime and data', () => {
    const contents = buildGeminiAnswerContents({
      locale: 'en',
      userMessage: 'Review project',
      history: [],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      imageInputs: [
        {
          mimeType: 'image/jpeg',
          dataBase64: MINIMAL_JPEG_BASE64,
          sourceLabel: 'Project image 1',
        },
      ],
    });

    assert.ok(Array.isArray(contents));
    assert.equal(contents.length, 2);
    assert.ok(typeof contents[0]?.text === 'string');
    assert.equal(contents[1]?.inlineData?.mimeType, 'image/jpeg');
    assert.equal(contents[1]?.inlineData?.data, MINIMAL_JPEG_BASE64);
  });

  test('multiple images preserve deterministic order', () => {
    const contents = buildGeminiAnswerContents({
      locale: 'en',
      userMessage: 'Review project',
      history: [],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      imageInputs: [
        {
          mimeType: 'image/jpeg',
          dataBase64: MINIMAL_JPEG_BASE64,
          sourceLabel: 'Project image 1',
        },
        {
          mimeType: 'image/png',
          dataBase64: MINIMAL_PNG_BASE64,
          sourceLabel: 'Project image 2',
        },
      ],
    });

    assert.ok(Array.isArray(contents));
    assert.equal(contents.length, 3);
    assert.equal(contents[1]?.inlineData?.mimeType, 'image/jpeg');
    assert.equal(contents[2]?.inlineData?.mimeType, 'image/png');
    assert.equal(contents[1]?.inlineData?.data, MINIMAL_JPEG_BASE64);
    assert.equal(contents[2]?.inlineData?.data, MINIMAL_PNG_BASE64);
  });

  test('provider failures do not include base64 in error messages', async () => {
    setGeminiChatClientFactoryForTests(() => ({
      models: {
        generateContent: async () => {
          throw new Error(
            JSON.stringify({
              error: {
                code: 400,
                message: 'Invalid payload',
                status: 'INVALID_ARGUMENT',
              },
            }),
          );
        },
      },
    }));

    const provider = new GeminiAiChatProvider();
    const secretBase64 = 'a'.repeat(64);

    await assert.rejects(
      () =>
        provider.generateGeneralLearningAnswer({
          locale: 'en',
          userMessage: 'Review project',
          history: [],
          scopeClassification: 'DOMAIN_KNOWLEDGE',
          imageInputs: [
            {
              mimeType: 'image/jpeg',
              dataBase64: secretBase64,
              sourceLabel: 'Project image 1',
            },
          ],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.message.includes(secretBase64), false);
        return true;
      },
    );
  });

  test('empty imageInputs array keeps text-only contents', () => {
    const contents = buildGeminiAnswerContents({
      locale: 'en',
      userMessage: 'Review project',
      history: [],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      imageInputs: [],
    });

    assert.equal(typeof contents, 'string');
    assert.ok(contents.includes('Review project'));
  });

  test('admin review multimodal uses trusted prompt directly without learner-chat wrapper', () => {
    const trustedPrompt = `${ADMIN_PROJECT_REVIEW_MARKER}\nTrusted admin review instructions`;
    const contents = buildGeminiAnswerContents({
      locale: 'en',
      userMessage: trustedPrompt,
      history: [],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      imageInputs: [
        {
          mimeType: 'image/jpeg',
          dataBase64: MINIMAL_JPEG_BASE64,
          sourceLabel: 'Project image 1',
        },
      ],
    });

    assert.ok(Array.isArray(contents));
    assert.equal(contents[0]?.text, trustedPrompt);
    assert.equal(contents[0]?.text?.includes('Scope classification:'), false);
    assert.equal(contents[1]?.inlineData?.mimeType, 'image/jpeg');
  });

  test('admin review direct JSON response is normalized into provider blocks', async () => {
    setGeminiChatClientFactoryForTests(() => ({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            summary: 'Visual evidence supports the declared Arduino lock project.',
            attentionLevel: 'LOW',
            strengths: ['Clear wiring in the attached image.'],
            importantConcerns: [],
            safetyNotes: [],
            improvementSuggestions: [],
            manualReviewNotes: [],
          }),
          modelVersion: 'gemini-3.1-flash-lite',
        }),
      },
    }));

    const provider = new GeminiAiChatProvider();
    const result = await provider.generateGeneralLearningAnswer({
      locale: 'en',
      userMessage: `${ADMIN_PROJECT_REVIEW_MARKER}\nreview`,
      history: [],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      imageInputs: [
        {
          mimeType: 'image/jpeg',
          dataBase64: MINIMAL_JPEG_BASE64,
          sourceLabel: 'Project image 1',
        },
      ],
    });

    assert.equal(result.data.blocks.length, 1);
    const block = result.data.blocks[0];
    assert.equal(block?.type, 'text');
    if (block?.type === 'text') {
      assert.equal(block.purpose, 'answer');
      assert.ok(block.text.includes('Visual evidence supports'));
      assert.equal(block.text.includes(MINIMAL_JPEG_BASE64), false);
    }
  });
});
