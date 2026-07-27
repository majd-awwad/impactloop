import { AppError } from '../../../utils/app-error.js';
import { logger } from '../../../observability/logger.js';

import { AI_AGENT_LIMITS, type AiToolExecutionContext } from './ai-agent.types.js';
import type { AiToolCallRequest, AiToolCallResult } from './ai-tool.types.js';
import { getRegisteredTool, isRegisteredToolName } from './ai-tool-registry.js';

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  toolName: string,
): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new AppError(
              'The assistant tool timed out.',
              504,
              'AI_TOOL_EXECUTION_FAILED',
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export class AiToolExecutor {
  private readCalls = 0;

  reset(): void {
    this.readCalls = 0;
  }

  async execute(
    request: AiToolCallRequest,
    context: AiToolExecutionContext,
  ): Promise<AiToolCallResult> {
    const startedAt = Date.now();

    if (!isRegisteredToolName(request.name)) {
      return {
        name: request.name,
        ok: false,
        errorCode: 'AI_TOOL_NOT_ALLOWED',
        errorMessage: 'Tool is not registered.',
        durationMs: Date.now() - startedAt,
      };
    }

    const tool = getRegisteredTool(request.name);
    if (!tool) {
      return {
        name: request.name,
        ok: false,
        errorCode: 'AI_TOOL_NOT_ALLOWED',
        errorMessage: 'Tool is not registered.',
        durationMs: Date.now() - startedAt,
      };
    }

    if (tool.kind === 'read') {
      if (this.readCalls >= AI_AGENT_LIMITS.maxReadToolCalls) {
        return {
          name: request.name,
          ok: false,
          errorCode: 'AI_TOOL_NOT_ALLOWED',
          errorMessage: 'Read tool call limit reached for this turn.',
          durationMs: Date.now() - startedAt,
        };
      }

      this.readCalls += 1;
    }

    try {
      const parsedInput = tool.inputSchema.parse(request.input ?? {});
      const data = await withTimeout(
        tool.handler(parsedInput, context),
        tool.timeoutMs,
        tool.name,
      );

      const serialized = JSON.stringify(data ?? null);
      if (serialized.length > tool.maxOutputBytes) {
        throw new AppError(
          'Tool result exceeded the allowed size.',
          502,
          'AI_TOOL_RESULT_INVALID',
        );
      }

      logger.info(
        {
          requestId: context.requestId ?? undefined,
          conversationId: context.conversationId,
          toolName: tool.name,
          toolKind: tool.kind,
          durationMs: Date.now() - startedAt,
          resultBytes: serialized.length,
        },
        'AI learner agent tool executed',
      );

      return {
        name: tool.name,
        ok: true,
        data,
        durationMs: Date.now() - startedAt,
      };
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              'The assistant tool failed.',
              502,
              'AI_TOOL_EXECUTION_FAILED',
            );

      logger.warn(
        {
          requestId: context.requestId ?? undefined,
          conversationId: context.conversationId,
          toolName: tool.name,
          errorCode: appError.code,
          durationMs: Date.now() - startedAt,
        },
        'AI learner agent tool failed',
      );

      return {
        name: tool.name,
        ok: false,
        errorCode: appError.code,
        errorMessage: appError.message,
        durationMs: Date.now() - startedAt,
      };
    }
  }
}
