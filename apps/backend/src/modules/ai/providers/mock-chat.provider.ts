import { createHash } from 'node:crypto';

import {
  aiProviderAnswerSchema,
  aiScopeClassifierSchema,
} from '../ai.content-blocks.js';
import { GENERAL_LEARNING_SYSTEM_POLICY } from '../ai.policy.js';
import {
  classifyScopeDeterministic,
  mergeClassifierResult,
} from '../ai-scope-guard.js';
import type {
  AiChatClassifyScopeInput,
  AiChatGenerateAnswerInput,
  AiChatProvider,
  AiChatProviderResult,
} from './ai-chat-provider.types.js';

const hashSeed = (value: string) =>
  createHash('sha256').update(value).digest('hex').slice(0, 12);

const mockUsage = () => ({
  inputTokens: 120,
  outputTokens: 80,
});

export class MockAiChatProvider implements AiChatProvider {
  readonly name = 'mock';

  async classifyScope(
    input: AiChatClassifyScopeInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiScopeClassifierSchema.parse>>> {
    const deterministic = classifyScopeDeterministic(input.userMessage);
    const data =
      deterministic.classification === 'UNCLEAR'
        ? aiScopeClassifierSchema.parse({
            classification: 'DOMAIN_KNOWLEDGE',
            confidence: 0.72,
            reason: 'Mock classifier default for unclear practical-learning prompts.',
          })
        : aiScopeClassifierSchema.parse({
            classification: deterministic.classification,
            confidence: deterministic.confidence,
            reason: `Mock classifier matched ${deterministic.matchedRules.join(',') || 'none'}.`,
          });

    return {
      provider: this.name,
      model: 'mock-general-learning',
      data,
      usage: mockUsage(),
      latencyMs: 5,
    };
  }

  async generateGeneralLearningAnswer(
    input: AiChatGenerateAnswerInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiProviderAnswerSchema.parse>>> {
    const seed = hashSeed(
      `${input.locale}:${input.scopeClassification}:${input.userMessage}`,
    );
    const isArabic = input.locale === 'ar';

    if (input.scopeClassification === 'OUT_OF_SCOPE') {
      return {
        provider: this.name,
        model: 'mock-general-learning',
        data: aiProviderAnswerSchema.parse({
          blocks: [
            {
              type: 'text',
              purpose: 'refusal',
              text: isArabic
                ? 'هذا السؤال خارج نطاق مساعد التعلم العملي في ImpactLoop.'
                : 'This question is outside the ImpactLoop practical learning assistant scope.',
            },
          ],
        }),
        usage: mockUsage(),
        latencyMs: 8,
      };
    }

    if (input.scopeClassification === 'DANGEROUS_REQUEST') {
      return {
        provider: this.name,
        model: 'mock-general-learning',
        data: aiProviderAnswerSchema.parse({
          blocks: [
            {
              type: 'text',
              purpose: 'safety',
              text: isArabic
                ? 'لا يمكنني تقديم خطوات خطرة. استخدم مصدر طاقة مناسبًا، وقاطعًا، وعزلًا، واطلب مساعدة مختص إذا لزم الأمر.'
                : 'I cannot provide dangerous wiring steps. Use an appropriate power supply, fusing, isolation, and qualified help when needed.',
            },
          ],
        }),
        usage: mockUsage(),
        latencyMs: 8,
      };
    }

    if (input.scopeClassification === 'MIXED') {
      return {
        provider: this.name,
        model: 'mock-general-learning',
        data: aiProviderAnswerSchema.parse({
          blocks: [
            {
              type: 'text',
              purpose: 'answer',
              text: isArabic
                ? 'Breadboard يسمح بتوصيل المكونات بدون لحام. [mock answer]'
                : 'A breadboard lets you prototype circuits without soldering. [mock answer]',
            },
            {
              type: 'text',
              purpose: 'refusal',
              text: isArabic
                ? 'لا يمكنني مساعدتك في أسعار العملات.'
                : 'I cannot help with exchange rates.',
            },
          ],
        }),
        usage: mockUsage(),
        latencyMs: 10,
      };
    }

    return {
      provider: this.name,
      model: 'mock-general-learning',
      data: aiProviderAnswerSchema.parse({
        blocks: [
          {
            type: 'text',
            purpose: 'answer',
            text: isArabic
              ? `إجابة تعليمية تجريبية (${seed}) حول "${input.userMessage.slice(0, 80)}".`
              : `Mock educational answer (${seed}) about "${input.userMessage.slice(0, 80)}".`,
          },
        ],
      }),
      usage: mockUsage(),
      latencyMs: 10,
    };
  }
}

export const createMockClassifierMerge = (
  userMessage: string,
  confidenceThreshold: number,
) => {
  const deterministic = classifyScopeDeterministic(userMessage);
  const mock = new MockAiChatProvider();
  return mock
    .classifyScope({ locale: 'en', userMessage })
    .then((result) =>
      mergeClassifierResult(
        deterministic,
        result.data,
        confidenceThreshold,
      ),
    );
};

export const MOCK_GENERAL_LEARNING_POLICY = GENERAL_LEARNING_SYSTEM_POLICY;
