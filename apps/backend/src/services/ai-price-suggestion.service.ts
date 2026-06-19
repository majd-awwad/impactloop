import { z } from 'zod';

import {
  env,
  getAiPriceSuggestionDebugInfo,
  isAiProviderOperational,
  type AiProviderName,
} from '../config/env.js';
import { normalizeSearchText } from '../utils/normalize-search-text.js';

import {
  buildUnknownMaterialPriceReviewLookupKey,
  buildPriceRuleReviewLookupKey,
  createAiPriceLookupLog,
  findRecentSuccessfulAiLookupLog,
} from './ai-price-lookup.repository.js';
import { callGeminiForPriceSuggestion } from './gemini-price-suggestion.provider.js';
import { generateMockPriceSuggestion } from './mock-price-suggestion.provider.js';
import type {
  AiPriceSuggestionInput,
  AiPriceSuggestionPayload,
  AiPriceSuggestionResult,
  AiSuggestionConfidence,
} from './ai-price-suggestion.types.js';

export type {
  AiPriceSuggestionInput,
  AiPriceSuggestionPayload,
  AiPriceSuggestionResult,
  AiSuggestionConfidence,
} from './ai-price-suggestion.types.js';

const aiResponseSchema = z.object({
  provider: z.string().trim().optional(),
  suggestedMaterialNameEn: z.string().trim().min(1),
  suggestedMaterialNameAr: z.string().trim().min(1).nullable().optional(),
  suggestedCategoryName: z.string().trim().min(1),
  suggestedAliases: z.array(z.string().trim().min(1)).default([]),
  suggestedUnit: z.string().trim().min(1),
  suggestedMaxAllowedUnitPriceNis: z.number().positive(),
  suggestedMaxAllowedTotalPriceNis: z.number().positive().nullable().optional(),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  reasoning: z.string().trim().min(1),
  safetyNote: z.string().trim().min(1),
});

const MAX_REALISTIC_PRICE_NIS = 100_000;

export const isValidAiSuggestedPrice = (input: {
  maxUnitPriceNis: number | null;
  maxTotalPriceNis: number | null;
}): boolean => {
  if (input.maxUnitPriceNis == null || input.maxUnitPriceNis <= 0) {
    return false;
  }

  if (input.maxUnitPriceNis > MAX_REALISTIC_PRICE_NIS) {
    return false;
  }

  if (
    input.maxTotalPriceNis != null &&
    (input.maxTotalPriceNis <= 0 ||
      input.maxTotalPriceNis > MAX_REALISTIC_PRICE_NIS)
  ) {
    return false;
  }

  return true;
};

const buildSkippedResult = (
  query: string,
  normalizedQuery: string,
  reason: string,
  aiProvider: AiProviderName | null = null,
): AiPriceSuggestionResult => ({
  status: 'SKIPPED',
  aiProvider,
  unit: null,
  maxUnitPriceNis: null,
  maxTotalPriceNis: null,
  aliases: [],
  confidence: null,
  reasoning: null,
  resultJson: { reason, query, provider: aiProvider },
  logId: null,
});

const mapPayloadToResult = (
  payload: AiPriceSuggestionPayload,
  resultJson: Record<string, unknown>,
  logId: string,
  aiProvider: 'gemini' | 'mock',
): AiPriceSuggestionResult => ({
  status: 'SUCCESS',
  aiProvider,
  unit: payload.suggestedUnit,
  maxUnitPriceNis: payload.suggestedMaxAllowedUnitPriceNis,
  maxTotalPriceNis: payload.suggestedMaxAllowedTotalPriceNis,
  aliases: payload.suggestedAliases,
  confidence: payload.confidence,
  reasoning: payload.reasoning,
  resultJson,
  logId,
});

const mapStoredLogToResult = (
  log: NonNullable<Awaited<ReturnType<typeof findRecentSuccessfulAiLookupLog>>>,
): AiPriceSuggestionResult => {
  const resultJson =
    log.resultJson && typeof log.resultJson === 'object' && !Array.isArray(log.resultJson)
      ? (log.resultJson as Record<string, unknown>)
      : null;

  const provider =
    resultJson?.provider === 'gemini' || resultJson?.provider === 'mock'
      ? (resultJson.provider as 'gemini' | 'mock')
      : null;

  if (log.status === 'SUCCESS' && resultJson?.suggestion) {
    const suggestion = resultJson.suggestion as AiPriceSuggestionPayload;
    return {
      status: 'REUSED',
      aiProvider: provider,
      unit: suggestion.suggestedUnit ?? null,
      maxUnitPriceNis: suggestion.suggestedMaxAllowedUnitPriceNis ?? null,
      maxTotalPriceNis: suggestion.suggestedMaxAllowedTotalPriceNis ?? null,
      aliases: suggestion.suggestedAliases ?? [],
      confidence: suggestion.confidence ?? null,
      reasoning: suggestion.reasoning ?? null,
      resultJson,
      logId: log.id,
    };
  }

  return {
    status: 'REUSED',
    aiProvider: provider,
    unit: null,
    maxUnitPriceNis: null,
    maxTotalPriceNis: null,
    aliases: [],
    confidence: null,
    reasoning: null,
    resultJson,
    logId: log.id,
  };
};

