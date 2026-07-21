import { env, isAiChatProviderOperational } from '../../config/env.js';
import type {
  AiConversation,
  AiMessage,
  AiScopeClassification,
} from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { logger } from '../../observability/logger.js';

import {
  buildBoundedConversationHistory,
  deriveConversationPreview,
  deriveConversationTitle,
  parseStoredContentBlocks,
} from './ai-context-builder.js';
import type { AiContentBlock } from './ai.content-blocks.js';
import { aiContentBlocksSchema } from './ai.content-blocks.js';
import {
  buildConversationalResponseText,
  detectConversationalIntent,
  detectResponseLocale,
} from './ai-conversational-intent.js';
import {
  executeLearnerAgentPlatformTurn,
} from './agent/ai-agent-turn.service.js';
import {
  AI_DISABLED_COPY,
  CLARIFICATION_COPY,
  GENERAL_LEARNING_POLICY_VERSION,
  REFUSAL_COPY,
} from './ai.policy.js';
import { DANGEROUS_SAFETY_COPY } from './agent/ai-agent-safety-guard.service.js';
import {
  classifyScopeDeterministic,
  mergeClassifierResult,
  shouldSkipAnswerProvider,
  shouldUseAnswerProvider,
} from './ai-scope-guard.js';
import {
  acquireConversationProcessingLock,
  createAssistantMessage,
  createUserMessage,
  deleteAssistantMessage,
  findAssistantReplyToUserMessage,
  findUserMessageByClientId,
  loadRecentConversationMessages,
  releaseConversationProcessingLock,
  touchConversationActivity,
} from './ai.repository.js';
import { getAiChatProvider } from './providers/ai-chat-provider.factory.js';
import type { AiLocale, AiTurnResponse } from './ai.types.js';

const textBlock = (
  text: string,
  purpose: 'answer' | 'refusal' | 'clarification' | 'safety' = 'answer',
): AiContentBlock => ({
  type: 'text',
  text,
  purpose,
});

const errorBlock = (
  code: string,
  message: string,
  retryable: boolean,
): AiContentBlock => ({
  type: 'error',
  code,
  message,
  retryable,
});

const assertProviderOperational = (responseLocale: AiLocale): void => {
  if (!isAiChatProviderOperational()) {
    throw new AppError(
      AI_DISABLED_COPY[responseLocale],
      503,
      'AI_DISABLED',
    );
  }
};

const resolveScope = async (
  userMessage: string,
  responseLocale: AiLocale,
): Promise<{
  classification: AiScopeClassification;
  confidence: number;
  usedClassifier: boolean;
}> => {
  const deterministic = classifyScopeDeterministic(userMessage);

  if (
    deterministic.confidence >= 0.85 &&
    deterministic.classification !== 'UNCLEAR'
  ) {
    return {
      classification: deterministic.classification,
      confidence: deterministic.confidence,
      usedClassifier: false,
    };
  }

  if (!isAiChatProviderOperational()) {
    return {
      classification: deterministic.classification,
      confidence: deterministic.confidence,
      usedClassifier: false,
    };
  }

  const provider = getAiChatProvider();
  const classified = await provider.classifyScope({
    locale: responseLocale,
    userMessage,
  });

  const merged = mergeClassifierResult(
    deterministic,
    classified.data,
    env.aiChatClassifierConfidenceThreshold,
  );

  return {
    classification: merged.classification,
    confidence: merged.confidence,
    usedClassifier: merged.usedClassifier,
  };
};

const mapTurnResponse = (input: {
  conversation: AiConversation;
  userMessage: AiMessage;
  assistantMessage: AiMessage | null;
  blocks: AiContentBlock[];
  classification: AiScopeClassification;
  locale: AiLocale;
}): AiTurnResponse => ({
  conversationId: input.conversation.id,
  userMessageId: input.userMessage.id,
  assistantMessageId: input.assistantMessage?.id ?? null,
  mode: 'LEARNER_ASSISTANT',
  locale: input.locale,
  contentBlocks: input.blocks,
  meta: {
    provider: input.assistantMessage?.provider ?? 'system',
    model: input.assistantMessage?.model ?? null,
    policyVersion:
      input.assistantMessage?.policyVersion ?? GENERAL_LEARNING_POLICY_VERSION,
    scopeClassification: input.classification,
    latencyMs: input.assistantMessage?.latencyMs ?? null,
    usage: {
      inputTokens: input.assistantMessage?.inputTokens ?? null,
      outputTokens: input.assistantMessage?.outputTokens ?? null,
    },
  },
});

