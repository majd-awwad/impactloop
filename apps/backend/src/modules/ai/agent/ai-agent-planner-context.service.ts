import type { AiContentBlock } from '../ai.content-blocks.js';
import { parseStoredContentBlocks } from '../ai-context-builder.js';
import { listMessagesForConversation } from '../ai.repository.js';
import { prisma } from '../../../database/prisma.js';
import { getOwnedProjectBuildByBuildId } from '../../learning-projects/learning-projects.service.js';
import { buildBuildGuideModelContext } from '../ai-build-guide-model-context.js';
import {
  loadRecentEntitiesForConversation,
  type RecentEntityRecord,
} from './ai-agent-recent-entities.service.js';
import { normalizeArabicVariants } from './ai-agent-filter-extractor.service.js';
import type { AiLocale } from '../ai.types.js';

export const TRUSTED_MATERIAL_RESULT_SET_FILTER_MARKER =
  'trustedMaterialResultSetFilter' as const;

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

export type TrustedMaterialResultSetSummary = {
  messageId: string;
  materialIds: string[];
  itemCount: number;
  titles: string[];
};

export type MaterialResultSetFilterConstraints = {
  isFree?: boolean;
};

export type PlannerConversationContext = {
  recentMessages: Array<{ role: 'USER' | 'ASSISTANT'; text: string }>;
  entities: TrustedEntitySummary[];
  pendingAction?: PendingActionSummary | null;
  latestMaterialResultSet?: TrustedMaterialResultSetSummary | null;
  activeBuildGuide?: {
    projectTitle: string;
    currentStepNumber: number | null;
    currentStepTitle: string | null;
    totalSteps: number;
  } | null;
};

const CONTEXT_MESSAGE_WINDOW = 24;

const normalizeMessage = (value: string): string =>
  normalizeArabicVariants(
    value
      .toLowerCase()
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

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

const findLatestMaterialResultsBlock = (
  blocks: AiContentBlock[],
): Extract<AiContentBlock, { type: 'material_results' }> | null => {
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = blocks[index];
    if (block.type === 'material_results') {
      return block;
    }
  }

  return null;
};

export const extractLatestMaterialResultSetFromBlocks = (
  blocks: AiContentBlock[],
  messageId: string,
): TrustedMaterialResultSetSummary | null => {
  const block = findLatestMaterialResultsBlock(blocks);
  if (!block) {
    return null;
  }

  return {
    messageId,
    materialIds: block.items.map((item) => item.materialId),
    itemCount: block.items.length,
    titles: block.items.map((item) => item.title),
  };
};

export const loadLatestTrustedMaterialResultSet = async (
  conversationId: string,
): Promise<TrustedMaterialResultSetSummary | null> => {
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

  for (let index = items.length - 1; index >= 0; index -= 1) {
    const message = items[index];
    if (message.role !== 'ASSISTANT') {
      continue;
    }

    const blocks = parseStoredContentBlocks(message.contentBlocks);
    const resultSet = extractLatestMaterialResultSetFromBlocks(blocks, message.id);
    if (resultSet) {
      return resultSet;
    }
  }

  return null;
};

export const messageReferencesPriorMaterialResultSet = (userMessage: string): boolean => {
  const normalized = normalizeMessage(userMessage);
  return (
    /(?:منهم|منها|من هدول|من هذول|من هال|من هالمواد|them|the ones|those|these|of them)/i.test(
      normalized,
    ) ||
    /(?:هذول|هذي|هاي|hadol|hadi)\b/i.test(normalized) ||
    /\bones\b/i.test(normalized)
  );
};

export const extractMaterialResultSetFilterConstraints = (
  userMessage: string,
): MaterialResultSetFilterConstraints => {
  const normalized = normalizeMessage(userMessage);
  const constraints: MaterialResultSetFilterConstraints = {};

  if (/(?:مجاني|مجانية|المجاني|المجانية|\bfree\b)/i.test(normalized)) {
    constraints.isFree = true;
  }

  return constraints;
};