const parseValidatedPayload = (validated: z.infer<typeof aiResponseSchema>): AiPriceSuggestionPayload => ({
  suggestedMaterialNameEn: validated.suggestedMaterialNameEn,
  suggestedMaterialNameAr: validated.suggestedMaterialNameAr ?? null,
  suggestedCategoryName: validated.suggestedCategoryName,
  suggestedAliases: validated.suggestedAliases,
  suggestedUnit: validated.suggestedUnit,
  suggestedMaxAllowedUnitPriceNis: validated.suggestedMaxAllowedUnitPriceNis,
  suggestedMaxAllowedTotalPriceNis:
    validated.suggestedMaxAllowedTotalPriceNis ?? null,
  confidence: validated.confidence,
  reasoning: validated.reasoning,
  safetyNote: validated.safetyNote,
});

const getSkipReason = (provider: AiProviderName): string => {
  switch (provider) {
    case 'disabled':
      return 'AI disabled';
    case 'gemini':
      return 'Gemini provider not configured';
    default:
      return 'AI provider not configured';
  }
};

const logSkipDecision = (provider: AiProviderName, lookupKey: string, reason: string) => {
  if (env.nodeEnv === 'production') {
    return;
  }

  const debug = getAiPriceSuggestionDebugInfo();
  console.log('[AI price suggestion skipped]', {
    provider,
    reason,
    featureEnabled: debug.operational,
    geminiKeyConfigured: debug.geminiApiKeyConfigured,
    geminiModel: debug.geminiModel,
    lookupKey,
  });
};

const runMockProvider = (input: AiPriceSuggestionInput) => {
  const mock = generateMockPriceSuggestion(input);
  const validated = aiResponseSchema.parse({
    provider: 'mock',
    ...mock.payload,
  });
  const payload = parseValidatedPayload(validated);
  return {
    payload,
    resultJson: {
      ...mock.resultJson,
      suggestion: payload,
    },
  };
};

const runGeminiProvider = async (input: AiPriceSuggestionInput) => {
  const gemini = await callGeminiForPriceSuggestion(input);
  const validated = aiResponseSchema.parse(gemini.parsed);
  const payload = parseValidatedPayload(validated);
  return {
    payload,
    resultJson: {
      ...gemini.resultJson,
      suggestion: payload,
      safetyNote: payload.safetyNote,
    },
    model: gemini.model,
  };
};

