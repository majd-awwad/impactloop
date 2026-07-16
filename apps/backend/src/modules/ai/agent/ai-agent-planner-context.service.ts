import type { AiContentBlock } from '../ai.content-blocks.js';
import { parseStoredContentBlocks } from '../ai-context-builder.js';
import { listMessagesForConversation } from '../ai.repository.js';
import {
  loadRecentEntitiesForConversation,
  type RecentEntityRecord,
} from './ai-agent-recent-entities.service.js';

export type TrustedEntitySummary = {
  type: 'MATERIAL' | 'PROJECT' | 'BUILD' | 'COMPONENT';
  id: string;
  title: string;
  resultIndex: number;
  parentContext?: string;
  status?: string;
  blockType?: string;
  messageId?: string;
  recencyOrder?: number;
};

export type PlannerConversationContext = {
  recentMessages: Array<{ role: 'USER' | 'ASSISTANT'; text: string }>;
  entities: TrustedEntitySummary[];
};

const CONTEXT_MESSAGE_WINDOW = 24;

const toTrustedEntity = (entity: RecentEntityRecord): TrustedEntitySummary => ({
  type: entity.type,
  id: entity.id,
  title: entity.title,
  resultIndex: entity.resultIndex,
  parentContext: entity.parentContext,
  status: entity.status,
  blockType: entity.blockType,
  messageId: entity.messageId,
  recencyOrder: entity.recencyOrder,
});

export const buildPlannerConversationContext = async (
  conversationId: string,
): Promise<PlannerConversationContext> => {
  const { total } = await listMessagesForConversation({
    conversationId,
    limit: 1,
    offset: 0,
  });
  const { items } = await listMessagesForConversation({
    conversationId,
    limit: CONTEXT_MESSAGE_WINDOW,
    offset: Math.max(0, total - CONTEXT_MESSAGE_WINDOW),
  });

  const recentMessages = items
    .filter((message) => message.role === 'USER' || message.role === 'ASSISTANT')
    .map((message) => ({
      role: message.role as 'USER' | 'ASSISTANT',
      text: message.contentText?.trim() ?? '',
    }))
    .filter((message) => message.text.length > 0);

  const entities = (await loadRecentEntitiesForConversation(conversationId))
    .map(toTrustedEntity)
    .slice(0, 24);

  return {
    recentMessages: recentMessages.slice(-12),
    entities,
  };
};

export const summarizePlannerContextForPrompt = (
  context: PlannerConversationContext,
): string =>
  JSON.stringify(
    {
      recentMessages: context.recentMessages,
      trustedEntities: context.entities.map((entity) => ({
        type: entity.type,
        id: entity.id,
        title: entity.title,
        resultIndex: entity.resultIndex,
        parentContext: entity.parentContext ?? null,
        status: entity.status ?? null,
      })),
    },
    null,
    2,
  );
