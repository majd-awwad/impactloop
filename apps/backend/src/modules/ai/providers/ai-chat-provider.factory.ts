import {
  isAiChatDevMockFallbackEnabled,
  isAiChatProviderOperational,
  resolveAiChatProvider,
} from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';
import type { AiChatProvider } from './ai-chat-provider.types.js';
import { DevFallbackAiChatProvider } from './dev-fallback-chat.provider.js';
import { DisabledAiChatProvider } from './disabled-chat.provider.js';
import { GeminiAiChatProvider } from './gemini-chat.provider.js';
import { MockAiChatProvider } from './mock-chat.provider.js';
import { OpenAiAiChatProvider } from './openai-chat.provider.js';

let providerOverride: AiChatProvider | null = null;

export const setAiChatProviderForTests = (provider: AiChatProvider | null) => {
  providerOverride = provider;
};

export const getAiChatProvider = (): AiChatProvider => {
  if (providerOverride) {
    return providerOverride;
  }

  const providerName = resolveAiChatProvider();
  const explicitChatProvider = process.env.AI_CHAT_PROVIDER?.trim().toLowerCase();

  if (explicitChatProvider === 'gemini' && providerName !== 'gemini') {
    logger.error(
      {
        explicitChatProvider,
        resolvedChatProvider: providerName,
      },
      'AI chat provider resolution contradicted explicit Gemini configuration',
    );
  }

  if (!isAiChatProviderOperational(providerName)) {
    return new DisabledAiChatProvider();
  }

  if (providerName === 'mock') {
    return new MockAiChatProvider();
  }

  if (providerName === 'openai') {
    return new OpenAiAiChatProvider();
  }

  if (providerName === 'gemini') {
    const gemini = new GeminiAiChatProvider();
    if (isAiChatDevMockFallbackEnabled()) {
      return new DevFallbackAiChatProvider(gemini, new MockAiChatProvider());
    }
    return gemini;
  }

  return new DisabledAiChatProvider();
};