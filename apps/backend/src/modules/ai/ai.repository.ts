import { prisma } from '../../database/prisma.js';
import type {
  AiConversationMode,
  AiMessageStatus,
  AiScopeClassification,
  Prisma,
} from '../../generated/prisma/client.js';

import type { AiContentBlock } from './ai.content-blocks.js';
import { aiContentBlocksSchema } from './ai.content-blocks.js';
import { parseStoredContentBlocks } from './ai-context-builder.js';

export const findOwnedConversation = async (input: {
  conversationId: string;
  userId: string;
}) =>
  prisma.aiConversation.findFirst({
    where: {
      id: input.conversationId,
      userId: input.userId,
    },
  });

export const createConversation = async (input: {
  userId: string;
  mode: AiConversationMode;
  locale: string;
  title?: string | null;
  projectBuildId?: string | null;
  learningProjectId?: string | null;
}) =>
  prisma.aiConversation.create({
    data: {
      userId: input.userId,
      mode: input.mode,
      locale: input.locale,
      title: input.title ?? null,
      projectBuildId: input.projectBuildId ?? null,
      learningProjectId: input.learningProjectId ?? null,
    },
  });

export const insertAuthoringConversation = async (
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    learningProjectId: string;
    locale: string;
    title: string | null;
  },
) =>
  tx.aiConversation.create({
    data: {
      userId: input.userId,
      mode: 'PROJECT_AUTHORING',
      locale: input.locale,
      title: input.title,
      projectBuildId: null,
      learningProjectId: input.learningProjectId,
      lastMessageAt: new Date(),
    },
    select: {
      id: true,
      mode: true,
      learningProjectId: true,
      updatedAt: true,
    },
  });

export const insertAuthoringIdeaUserMessage = async (
  tx: Prisma.TransactionClient,
  input: {
    conversationId: string;
    contentText: string;
    locale: string;
    clientMessageId: string;
  },
) =>
  tx.aiMessage.create({
    data: {
      conversationId: input.conversationId,
      role: 'USER',
      status: 'COMPLETED',
      contentText: input.contentText,
      clientMessageId: input.clientMessageId,
      locale: input.locale,
    },
    select: {
      id: true,
      role: true,
      contentText: true,
    },
  });

export const findAuthoringConversationForProject = async (
  learningProjectId: string,
) =>
  prisma.aiConversation.findFirst({
    where: {
      learningProjectId,
      mode: 'PROJECT_AUTHORING',
    },
    select: {
      id: true,
      userId: true,
      mode: true,
      learningProjectId: true,
      projectBuildId: true,
      updatedAt: true,
    },
  });

