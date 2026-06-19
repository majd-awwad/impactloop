import type { AiPriceSuggestionInput, AiPriceSuggestionPayload } from './ai-price-suggestion.types.js';

export type MockSuggestionResult = {
  payload: AiPriceSuggestionPayload;
  resultJson: Record<string, unknown>;
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const pickConfidence = (hash: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
  const bucket = hash % 3;
  if (bucket === 0) return 'LOW';
  if (bucket === 1) return 'MEDIUM';
  return 'HIGH';
};

const titleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const generateMockPriceSuggestion = (
  input: AiPriceSuggestionInput,
): MockSuggestionResult => {
  const hash = hashString(
    `${input.materialName}:${input.categoryName}:${input.unit ?? 'piece'}`,
  );
  const supplierPrice = input.supplierPriceNis ?? 0;
  const suggestedUnitPrice =
    supplierPrice > 0
      ? Math.max(5, Math.round(supplierPrice * 0.85))
      : 15 + (hash % 40);
  const suggestedTotalPrice = suggestedUnitPrice * Math.max(1, input.quantity ?? 1);
  const nameEn = titleCase(input.materialName);
  const aliases = [
    input.materialName.toLowerCase(),
    nameEn.toLowerCase(),
    `${nameEn.toLowerCase()} surplus`,
  ];

  const payload: AiPriceSuggestionPayload = {
    suggestedMaterialNameEn: nameEn,
    suggestedMaterialNameAr: null,
    suggestedCategoryName: input.categoryName,
    suggestedAliases: [...new Set(aliases)],
    suggestedUnit: input.unit?.trim() || 'piece',
    suggestedMaxAllowedUnitPriceNis: suggestedUnitPrice,
    suggestedMaxAllowedTotalPriceNis: Math.round(suggestedTotalPrice * 100) / 100,
    confidence: pickConfidence(hash),
    reasoning:
      'Demo AI-assisted suggestion generated locally for admin review in development.',
    safetyNote: 'This is an AI estimate and must be reviewed before activation.',
  };

  const resultJson: Record<string, unknown> = {
    provider: 'mock',
    model: 'mock-local',
    input: {
      materialName: input.materialName,
      categoryName: input.categoryName,
      condition: input.condition ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      supplierPriceNis: input.supplierPriceNis ?? null,
    },
    suggestion: payload,
    safetyNote: payload.safetyNote,
  };

  return { payload, resultJson };
};
