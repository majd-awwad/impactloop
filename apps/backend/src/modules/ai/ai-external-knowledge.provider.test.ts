import assert from 'node:assert/strict';
import { after, afterEach, describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';
import { resolveAgentRoute } from './agent/ai-agent-router.service.js';
import {
  buildExternalSourcesBlock,
  normalizeExternalKnowledgeResults,
  searchExternalDomainKnowledge,
} from './ai-external-knowledge.service.js';
import { aiContentBlocksSchema } from './ai.content-blocks.js';
import {
  getExternalKnowledgeProvider,
  setExternalKnowledgeProviderForTests,
} from './providers/external-knowledge-provider.factory.js';
import {
  GeminiGroundingExternalKnowledgeProvider,
  mapGeminiGroundingResponse,
  setGeminiGroundingClientFactoryForTests,
} from './providers/gemini-grounding-external-knowledge.provider.js';
import type { AiExternalKnowledgeProvider } from './providers/ai-external-knowledge.types.js';

const sampleGroundingResponse = {
  candidates: [
    {
      groundingMetadata: {
        groundingChunks: [
          {
            web: {
              title: 'Arduino Wire library',
              uri: 'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
            },
          },
          {
            web: {
              title: 'Insecure duplicate',
              uri: 'http://example.com/insecure',
            },
          },
          {
            web: {
              title: 'Duplicate HTTPS',
              uri: 'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
            },
          },
          {
            web: {
              title: 'Extra one',
              uri: 'https://docs.arduino.cc/learn/',
            },
          },
          {
            web: {
              title: 'Extra two',
              uri: 'https://docs.arduino.cc/built-in-libraries/',
            },
          },
          {
            web: {
              title: 'Extra four',
              uri: 'https://docs.arduino.cc/tutorials/',
            },
          },
          {
            web: {
              title: 'Extra five',
              uri: 'https://docs.arduino.cc/language-reference/',
            },
          },
        ],
        groundingSupports: [
          {
            segment: {
              text: 'Untrusted provider snippet about Wire library usage.',
            },
            groundingChunkIndices: [0],
          },
        ],
      },
    },
  ],
};

describe('gemini grounding external knowledge provider', () => {
  afterEach(() => {
    setGeminiGroundingClientFactoryForTests(null);
    setExternalKnowledgeProviderForTests(null);
    delete process.env.AI_WEB_SEARCH_ENABLED;
    delete process.env.AI_WEB_SEARCH_PROVIDER;
    delete process.env.AI_WEB_SEARCH_TIMEOUT_MS;
  });

  after(() => {
    setGeminiGroundingClientFactoryForTests(null);
    setExternalKnowledgeProviderForTests(null);
  });

  test('valid technical query returns normalized sources', async () => {
    setGeminiGroundingClientFactoryForTests(() => ({
      models: {
        generateContent: async () => sampleGroundingResponse,
      },
    }));

    const provider = new GeminiGroundingExternalKnowledgeProvider();
    const response = await provider.search({
      query: 'Arduino Wire library documentation',
      locale: 'en',
      maxResults: 5,
      requestId: 'req-1',
    });

    assert.equal(response.provider, 'gemini_grounding');
    assert.ok(response.results.length >= 1);
    assert.equal(
      response.results[0]?.url,
      'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
    );
    assert.equal(response.results[0]?.provenance, 'authoritative');
  });

  test('invalid and non-HTTPS URLs are removed during normalization', () => {
    const normalized = normalizeExternalKnowledgeResults(
      mapGeminiGroundingResponse(sampleGroundingResponse, 10),
      5,
    );

    assert.ok(normalized.every((item) => item.url.startsWith('https://')));
    assert.equal(
      normalized.filter(
        (item) =>
          item.url ===
          'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
      ).length,
      1,
    );
  });

  test('results are capped at five', () => {
    const normalized = normalizeExternalKnowledgeResults(
      mapGeminiGroundingResponse(sampleGroundingResponse, 10),
      5,
    );

    assert.equal(normalized.length, 5);
  });

  test('duplicate URLs are removed', () => {
    const normalized = normalizeExternalKnowledgeResults(
      [
        {
          title: 'A',
          url: 'https://docs.arduino.cc/hardware/uno-rev3',
          source: 'arduino',
          publishedAt: null,
          snippet: null,
          provenance: 'authoritative',
        },
        {
          title: 'B',
          url: 'https://docs.arduino.cc/hardware/uno-rev3',
          source: 'arduino',
          publishedAt: null,
          snippet: null,
          provenance: 'authoritative',
        },
      ],
      5,
    );

    assert.equal(normalized.length, 1);
  });

  test('timeout returns a safe external-search outcome', async () => {
    process.env.AI_WEB_SEARCH_ENABLED = 'true';
    process.env.AI_WEB_SEARCH_PROVIDER = 'gemini_grounding';

    let calls = 0;
    setExternalKnowledgeProviderForTests({
      async search() {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { provider: 'slow', latencyMs: 50, results: [] };
      },
    });

    process.env.AI_WEB_SEARCH_TIMEOUT_MS = '5';

    await assert.rejects(
      () =>
        searchExternalDomainKnowledge({
          query: 'Arduino datasheet',
          locale: 'en',
          requestId: 'timeout-test',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_EXTERNAL_SEARCH_TIMEOUT');
        return true;
      },
    );

    assert.equal(calls, 1);
  });

  test('provider authentication error does not become a chat-provider error', async () => {
    setGeminiGroundingClientFactoryForTests(() => ({
      models: {
        generateContent: async () => {
          throw new Error('401 API key not valid');
        },
      },
    }));

    const provider = new GeminiGroundingExternalKnowledgeProvider();

    await assert.rejects(
      () =>
        provider.search({
          query: 'Arduino datasheet',
          locale: 'en',
          maxResults: 5,
          requestId: 'auth-test',
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'AI_EXTERNAL_SEARCH_AUTH_ERROR');
        assert.notEqual(error.code, 'AI_PROVIDER_AUTH_ERROR');
        return true;
      },
    );
  });

  test('search result snippets are bounded untrusted data', () => {
    const mapped = mapGeminiGroundingResponse(sampleGroundingResponse, 5);
    const normalized = normalizeExternalKnowledgeResults(mapped, 5);
    const snippet = normalized[0]?.snippet ?? '';
    assert.ok(snippet.length <= 500);
    assert.match(snippet, /Untrusted provider snippet/);
  });

  test('weather and platform inventory never route to external search', () => {
    const weather = resolveAgentRoute({
      userMessage: 'كيف الطقس اليوم؟',
      locale: 'ar',
    });
    assert.equal(weather.route, 'OUT_OF_SCOPE');

    const inventory = resolveAgentRoute({
      userMessage: 'اعرضلي مواد إلكترونيات متوفرة',
      locale: 'ar',
    });
    assert.equal(inventory.route, 'MATERIAL_SEARCH');
  });

  test('search disabled causes no provider invocation', async () => {
    process.env.AI_WEB_SEARCH_ENABLED = 'false';

    let calls = 0;
    setExternalKnowledgeProviderForTests({
      async search() {
        calls += 1;
        return { provider: 'should-not-run', latencyMs: 0, results: [] };
      },
    });

    const result = await searchExternalDomainKnowledge({
      query: 'Arduino Wire library',
      locale: 'en',
      requestId: 'disabled-test',
    });

    assert.equal(result.enabled, false);
    assert.equal(calls, 0);
  });

  test('external_sources persists and reloads through schema validation', () => {
    const block = buildExternalSourcesBlock({
      query: 'Arduino Wire library',
      results: normalizeExternalKnowledgeResults(
        mapGeminiGroundingResponse(sampleGroundingResponse, 5),
        5,
      ),
    });

    const parsed = aiContentBlocksSchema.parse([block]);
    assert.equal(parsed[0]?.type, 'external_sources');
    assert.ok((parsed[0] as { items: unknown[] }).items.length > 0);
  });

  test('factory selects gemini_grounding when configured', () => {
    process.env.AI_WEB_SEARCH_ENABLED = 'true';
    process.env.AI_WEB_SEARCH_PROVIDER = 'gemini_grounding';
    process.env.GEMINI_API_KEY = 'AIzaSyBfakekeyforfactorytest1';

    const provider = getExternalKnowledgeProvider();
    assert.equal(provider.constructor.name, 'GeminiGroundingExternalKnowledgeProvider');

    delete process.env.GEMINI_API_KEY;
  });
});

class TrackingProvider implements AiExternalKnowledgeProvider {
  calls = 0;

  async search() {
    this.calls += 1;
    return { provider: 'tracking', latencyMs: 1, results: [] };
  }
}

describe('external knowledge provider invocation guards', () => {
  afterEach(() => {
    setExternalKnowledgeProviderForTests(null);
    delete process.env.AI_WEB_SEARCH_ENABLED;
  });

  test('platform inventory route does not invoke provider from orchestrator guard', async () => {
    const tracker = new TrackingProvider();
    setExternalKnowledgeProviderForTests(tracker);
    process.env.AI_WEB_SEARCH_ENABLED = 'true';

    const route = resolveAgentRoute({
      userMessage: 'اعرضلي مواد إلكترونيات متوفرة',
      locale: 'ar',
    });
    assert.equal(route.route, 'MATERIAL_SEARCH');
    assert.equal(tracker.calls, 0);
  });
});
