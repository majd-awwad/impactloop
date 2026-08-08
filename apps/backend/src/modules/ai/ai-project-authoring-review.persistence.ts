import { env } from '../../config/env.js';
import type { AiMessage } from '../../generated/prisma/client.js';

import { parseStoredContentBlocks } from './ai-context-builder.js';
import {
  type AiContentBlock,
  aiProjectAuthoringReviewStateBlockSchema,
  type AiProjectAuthoringReviewStateBlock,
} from './ai.content-blocks.js';
import { markReviewStateApplied } from './ai-project-authoring-review.policy.js';
import {
  createAssistantMessage,
  findOwnedConversation,
  loadRecentConversationMessages,
  touchConversationActivity,
} from './ai.repository.js';
import type { AiLocale } from './ai.types.js';

const PROJECT_AUTHORING_REVIEW_POLICY_VERSION = 'project-authoring-v2c';

const APPLIED_COPY: Record<AiLocale, string> = {
  en: 'Reviewed proposal applied to your draft.',
  ar: 'تم تطبيق الاقتراح المراجع على مسودتك.',
};

const textBlock = (text: string): AiContentBlock => ({
  type: 'text',
  text,
  purpose: 'answer',
});

const isReviewStateBlock = (
  block: AiContentBlock,
): block is AiProjectAuthoringReviewStateBlock =>
  block.type === 'project_authoring_review_state';

const findReviewStateById = (
  messages: AiMessage[],
  reviewStateId: string,
): {
  block: AiProjectAuthoringReviewStateBlock;
  assistantMessage: AiMessage;
} | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }

    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (const block of blocks) {
      if (!isReviewStateBlock(block)) {
        continue;
      }

      const parsed = aiProjectAuthoringReviewStateBlockSchema.safeParse(block);
      if (parsed.success && parsed.data.reviewStateId === reviewStateId) {
        return { block: parsed.data, assistantMessage: message };
      }
    }
  }

  return null;
};

export const persistAppliedReviewStateAfterConfirm = async (input: {
  userId: string;
  conversationId: string;
  reviewStateId: string;
  locale: AiLocale;
}) => {
  const ownedConversation = await findOwnedConversation({
    conversationId: input.conversationId,
    userId: input.userId,
  });

  if (!ownedConversation) {
    return;
  }

  const messages = await loadRecentConversationMessages({
    conversationId: input.conversationId,
    limit: env.aiChatMaxHistoryMessages,
  });

  const reviewState = findReviewStateById(messages, input.reviewStateId);
  if (!reviewState || reviewState.block.status === 'APPLIED') {
    return;
  }

  const appliedBlock = aiProjectAuthoringReviewStateBlockSchema.parse(
    markReviewStateApplied(reviewState.block),
  );

  await createAssistantMessage({
    conversationId: input.conversationId,
    inReplyToMessageId: reviewState.assistantMessage.id,
    status: 'COMPLETED',
    contentBlocks: [textBlock(APPLIED_COPY[input.locale]), appliedBlock],
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    locale: input.locale,
    provider: 'system',
    model: null,
    policyVersion: PROJECT_AUTHORING_REVIEW_POLICY_VERSION,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
  });

  await touchConversationActivity({
    conversationId: input.conversationId,
    locale: input.locale,
  });
};
