import { randomUUID } from 'node:crypto';

import type {
  AiConversation,
  ProjectAuthoringSessionStage,
  ProjectAuthoringTurn,
  ProjectAuthoringTurnKind,
} from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  applyAuthoringStageToMyDraft,
  type AuthoringSequentialStagePatch,
} from '../learning-projects/learning-projects.service.js';
import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';

import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import {
  createAssistantMessage,
  createUserMessage,
  findAssistantReplyToUserMessage,
  findOwnedConversation,
  findUserMessageByClientId,
  loadRecentConversationMessages,
  touchConversationActivity,
} from './ai.repository.js';
import { parseStoredContentBlocks } from './ai-context-builder.js';
import type { AiContentBlock } from './ai.content-blocks.js';
import { deriveNextAuthoringStageFromProject, validateComponentStepConsistency } from './ai-project-authoring-sequential.policy.js';
import { generateSequentialStageDiscussionWithRepair } from './ai-project-authoring-sequential-discussion.provider.js';
import { toSequentialSteps } from './ai-project-authoring-sequential-steps.provider.js';
import {
  executePersistedAuthoringAction,
  type PersistedActionBody,
  type PersistedAuthoringAction as SessionPersistedAuthoringAction,
} from './project-authoring-session.actions.js';
import { PROJECT_AUTHORING_SESSION_POLICY_VERSION } from './project-authoring-session.constants.js';
import {
  advanceOverviewToTitleProposal,
  assertPersistedAuthoringContext,
  assertProposalPayloadDistinctFromUserMessage,
  assertSessionLanguageSurface,
  buildComponentItemTurn,
  buildComponentListTurn,
  buildStepAuthoringContext,
  buildStepItemTurn,
  buildStepPlanTurn,
  ensureOverviewClarificationTurn,
  hasOverviewClarificationCompleted,
  initComponentWorkingState,
  learnerConstraintHints,
  loadAuthoringConversationHistory,
  loadProjectForConversation,
  processOverviewClarificationAnswer,
  processStepsStageComposerMessage,
  parseRequestedComponentCount,
  parseRequestedStepCount,
  persistSessionConfirmedRequirements,
  projectComponentsAsSequential,
  readCanonicalStageValue,
  resolveAndPersistAuthoringContentLocale,
  resolveStepsComposerIntent,
  generateStepsConversationExplanation,
  generateScalarConversationExplanation,
  resolveScalarComposerIntent,
  resolveStructuredClarificationAnswer,
  serializeAuthoringStepPlanPayload,
  tryGenerateStepPlan,
  validateAuthoringStepPlanForSession,
  validateRequestedComponentCount,
  validateRequestedStepCount,
} from './project-authoring-session.helpers.js';

export { assertPersistedAuthoringContext };
import {
  buildLegacyAuthoringSnapshotFromPersistedSession,
  buildAuthoringSessionResponse,
  buildLegacyBlocksFromPersistedSession,
  parseComponentWorkingState,
  parseStepWorkingState,
  type AuthoringSessionResponse,
  type SequentialStep,
  type StepWorkingState,
} from './project-authoring-session.state.js';
import {
  projectAuthoringSessionRepository,
  type ProjectAuthoringSessionWithTurn,
} from './project-authoring-session.repository.js';
import type { AiLocale, AiTurnResponse } from './ai.types.js';

type ProjectRecord = NonNullable<
  Awaited<ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>>
>;

const textBlock = (text: string): AiContentBlock => ({
  type: 'text',
  text,
  purpose: 'answer',
});

const reconcilePersistedAuthoringSessionForLoad = async (input: {
  session: ProjectAuthoringSessionWithTurn;
  project: ProjectRecord;
  locale: AiLocale;
}): Promise<ProjectAuthoringSessionWithTurn> => {
  const componentState = parseComponentWorkingState(input.session.componentWorkingState);
  const stepState = parseStepWorkingState(input.session.stepWorkingState);
  const currentTurn = input.session.currentTurn;

  if (
    input.session.stage === 'COMPONENTS' &&
    componentState?.mode === 'ONE_BY_ONE' &&
    !componentState.awaitingFinalSave &&
    (!currentTurn || currentTurn.kind !== 'COMPONENT_ITEM')
  ) {
    const itemTurn = buildComponentItemTurn({ componentState, locale: input.locale });
    return projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: input.session.id,
      expectedVersion: input.session.version,
      turn: {
        id: randomUUID(),
        sessionId: input.session.id,
        stage: 'COMPONENTS',
        kind: itemTurn.kind,
        status: 'PROPOSED',
        payload: itemTurn.payload,
        explanation: itemTurn.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        status: 'WAITING_FOR_USER',
        componentWorkingState: componentState,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
    });
  }

  if (
    input.session.stage === 'STEP_REVIEW' &&
    stepState?.mode === 'STEP_BY_STEP' &&
    !stepState.awaitingFinalSave &&
    (!currentTurn || currentTurn.kind !== 'STEP_ITEM')
  ) {
    const itemTurn = buildStepItemTurn({ stepState, locale: input.locale });
    return projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: input.session.id,
      expectedVersion: input.session.version,
      turn: {
        id: randomUUID(),
        sessionId: input.session.id,
        stage: 'STEP_REVIEW',
        kind: itemTurn.kind,
        status: 'PROPOSED',
        payload: itemTurn.payload,
        explanation: itemTurn.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        status: 'WAITING_FOR_USER',
        stepWorkingState: stepState,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
    });
  }

  if (
    stepState?.awaitingFinalSave &&
    (input.session.stage === 'STEPS_OVERVIEW' || input.session.stage === 'STEP_REVIEW') &&
    (!currentTurn || currentTurn.kind !== 'STEP_PLAN')
  ) {
    const planTurn = buildStepPlanTurn({
      steps: stepState.workingSteps,
      locale: input.locale,
      awaitingFinalSave: true,
    });
    return projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: input.session.id,
      expectedVersion: input.session.version,
      turn: {
        id: randomUUID(),
        sessionId: input.session.id,
        stage: input.session.stage === 'STEP_REVIEW' ? 'STEP_REVIEW' : 'STEPS_OVERVIEW',
        kind: planTurn.kind,
        status: 'PROPOSED',
        payload: planTurn.payload,
        explanation: planTurn.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        status: 'WAITING_FOR_USER',
        stepWorkingState: stepState,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
    });
  }

  // GET/reload must remain read-only: never invoke the provider to create scalar
  // proposals. The learner must explicitly retry via REGENERATE_FAILED_STAGE.
  return input.session;
};

export const buildPersistedAuthoringContentBlocks = (input: {
  session: ProjectAuthoringSessionWithTurn;
  assistantText?: string;
  supersededTurn?: ProjectAuthoringTurn | null;
  acceptedTurn?: ProjectAuthoringTurn | null;
}): AiContentBlock[] => {
  const blocks: AiContentBlock[] = [];
  if (input.assistantText?.trim()) {
    blocks.push(textBlock(input.assistantText));
  }
  const legacyBlocks = buildLegacyBlocksFromPersistedSession({
    session: input.session,
    supersededTurn: input.supersededTurn ?? null,
    acceptedTurn: input.acceptedTurn ?? null,
  });
  blocks.push(...legacyBlocks);
  return blocks;
};

