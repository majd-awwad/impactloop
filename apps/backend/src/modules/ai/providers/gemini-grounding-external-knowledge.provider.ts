import { GoogleGenAI } from '@google/genai';

import { env, getConfiguredGeminiApiKey } from '../../../config/env.js';
import { AppError } from '../../../utils/app-error.js';

import type {
  AiExternalKnowledgeProvider,
  AiExternalKnowledgeResult,
  AiExternalKnowledgeSearchInput,
  AiExternalKnowledgeSearchOutput,
} from './ai-external-knowledge.types.js';
import { scoreExternalSourceProvenance } from '../external-source-provenance.js';

const MAX_SNIPPET_LENGTH = 500;

type GroundingWebChunk = {
  web?: {
    uri?: string;
    title?: string;
  };
};

type GroundingSupportSegment = {
  segment?: {
    text?: string;
  };
};

type GeminiGroundingResponse = {
  candidates?: Array<{
    groundingMetadata?: {
      groundingChunks?: GroundingWebChunk[];
      groundingSupports?: Array<{
        segment?: GroundingSupportSegment['segment'];
        groundingChunkIndices?: number[];
      }>;
    };
  }>;
};

type GeminiGroundingClient = {
  models: {
    generateContent: (
      request: Parameters<GoogleGenAI['models']['generateContent']>[0],
    ) => Promise<GeminiGroundingResponse>;
  };
};

let clientFactoryOverride: (() => GeminiGroundingClient) | null = null;

export const setGeminiGroundingClientFactoryForTests = (
  factory: (() => GeminiGroundingClient) | null,
) => {
  clientFactoryOverride = factory;
};

const extractHostname = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
};

const buildSnippetForChunk = (
  chunkIndex: number,
  supports: NonNullable<
    GeminiGroundingResponse['candidates']
  >[number]['groundingMetadata'] extends infer T
    ? T extends { groundingSupports?: infer S }
      ? S
      : never
    : never,
): string | null => {
  if (!supports?.length) {
    return null;
  }

  const segments: string[] = [];
  for (const support of supports) {
    const indices = support.groundingChunkIndices ?? [];
    if (!indices.includes(chunkIndex)) {
      continue;
    }

    const text = support.segment?.text?.trim();
    if (text) {
      segments.push(text);
    }
  }

  if (segments.length === 0) {
    return null;
  }

  return segments.join(' ').slice(0, MAX_SNIPPET_LENGTH);
};

export const mapGeminiGroundingResponse = (
  response: GeminiGroundingResponse,
  maxResults: number,
): AiExternalKnowledgeResult[] => {
  const metadata = response.candidates?.[0]?.groundingMetadata;
  const chunks = metadata?.groundingChunks ?? [];
  const supports = metadata?.groundingSupports ?? [];
  const results: AiExternalKnowledgeResult[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const uri = chunk?.web?.uri?.trim();
    const title = chunk?.web?.title?.trim();

    if (!uri || !title) {
      continue;
    }

    results.push({
      title: title.slice(0, 200),
      url: uri,
      source: extractHostname(uri).slice(0, 120),
      publishedAt: null,
      snippet: buildSnippetForChunk(index, supports),
      provenance: scoreExternalSourceProvenance(uri),
    });

    if (results.length >= maxResults) {
      break;
    }
  }

  return results;
};

const mapGeminiGroundingFailure = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('api key') || message.includes('unauthorized') || message.includes('401')) {
    return new AppError(
      'External knowledge search is temporarily unavailable.',
      503,
      'AI_EXTERNAL_SEARCH_AUTH_ERROR',
    );
  }

  if (message.includes('quota') || message.includes('rate') || message.includes('429')) {
    return new AppError(
      'External knowledge search is temporarily unavailable.',
      503,
      'AI_EXTERNAL_SEARCH_QUOTA_EXCEEDED',
    );
  }

  return new AppError(
    'External knowledge search failed.',
    502,
    'AI_EXTERNAL_SEARCH_FAILED',
  );
};

const buildSearchPrompt = (query: string, locale: 'en' | 'ar') =>
  locale === 'ar'
    ? `ابحث عن مراجع تقنية واضحة لهذا السؤال: ${query}`
    : `Find clear technical references for: ${query}`;

export class GeminiGroundingExternalKnowledgeProvider
  implements AiExternalKnowledgeProvider
{
  private getClient(): GeminiGroundingClient {
    const apiKey = getConfiguredGeminiApiKey();
    if (!apiKey) {
      throw new AppError(
        'External knowledge search is disabled.',
        503,
        'AI_EXTERNAL_SEARCH_DISABLED',
      );
    }

    try {
      return clientFactoryOverride?.() ?? new GoogleGenAI({ apiKey });
    } catch (error) {
      throw mapGeminiGroundingFailure(error);
    }
  }

  async search(
    input: AiExternalKnowledgeSearchInput,
  ): Promise<AiExternalKnowledgeSearchOutput> {
    const startedAt = Date.now();
    const ai = this.getClient();

    try {
      const response = (await ai.models.generateContent({
        model: env.aiWebSearchModel,
        contents: buildSearchPrompt(input.query, input.locale),
        config: {
          temperature: 0,
          maxOutputTokens: 256,
          tools: [{ googleSearch: {} }],
        },
      })) as GeminiGroundingResponse;

      return {
        provider: 'gemini_grounding',
        latencyMs: Date.now() - startedAt,
        results: mapGeminiGroundingResponse(response, input.maxResults),
      };
    } catch (error) {
      throw mapGeminiGroundingFailure(error);
    }
  }
}
