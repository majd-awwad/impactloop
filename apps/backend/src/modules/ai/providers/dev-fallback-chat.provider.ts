import { isAiChatDevMockFallbackEnabled } from '../../../config/env.js';
import { logger } from '../../../observability/logger.js';
import { AppError } from '../../../utils/app-error.js';
import type {
  AiChatClassifyScopeInput,
  AiChatGenerateAnswerInput,
  AiChatProvider,
  AiChatProviderResult,
} from './ai-chat-provider.types.js';
import { aiProviderAnswerSchema, aiScopeClassifierSchema } from '../ai.content-blocks.js';

const DEV_FALLBACK_ERROR_CODES = new Set([
  'AI_PROVIDER_QUOTA_EXCEEDED',
  'AI_PROVIDER_MODEL_UNAVAILABLE',
  'AI_PROVIDER_ERROR',
  'AI_PROVIDER_TIMEOUT',
]);

const shouldUseDevFallback = (error: unknown): boolean =>
  isAiChatDevMockFallbackEnabled() &&
  error instanceof AppError &&
  DEV_FALLBACK_ERROR_CODES.has(error.code);

export class DevFallbackAiChatProvider implements AiChatProvider {
  readonly name: string;
  readonly supportsImageInputs: boolean;

  constructor(
    private readonly primary: AiChatProvider,
    private readonly fallback: AiChatProvider,
  ) {
    this.name = `${primary.name}-with-${fallback.name}-fallback`;
    this.supportsImageInputs = primary.supportsImageInputs;
  }

  private async withFallback<T>(
    operation: string,
    run: (provider: AiChatProvider) => Promise<T>,
  ): Promise<T> {
    try {
      return await run(this.primary);
    } catch (error) {
      if (!shouldUseDevFallback(error)) {
        throw error;
      }

      logger.warn(
        {
          operation,
          primaryProvider: this.primary.name,
          fallbackProvider: this.fallback.name,
          errorCode: error instanceof AppError ? error.code : 'unknown',
        },
        'AI chat provider failed in development; falling back to mock provider',
      );

      return run(this.fallback);
    }
  }

  async classifyScope(
    input: AiChatClassifyScopeInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiScopeClassifierSchema.parse>>> {
    return this.withFallback('classify_scope', (provider) =>
      provider.classifyScope(input),
    );
  }

  async generateGeneralLearningAnswer(
    input: AiChatGenerateAnswerInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiProviderAnswerSchema.parse>>> {
    return this.withFallback('generate_answer', (provider) =>
      provider.generateGeneralLearningAnswer(input),
    );
  }
}