export const createPersistedAuthoringAssistantTurnResponse = async (input: {
  userId: string;
  conversation: AiConversation;
  project: ProjectRecord;
  session: ProjectAuthoringSessionWithTurn;
  locale: AiLocale;
  inReplyToMessageId: string;
  userMessageId?: string | null;
  assistantText?: string;
  supersededTurn?: ProjectAuthoringTurn | null;
  acceptedTurn?: ProjectAuthoringTurn | null;
}): Promise<AiTurnResponse> => {
  const blocks = buildPersistedAuthoringContentBlocks({
    session: input.session,
    assistantText: input.assistantText,
    supersededTurn: input.supersededTurn,
    acceptedTurn: input.acceptedTurn,
  });
  const assistantMessage = await createAssistantMessage({
    conversationId: input.conversation.id,
    inReplyToMessageId: input.inReplyToMessageId,
    status: 'COMPLETED',
    contentBlocks: blocks,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    locale: input.locale,
    provider: env.aiChatProvider,
    model: null,
    policyVersion: PROJECT_AUTHORING_SESSION_POLICY_VERSION,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
  });
  const messages = await loadRecentConversationMessages({
    conversationId: input.conversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });
  const authoringSnapshot = buildLegacyAuthoringSnapshotFromPersistedSession({
    session: input.session,
    project: input.project,
  });
  return {
    conversationId: input.conversation.id,
    userMessageId: input.userMessageId ?? input.inReplyToMessageId,
    assistantMessageId: assistantMessage.id,
    mode: 'PROJECT_AUTHORING',
    locale: input.locale,
    contentBlocks: blocks,
    authoringSnapshot,
    meta: {
      provider: assistantMessage.provider ?? 'system',
      model: assistantMessage.model ?? null,
      policyVersion:
        assistantMessage.policyVersion ?? PROJECT_AUTHORING_SESSION_POLICY_VERSION,
      scopeClassification: assistantMessage.scopeClassification ?? 'DOMAIN_KNOWLEDGE',
      latencyMs: assistantMessage.latencyMs ?? null,
      usage: {
        inputTokens: assistantMessage.inputTokens ?? null,
        outputTokens: assistantMessage.outputTokens ?? null,
      },
    },
  };
};