export const listConversationsForUser = async (input: {
  userId: string;
  limit: number;
  offset: number;
  status?: 'ACTIVE' | 'ARCHIVED';
}) => {
  const status = input.status ?? 'ACTIVE';
  const [items, total] = await Promise.all([
    prisma.aiConversation.findMany({
      where: {
        userId: input.userId,
        status,
        mode: 'GENERAL_LEARNING',
        projectBuildId: null,
      },
      orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      skip: input.offset,
      take: input.limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.aiConversation.count({
      where: {
        userId: input.userId,
        status,
        mode: { in: ['GENERAL_LEARNING', 'LEARNER_ASSISTANT'] },
      },
    }),
  ]);

  return { items, total };
};

export const archiveConversationForUser = async (input: {
  conversationId: string;
  userId: string;
}) =>
  prisma.aiConversation.updateMany({
    where: {
      id: input.conversationId,
      userId: input.userId,
      status: 'ACTIVE',
    },
    data: {
      status: 'ARCHIVED',
    },
  });

export const restoreConversationForUser = async (input: {
  conversationId: string;
  userId: string;
}) =>
  prisma.aiConversation.updateMany({
    where: {
      id: input.conversationId,
      userId: input.userId,
      status: 'ARCHIVED',
    },
    data: {
      status: 'ACTIVE',
    },
  });

export const listMessagesForConversation = async (input: {
  conversationId: string;
  limit: number;
  offset: number;
}) => {
  const [items, total] = await Promise.all([
    prisma.aiMessage.findMany({
      where: { conversationId: input.conversationId },
      orderBy: { createdAt: 'asc' },
      skip: input.offset,
      take: input.limit,
    }),
    prisma.aiMessage.count({
      where: { conversationId: input.conversationId },
    }),
  ]);

  return { items, total };
};

export const findUserMessageByClientId = async (input: {
  conversationId: string;
  clientMessageId: string;
}) =>
  prisma.aiMessage.findUnique({
    where: {
      conversationId_clientMessageId: {
        conversationId: input.conversationId,
        clientMessageId: input.clientMessageId,
      },
    },
  });

export const findAssistantReplyToUserMessage = async (userMessageId: string) =>
  prisma.aiMessage.findFirst({
    where: {
      inReplyToMessageId: userMessageId,
      role: 'ASSISTANT',
    },
    orderBy: { createdAt: 'desc' },
  });

export const acquireConversationProcessingLock = async (input: {
  conversationId: string;
  staleBefore: Date;
}) => {
  const result = await prisma.aiConversation.updateMany({
    where: {
      id: input.conversationId,
      OR: [
        { processingState: 'IDLE' },
        {
          processingState: 'PROCESSING',
          OR: [
            { processingStartedAt: null },
            { processingStartedAt: { lt: input.staleBefore } },
          ],
        },
      ],
    },
    data: {
      processingState: 'PROCESSING',
      processingStartedAt: new Date(),
    },
  });

  return result.count === 1;
};

export const releaseConversationProcessingLock = async (
  conversationId: string,
) => {
  await prisma.aiConversation.updateMany({
    where: { id: conversationId },
    data: {
      processingState: 'IDLE',
      processingStartedAt: null,
    },
  });
};

export const deleteAssistantMessage = async (messageId: string) => {
  await prisma.aiMessage.deleteMany({
    where: { id: messageId, role: 'ASSISTANT' },
  });
};

export const createUserMessage = async (input: {
  conversationId: string;
  contentText: string;
  clientMessageId: string;
  locale: string;
  contentBlocks?: AiContentBlock[];
}) =>
  prisma.aiMessage.create({
    data: {
      conversationId: input.conversationId,
      role: 'USER',
      status: 'COMPLETED',
      contentText: input.contentText,
      clientMessageId: input.clientMessageId,
      locale: input.locale,
      ...(input.contentBlocks
        ? { contentBlocks: input.contentBlocks as Prisma.InputJsonValue }
        : {}),
    },
  });

export const createAssistantMessage = async (input: {
  conversationId: string;
  inReplyToMessageId: string;
  status: AiMessageStatus;
  contentBlocks: AiContentBlock[];
  scopeClassification: AiScopeClassification;
  locale: string;
  provider: string;
  model: string | null;
  policyVersion: string;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  errorCode?: string | null;
}) =>
  prisma.aiMessage.create({
    data: {
      conversationId: input.conversationId,
      role: 'ASSISTANT',
      status: input.status,
      contentBlocks: input.contentBlocks as Prisma.InputJsonValue,
      inReplyToMessageId: input.inReplyToMessageId,
      scopeClassification: input.scopeClassification,
      locale: input.locale,
      provider: input.provider,
      model: input.model,
      policyVersion: input.policyVersion,
      latencyMs: input.latencyMs,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      errorCode: input.errorCode ?? null,
    },
  });

export const touchConversationActivity = async (input: {
  conversationId: string;
  locale?: string;
  title?: string | null;
}) =>
  prisma.aiConversation.update({
    where: { id: input.conversationId },
    data: {
      lastMessageAt: new Date(),
      ...(input.locale ? { locale: input.locale } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
    },
  });

export const loadRecentConversationMessages = async (input: {
  conversationId: string;
  limit: number;
}) =>
  prisma.aiMessage.findMany({
    where: { conversationId: input.conversationId },
    orderBy: { createdAt: 'asc' },
    take: input.limit,
  });

export const deleteAiDataForUsers = async (userIds: string[]) => {
  if (userIds.length === 0) {
    return;
  }

  await prisma.aiConversation.deleteMany({
    where: { userId: { in: userIds } },
  });
};

export const appendActionResultToAssistantMessage = async (input: {
  conversationId: string;
  pendingActionId: string;
  resultBlock: Extract<AiContentBlock, { type: 'action_result' }>;
}) => {
  const messages = await prisma.aiMessage.findMany({
    where: {
      conversationId: input.conversationId,
      role: 'ASSISTANT',
    },
    orderBy: { createdAt: 'desc' },
    take: 24,
  });

  for (const message of messages) {
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    const hasConfirmation = blocks.some(
      (block) =>
        block.type === 'action_confirmation' &&
        block.pendingActionId === input.pendingActionId,
    );
    const hasResult =
      input.resultBlock.type === 'action_result' &&
      blocks.some(
        (block) =>
          block.type === 'action_result' &&
          block.actionType === input.resultBlock.actionType &&
          block.status === input.resultBlock.status,
      );

    if (!hasConfirmation || hasResult) {
      continue;
    }

    const updatedBlocks = aiContentBlocksSchema.parse([
      ...blocks,
      input.resultBlock,
    ]);

    await prisma.aiMessage.update({
      where: { id: message.id },
      data: {
        contentBlocks: updatedBlocks as Prisma.InputJsonValue,
      },
    });

    return message.id;
  }

  return null;
};

export const getOrCreateBuildGuideConversation = async (input: {
  userId: string;
  projectBuildId: string;
  locale?: string;
  projectTitle?: string | null;
}) => {
  const existing = await prisma.aiConversation.findFirst({
    where: {
      userId: input.userId,
      projectBuildId: input.projectBuildId,
    },
  });

  if (existing) {
    if (existing.status === 'ARCHIVED') {
      return prisma.aiConversation.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE' },
      });
    }

    return existing;
  }

  return createConversation({
    userId: input.userId,
    mode: 'GENERAL_LEARNING',
    locale: input.locale ?? 'en',
    title: input.projectTitle ? `Build guide: ${input.projectTitle}` : 'Build guide',
    projectBuildId: input.projectBuildId,
  });
};
