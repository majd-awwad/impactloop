import { env } from '../../../config/env.js';
import { getConfiguredGeminiApiKey } from '../../../config/env.js';

import type { AiExternalKnowledgeProvider } from './ai-external-knowledge.types.js';
import { GeminiGroundingExternalKnowledgeProvider } from './gemini-grounding-external-knowledge.provider.js';
import { MockExternalKnowledgeProvider } from './mock-external-knowledge.provider.js';

let providerOverride: AiExternalKnowledgeProvider | null = null;

export const setExternalKnowledgeProviderForTests = (
  provider: AiExternalKnowledgeProvider | null,
) => {
  providerOverride = provider;
};

class DisabledExternalKnowledgeProvider implements AiExternalKnowledgeProvider {
  async search() {
    return {
      provider: 'disabled',
      latencyMs: 0,
      results: [],
    };
  }
}

const isWebSearchEnabledForFactory = () => {
  const raw = process.env.AI_WEB_SEARCH_ENABLED ?? String(env.aiWebSearchEnabled);
  return raw.trim().toLowerCase() === 'true';
};

const readWebSearchProvider = () =>
  process.env.AI_WEB_SEARCH_PROVIDER?.trim().toLowerCase() ||
  env.aiWebSearchProvider;

export const getExternalKnowledgeProvider = (): AiExternalKnowledgeProvider => {
  if (providerOverride) {
    return providerOverride;
  }

  if (!isWebSearchEnabledForFactory()) {
    return new DisabledExternalKnowledgeProvider();
  }

  const providerName = readWebSearchProvider();

  if (providerName === 'mock') {
    return new MockExternalKnowledgeProvider();
  }

  if (providerName === 'gemini_grounding') {
    if (!getConfiguredGeminiApiKey()) {
      return new DisabledExternalKnowledgeProvider();
    }

    return new GeminiGroundingExternalKnowledgeProvider();
  }

  return new DisabledExternalKnowledgeProvider();
};
