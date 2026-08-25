import OpenAI from 'openai';

import { getAiChatRuntimeConfig } from '../config/env.js';

import { extractJsonObject } from './gemini-price-suggestion.provider.js';
import type { AiPriceSuggestionInput } from './ai-price-suggestion.types.js';

export type OpenAiRawSuggestionResult = {
  parsed: unknown;
  resultJson: Record<string, unknown>;
  model: string;
};

type OpenAiPriceCompletion = {
  model?: string | null;
  choices: Array<{ message: { content: string | null } }>;
};

export type OpenAiPriceClient = {
  chat: {
    completions: {
      create: (
        ...args: Parameters<OpenAI['chat']['completions']['create']>
      ) => Promise<OpenAiPriceCompletion>;
    };
  };
};

let clientFactoryOverride: (() => OpenAiPriceClient) | null = null;

export const setOpenAiPriceClientFactoryForTests = (
  factory: (() => OpenAiPriceClient) | null,
) => {
  clientFactoryOverride = factory;
};

const buildPrompt = (input: AiPriceSuggestionInput): string => {
  const structuredInput = {
    materialName: input.materialName,
    categoryName: input.categoryName,
    condition: input.condition ?? null,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    supplierPriceNis: input.supplierPriceNis ?? null,
    country: input.country ?? 'Palestine',
    currency: input.currency ?? 'NIS',
    platformContext:
      input.platformContext ?? 'student surplus/reuse marketplace',
  };

  return [
    'You assist admin review for a student surplus/reuse marketplace in Palestine.',
    'Return strict JSON only with this exact shape:',
    JSON.stringify(
      {
        provider: 'openai',
        suggestedMaterialNameEn: 'Wax Melting Spoon',
        suggestedMaterialNameAr: 'ملعقة إذابة الشمع',
        suggestedCategoryName: 'Art, Craft & Molding',
        suggestedAliases: [
          'wax melting spoon',
          'candle wax spoon',
          'ملعقة إذابة الشمع',
        ],
        suggestedUnit: 'piece',
        suggestedMaxAllowedUnitPriceNis: 20,
        suggestedMaxAllowedTotalPriceNis: 20,
        confidence: 'MEDIUM',
        reasoning: 'Short explanation for admin review.',
        safetyNote:
          'This is an AI estimate and must be reviewed before activation.',
      },
      null,
      2,
    ),
    'Rules:',
    '- Use NIS only.',
    '- suggestedMaxAllowedUnitPriceNis must be > 0.',
    '- confidence must be LOW, MEDIUM, or HIGH.',
    '- Include Arabic name/aliases when helpful.',
    '- Do not approve anything automatically.',
    'Input:',
    JSON.stringify(structuredInput, null, 2),
  ].join('\n\n');
};

export const callOpenAiForPriceSuggestion = async (
  input: AiPriceSuggestionInput,
): Promise<OpenAiRawSuggestionResult> => {
  const runtime = getAiChatRuntimeConfig();
  if (!runtime.openaiApiKey) {
    throw new Error('OpenAI-compatible provider not configured');
  }

  const client =
    clientFactoryOverride?.() ??
    new OpenAI({
      apiKey: runtime.openaiApiKey,
      ...(runtime.openaiBaseUrl ? { baseURL: runtime.openaiBaseUrl } : {}),
    });

  const response = await client.chat.completions.create(
    {
      model: runtime.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a careful pricing assistant for admin review. Respond with valid JSON only.',
        },
        { role: 'user', content: buildPrompt(input) },
      ],
      temperature: 0.2,
      max_tokens: Math.min(runtime.maxOutputTokens, 1_024),
      ...(runtime.openaiJsonMode
        ? { response_format: { type: 'json_object' as const } }
        : {}),
    },
    { signal: AbortSignal.timeout(runtime.timeoutMs) },
  );

  const content = response.choices[0]?.message.content?.trim();
  if (!content) {
    throw new Error('OpenAI-compatible provider returned empty content');
  }

  const parsed = extractJsonObject(content);
  const model = response.model ?? runtime.model;
  const resultJson: Record<string, unknown> = {
    provider: 'openai',
    model,
    input: {
      materialName: input.materialName,
      categoryName: input.categoryName,
      condition: input.condition ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      supplierPriceNis: input.supplierPriceNis ?? null,
    },
    rawResponse: parsed,
  };

  return { parsed, resultJson, model };
};