export const detectMaterialResultSetFilterFollowUp = (userMessage: string): boolean => {
  const normalized = normalizeMessage(userMessage);
  const constraints = extractMaterialResultSetFilterConstraints(userMessage);
  const referencesPriorSet = messageReferencesPriorMaterialResultSet(userMessage);
  const narrowingCue = /(?:^|\s)(?:بس|only|just|فقط)(?:\s|$)/i.test(normalized);
  const showCue = /(?:ورجيني|وريني|اعرض|show|display)\b/i.test(normalized);

  if (Object.keys(constraints).length === 0) {
    return false;
  }

  if (referencesPriorSet) {
    return true;
  }

  return narrowingCue && (showCue || referencesPriorSet);
};

export type MaterialResultSetFilterContinuation =
  | {
      kind: 'filter';
      toolInput: Record<string, unknown>;
      sourceResultSet: TrustedMaterialResultSetSummary;
    }
  | {
      kind: 'clarification';
      reason: string;
    };

const MATERIAL_RESULT_SET_FILTER_CLARIFICATION_COPY = {
  ar: 'أي مواد تقصد؟ اعرضلي أولاً مواداً متاحة ثم يمكنني تصفية النتائج (مثل المجاني فقط).',
  en: 'Which materials do you mean? Show me available materials first, then I can filter those results (for example free only).',
} as const;

export const resolveMaterialResultSetFilterContinuation = async (input: {
  userMessage: string;
  locale: AiLocale;
  conversationId: string;
  conversationContext?: PlannerConversationContext;
}): Promise<MaterialResultSetFilterContinuation | null> => {
  if (!detectMaterialResultSetFilterFollowUp(input.userMessage)) {
    return null;
  }

  const sourceResultSet =
    input.conversationContext?.latestMaterialResultSet ??
    (await loadLatestTrustedMaterialResultSet(input.conversationId));

  if (!sourceResultSet) {
    return {
      kind: 'clarification',
      reason:
        MATERIAL_RESULT_SET_FILTER_CLARIFICATION_COPY[
          input.locale === 'ar' ? 'ar' : 'en'
        ],
    };
  }

  const constraints = extractMaterialResultSetFilterConstraints(input.userMessage);

  return {
    kind: 'filter',
    sourceResultSet,
    toolInput: {
      [TRUSTED_MATERIAL_RESULT_SET_FILTER_MARKER]: true,
      sourceMaterialIds: sourceResultSet.materialIds,
      sourceMessageId: sourceResultSet.messageId,
      ...constraints,
    },
  };
};

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

const loadLatestMaterialResultSetSummary = async (
  conversationId: string,
): Promise<TrustedMaterialResultSetSummary | null> =>
  loadLatestTrustedMaterialResultSet(conversationId);

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
  const latestMaterialResultSet = await loadLatestMaterialResultSetSummary(conversationId);
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId },
    select: { projectBuildId: true, userId: true },
  });
  let activeBuildGuide: PlannerConversationContext['activeBuildGuide'] = null;
  if (conversation?.projectBuildId) {
    const build = await getOwnedProjectBuildByBuildId(
      conversation.projectBuildId,
      conversation.userId,
    );
    if (build) {
      const modelContext = buildBuildGuideModelContext(build);
      activeBuildGuide = {
        projectTitle: modelContext.projectTitle,
        currentStepNumber: modelContext.currentStepNumber,
        currentStepTitle: modelContext.currentStepTitle,
        totalSteps: modelContext.totalSteps,
      };
    }
  }

  return {
    recentMessages: recentMessages.slice(-12),
    entities,
    pendingAction,
    latestMaterialResultSet,
    activeBuildGuide,
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
        blockType: entity.blockType ?? null,
      })),
      latestMaterialResultSet: context.latestMaterialResultSet ?? null,
      pendingAction: context.pendingAction ?? null,
      activeBuildGuide: context.activeBuildGuide ?? null,
    },
    null,
    2,
  );
