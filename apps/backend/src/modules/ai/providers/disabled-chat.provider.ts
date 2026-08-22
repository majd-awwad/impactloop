import { AppError } from '../../../utils/app-error.js';
import {
  aiProviderAnswerSchema,
  aiScopeClassifierSchema,
} from '../ai.content-blocks.js';
import type {
  AiChatClassifyScopeInput,
  AiChatGenerateAnswerInput,
  AiChatProvider,
  AiChatProviderResult,
} from './ai-chat-provider.types.js';

export class DisabledAiChatProvider implements AiChatProvider {
  readonly name = 'disabled';
  readonly supportsImageInputs = false;

  private throwDisabled(): never {
    throw new AppError(
      'The learning assistant is temporarily unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  async classifyScope(
    _input: AiChatClassifyScopeInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiScopeClassifierSchema.parse>>> {
    this.throwDisabled();
  }

  async generateGeneralLearningAnswer(
    _input: AiChatGenerateAnswerInput,
  ): Promise<AiChatProviderResult<ReturnType<typeof aiProviderAnswerSchema.parse>>> {
    this.throwDisabled();
  }
}