export const latestConversationMessageId = async (conversationId: string) => {
  const message = await prisma.aiMessage.findFirst({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  return message?.id ?? null;
};

const STAGE_ORDER: ProjectAuthoringSessionStage[] = [
  'OVERVIEW',
  'TITLE',
  'SHORT_DESCRIPTION',
  'FULL_DESCRIPTION',
  'DIFFICULTY',
  'ESTIMATED_DURATION',
  'COMPONENTS',
  'STEPS_OVERVIEW',
  'STEP_REVIEW',
  'FINAL_REVIEW',
  'COMPLETE',
];

const nextStageAfter = (stage: ProjectAuthoringSessionStage): ProjectAuthoringSessionStage => {
  const index = STAGE_ORDER.indexOf(stage);
  if (index < 0 || index >= STAGE_ORDER.length - 1) {
    return 'COMPLETE';
  }
  return STAGE_ORDER[index + 1]!;
};

const deriveInitialStage = (project: ProjectRecord): ProjectAuthoringSessionStage =>
  deriveNextAuthoringStageFromProject({
    title: project.title,
    shortDescription: project.shortDescription,
    description: project.description,
    difficulty: project.difficulty,
    estimatedDurationMinutes: project.estimatedDurationMinutes,
    requiredComponents: project.requiredComponents.map((component) => ({
      componentName: component.componentName,
    })),
    steps: project.steps.map((step) => ({ title: step.title })),
  }) as ProjectAuthoringSessionStage;

const deriveCompletedStages = (project: ProjectRecord): ProjectAuthoringSessionStage[] => {
  const stage = deriveInitialStage(project);
  const index = STAGE_ORDER.indexOf(stage);
  if (index <= 0) {
    return [];
  }
  return STAGE_ORDER.slice(0, index);
};

export const ensurePersistedAuthoringSession = async (input: {
  userId: string;
  conversationId: string;
  project: ProjectRecord;
  componentWorkingState?: Record<string, unknown>;
  stepWorkingState?: Record<string, unknown>;
  initialStage?: ProjectAuthoringSessionStage;
}): Promise<ProjectAuthoringSessionWithTurn> => {
  const existing = await projectAuthoringSessionRepository.findByConversationId(
    input.conversationId,
  );
  if (existing) {
    return existing;
  }

  const derivedStage = deriveInitialStage(input.project);
  const stage = input.initialStage ?? derivedStage;
  const completedStages =
    input.initialStage === 'OVERVIEW'
      ? []
      : deriveCompletedStages(input.project);

  return projectAuthoringSessionRepository.createSession({
    conversationId: input.conversationId,
    learningProjectId: input.project.id,
    ownerId: input.userId,
    stage: stage === 'STEP_REVIEW' ? 'STEPS_OVERVIEW' : stage,
    status: 'WAITING_FOR_USER',
    baseProjectUpdatedAt: input.project.updatedAt,
    completedStages,
    componentWorkingState: input.componentWorkingState,
    stepWorkingState: input.stepWorkingState,
  });
};

const assistantTurnMetadataBlock = (turnId: string) => ({
  type: 'project_authoring_turn_ref',
  turnId,
});

const canonicalScalarForStage = (
  project: ProjectRecord,
  stage: ProjectAuthoringSessionStage,
): string | number | null => {
  switch (stage) {
    case 'TITLE':
      return project.title;
    case 'SHORT_DESCRIPTION':
      return project.shortDescription;
    case 'FULL_DESCRIPTION':
      return project.description;
    case 'DIFFICULTY':
      return project.difficulty;
    case 'ESTIMATED_DURATION':
      return project.estimatedDurationMinutes;
    default:
      return null;
  }
};

const componentsFromPayload = (payload: Record<string, unknown>) => {
  const components = payload.components;
  return Array.isArray(components) ? components : [];
};

const stepsFromPayload = (payload: Record<string, unknown>) => {
  const steps = payload.steps;
  return Array.isArray(steps) ? steps : [];
};

const normalizeStepComment = (comment: string) =>
  comment
    .trim()
    .toLowerCase()
    .replace(/[!.؟?،,]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/أ/g, 'ا')
    .replace(/إ/g, 'ا')
    .replace(/آ/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

const ordinalStepIndexFromComment = (comment: string, stepCount: number) => {
  const normalized = normalizeStepComment(comment);
  const matchers: Array<[RegExp, number]> = [
    [/اول|الاول|first/, 0],
    [/ثان|second/, 1],
    [/ثالث|third/, 2],
    [/رابع|fourth/, 3],
    [/خامس|fifth/, 4],
  ];
  for (const [pattern, index] of matchers) {
    if (pattern.test(normalized) && index < stepCount) {
      return index;
    }
  }
  const digitMatch = normalized.match(/\b([1-9])\b/);
  if (digitMatch) {
    const index = Number(digitMatch[1]) - 1;
    if (index >= 0 && index < stepCount) {
      return index;
    }
  }
  return 0;
};

const enrichStepExplanationText = (
  comment: string,
  steps: Array<{ title: string; description: string; safetyNote?: string | null }>,
  locale: AiLocale,
  fallback: string,
) => {
  if (steps.length === 0) {
    return fallback;
  }
  const index = ordinalStepIndexFromComment(comment, steps.length);
  const step = steps[index];
  if (!step) {
    return fallback;
  }
  const safety = step.safetyNote?.trim() ? `\n\n${step.safetyNote.trim()}` : '';
  return locale === 'ar'
    ? `الخطوة ${index + 1}: ${step.title}\n\n${step.description}${safety}\n\nنصائح للتنفيذ:\n- جهّز المكوّنات والأدوات قبل البدء.\n- تحقق من التوصيلات قبل تشغيل الدائرة.\n- اختبر كل جزء على حدة قبل المتابعة.\n\nهذه الخطوة تبني على ما قبلها وتجهّزك للخطوة التالية بأمان.`
    : `Step ${index + 1}: ${step.title}\n\n${step.description}${safety}\n\nTips:\n- Prepare components and tools before starting.\n- Verify connections before powering the circuit.\n- Test each part individually before continuing.\n\nThis step builds on earlier work and prepares the next step safely.`;
};

type StepReviewComposerIntent = 'EXPLANATION' | 'REVISION';

const hasExplicitStepReference = (comment: string) => {
  const normalized = normalizeStepComment(comment);
  return (
    /اول|الاول|first/.test(normalized) ||
    /ثان|second/.test(normalized) ||
    /ثالث|third/.test(normalized) ||
    /رابع|fourth/.test(normalized) ||
    /خامس|fifth/.test(normalized) ||
    /\b[1-9]\b/.test(normalized)
  );
};

const resolveStepReviewTargetIndex = (comment: string, stepState: StepWorkingState) => {
  if (hasExplicitStepReference(comment)) {
    return ordinalStepIndexFromComment(comment, stepState.workingSteps.length);
  }
  return stepState.currentIndex;
};

const classifyStepReviewComposerIntent = (comment: string): StepReviewComposerIntent => {
  const normalized = normalizeStepComment(comment);
  if (
    normalized.includes('بسط') ||
    normalized.includes('اضف') ||
    normalized.includes('غير') ||
    normalized.includes('عدل') ||
    normalized.includes('خلي') ||
    normalized.includes('حذف') ||
    normalized.includes('ازل') ||
    normalized.includes('simplif') ||
    normalized.includes('revise') ||
    normalized.includes('change') ||
    normalized.includes('update') ||
    (normalized.includes('add') && !normalized.includes('explain'))
  ) {
    return 'REVISION';
  }
  if (
    normalized.includes('اشرح') ||
    normalized.includes('وضح') ||
    normalized.includes('ليش') ||
    normalized.includes('لماذا') ||
    normalized.includes('ليه') ||
    normalized.includes('كيف') ||
    normalized.includes('شو') ||
    normalized.includes('explain') ||
    normalized.includes('why') ||
    normalized.includes('how') ||
    normalized.includes('what') ||
    normalized.includes('detail') ||
    normalized.includes('احتياط') ||
    normalized.includes('تفصيل') ||
    comment.includes('?') ||
    comment.includes('؟')
  ) {
    return 'EXPLANATION';
  }
  return 'EXPLANATION';
};

const mapConversationMessagesForAuthoringResponse = (
  messages: Awaited<ReturnType<typeof loadRecentConversationMessages>>,
) =>
  messages.map((message) => {
    const blocks = message.contentBlocks
      ? parseStoredContentBlocks(message.contentBlocks)
      : [];
    const textFromBlocks = blocks
      .filter(
        (block): block is Extract<(typeof blocks)[number], { type: 'text' }> =>
          block.type === 'text',
      )
      .map((block) => block.text)
      .join('\n\n')
      .trim();
    return {
      id: message.id,
      role: message.role,
      status: message.status,
      contentText: message.contentText ?? (textFromBlocks || null),
      contentBlocks: blocks,
      createdAt: message.createdAt.toISOString(),
      clientMessageId: message.clientMessageId ?? null,
    };
  });

const buildAuthoringSessionResponseWithMessages = async (input: {
  session: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  project: ProjectRecord;
  conversationId: string;
}): Promise<AuthoringSessionResponse> => {
  const messages = await loadRecentConversationMessages({
    conversationId: input.conversationId,
    limit: env.aiChatMaxHistoryMessages,
  });
  return {
    ...buildAuthoringSessionResponse({ session: input.session, project: input.project }),
    conversationMessages: mapConversationMessagesForAuthoringResponse(messages),
  };
};

const persistStepReviewAssistantReply = async (input: {
  conversationId: string;
  locale: AiLocale;
  projectTitle: string;
  inReplyToMessageId: string;
  assistantText: string;
}) => {
  await createAssistantMessage({
    conversationId: input.conversationId,
    inReplyToMessageId: input.inReplyToMessageId,
    status: 'COMPLETED',
    contentBlocks: [textBlock(input.assistantText)],
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    locale: input.locale,
    provider: env.aiChatProvider,
    model: null,
    policyVersion: PROJECT_AUTHORING_SESSION_POLICY_VERSION,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
  });
  await touchConversationActivity({
    conversationId: input.conversationId,
    locale: input.locale,
    title: input.projectTitle,
  });
};

const handleStepReviewComposerFeedback = async (input: {
  userId: string;
  sessionId: string;
  sessionRecord: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  conversation: { id: string; locale: string };
  project: ProjectRecord;
  locale: AiLocale;
  comment: string;
  userMessageId: string;
  expectedVersion: number;
  skipLegacyAssistantMessage?: boolean;
}): Promise<AuthoringSessionResponse | AiTurnResponse | null> => {
  const stepState = parseStepWorkingState(input.sessionRecord.stepWorkingState);
  if (!stepState || stepState.workingSteps.length === 0) {
    throw new AppError('Step working state is missing.', 409, 'VALIDATION_ERROR');
  }

  const workingSteps = stepState.workingSteps as SequentialStep[];
  const listContext = await buildStepAuthoringContext({
    project: input.project,
    conversationId: input.conversation.id,
    sessionId: input.sessionId,
    uiLocale: input.locale,
    userComment: input.comment,
    sessionRecord: input.sessionRecord,
  });
  const composerResult = await processStepsStageComposerMessage({
    stage: 'STEP_REVIEW',
    comment: input.comment,
    context: listContext,
    currentSteps: workingSteps,
    project: input.project,
    conversationId: input.conversation.id,
    activeStepIndex: stepState.currentIndex,
    sessionId: input.sessionId,
    expectedVersion: input.expectedVersion,
    sessionRecord: input.sessionRecord,
  });

  if (composerResult.kind === 'EXPLANATION' || composerResult.kind === 'FOLLOW_UP') {
    assertSessionLanguageSurface(
      listContext.locale,
      composerResult.assistantText,
      'step review composer reply',
    );
    await persistStepReviewAssistantReply({
      conversationId: input.conversation.id,
      locale: listContext.locale,
      projectTitle: input.project.title,
      inReplyToMessageId: input.userMessageId,
      assistantText: composerResult.assistantText,
    });
    const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
      input.sessionId,
      input.userId,
    );
    return buildAuthoringSessionResponseWithMessages({
      session: refreshed!,
      project: input.project,
      conversationId: input.conversation.id,
    });
  }

  const targetIndex = resolveStepReviewTargetIndex(input.comment, stepState);
  const nextWorkingSteps = composerResult.steps;
  if (nextWorkingSteps.length === 0) {
    throw new AppError(
      input.locale === 'ar'
        ? 'لا يمكن إزالة جميع الخطوات أثناء المراجعة.'
        : 'Cannot remove every step during review.',
      409,
      'VALIDATION_ERROR',
    );
  }

  const nextIndex = Math.min(targetIndex, nextWorkingSteps.length - 1);
  const nextState = {
    ...stepState,
    workingSteps: nextWorkingSteps,
    currentIndex: nextIndex,
  };
  const itemTurn = buildStepItemTurn({ stepState: nextState, locale: listContext.locale });
  const refreshed = await projectAuthoringSessionRepository.setCurrentTurn({
    sessionId: input.sessionId,
    expectedVersion: input.expectedVersion,
    turn: {
      id: randomUUID(),
      sessionId: input.sessionId,
      stage: 'STEP_REVIEW',
      kind: itemTurn.kind,
      status: 'PROPOSED',
      payload: itemTurn.payload,
      explanation: itemTurn.explanation,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      stepWorkingState: nextState,
      status: 'WAITING_FOR_USER',
    },
  });
  const assistantText = composerResult.assistantText;
  if (input.skipLegacyAssistantMessage) {
    await persistStepReviewAssistantReply({
      conversationId: input.conversation.id,
      locale: listContext.locale,
      projectTitle: input.project.title,
      inReplyToMessageId: input.userMessageId,
      assistantText,
    });
    return buildAuthoringSessionResponseWithMessages({
      session: refreshed,
      project: input.project,
      conversationId: input.conversation.id,
    });
  }
  return createPersistedAuthoringAssistantTurnResponse({
    userId: input.userId,
    conversation: input.conversation as never,
    project: input.project,
    session: refreshed,
    locale: input.locale,
    inReplyToMessageId: input.userMessageId,
    userMessageId: input.userMessageId,
    assistantText,
  });
};

const readTrustedComponentList = (
  session: ProjectAuthoringSessionWithTurn,
  turn: { payload: unknown },
) => {
  const working = session.componentWorkingState as { components?: unknown } | null;
  if (working?.components && Array.isArray(working.components) && working.components.length > 0) {
    return working.components;
  }
  return componentsFromPayload(turn.payload as Record<string, unknown>);
};

const readTrustedStepList = (
  session: ProjectAuthoringSessionWithTurn,
  turn: { payload: unknown },
) => {
  const working = session.stepWorkingState as { steps?: unknown } | null;
  if (working?.steps && Array.isArray(working.steps) && working.steps.length > 0) {
    return working.steps;
  }
  return stepsFromPayload(turn.payload as Record<string, unknown>);
};

export const getPersistedAuthoringSessionState = async (
  userId: string,
  conversationId: string,
): Promise<AuthoringSessionResponse | null> => {
  const { conversation, project } = await loadProjectForConversation(userId, conversationId);
  const session = await projectAuthoringSessionRepository.findByConversationId(conversationId);
  if (!session) {
    return null;
  }
  assertPersistedAuthoringContext({
    conversationId,
    conversation,
    session,
    project,
    userId,
  });
  return buildAuthoringSessionResponseWithMessages({
    session,
    project,
    conversationId,
  });
};

export const getPersistedAuthoringSessionStateById = async (
  userId: string,
  sessionId: string,
): Promise<AuthoringSessionResponse> => {
  const session = await projectAuthoringSessionRepository.findByIdForOwner(sessionId, userId);
  if (!session) {
    throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
  }
  const { conversation, project } = await loadProjectForConversation(userId, session.conversationId);
  assertPersistedAuthoringContext({
    conversationId: session.conversationId,
    conversation,
    session,
    project,
    userId,
  });
  const uiLocale = (conversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;
  const { locale: contentLocale, session: sessionWithLocale } =
    await resolveAndPersistAuthoringContentLocale({
      conversationId: session.conversationId,
      project,
      uiLocale,
      sessionRecord: session,
    });
  const reconciled = await reconcilePersistedAuthoringSessionForLoad({
    session: sessionWithLocale,
    project,
    locale: contentLocale,
  });
  return buildAuthoringSessionResponseWithMessages({
    session: reconciled,
    project,
    conversationId: session.conversationId,
  });
};

export const startPersistedAuthoringSession = async (
  userId: string,
  conversationId: string,
  options?: { writeLegacyMessage?: boolean; advanceToTitle?: boolean },
): Promise<AuthoringSessionResponse | AiTurnResponse> => {
  const { conversation, project } = await loadProjectForConversation(userId, conversationId);
  const uiLocale = (conversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;
  let session = await ensurePersistedAuthoringSession({
    userId,
    conversationId,
    project,
    initialStage: 'OVERVIEW',
  });
  assertPersistedAuthoringContext({
    conversationId,
    conversation,
    session,
    project,
    userId,
  });

  const resolvedLocale = await resolveAndPersistAuthoringContentLocale({
    conversationId,
    project,
    uiLocale,
    sessionRecord: session,
  });
  session = resolvedLocale.session;
  const locale = resolvedLocale.locale;

  if (session.stage !== 'OVERVIEW') {
    const reconciled = await reconcilePersistedAuthoringSessionForLoad({
      session,
      project,
      locale,
    });
    if (options?.writeLegacyMessage === false) {
      return buildAuthoringSessionResponseWithMessages({
        session: reconciled,
        project,
        conversationId,
      });
    }
    return buildAuthoringSessionResponseWithMessages({
      session: reconciled,
      project,
      conversationId,
    });
  }

  if (session.stage === 'OVERVIEW') {
    if (session.currentTurn?.kind === 'FOLLOW_UP_QUESTION' && options?.advanceToTitle) {
      session = await projectAuthoringSessionRepository.abandonCurrentTurn({
        sessionId: session.id,
        expectedVersion: session.version,
        turnId: session.currentTurnId!,
        sessionPatch: {
          status: 'WAITING_FOR_USER',
        },
      });
    } else if (session.currentTurn?.kind === 'FOLLOW_UP_QUESTION' && !options?.advanceToTitle) {
      if (options?.writeLegacyMessage === false) {
        return buildAuthoringSessionResponseWithMessages({
          session,
          project,
          conversationId,
        });
      }
      const inReplyToMessageId =
        (await latestConversationMessageId(conversationId)) ?? conversation.id;
      const question =
        (session.currentTurn.payload as { question?: string }).question ??
        session.currentTurn.explanation;
      return createPersistedAuthoringAssistantTurnResponse({
        userId,
        conversation,
        project,
        session,
        locale,
        inReplyToMessageId,
        assistantText: question ?? undefined,
      });
    }

    if (!options?.advanceToTitle) {
      if (!session.currentTurnId) {
        const clarificationComplete = await hasOverviewClarificationCompleted(session.id);
        if (!clarificationComplete) {
          session = await ensureOverviewClarificationTurn({
            session,
            project,
            conversationId,
            locale,
          });
        }
      }
      if (options?.writeLegacyMessage === false) {
        return buildAuthoringSessionResponseWithMessages({
          session,
          project,
          conversationId,
        });
      }
      const inReplyToMessageId =
        (await latestConversationMessageId(conversationId)) ?? conversation.id;
      const assistantText =
        session.currentTurn?.kind === 'FOLLOW_UP_QUESTION'
          ? ((session.currentTurn.payload as { question?: string }).question ??
            session.currentTurn.explanation)
          : locale === 'ar'
            ? 'أصبحت فكرة مشروعك جاهزة. ابدأ التأليف الموجّه عندما تكون مستعدًا.'
            : 'Your project idea is ready. Start guided authoring when you are ready.';
      return createPersistedAuthoringAssistantTurnResponse({
        userId,
        conversation,
        project,
        session,
        locale,
        inReplyToMessageId,
        assistantText: assistantText ?? undefined,
      });
    }

    if (session.currentTurn?.kind === 'FOLLOW_UP_QUESTION') {
      throw new AppError(
        locale === 'ar'
          ? 'أجب عن أسئلة التوضيح قبل بدء التأليف الموجّه.'
          : 'Answer the clarification questions before starting guided authoring.',
        409,
        'AI_AUTHORING_INVALID_ACTION',
      );
    }
  }

  session = await advanceOverviewToTitleProposal({ session, project, locale });

  const assistantText =
    locale === 'ar'
      ? `لنبدأ بالعنوان.\n\nاقتراحي: ${readCanonicalStageValue(project, 'TITLE')}`
      : `Let's start with the title.\n\nMy suggestion: ${readCanonicalStageValue(project, 'TITLE')}`;

  if (options?.writeLegacyMessage === false) {
    return buildAuthoringSessionResponse({ session, project });
  }

  const inReplyToMessageId =
    (await latestConversationMessageId(conversationId)) ?? conversation.id;
  return createPersistedAuthoringAssistantTurnResponse({
    userId,
    conversation,
    project,
    session,
    locale,
    inReplyToMessageId,
    assistantText,
  });
};

export type PersistedAuthoringAction =
  | SessionPersistedAuthoringAction
  | 'GENERATE_STEP_PLAN';

export type PersistedAuthoringActionBody = Omit<PersistedActionBody, 'action'> & {
  action: PersistedAuthoringAction;
};

export const runPersistedAuthoringSessionAction = async (
  userId: string,
  sessionId: string,
  body: PersistedAuthoringActionBody,
): Promise<AuthoringSessionResponse> => {
  if (body.action === 'START') {
    const sessionRecord = await projectAuthoringSessionRepository.findByIdForOwner(
      sessionId,
      userId,
    );
    if (!sessionRecord) {
      throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
    }
    const started = await startPersistedAuthoringSession(
      userId,
      sessionRecord.conversationId,
      { writeLegacyMessage: false, advanceToTitle: true },
    );
    return started as AuthoringSessionResponse;
  }

  if (body.action === 'GENERATE_STEP_PLAN') {
    const sessionRecord = await projectAuthoringSessionRepository.findByIdForOwner(
      sessionId,
      userId,
    );
    if (!sessionRecord) {
      throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
    }
    const { conversation, project } = await loadProjectForConversation(
      userId,
      sessionRecord.conversationId,
    );
    const locale = (conversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;
    const { locale: contentLocale, session: sessionWithLocale } =
      await resolveAndPersistAuthoringContentLocale({
        conversationId: sessionRecord.conversationId,
        project,
        uiLocale: locale,
        sessionRecord,
      });
    const refreshed = await tryGenerateStepPlan({
      session: sessionWithLocale,
      project,
      locale: contentLocale,
    });
    return buildAuthoringSessionResponse({ session: refreshed, project });
  }

  return executePersistedAuthoringAction(
    userId,
    sessionId,
    body as PersistedActionBody,
  );
};

export const buildPersistedLegacySnapshot = async (
  userId: string,
  conversationId: string,
): Promise<ReturnType<typeof buildLegacyAuthoringSnapshotFromPersistedSession> | null> => {
  const { conversation, project } = await loadProjectForConversation(userId, conversationId);
  const session = await projectAuthoringSessionRepository.findByConversationId(conversationId);
  if (!session) {
    return null;
  }
  assertPersistedAuthoringContext({
    conversationId,
    conversation,
    session,
    project,
    userId,
  });
  return buildLegacyAuthoringSnapshotFromPersistedSession({ session, project });
};

export const hasPersistedAuthoringSession = async (conversationId: string) => {
  const session = await projectAuthoringSessionRepository.findByConversationId(conversationId);
  return session != null;
};

export const migrateLegacyConversationToPersistedSession = async (
  userId: string,
  conversationId: string,
  legacyWorking?: {
    componentWorkingState?: Record<string, unknown>;
    stepWorkingState?: Record<string, unknown>;
  },
) => {
  const { project } = await loadProjectForConversation(userId, conversationId);
  return ensurePersistedAuthoringSession({
    userId,
    conversationId,
    project,
    componentWorkingState: legacyWorking?.componentWorkingState,
    stepWorkingState: legacyWorking?.stepWorkingState,
  });
};

export const sendPersistedAuthoringSessionMessage = async (
  userId: string,
  sessionId: string,
  body: {
    text?: string;
    questionId?: string;
    selectedOptionIds?: string[];
    otherText?: string | null;
    currentTurnId?: string;
    clientMessageId?: string;
    expectedVersion: number;
  },
): Promise<AuthoringSessionResponse> => {
  let sessionRecord = await projectAuthoringSessionRepository.findByIdForOwner(
    sessionId,
    userId,
  );
  if (!sessionRecord) {
    throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
  }
  const { conversation, project } = await loadProjectForConversation(
    userId,
    sessionRecord.conversationId,
  );
  const uiLocale = (conversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;
  const { locale, session: sessionWithLocale } = await resolveAndPersistAuthoringContentLocale({
    conversationId: sessionRecord.conversationId,
    project,
    uiLocale,
    sessionRecord,
    userComment: body.text ?? body.otherText ?? null,
  });
  sessionRecord = sessionWithLocale;

  if (body.questionId) {
    await submitStructuredOverviewClarificationAnswer({
      userId,
      sessionId,
      sessionRecord,
      conversation,
      project,
      locale,
      questionId: body.questionId,
      selectedOptionIds: body.selectedOptionIds ?? [],
      otherText: body.otherText,
      currentTurnId: body.currentTurnId!,
      clientMessageId: body.clientMessageId,
      expectedVersion: body.expectedVersion,
    });
  } else {
    await submitPersistedComposerFeedback({
      userId,
      sessionId,
      conversation,
      project,
      locale,
      comment: body.text!,
      clientMessageId: body.clientMessageId,
      expectedVersion: body.expectedVersion,
      skipLegacyAssistantMessage: true,
    });
  }

  const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(sessionId, userId);
  return buildAuthoringSessionResponseWithMessages({
    session: refreshed!,
    project,
    conversationId: sessionRecord.conversationId,
  });
};

const submitStructuredOverviewClarificationAnswer = async (input: {
  userId: string;
  sessionId: string;
  sessionRecord: NonNullable<
    Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>
  >;
  conversation: { id: string; locale: string };
  project: ProjectRecord;
  locale: AiLocale;
  questionId: string;
  selectedOptionIds: string[];
  otherText?: string | null;
  currentTurnId: string;
  clientMessageId?: string;
  expectedVersion: number;
}) => {
  assertPersistedAuthoringContext({
    conversationId: input.sessionRecord.conversationId,
    conversation: {
      id: input.conversation.id,
      learningProjectId: input.project.id,
      userId: input.userId,
    },
    session: input.sessionRecord,
    project: input.project,
    userId: input.userId,
  });

  if (input.sessionRecord.stage !== 'OVERVIEW') {
    throw new AppError(
      input.locale === 'ar'
        ? 'التأليف الموجّه قيد التقدّم بالفعل.'
        : 'Guided authoring is already in progress.',
      409,
      'AI_AUTHORING_INVALID_ACTION',
    );
  }

  if (
    input.sessionRecord.currentTurnId !== input.currentTurnId ||
    !input.sessionRecord.currentTurn ||
    input.sessionRecord.currentTurn.kind !== 'FOLLOW_UP_QUESTION'
  ) {
    throw new AppError(
      input.locale === 'ar'
        ? 'سؤال التوضيح لم يعد نشطًا.'
        : 'The clarification question is no longer active.',
      409,
      'AI_AUTHORING_TURN_SUPERSEDED',
    );
  }

  const answerText = resolveStructuredClarificationAnswer({
    turnPayload: input.sessionRecord.currentTurn.payload as Record<string, unknown>,
    questionId: input.questionId,
    selectedOptionIds: input.selectedOptionIds,
    otherText: input.otherText,
    locale: input.locale,
  });

  const clientMessageId =
    input.clientMessageId ?? `authoring-clarify-${randomUUID().replace(/-/g, '').slice(0, 24)}`;

  const userMessage = await createUserMessage({
    conversationId: input.conversation.id,
    contentText: answerText,
    clientMessageId,
    locale: input.locale,
  });

  await processOverviewClarificationAnswer({
    session: input.sessionRecord,
    project: input.project,
    conversationId: input.conversation.id,
    locale: input.locale,
    answer: answerText,
    expectedVersion: input.expectedVersion,
    userMessageId: userMessage.id,
  });
};

const handleComponentFailureStateConversation = async (input: {
  userId: string;
  sessionId: string;
  sessionRecord: NonNullable<
    Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>
  >;
  conversation: { id: string; locale: string };
  project: ProjectRecord;
  locale: AiLocale;
  uiLocale: AiLocale;
  comment: string;
  userMessageId: string;
  expectedVersion: number;
}): Promise<AuthoringSessionResponse> => {
  const { processComponentStageComposerMessage } = await import(
    './ai-project-authoring-sequential-components.provider.js'
  );
  const componentContext = await buildStepAuthoringContext({
    project: input.project,
    conversationId: input.conversation.id,
    sessionId: input.sessionRecord.id,
    uiLocale: input.uiLocale,
    userComment: input.comment,
    sessionRecord: input.sessionRecord,
  });
  const workingState = parseComponentWorkingState(input.sessionRecord.componentWorkingState);
  const currentComponents = workingState?.workingComponents ?? [];
  const history = await loadAuthoringConversationHistory(input.conversation.id, 24);

  const composerResult = await processComponentStageComposerMessage({
    comment: input.comment,
    context: componentContext,
    currentComponents: currentComponents.map((component) => ({
      ...component,
      searchKeywords: component.searchKeywords ?? [],
      notes: component.notes ?? null,
    })),
    history,
    project: input.project,
  });

  if (composerResult.kind === 'EXPLANATION' || composerResult.kind === 'FOLLOW_UP') {
    assertSessionLanguageSurface(
      componentContext.locale,
      composerResult.assistantText,
      'component failure-state reply',
    );
    await persistStepReviewAssistantReply({
      conversationId: input.conversation.id,
      locale: componentContext.locale,
      projectTitle: input.project.title,
      inReplyToMessageId: input.userMessageId,
      assistantText: composerResult.assistantText,
    });
    await touchConversationActivity({
      conversationId: input.conversation.id,
      locale: componentContext.locale,
      title: input.project.title,
    });
    const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
      input.sessionId,
      input.userId,
    );
    return buildAuthoringSessionResponseWithMessages({
      session: refreshed!,
      project: input.project,
      conversationId: input.conversation.id,
    });
  }

  // A regeneration/revision request produced a fresh valid proposal. Recover the
  // stage: install a new COMPONENT_LIST turn, clear the failure status, and keep
  // the proposal unsaved until explicit finalization.
  for (const component of composerResult.components) {
    assertSessionLanguageSurface(
      componentContext.locale,
      `${component.componentName} ${component.notes ?? ''}`,
      'component item',
    );
  }
  const listTurn = buildComponentListTurn({
    components: composerResult.components,
    locale: componentContext.locale,
  });
  const nextComponentState = initComponentWorkingState(
    composerResult.components,
    workingState?.mode ?? 'FULL_LIST',
    null,
  );
  const recovered = await projectAuthoringSessionRepository.setCurrentTurn({
    sessionId: input.sessionRecord.id,
    expectedVersion: input.expectedVersion,
    turn: {
      id: randomUUID(),
      sessionId: input.sessionRecord.id,
      triggerUserMessageId: input.userMessageId,
      stage: 'COMPONENTS',
      kind: listTurn.kind,
      status: 'PROPOSED',
      payload: listTurn.payload,
      explanation: composerResult.assistantText || listTurn.explanation,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      status: 'WAITING_FOR_USER',
      componentWorkingState: nextComponentState,
      generationErrorCode: null,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
  });
  await persistStepReviewAssistantReply({
    conversationId: input.conversation.id,
    locale: componentContext.locale,
    projectTitle: input.project.title,
    inReplyToMessageId: input.userMessageId,
    assistantText:
      composerResult.assistantText ||
      (componentContext.locale === 'ar'
        ? 'أنشأت قائمة مكوّنات جديدة. راجعها قبل الحفظ.'
        : 'I generated a new component list. Review it before saving.'),
  });
  await touchConversationActivity({
    conversationId: input.conversation.id,
    locale: componentContext.locale,
    title: input.project.title,
  });
  return buildAuthoringSessionResponseWithMessages({
    session: recovered,
    project: input.project,
    conversationId: input.conversation.id,
  });
};

const handleStepsFailureStateConversation = async (input: {
  userId: string;
  sessionId: string;
  sessionRecord: NonNullable<
    Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>
  >;
  conversation: { id: string; locale: string };
  project: ProjectRecord;
  locale: AiLocale;
  uiLocale: AiLocale;
  comment: string;
  userMessageId: string;
  expectedVersion: number;
}): Promise<AuthoringSessionResponse> => {
  const listContext = await buildStepAuthoringContext({
    project: input.project,
    conversationId: input.conversation.id,
    sessionId: input.sessionRecord.id,
    uiLocale: input.uiLocale,
    userComment: input.comment,
    sessionRecord: input.sessionRecord,
  });
  const history = await loadAuthoringConversationHistory(input.conversation.id, 24);
  const intent = resolveStepsComposerIntent({
    comment: input.comment,
    history,
    stage: 'STEPS_OVERVIEW',
  });

  if (
    intent === 'EXPLAIN_CURRENT_PLAN' ||
    intent === 'ANSWER_PROJECT_QUESTION' ||
    intent === 'CONTINUE_PREVIOUS_RESPONSE' ||
    intent === 'CLARIFY_LEARNER_REQUEST'
  ) {
    const assistantText = await generateStepsConversationExplanation({
      locale: listContext.locale,
      comment: input.comment,
      history,
      context: listContext,
      currentSteps: [],
      intent,
    });
    assertSessionLanguageSurface(listContext.locale, assistantText, 'steps failure-state reply');
    await persistStepReviewAssistantReply({
      conversationId: input.conversation.id,
      locale: listContext.locale,
      projectTitle: input.project.title,
      inReplyToMessageId: input.userMessageId,
      assistantText,
    });
    const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
      input.sessionId,
      input.userId,
    );
    return buildAuthoringSessionResponseWithMessages({
      session: refreshed!,
      project: input.project,
      conversationId: input.conversation.id,
    });
  }

  const regenerated = await tryGenerateStepPlan({
    session: input.sessionRecord,
    project: input.project,
    locale: listContext.locale,
  });
  await persistStepReviewAssistantReply({
    conversationId: input.conversation.id,
    locale: listContext.locale,
    projectTitle: input.project.title,
    inReplyToMessageId: input.userMessageId,
    assistantText:
      listContext.locale === 'ar'
        ? 'أنشأت خطة خطوات جديدة. راجعها قبل الحفظ.'
        : 'I generated a new step plan. Review it before saving.',
  });
  return buildAuthoringSessionResponseWithMessages({
    session: regenerated,
    project: input.project,
    conversationId: input.conversation.id,
  });
};

export const submitPersistedComposerFeedback = async (input: {
  userId: string;
  sessionId: string;
  conversation: { id: string; locale: string };
  project: ProjectRecord;
  locale: AiLocale;
  comment: string;
  clientMessageId?: string;
  expectedVersion: number;
  skipLegacyAssistantMessage?: boolean;
}): Promise<AiTurnResponse | AuthoringSessionResponse | null> => {
  let sessionRecord = await projectAuthoringSessionRepository.findByIdForOwner(
    input.sessionId,
    input.userId,
  );
  if (!sessionRecord) {
    throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
  }
  assertPersistedAuthoringContext({
    conversationId: sessionRecord.conversationId,
    conversation: {
      id: input.conversation.id,
      learningProjectId: input.project.id,
      userId: input.userId,
    },
    session: sessionRecord,
    project: input.project,
    userId: input.userId,
  });

  const uiLocale = (input.conversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;
  const trimmed = input.comment.trim();
  const resolvedLocale = await resolveAndPersistAuthoringContentLocale({
    conversationId: input.conversation.id,
    project: input.project,
    uiLocale,
    sessionRecord,
    userComment: trimmed || null,
  });
  sessionRecord = resolvedLocale.session;
  const locale = resolvedLocale.locale;

  let effectiveVersion = sessionRecord.version;

  if (!trimmed) {
    throw new AppError('Comment is required.', 400, 'VALIDATION_ERROR');
  }

  const clientMessageId =
    input.clientMessageId ?? `authoring-${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const existingUserMessage = await findUserMessageByClientId({
    conversationId: input.conversation.id,
    clientMessageId,
  });
  if (existingUserMessage) {
    const existingAssistant = await findAssistantReplyToUserMessage(existingUserMessage.id);
    if (existingAssistant) {
      const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
        input.sessionId,
        input.userId,
      );
      if (!refreshed) {
        throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
      }
      return buildAuthoringSessionResponseWithMessages({
        session: refreshed,
        project: input.project,
        conversationId: input.conversation.id,
      });
    }
  }

  const userMessage =
    existingUserMessage ??
    (await createUserMessage({
      conversationId: input.conversation.id,
      contentText: trimmed,
      clientMessageId,
      locale,
    }));

  if (sessionRecord.stage === 'OVERVIEW') {
    if (sessionRecord.currentTurn?.kind === 'FOLLOW_UP_QUESTION') {
      const refreshed = await processOverviewClarificationAnswer({
        session: sessionRecord,
        project: input.project,
        conversationId: input.conversation.id,
        locale,
        answer: trimmed,
        expectedVersion: input.expectedVersion,
        userMessageId: userMessage.id,
      });
      if (input.skipLegacyAssistantMessage) {
        return null;
      }
      const question =
        refreshed.currentTurn?.kind === 'FOLLOW_UP_QUESTION'
          ? ((refreshed.currentTurn.payload as { question?: string }).question ??
            refreshed.currentTurn.explanation)
          : locale === 'ar'
            ? 'أصبحت فكرة مشروعك جاهزة. ابدأ التأليف الموجّه عندما تكون مستعدًا.'
            : 'Your project idea is ready. Start guided authoring when you are ready.';
      return createPersistedAuthoringAssistantTurnResponse({
        userId: input.userId,
        conversation: input.conversation as never,
        project: input.project,
        session: refreshed,
        locale,
        inReplyToMessageId: userMessage.id,
        userMessageId: userMessage.id,
        assistantText: question ?? undefined,
      });
    }

    const lowered = trimmed.toLowerCase();
    if (
      lowered.includes('start') ||
      lowered.includes('begin') ||
      trimmed.includes('ابدأ') ||
      trimmed.includes('لنبدأ')
    ) {
      await startPersistedAuthoringSession(input.userId, input.conversation.id, {
        writeLegacyMessage: false,
        advanceToTitle: true,
      });
      const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
        input.sessionId,
        input.userId,
      );
      if (!refreshed) {
        throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
      }
      if (input.skipLegacyAssistantMessage) {
        return null;
      }
      return createPersistedAuthoringAssistantTurnResponse({
        userId: input.userId,
        conversation: input.conversation as never,
        project: input.project,
        session: refreshed,
        locale,
        inReplyToMessageId: userMessage.id,
        userMessageId: userMessage.id,
        assistantText:
          locale === 'ar'
            ? `لنبدأ بالعنوان.\n\nاقتراحي: ${readCanonicalStageValue(input.project, 'TITLE')}`
            : `Let's start with the title.\n\nMy suggestion: ${readCanonicalStageValue(input.project, 'TITLE')}`,
      });
    }

    throw new AppError(
      locale === 'ar'
        ? 'أجب عن سؤال التوضيح أو ابدأ التأليف الموجّه عندما تكون جاهزًا.'
        : 'Answer the clarification question or start guided authoring when ready.',
      409,
      'AI_AUTHORING_INVALID_ACTION',
    );
  }

  // COMPONENTS chat must work even when the last generation failed and there is
  // no active PROPOSED turn. In that state we must not reject the learner with
  // AI_AUTHORING_TURN_SUPERSEDED: they can still ask why generation failed,
  // correct the context, or explicitly request a new component list.
  const hasActiveProposedTurn =
    !!sessionRecord.currentTurn &&
    sessionRecord.currentTurn.id === sessionRecord.currentTurnId &&
    sessionRecord.currentTurn.status === 'PROPOSED';
  if (sessionRecord.stage === 'COMPONENTS' && !hasActiveProposedTurn) {
    return handleComponentFailureStateConversation({
      userId: input.userId,
      sessionId: input.sessionId,
      sessionRecord,
      conversation: input.conversation,
      project: input.project,
      locale,
      uiLocale,
      comment: trimmed,
      userMessageId: userMessage.id,
      expectedVersion: effectiveVersion,
    });
  }

  if (
    sessionRecord.stage === 'STEPS_OVERVIEW' &&
    sessionRecord.status === 'GENERATION_FAILED' &&
    !hasActiveProposedTurn
  ) {
    return handleStepsFailureStateConversation({
      userId: input.userId,
      sessionId: input.sessionId,
      sessionRecord,
      conversation: input.conversation,
      project: input.project,
      locale,
      uiLocale,
      comment: trimmed,
      userMessageId: userMessage.id,
      expectedVersion: effectiveVersion,
    });
  }

  const currentTurn = sessionRecord.currentTurn;
  if (!currentTurn || currentTurn.id !== sessionRecord.currentTurnId) {
    throw new AppError(
      'This proposal is no longer current.',
      409,
      'AI_AUTHORING_TURN_SUPERSEDED',
    );
  }
  if (currentTurn.status !== 'PROPOSED') {
    throw new AppError(
      'This proposal is no longer current.',
      409,
      'AI_AUTHORING_TURN_SUPERSEDED',
    );
  }
  if (sessionRecord.baseProjectUpdatedAt.toISOString() !== input.project.updatedAt.toISOString()) {
    throw new AppError(
      locale === 'ar' ? 'تغيّرت المسودة بعد هذا الاقتراح.' : 'The draft changed after this suggestion.',
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }

  if (currentTurn.stage === 'STEP_REVIEW' && currentTurn.kind === 'STEP_ITEM') {
    return handleStepReviewComposerFeedback({
      userId: input.userId,
      sessionId: input.sessionId,
      sessionRecord,
      conversation: input.conversation,
      project: input.project,
      locale,
      comment: trimmed,
      userMessageId: userMessage.id,
      expectedVersion: input.expectedVersion,
      skipLegacyAssistantMessage: input.skipLegacyAssistantMessage,
    });
  }

  let proposal: Record<string, unknown>;
  let assistantText: string;
  let kind = currentTurn.kind;

  if (currentTurn.stage === 'COMPONENTS') {
    const { processComponentStageComposerMessage } = await import(
      './ai-project-authoring-sequential-components.provider.js'
    );
    const requestedComponentCount = parseRequestedComponentCount(trimmed);
    if (requestedComponentCount != null) {
      const validation = validateRequestedComponentCount(requestedComponentCount, locale);
      if (!validation.ok) {
        await persistStepReviewAssistantReply({
          conversationId: input.conversation.id,
          locale,
          projectTitle: input.project.title,
          inReplyToMessageId: userMessage.id,
          assistantText: validation.message,
        });
        const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
          input.sessionId,
          input.userId,
        );
        return buildAuthoringSessionResponseWithMessages({
          session: refreshed!,
          project: input.project,
          conversationId: input.conversation.id,
        });
      }
      sessionRecord = await persistSessionConfirmedRequirements({
        sessionId: input.sessionId,
        expectedVersion: effectiveVersion,
        sessionRecord,
        patch: { requestedComponentCount },
      });
      effectiveVersion = sessionRecord.version;
    }
    const componentContext = await buildStepAuthoringContext({
      project: input.project,
      conversationId: input.conversation.id,
      sessionId: sessionRecord.id,
      uiLocale,
      userComment: trimmed,
      sessionRecord,
    });
    const currentComponents = componentsFromPayload(currentTurn.payload as Record<string, unknown>);
    const history = await loadAuthoringConversationHistory(input.conversation.id, 24);
    const composerResult = await processComponentStageComposerMessage({
      comment:
        requestedComponentCount != null
          ? `${trimmed}\n\nReturn exactly ${requestedComponentCount} unique required components/materials.`
          : trimmed,
      context: componentContext,
      currentComponents,
      history,
      project: input.project,
    });

    if (composerResult.kind === 'EXPLANATION' || composerResult.kind === 'FOLLOW_UP') {
      assertSessionLanguageSurface(
        componentContext.locale,
        composerResult.assistantText,
        'component composer reply',
      );
      await persistStepReviewAssistantReply({
        conversationId: input.conversation.id,
        locale: componentContext.locale,
        projectTitle: input.project.title,
        inReplyToMessageId: userMessage.id,
        assistantText: composerResult.assistantText,
      });
      const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
        input.sessionId,
        input.userId,
      );
      return buildAuthoringSessionResponseWithMessages({
        session: refreshed!,
        project: input.project,
        conversationId: input.conversation.id,
      });
    }

    assistantText = composerResult.assistantText;
    proposal = { components: composerResult.components };
    kind = 'COMPONENT_LIST';
  } else if (currentTurn.stage === 'STEPS_OVERVIEW') {
    const trustedSteps = readTrustedStepList(sessionRecord, currentTurn) as SequentialStep[];
    const requestedStepCount = parseRequestedStepCount(trimmed);
    if (requestedStepCount != null) {
      const validation = validateRequestedStepCount(requestedStepCount, locale);
      if (!validation.ok) {
        await persistStepReviewAssistantReply({
          conversationId: input.conversation.id,
          locale,
          projectTitle: input.project.title,
          inReplyToMessageId: userMessage.id,
          assistantText: validation.message,
        });
        const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
          input.sessionId,
          input.userId,
        );
        return buildAuthoringSessionResponseWithMessages({
          session: refreshed!,
          project: input.project,
          conversationId: input.conversation.id,
        });
      }
      sessionRecord = await persistSessionConfirmedRequirements({
        sessionId: input.sessionId,
        expectedVersion: effectiveVersion,
        sessionRecord,
        patch: { requestedStepCount },
      });
      effectiveVersion = sessionRecord.version;
    }
    const listContext = await buildStepAuthoringContext({
      project: input.project,
      conversationId: input.conversation.id,
      sessionId: sessionRecord.id,
      uiLocale,
      userComment: trimmed,
      sessionRecord,
    });
    const composerResult = await processStepsStageComposerMessage({
      stage: 'STEPS_OVERVIEW',
      comment: trimmed,
      context: listContext,
      currentSteps: trustedSteps,
      project: input.project,
      conversationId: input.conversation.id,
      sessionId: input.sessionId,
      expectedVersion: input.expectedVersion,
      sessionRecord,
    });

    if (composerResult.kind === 'EXPLANATION' || composerResult.kind === 'FOLLOW_UP') {
      assertSessionLanguageSurface(
        listContext.locale,
        composerResult.assistantText,
        'steps composer reply',
      );
      await persistStepReviewAssistantReply({
        conversationId: input.conversation.id,
        locale: listContext.locale,
        projectTitle: input.project.title,
        inReplyToMessageId: userMessage.id,
        assistantText: composerResult.assistantText,
      });
      const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
        input.sessionId,
        input.userId,
      );
      return buildAuthoringSessionResponseWithMessages({
        session: refreshed!,
        project: input.project,
        conversationId: input.conversation.id,
      });
    }

    assistantText = composerResult.assistantText;
    proposal = {
      steps: serializeAuthoringStepPlanPayload(composerResult.steps).payloadSteps,
    };
    kind = 'STEP_PLAN';
  } else {
    const scalarStages = new Set<ProjectAuthoringSessionStage>([
      'TITLE',
      'SHORT_DESCRIPTION',
      'FULL_DESCRIPTION',
      'DIFFICULTY',
      'ESTIMATED_DURATION',
    ]);
    if (scalarStages.has(currentTurn.stage)) {
      const history = await loadAuthoringConversationHistory(input.conversation.id, 24);
      const intent = resolveScalarComposerIntent({
        comment: trimmed,
        history,
        stage: currentTurn.stage,
      });
      if (
        intent === 'EXPLAIN_CURRENT_PROPOSAL' ||
        intent === 'GENERAL_PROJECT_CHAT' ||
        intent === 'CONTINUE_PREVIOUS_RESPONSE' ||
        intent === 'CLARIFY_LEARNER_REQUEST'
      ) {
        const assistantText = await generateScalarConversationExplanation({
          locale,
          comment: trimmed,
          history,
          stage: currentTurn.stage,
          currentProposal: currentTurn.payload as Record<string, unknown>,
          projectTitle: input.project.title,
          projectShortDescription: input.project.shortDescription,
          projectDescription: input.project.description,
          ideaText: [
            input.project.title,
            input.project.shortDescription,
            input.project.description ?? '',
          ]
            .join('\n')
            .trim(),
          intent,
        });
        assertSessionLanguageSurface(locale, assistantText, 'scalar composer reply');
        await persistStepReviewAssistantReply({
          conversationId: input.conversation.id,
          locale,
          projectTitle: input.project.title,
          inReplyToMessageId: userMessage.id,
          assistantText,
        });
        const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(
          input.sessionId,
          input.userId,
        );
        return buildAuthoringSessionResponseWithMessages({
          session: refreshed!,
          project: input.project,
          conversationId: input.conversation.id,
        });
      }
    }

    const discussionReply = await generateSequentialStageDiscussionWithRepair({
      locale,
      stage: currentTurn.stage,
      comment: trimmed,
      currentProposal: currentTurn.payload as never,
      explanation: currentTurn.explanation ?? '',
      projectId: input.project.id,
      projectTitle: input.project.title,
      projectShortDescription: input.project.shortDescription,
      projectDescription: input.project.description,
      projectDifficulty: input.project.difficulty,
      projectEstimatedMinutes: input.project.estimatedDurationMinutes,
      canonicalSavedValue: canonicalScalarForStage(input.project, currentTurn.stage),
      repairAttempt: false,
    });
    assistantText = discussionReply.assistantText;
    if (discussionReply.replyType === 'FOLLOW_UP_QUESTION') {
      return createPersistedAuthoringAssistantTurnResponse({
        userId: input.userId,
        conversation: input.conversation as never,
        project: input.project,
        session: sessionRecord,
        locale,
        inReplyToMessageId: userMessage.id,
        userMessageId: userMessage.id,
        assistantText,
      });
    }
    proposal = { value: discussionReply.suggestion.value };
    kind = 'STAGE_PROPOSAL';
  }

  assertProposalPayloadDistinctFromUserMessage({
    payload: proposal,
    comment: trimmed,
    locale,
  });

  const refreshed = await projectAuthoringSessionRepository.supersedeCurrentTurn({
    sessionId: sessionRecord.id,
    expectedVersion: effectiveVersion,
    supersededTurnId: currentTurn.id,
    newTurn: {
      id: randomUUID(),
      sessionId: sessionRecord.id,
      parentTurnId: currentTurn.id,
      triggerUserMessageId: userMessage.id,
      stage: currentTurn.stage,
      kind,
      status: 'PROPOSED',
      payload: proposal as never,
      explanation:
        locale === 'ar'
          ? 'اقتراح معدّل بناءً على ملاحظتك.'
          : 'Revised suggestion based on your feedback.',
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      baseProjectUpdatedAt: input.project.updatedAt,
    },
  });

  const superseded = await projectAuthoringSessionRepository.findTurnById(currentTurn.id);
  if (input.skipLegacyAssistantMessage) {
    await persistStepReviewAssistantReply({
      conversationId: input.conversation.id,
      locale,
      projectTitle: input.project.title,
      inReplyToMessageId: userMessage.id,
      assistantText,
    });
    await touchConversationActivity({
      conversationId: input.conversation.id,
      locale,
      title: input.project.title,
    });
    return buildAuthoringSessionResponseWithMessages({
      session: refreshed,
      project: input.project,
      conversationId: input.conversation.id,
    });
  }
  const response = await createPersistedAuthoringAssistantTurnResponse({
    userId: input.userId,
    conversation: input.conversation as never,
    project: input.project,
    session: refreshed,
    locale,
    inReplyToMessageId: userMessage.id,
    userMessageId: userMessage.id,
    assistantText,
    supersededTurn: superseded,
  });

  await touchConversationActivity({
    conversationId: input.conversation.id,
    locale,
    title: input.project.title,
  });

  return response;
};