export const processGeneralLearningTurn = async (input: {
  conversation: AiConversation;
  text: string;
  locale: AiLocale;
  clientMessageId: string;
}): Promise<AiTurnResponse> => {
  if (input.conversation.mode !== 'GENERAL_LEARNING') {
    throw new AppError('Unsupported conversation mode.', 400, 'VALIDATION_ERROR');
  }

  if (input.conversation.status !== 'ACTIVE') {
    throw new AppError(
      'This conversation is archived.',
      409,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  const existingUserMessage = await findUserMessageByClientId({
    conversationId: input.conversation.id,
    clientMessageId: input.clientMessageId,
  });

  if (existingUserMessage) {
    const existingAssistant = await findAssistantReplyToUserMessage(
      existingUserMessage.id,
    );

    if (
      existingAssistant &&
      ['COMPLETED', 'REFUSED'].includes(existingAssistant.status)
    ) {
      return mapTurnResponse({
        conversation: input.conversation,
        userMessage: existingUserMessage,
        assistantMessage: existingAssistant,
        blocks: parseStoredContentBlocks(existingAssistant.contentBlocks),
        classification:
          existingAssistant.scopeClassification ?? 'DOMAIN_KNOWLEDGE',
        locale: input.locale,
      });
    }

    if (
      existingAssistant?.status !== 'FAILED' &&
      (existingAssistant?.status === 'PROCESSING' ||
        input.conversation.processingState === 'PROCESSING')
    ) {
      throw new AppError(
        'This conversation is already processing a message.',
        409,
        'AI_CONVERSATION_BUSY',
      );
    }
  }

  const staleBefore = new Date(Date.now() - env.aiChatProcessingStaleMs);
  const lockAcquired = await acquireConversationProcessingLock({
    conversationId: input.conversation.id,
    staleBefore,
  });

  if (!lockAcquired) {
    throw new AppError(
      'This conversation is already processing a message.',
      409,
      'AI_CONVERSATION_BUSY',
    );
  }

  let userMessage = existingUserMessage;

  try {
    if (existingUserMessage) {
      const failedAssistant = await findAssistantReplyToUserMessage(
        existingUserMessage.id,
      );
      if (failedAssistant?.status === 'FAILED') {
        await deleteAssistantMessage(failedAssistant.id);
      }
    }

    if (!userMessage) {
      userMessage = await createUserMessage({
        conversationId: input.conversation.id,
        contentText: input.text,
        clientMessageId: input.clientMessageId,
        locale: input.locale,
      });
    }

    const responseLocale = detectResponseLocale(input.text, input.locale);
    const deterministic = classifyScopeDeterministic(input.text);
    const conversationalIntent = detectConversationalIntent(input.text);

    let blocks: AiContentBlock[] = [];
    let assistantStatus: 'COMPLETED' | 'REFUSED' = 'COMPLETED';
    let scopeClassification = deterministic.classification;
    let providerName = 'system';
    let model: string | null = null;
    let latencyMs: number | null = null;
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let usedClassifier = false;

    if (deterministic.classification === 'OUT_OF_SCOPE') {
      blocks = [textBlock(REFUSAL_COPY[responseLocale])];
      assistantStatus = 'REFUSED';
    } else if (deterministic.classification === 'DANGEROUS_REQUEST') {
      blocks = [textBlock(DANGEROUS_SAFETY_COPY[responseLocale], 'safety')];
      assistantStatus = 'REFUSED';
      scopeClassification = 'DANGEROUS_REQUEST';
    } else if (conversationalIntent !== 'NONE') {
      blocks = [
        textBlock(
          buildConversationalResponseText(conversationalIntent, responseLocale),
        ),
      ];
      scopeClassification = 'UNCLEAR';
    } else {
      const history = buildBoundedConversationHistory(
        await loadRecentConversationMessages({
          conversationId: input.conversation.id,
          limit: env.aiChatMaxHistoryMessages,
        }),
        env.aiChatMaxHistoryMessages,
      );

      const agentResult = await executeLearnerAgentPlatformTurn({
        userMessage: input.text,
        locale: responseLocale,
        conversationId: input.conversation.id,
        authenticatedUserId: input.conversation.userId,
        clientMessageId: input.clientMessageId,
        requestId: null,
        history,
      });

      if (agentResult) {
        blocks = agentResult.blocks;
        providerName = agentResult.providerName;
        model = agentResult.model;
        latencyMs = agentResult.latencyMs;
        inputTokens = agentResult.inputTokens;
        outputTokens = agentResult.outputTokens;
        if (agentResult.route === 'OUT_OF_SCOPE') {
          scopeClassification = 'OUT_OF_SCOPE';
          assistantStatus = 'REFUSED';
        } else if (agentResult.route === 'DANGEROUS_REQUEST') {
          scopeClassification = 'DANGEROUS_REQUEST';
          assistantStatus = 'REFUSED';
        } else {
          scopeClassification = 'DOMAIN_KNOWLEDGE';
        }
      } else if (
        deterministic.classification === 'DOMAIN_KNOWLEDGE' ||
        deterministic.classification === 'MIXED'
      ) {
        assertProviderOperational(responseLocale);

        const provider = getAiChatProvider();
        const answer = await provider.generateGeneralLearningAnswer({
          locale: responseLocale,
          userMessage: input.text,
          history,
          scopeClassification: deterministic.classification,
        });

        blocks = answer.data.blocks;
        providerName = answer.provider;
        model = answer.model;
        latencyMs = answer.latencyMs;
        inputTokens = answer.usage.inputTokens;
        outputTokens = answer.usage.outputTokens;
      } else {
        const scope = await resolveScope(input.text, responseLocale);
        scopeClassification = scope.classification;
        usedClassifier = scope.usedClassifier;

        if (shouldSkipAnswerProvider(scope.classification)) {
          blocks = [textBlock(REFUSAL_COPY[responseLocale])];
          assistantStatus = 'REFUSED';
        } else if (scope.classification === 'UNCLEAR') {
          blocks = [textBlock(CLARIFICATION_COPY[responseLocale])];
        } else if (shouldUseAnswerProvider(scope.classification)) {
          assertProviderOperational(responseLocale);

          const provider = getAiChatProvider();
          const answer = await provider.generateGeneralLearningAnswer({
            locale: responseLocale,
            userMessage: input.text,
            history,
            scopeClassification: scope.classification,
          });

          blocks = answer.data.blocks;
          providerName = answer.provider;
          model = answer.model;
          latencyMs = answer.latencyMs;
          inputTokens = answer.usage.inputTokens;
          outputTokens = answer.usage.outputTokens;

          if (scope.classification === 'DANGEROUS_REQUEST') {
            assistantStatus = 'REFUSED';
          }
        } else {
          blocks = [textBlock(CLARIFICATION_COPY[responseLocale])];
          scopeClassification = 'UNCLEAR';
        }
      }
    }

    const validatedBlocks = aiContentBlocksSchema.parse(blocks);

    const assistantMessage = await createAssistantMessage({
      conversationId: input.conversation.id,
      inReplyToMessageId: userMessage.id,
      status: assistantStatus,
      contentBlocks: validatedBlocks,
      scopeClassification,
      locale: responseLocale,
      provider: providerName,
      model,
      policyVersion: GENERAL_LEARNING_POLICY_VERSION,
      latencyMs,
      inputTokens,
      outputTokens,
    });

    const title =
      input.conversation.title ??
      deriveConversationTitle(input.text);

    await touchConversationActivity({
      conversationId: input.conversation.id,
      locale: input.locale,
      title,
    });

    logger.info(
      {
        conversationId: input.conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId: assistantMessage.id,
        scopeClassification,
        provider: providerName,
        model,
        latencyMs,
        usedClassifier,
        conversationalIntent:
          conversationalIntent === 'NONE' ? null : conversationalIntent,
      },
      'general learning turn completed',
    );

    return mapTurnResponse({
      conversation: input.conversation,
      userMessage,
      assistantMessage,
      blocks: validatedBlocks,
      classification: scopeClassification,
      locale: responseLocale,
    });
  } catch (error) {
    const responseLocale = detectResponseLocale(input.text, input.locale);

    if (error instanceof AppError) {
      const failureDetails =
        typeof error.details === 'object' && error.details !== null
          ? (error.details as {
              model?: string;
              retryDelayMs?: number;
              quotaMetric?: string;
              quotaId?: string;
              quotaValue?: string;
            })
          : undefined;

      if (
        error.code === 'AI_PROVIDER_QUOTA_EXCEEDED' ||
        failureDetails?.retryDelayMs
      ) {
        logger.warn(
          {
            conversationId: input.conversation.id,
            errorCode: error.code,
            model: failureDetails?.model,
            quotaMetric: failureDetails?.quotaMetric,
            quotaId: failureDetails?.quotaId,
            quotaValue: failureDetails?.quotaValue,
            retryDelayMs: failureDetails?.retryDelayMs,
          },
          'AI chat provider quota or rate limit reached; user may retry later',
        );
      }
    }

    if (userMessage) {
      const existingAssistant = await findAssistantReplyToUserMessage(
        userMessage.id,
      );

      if (!existingAssistant) {
        const message =
          error instanceof AppError
            ? error.message
            : 'The learning assistant failed to respond.';

        const code =
          error instanceof AppError ? error.code : 'AI_PROVIDER_ERROR';

        await createAssistantMessage({
          conversationId: input.conversation.id,
          inReplyToMessageId: userMessage.id,
          status: 'FAILED',
          contentBlocks: [
            errorBlock(
              code,
              message,
              code === 'AI_PROVIDER_TIMEOUT' ||
                code === 'AI_PROVIDER_ERROR' ||
                code === 'AI_PROVIDER_QUOTA_EXCEEDED' ||
                code === 'AI_RESPONSE_INVALID',
            ),
          ],
          scopeClassification: 'UNCLEAR',
          locale: responseLocale,
          provider: 'system',
          model: null,
          policyVersion: GENERAL_LEARNING_POLICY_VERSION,
          latencyMs: null,
          inputTokens: null,
          outputTokens: null,
          errorCode: code,
        });
      }
    }

    throw error;
  } finally {
    await releaseConversationProcessingLock(input.conversation.id);
  }
};

export const buildMessagePreviewFromBlocks = deriveConversationPreview;