export const suggestPriceReferenceForReview = async (
  input: AiPriceSuggestionInput,
): Promise<AiPriceSuggestionResult> => {
  const normalizedQuery = normalizeSearchText(input.lookupKey);
  const provider = env.aiProvider;

  const recentLog = await findRecentSuccessfulAiLookupLog(normalizedQuery);
  if (recentLog) {
    return mapStoredLogToResult(recentLog);
  }

  if (provider === 'disabled' || !isAiProviderOperational()) {
    const reason = getSkipReason(provider);
    logSkipDecision(provider, input.lookupKey, reason);

    const skipped = buildSkippedResult(
      input.lookupKey,
      normalizedQuery,
      reason,
      provider === 'disabled' ? 'disabled' : provider,
    );
    const log = await createAiPriceLookupLog({
      query: input.lookupKey,
      normalizedQuery,
      status: 'SKIPPED',
      resultJson: skipped.resultJson,
    });

    return { ...skipped, logId: log.id };
  }

  try {
    if (provider === 'mock') {
      const mockResult = runMockProvider(input);
      const log = await createAiPriceLookupLog({
        query: input.lookupKey,
        normalizedQuery,
        status: 'SUCCESS',
        resultJson: mockResult.resultJson,
      });

      return mapPayloadToResult(
        mockResult.payload,
        mockResult.resultJson,
        log.id,
        'mock',
      );
    }

    const geminiResult = await runGeminiProvider(input);
    const log = await createAiPriceLookupLog({
      query: input.lookupKey,
      normalizedQuery,
      status: 'SUCCESS',
      resultJson: geminiResult.resultJson,
    });

    return mapPayloadToResult(
      geminiResult.payload,
      geminiResult.resultJson,
      log.id,
      'gemini',
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown AI suggestion error';
    const resultJson = {
      provider,
      model: provider === 'gemini' ? env.geminiModel : 'mock-local',
      error: message,
    };
    const log = await createAiPriceLookupLog({
      query: input.lookupKey,
      normalizedQuery,
      status: 'FAILED',
      resultJson,
    });

    return {
      status: 'FAILED',
      aiProvider: provider === 'mock' ? 'mock' : provider === 'gemini' ? 'gemini' : null,
      unit: null,
      maxUnitPriceNis: null,
      maxTotalPriceNis: null,
      aliases: [],
      confidence: null,
      reasoning: null,
      resultJson,
      logId: log.id,
    };
  }
};

export const buildUnknownMaterialPriceReviewAiInput = (input: {
  materialName: string;
  categoryName: string;
  normalizedMaterialName: string;
  categoryId: string;
  userId: string;
  condition?: string | null;
  quantity?: number | null;
  unit?: string | null;
  supplierPriceNis?: number | null;
}): AiPriceSuggestionInput => ({
  materialName: input.materialName,
  categoryName: input.categoryName,
  condition: input.condition ?? null,
  quantity: input.quantity ?? null,
  unit: input.unit ?? null,
  supplierPriceNis: input.supplierPriceNis ?? null,
  lookupKey: buildUnknownMaterialPriceReviewLookupKey({
    normalizedMaterialName: input.normalizedMaterialName,
    categoryId: input.categoryId,
    userId: input.userId,
    unit: input.unit ?? 'piece',
  }),
});

export const buildPriceRuleReviewAiInput = (input: {
  materialTypeNameEn: string;
  categoryNameEn: string;
  materialTypeId: string;
  condition?: string | null;
  quantity?: number | null;
  unit?: string | null;
  supplierPriceNis?: number | null;
}): AiPriceSuggestionInput => ({
  materialName: input.materialTypeNameEn,
  categoryName: input.categoryNameEn,
  condition: input.condition ?? null,
  quantity: input.quantity ?? null,
  unit: input.unit ?? null,
  supplierPriceNis: input.supplierPriceNis ?? null,
  lookupKey: buildPriceRuleReviewLookupKey(input.materialTypeId),
});

export const buildReviewAiMessage = (
  aiStatus: AiPriceSuggestionResult['status'],
  aiProvider: AiPriceSuggestionResult['aiProvider'],
) => {
  if (aiStatus === 'SUCCESS' || aiStatus === 'REUSED') {
    if (aiProvider === 'gemini') {
      return 'Review request submitted. A Gemini-assisted price suggestion was generated for admin review.';
    }

    if (aiProvider === 'mock') {
      return 'Review request submitted. A demo AI-assisted suggestion was generated for admin review.';
    }

    return 'Review request submitted. A price suggestion will be prepared for admin review. Paid listing will be available after approval.';
  }

  if (aiStatus === 'FAILED') {
    return 'Review request submitted. AI-assisted review could not generate a suggestion, so the admin will review it manually.';
  }

  return 'Review request submitted. AI suggestion is not configured, so the admin will review it manually.';
};

export const buildPriceRuleReviewSuccessMessage = (
  aiStatus: AiPriceSuggestionResult['status'],
  aiProvider: AiPriceSuggestionResult['aiProvider'],
) => {
  if (aiStatus === 'SUCCESS' || aiStatus === 'REUSED') {
    if (aiProvider === 'gemini') {
      return 'Price review submitted. A Gemini-assisted price suggestion was generated for admin review.';
    }

    if (aiProvider === 'mock') {
      return 'Price review submitted. A demo AI-assisted price suggestion was generated for admin review.';
    }
  }

  if (aiStatus === 'FAILED') {
    return 'Price review submitted. AI-assisted review could not generate a suggestion, so the admin will review it manually.';
  }

  return 'Price review submitted. AI suggestion is not configured, so the admin will review it manually.';
};

export const buildAiResultJsonForRequest = (
  requestId: string,
  aiSuggestion: AiPriceSuggestionResult,
) =>
  aiSuggestion.resultJson
    ? {
        ...aiSuggestion.resultJson,
        requestId,
        aiStatus: aiSuggestion.status,
        aiProvider: aiSuggestion.aiProvider,
      }
    : null;

/** @deprecated Use suggestPriceReferenceForReview instead. */
export const suggestPriceRuleForMaterialType = async (input: {
  materialTypeNameEn: string;
  categoryNameEn: string;
  materialTypeId?: string;
}) =>
  suggestPriceReferenceForReview(
    buildPriceRuleReviewAiInput({
      materialTypeNameEn: input.materialTypeNameEn,
      categoryNameEn: input.categoryNameEn,
      materialTypeId: input.materialTypeId ?? input.materialTypeNameEn,
    }),
  );
