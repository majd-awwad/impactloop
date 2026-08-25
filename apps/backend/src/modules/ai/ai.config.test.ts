import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

const TEST_GEMINI_KEY = `AIza${'a'.repeat(32)}`;
const TEST_OPENAI_KEY = `sk-${'b'.repeat(48)}`;

process.env.GEMINI_API_KEY ??= TEST_GEMINI_KEY;
process.env.AI_CHAT_PROVIDER ??= 'gemini';
process.env.AI_CHAT_MODEL ??= 'gemini-2.5-flash-lite';

const { resolveAiChatProvider, resolveAiProvider } = await import('../../config/env.js');
const { GeminiAiChatProvider, setGeminiChatClientFactoryForTests } =
  await import('./providers/gemini-chat.provider.js');

const snapshotEnv = () => ({ ...process.env });

describe('AI chat provider resolution', () => {
  let savedEnv = snapshotEnv();
  let savedNodeTestContext: string | undefined;

  afterEach(async () => {
    for (const key of Object.keys(process.env)) {
      if (!(key in savedEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, savedEnv);
    savedEnv = snapshotEnv();
    if (savedNodeTestContext === undefined) {
      delete process.env.NODE_TEST_CONTEXT;
    } else {
      process.env.NODE_TEST_CONTEXT = savedNodeTestContext;
    }
    const { setResolvedAiChatProviderForTests } = await import('../../config/env.js');
    setResolvedAiChatProviderForTests(null);
    setGeminiChatClientFactoryForTests(null);
  });

  const withoutTestContext = () => {
    savedNodeTestContext = process.env.NODE_TEST_CONTEXT;
    delete process.env.NODE_TEST_CONTEXT;
  };

  test('explicit AI_CHAT_PROVIDER=gemini wins over OpenAI key', () => {
    withoutTestContext();
    process.env.AI_CHAT_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = TEST_GEMINI_KEY;
    process.env.OPENAI_API_KEY = TEST_OPENAI_KEY;

    assert.equal(resolveAiChatProvider(), 'gemini');
  });

  test('price suggestions accept an explicit OpenAI-compatible provider', () => {
    withoutTestContext();
    process.env.AI_PROVIDER = 'openai';
    process.env.OPENAI_API_KEY = TEST_OPENAI_KEY;
    delete process.env.GEMINI_API_KEY;

    assert.equal(resolveAiProvider(), 'openai');
  });

  test('prefers gemini over openai when both keys are configured', () => {
    withoutTestContext();
    delete process.env.AI_CHAT_PROVIDER;
    process.env.GEMINI_API_KEY = TEST_GEMINI_KEY;
    process.env.OPENAI_API_KEY = TEST_OPENAI_KEY;

    assert.equal(resolveAiChatProvider(), 'gemini');
  });

  test('defaults chat to gemini when AI_PROVIDER=gemini and Gemini key exists', () => {
    withoutTestContext();
    delete process.env.AI_CHAT_PROVIDER;
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = TEST_GEMINI_KEY;
    process.env.OPENAI_API_KEY = TEST_OPENAI_KEY;

    assert.equal(resolveAiChatProvider(), 'gemini');
  });

  test('explicit gemini never resolves to mock', () => {
    withoutTestContext();
    process.env.AI_CHAT_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = TEST_GEMINI_KEY;

    assert.notEqual(resolveAiChatProvider(), 'mock');
  });

  test('explicit gemini with missing key stays gemini but is not operational', async () => {
    withoutTestContext();
    process.env.AI_CHAT_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'your_key_here';

    const { isAiChatProviderOperational } = await import('../../config/env.js');

    assert.equal(resolveAiChatProvider(), 'gemini');
    assert.equal(isAiChatProviderOperational('gemini'), false);
  });

  test('mock is used only when explicitly selected or no provider/key is configured', () => {
    withoutTestContext();
    delete process.env.AI_CHAT_PROVIDER;
    delete process.env.AI_PROVIDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.NODE_ENV = 'development';

    assert.equal(resolveAiChatProvider(), 'mock');
  });

  test('.env.example and env.example stay byte-identical', async () => {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const root = join(process.cwd());
    const a = await readFile(join(root, '.env.example'), 'utf8');
    const b = await readFile(join(root, 'env.example'), 'utf8');
    assert.equal(a, b);
  });

  test('AI_CHAT_MODEL is canonical over OPENAI_MODEL in runtime snapshot', async () => {
    withoutTestContext();
    process.env.AI_CHAT_PROVIDER = 'openai';
    process.env.AI_CHAT_MODEL = 'canonical-model';
    process.env.OPENAI_MODEL = 'openai-specific-model';
    process.env.OPENAI_API_KEY = TEST_OPENAI_KEY;
    process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
    process.env.OPENAI_JSON_MODE = 'false';

    const {
      getAiChatRuntimeConfig,
      getAiPlatformDiagnostics,
      setResolvedAiChatProviderForTests,
    } = await import('../../config/env.js');
    setResolvedAiChatProviderForTests(null);

    const runtime = getAiChatRuntimeConfig();
    assert.equal(runtime.model, 'canonical-model');
    assert.equal(runtime.isOpenRouter, true);
    assert.equal(runtime.openaiJsonMode, false);
    assert.equal(runtime.openaiBaseHost, 'openrouter.ai');

    process.env.AI_CHAT_TIMEOUT_MS = '120000';
    const timeoutRuntime = getAiChatRuntimeConfig();
    assert.equal(timeoutRuntime.timeoutMs, 120000);

    const diagnostics = getAiPlatformDiagnostics();
    assert.equal(diagnostics.chatModel, 'canonical-model');
    assert.equal(diagnostics.openaiBaseHost, 'openrouter.ai');
    assert.equal(diagnostics.openaiJsonMode, false);
    assert.equal(diagnostics.chatTimeoutMs, 120000);
  });
});

describe('GeminiAiChatProvider', () => {
  afterEach(() => {
    setGeminiChatClientFactoryForTests(null);
  });

  test('maps Gemini JSON answer into content blocks', async () => {
    setGeminiChatClientFactoryForTests(() => ({
      models: {
        generateContent: async () => ({
          text: JSON.stringify({
            blocks: [
              {
                type: 'text',
                text: 'Arduino Uno is a beginner microcontroller board.',
                purpose: 'answer',
              },
            ],
          }),
          modelVersion: 'gemini-2.5-flash',
          usageMetadata: {
            promptTokenCount: 42,
            candidatesTokenCount: 18,
          },
        }),
      },
    }));

    const provider = new GeminiAiChatProvider();
    const result = await provider.generateGeneralLearningAnswer({
      locale: 'en',
      userMessage: 'How does Arduino Uno work?',
      history: [],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    });

    assert.equal(result.provider, 'gemini');
    assert.equal(result.model, 'gemini-2.5-flash');
    const firstBlock = result.data.blocks[0];
    assert.equal(firstBlock?.type, 'text');
    if (firstBlock?.type === 'text') {
      assert.equal(
        firstBlock.text,
        'Arduino Uno is a beginner microcontroller board.',
      );
    }
  });
});
