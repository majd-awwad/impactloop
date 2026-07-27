import { randomUUID } from 'node:crypto';

import { env, isAiChatProviderOperational } from '../../config/env.js';
import type { AiConversation, AiMessage } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { logger } from '../../observability/logger.js';

import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';

import { parseStoredContentBlocks } from './ai-context-builder.js';
import {
  type AiContentBlock,
  aiProjectAuthoringClarificationBlockSchema,
  aiProjectAuthoringProposalBlockSchema,
  type AiProjectAuthoringClarificationBlock,
  type AiProjectAuthoringProposalBlock,
} from './ai.content-blocks.js';
import {
  generateAuthoringClarification,
  MAX_AUTHORING_CLARIFICATION_QUESTIONS,
  normalizeQuestionPrompt,
  buildAuthoringRepairIssue,
  buildDeterministicReadyClarification,
  computeAuthoringTopicState,
  evaluateAuthoringReadiness,
  parseAuthoringClarificationBlock,
  recordAuthoringValidationDiagnostic,
  validateAuthoringClarificationPolicy,
} from './ai-project-authoring-clarification.provider.js';
import { classifyScopeDeterministic } from './ai-scope-guard.js';
import { DANGEROUS_SAFETY_COPY } from './agent/ai-agent-safety-guard.service.js';
import {
  acquireConversationProcessingLock,
  createAssistantMessage,
  createUserMessage,
  deleteAssistantMessage,
  findAssistantReplyToUserMessage,
  findOwnedConversation,
  findUserMessageByClientId,
  loadRecentConversationMessages,
  releaseConversationProcessingLock,
  touchConversationActivity,
} from './ai.repository.js';
import type { AiLocale, AiTurnResponse } from './ai.types.js';
import { beginGuidedAuthoringOverviewForUser } from './ai-project-authoring-sequential.service.js';

export const PROJECT_AUTHORING_POLICY_VERSION = 'project-authoring-v2a';
export const PROJECT_AUTHORING_PROPOSAL_POLICY_VERSION = 'project-authoring-v2b';

const AUTHORING_OFF_TOPIC_COPY: Record<AiLocale, string> = {
  en: 'This conversation is for developing your project idea. Tell me what you want to clarify or change about the project.',
  ar: 'هذه المحادثة مخصصة لتطوير فكرة مشروعك. أخبرني بما تريد توضيحه أو تغييره في المشروع.',
};

const INVALID_AUTHORING_RESPONSE_COPY: Record<AiLocale, string> = {
  en: 'The authoring assistant could not produce a valid clarification. Please try again.',
  ar: 'تعذر على مساعد التأليف إنشاء توضيح صالح. حاول مرة أخرى.',
};

const READY_AUTHORING_COPY: Record<AiLocale, string> = {
  en: 'Your project idea has enough detail to generate a structured draft.',
  ar: 'أصبحت فكرة مشروعك واضحة بما يكفي لإنشاء مسودة منظمة.',
};

const INVALID_AUTHORING_PROPOSAL_COPY: Record<AiLocale, string> = {
  en: 'The authoring assistant could not produce a valid project proposal. Please try again.',
  ar: 'تعذر على مساعد التأليف إنشاء اقتراح مشروع صالح. حاول مرة أخرى.',
};

const textBlock = (text: string, purpose: 'answer' | 'refusal' | 'safety' = 'answer'): AiContentBlock => ({
  type: 'text',
  text,
  purpose,
});

const isClarificationBlock = (
  block: AiContentBlock,
): block is AiProjectAuthoringClarificationBlock =>
  block.type === 'project_authoring_clarification';

const isProposalBlock = (
  block: AiContentBlock,
): block is AiProjectAuthoringProposalBlock =>
  block.type === 'project_authoring_proposal';

const findLatestClarificationState = (
  messages: AiMessage[],
): {
  block: AiProjectAuthoringClarificationBlock;
  messageId: string;
  assistantMessage: AiMessage;
} | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }

    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (let blockIndex = blocks.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = blocks[blockIndex];
      if (isClarificationBlock(block)) {
        const parsed = aiProjectAuthoringClarificationBlockSchema.safeParse(block);
        if (parsed.success) {
          return {
            block: parsed.data,
            messageId: message.id,
            assistantMessage: message,
          };
        }
      }
    }
  }

  return null;
};

