import { GoogleGenAI } from '@google/genai';

import { env } from '../config/env.js';

import type { AiPriceSuggestionInput } from './ai-price-suggestion.types.js';

export type GeminiRawSuggestionResult = {
  parsed: unknown;
  resultJson: Record<string, unknown>;
  model: string;
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
        provider: 'gemini',
        suggestedMaterialNameEn: 'Wax Melting Spoon',
        suggestedMaterialNameAr: 'ملعقة إذابة الشمع',
        suggestedCategoryName: 'Art, Craft & Molding',
        suggestedAliases: ['wax melting spoon', 'candle wax spoon', 'ملعقة إذابة الشمع'],
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

export const extractJsonObject = (content: string): unknown => {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  return JSON.parse(candidate);
};

export const callGeminiForPriceSuggestion = async (
  input: AiPriceSuggestionInput,
): Promise<GeminiRawSuggestionResult> => {
  if (!env.geminiApiKey) {
    throw new Error('Gemini provider not configured');
  }

  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });
  const prompt = buildPrompt(input);

  const response = await ai.models.generateContent({
    model: env.geminiModel,
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: 'application/json',
      systemInstruction:
        'You are a careful pricing assistant for admin review. Respond with valid JSON only.',
    },
  });

  const content = response.text?.trim();
  if (!content) {
    throw new Error('Gemini returned empty content');
  }

  const parsed = extractJsonObject(content);
  const model = response.modelVersion ?? env.geminiModel;
  const resultJson: Record<string, unknown> = {
    provider: 'gemini',
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
