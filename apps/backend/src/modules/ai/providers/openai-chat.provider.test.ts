import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';

import { AppError } from '../../../utils/app-error.js';
import {
  OpenAiAiChatProvider,
  setOpenAiChatClientFactoryForTests,
  supportsOpenAiCompatibleImageInputs,
} from './openai-chat.provider.js';

const snapshotEnv = () => ({ ...process.env });

describe('OpenAiAiChatProvider', () => {
  let savedEnv = snapshotEnv();

  before(() => {
    process.env.OPENAI_API_KEY ??= 'sk-test-openai-key-1234567890';
    process.env.AI_CHAT_PROVIDER ??= 'openai';
    process.env.AI_CHAT_MODEL ??= 'gpt-4o-mini';
  });

  afterEach(async () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, savedEnv);
    savedEnv = snapshotEnv();
    setOpenAiChatClientFactoryForTests(null);
    const { setResolvedAiChatProviderForTests } = await import(
      '../../../config/env.js'
    );
    setResolvedAiChatProviderForTests(null);
  });

  after(() => {
    setOpenAiChatClientFactoryForTests(null);
  });

  test('classifyScope validates structured JSON from OpenAI', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => ({
            id: 'chatcmpl-test',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    classification: 'DOMAIN_KNOWLEDGE',
                    confidence: 0.92,
                    reason: 'Arduino educational question',
                  }),
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 42,
              completion_tokens: 18,
              total_tokens: 60,
            },
          }),
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    const result = await provider.classifyScope({
      locale: 'en',
      userMessage: 'How do I use an Arduino Uno?',
    });

    assert.equal(result.provider, 'openai');
    assert.equal(result.data.classification, 'DOMAIN_KNOWLEDGE');
    assert.ok(result.usage.inputTokens === 42);
  });

  test('standard OpenAI path enables JSON response mode by default', async () => {
    let capturedRequest: Record<string, unknown> | null = null;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_JSON_MODE;
    process.env.AI_CHAT_MODEL = 'gpt-4o-mini';

    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request: Record<string, unknown>) => {
            capturedRequest = request;
            return {
              model: 'gpt-4o-mini',
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      classification: 'DOMAIN_KNOWLEDGE',
                      confidence: 0.9,
                      reason: 'ok',
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            };
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await provider.classifyScope({
      locale: 'en',
      userMessage: 'Explain Arduino',
    });

    assert.deepEqual(capturedRequest?.response_format, { type: 'json_object' });
  });

  test('OpenRouter-compatible base URL disables JSON mode by default', async () => {
    let capturedRequest: Record<string, unknown> | null = null;
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    delete process.env.OPENAI_JSON_MODE;
    process.env.AI_CHAT_MODEL = 'openrouter/free';

    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request: Record<string, unknown>) => {
            capturedRequest = request;
            return {
              model: 'openrouter/free',
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      classification: 'DOMAIN_KNOWLEDGE',
                      confidence: 0.9,
                      reason: 'ok',
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            };
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await provider.classifyScope({
      locale: 'en',
      userMessage: 'Explain Arduino',
    });

    assert.equal(capturedRequest?.response_format, undefined);
  });

  test('OPENAI_JSON_MODE=true forces JSON mode even for OpenRouter', async () => {
    let capturedRequest: Record<string, unknown> | null = null;
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.OPENAI_JSON_MODE = 'true';

    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request: Record<string, unknown>) => {
            capturedRequest = request;
            return {
              model: 'openrouter/free',
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      classification: 'DOMAIN_KNOWLEDGE',
                      confidence: 0.9,
                      reason: 'ok',
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            };
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await provider.classifyScope({
      locale: 'en',
      userMessage: 'Explain Arduino',
    });

    assert.deepEqual(capturedRequest?.response_format, { type: 'json_object' });
  });

  test('generateGeneralLearningAnswer validates answer blocks', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => ({
            id: 'chatcmpl-test-answer',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    blocks: [
                      {
                        type: 'text',
                        text: 'An Arduino Uno is a beginner microcontroller board.',
                        purpose: 'answer',
                      },
                    ],
                  }),
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 80,
              completion_tokens: 24,
              total_tokens: 104,
            },
          }),
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    const result = await provider.generateGeneralLearningAnswer({
      locale: 'en',
      userMessage: 'How do I use an Arduino Uno?',
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      history: [],
    });

    assert.equal(result.provider, 'openai');
    assert.equal(result.data.blocks.length, 1);
    const firstBlock = result.data.blocks[0];
    assert.equal(firstBlock?.type, 'text');
    if (firstBlock?.type === 'text') {
      assert.equal(firstBlock.purpose, 'answer');
      assert.match(firstBlock.text ?? '', /Arduino Uno/i);
    }
  });

  test('OpenRouter GPT-4.1 Nano uses a strict schema for general learning answers', async () => {
    let capturedRequest: Record<string, unknown> | null = null;
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    delete process.env.OPENAI_JSON_MODE;

    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request: Record<string, unknown>) => {
            capturedRequest = request;
            return {
              model: 'openai/gpt-4.1-nano',
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      blocks: [
                        {
                          type: 'text',
                          text: 'شرح عربي واضح للخطوة.',
                          purpose: 'answer',
                        },
                      ],
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 10, completion_tokens: 8 },
            };
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await provider.generateGeneralLearningAnswer({
      locale: 'ar',
      userMessage: 'اشرح الخطوة بالعربي',
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      history: [],
    });

    const responseFormat = capturedRequest?.response_format as {
      type?: string;
      json_schema?: { name?: string; strict?: boolean; schema?: unknown };
    };
    assert.equal(responseFormat.type, 'json_schema');
    assert.equal(
      responseFormat.json_schema?.name,
      'impactloop_general_learning_answer',
    );
    assert.equal(responseFormat.json_schema?.strict, true);
  });

  test('repairs one malformed general learning answer and aggregates usage', async () => {
    let calls = 0;
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';

    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => {
            calls += 1;
            return {
              model: 'openai/gpt-4.1-nano',
              choices: [
                {
                  message: {
                    content:
                      calls === 1
                        ? JSON.stringify({ blocks: [{ type: 'text' }] })
                        : JSON.stringify({
                            blocks: [
                              {
                                type: 'text',
                                text: 'الشرح المصحح.',
                                purpose: 'answer',
                              },
                            ],
                          }),
                  },
                },
              ],
              usage:
                calls === 1
                  ? { prompt_tokens: 10, completion_tokens: 4 }
                  : { prompt_tokens: 14, completion_tokens: 6 },
            };
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    const result = await provider.generateGeneralLearningAnswer({
      locale: 'ar',
      userMessage: 'اشرح الخطوة بالعربي',
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      history: [],
    });

    assert.equal(calls, 2);
    assert.equal(result.usage.inputTokens, 24);
    assert.equal(result.usage.outputTokens, 10);
    assert.equal(result.data.blocks[0]?.type, 'text');
  });

  test('maps an unrepaired malformed answer to AI_RESPONSE_INVALID', async () => {
    let calls = 0;
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';

    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => {
            calls += 1;
            return {
              model: 'openai/gpt-4.1-nano',
              choices: [{ message: { content: 'not-json' } }],
            };
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await assert.rejects(
      () =>
        provider.generateGeneralLearningAnswer({
          locale: 'en',
          userMessage: 'Explain the step',
          scopeClassification: 'DOMAIN_KNOWLEDGE',
          history: [],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        return true;
      },
    );
    assert.equal(calls, 2);
  });

  test('OpenRouter GPT-4.1 Nano accepts image inputs and sends a multimodal review request', async () => {
    let capturedRequest: Record<string, unknown> | null = null;
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
    delete process.env.OPENAI_JSON_MODE;

    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async (request: Record<string, unknown>) => {
            capturedRequest = request;
            return {
              model: 'openai/gpt-4.1-nano',
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      blocks: [
                        {
                          type: 'text',
                          purpose: 'answer',
                          text: JSON.stringify({
                            summary: 'Image was reviewed.',
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
                  },
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            };
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    assert.equal(provider.supportsImageInputs, true);
    const result = await provider.generateGeneralLearningAnswer({
      locale: 'en',
      userMessage: 'ADMIN_PROJECT_REVIEW_V1\nReview this project.',
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      history: [],
      imageInputs: [
        {
          mimeType: 'image/jpeg',
          dataBase64: 'aW1hZ2UtYnl0ZXM=',
          sourceLabel: 'Project image 1',
        },
      ],
      structuredOutput: {
        name: 'impactloop_admin_learning_project_ai_review',
        schema: {
          type: 'object',
          properties: { summary: { type: 'string' } },
          required: ['summary'],
          additionalProperties: false,
        },
      },
    });

    assert.equal(result.model, 'openai/gpt-4.1-nano');
    const responseFormat = capturedRequest?.response_format as {
      type?: string;
      json_schema?: { name?: string; strict?: boolean; schema?: unknown };
    };
    assert.equal(responseFormat.type, 'json_schema');
    assert.equal(
      responseFormat.json_schema?.name,
      'impactloop_admin_learning_project_ai_review',
    );
    assert.equal(responseFormat.json_schema?.strict, true);
    assert.deepEqual(responseFormat.json_schema?.schema, {
      type: 'object',
      properties: { summary: { type: 'string' } },
      required: ['summary'],
      additionalProperties: false,
    });
    const messages = capturedRequest?.messages as Array<{ content?: unknown }>;
    assert.ok(Array.isArray(messages));
    const content = messages[1]?.content as Array<Record<string, unknown>>;
    assert.equal(content[0]?.type, 'text');
    assert.equal(content[0]?.text, 'ADMIN_PROJECT_REVIEW_V1\nReview this project.');
    assert.equal(content[1]?.type, 'image_url');
    assert.deepEqual(content[1]?.image_url, {
      url: 'data:image/jpeg;base64,aW1hZ2UtYnl0ZXM=',
    });
  });

  test('OpenAI-compatible image capability remains disabled for unverified models', async () => {
    const { getAiChatRuntimeConfig } = await import('../../../config/env.js');
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.AI_CHAT_MODEL = 'openrouter/free';

    assert.equal(supportsOpenAiCompatibleImageInputs(getAiChatRuntimeConfig()), false);
    assert.equal(new OpenAiAiChatProvider().supportsImageInputs, false);
  });

  test('maps empty completion to AI_RESPONSE_INVALID', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => ({
            id: 'chatcmpl-empty',
            object: 'chat.completion',
            created: Date.now(),
            model: 'gpt-4o-mini',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: '   ',
                },
                finish_reason: 'stop',
              },
            ],
          }),
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();

    await assert.rejects(
      () =>
        provider.generateGeneralLearningAnswer({
          locale: 'en',
          userMessage: 'Explain breadboard',
          scopeClassification: 'DOMAIN_KNOWLEDGE',
          history: [],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        return true;
      },
    );
  });

  test('maps 401 to AI_PROVIDER_AUTH_ERROR', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => {
            const error = new Error('Unauthorized') as Error & { status: number };
            error.status = 401;
            throw error;
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await assert.rejects(
      () =>
        provider.classifyScope({
          locale: 'en',
          userMessage: 'hi',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_PROVIDER_AUTH_ERROR');
        return true;
      },
    );
  });

  test('maps 403 to AI_PROVIDER_AUTH_ERROR', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => {
            const error = new Error('Forbidden') as Error & { status: number };
            error.status = 403;
            throw error;
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await assert.rejects(
      () =>
        provider.classifyScope({
          locale: 'en',
          userMessage: 'hi',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_PROVIDER_AUTH_ERROR');
        return true;
      },
    );
  });

  test('maps 429 to AI_PROVIDER_QUOTA_EXCEEDED', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => {
            const error = new Error('Rate limited') as Error & { status: number };
            error.status = 429;
            throw error;
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await assert.rejects(
      () =>
        provider.classifyScope({
          locale: 'en',
          userMessage: 'hi',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_PROVIDER_QUOTA_EXCEEDED');
        return true;
      },
    );
  });

  test('maps 402 to AI_PROVIDER_QUOTA_EXCEEDED', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => {
            const error = new Error('Insufficient credits') as Error & {
              status: number;
            };
            error.status = 402;
            throw error;
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await assert.rejects(
      () =>
        provider.classifyScope({
          locale: 'en',
          userMessage: 'hi',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_PROVIDER_QUOTA_EXCEEDED');
        return true;
      },
    );
  });

  test('maps network failure to AI_PROVIDER_ERROR', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => {
            throw new Error('fetch failed: ECONNRESET');
          },
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await assert.rejects(
      () =>
        provider.classifyScope({
          locale: 'en',
          userMessage: 'hi',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_PROVIDER_ERROR');
        return true;
      },
    );
  });

  test('parses valid semantic planner payload', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => ({
            model: 'gpt-4o-mini',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    route: 'GENERAL_LEARNING',
                    confidence: 0.91,
                    entities: [],
                    needsClarification: false,
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 12 },
          }),
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    const result = await provider.classifySemanticUnderstanding({
      locale: 'en',
      prompt: 'Classify: Explain Arduino',
    });

    assert.equal(result.provider, 'openai');
    assert.equal((result.data as { route?: string }).route, 'GENERAL_LEARNING');
  });

  test('rejects answer-like non-planner JSON for semantic understanding', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => ({
            model: 'gpt-4o-mini',
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    blocks: [
                      {
                        type: 'text',
                        text: 'Arduino is a microcontroller.',
                        purpose: 'answer',
                      },
                    ],
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 12 },
          }),
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await assert.rejects(
      () =>
        provider.classifySemanticUnderstanding({
          locale: 'en',
          prompt: 'Classify: Explain Arduino',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        return true;
      },
    );
  });

  test('rejects malformed semantic response', async () => {
    setOpenAiChatClientFactoryForTests(() => ({
      chat: {
        completions: {
          create: async () => ({
            model: 'gpt-4o-mini',
            choices: [
              {
                message: {
                  content: 'not-json-at-all',
                },
              },
            ],
          }),
        },
      },
    }));

    const provider = new OpenAiAiChatProvider();
    await assert.rejects(
      () =>
        provider.classifySemanticUnderstanding({
          locale: 'ar',
          prompt: 'صنف الرسالة',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_RESPONSE_INVALID');
        return true;
      },
    );
  });
});

describe('openai env helpers', () => {
  test('isUsableOpenAiApiKey rejects placeholders', async () => {
    const { isUsableOpenAiApiKey } = await import('../../../config/env.js');

    assert.equal(isUsableOpenAiApiKey(null), false);
    assert.equal(isUsableOpenAiApiKey('sk-your-key-here'), false);
    assert.equal(
      isUsableOpenAiApiKey('sk-proj-valid-looking-test-key-1234567890'),
      true,
    );
  });

  test('AI_CHAT_MODEL wins over OPENAI_MODEL', async () => {
    const saved = snapshotEnv();
    try {
      process.env.AI_CHAT_PROVIDER = 'openai';
      process.env.AI_CHAT_MODEL = 'canonical-chat-model';
      process.env.OPENAI_MODEL = 'should-not-win';
      process.env.NODE_TEST_CONTEXT = '1';

      const { getAiChatRuntimeConfig, setResolvedAiChatProviderForTests } =
        await import('../../../config/env.js');
      setResolvedAiChatProviderForTests(null);

      const runtime = getAiChatRuntimeConfig();
      assert.equal(runtime.model, 'canonical-chat-model');
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in saved)) {
          delete process.env[key];
        }
      }
      Object.assign(process.env, saved);
    }
  });

  test('isOpenRouterBaseUrl uses hostname parsing', async () => {
    const { isOpenRouterBaseUrl } = await import('../../../config/env.js');
    assert.equal(isOpenRouterBaseUrl('https://openrouter.ai/api/v1'), true);
    assert.equal(
      isOpenRouterBaseUrl('https://evil.openrouter.ai.example.com/api'),
      false,
    );
    assert.equal(
      isOpenRouterBaseUrl('https://api.example.com/openrouter.ai'),
      false,
    );
    assert.equal(isOpenRouterBaseUrl('not a url'), false);
  });

  test('missing OpenAI key makes openai chat non-operational', async () => {
    const saved = snapshotEnv();
    try {
      process.env.AI_CHAT_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;
      process.env.NODE_TEST_CONTEXT = '1';
      const { isAiChatProviderOperational, setResolvedAiChatProviderForTests } =
        await import('../../../config/env.js');
      setResolvedAiChatProviderForTests(null);
      assert.equal(isAiChatProviderOperational('openai'), false);
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in saved)) {
          delete process.env[key];
        }
      }
      Object.assign(process.env, saved);
    }
  });
});
