import type {
  AiProviderAnswer,
  AiScopeClassifierResult,
} from '../ai.content-blocks.js';
import type { AiLocale, BoundedHistoryMessage } from '../ai.types.js';

export type AiChatProviderUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
};

export type AiChatProviderResult<T> = {
  provider: string;
  model: string | null;
  data: T;
  usage: AiChatProviderUsage;
  latencyMs: number;
};

export type AiChatGenerateAnswerInput = {
  locale: AiLocale;
  userMessage: string;
  history: BoundedHistoryMessage[];
  scopeClassification: string;
};

export type AiChatClassifyScopeInput = {
  locale: AiLocale;
  userMessage: string;
};

export interface AiChatProvider {
  readonly name: string;
  classifyScope(
    input: AiChatClassifyScopeInput,
  ): Promise<AiChatProviderResult<AiScopeClassifierResult>>;
  generateGeneralLearningAnswer(
    input: AiChatGenerateAnswerInput,
  ): Promise<AiChatProviderResult<AiProviderAnswer>>;
}
