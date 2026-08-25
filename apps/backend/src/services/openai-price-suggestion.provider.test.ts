import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

process.env.AI_CHAT_PROVIDER = 'openai';
process.env.AI_CHAT_MODEL = 'openai/gpt-4.1-nano';
process.env.OPENAI_API_KEY = `sk-or-v1-${'a'.repeat(48)}`;
process.env.OPENAI_BASE_URL = 'https://openrouter.ai/api/v1';
process.env.OPENAI_JSON_MODE = 'false';

const {
  callOpenAiForPriceSuggestion,
  setOpenAiPriceClientFactoryForTests,
} = await import('./openai-price-suggestion.provider.js');

afterEach(() => {
  setOpenAiPriceClientFactoryForTests(null);
});

test('maps an OpenRouter-compatible JSON completion into the raw price contract', async () => {
  setOpenAiPriceClientFactoryForTests(() => ({
    chat: {
      completions: {
        create: async () => ({
          model: 'openai/gpt-4.1-nano',
          choices: [
            {
              message: {
                content: JSON.stringify({
                  provider: 'openai',
                  suggestedMaterialNameEn: 'Arduino Uno',
                  suggestedMaterialNameAr: 'أردوينو أونو',
                  suggestedCategoryName: 'Electronics',
                  suggestedAliases: ['arduino uno'],
                  suggestedUnit: 'piece',
                  suggestedMaxAllowedUnitPriceNis: 55,
                  suggestedMaxAllowedTotalPriceNis: 55,
                  confidence: 'MEDIUM',
                  reasoning: 'Reference estimate for admin review.',
                  safetyNote: 'Admin review is required.',
                }),
              },
            },
          ],
        }),
      },
    },
  }));

  const result = await callOpenAiForPriceSuggestion({
    materialName: 'Arduino Uno',
    categoryName: 'Electronics',
    lookupKey: 'arduino-uno-price-test',
  });

  assert.equal(result.model, 'openai/gpt-4.1-nano');
  assert.deepEqual(result.parsed, {
    provider: 'openai',
    suggestedMaterialNameEn: 'Arduino Uno',
    suggestedMaterialNameAr: 'أردوينو أونو',
    suggestedCategoryName: 'Electronics',
    suggestedAliases: ['arduino uno'],
    suggestedUnit: 'piece',
    suggestedMaxAllowedUnitPriceNis: 55,
    suggestedMaxAllowedTotalPriceNis: 55,
    confidence: 'MEDIUM',
    reasoning: 'Reference estimate for admin review.',
    safetyNote: 'Admin review is required.',
  });
  assert.equal(result.resultJson.provider, 'openai');
});