const findLatestClarificationBlock = (
  messages: AiMessage[],
): AiProjectAuthoringClarificationBlock | null =>
  findLatestClarificationState(messages)?.block ?? null;

const findCurrentProposalState = (
  messages: AiMessage[],
  baseUpdatedAt: string,
  clarificationMessageId: string,
): { block: AiProjectAuthoringProposalBlock; assistantMessage: AiMessage } | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }

    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (const block of blocks) {
      if (!isProposalBlock(block)) {
        continue;
      }

      const parsed = aiProjectAuthoringProposalBlockSchema.safeParse(block);
      if (
        parsed.success &&
        parsed.data.baseUpdatedAt === baseUpdatedAt &&
        parsed.data.clarificationMessageId === clarificationMessageId
      ) {
        return { block: parsed.data, assistantMessage: message };
      }
    }
  }

  return null;
};

const findInitialIdeaMessage = (messages: AiMessage[]) =>
  messages.find((message) => message.role === 'USER' && message.contentText?.trim());

const extractAnsweredQuestionKeys = (messages: AiMessage[]) => {
  const answered: string[] = [];
  const ideaMessageId = findInitialIdeaMessage(messages)?.id;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }

    const blocks = parseStoredContentBlocks(message.contentBlocks);
    const clarification = blocks.find(isClarificationBlock);
    if (!clarification?.nextQuestion) {
      continue;
    }

    const nextUser = messages
      .slice(index + 1)
      .find(
        (candidate) =>
          candidate.role === 'USER' &&
          candidate.contentText?.trim() &&
          candidate.id !== ideaMessageId,
      );

    if (nextUser) {
      answered.push(clarification.nextQuestion.key);
    }
  }

  return answered;
};

