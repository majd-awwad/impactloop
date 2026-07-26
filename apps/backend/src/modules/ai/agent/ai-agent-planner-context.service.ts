import { parseStoredContentBlocks } from '../ai-context-builder.js';
import { listMessagesForConversation } from '../ai.repository.js';
import { prisma } from '../../../database/prisma.js';
import {
  loadRecentEntitiesForConversation,
  type RecentEntityRecord,
} from './ai-agent-recent-entities.service.js';

export type PendingActionSummary = {
  actionType: string;
  status: string;
  summary: string;
};

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
  pendingAction?: PendingActionSummary | null;
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

const loadPendingActionSummary = async (
  conversationId: string,
): Promise<PendingActionSummary | null> => {
  const pending = await prisma.aiPendingAction.findFirst({
    where: {
      conversationId,
      status: 'PENDING',
      expiresAt: { gt: new Date() },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      actionType: true,
      status: true,
      payload: true,
    },
  });

  if (!pending) {
    return null;
  }

  const payload =
    pending.payload && typeof pending.payload === 'object'
      ? (pending.payload as Record<string, unknown>)
      : {};
  const displaySnapshot =
    payload.displaySnapshot && typeof payload.displaySnapshot === 'object'
      ? (payload.displaySnapshot as Record<string, unknown>)
      : null;
  const title =
    typeof displaySnapshot?.title === 'string'
      ? displaySnapshot.title
      : typeof displaySnapshot?.summary === 'string'
        ? displaySnapshot.summary
        : pending.actionType;

  return {
    actionType: pending.actionType,
    status: pending.status,
    summary: title,
  };
};

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
    .map((message) => {
      if (message.role === 'USER') {
        return {
          role: 'USER' as const,
          text: message.contentText?.trim() ?? '',
        };
      }

      const fromContentText = message.contentText?.trim() ?? '';
      if (fromContentText.length > 0) {
        return { role: 'ASSISTANT' as const, text: fromContentText };
      }

      const blocks = parseStoredContentBlocks(message.contentBlocks);
      const text = blocks
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n\n')
        .trim();

      return { role: 'ASSISTANT' as const, text };
    })
    .filter((message) => message.text.length > 0);

  const entities = (await loadRecentEntitiesForConversation(conversationId))
    .map(toTrustedEntity)
    .slice(0, 24);

  const pendingAction = await loadPendingActionSummary(conversationId);

  return {
    recentMessages: recentMessages.slice(-12),
    entities,
    pendingAction,
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
      pendingAction: context.pendingAction ?? null,
    },
    null,
    2,
  );
