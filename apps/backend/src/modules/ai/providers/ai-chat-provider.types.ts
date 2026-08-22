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

export type AiChatImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export type AiChatImageInput = {
  mimeType: AiChatImageMimeType;
  dataBase64: string;
  sourceLabel: string;
};

export type AiChatStructuredOutput = {
  name: string;
  schema: unknown;
};

export type AiChatGenerateAnswerInput = {
  locale: AiLocale;
  userMessage: string;
  history: BoundedHistoryMessage[];
  scopeClassification: string;
  imageInputs?: AiChatImageInput[];
  structuredOutput?: AiChatStructuredOutput;
  trustedSystemContext?: string;
};

export type AiChatClassifyScopeInput = {
  locale: AiLocale;
  userMessage: string;
};

export interface AiChatProvider {
  readonly name: string;
  /**
   * Whether this configured provider/model can receive AiChatImageInput values.
   * This is deliberately a capability rather than a provider-name check: an
   * OpenAI-compatible endpoint can expose both text-only and vision models.
   */
  readonly supportsImageInputs: boolean;
  classifyScope(
    input: AiChatClassifyScopeInput,
  ): Promise<AiChatProviderResult<AiScopeClassifierResult>>;
  generateGeneralLearningAnswer(
    input: AiChatGenerateAnswerInput,
  ): Promise<AiChatProviderResult<AiProviderAnswer>>;
  classifySemanticUnderstanding?(input: {
    prompt: string;
    locale: AiLocale;
  }): Promise<AiChatProviderResult<unknown>>;
}

export const providerSupportsSemanticUnderstanding = (
  provider: AiChatProvider,
): provider is AiChatProvider & {
  classifySemanticUnderstanding: NonNullable<
    AiChatProvider['classifySemanticUnderstanding']
  >;
} => typeof provider.classifySemanticUnderstanding === 'function';
