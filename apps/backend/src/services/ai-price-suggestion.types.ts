export type AiSuggestionConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

export type AiPriceSuggestionPayload = {
  suggestedMaterialNameEn: string;
  suggestedMaterialNameAr: string | null;
  suggestedCategoryName: string;
  suggestedAliases: string[];
  suggestedUnit: string;
  suggestedMaxAllowedUnitPriceNis: number;
  suggestedMaxAllowedTotalPriceNis: number | null;
  confidence: AiSuggestionConfidence;
  reasoning: string;
  safetyNote: string;
};

export type AiPriceSuggestionResult = {
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'REUSED';
  aiProvider: 'gemini' | 'mock' | 'disabled' | null;
  unit: string | null;
  maxUnitPriceNis: number | null;
  maxTotalPriceNis: number | null;
  aliases: string[];
  confidence: AiSuggestionConfidence | null;
  reasoning: string | null;
  resultJson: Record<string, unknown> | null;
  logId: string | null;
};

export type AiPriceSuggestionInput = {
  materialName: string;
  categoryName: string;
  condition?: string | null;
  quantity?: number | null;
  unit?: string | null;
  supplierPriceNis?: number | null;
  country?: string;
  currency?: string;
  platformContext?: string;
  lookupKey: string;
};
