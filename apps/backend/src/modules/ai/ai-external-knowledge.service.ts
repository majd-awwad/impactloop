import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import type { AiContentBlock } from './ai.content-blocks.js';
import { getExternalKnowledgeProvider } from './providers/external-knowledge-provider.factory.js';
import type { AiExternalKnowledgeResult } from './providers/ai-external-knowledge.types.js';

const MAX_SNIPPET_LENGTH = 500;

const isHttpsUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const normalizeExternalKnowledgeResults = (
  results: AiExternalKnowledgeResult[],
  maxResults: number,
) => {
  const seen = new Set<string>();
  const normalized: AiExternalKnowledgeResult[] = [];

  for (const result of results) {
    if (!isHttpsUrl(result.url)) {
      continue;
    }

    const dedupeKey = result.url.trim().toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    normalized.push({
      title: result.title.trim().slice(0, 200),
      url: result.url.trim(),
      source: result.source.trim().slice(0, 120),
      publishedAt: result.publishedAt,
      snippet: result.snippet
        ? result.snippet.trim().slice(0, MAX_SNIPPET_LENGTH)
        : null,
    });

    if (normalized.length >= maxResults) {
      break;
    }
  }

  return normalized;
};

const isWebSearchEnabled = () => {
  const raw = process.env.AI_WEB_SEARCH_ENABLED ?? String(env.aiWebSearchEnabled);
  return raw.trim().toLowerCase() === 'true';
};

const readWebSearchTimeoutMs = () => {
  const raw = process.env.AI_WEB_SEARCH_TIMEOUT_MS?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return env.aiWebSearchTimeoutMs;
};

export const searchExternalDomainKnowledge = async (input: {
  query: string;
  locale: 'en' | 'ar';
  requestId: string | null;
}) => {
  if (!isWebSearchEnabled()) {
    return {
      enabled: false as const,
      results: [] as AiExternalKnowledgeResult[],
      provider: 'disabled',
      latencyMs: 0,
    };
  }

  const provider = getExternalKnowledgeProvider();
  const startedAt = Date.now();

  try {
    const response = await Promise.race([
      provider.search({
        query: input.query,
        locale: input.locale,
        maxResults: env.aiWebSearchMaxResults,
        requestId: input.requestId,
      }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new AppError(
              'External knowledge search timed out.',
              504,
              'AI_EXTERNAL_SEARCH_TIMEOUT',
            ),
          );
        }, readWebSearchTimeoutMs());
      }),
    ]);

    return {
      enabled: true as const,
      results: normalizeExternalKnowledgeResults(
        response.results,
        env.aiWebSearchMaxResults,
      ),
      provider: response.provider,
      latencyMs: response.latencyMs ?? Date.now() - startedAt,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      'External knowledge search failed.',
      502,
      'AI_EXTERNAL_SEARCH_FAILED',
    );
  }
};

export const buildExternalSourcesBlock = (input: {
  query: string;
  results: AiExternalKnowledgeResult[];
}): AiContentBlock => ({
  type: 'external_sources',
  query: input.query,
  items: input.results.map((result) => ({
    title: result.title,
    url: result.url,
    source: result.source,
    publishedAt: result.publishedAt,
    snippet: result.snippet ?? undefined,
  })),
});
