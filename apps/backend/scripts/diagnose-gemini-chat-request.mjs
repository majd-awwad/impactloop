import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url), override: true });

import { GENERAL_LEARNING_SYSTEM_POLICY } from '../src/modules/ai/ai.policy.ts';
import { aiProviderAnswerSchema } from '../src/modules/ai/ai.content-blocks.ts';
import { buildAnswerUserPrompt } from '../src/modules/ai/providers/chat-prompt-builders.ts';
import { extractJsonObject } from '../src/services/gemini-price-suggestion.provider.ts';

const model = process.argv[2] ?? process.env.AI_CHAT_MODEL?.trim() ?? 'gemini-2.0-flash';
const apiKey = process.env.GEMINI_API_KEY?.trim();

const parseSdkError = (error, operation) => {
  if (!(error instanceof Error)) {
    return { operation, model, name: 'UnknownError', safeMessage: String(error) };
  }

  const base = {
    operation,
    model,
    name: error.name,
    safeMessage: error.message.slice(0, 500),
    status: error.status ?? null,
    code: error.code ?? null,
    reason: null,
  };

  try {
    const parsed = JSON.parse(error.message);
    const details = parsed.error?.details ?? [];
    const firstReason = details.find((detail) => typeof detail?.reason === 'string');
    return {
      ...base,
      safeMessage: parsed.error?.message?.slice(0, 500) ?? base.safeMessage,
      status: parsed.error?.code ?? parsed.error?.status ?? base.status,
      code: parsed.error?.status ?? base.code,
      reason: firstReason?.reason ?? null,
    };
  } catch {
    return base;
  }
};

const answerInput = {
  locale: 'en',
  userMessage: 'Explain Arduino Uno simply',
  history: [],
  scopeClassification: 'DOMAIN_KNOWLEDGE',
};

if (!apiKey) {
  console.error('GEMINI_API_KEY missing');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });
const results = { model, envAiChatModel: process.env.AI_CHAT_MODEL ?? null };

try {
  const simple = await ai.models.generateContent({
    model,
    contents: 'Explain Arduino Uno simply in one sentence',
    config: { maxOutputTokens: 80 },
  });
  results.simpleGenerateContent = {
    ok: true,
    modelVersion: simple.modelVersion ?? null,
    textPreview: simple.text?.slice(0, 160) ?? null,
  };
} catch (error) {
  results.simpleGenerateContent = { ok: false, ...parseSdkError(error, 'simpleGenerateContent') };
}

try {
  const appLike = await ai.models.generateContent({
    model,
    contents: buildAnswerUserPrompt(answerInput),
    config: {
      temperature: 0.4,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
      systemInstruction: GENERAL_LEARNING_SYSTEM_POLICY,
    },
  });

  const rawText = appLike.text?.trim() ?? '';
  let parsedJson;
  let validationError = null;

  try {
    parsedJson = extractJsonObject(rawText);
    aiProviderAnswerSchema.parse(parsedJson);
  } catch (error) {
    validationError = {
      name: error?.name ?? 'Error',
      message: error instanceof Error ? error.message.slice(0, 500) : String(error),
    };
  }

  results.applicationGenerateContent = {
    ok: !validationError,
    operation: 'generateGeneralLearningAnswer',
    modelVersion: appLike.modelVersion ?? null,
    rawTextPreview: rawText.slice(0, 400),
    parsedJson,
    validationError,
  };
} catch (error) {
  results.applicationGenerateContent = {
    ok: false,
    ...parseSdkError(error, 'generateGeneralLearningAnswer'),
  };
}

console.log(JSON.stringify(results, null, 2));