const assertAuthoringConversation = async (
  conversation: AiConversation,
  userId: string,
) => {
  if (conversation.mode !== 'PROJECT_AUTHORING') {
    throw new AppError('Unsupported conversation mode.', 400, 'VALIDATION_ERROR');
  }

  if (conversation.status !== 'ACTIVE') {
    throw new AppError(
      'This conversation is archived.',
      409,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  if (!conversation.learningProjectId) {
    throw new AppError(
      'Authoring conversation is not linked to a project.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const project = await learningProjectsRepository.findMyLearningProjectSubmissionById(
    conversation.learningProjectId,
    userId,
  );

  if (!project) {
    throw new AppError(
      'Learning project submission not found',
      404,
      'NOT_FOUND',
    );
  }

  if (project.status !== 'DRAFT') {
    throw new AppError(
      'Project authoring is only available for draft submissions.',
      409,
      'LEARNING_PROJECT_NOT_EDITABLE',
    );
  }

  return { project };
};

const buildAuthoringContext = async (input: {
  conversation: AiConversation;
  locale: AiLocale;
  currentAnswer: string | null;
}) => {
  const messages = await loadRecentConversationMessages({
    conversationId: input.conversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });

  const ideaMessage = findInitialIdeaMessage(messages);
  if (!ideaMessage?.contentText?.trim()) {
    throw new AppError(
      'Authoring idea message is missing.',
      409,
      'AI_AUTHORING_IDEA_MISSING',
    );
  }

  const { project } = await assertAuthoringConversation(
    input.conversation,
    input.conversation.userId,
  );

  const answeredQuestionKeys = extractAnsweredQuestionKeys(messages);
  const latestClarification = findLatestClarificationBlock(messages);
  const ideaMessageId = ideaMessage.id;
  const recentAuthoringAnswers = messages
    .filter(
      (message) =>
        message.role === 'USER' &&
        message.id !== ideaMessageId &&
        message.contentText?.trim(),
    )
    .slice(-6)
    .map((message) => message.contentText!.trim());

  return {
    messages,
    ideaMessage,
    context: {
      locale: input.locale,
      ideaText: ideaMessage.contentText.trim(),
      projectTitle: project.title,
      projectShortDescription: project.shortDescription,
      projectDescription: project.description,
      categoryName: project.category?.nameEn ?? null,
      difficulty: project.difficulty,
      componentNames: (project.requiredComponents ?? []).map(
        (component) => component.componentName,
      ),
      stepTitles: (project.steps ?? []).map((step) => step.title),
      answeredQuestionKeys,
      answeredQuestionCount: answeredQuestionKeys.length,
      currentAnswer: input.currentAnswer,
      latestClarification,
      recentAuthoringAnswers,
      repairAttempt: false,
      repairIssue: null,
      previousInvalidOutput: null,
    },
  };
};

const mapAuthoringTurnResponse = (input: {
  conversation: AiConversation;
  userMessage: AiMessage;
  assistantMessage: AiMessage;
  blocks: AiContentBlock[];
  locale: AiLocale;
}): AiTurnResponse => ({
  conversationId: input.conversation.id,
  userMessageId: input.userMessage.id,
  assistantMessageId: input.assistantMessage.id,
  mode: 'PROJECT_AUTHORING',
  locale: input.locale,
  contentBlocks: input.blocks,
  meta: {
    provider: input.assistantMessage.provider ?? 'system',
    model: input.assistantMessage.model ?? null,
    policyVersion:
      input.assistantMessage.policyVersion ?? PROJECT_AUTHORING_POLICY_VERSION,
    scopeClassification: input.assistantMessage.scopeClassification ?? 'DOMAIN_KNOWLEDGE',
    latencyMs: input.assistantMessage.latencyMs ?? null,
    usage: {
      inputTokens: input.assistantMessage.inputTokens ?? null,
      outputTokens: input.assistantMessage.outputTokens ?? null,
    },
  },
});

const buildClarificationBlocks = (
  assistantText: string,
  clarification: AiProjectAuthoringClarificationBlock,
): AiContentBlock[] => [
  textBlock(assistantText),
  clarification,
];

const buildTopicContext = (context: Awaited<ReturnType<typeof buildAuthoringContext>>['context']) => ({
  ideaText: context.ideaText,
  projectTitle: context.projectTitle,
  projectShortDescription: context.projectShortDescription,
  projectDescription: context.projectDescription,
  categoryName: context.categoryName,
  difficulty: context.difficulty,
  answeredQuestionKeys: context.answeredQuestionKeys,
  answeredQuestionCount: context.answeredQuestionCount,
});

const throwInvalidAuthoringResponse = (locale: AiLocale) => {
  throw new AppError(
    INVALID_AUTHORING_RESPONSE_COPY[locale],
    502,
    'AI_RESPONSE_INVALID',
  );
};

const throwInvalidAuthoringProposal = (locale: AiLocale) => {
  throw new AppError(
    INVALID_AUTHORING_PROPOSAL_COPY[locale],
    502,
    'AI_RESPONSE_INVALID',
  );
};

const mapAuthoringProposalResponse = (input: {
  conversation: AiConversation;
  basisMessageId: string;
  assistantMessage: AiMessage;
  blocks: AiContentBlock[];
  locale: AiLocale;
}): AiTurnResponse => ({
  conversationId: input.conversation.id,
  userMessageId: input.basisMessageId,
  assistantMessageId: input.assistantMessage.id,
  mode: 'PROJECT_AUTHORING',
  locale: input.locale,
  contentBlocks: input.blocks,
  meta: {
    provider: input.assistantMessage.provider ?? 'system',
    model: input.assistantMessage.model ?? null,
    policyVersion:
      input.assistantMessage.policyVersion ??
      PROJECT_AUTHORING_PROPOSAL_POLICY_VERSION,
    scopeClassification:
      input.assistantMessage.scopeClassification ?? 'DOMAIN_KNOWLEDGE',
    latencyMs: input.assistantMessage.latencyMs ?? null,
    usage: {
      inputTokens: input.assistantMessage.inputTokens ?? null,
      outputTokens: input.assistantMessage.outputTokens ?? null,
    },
  },
});

const produceAuthoringClarification = async (input: {
  conversation: AiConversation;
  locale: AiLocale;
  currentAnswer: string | null;
  messages: AiMessage[];
  answeredQuestionKeys: string[];
  latestClarification: AiProjectAuthoringClarificationBlock | null;
}) => {
  if (!isAiChatProviderOperational()) {
    throw new AppError(
      input.locale === 'ar'
        ? 'مساعد الذكاء الاصطناعي غير متاح حاليًا.'
        : 'The AI assistant is currently unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  const previousPrompts = collectPreviousPrompts(input.messages);
  const baseContext = await buildAuthoringContext({
    conversation: input.conversation,
    locale: input.locale,
    currentAnswer: input.currentAnswer,
  });

  const topicContext = buildTopicContext(baseContext.context);
  const topicState = computeAuthoringTopicState(topicContext);
  const readiness = evaluateAuthoringReadiness(topicContext, topicState);
  const remainingQuestionBudget = Math.max(
    0,
    MAX_AUTHORING_CLARIFICATION_QUESTIONS - baseContext.context.answeredQuestionCount,
  );

  if (readiness.ready) {
    const clarification = buildDeterministicReadyClarification({
      locale: input.locale,
      topicState,
      latest: input.latestClarification,
      reasons: readiness.reasons,
    });

    return {
      blocks: buildClarificationBlocks(READY_AUTHORING_COPY[input.locale], clarification),
      provider: 'server-readiness',
      model: null,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
    };
  }

  const parseProviderResult = (
    providerResult: Awaited<ReturnType<typeof generateAuthoringClarification>>,
    attempt: number,
  ) => {
    const clarification = parseAuthoringClarificationBlock({
      clarification: providerResult.data.clarification,
      provider: providerResult.provider,
      attempt,
    });
    const assistantText = providerResult.data.assistantText.trim();
    if (!assistantText) {
      throw new Error('empty assistant text');
    }
    return { providerResult, clarification, assistantText };
  };

  const requestClarification = async (
    context: typeof baseContext.context,
    attempt: number,
  ) => {
    const providerResult = await generateAuthoringClarification(context);
    return parseProviderResult(providerResult, attempt);
  };

  const isRepairableProviderFailure = (error: unknown) => {
    if (error instanceof AppError) {
      return error.code === 'AI_RESPONSE_INVALID';
    }

    return true;
  };

  const buildRepairIssue = (
    policy: Extract<
      ReturnType<typeof validateAuthoringClarificationPolicy>,
      { ok: false }
    >,
  ) =>
    buildAuthoringRepairIssue({
      policy,
      unresolvedTopics: topicState.unresolvedTopics,
      remainingQuestionBudget,
    });

  let providerResult: Awaited<ReturnType<typeof generateAuthoringClarification>>;
  let clarification: AiProjectAuthoringClarificationBlock;
  let assistantText: string;
  let usedRepair = false;

  try {
    ({ providerResult, clarification, assistantText } = await requestClarification(
      baseContext.context,
      1,
    ));
  } catch (error) {
    if (!isRepairableProviderFailure(error)) {
      throw error;
    }

    if (usedRepair) {
      throwInvalidAuthoringResponse(input.locale);
    }

    usedRepair = true;
    try {
      ({ providerResult, clarification, assistantText } = await requestClarification(
        {
          ...baseContext.context,
          repairAttempt: true,
          repairIssue:
            'Provider output failed JSON or schema validation. Return strict JSON with clarification and assistantText. FREE_TEXT must use options: []. SINGLE_CHOICE needs 2-4 unique options.',
          previousInvalidOutput: null,
        },
        2,
      ));
    } catch (repairError) {
      if (repairError instanceof AppError) {
        throw repairError;
      }

      throwInvalidAuthoringResponse(input.locale);
    }
  }

  let validation = validateAuthoringClarificationPolicy({
    clarification,
    answeredQuestionKeys: input.answeredQuestionKeys,
    previousPrompts,
    topicState,
    remainingQuestionBudget,
    normalizeQuestionPrompt,
  });

  if (!validation.ok && !usedRepair) {
    usedRepair = true;
    recordAuthoringValidationDiagnostic({
      provider: providerResult.provider,
      attempt: 2,
      stage: 'server_policy',
      issues: [],
      policyReason: validation.reason,
    });

    try {
      ({ providerResult, clarification, assistantText } = await requestClarification(
        {
          ...baseContext.context,
          repairAttempt: true,
          repairIssue: buildRepairIssue(validation),
          previousInvalidOutput: JSON.stringify({
            clarification,
            assistantText,
          }).slice(0, 1500),
        },
        2,
      ));
      validation = validateAuthoringClarificationPolicy({
        clarification,
        answeredQuestionKeys: input.answeredQuestionKeys,
        previousPrompts,
        topicState,
        remainingQuestionBudget,
        normalizeQuestionPrompt,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throwInvalidAuthoringResponse(input.locale);
    }
  }

  if (!validation.ok) {
    const postReadiness = evaluateAuthoringReadiness(topicContext, topicState);
    if (
      postReadiness.ready ||
      ['satisfied_topic', 'irrelevant_topic', 'repeated_key', 'repeated_prompt'].includes(
        validation.reason,
      )
    ) {
      clarification = buildDeterministicReadyClarification({
        locale: input.locale,
        topicState,
        latest: clarification,
        reasons: postReadiness.ready
          ? postReadiness.reasons
          : ['policy_conflict_ready_fallback'],
      });
      assistantText = READY_AUTHORING_COPY[input.locale];
    } else {
      throwInvalidAuthoringResponse(input.locale);
    }
  }

  if (clarification.status === 'READY_FOR_PROPOSAL') {
    clarification = {
      ...clarification,
      remainingTopics: 0,
      nextQuestion: null,
    };
  } else if (clarification.remainingTopics !== remainingQuestionBudget) {
    clarification = {
      ...clarification,
      remainingTopics: remainingQuestionBudget,
    };
  }

  return {
    blocks: buildClarificationBlocks(assistantText, clarification),
    provider: providerResult.provider,
    model: providerResult.model,
    latencyMs: providerResult.latencyMs,
    inputTokens: providerResult.usage.inputTokens,
    outputTokens: providerResult.usage.outputTokens,
  };
};

const collectPreviousPrompts = (messages: AiMessage[]) => {
  const prompts: string[] = [];
  for (const message of messages) {
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (const block of blocks) {
      if (isClarificationBlock(block) && block.nextQuestion?.prompt) {
        prompts.push(block.nextQuestion.prompt);
      }
    }
  }
  return prompts;
};

const acquireAuthoringLock = async (conversationId: string) => {
  const staleBefore = new Date(Date.now() - env.aiChatProcessingStaleMs);
  const lockAcquired = await acquireConversationProcessingLock({
    conversationId,
    staleBefore,
  });

  if (!lockAcquired) {
    throw new AppError(
      'This conversation is already processing a message.',
      409,
      'AI_CONVERSATION_BUSY',
    );
  }
};

export const bootstrapProjectAuthoringForUser = async (
  userId: string,
  conversationId: string,
): Promise<AiTurnResponse> => {
  const ownedConversation = await findOwnedConversation({
    conversationId,
    userId,
  });

  if (!ownedConversation) {
    throw new AppError(
      'Conversation not found.',
      404,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  const { project } = await assertAuthoringConversation(ownedConversation, userId);
  const locale = (ownedConversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;

  const messages = await loadRecentConversationMessages({
    conversationId: ownedConversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });

  const existingClarification = findLatestClarificationBlock(messages);
  const ideaMessage = findInitialIdeaMessage(messages);
  if (!ideaMessage) {
    throw new AppError(
      'Authoring idea message is missing.',
      409,
      'AI_AUTHORING_IDEA_MISSING',
    );
  }

  if (existingClarification) {
    const latestAssistant = [...messages]
      .reverse()
      .find((message) => {
        if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
          return false;
        }
        return parseStoredContentBlocks(message.contentBlocks).some(
          isClarificationBlock,
        );
      });

    if (!latestAssistant) {
      throw new AppError(
        'Authoring clarification message is missing.',
        409,
        'AI_AUTHORING_STATE_INVALID',
      );
    }

    return mapAuthoringTurnResponse({
      conversation: ownedConversation,
      userMessage: ideaMessage,
      assistantMessage: latestAssistant,
      blocks: parseStoredContentBlocks(latestAssistant.contentBlocks),
      locale,
    });
  }

  await acquireAuthoringLock(ownedConversation.id);

  try {
    const refreshedMessages = await loadRecentConversationMessages({
      conversationId: ownedConversation.id,
      limit: env.aiChatMaxHistoryMessages,
    });
    const raceClarification = findLatestClarificationBlock(refreshedMessages);
    if (raceClarification) {
      const latestAssistant = [...refreshedMessages]
        .reverse()
        .find((message) => {
          if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
            return false;
          }
          return parseStoredContentBlocks(message.contentBlocks).some(
            isClarificationBlock,
          );
        });
      if (latestAssistant) {
        return mapAuthoringTurnResponse({
          conversation: ownedConversation,
          userMessage: ideaMessage,
          assistantMessage: latestAssistant,
          blocks: parseStoredContentBlocks(latestAssistant.contentBlocks),
          locale,
        });
      }
    }

    const answeredQuestionKeys = extractAnsweredQuestionKeys(refreshedMessages);
    const produced = await produceAuthoringClarification({
      conversation: ownedConversation,
      locale,
      currentAnswer: null,
      messages: refreshedMessages,
      answeredQuestionKeys,
      latestClarification: null,
    });

    const assistantMessage = await createAssistantMessage({
      conversationId: ownedConversation.id,
      inReplyToMessageId: ideaMessage.id,
      status: 'COMPLETED',
      contentBlocks: produced.blocks,
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      locale,
      provider: produced.provider,
      model: produced.model,
      policyVersion: PROJECT_AUTHORING_POLICY_VERSION,
      latencyMs: produced.latencyMs,
      inputTokens: produced.inputTokens,
      outputTokens: produced.outputTokens,
    });

    await touchConversationActivity({
      conversationId: ownedConversation.id,
      locale,
      title: project.title,
    });

    return mapAuthoringTurnResponse({
      conversation: ownedConversation,
      userMessage: ideaMessage,
      assistantMessage,
      blocks: produced.blocks,
      locale,
    });
  } catch (error) {
    logger.warn(
      {
        err: error,
        conversationId: ownedConversation.id,
        learningProjectId: ownedConversation.learningProjectId,
      },
      'Project authoring bootstrap failed',
    );
    throw error;
  } finally {
    await releaseConversationProcessingLock(ownedConversation.id);
  }
};

export const sendProjectAuthoringMessageForUser = async (input: {
  userId: string;
  conversationId: string;
  text: string;
  locale: AiLocale;
  clientMessageId: string;
}): Promise<AiTurnResponse> => {
  const ownedConversation = await findOwnedConversation({
    conversationId: input.conversationId,
    userId: input.userId,
  });

  if (!ownedConversation) {
    throw new AppError(
      'Conversation not found.',
      404,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  await assertAuthoringConversation(ownedConversation, input.userId);

  const existingUserMessage = await findUserMessageByClientId({
    conversationId: ownedConversation.id,
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
      return mapAuthoringTurnResponse({
        conversation: ownedConversation,
        userMessage: existingUserMessage,
        assistantMessage: existingAssistant,
        blocks: parseStoredContentBlocks(existingAssistant.contentBlocks),
        locale: input.locale,
      });
    }

    if (
      existingAssistant?.status !== 'FAILED' &&
      (existingAssistant?.status === 'PROCESSING' ||
        ownedConversation.processingState === 'PROCESSING')
    ) {
      throw new AppError(
        'This conversation is already processing a message.',
        409,
        'AI_CONVERSATION_BUSY',
      );
    }
  }

  await acquireAuthoringLock(ownedConversation.id);

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
        conversationId: ownedConversation.id,
        contentText: input.text,
        clientMessageId: input.clientMessageId,
        locale: input.locale,
      });
    }

    const deterministic = classifyScopeDeterministic(input.text);
    if (deterministic.classification === 'DANGEROUS_REQUEST') {
      const blocks = [textBlock(DANGEROUS_SAFETY_COPY[input.locale], 'safety')];
      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: userMessage.id,
        status: 'REFUSED',
        contentBlocks: blocks,
        scopeClassification: 'DANGEROUS_REQUEST',
        locale: input.locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_POLICY_VERSION,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
      });

      await touchConversationActivity({
        conversationId: ownedConversation.id,
        locale: input.locale,
      });

      return mapAuthoringTurnResponse({
        conversation: ownedConversation,
        userMessage,
        assistantMessage,
        blocks,
        locale: input.locale,
      });
    }

    if (deterministic.classification === 'OUT_OF_SCOPE') {
      const blocks = [textBlock(AUTHORING_OFF_TOPIC_COPY[input.locale], 'refusal')];
      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: userMessage.id,
        status: 'REFUSED',
        contentBlocks: blocks,
        scopeClassification: 'OUT_OF_SCOPE',
        locale: input.locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_POLICY_VERSION,
        latencyMs: null,
        inputTokens: null,
        outputTokens: null,
      });

      await touchConversationActivity({
        conversationId: ownedConversation.id,
        locale: input.locale,
      });

      return mapAuthoringTurnResponse({
        conversation: ownedConversation,
        userMessage,
        assistantMessage,
        blocks,
        locale: input.locale,
      });
    }

    const messages = await loadRecentConversationMessages({
      conversationId: ownedConversation.id,
      limit: env.aiChatMaxHistoryMessages,
    });
    const answeredQuestionKeys = extractAnsweredQuestionKeys(messages);
    const latestClarification = findLatestClarificationBlock(messages);

    const produced = await produceAuthoringClarification({
      conversation: ownedConversation,
      locale: input.locale,
      currentAnswer: input.text,
      messages,
      answeredQuestionKeys,
      latestClarification,
    });

    const assistantMessage = await createAssistantMessage({
      conversationId: ownedConversation.id,
      inReplyToMessageId: userMessage.id,
      status: 'COMPLETED',
      contentBlocks: produced.blocks,
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      locale: input.locale,
      provider: produced.provider,
      model: produced.model,
      policyVersion: PROJECT_AUTHORING_POLICY_VERSION,
      latencyMs: produced.latencyMs,
      inputTokens: produced.inputTokens,
      outputTokens: produced.outputTokens,
    });

    await touchConversationActivity({
      conversationId: ownedConversation.id,
      locale: input.locale,
    });

    return mapAuthoringTurnResponse({
      conversation: ownedConversation,
      userMessage,
      assistantMessage,
      blocks: produced.blocks,
      locale: input.locale,
    });
  } catch (error) {
    if (
      error instanceof AppError &&
      ['AI_PROVIDER_TIMEOUT', 'AI_PROVIDER_RATE_LIMITED', 'AI_RESPONSE_INVALID'].includes(
        error.code ?? '',
      )
    ) {
      throw error;
    }

    if (error instanceof AppError) {
      throw error;
    }

    logger.warn(
      {
        err: error,
        conversationId: ownedConversation.id,
      },
      'Project authoring message turn failed',
    );

    throw new AppError(
      input.locale === 'ar'
        ? 'تعذر معالجة رسالة التأليف. حاول مرة أخرى.'
        : 'Could not process the authoring message. Please try again.',
      502,
      'AI_AUTHORING_TURN_FAILED',
    );
  } finally {
    await releaseConversationProcessingLock(ownedConversation.id);
  }
};

export const findLatestAuthoringClarificationForTests = findLatestClarificationBlock;
export { MAX_AUTHORING_CLARIFICATION_QUESTIONS };

const produceAuthoringProposal = async (input: {
  conversation: AiConversation;
  locale: AiLocale;
  project: NonNullable<
    Awaited<
      ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>
    >
  >;
  clarification: AiProjectAuthoringClarificationBlock;
  clarificationMessageId: string;
  messages: AiMessage[];
}) => {
  if (!isAiChatProviderOperational()) {
    throw new AppError(
      input.locale === 'ar'
        ? 'مساعد الذكاء الاصطناعي غير متاح حاليًا.'
        : 'The AI assistant is currently unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  const ideaMessage = findInitialIdeaMessage(input.messages);
  if (!ideaMessage?.contentText?.trim()) {
    throw new AppError(
      'Authoring idea message is missing.',
      409,
      'AI_AUTHORING_IDEA_MISSING',
    );
  }

  const baseUpdatedAt = input.project.updatedAt.toISOString();
  const categoryDisplayName =
    input.locale === 'ar'
      ? input.project.category?.nameAr ?? input.project.category?.nameEn ?? 'Project'
      : input.project.category?.nameEn ?? input.project.category?.nameAr ?? 'Project';

  const recentAuthoringAnswers = input.messages
    .filter(
      (message) =>
        message.role === 'USER' &&
        message.id !== ideaMessage.id &&
        message.contentText?.trim(),
    )
    .slice(-6)
    .map((message) => message.contentText!.trim());

  const proposalContext = {
    locale: input.locale,
    ideaText: ideaMessage.contentText.trim(),
    projectTitle: input.project.title,
    projectShortDescription: input.project.shortDescription,
    projectDescription: input.project.description,
    categoryName: categoryDisplayName,
    draftDifficulty: input.project.difficulty,
    componentNames: (input.project.requiredComponents ?? []).map(
      (component) => component.componentName,
    ),
    stepTitles: (input.project.steps ?? []).map((step) => step.title),
    baseUpdatedAt,
    clarification: input.clarification,
    clarificationMessageId: input.clarificationMessageId,
    recentAuthoringAnswers,
    repairAttempt: false,
    repairIssue: null,
    previousInvalidOutput: null,
  };

  const qualityContext = {
    locale: input.locale,
    ideaText: proposalContext.ideaText,
    categoryName: categoryDisplayName,
    draftDifficulty: input.project.difficulty,
    clarification: input.clarification,
    recentAuthoringAnswers,
  };

  const isRepairableProviderFailure = (error: unknown) => {
    if (error instanceof AppError) {
      return error.code === 'AI_RESPONSE_INVALID';
    }

    return true;
  };

  let providerResult: Awaited<ReturnType<typeof generateAuthoringProposal>>;
  let usedRepair = false;

  try {
    providerResult = await generateAuthoringProposal(proposalContext);
  } catch (error) {
    if (!isRepairableProviderFailure(error) || usedRepair) {
      if (error instanceof AppError) {
        throw error;
      }
      throwInvalidAuthoringProposal(input.locale);
    }

    usedRepair = true;
    try {
      providerResult = await generateAuthoringProposal({
        ...proposalContext,
        repairAttempt: true,
        repairIssue: buildAuthoringProposalRepairIssue({
          schemaError:
            'Provider JSON was malformed or truncated. Return complete valid JSON with concise step descriptions.',
        }),
        previousInvalidOutput: null,
      });
    } catch (repairError) {
      if (repairError instanceof AppError) {
        throw repairError;
      }
      throwInvalidAuthoringProposal(input.locale);
    }
  }

  let normalized = normalizeAuthoringProposalProviderPayload(providerResult.data);
  let quality = validateAuthoringProposalQuality(normalized, qualityContext);

  if (!quality.ok) {
    if (usedRepair) {
      throwInvalidAuthoringProposal(input.locale);
    }

    usedRepair = true;
    try {
      providerResult = await generateAuthoringProposal({
        ...proposalContext,
        repairAttempt: true,
        repairIssue: buildAuthoringProposalRepairIssue({ quality }),
        previousInvalidOutput: JSON.stringify(providerResult.data).slice(0, 1500),
      });
      normalized = normalizeAuthoringProposalProviderPayload(providerResult.data);
      quality = validateAuthoringProposalQuality(normalized, qualityContext);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throwInvalidAuthoringProposal(input.locale);
    }
  }

  if (!quality.ok) {
    throwInvalidAuthoringProposal(input.locale);
  }

  const mergedWarnings = [...normalized.warnings, ...quality.warnings];

  const proposalBlock = stampAuthoringProposalBlock({
    proposalId: randomUUID(),
    baseUpdatedAt,
    clarificationMessageId: input.clarificationMessageId,
    categoryDisplayName,
    providerPayload: {
      ...normalized,
      warnings: mergedWarnings,
    },
    extraWarnings: [],
  });

  const assistantText =
    providerResult.data.assistantText.trim() ||
    (input.locale === 'ar'
      ? 'إليك معاينة منظمة لمشروعك. لم يتم تغيير مسودتك المحفوظة.'
      : 'Here is a structured preview of your project. Your saved draft has not been changed.');

  return {
    blocks: [textBlock(assistantText), proposalBlock] as AiContentBlock[],
    provider: providerResult.provider,
    model: providerResult.model,
    latencyMs: providerResult.latencyMs,
    inputTokens: providerResult.usage.inputTokens,
    outputTokens: providerResult.usage.outputTokens,
  };
};

export const generateProjectAuthoringProposalForUser = async (
  userId: string,
  conversationId: string,
): Promise<AiTurnResponse> => beginGuidedAuthoringOverviewForUser(userId, conversationId);

export const findCurrentAuthoringProposalForTests = findCurrentProposalState;
