import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { AppError } from '../../../utils/app-error.js';
import {
  OpenAiAiChatProvider,
  setOpenAiChatClientFactoryForTests,
} from './openai-chat.provider.js';

describe('OpenAiAiChatProvider', () => {
  before(() => {
    process.env.OPENAI_API_KEY ??= 'sk-test-openai-key-1234567890';
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
    assert.equal(result.data.blocks[0]?.purpose, 'answer');
    assert.match(result.data.blocks[0]?.text ?? '', /Arduino Uno/i);
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
});
