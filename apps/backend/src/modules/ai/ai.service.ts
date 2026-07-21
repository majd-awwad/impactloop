import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';

import {
  buildMessagePreviewFromBlocks,
  processGeneralLearningTurn,
} from './ai-orchestrator.service.js';
import {
  bootstrapProjectAuthoringForUser,
  sendProjectAuthoringMessageForUser,
} from './ai-project-authoring.service.js';
import {
  archiveConversationForUser,
  createConversation,
  findOwnedConversation,
  listConversationsForUser,
  listMessagesForConversation,
  restoreConversationForUser,
} from './ai.repository.js';
import type {
  AiConversationSummary,
  AiLocale,
  AiMessageDto,
  AiTurnResponse,
} from './ai.types.js';
import { parseStoredContentBlocks } from './ai-context-builder.js';
import type { CreateAiConversationInput, SendAiMessageInput } from './ai.validation.js';
import { assertMessageLength } from './ai.rate-limit.js';

const mapConversationSummary = (input: {
  id: string;
  mode: AiConversationSummary['mode'];
  locale: string;
  title: string | null;
  status: AiConversationSummary['status'];
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  preview: string | null;
}): AiConversationSummary => ({
  id: input.id,
  mode: input.mode,
  locale: input.locale,
  title: input.title,
  status: input.status,
  lastMessageAt: input.lastMessageAt?.toISOString() ?? null,
  preview: input.preview,
  createdAt: input.createdAt.toISOString(),
  updatedAt: input.updatedAt.toISOString(),
});

const mapMessageDto = (message: {
  id: string;
  role: AiMessageDto['role'];
  status: AiMessageDto['status'];
  contentText: string | null;
  contentBlocks: unknown;
  scopeClassification: AiMessageDto['scopeClassification'];
  locale: string;
  provider: string | null;
  model: string | null;
  policyVersion: string | null;
  errorCode: string | null;
  createdAt: Date;
}): AiMessageDto => ({
  id: message.id,
  role: message.role,
  status: message.status,
  contentText: message.contentText,
  contentBlocks: message.contentBlocks
    ? parseStoredContentBlocks(message.contentBlocks)
    : null,
  scopeClassification: message.scopeClassification,
  locale: message.locale,
  provider: message.provider,
  model: message.model,
  policyVersion: message.policyVersion,
  errorCode: message.errorCode,
  createdAt: message.createdAt.toISOString(),
});

export const createGeneralLearningConversationForUser = async (
  userId: string,
  input: CreateAiConversationInput,
) => {
  const conversation = await createConversation({
    userId,
    mode: input.mode,
    locale: input.locale,
    title: input.title ?? null,
  });

  return mapConversationSummary({
    ...conversation,
    preview: null,
  });
};

export const listGeneralLearningConversationsForUser = async (
  userId: string,
  input: { limit: number; offset: number },
) => {
  const { items, total } = await listConversationsForUser({
    userId,
    limit: input.limit,
    offset: input.offset,
  });

  return {
    items: items.map((conversation) =>
      mapConversationSummary({
        id: conversation.id,
        mode: conversation.mode,
        locale: conversation.locale,
        title: conversation.title,
        status: conversation.status,
        lastMessageAt: conversation.lastMessageAt,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        preview: (() => {
          const latest = conversation.messages[0];
          if (!latest) {
            return null;
          }

          if (latest.role === 'USER') {
            const text = latest.contentText?.trim();
            if (!text) {
              return null;
            }

            return text.length <= 120 ? text : `${text.slice(0, 117)}...`;
          }

          return buildMessagePreviewFromBlocks(
            parseStoredContentBlocks(latest.contentBlocks),
          );
        })(),
      }),
    ),
    total,
    limit: input.limit,
    offset: input.offset,
    hasMore: input.offset + items.length < total,
  };
};

export const getOwnedConversationMessagesForUser = async (
  userId: string,
  conversationId: string,
  input: { limit: number; offset: number },
) => {
  const conversation = await findOwnedConversation({ conversationId, userId });
  if (!conversation) {
    throw new AppError(
      'Conversation not found.',
      404,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  const { items, total } = await listMessagesForConversation({
    conversationId,
    limit: input.limit,
    offset: input.offset,
  });

  return {
    conversation: mapConversationSummary({
      ...conversation,
      preview: null,
    }),
    items: items.map(mapMessageDto),
    total,
    limit: input.limit,
    offset: input.offset,
    hasMore: input.offset + items.length < total,
  };
};

export const sendGeneralLearningMessageForUser = async (
  userId: string,
  conversationId: string,
  input: SendAiMessageInput,
): Promise<AiTurnResponse> => {
  if (!assertMessageLength(input.text)) {
    throw new AppError(
      `Message exceeds the maximum length of ${env.aiChatMaxMessageLength} characters.`,
      400,
      'VALIDATION_ERROR',
      { field: 'text' },
    );
  }

  const conversation = await findOwnedConversation({ conversationId, userId });
  if (!conversation) {
    throw new AppError(
      'Conversation not found.',
      404,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  if (conversation.mode === 'PROJECT_AUTHORING') {
    return sendProjectAuthoringMessageForUser({
      userId,
      conversationId,
      text: input.text,
      locale: input.locale as AiLocale,
      clientMessageId: input.clientMessageId,
    });
  }

  return processGeneralLearningTurn({
    conversation,
    text: input.text,
    locale: input.locale as AiLocale,
    clientMessageId: input.clientMessageId,
  });
};

export const archiveGeneralLearningConversationForUser = async (
  userId: string,
  conversationId: string,
) => {
  const updated = await archiveConversationForUser({ conversationId, userId });
  if (updated.count === 0) {
    throw new AppError(
      'Conversation not found.',
      404,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  return { archived: true };
};

export const restoreGeneralLearningConversationForUser = async (
  userId: string,
  conversationId: string,
) => {
  const updated = await restoreConversationForUser({ conversationId, userId });
  if (updated.count === 0) {
    throw new AppError(
      'Conversation not found.',
      404,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  return { restored: true };
};

export const startProjectAuthoringForUser = async (
  userId: string,
  conversationId: string,
) => bootstrapProjectAuthoringForUser(userId, conversationId);

export {
  generateProjectAuthoringProposalForUser,
} from './ai-project-authoring.service.js';

export {
  submitProjectAuthoringProposalReviewForUser,
  submitProjectAuthoringDiscussionForUser,
  reviseProjectAuthoringProposalForUser,
  prepareApplyReviewedAuthoringProposalForUser,
} from './ai-project-authoring-review.service.js';

export {
  beginGuidedAuthoringOverviewForUser,
  runSequentialAuthoringActionForUser,
  discussSequentialAuthoringTurnForUser,
  getSequentialAuthoringStateForUser,
  findLatestAuthoringSessionState,
} from './ai-project-authoring-sequential.service.js';
