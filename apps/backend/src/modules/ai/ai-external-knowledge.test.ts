import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';

import { resolveAgentRoute } from './agent/ai-agent-router.service.js';
import {
  buildExternalSourcesBlock,
  normalizeExternalKnowledgeResults,
  searchExternalDomainKnowledge,
} from './ai-external-knowledge.service.js';
import { setExternalKnowledgeProviderForTests } from './providers/external-knowledge-provider.factory.js';
import { MockExternalKnowledgeProvider } from './providers/mock-external-knowledge.provider.js';
import { aiContentBlocksSchema } from './ai.content-blocks.js';

describe('ai external knowledge', () => {
  after(() => {
    setExternalKnowledgeProviderForTests(null);
    delete process.env.AI_WEB_SEARCH_ENABLED;
  });

  test('weather remains out of scope and does not route to external knowledge', () => {
    const route = resolveAgentRoute({
      userMessage: 'كيف الطقس اليوم؟',
      locale: 'ar',
    });
    assert.equal(route.route, 'OUT_OF_SCOPE');
  });

  test('material availability uses internal platform route', () => {
    const route = resolveAgentRoute({
      userMessage: 'اعرضلي مواد إلكترونيات متوفرة',
      locale: 'ar',
    });
    assert.equal(route.route, 'MATERIAL_SEARCH');
  });

  test('arduino library question routes to external knowledge for domain questions', () => {
    const route = resolveAgentRoute({
      userMessage: 'What is the current Arduino Wire library documentation?',
      locale: 'en',
    });
    assert.equal(route.route, 'EXTERNAL_DOMAIN_KNOWLEDGE');
  });

  test('disabled external search returns enabled=false safely', async () => {
    process.env.AI_WEB_SEARCH_ENABLED = 'false';
    const result = await searchExternalDomainKnowledge({
      query: 'Arduino Wire library docs',
      locale: 'en',
      requestId: 'test',
    });
    assert.equal(result.enabled, false);
    assert.equal(result.results.length, 0);
  });

  test('enabled mock search returns bounded https results', async () => {
    process.env.AI_WEB_SEARCH_ENABLED = 'true';
    process.env.AI_WEB_SEARCH_PROVIDER = 'mock';
    setExternalKnowledgeProviderForTests(new MockExternalKnowledgeProvider());

    const result = await searchExternalDomainKnowledge({
      query: 'Arduino Uno datasheet',
      locale: 'en',
      requestId: 'test',
    });
    assert.equal(result.enabled, true);
    assert.ok(result.results.length > 0);
    assert.ok(result.results.every((item) => item.url.startsWith('https://')));
  });

  test('invalid and duplicate urls are removed during normalization', () => {
    const normalized = normalizeExternalKnowledgeResults(
      [
        {
          title: 'Bad',
          url: 'http://insecure.example.com',
          source: 'bad',
          publishedAt: null,
          snippet: 'ignore',
        },
        {
          title: 'Good',
          url: 'https://docs.arduino.cc/hardware/uno-rev3',
          source: 'arduino',
          publishedAt: null,
          snippet: 'ok',
        },
        {
          title: 'Duplicate',
          url: 'https://docs.arduino.cc/hardware/uno-rev3',
          source: 'arduino',
          publishedAt: null,
          snippet: 'dup',
        },
      ],
      5,
    );

    assert.equal(normalized.length, 1);
    assert.equal(normalized[0]?.url, 'https://docs.arduino.cc/hardware/uno-rev3');
  });

  test('external_sources block persists through schema validation', () => {
    const block = buildExternalSourcesBlock({
      query: 'Arduino Wire library',
      results: [
        {
          title: 'Wire reference',
          url: 'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
          source: 'arduino.cc',
          publishedAt: null,
          snippet: 'Official Wire library reference.',
        },
      ],
    });

    const parsed = aiContentBlocksSchema.parse([block]);
    assert.equal(parsed[0]?.type, 'external_sources');
  });
});
