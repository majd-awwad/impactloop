import { randomUUID } from 'node:crypto';

import { env } from '../../config/env.js';
import type { AiConversation, AiMessage } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  applyAuthoringStageToMyDraft,
  type AuthoringSequentialStagePatch,
} from '../learning-projects/learning-projects.service.js';
import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';

import { parseStoredContentBlocks } from './ai-context-builder.js';
import {
  type AiContentBlock,
  aiProjectAuthoringClarificationBlockSchema,
  aiProjectAuthoringSessionBlockSchema,
  aiProjectAuthoringTurnBlockSchema,
  type AiProjectAuthoringClarificationBlock,
  type AiProjectAuthoringSessionBlock,
  type AiProjectAuthoringTurnBlock,
  AUTHORING_SEQUENTIAL_STAGES,
} from './ai.content-blocks.js';
import {
  buildAuthoringProposalRepairIssue,
  normalizeAuthoringProposalProviderPayload,
  validateAuthoringProposalQuality,
} from './ai-project-authoring-proposal.policy.js';
import { generateAuthoringProposal } from './ai-project-authoring-proposal.provider.js';
import {
  acquireConversationProcessingLock,
  createAssistantMessage,
  createUserMessage,
  findOwnedConversation,
  loadRecentConversationMessages,
  releaseConversationProcessingLock,
  touchConversationActivity,
} from './ai.repository.js';
import {
  deriveNextAuthoringStageFromProject,
  removeWorkingComponentAt,
  removeWorkingStepAt,
  reindexWorkingSteps,
  type SequentialComponent,
  type SequentialStep,
  validateComponentStepConsistency,
} from './ai-project-authoring-sequential.policy.js';
import {
  classifyOverviewStartIntent,
  generateSequentialStageDiscussionWithRepair,
} from './ai-project-authoring-sequential-discussion.provider.js';
import {
  classifyComponentStageIntent,
  componentListSignature,
  generateAlternativeSequentialComponentListWithRepair,
  generateComponentStageReply,
  generateSequentialComponentListWithRepair,
  validateComponentList,
  validateComponentStageReply,
} from './ai-project-authoring-sequential-components.provider.js';
import {
  generateAlternativeSequentialStepPlanWithRepair,
  generateSequentialStepListWithRepair,
  generateStepStageReply,
  toSequentialSteps,
  validateStepList,
  validateStepStageReply,
  type StepListContext,
} from './ai-project-authoring-sequential-steps.provider.js';
import {
  buildAuthoringSnapshot,
  type AuthoringSnapshot,
} from './ai-project-authoring-sequential.snapshot.js';
import {
  buildLegacyAuthoringSnapshotFromPersistedSession,
  parseComponentWorkingState,
  parseStepWorkingState,
} from './project-authoring-session.state.js';
import { projectAuthoringSessionRepository } from './project-authoring-session.repository.js';
import {
  buildPersistedAuthoringContentBlocks,
  createPersistedAuthoringAssistantTurnResponse,
  latestConversationMessageId,
  migrateLegacyConversationToPersistedSession,
  runPersistedAuthoringSessionAction,
  startPersistedAuthoringSession,
  submitPersistedComposerFeedback,
} from './project-authoring-session.service.js';

const normalizeSequentialComponents = (
  components: Array<Omit<SequentialComponent, 'componentRole'> & { componentRole: string }>,
): Array<SequentialComponent & { searchKeywords: string[]; notes: string | null }> =>
  components.map((component) => ({
    ...component,
    componentRole:
      component.componentRole === 'TOOL' || component.componentRole === 'CONSUMABLE'
        ? component.componentRole
        : 'REQUIRED_MATERIAL',
    searchKeywords: component.searchKeywords ?? [],
    notes: component.notes ?? null,
  }));
import type {
  PersistedActionBody,
  PersistedAuthoringAction,
} from './project-authoring-session.actions.js';
import type { AiLocale, AiTurnResponse } from './ai.types.js';

export const PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION =
  'project-authoring-sequential-v1';

type SequentialStage = (typeof AUTHORING_SEQUENTIAL_STAGES)[number];

export type SequentialAuthoringActionBody = {
  action:
    | 'START'
    | 'COMPOSER_MESSAGE'
    | 'ACCEPT_TURN'
    | 'SUGGEST_ANOTHER'
    | 'SAVE_MANUAL'
    | 'CHOOSE_MODE'
    | 'FINISH'
    | 'REGENERATE_STALE'
    | 'REMOVE_ITEM'
    | 'ADD_ITEM'
    | 'BACK_ITEM'
    | 'EXPLAIN_STEP'
    | 'FINALIZE_SECTION'
    | 'CONTINUE_GUIDED';
  turnId?: string;
  comment?: string;
  clientMessageId?: string;
  manualValue?: unknown;
  mode?: 'COMPONENTS_FULL_LIST' | 'COMPONENTS_ONE_BY_ONE' | 'STEPS_FULL_PLAN' | 'STEP_BY_STEP';
};

type WorkingDraft = {
  title: string;
  shortDescription: string;
  description: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedMinutes: number;
  components: Array<{
    componentName: string;
    materialType: string;
    quantity: number;
    unit: string;
    componentRole: 'REQUIRED_MATERIAL' | 'TOOL' | 'CONSUMABLE';
    isRequired: boolean;
    canBeSubstituted: boolean;
    searchKeywords: string[];
    notes: string | null;
  }>;
  steps: Array<{ title: string; description: string }>;
};

const textBlock = (text: string): AiContentBlock => ({
  type: 'text',
  text,
  purpose: 'answer',
});

const isClarificationBlock = (
  block: AiContentBlock,
): block is AiProjectAuthoringClarificationBlock =>
  block.type === 'project_authoring_clarification';

const isSessionBlock = (block: AiContentBlock): block is AiProjectAuthoringSessionBlock =>
  block.type === 'project_authoring_session';

const isTurnBlock = (block: AiContentBlock): block is AiProjectAuthoringTurnBlock =>
  block.type === 'project_authoring_turn';

const findLatestClarificationState = (messages: AiMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (const block of blocks) {
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

export const findLatestAuthoringSessionState = (messages: AiMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (const block of blocks) {
      if (isSessionBlock(block)) {
        const parsed = aiProjectAuthoringSessionBlockSchema.safeParse(block);
        if (parsed.success) {
          return {
            block: parsed.data,
            assistantMessage: message,
          };
        }
      }
    }
  }
  return null;
};

const findTurnById = (messages: AiMessage[], turnId: string) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (const block of blocks) {
      if (isTurnBlock(block) && block.turnId === turnId) {
        const parsed = aiProjectAuthoringTurnBlockSchema.safeParse(block);
        if (parsed.success) {
          return {
            block: parsed.data,
            assistantMessage: message,
          };
        }
      }
    }
  }
  return null;
};

const assertAuthoringConversation = async (
  conversation: AiConversation,
  userId: string,
) => {
  if (conversation.mode !== 'PROJECT_AUTHORING' || !conversation.learningProjectId) {
    throw new AppError(
      'Conversation not found.',
      404,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  const project =
    await learningProjectsRepository.findMyLearningProjectSubmissionById(
      conversation.learningProjectId,
      userId,
    );

  if (!project) {
    throw new AppError(
      'Conversation not found.',
      404,
      'AI_CONVERSATION_NOT_FOUND',
    );
  }

  return { project };
};

const mapTurnResponse = (input: {
  conversation: AiConversation;
  userMessageId?: string | null;
  basisMessageId?: string;
  assistantMessage: AiMessage;
  blocks: AiContentBlock[];
  locale: AiLocale;
  authoringSnapshot?: AuthoringSnapshot | null;
}): AiTurnResponse => ({
  conversationId: input.conversation.id,
  userMessageId:
    input.userMessageId ??
    input.basisMessageId ??
    input.assistantMessage.inReplyToMessageId ??
    input.assistantMessage.id,
  assistantMessageId: input.assistantMessage.id,
  mode: 'PROJECT_AUTHORING',
  locale: input.locale,
  contentBlocks: input.blocks,
  authoringSnapshot: input.authoringSnapshot ?? null,
  meta: {
    provider: input.assistantMessage.provider ?? 'system',
    model: input.assistantMessage.model ?? null,
    policyVersion:
      input.assistantMessage.policyVersion ??
      PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
    scopeClassification:
      input.assistantMessage.scopeClassification ?? 'DOMAIN_KNOWLEDGE',
    latencyMs: input.assistantMessage.latencyMs ?? null,
    usage: {
      inputTokens: input.assistantMessage.inputTokens ?? null,
      outputTokens: input.assistantMessage.outputTokens ?? null,
    },
  },
});

const normalizeAuthoringTimestamp = (value: Date | string) =>
  new Date(value).toISOString();

const stampSessionToProjectBasis = (
  session: AiProjectAuthoringSessionBlock,
  project: ProjectRecord,
): AiProjectAuthoringSessionBlock =>
  updateSession(session, {
    baseUpdatedAt: normalizeAuthoringTimestamp(project.updatedAt),
    flowStatus: 'WAITING_FOR_USER',
  });

const assertAuthoringVersionChain = (input: {
  project: ProjectRecord;
  session: AiProjectAuthoringSessionBlock;
  turn?: AiProjectAuthoringTurnBlock | null;
}) => {
  const projectBasis = normalizeAuthoringTimestamp(input.project.updatedAt);
  if (input.session.baseUpdatedAt !== projectBasis) {
    throw new AppError(
      'Authoring session basis does not match canonical project.',
      500,
      'INTERNAL_ERROR',
    );
  }
  if (input.turn && input.turn.baseUpdatedAt !== projectBasis) {
    throw new AppError(
      'Authoring turn basis does not match canonical project.',
      500,
      'INTERNAL_ERROR',
    );
  }
};

const resolveAuthoringSessionForAction = (input: {
  session: AiProjectAuthoringSessionBlock;
  project: ProjectRecord;
  turnState?: ReturnType<typeof findTurnById> | null;
  action: SequentialAuthoringActionBody['action'];
}): AiProjectAuthoringSessionBlock => {
  const projectBasis = normalizeAuthoringTimestamp(input.project.updatedAt);
  if (input.session.baseUpdatedAt === projectBasis) {
    return input.session;
  }

  const turnBasis = input.turnState
    ? normalizeAuthoringTimestamp(input.turnState.block.baseUpdatedAt)
    : null;
  const turnIsCurrentProposal =
    input.turnState != null &&
    input.turnState.block.status === 'PROPOSED' &&
    input.turnState.block.turnId === input.session.currentTurnId;

  if (
    turnIsCurrentProposal &&
    turnBasis === projectBasis &&
    (input.action === 'ACCEPT_TURN' ||
      input.action === 'COMPOSER_MESSAGE' ||
      input.action === 'SUGGEST_ANOTHER' ||
      input.action === 'FINALIZE_SECTION')
  ) {
    return stampSessionToProjectBasis(input.session, input.project);
  }

  return updateSession(input.session, { flowStatus: 'STALE' });
};

const buildSequentialTurnResponse = async (
  userId: string,
  input: {
    conversation: AiConversation;
    userMessageId?: string | null;
    basisMessageId?: string;
    assistantMessage: AiMessage;
    blocks: AiContentBlock[];
    locale: AiLocale;
  },
): Promise<AiTurnResponse> => {
  const messages = await loadRecentConversationMessages({
    conversationId: input.conversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });
  const { project } = await assertAuthoringConversation(input.conversation, userId);
  const authoringSnapshot = buildAuthoringSnapshot({
    project,
    messages,
    hasLegacyBlocks: hasLegacyAuthoringBlocks(messages),
  });
  return mapTurnResponse({
    ...input,
    authoringSnapshot,
  });
};

const OVERVIEW_COPY: Record<AiLocale, string> = {
  en: `Great. We will create your project draft together.

I'll help you:
1. Choose a clear title.
2. Write the descriptions.
3. Select difficulty and duration.
4. Prepare the required components.
5. Build the implementation steps.

Ready to begin with the title?`,
  ar: `رائع. سننشئ مسودة مشروعك معًا.

سأساعدك في:
1. اختيار عنوان واضح.
2. كتابة الوصفين.
3. تحديد الصعوبة والمدة.
4. تجهيز المكوّنات المطلوبة.
5. بناء خطوات التنفيذ.

هل أنت مستعد للبدء بالعنوان؟`,
};

const STAGE_ACK: Record<AiLocale, Partial<Record<SequentialStage, string>>> = {
  en: {
    TITLE: 'Title saved. Next, let\'s write a short description.',
    SHORT_DESCRIPTION: 'Summary saved. Next, let\'s write the full description.',
    FULL_DESCRIPTION: 'Description saved. Next, let\'s choose the difficulty.',
    DIFFICULTY: 'Difficulty saved. Next, let\'s set the estimated duration.',
    ESTIMATED_DURATION: 'Duration saved. Next, let\'s prepare the required components.',
    COMPONENTS: 'Components saved. Next, let\'s outline the build steps.',
    STEP_REVIEW: 'Step saved.',
    STEPS_OVERVIEW: 'Steps saved.',
  },
  ar: {
    TITLE: 'تم حفظ العنوان. لنكتب الآن وصفًا مختصرًا.',
    SHORT_DESCRIPTION: 'تم حفظ الملخص. لنكتب الآن الوصف الكامل.',
    FULL_DESCRIPTION: 'تم حفظ الوصف. لنحدد الآن مستوى الصعوبة.',
    DIFFICULTY: 'تم حفظ الصعوبة. لنحدد الآن المدة التقديرية.',
    ESTIMATED_DURATION: 'تم حفظ المدة. لنجهّز الآن المكوّنات المطلوبة.',
    COMPONENTS: 'تم حفظ المكوّنات. لنرسم الآن خطوات البناء.',
    STEP_REVIEW: 'تم حفظ الخطوة.',
    STEPS_OVERVIEW: 'تم حفظ الخطوات.',
  },
};

const nextStageAfter = (stage: SequentialStage): SequentialStage => {
  switch (stage) {
    case 'TITLE':
      return 'SHORT_DESCRIPTION';
    case 'SHORT_DESCRIPTION':
      return 'FULL_DESCRIPTION';
    case 'FULL_DESCRIPTION':
      return 'DIFFICULTY';
    case 'DIFFICULTY':
      return 'ESTIMATED_DURATION';
    case 'ESTIMATED_DURATION':
      return 'COMPONENTS';
    case 'COMPONENTS':
      return 'STEPS_OVERVIEW';
    case 'STEPS_OVERVIEW':
    case 'STEP_REVIEW':
      return 'FINAL_REVIEW';
    default:
      return 'FINAL_REVIEW';
  }
};

const buildWorkingDraft = async (input: {
  locale: AiLocale;
  ideaText: string;
  project: Awaited<
    ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>
  >;
  clarification: AiProjectAuthoringClarificationBlock;
  clarificationMessageId: string;
  recentAnswers: string[];
}): Promise<WorkingDraft> => {
  const proposalContext = {
    locale: input.locale,
    ideaText: input.ideaText,
    projectTitle: input.project?.title ?? null,
    projectShortDescription: input.project?.shortDescription ?? null,
    projectDescription: input.project?.description ?? null,
    categoryName: input.project?.category?.nameEn ?? null,
    draftDifficulty: input.project?.difficulty ?? null,
    componentNames: input.project?.requiredComponents.map((c) => c.componentName) ?? [],
    stepTitles: input.project?.steps.map((s) => s.title) ?? [],
    baseUpdatedAt: input.project!.updatedAt.toISOString(),
    clarification: input.clarification,
    clarificationMessageId: input.clarificationMessageId,
    recentAuthoringAnswers: input.recentAnswers,
    repairAttempt: false,
    repairIssue: null,
    previousInvalidOutput: null,
  };
  const qualityContext = {
    locale: input.locale,
    ideaText: input.ideaText,
    categoryName: input.project?.category?.nameEn ?? null,
    draftDifficulty: input.project?.difficulty ?? null,
    clarification: input.clarification,
    recentAuthoringAnswers: input.recentAnswers,
  };

  const throwInvalid = () => {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذر إنشاء اقتراح صالح لهذه المرحلة.'
        : 'Could not produce a valid stage proposal.',
      502,
      'AI_RESPONSE_INVALID',
    );
  };

  let usedRepair = false;
  let providerResult: Awaited<ReturnType<typeof generateAuthoringProposal>>;
  try {
    providerResult = await generateAuthoringProposal(proposalContext);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'AI_RESPONSE_INVALID' || usedRepair) {
      if (error instanceof AppError) {
        throw error;
      }
      throwInvalid();
    }
    usedRepair = true;
    providerResult = await generateAuthoringProposal({
      ...proposalContext,
      repairAttempt: true,
      repairIssue: buildAuthoringProposalRepairIssue({
        schemaError:
          'Provider JSON was malformed or truncated. Return complete valid JSON with concise step descriptions.',
      }),
      previousInvalidOutput: null,
    });
  }

  let normalized = normalizeAuthoringProposalProviderPayload(providerResult.data);
  let quality = validateAuthoringProposalQuality(normalized, qualityContext);
  if (!quality.ok) {
    if (usedRepair) {
      throwInvalid();
    }
    usedRepair = true;
    providerResult = await generateAuthoringProposal({
      ...proposalContext,
      repairAttempt: true,
      repairIssue: buildAuthoringProposalRepairIssue({ quality }),
      previousInvalidOutput: JSON.stringify(providerResult.data).slice(0, 1500),
    });
    normalized = normalizeAuthoringProposalProviderPayload(providerResult.data);
    quality = validateAuthoringProposalQuality(normalized, qualityContext);
    if (!quality.ok) {
      throwInvalid();
    }
  }

  return {
    title: normalized.project.title,
    shortDescription: normalized.project.shortDescription,
    description: normalized.project.description,
    difficulty: normalized.project.difficulty,
    estimatedMinutes: normalized.project.estimatedMinutes ?? 120,
    components: normalized.requiredComponents.map((component) => ({
      componentName: component.componentName,
      materialType: component.materialType ?? 'General',
      quantity: component.quantity,
      unit: component.unit,
      componentRole: component.componentRole as 'REQUIRED_MATERIAL' | 'TOOL' | 'CONSUMABLE',
      isRequired: component.isRequired,
      canBeSubstituted: component.canBeSubstituted,
      searchKeywords: component.searchKeywords ?? [],
      notes: component.notes ?? null,
    })),
    steps: normalized.steps.map((step) => ({
      title: step.title,
      description: step.description,
    })),
  };
};

const buildTurnForStage = (input: {
  session: AiProjectAuthoringSessionBlock;
  stage: SequentialStage;
  draft: WorkingDraft;
  locale: AiLocale;
  explanation?: string;
  baseUpdatedAt?: string;
}): AiProjectAuthoringTurnBlock => {
  const now = new Date().toISOString();
  const turnId = randomUUID();
  let proposal: AiProjectAuthoringTurnBlock['proposal'];
  let explanation = input.explanation ?? '';
  const baseUpdatedAt = input.baseUpdatedAt ?? input.session.baseUpdatedAt;

  switch (input.stage) {
    case 'TITLE':
      proposal = { value: input.draft.title };
      explanation ||= input.locale === 'ar'
        ? 'عنوان واضح ومحدد ومناسب للمبتدئين.'
        : 'Clear, beginner-friendly, and specific.';
      break;
    case 'SHORT_DESCRIPTION':
      proposal = { value: input.draft.shortDescription };
      explanation ||= input.locale === 'ar'
        ? 'ملخص قصير يشرح الفكرة بسرعة.'
        : 'A concise summary that explains the project quickly.';
      break;
    case 'FULL_DESCRIPTION':
      proposal = { value: input.draft.description };
      explanation ||= input.locale === 'ar'
        ? 'وصف كامل يوضح ما سيبنيه المتعلم.'
        : 'A fuller description of what the learner will build.';
      break;
    case 'DIFFICULTY':
      proposal = { value: input.draft.difficulty };
      explanation ||= input.locale === 'ar'
        ? 'أنصح بهذا المستوى لأن المشروع يعتمد على توصيلات Arduino أساسية وكمية محدودة من البرمجة.'
        : 'I recommend this level because the project uses basic Arduino wiring and a small amount of code.';
      break;
    case 'ESTIMATED_DURATION':
      proposal = { value: input.draft.estimatedMinutes };
      explanation ||= input.locale === 'ar'
        ? 'هذه المدة تقديرية لبناء المشروع واختباره بهدوء.'
        : 'This duration covers building and testing the project at a comfortable pace.';
      break;
    case 'COMPONENTS': {
      if (input.session.awaitingComponentsFinalSave) {
        proposal = {
          components: input.session.workingComponents ?? input.draft.components,
        };
        explanation ||= input.locale === 'ar'
          ? 'راجعت جميع المكوّنات. اعتمد القائمة لحفظها في المسودة.'
          : 'You reviewed every component. Accept the list to save it to your draft.';
        break;
      }
      if (input.session.componentReviewMode === 'ONE_BY_ONE') {
        const working = input.session.workingComponents ?? input.draft.components;
        const index = input.session.currentComponentIndex ?? 0;
        const component = working[index] ?? working[0];
        proposal = {
          index,
          total: working.length,
          component,
        };
        explanation ||= input.locale === 'ar'
          ? `المكوّن ${index + 1} من ${working.length}: ${component.componentName}`
          : `Component ${index + 1} of ${working.length}: ${component.componentName}`;
        break;
      }
      proposal = {
        components: input.session.workingComponents ?? input.draft.components,
      };
      explanation ||= input.locale === 'ar'
        ? `قائمة من ${(input.session.workingComponents ?? input.draft.components).length} مكوّنات للمبتدئين دون مضخة أو Relay.`
        : `A beginner-friendly list of ${(input.session.workingComponents ?? input.draft.components).length} components with no pump or relay.`;
      break;
    }
    case 'STEPS_OVERVIEW': {
      if (input.session.awaitingStepsFinalSave) {
        proposal = { steps: input.session.workingSteps ?? input.draft.steps };
        explanation ||= input.locale === 'ar'
          ? 'راجعت جميع الخطوات. اعتمد الخطة لحفظها في المسودة.'
          : 'You reviewed every step. Accept the plan to save it to your draft.';
        break;
      }
      proposal = { steps: input.draft.steps };
      explanation ||= input.locale === 'ar'
        ? 'خطة خطوات مرتبة. يمكنك مراجعة الخطة كاملة أو خطوة بخطوة.'
        : 'An ordered step outline. You can review the complete plan or go step by step.';
      break;
    }
    case 'STEP_REVIEW': {
      const working = input.session.workingSteps ?? input.draft.steps;
      const index = input.session.currentStepIndex ?? 0;
      const step = working[index] ?? working[0];
      proposal = {
        index,
        total: working.length,
        title: step.title,
        description: step.description,
      };
      explanation ||= input.locale === 'ar'
        ? `الخطوة ${index + 1} من ${working.length}: ${step.title}`
        : `Step ${index + 1} of ${working.length}: ${step.title}`;
      break;
    }
    default:
      proposal = { value: input.draft.title };
      explanation ||= '';
  }

  return aiProjectAuthoringTurnBlockSchema.parse({
    type: 'project_authoring_turn',
    turnId,
    sessionId: input.session.sessionId,
    stage: input.stage,
    projectId: input.session.projectId,
    baseUpdatedAt,
    status: 'PROPOSED',
    proposal,
    explanation,
    createdAt: now,
  });
};

const componentsFromTurnProposal = (
  proposal: AiProjectAuthoringTurnBlock['proposal'],
): SequentialComponent[] => {
  if ('components' in proposal && Array.isArray(proposal.components)) {
    return proposal.components as SequentialComponent[];
  }
  return [];
};

const stepsFromTurnProposal = (
  proposal: AiProjectAuthoringTurnBlock['proposal'],
): SequentialStep[] => {
  if ('steps' in proposal && Array.isArray(proposal.steps)) {
    return (proposal.steps as SequentialStep[]).map((step) => ({
      title: step.title,
      description: step.description,
    }));
  }
  return [];
};

const buildStepListContext = (input: {
  locale: AiLocale;
  ideaText: string;
  project: ProjectRecord;
  clarification: AiProjectAuthoringClarificationBlock;
  recentAnswers: string[];
  draft: WorkingDraft;
}): StepListContext => ({
  locale: input.locale,
  ideaText: input.ideaText,
  projectTitle: input.project.title,
  projectShortDescription: input.project.shortDescription,
  projectDescription: input.project.description,
  difficulty: input.project.difficulty,
  estimatedMinutes: input.project.estimatedDurationMinutes,
  components:
    input.project.requiredComponents.length > 0
      ? input.project.requiredComponents.map((component) => ({
          id: component.id,
          componentName: component.componentName,
          materialType: component.materialType,
          quantity: Number(component.quantity),
          unit: component.unit,
          componentRole: component.componentRole as SequentialComponent['componentRole'],
          isRequired: component.isRequired,
          canBeSubstituted: component.canBeSubstituted,
          searchKeywords: Array.isArray(component.searchKeywords)
            ? (component.searchKeywords as string[])
            : [],
          notes: component.notes,
        }))
      : input.draft.components,
  clarification: input.clarification,
  recentAnswers: input.recentAnswers,
});

const buildComponentListContext = (input: {
  locale: AiLocale;
  ideaText: string;
  project: ProjectRecord;
  clarification: AiProjectAuthoringClarificationBlock;
  recentAnswers: string[];
}) => ({
  locale: input.locale,
  projectId: input.project.id,
  ideaText: input.ideaText,
  projectTitle: input.project.title,
  projectShortDescription: input.project.shortDescription,
  projectDescription: input.project.description,
  clarification: input.clarification,
  recentAnswers: input.recentAnswers,
});

const createNextStageTurn = async (input: {
  session: AiProjectAuthoringSessionBlock;
  nextStage: SequentialStage;
  draft: WorkingDraft;
  locale: AiLocale;
  project: ProjectRecord;
  clarification: AiProjectAuthoringClarificationBlock;
  recentAnswers: string[];
  ideaText: string;
}): Promise<{
  session: AiProjectAuthoringSessionBlock;
  turn: AiProjectAuthoringTurnBlock;
}> => {
  const projectBasis = normalizeAuthoringTimestamp(input.project.updatedAt);
  const session = stampSessionToProjectBasis(input.session, input.project);

  if (input.nextStage === 'COMPONENTS' && !session.componentReviewMode) {
    const generated = await generateSequentialComponentListWithRepair(
      buildComponentListContext({
        locale: input.locale,
        ideaText: input.ideaText,
        project: input.project,
        clarification: input.clarification,
        recentAnswers: input.recentAnswers,
      }),
    );
    const sessionWithComponents = updateSession(session, {
      workingComponents: generated.components,
    });
    const turn = buildTurnForStage({
      session: sessionWithComponents,
      stage: 'COMPONENTS',
      draft: {
        ...input.draft,
        components: normalizeSequentialComponents(generated.components),
      },
      locale: input.locale,
      explanation: generated.explanation,
      baseUpdatedAt: projectBasis,
    });
    return { session: sessionWithComponents, turn };
  }

  if (input.nextStage === 'STEPS_OVERVIEW' && !session.stepReviewMode) {
    const generated = await generateSequentialStepListWithRepair(
      buildStepListContext({
        locale: input.locale,
        ideaText: input.ideaText,
        project: input.project,
        clarification: input.clarification,
        recentAnswers: input.recentAnswers,
        draft: input.draft,
      }),
    );
    const sessionWithSteps = updateSession(session, {
      workingSteps: generated.steps,
    });
    const turn = buildTurnForStage({
      session: sessionWithSteps,
      stage: 'STEPS_OVERVIEW',
      draft: { ...input.draft, steps: generated.steps },
      locale: input.locale,
      explanation: generated.explanation,
      baseUpdatedAt: projectBasis,
    });
    return { session: sessionWithSteps, turn };
  }

  return {
    session,
    turn: buildTurnForStage({
      session,
      stage: input.nextStage,
      draft: input.draft,
      locale: input.locale,
      baseUpdatedAt: projectBasis,
    }),
  };
};

const buildRevisedTurnForDiscussion = (input: {
  session: AiProjectAuthoringSessionBlock;
  previousTurn: AiProjectAuthoringTurnBlock;
  stage: SequentialStage;
  proposal: AiProjectAuthoringTurnBlock['proposal'];
  explanation: string;
  project: NonNullable<
    Awaited<ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>>
  >;
}): AiProjectAuthoringTurnBlock => {
  const now = new Date().toISOString();
  return aiProjectAuthoringTurnBlockSchema.parse({
    type: 'project_authoring_turn',
    turnId: randomUUID(),
    sessionId: input.session.sessionId,
    stage: input.stage,
    projectId: input.project.id,
    baseUpdatedAt: input.project.updatedAt.toISOString(),
    status: 'PROPOSED',
    proposal: input.proposal,
    explanation: input.explanation,
    policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
    createdAt: now,
    updatedAt: now,
    supersedesTurnId: input.previousTurn.turnId,
  });
};

const processComponentStageFeedback = async (input: {
  userId: string;
  ownedConversation: AiConversation;
  sessionState: NonNullable<ReturnType<typeof findLatestAuthoringSessionState>>;
  turnState: NonNullable<ReturnType<typeof findTurnById>>;
  project: ProjectRecord;
  locale: AiLocale;
  comment: string;
  clientMessageId: string;
  messages: AiMessage[];
}): Promise<AiTurnResponse> => {
  const { project, locale, trimmed } = {
    ...input,
    trimmed: input.comment.trim(),
  };

  if (
    normalizeAuthoringTimestamp(project.updatedAt) !==
    normalizeAuthoringTimestamp(input.turnState.block.baseUpdatedAt)
  ) {
    throw new AppError(
      locale === 'ar'
        ? 'تغيّرت المسودة بعد اقتراح المكوّنات هذا.'
        : 'The draft changed after this component suggestion.',
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }

  const clarification = findLatestClarificationState(input.messages)!;
  const currentComponents = componentsFromTurnProposal(input.turnState.block.proposal);
  const intent = classifyComponentStageIntent(trimmed);

  const userMessage = await createUserMessage({
    conversationId: input.ownedConversation.id,
    contentText: trimmed,
    clientMessageId: input.clientMessageId,
    locale,
  });

  let componentReply;
  try {
    componentReply = validateComponentStageReply(
      await generateComponentStageReply({
        ...buildComponentListContext({
          locale,
          ideaText:
            input.messages.find((message) => message.role === 'USER')?.contentText?.trim() ??
            project.title,
          project,
          clarification: clarification.block,
          recentAnswers: collectRecentAnswers(input.messages),
        }),
        comment: trimmed,
        currentComponents,
        intent,
      }),
    );
  } catch (error) {
    if (error instanceof AppError && error.code === 'AI_COMPONENT_INTENT_UNCLEAR') {
      throw error;
    }
    throw new AppError(
      locale === 'ar'
        ? 'تعذّر على المساعد إنشاء قائمة مكوّنات صالحة. أعد المحاولة.'
        : 'The assistant could not create a valid component list. Retry.',
      502,
      'AI_COMPONENT_PROPOSAL_INVALID',
      { cause: error },
    );
  }

  let session = input.sessionState.block;
  const blocks: AiContentBlock[] = [textBlock(componentReply.assistantText)];

  if (
    componentReply.replyType === 'COMPONENT_LIST' ||
    componentReply.replyType === 'REVISED_COMPONENT_LIST'
  ) {
    const supersededTurn = supersedeTurn(input.turnState.block);
    const revisedTurn = buildRevisedTurnForDiscussion({
      session,
      previousTurn: input.turnState.block,
      stage: 'COMPONENTS',
      proposal: { components: componentReply.components },
      explanation:
        locale === 'ar'
          ? 'قائمة مكوّنات مقترحة بناءً على طلبك.'
          : 'Proposed component list based on your request.',
      project,
    });
    session = updateSession(session, {
      currentTurnId: revisedTurn.turnId,
      workingComponents: componentReply.components,
      baseUpdatedAt: normalizeAuthoringTimestamp(project.updatedAt),
      flowStatus: 'WAITING_FOR_USER',
    });
    blocks.push(session, supersededTurn, revisedTurn);
  } else {
    blocks.push(session, input.turnState.block);
  }

  const assistantMessage = await createAssistantMessage({
    conversationId: input.ownedConversation.id,
    inReplyToMessageId: userMessage.id,
    status: 'COMPLETED',
    contentBlocks: blocks,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    locale,
    provider: env.aiChatProvider,
    model: null,
    policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
  });

  await touchConversationActivity({
    conversationId: input.ownedConversation.id,
    locale,
    title: project.title,
  });

  return await buildSequentialTurnResponse(input.userId, {
    conversation: input.ownedConversation,
    userMessageId: userMessage.id,
    assistantMessage,
    blocks,
    locale,
  });
};

const processStepStageFeedback = async (input: {
  userId: string;
  ownedConversation: AiConversation;
  sessionState: NonNullable<ReturnType<typeof findLatestAuthoringSessionState>>;
  turnState: NonNullable<ReturnType<typeof findTurnById>>;
  project: ProjectRecord;
  locale: AiLocale;
  comment: string;
  clientMessageId: string;
  messages: AiMessage[];
}): Promise<AiTurnResponse> => {
  const { project, locale, trimmed } = {
    ...input,
    trimmed: input.comment.trim(),
  };

  if (
    normalizeAuthoringTimestamp(project.updatedAt) !==
    normalizeAuthoringTimestamp(input.turnState.block.baseUpdatedAt)
  ) {
    throw new AppError(
      locale === 'ar'
        ? 'تغيّرت المسودة بعد اقتراح الخطوات هذا.'
        : 'The draft changed after this step suggestion.',
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }

  const clarification = findLatestClarificationState(input.messages)!;
  const draft = await buildWorkingDraft({
    locale,
    ideaText:
      input.messages.find((message) => message.role === 'USER')?.contentText?.trim() ??
      project.title,
    project,
    clarification: clarification.block,
    clarificationMessageId: clarification.messageId,
    recentAnswers: collectRecentAnswers(input.messages),
  });
  const currentSteps = stepsFromTurnProposal(input.turnState.block.proposal);
  const listContext = buildStepListContext({
    locale,
    ideaText: project.title,
    project,
    clarification: clarification.block,
    recentAnswers: collectRecentAnswers(input.messages),
    draft,
  });

  const userMessage = await createUserMessage({
    conversationId: input.ownedConversation.id,
    contentText: trimmed,
    clientMessageId: input.clientMessageId,
    locale,
  });

  let stepReply;
  try {
    stepReply = validateStepStageReply(
      await generateStepStageReply({
        ...listContext,
        comment: trimmed,
        currentSteps,
        intent: 'OTHER',
      }),
    );
  } catch (error) {
    if (error instanceof AppError && error.code === 'AI_STEP_COMPONENT_INCONSISTENT') {
      throw error;
    }
    throw new AppError(
      locale === 'ar'
        ? 'تعذّر على المساعد إنشاء خطة خطوات صالحة. أعد المحاولة.'
        : 'The assistant could not create a valid step plan. Retry.',
      502,
      'AI_STEP_PROPOSAL_INVALID',
      { cause: error },
    );
  }

  let session = input.sessionState.block;
  const blocks: AiContentBlock[] = [textBlock(stepReply.assistantText)];

  if (stepReply.replyType === 'STEP_PLAN' || stepReply.replyType === 'REVISED_STEP_PLAN') {
    const revisedSteps = validateStepList(toSequentialSteps(stepReply.steps));
    const supersededTurn = supersedeTurn(input.turnState.block);
    const revisedTurn = buildRevisedTurnForDiscussion({
      session,
      previousTurn: input.turnState.block,
      stage: input.turnState.block.stage,
      proposal: { steps: revisedSteps },
      explanation:
        locale === 'ar'
          ? 'خطة خطوات مقترحة بناءً على طلبك.'
          : 'Proposed step plan based on your request.',
      project,
    });
    session = updateSession(session, {
      currentTurnId: revisedTurn.turnId,
      workingSteps: revisedSteps,
      baseUpdatedAt: normalizeAuthoringTimestamp(project.updatedAt),
      flowStatus: 'WAITING_FOR_USER',
    });
    blocks.push(session, supersededTurn, revisedTurn);
  } else {
    blocks.push(session, input.turnState.block);
  }

  const assistantMessage = await createAssistantMessage({
    conversationId: input.ownedConversation.id,
    inReplyToMessageId: userMessage.id,
    status: 'COMPLETED',
    contentBlocks: blocks,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    locale,
    provider: env.aiChatProvider,
    model: null,
    policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
  });

  await touchConversationActivity({
    conversationId: input.ownedConversation.id,
    locale,
    title: project.title,
  });

  return await buildSequentialTurnResponse(input.userId, {
    conversation: input.ownedConversation,
    userMessageId: userMessage.id,
    assistantMessage,
    blocks,
    locale,
  });
};

const patchForStage = (
  stage: SequentialStage,
  turn: AiProjectAuthoringTurnBlock,
): AuthoringSequentialStagePatch => {
  const proposal = turn.proposal;
  switch (stage) {
    case 'TITLE':
      return { title: 'value' in proposal ? String(proposal.value) : undefined };
    case 'SHORT_DESCRIPTION':
      return {
        shortDescription: 'value' in proposal ? String(proposal.value) : undefined,
      };
    case 'FULL_DESCRIPTION':
      return {
        description: 'value' in proposal ? String(proposal.value) : undefined,
      };
    case 'DIFFICULTY':
      return {
        difficulty:
          'value' in proposal
            ? (proposal.value as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED')
            : undefined,
      };
    case 'ESTIMATED_DURATION':
      return {
        estimatedDurationMinutes:
          'value' in proposal ? Number(proposal.value) : undefined,
      };
    case 'COMPONENTS':
      return 'components' in proposal
        ? { requiredComponents: proposal.components }
        : {};
    case 'STEPS_OVERVIEW':
      return 'steps' in proposal ? { steps: proposal.steps } : {};
    case 'STEP_REVIEW':
      return {};
    default:
      return {};
  }
};

type ProjectRecord = NonNullable<
  Awaited<ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>>
>;

const canonicalScalarForStage = (
  project: ProjectRecord,
  stage: SequentialStage,
): string | number | null => {
  switch (stage) {
    case 'TITLE':
      return project.title;
    case 'SHORT_DESCRIPTION':
      return project.shortDescription;
    case 'FULL_DESCRIPTION':
      return project.description ?? '';
    case 'DIFFICULTY':
      return project.difficulty;
    case 'ESTIMATED_DURATION':
      return project.estimatedDurationMinutes ?? null;
    default:
      return null;
  }
};

const assertRefreshedProjectMatchesPatch = (
  project: ProjectRecord,
  stage: SequentialStage,
  patch: AuthoringSequentialStagePatch,
) => {
  if (patch.title !== undefined && project.title !== patch.title) {
    throw new AppError('Canonical title was not updated.', 500, 'INTERNAL_ERROR');
  }
  if (
    patch.estimatedDurationMinutes !== undefined &&
    project.estimatedDurationMinutes !== patch.estimatedDurationMinutes
  ) {
    throw new AppError('Canonical duration was not updated.', 500, 'INTERNAL_ERROR');
  }
  if (patch.shortDescription !== undefined && project.shortDescription !== patch.shortDescription) {
    throw new AppError('Canonical summary was not updated.', 500, 'INTERNAL_ERROR');
  }
  if (patch.requiredComponents !== undefined) {
    const saved = componentListSignature(
      normalizeSequentialComponents(project.requiredComponents.map((component) => ({
        componentName: component.componentName,
        materialType: component.materialType,
        quantity: Number(component.quantity),
        unit: component.unit,
        componentRole: component.componentRole,
        isRequired: component.isRequired,
        canBeSubstituted: component.canBeSubstituted,
        searchKeywords: [],
        notes: component.notes,
      }))),
    );
    const expected = componentListSignature(normalizeSequentialComponents(patch.requiredComponents));
    if (JSON.stringify(saved) !== JSON.stringify(expected)) {
      throw new AppError(
        'Canonical components were not updated.',
        500,
        'AI_COMPONENT_SAVE_FAILED',
      );
    }
  }
};

const executeOverviewStart = async (input: {
  userId: string;
  ownedConversation: AiConversation;
  sessionState: NonNullable<ReturnType<typeof findLatestAuthoringSessionState>>;
  session: AiProjectAuthoringSessionBlock;
  messages: AiMessage[];
  project: ProjectRecord;
  locale: AiLocale;
  inReplyToMessageId: string;
}): Promise<AiTurnResponse> => {
  const { session } = input;
  if (session.stage !== 'OVERVIEW') {
    const blocks = parseStoredContentBlocks(input.sessionState.assistantMessage.contentBlocks);
    if (session.stage === 'TITLE' && session.currentTurnId) {
      const turnState = findTurnById(input.messages, session.currentTurnId);
      if (turnState?.block.status === 'PROPOSED') {
        return await buildSequentialTurnResponse(input.userId, {
          conversation: input.ownedConversation,
          assistantMessage: input.sessionState.assistantMessage,
          blocks,
          locale: input.locale,
        });
      }
    }
    throw new AppError(
      input.locale === 'ar'
        ? 'التأليف الموجّه قيد التقدّم بالفعل.'
        : 'Guided authoring is already in progress.',
      409,
      'AI_AUTHORING_INVALID_ACTION',
    );
  }

  const clarification = findLatestClarificationState(input.messages);
  if (!clarification) {
    throw new AppError('Clarification not found.', 404, 'AI_AUTHORING_PROPOSAL_NOT_READY');
  }
  const draft = await buildWorkingDraft({
    locale: input.locale,
    ideaText:
      input.messages.find((message) => message.role === 'USER')?.contentText?.trim() ??
      input.project.title,
    project: input.project,
    clarification: clarification.block,
    clarificationMessageId: clarification.messageId,
    recentAnswers: collectRecentAnswers(input.messages),
  });

  const nextSession = updateSession(session, {
    stage: 'TITLE',
    flowStatus: 'WAITING_FOR_USER',
    baseUpdatedAt: input.project.updatedAt.toISOString(),
  });
  const turn = buildTurnForStage({
    session: nextSession,
    stage: 'TITLE',
    draft,
    locale: input.locale,
  });
  const sessionWithTurn = updateSession(nextSession, {
    currentTurnId: turn.turnId,
  });

  const assistantText =
    input.locale === 'ar'
      ? `لنبدأ بالعنوان.\n\nاقتراحي: ${draft.title}`
      : `Let's start with the title.\n\nMy suggestion: ${draft.title}`;
  const blocks: AiContentBlock[] = [textBlock(assistantText), sessionWithTurn, turn];
  const assistantMessage = await createAssistantMessage({
    conversationId: input.ownedConversation.id,
    inReplyToMessageId: input.inReplyToMessageId,
    status: 'COMPLETED',
    contentBlocks: blocks,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    locale: input.locale,
    provider: 'system',
    model: null,
    policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
  });
  return await buildSequentialTurnResponse(input.userId, {
    conversation: input.ownedConversation,
    assistantMessage,
    blocks,
    locale: input.locale,
  });
};

const processStageFeedback = async (input: {
  userId: string;
  ownedConversation: AiConversation;
  sessionState: NonNullable<ReturnType<typeof findLatestAuthoringSessionState>>;
  turnState: NonNullable<ReturnType<typeof findTurnById>>;
  project: ProjectRecord;
  locale: AiLocale;
  comment: string;
  clientMessageId: string;
}): Promise<AiTurnResponse> => {
  const { project, locale, trimmed } = {
    ...input,
    trimmed: input.comment.trim(),
  };

  if (
    normalizeAuthoringTimestamp(project.updatedAt) !==
    normalizeAuthoringTimestamp(input.turnState.block.baseUpdatedAt)
  ) {
    throw new AppError(
      locale === 'ar'
        ? 'تغيّرت المسودة بعد هذا الاقتراح.'
        : 'The draft changed after this suggestion.',
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }

  const userMessage = await createUserMessage({
    conversationId: input.ownedConversation.id,
    contentText: trimmed,
    clientMessageId: input.clientMessageId,
    locale,
  });

  let discussionReply;
  try {
    discussionReply = await generateSequentialStageDiscussionWithRepair({
      locale,
      stage: input.turnState.block.stage,
      comment: trimmed,
      currentProposal: input.turnState.block.proposal,
      explanation: input.turnState.block.explanation,
      projectTitle: project.title,
      projectShortDescription: project.shortDescription,
      projectDescription: project.description,
      canonicalSavedValue: canonicalScalarForStage(project, input.turnState.block.stage),
      repairAttempt: false,
    });
  } catch (error) {
    throw new AppError(
      locale === 'ar'
        ? 'تعذّر على المساعد إنشاء اقتراح معدّل صالح. أعد المحاولة.'
        : 'The assistant could not create a valid revised suggestion. Retry.',
      502,
      'AI_PROVIDER_RESPONSE_INVALID',
      { cause: error },
    );
  }

  let session = input.sessionState.block;
  const blocks: AiContentBlock[] = [textBlock(discussionReply.assistantText)];

  if (discussionReply.replyType === 'REVISED_SUGGESTION') {
    const supersededTurn = supersedeTurn(input.turnState.block);
    const revisedTurn = buildRevisedTurnForDiscussion({
      session,
      previousTurn: input.turnState.block,
      stage: input.turnState.block.stage,
      proposal: { value: discussionReply.suggestion.value },
      explanation:
        locale === 'ar'
          ? 'اقتراح معدّل بناءً على ملاحظتك.'
          : 'Revised suggestion based on your feedback.',
      project,
    });
    session = updateSession(session, { currentTurnId: revisedTurn.turnId });
    blocks.push(session, supersededTurn, revisedTurn);
  } else {
    blocks.push(session, input.turnState.block);
  }

  const assistantMessage = await createAssistantMessage({
    conversationId: input.ownedConversation.id,
    inReplyToMessageId: userMessage.id,
    status: 'COMPLETED',
    contentBlocks: blocks,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    locale,
    provider: env.aiChatProvider,
    model: null,
    policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
  });

  await touchConversationActivity({
    conversationId: input.ownedConversation.id,
    locale,
    title: project.title,
  });

  return await buildSequentialTurnResponse(input.userId, {
    conversation: input.ownedConversation,
    userMessageId: userMessage.id,
    assistantMessage,
    blocks,
    locale,
  });
};

const collectRecentAnswers = (messages: AiMessage[]) => {
  const answers: string[] = [];
  for (const message of messages) {
    if (message.role === 'USER' && message.contentText?.trim()) {
      answers.push(message.contentText.trim());
    }
  }
  return answers.slice(-12);
};

const createSessionBlock = (input: {
  projectId: string;
  baseUpdatedAt: string;
  stage?: SequentialStage;
}): AiProjectAuthoringSessionBlock => {
  const now = new Date().toISOString();
  return aiProjectAuthoringSessionBlockSchema.parse({
    type: 'project_authoring_session',
    sessionId: randomUUID(),
    projectId: input.projectId,
    baseUpdatedAt: input.baseUpdatedAt,
    stage: input.stage ?? 'OVERVIEW',
    flowStatus: 'WAITING_FOR_USER',
    acceptedStages: [],
    currentTurnId: null,
    policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
    createdAt: now,
    updatedAt: now,
  });
};

const updateSession = (
  session: AiProjectAuthoringSessionBlock,
  patch: Partial<AiProjectAuthoringSessionBlock>,
): AiProjectAuthoringSessionBlock => {
  const now = new Date().toISOString();
  return aiProjectAuthoringSessionBlockSchema.parse({
    ...session,
    ...patch,
    updatedAt: now,
  });
};

const supersedeTurn = (turn: AiProjectAuthoringTurnBlock): AiProjectAuthoringTurnBlock =>
  aiProjectAuthoringTurnBlockSchema.parse({
    ...turn,
    status: 'SUPERSEDED',
  });

const acceptTurnBlock = (turn: AiProjectAuthoringTurnBlock): AiProjectAuthoringTurnBlock =>
  aiProjectAuthoringTurnBlockSchema.parse({
    ...turn,
    status: 'ACCEPTED',
  });

export const beginGuidedAuthoringOverviewForUser = async (
  userId: string,
  conversationId: string,
): Promise<AiTurnResponse> => {
  const ownedConversation = await findOwnedConversation({ conversationId, userId });
  if (!ownedConversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }

  const { project } = await assertAuthoringConversation(ownedConversation, userId);
  const locale = (ownedConversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;
  const messages = await loadRecentConversationMessages({
    conversationId: ownedConversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });

  const clarification = findLatestClarificationState(messages);
  if (!clarification || clarification.block.status !== 'READY_FOR_PROPOSAL') {
    throw new AppError(
      locale === 'ar'
        ? 'أكمل توضيح المشروع قبل البدء بالتأليف الموجّه.'
        : 'Complete project clarification before guided authoring.',
      409,
      'AI_AUTHORING_PROPOSAL_NOT_READY',
    );
  }

  const existing = findLatestAuthoringSessionState(messages);
  if (existing) {
    return mapTurnResponse({
      conversation: ownedConversation,
      assistantMessage: existing.assistantMessage,
      blocks: parseStoredContentBlocks(existing.assistantMessage.contentBlocks),
      locale,
    });
  }

  await acquireConversationProcessingLock({
    conversationId: ownedConversation.id,
    staleBefore: new Date(Date.now() - env.aiChatProcessingStaleMs),
  });
  try {
    const session = createSessionBlock({
      projectId: project.id,
      baseUpdatedAt: project.updatedAt.toISOString(),
      stage: 'OVERVIEW',
    });

    const blocks: AiContentBlock[] = [textBlock(OVERVIEW_COPY[locale]), session];
    const assistantMessage = await createAssistantMessage({
      conversationId: ownedConversation.id,
      inReplyToMessageId: clarification.assistantMessage.id,
      status: 'COMPLETED',
      contentBlocks: blocks,
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      locale,
      provider: 'system',
      model: null,
      policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
    });

    await touchConversationActivity({
      conversationId: ownedConversation.id,
      locale,
      title: project.title,
    });

    return mapTurnResponse({
      conversation: ownedConversation,
      assistantMessage,
      blocks,
      locale,
    });
  } finally {
    await releaseConversationProcessingLock(ownedConversation.id);
  }
};

type LegacyBridgeProjectRecord = NonNullable<
  Awaited<ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>>
>;

const mapLegacyModeToPersisted = (
  mode: SequentialAuthoringActionBody['mode'],
): PersistedActionBody['mode'] | undefined => {
  switch (mode) {
    case 'COMPONENTS_FULL_LIST':
      return 'FULL_LIST';
    case 'COMPONENTS_ONE_BY_ONE':
      return 'ONE_BY_ONE';
    case 'STEPS_FULL_PLAN':
      return 'FULL_PLAN';
    case 'STEP_BY_STEP':
      return 'STEP_BY_STEP';
    default:
      return undefined;
  }
};

export const mapLegacySequentialActionToPersisted = (
  action: SequentialAuthoringActionBody['action'],
  session?: {
    componentWorkingState: unknown;
    stepWorkingState: unknown;
  } | null,
): PersistedAuthoringAction | null => {
  switch (action) {
    case 'START':
    case 'CONTINUE_GUIDED':
      return 'START';
    case 'ACCEPT_TURN':
      return 'ACCEPT_CURRENT';
    case 'SUGGEST_ANOTHER':
      return 'SUGGEST_ANOTHER';
    case 'SAVE_MANUAL':
      return 'SAVE_MANUAL';
    case 'REGENERATE_STALE':
      return 'REGENERATE_FAILED_STAGE';
    case 'FINISH':
      return 'FINISH';
    case 'CHOOSE_MODE':
      return null;
    case 'REMOVE_ITEM':
      return null;
    case 'ADD_ITEM':
      return null;
    case 'BACK_ITEM':
      return null;
    case 'EXPLAIN_STEP':
      return 'EXPLAIN_STEP';
    case 'FINALIZE_SECTION': {
      const componentState = parseComponentWorkingState(session?.componentWorkingState);
      if (componentState?.awaitingFinalSave) {
        return 'FINALIZE_COMPONENTS';
      }
      const stepState = parseStepWorkingState(session?.stepWorkingState);
      if (stepState?.awaitingFinalSave) {
        return 'FINALIZE_STEPS';
      }
      return 'ACCEPT_CURRENT';
    }
    default:
      return null;
  }
};

const mapLegacyChooseModeAction = (
  mode: SequentialAuthoringActionBody['mode'],
): PersistedAuthoringAction | null => {
  switch (mode) {
    case 'COMPONENTS_FULL_LIST':
    case 'COMPONENTS_ONE_BY_ONE':
      return 'CHOOSE_COMPONENT_MODE';
    case 'STEPS_FULL_PLAN':
    case 'STEP_BY_STEP':
      return 'CHOOSE_STEP_MODE';
    default:
      return null;
  }
};

const mapLegacyItemAction = (
  action: SequentialAuthoringActionBody['action'],
  session: {
    stage: string;
    componentWorkingState: unknown;
    stepWorkingState: unknown;
  },
): PersistedAuthoringAction | null => {
  const componentState = parseComponentWorkingState(session.componentWorkingState);
  const stepState = parseStepWorkingState(session.stepWorkingState);

  if (session.stage === 'COMPONENTS' && componentState?.mode === 'ONE_BY_ONE') {
    if (action === 'REMOVE_ITEM') return 'REMOVE_COMPONENT_ITEM';
    if (action === 'ADD_ITEM') return 'ADD_COMPONENT_ITEM';
    if (action === 'BACK_ITEM') return 'BACK_COMPONENT_ITEM';
  }
  if (session.stage === 'STEP_REVIEW' && stepState?.mode === 'STEP_BY_STEP') {
    if (action === 'REMOVE_ITEM') return 'REMOVE_STEP_ITEM';
    if (action === 'ADD_ITEM') return 'ADD_STEP_ITEM';
    if (action === 'BACK_ITEM') return 'BACK_STEP_ITEM';
  }
  return null;
};

export const tryGetPersistedAuthoringSnapshot = async (
  userId: string,
  conversationId: string,
): Promise<AuthoringSnapshot | null> => {
  const session = await projectAuthoringSessionRepository.findByConversationId(conversationId);
  if (!session) {
    return null;
  }
  const conversation = await findOwnedConversation({ conversationId, userId });
  if (!conversation?.learningProjectId) {
    return null;
  }
  const project = await learningProjectsRepository.findMyLearningProjectSubmissionById(
    conversation.learningProjectId,
    userId,
  );
  if (!project) {
    return null;
  }
  return buildLegacyAuthoringSnapshotFromPersistedSession({ session, project });
};

export const shouldDelegateToPersistedAuthoring = async (
  conversationId: string,
  action?: SequentialAuthoringActionBody['action'],
) => {
  if (action === 'START' || action === 'CONTINUE_GUIDED') {
    return true;
  }
  const existing = await projectAuthoringSessionRepository.findByConversationId(conversationId);
  return existing != null;
};

const ensurePersistedSessionForLegacy = async (
  userId: string,
  conversationId: string,
  action: SequentialAuthoringActionBody['action'],
) => {
  let session = await projectAuthoringSessionRepository.findByConversationId(conversationId);
  if (session) {
    return session;
  }
  if (action === 'CONTINUE_GUIDED') {
    const messages = await loadRecentConversationMessages({
      conversationId,
      limit: env.aiChatMaxHistoryMessages,
    });
    if (!hasLegacyAuthoringBlocks(messages) && !findLatestAuthoringSessionState(messages)) {
      return null;
    }
    const legacySession = findLatestAuthoringSessionState(messages);
    return migrateLegacyConversationToPersistedSession(userId, conversationId, {
      componentWorkingState: legacySession?.block.workingComponents
        ? { components: legacySession.block.workingComponents }
        : undefined,
      stepWorkingState: legacySession?.block.workingSteps
        ? { steps: legacySession.block.workingSteps }
        : undefined,
    });
  }
  if (action === 'START') {
    await startPersistedAuthoringSession(userId, conversationId, {
      advanceToTitle: true,
    });
    return projectAuthoringSessionRepository.findByConversationId(conversationId);
  }
  return null;
};

const buildPersistedActionBody = (
  body: SequentialAuthoringActionBody,
  session: {
    componentWorkingState: unknown;
    stepWorkingState: unknown;
    stage: string;
    version: number;
  },
): PersistedActionBody | null => {
  if (body.action === 'CHOOSE_MODE') {
    const action = mapLegacyChooseModeAction(body.mode);
    if (!action) {
      return null;
    }
    return {
      action,
      expectedVersion: session.version,
      turnId: body.turnId,
      mode: mapLegacyModeToPersisted(body.mode),
    };
  }

  const itemAction = mapLegacyItemAction(body.action, session);
  if (itemAction) {
    return {
      action: itemAction,
      expectedVersion: session.version,
      turnId: body.turnId,
      manualValue: body.manualValue,
    };
  }

  const mapped = mapLegacySequentialActionToPersisted(body.action, session);
  if (!mapped) {
    return null;
  }

  return {
    action: mapped,
    expectedVersion: session.version,
    turnId: body.turnId,
    manualValue: body.manualValue,
    mode: mapLegacyModeToPersisted(body.mode),
  };
};

const isAiTurnResponse = (
  value: AiTurnResponse | { session: unknown } | null,
): value is AiTurnResponse =>
  Boolean(value && typeof value === 'object' && 'contentBlocks' in value);

/**
 * Legacy sequential endpoints expect AiTurnResponse (with authoringSnapshot +
 * session/turn content blocks). Persisted composer feedback may return either
 * AiTurnResponse or AuthoringSessionResponse. Never invent a text-only turn —
 * rebuild from the refreshed persisted session so Flutter can apply the snapshot.
 */
const toLegacyAiTurnResponse = async (input: {
  result: AiTurnResponse | { session: { id: string } } | null;
  conversationId: string;
  locale: AiLocale;
  project: LegacyBridgeProjectRecord;
  conversation: AiConversation;
}): Promise<AiTurnResponse | null> => {
  if (!input.result) {
    return null;
  }

  const session = await projectAuthoringSessionRepository.findByConversationId(
    input.conversationId,
  );
  if (!session) {
    return isAiTurnResponse(input.result) ? input.result : null;
  }

  const authoringSnapshot = buildLegacyAuthoringSnapshotFromPersistedSession({
    session,
    project: input.project,
  });

  if (isAiTurnResponse(input.result)) {
    if (input.result.authoringSnapshot) {
      return input.result;
    }
    return {
      ...input.result,
      authoringSnapshot,
      contentBlocks:
        input.result.contentBlocks.length > 0
          ? input.result.contentBlocks
          : buildPersistedAuthoringContentBlocks({ session }),
    };
  }

  const messages = await loadRecentConversationMessages({
    conversationId: input.conversationId,
    limit: env.aiChatMaxHistoryMessages,
  });
  const lastUser = [...messages].reverse().find((message) => message.role === 'USER');
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === 'ASSISTANT');

  let assistantText: string | undefined;
  if (lastAssistant?.contentText?.trim()) {
    assistantText = lastAssistant.contentText.trim();
  } else if (lastAssistant?.contentBlocks) {
    const existingBlocks = parseStoredContentBlocks(lastAssistant.contentBlocks);
    const textBlockEntry = existingBlocks.find(
      (block): block is Extract<AiContentBlock, { type: 'text' }> =>
        block.type === 'text',
    );
    if (textBlockEntry?.text?.trim()) {
      assistantText = textBlockEntry.text.trim();
    }
  }

  const contentBlocks = buildPersistedAuthoringContentBlocks({
    session,
    assistantText,
  });

  return {
    conversationId: input.conversationId,
    userMessageId: lastUser?.id ?? input.conversationId,
    assistantMessageId: lastAssistant?.id ?? null,
    mode: 'PROJECT_AUTHORING',
    locale: input.locale,
    contentBlocks,
    authoringSnapshot,
    meta: {
      provider: lastAssistant?.provider ?? 'system',
      model: lastAssistant?.model ?? null,
      policyVersion:
        lastAssistant?.policyVersion ?? PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
      scopeClassification: lastAssistant?.scopeClassification ?? 'DOMAIN_KNOWLEDGE',
      latencyMs: lastAssistant?.latencyMs ?? null,
      usage: {
        inputTokens: lastAssistant?.inputTokens ?? null,
        outputTokens: lastAssistant?.outputTokens ?? null,
      },
    },
  };
};

export const delegateSequentialActionToPersisted = async (input: {
  userId: string;
  conversationId: string;
  body: SequentialAuthoringActionBody;
  ownedConversation: AiConversation;
  project: LegacyBridgeProjectRecord;
  locale: AiLocale;
}): Promise<AiTurnResponse | null> => {
  const shouldDelegate = await shouldDelegateToPersistedAuthoring(
    input.conversationId,
    input.body.action,
  );
  if (!shouldDelegate) {
    return null;
  }

  if (input.body.action === 'START') {
    return (await startPersistedAuthoringSession(input.userId, input.conversationId, {
      advanceToTitle: true,
    })) as AiTurnResponse;
  }

  const session = await ensurePersistedSessionForLegacy(
    input.userId,
    input.conversationId,
    input.body.action,
  );
  if (!session) {
    throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
  }

  if (input.body.action === 'COMPOSER_MESSAGE') {
    const comment = input.body.comment?.trim();
    if (!comment) {
      throw new AppError('Comment is required.', 400, 'VALIDATION_ERROR');
    }
    return toLegacyAiTurnResponse({
      result: await submitPersistedComposerFeedback({
        userId: input.userId,
        sessionId: session.id,
        conversation: input.ownedConversation,
        project: input.project,
        locale: input.locale,
        comment,
        clientMessageId: input.body.clientMessageId,
        expectedVersion: session.version,
      }),
      conversationId: input.conversationId,
      locale: input.locale,
      project: input.project,
      conversation: input.ownedConversation,
    });
  }

  const persistedBody = buildPersistedActionBody(input.body, session);
  if (!persistedBody) {
    throw new AppError('Unsupported action.', 400, 'VALIDATION_ERROR');
  }

  await runPersistedAuthoringSessionAction(input.userId, session.id, persistedBody);

  const refreshed = await projectAuthoringSessionRepository.findByConversationId(
    input.conversationId,
  );
  if (!refreshed) {
    throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
  }

  const refreshedProject =
    (await learningProjectsRepository.findMyLearningProjectSubmissionById(
      input.project.id,
      input.userId,
    )) ?? input.project;

  let acceptedTurn = null;
  if (
    (input.body.action === 'ACCEPT_TURN' || input.body.action === 'FINALIZE_SECTION') &&
    input.body.turnId
  ) {
    acceptedTurn = await projectAuthoringSessionRepository.findTurnById(input.body.turnId);
  }

  const inReplyToMessageId =
    (await latestConversationMessageId(input.conversationId)) ?? input.ownedConversation.id;
  return createPersistedAuthoringAssistantTurnResponse({
    userId: input.userId,
    conversation: input.ownedConversation,
    project: refreshedProject,
    session: refreshed,
    locale: input.locale,
    inReplyToMessageId,
    acceptedTurn,
  });
};


export const hasLegacyAuthoringBlocks = (messages: AiMessage[]) => {
  for (const message of messages) {
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    if (
      blocks.some(
        (block) =>
          block.type === 'project_authoring_proposal' ||
          block.type === 'project_authoring_review_state',
      )
    ) {
      return true;
    }
  }
  return false;
};

const continueLegacyAuthoringToSequential = async (input: {
  userId: string;
  ownedConversation: AiConversation;
  project: NonNullable<
    Awaited<ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>>
  >;
  locale: AiLocale;
  messages: AiMessage[];
}): Promise<AiTurnResponse> => {
  const existing = findLatestAuthoringSessionState(input.messages);
  if (existing) {
    return mapTurnResponse({
      conversation: input.ownedConversation,
      assistantMessage: existing.assistantMessage,
      blocks: parseStoredContentBlocks(existing.assistantMessage.contentBlocks),
      locale: input.locale,
    });
  }

  if (!hasLegacyAuthoringBlocks(input.messages)) {
    throw new AppError(
      input.locale === 'ar'
        ? 'لا توجد محادثة تأليف قديمة للمتابعة.'
        : 'No legacy authoring conversation found to continue.',
      404,
      'AI_AUTHORING_SESSION_NOT_FOUND',
    );
  }

  const nextStage = deriveNextAuthoringStageFromProject({
    title: input.project.title,
    shortDescription: input.project.shortDescription,
    description: input.project.description,
    difficulty: input.project.difficulty,
    estimatedDurationMinutes: input.project.estimatedDurationMinutes,
    requiredComponents: input.project.requiredComponents.map((component) => ({
      componentName: component.componentName,
    })),
    steps: input.project.steps.map((step) => ({ title: step.title })),
  });

  let session = createSessionBlock({
    projectId: input.project.id,
    baseUpdatedAt: input.project.updatedAt.toISOString(),
    stage: nextStage,
  });

  const blocks: AiContentBlock[] = [
    textBlock(
      input.locale === 'ar'
        ? 'لنكمل تأليف مشروعك باستخدام التدفق الموجّه الجديد. بقيت الرسائل السابقة للاطلاع فقط.'
        : 'Let\'s continue your project with the new guided flow. Previous messages remain for reference.',
    ),
    session,
  ];

  if (nextStage !== 'FINAL_REVIEW' && nextStage !== 'COMPLETE') {
    const clarification = findLatestClarificationState(input.messages);
    if (clarification) {
      const draft = await buildWorkingDraft({
        locale: input.locale,
        ideaText: input.project.title,
        project: input.project,
        clarification: clarification.block,
        clarificationMessageId: clarification.messageId,
        recentAnswers: collectRecentAnswers(input.messages),
      });
      const turn = buildTurnForStage({
        session,
        stage: nextStage,
        draft,
        locale: input.locale,
      });
      session = updateSession(session, { currentTurnId: turn.turnId });
      blocks[1] = session;
      blocks.push(turn);
    }
  }

  const assistantMessage = await createAssistantMessage({
    conversationId: input.ownedConversation.id,
    inReplyToMessageId:
      (await latestConversationMessageId(input.ownedConversation.id)) ??
      input.ownedConversation.id,
    status: 'COMPLETED',
    contentBlocks: blocks,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    locale: input.locale,
    provider: 'system',
    model: null,
    policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
  });

  return mapTurnResponse({
    conversation: input.ownedConversation,
    assistantMessage,
    blocks,
    locale: input.locale,
  });
};

export const runSequentialAuthoringActionForUser = async (
  userId: string,
  conversationId: string,
  body: SequentialAuthoringActionBody,
): Promise<AiTurnResponse> => {
  const ownedConversation = await findOwnedConversation({ conversationId, userId });
  if (!ownedConversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }

  const { project } = await assertAuthoringConversation(ownedConversation, userId);
  const locale = (ownedConversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;

  if (project.status !== 'DRAFT') {
    throw new AppError(
      locale === 'ar'
        ? 'يمكن تحديث مسودات المشاريع فقط أثناء التأليف الموجّه.'
        : 'Only draft projects can be updated during guided authoring.',
      409,
      'PROJECT_NOT_EDITABLE',
    );
  }

  const messages = await loadRecentConversationMessages({
    conversationId: ownedConversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });

  const sessionState = findLatestAuthoringSessionState(messages);
  if (!sessionState) {
    throw new AppError(
      locale === 'ar' ? 'لا توجد جلسة تأليف موجّهة نشطة.' : 'No active guided authoring session.',
      404,
      'AI_AUTHORING_SESSION_NOT_FOUND',
    );
  }

  let session = sessionState.block;
  const preliminaryTurnId = body.turnId ?? session.currentTurnId;
  const preliminaryTurnState = preliminaryTurnId
    ? findTurnById(messages, preliminaryTurnId)
    : null;
  session = resolveAuthoringSessionForAction({
    session,
    project,
    turnState: preliminaryTurnState,
    action: body.action,
  });

  if (session.flowStatus === 'STALE' && body.action !== 'REGENERATE_STALE') {
    throw new AppError(
      locale === 'ar'
        ? session.stage === 'COMPONENTS'
          ? 'تغيّرت المسودة بعد اقتراح المكوّنات هذا.'
          : 'تغيّرت المسودة بعد هذا الاقتراح.'
        : session.stage === 'COMPONENTS'
          ? 'The draft changed after this component suggestion.'
          : 'The draft changed after this suggestion.',
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }

  await acquireConversationProcessingLock({
    conversationId: ownedConversation.id,
    staleBefore: new Date(Date.now() - env.aiChatProcessingStaleMs),
  });
  try {
    if (body.action === 'START') {
      if (session.stage !== 'OVERVIEW') {
        const blocks = parseStoredContentBlocks(sessionState.assistantMessage.contentBlocks);
        if (session.stage === 'TITLE' && session.currentTurnId) {
          const turnState = findTurnById(messages, session.currentTurnId);
          if (turnState?.block.status === 'PROPOSED') {
            return mapTurnResponse({
              conversation: ownedConversation,
              assistantMessage: sessionState.assistantMessage,
              blocks,
              locale,
            });
          }
        }
        throw new AppError(
          locale === 'ar'
            ? 'التأليف الموجّه قيد التقدّم بالفعل.'
            : 'Guided authoring is already in progress.',
          409,
          'AI_AUTHORING_INVALID_ACTION',
        );
      }

      const clarification = findLatestClarificationState(messages);
      if (!clarification) {
        throw new AppError('Clarification not found.', 404, 'AI_AUTHORING_PROPOSAL_NOT_READY');
      }
      const draft = await buildWorkingDraft({
        locale,
        ideaText:
          messages.find((message) => message.role === 'USER')?.contentText?.trim() ??
          project.title,
        project,
        clarification: clarification.block,
        clarificationMessageId: clarification.messageId,
        recentAnswers: collectRecentAnswers(messages),
      });

      const nextSession = updateSession(session, {
        stage: 'TITLE',
        flowStatus: 'WAITING_FOR_USER',
        baseUpdatedAt: project.updatedAt.toISOString(),
      });
      const turn = buildTurnForStage({
        session: nextSession,
        stage: 'TITLE',
        draft,
        locale,
      });
      const sessionWithTurn = updateSession(nextSession, {
        currentTurnId: turn.turnId,
      });

      const assistantText =
        locale === 'ar'
          ? `لنبدأ بالعنوان.\n\nاقتراحي: ${draft.title}`
          : `Let's start with the title.\n\nMy suggestion: ${draft.title}`;
      const blocks: AiContentBlock[] = [
        textBlock(assistantText),
        sessionWithTurn,
        turn,
      ];
      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: sessionState.assistantMessage.id,
        status: 'COMPLETED',
        contentBlocks: blocks,
        scopeClassification: 'DOMAIN_KNOWLEDGE',
        locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
      });
      return mapTurnResponse({
        conversation: ownedConversation,
        assistantMessage,
        blocks,
        locale,
      });
    }

    if (body.action === 'FINISH') {
      if (session.stage === 'COMPLETE' || session.flowStatus === 'COMPLETE') {
        return mapTurnResponse({
          conversation: ownedConversation,
          assistantMessage: sessionState.assistantMessage,
          blocks: parseStoredContentBlocks(sessionState.assistantMessage.contentBlocks),
          locale,
        });
      }
      const completed = updateSession(session, {
        stage: 'COMPLETE',
        flowStatus: 'COMPLETE',
        currentTurnId: null,
      });
      const assistantText =
        locale === 'ar'
          ? 'اكتمل تأليف مسودة مشروعك. يمكنك مراجعة المسودة أو مواصلة التحرير اليدوي.'
          : 'Your project draft authoring is complete. You can review the draft or continue editing manually.';
      const blocks: AiContentBlock[] = [textBlock(assistantText), completed];
      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: sessionState.assistantMessage.id,
        status: 'COMPLETED',
        contentBlocks: blocks,
        scopeClassification: 'DOMAIN_KNOWLEDGE',
        locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
      });
      return mapTurnResponse({
        conversation: ownedConversation,
        assistantMessage,
        blocks,
        locale,
      });
    }

    if (body.action === 'CONTINUE_GUIDED') {
      return continueLegacyAuthoringToSequential({
        userId,
        ownedConversation,
        project,
        locale,
        messages,
      });
    }

    if (body.action === 'CHOOSE_MODE') {
      if (!body.mode) {
        throw new AppError('Mode is required.', 400, 'VALIDATION_ERROR');
      }
      const clarification = findLatestClarificationState(messages);
      if (!clarification) {
        throw new AppError('Clarification not found.', 404, 'AI_AUTHORING_PROPOSAL_NOT_READY');
      }
      const draft = await buildWorkingDraft({
        locale,
        ideaText: project.title,
        project,
        clarification: clarification.block,
        clarificationMessageId: clarification.messageId,
        recentAnswers: collectRecentAnswers(messages),
      });

      if (body.mode === 'STEPS_FULL_PLAN' || body.mode === 'STEP_BY_STEP') {
        let nextSession = updateSession(session, {
          stepReviewMode: body.mode === 'STEP_BY_STEP' ? 'STEP_BY_STEP' : 'FULL_PLAN',
          stage: body.mode === 'STEP_BY_STEP' ? 'STEP_REVIEW' : 'STEPS_OVERVIEW',
          currentStepIndex: body.mode === 'STEP_BY_STEP' ? 0 : undefined,
          workingSteps: body.mode === 'STEP_BY_STEP' ? draft.steps : undefined,
          acceptedStepIndexes: body.mode === 'STEP_BY_STEP' ? [] : undefined,
          awaitingStepsFinalSave: false,
        });
        const blocks: AiContentBlock[] = [
          textBlock(
            body.mode === 'STEP_BY_STEP'
              ? locale === 'ar'
                ? 'لنراجع الخطوات واحدة تلو الأخرى.'
                : "Let's review the steps one by one."
              : locale === 'ar'
                ? 'راجع الخطة الكاملة ثم اعتمدها.'
                : 'Review the complete plan, then accept it.',
          ),
          nextSession,
        ];
        if (body.mode === 'STEP_BY_STEP') {
          const turn = buildTurnForStage({
            session: nextSession,
            stage: 'STEP_REVIEW',
            draft,
            locale,
          });
          nextSession = updateSession(nextSession, { currentTurnId: turn.turnId });
          blocks[1] = nextSession;
          blocks.push(turn);
        } else {
          const turn = buildTurnForStage({
            session: nextSession,
            stage: 'STEPS_OVERVIEW',
            draft,
            locale,
          });
          nextSession = updateSession(nextSession, { currentTurnId: turn.turnId });
          blocks[1] = nextSession;
          blocks.push(turn);
        }
        const assistantMessage = await createAssistantMessage({
          conversationId: ownedConversation.id,
          inReplyToMessageId: sessionState.assistantMessage.id,
          status: 'COMPLETED',
          contentBlocks: blocks,
          scopeClassification: 'DOMAIN_KNOWLEDGE',
          locale,
          provider: 'system',
          model: null,
          policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
          latencyMs: 0,
          inputTokens: null,
          outputTokens: null,
        });
        return mapTurnResponse({
          conversation: ownedConversation,
          assistantMessage,
          blocks,
          locale,
        });
      }

      let nextSession = updateSession(session, {
        componentReviewMode:
          body.mode === 'COMPONENTS_ONE_BY_ONE' ? 'ONE_BY_ONE' : 'FULL_LIST',
        awaitingComponentsFinalSave: false,
      });
      const blocks: AiContentBlock[] = [
        textBlock(
          body.mode === 'COMPONENTS_ONE_BY_ONE'
            ? locale === 'ar'
              ? 'لنراجع المكوّنات واحدًا تلو الآخر.'
              : "Let's review components one by one."
            : locale === 'ar'
              ? 'راجع القائمة كاملة ثم اعتمدها.'
              : 'Review the full list, then accept it.',
        ),
        nextSession,
      ];
      if (body.mode === 'COMPONENTS_ONE_BY_ONE') {
        nextSession = updateSession(nextSession, {
          workingComponents: draft.components,
          currentComponentIndex: 0,
          acceptedComponentIndexes: [],
          componentSourceTotal: draft.components.length,
        });
        const turn = buildTurnForStage({
          session: nextSession,
          stage: 'COMPONENTS',
          draft,
          locale,
        });
        nextSession = updateSession(nextSession, { currentTurnId: turn.turnId });
        blocks[1] = nextSession;
        blocks.push(turn);
      } else {
        const turn = buildTurnForStage({
          session: nextSession,
          stage: 'COMPONENTS',
          draft,
          locale,
        });
        nextSession = updateSession(nextSession, { currentTurnId: turn.turnId });
        blocks[1] = nextSession;
        blocks.push(turn);
      }
      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: sessionState.assistantMessage.id,
        status: 'COMPLETED',
        contentBlocks: blocks,
        scopeClassification: 'DOMAIN_KNOWLEDGE',
        locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
      });
      return mapTurnResponse({
        conversation: ownedConversation,
        assistantMessage,
        blocks,
        locale,
      });
    }

    if (body.action === 'REGENERATE_STALE') {
      const clarification = findLatestClarificationState(messages)!;
      const draft = await buildWorkingDraft({
        locale,
        ideaText: project.title,
        project,
        clarification: clarification.block,
        clarificationMessageId: clarification.messageId,
        recentAnswers: collectRecentAnswers(messages),
      });
      const stage = session.stage === 'OVERVIEW' ? 'TITLE' : session.stage;
      const refreshedSession = updateSession(session, {
        flowStatus: 'WAITING_FOR_USER',
        baseUpdatedAt: project.updatedAt.toISOString(),
        stage,
      });
      const newTurn = buildTurnForStage({
        session: refreshedSession,
        stage,
        draft,
        locale,
      });
      const sessionWithTurn = updateSession(refreshedSession, {
        currentTurnId: newTurn.turnId,
      });
      const blocks: AiContentBlock[] = [
        textBlock(
          locale === 'ar'
            ? 'أنشأت اقتراحًا جديدًا بناءً على مسودتك المحدّثة.'
            : 'I created a new suggestion based on your updated draft.',
        ),
        sessionWithTurn,
        newTurn,
      ];
      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: sessionState.assistantMessage.id,
        status: 'COMPLETED',
        contentBlocks: blocks,
        scopeClassification: 'DOMAIN_KNOWLEDGE',
        locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
      });
      return mapTurnResponse({
        conversation: ownedConversation,
        basisMessageId: sessionState.assistantMessage.id,
        assistantMessage,
        blocks,
        locale,
      });
    }

    const turnId = body.turnId ?? session.currentTurnId;
    if (!turnId) {
      throw new AppError('Turn not found.', 404, 'AI_AUTHORING_TURN_NOT_FOUND');
    }
    const turnState = findTurnById(messages, turnId);
    if (!turnState || turnState.block.sessionId !== session.sessionId) {
      throw new AppError('Turn not found.', 404, 'AI_AUTHORING_TURN_NOT_FOUND');
    }

    if (body.action === 'ACCEPT_TURN') {
      if (
        turnState.block.status === 'ACCEPTED' &&
        session.lastAcceptedTurnId === turnState.block.turnId
      ) {
        return mapTurnResponse({
          conversation: ownedConversation,
          assistantMessage: turnState.assistantMessage,
          blocks: parseStoredContentBlocks(turnState.assistantMessage.contentBlocks),
          locale,
        });
      }

      if (turnState.block.status !== 'PROPOSED') {
        throw new AppError('This turn is no longer active.', 409, 'AI_AUTHORING_TURN_NOT_ACTIVE');
      }

      const projectBasis = normalizeAuthoringTimestamp(project.updatedAt);
      if (turnState.block.baseUpdatedAt !== projectBasis) {
        throw new AppError(
          locale === 'ar'
            ? 'تغيّرت المسودة بعد اقتراح المكوّنات هذا.'
            : 'The draft changed after this component suggestion.',
          409,
          'AI_AUTHORING_PROPOSAL_STALE',
        );
      }
      session = stampSessionToProjectBasis(session, project);

      const stage = turnState.block.stage;
      const proposal = turnState.block.proposal;
      const clarification = findLatestClarificationState(messages)!;
      const draft = await buildWorkingDraft({
        locale,
        ideaText: project.title,
        project,
        clarification: clarification.block,
        clarificationMessageId: clarification.messageId,
        recentAnswers: collectRecentAnswers(messages),
      });

      if (
        stage === 'COMPONENTS' &&
        session.componentReviewMode === 'ONE_BY_ONE' &&
        'component' in proposal &&
        !session.awaitingComponentsFinalSave
      ) {
        const workingComponents = [...(session.workingComponents ?? draft.components)];
        workingComponents[proposal.index] = proposal.component as SequentialComponent;
        const acceptedIndexes = Array.from(
          new Set([...(session.acceptedComponentIndexes ?? []), proposal.index]),
        );
        const allReviewed = acceptedIndexes.length >= workingComponents.length;
        const acceptedTurn = acceptTurnBlock(turnState.block);

        if (allReviewed) {
          session = updateSession(session, {
            workingComponents,
            acceptedComponentIndexes: acceptedIndexes,
            awaitingComponentsFinalSave: true,
            currentTurnId: null,
          });
          const summaryTurn = buildTurnForStage({
            session,
            stage: 'COMPONENTS',
            draft,
            locale,
          });
          session = updateSession(session, { currentTurnId: summaryTurn.turnId });
          const blocks: AiContentBlock[] = [
            textBlock(
              locale === 'ar'
                ? 'راجعت كل المكوّنات. اعتمد القائمة لحفظها في المسودة.'
                : 'You reviewed every component. Accept the component list and save.',
            ),
            session,
            acceptedTurn,
            summaryTurn,
          ];
          const assistantMessage = await createAssistantMessage({
            conversationId: ownedConversation.id,
            inReplyToMessageId: turnState.assistantMessage.id,
            status: 'COMPLETED',
            contentBlocks: blocks,
            scopeClassification: 'DOMAIN_KNOWLEDGE',
            locale,
            provider: 'system',
            model: null,
            policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
            latencyMs: 0,
            inputTokens: null,
            outputTokens: null,
          });
          return mapTurnResponse({
            conversation: ownedConversation,
            assistantMessage,
            blocks,
            locale,
          });
        }

        const nextIndex = proposal.index + 1;
        session = updateSession(session, {
          workingComponents,
          acceptedComponentIndexes: acceptedIndexes,
          currentComponentIndex: nextIndex,
        });
        const nextTurn = buildTurnForStage({
          session,
          stage: 'COMPONENTS',
          draft,
          locale,
        });
        session = updateSession(session, {
          currentTurnId: nextTurn.turnId,
          lastAcceptedTurnId: turnState.block.turnId,
        });
        const blocks: AiContentBlock[] = [
          textBlock(
            locale === 'ar'
              ? `تم قبول المكوّن ${proposal.index + 1}.`
              : `Component ${proposal.index + 1} accepted.`,
          ),
          session,
          acceptedTurn,
          nextTurn,
        ];
        const assistantMessage = await createAssistantMessage({
          conversationId: ownedConversation.id,
          inReplyToMessageId: turnState.assistantMessage.id,
          status: 'COMPLETED',
          contentBlocks: blocks,
          scopeClassification: 'DOMAIN_KNOWLEDGE',
          locale,
          provider: 'system',
          model: null,
          policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
          latencyMs: 0,
          inputTokens: null,
          outputTokens: null,
        });
        return mapTurnResponse({
          conversation: ownedConversation,
          assistantMessage,
          blocks,
          locale,
        });
      }

      if (
        stage === 'STEP_REVIEW' &&
        session.stepReviewMode === 'STEP_BY_STEP' &&
        'index' in proposal &&
        'title' in proposal &&
        !session.awaitingStepsFinalSave
      ) {
        const workingSteps = reindexWorkingSteps([...(session.workingSteps ?? draft.steps)]);
        workingSteps[proposal.index] = {
          title: proposal.title,
          description: proposal.description,
        };
        const accepted = Array.from(
          new Set([...(session.acceptedStepIndexes ?? []), proposal.index]),
        );
        const totalSteps = workingSteps.length;
        const allAccepted = accepted.length >= totalSteps;
        const acceptedTurn = acceptTurnBlock(turnState.block);

        if (allAccepted) {
          session = updateSession(session, {
            workingSteps,
            acceptedStepIndexes: accepted,
            awaitingStepsFinalSave: true,
            stage: 'STEPS_OVERVIEW',
            currentTurnId: null,
          });
          const summaryTurn = buildTurnForStage({
            session,
            stage: 'STEPS_OVERVIEW',
            draft: { ...draft, steps: workingSteps },
            locale,
          });
          session = updateSession(session, { currentTurnId: summaryTurn.turnId });
          const blocks: AiContentBlock[] = [
            textBlock(
              locale === 'ar'
                ? 'راجعت كل الخطوات. اعتمد الخطة لحفظها في المسودة.'
                : 'You reviewed every step. Accept the steps and save.',
            ),
            session,
            acceptedTurn,
            summaryTurn,
          ];
          const assistantMessage = await createAssistantMessage({
            conversationId: ownedConversation.id,
            inReplyToMessageId: turnState.assistantMessage.id,
            status: 'COMPLETED',
            contentBlocks: blocks,
            scopeClassification: 'DOMAIN_KNOWLEDGE',
            locale,
            provider: 'system',
            model: null,
            policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
            latencyMs: 0,
            inputTokens: null,
            outputTokens: null,
          });
          return mapTurnResponse({
            conversation: ownedConversation,
            assistantMessage,
            blocks,
            locale,
          });
        }

        const nextIndex = proposal.index + 1;
        session = updateSession(session, {
          workingSteps,
          acceptedStepIndexes: accepted,
          currentStepIndex: nextIndex,
        });
        const nextTurn = buildTurnForStage({
          session,
          stage: 'STEP_REVIEW',
          draft: { ...draft, steps: workingSteps },
          locale,
        });
        session = updateSession(session, {
          currentTurnId: nextTurn.turnId,
          lastAcceptedTurnId: turnState.block.turnId,
        });
        const blocks: AiContentBlock[] = [
          textBlock(
            locale === 'ar'
              ? `تم قبول الخطوة ${proposal.index + 1}.`
              : `Step ${proposal.index + 1} accepted.`,
          ),
          session,
          acceptedTurn,
          nextTurn,
        ];
        const assistantMessage = await createAssistantMessage({
          conversationId: ownedConversation.id,
          inReplyToMessageId: turnState.assistantMessage.id,
          status: 'COMPLETED',
          contentBlocks: blocks,
          scopeClassification: 'DOMAIN_KNOWLEDGE',
          locale,
          provider: 'system',
          model: null,
          policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
          latencyMs: 0,
          inputTokens: null,
          outputTokens: null,
        });
        return mapTurnResponse({
          conversation: ownedConversation,
          assistantMessage,
          blocks,
          locale,
        });
      }

      let wroteProject = false;
      if (
        stage === 'COMPONENTS' &&
        'components' in proposal &&
        (session.awaitingComponentsFinalSave ||
          session.componentReviewMode === 'FULL_LIST' ||
          !session.componentReviewMode)
      ) {
        const components = proposal.components as SequentialComponent[];
        const normalizedNames = components.map((component) =>
          component.componentName.trim().toLowerCase(),
        );
        if (new Set(normalizedNames).size !== normalizedNames.length) {
          throw new AppError(
            'Duplicate component names are not allowed.',
            409,
            'DUPLICATE_COMPONENT_NAME',
          );
        }
        await applyAuthoringStageToMyDraft({
          userId,
          projectId: project.id,
          expectedUpdatedAt: session.baseUpdatedAt,
          patch: { requiredComponents: components },
        });
        wroteProject = true;
      } else if (
        (stage === 'STEPS_OVERVIEW' || stage === 'STEP_REVIEW') &&
        'steps' in proposal &&
        (session.awaitingStepsFinalSave ||
          session.stepReviewMode === 'FULL_PLAN' ||
          !session.stepReviewMode)
      ) {
        const steps = proposal.steps as SequentialStep[];
        const components =
          session.workingComponents ??
          draft.components.map((component) => ({ ...component }));
        const consistency = validateComponentStepConsistency({
          components,
          steps,
          constraints: collectRecentAnswers(messages),
        });
        if (!consistency.ok) {
          throw new AppError(consistency.issues.join(' '), 409, consistency.code);
        }
        await applyAuthoringStageToMyDraft({
          userId,
          projectId: project.id,
          expectedUpdatedAt: session.baseUpdatedAt,
          patch: { steps },
        });
        wroteProject = true;
      } else if (!['STEP_REVIEW', 'COMPONENTS'].includes(stage)) {
        await applyAuthoringStageToMyDraft({
          userId,
          projectId: project.id,
          expectedUpdatedAt: session.baseUpdatedAt,
          patch: patchForStage(stage, turnState.block),
        });
        wroteProject = true;
      } else {
        throw new AppError('Unsupported accept for current stage.', 400, 'VALIDATION_ERROR');
      }

      if (!wroteProject) {
        throw new AppError('No project write was performed.', 400, 'VALIDATION_ERROR');
      }

      const refreshed =
        await learningProjectsRepository.findMyLearningProjectSubmissionById(
          project.id,
          userId,
        );
      if (!refreshed) {
        throw new AppError('Project not found after accept.', 404, 'LEARNING_PROJECT_NOT_FOUND');
      }
      const acceptedPatch = patchForStage(stage, turnState.block);
      assertRefreshedProjectMatchesPatch(refreshed, stage, acceptedPatch);
      const nextStage = nextStageAfter(stage);
      const acceptedTurn = acceptTurnBlock(turnState.block);
      session = stampSessionToProjectBasis(
        updateSession(session, {
          acceptedStages: [...session.acceptedStages, stage],
          stage: nextStage,
          flowStatus: 'WAITING_FOR_USER',
          currentTurnId: null,
          lastAcceptedTurnId: turnState.block.turnId,
          awaitingComponentsFinalSave: false,
          awaitingStepsFinalSave: false,
          componentReviewMode:
            stage === 'COMPONENTS' ? session.componentReviewMode ?? null : session.componentReviewMode,
        }),
        refreshed!,
      );

      const refreshedDraft = await buildWorkingDraft({
        locale,
        ideaText: project.title,
        project: refreshed,
        clarification: clarification.block,
        clarificationMessageId: clarification.messageId,
        recentAnswers: collectRecentAnswers(messages),
      });

      const blocks: AiContentBlock[] = [
        textBlock(
          STAGE_ACK[locale][stage] ??
            (locale === 'ar' ? 'تم الحفظ.' : 'Saved.'),
        ),
        session,
        acceptedTurn,
      ];

      if (
        nextStage !== 'FINAL_REVIEW' &&
        nextStage !== 'COMPLETE' &&
        nextStage !== 'COMPONENTS_MODE' &&
        nextStage !== 'STEPS_MODE'
      ) {
        if (nextStage === 'STEPS_OVERVIEW' && stage === 'COMPONENTS') {
          session = updateSession(session, {
            flowStatus: 'WAITING_FOR_ASSISTANT',
            currentTurnId: null,
          });
          blocks[1] = session;
          try {
            const nextStageTurn = await createNextStageTurn({
              session,
              nextStage,
              draft: refreshedDraft,
              locale,
              project: refreshed!,
              clarification: clarification.block,
              recentAnswers: collectRecentAnswers(messages),
              ideaText:
                messages.find((message) => message.role === 'USER')?.contentText?.trim() ??
                project.title,
            });
            session = updateSession(nextStageTurn.session, {
              currentTurnId: nextStageTurn.turn.turnId,
              flowStatus: 'WAITING_FOR_USER',
              baseUpdatedAt: normalizeAuthoringTimestamp(refreshed!.updatedAt),
            });
            blocks[1] = session;
            blocks.push(nextStageTurn.turn);
            assertAuthoringVersionChain({
              project: refreshed!,
              session,
              turn: nextStageTurn.turn,
            });
          } catch (error) {
            session = updateSession(session, {
              flowStatus: 'GENERATION_FAILED',
              currentTurnId: null,
              baseUpdatedAt: normalizeAuthoringTimestamp(refreshed!.updatedAt),
            });
            blocks[0] = textBlock(
              locale === 'ar'
                ? 'تم حفظ المكوّنات، لكن تعذّر إنشاء خطة الخطوات.'
                : 'Components saved. The step plan could not be generated.',
            );
            blocks[1] = session;
          }
        } else {
          const nextStageTurn = await createNextStageTurn({
            session,
            nextStage,
            draft: refreshedDraft,
            locale,
            project: refreshed!,
            clarification: clarification.block,
            recentAnswers: collectRecentAnswers(messages),
            ideaText:
              messages.find((message) => message.role === 'USER')?.contentText?.trim() ??
              project.title,
          });
          session = updateSession(nextStageTurn.session, {
            currentTurnId: nextStageTurn.turn.turnId,
            baseUpdatedAt: normalizeAuthoringTimestamp(refreshed!.updatedAt),
          });
          blocks[1] = session;
          blocks.push(nextStageTurn.turn);
          assertAuthoringVersionChain({
            project: refreshed!,
            session,
            turn: nextStageTurn.turn,
          });
        }
      } else if (nextStage === 'FINAL_REVIEW') {
        blocks[0] = textBlock(
          locale === 'ar'
            ? 'مسودة مشروعك جاهزة للمراجعة النهائية.'
            : 'Your project draft is ready for final review.',
        );
      }

      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: turnState.assistantMessage.id,
        status: 'COMPLETED',
        contentBlocks: blocks,
        scopeClassification: 'DOMAIN_KNOWLEDGE',
        locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
      });

      await touchConversationActivity({
        conversationId: ownedConversation.id,
        locale,
        title: refreshed!.title,
      });

      return mapTurnResponse({
        conversation: ownedConversation,
        assistantMessage,
        blocks,
        locale,
      });
    }

    if (body.action === 'SAVE_MANUAL') {
      if (body.manualValue === undefined || body.manualValue === null) {
        throw new AppError('Manual value is required.', 400, 'VALIDATION_ERROR');
      }
      const stage = session.stage === 'OVERVIEW' ? 'TITLE' : session.stage;
      let patch: AuthoringSequentialStagePatch = {};
      if (stage === 'TITLE') patch = { title: String(body.manualValue) };
      if (stage === 'SHORT_DESCRIPTION') patch = { shortDescription: String(body.manualValue) };
      if (stage === 'FULL_DESCRIPTION') patch = { description: String(body.manualValue) };
      if (stage === 'DIFFICULTY') {
        patch = {
          difficulty: String(body.manualValue) as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
        };
      }
      if (stage === 'ESTIMATED_DURATION') {
        const minutes = Number(body.manualValue);
        if (!Number.isInteger(minutes) || minutes <= 0) {
          throw new AppError(
            locale === 'ar'
              ? 'يجب أن تكون المدة التقديرية عددًا موجبًا من الدقائق.'
              : 'Estimated duration must be a positive number of minutes.',
            400,
            'INVALID_ESTIMATED_DURATION',
          );
        }
        patch = { estimatedDurationMinutes: minutes };
      }
      if (stage === 'COMPONENTS') {
        if (!Array.isArray(body.manualValue)) {
          throw new AppError(
            locale === 'ar'
              ? 'يجب إرسال قائمة مكوّنات صالحة.'
              : 'A valid component list is required.',
            400,
            'VALIDATION_ERROR',
          );
        }
        const components = validateComponentList(body.manualValue as SequentialComponent[]);
        const normalizedNames = components.map((component) =>
          component.componentName.trim().toLowerCase(),
        );
        if (new Set(normalizedNames).size !== normalizedNames.length) {
          throw new AppError(
            'Duplicate component names are not allowed.',
            409,
            'DUPLICATE_COMPONENT_NAME',
          );
        }
        patch = { requiredComponents: components };
      }
      if (stage === 'STEPS_OVERVIEW' || stage === 'STEP_REVIEW') {
        if (!Array.isArray(body.manualValue)) {
          throw new AppError(
            locale === 'ar'
              ? 'يجب إرسال خطة خطوات صالحة.'
              : 'A valid step plan is required.',
            400,
            'VALIDATION_ERROR',
          );
        }
        const steps = validateStepList(
          (body.manualValue as Array<{ title: string; description: string }>).map((step) => ({
            title: String(step.title),
            description: String(step.description),
          })),
        );
        const clarification = findLatestClarificationState(messages)!;
        const draft = await buildWorkingDraft({
          locale,
          ideaText: project.title,
          project,
          clarification: clarification.block,
          clarificationMessageId: clarification.messageId,
          recentAnswers: collectRecentAnswers(messages),
        });
        const consistency = validateComponentStepConsistency({
          components: draft.components,
          steps,
          constraints: collectRecentAnswers(messages),
        });
        if (!consistency.ok) {
          throw new AppError(consistency.issues.join(' '), 409, 'AI_STEP_COMPONENT_INCONSISTENT');
        }
        patch = { steps };
      }

      if (Object.keys(patch).length === 0) {
        throw new AppError('Manual value is not supported for this stage.', 400, 'VALIDATION_ERROR');
      }

      try {
        await applyAuthoringStageToMyDraft({
          userId,
          projectId: project.id,
          expectedUpdatedAt: session.baseUpdatedAt,
          patch,
        });
      } catch (error) {
        if (stage === 'COMPONENTS') {
          throw new AppError(
            locale === 'ar'
              ? 'تعذّر حفظ قائمة المكوّنات. تم الاحتفاظ بإدخالك.'
              : 'Could not save the component list. Your input was preserved.',
            502,
            'AI_COMPONENT_SAVE_FAILED',
            { cause: error },
          );
        }
        if (stage === 'STEPS_OVERVIEW' || stage === 'STEP_REVIEW') {
          throw new AppError(
            locale === 'ar'
              ? 'تعذّر حفظ الخطوات. تم الاحتفاظ بخطتك.'
              : 'Could not save the steps. Your reviewed plan was preserved.',
            502,
            'AI_STEP_SAVE_FAILED',
            { cause: error },
          );
        }
        throw error;
      }
      const refreshed =
        await learningProjectsRepository.findMyLearningProjectSubmissionById(
          project.id,
          userId,
        );
      if (!refreshed) {
        throw new AppError('Project not found after save.', 404, 'LEARNING_PROJECT_NOT_FOUND');
      }
      assertRefreshedProjectMatchesPatch(refreshed, stage as SequentialStage, patch);
      const nextStage = nextStageAfter(stage as SequentialStage);
      session = stampSessionToProjectBasis(
        updateSession(session, {
          acceptedStages: [...session.acceptedStages, stage as SequentialStage],
          stage: nextStage,
          currentTurnId: null,
        }),
        refreshed!,
      );

      const clarification = findLatestClarificationState(messages)!;
      const draft = await buildWorkingDraft({
        locale,
        ideaText: project.title,
        project: refreshed,
        clarification: clarification.block,
        clarificationMessageId: clarification.messageId,
        recentAnswers: collectRecentAnswers(messages),
      });

      const blocks: AiContentBlock[] = [
        textBlock(locale === 'ar' ? 'تم حفظ قيمتك.' : 'Your value was saved.'),
        session,
      ];
      if (nextStage !== 'FINAL_REVIEW' && nextStage !== 'COMPLETE') {
        const nextStageTurn = await createNextStageTurn({
          session,
          nextStage,
          draft,
          locale,
          project: refreshed!,
          clarification: clarification.block,
          recentAnswers: collectRecentAnswers(messages),
          ideaText:
            messages.find((message) => message.role === 'USER')?.contentText?.trim() ??
            project.title,
        });
        session = updateSession(nextStageTurn.session, {
          currentTurnId: nextStageTurn.turn.turnId,
        });
        blocks[1] = session;
        blocks.push(nextStageTurn.turn);
      }

      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: sessionState.assistantMessage.id,
        status: 'COMPLETED',
        contentBlocks: blocks,
        scopeClassification: 'DOMAIN_KNOWLEDGE',
        locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
      });
      return mapTurnResponse({
        conversation: ownedConversation,
        assistantMessage,
        blocks,
        locale,
      });
    }

    if (body.action === 'EXPLAIN_STEP') {
      const turnId = body.turnId ?? session.currentTurnId;
      if (!turnId) {
        throw new AppError('Turn not found.', 404, 'AI_AUTHORING_TURN_NOT_FOUND');
      }
      const turnState = findTurnById(messages, turnId);
      if (!turnState) {
        throw new AppError('Turn not found.', 404, 'AI_AUTHORING_TURN_NOT_FOUND');
      }
      const beforeUpdatedAt = project.updatedAt.toISOString();
      const explanation =
        locale === 'ar'
          ? 'هذه الخطوة توضّح كيفية توصيل المكوّن بأمان واختباره قبل الانتقال للخطوة التالية.'
          : 'This step explains how to wire the component safely and test it before moving on.';
      const blocks: AiContentBlock[] = [
        textBlock(explanation),
        session,
        turnState.block,
      ];
      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: turnState.assistantMessage.id,
        status: 'COMPLETED',
        contentBlocks: blocks,
        scopeClassification: 'DOMAIN_KNOWLEDGE',
        locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
      });
      const afterProject =
        await learningProjectsRepository.findMyLearningProjectSubmissionById(
          project.id,
          userId,
        );
      if (afterProject?.updatedAt.toISOString() !== beforeUpdatedAt) {
        throw new AppError('Explain step must not write project.', 500, 'INTERNAL_ERROR');
      }
      return mapTurnResponse({
        conversation: ownedConversation,
        assistantMessage,
        blocks,
        locale,
      });
    }

    if (body.action === 'REMOVE_ITEM' || body.action === 'ADD_ITEM' || body.action === 'BACK_ITEM') {
      const index =
        typeof body.manualValue === 'number'
          ? body.manualValue
          : session.currentComponentIndex ?? session.currentStepIndex ?? 0;
      const clarification = findLatestClarificationState(messages)!;
      const draft = await buildWorkingDraft({
        locale,
        ideaText: project.title,
        project,
        clarification: clarification.block,
        clarificationMessageId: clarification.messageId,
        recentAnswers: collectRecentAnswers(messages),
      });

      if (session.stage === 'COMPONENTS' && session.componentReviewMode === 'ONE_BY_ONE') {
        let workingComponents = [...(session.workingComponents ?? draft.components)];
        if (body.action === 'REMOVE_ITEM') {
          workingComponents = removeWorkingComponentAt(workingComponents, index);
        } else if (body.action === 'ADD_ITEM' && body.manualValue && typeof body.manualValue === 'object') {
          workingComponents.push(body.manualValue as SequentialComponent);
        } else if (body.action === 'BACK_ITEM') {
          const previous = Math.max(0, (session.currentComponentIndex ?? 0) - 1);
          session = updateSession(session, { currentComponentIndex: previous, workingComponents });
          const turn = buildTurnForStage({ session, stage: 'COMPONENTS', draft, locale });
          session = updateSession(session, { currentTurnId: turn.turnId });
          const blocks: AiContentBlock[] = [
            textBlock(locale === 'ar' ? 'عدنا للمكوّن السابق.' : 'Back to the previous component.'),
            session,
            turn,
          ];
          const assistantMessage = await createAssistantMessage({
            conversationId: ownedConversation.id,
            inReplyToMessageId: sessionState.assistantMessage.id,
            status: 'COMPLETED',
            contentBlocks: blocks,
            scopeClassification: 'DOMAIN_KNOWLEDGE',
            locale,
            provider: 'system',
            model: null,
            policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
            latencyMs: 0,
            inputTokens: null,
            outputTokens: null,
          });
          return mapTurnResponse({ conversation: ownedConversation, assistantMessage, blocks, locale });
        }
        const nextIndex = Math.min(index, Math.max(workingComponents.length - 1, 0));
        session = updateSession(session, {
          workingComponents,
          currentComponentIndex: nextIndex,
          componentSourceTotal: workingComponents.length,
          acceptedComponentIndexes: [],
          awaitingComponentsFinalSave: false,
        });
        const turn = buildTurnForStage({ session, stage: 'COMPONENTS', draft, locale });
        session = updateSession(session, { currentTurnId: turn.turnId });
        const blocks: AiContentBlock[] = [
          textBlock(
            body.action === 'REMOVE_ITEM'
              ? locale === 'ar'
                ? 'تمت إزالة المكوّن من القائمة قيد المراجعة.'
                : 'Component removed from the working list.'
              : locale === 'ar'
                ? 'تمت إضافة مكوّن إلى القائمة قيد المراجعة.'
                : 'Component added to the working list.',
          ),
          session,
          turn,
        ];
        const assistantMessage = await createAssistantMessage({
          conversationId: ownedConversation.id,
          inReplyToMessageId: sessionState.assistantMessage.id,
          status: 'COMPLETED',
          contentBlocks: blocks,
          scopeClassification: 'DOMAIN_KNOWLEDGE',
          locale,
          provider: 'system',
          model: null,
          policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
          latencyMs: 0,
          inputTokens: null,
          outputTokens: null,
        });
        return mapTurnResponse({ conversation: ownedConversation, assistantMessage, blocks, locale });
      }

      if (session.stage === 'STEP_REVIEW' && session.stepReviewMode === 'STEP_BY_STEP') {
        let workingSteps = reindexWorkingSteps([...(session.workingSteps ?? draft.steps)]);
        if (body.action === 'REMOVE_ITEM') {
          workingSteps = removeWorkingStepAt(workingSteps, index);
        } else if (body.action === 'ADD_ITEM' && body.manualValue && typeof body.manualValue === 'object') {
          const step = body.manualValue as SequentialStep;
          workingSteps.push(step);
        } else if (body.action === 'BACK_ITEM') {
          const previous = Math.max(0, (session.currentStepIndex ?? 0) - 1);
          session = updateSession(session, { currentStepIndex: previous, workingSteps });
          const turn = buildTurnForStage({
            session,
            stage: 'STEP_REVIEW',
            draft: { ...draft, steps: workingSteps },
            locale,
          });
          session = updateSession(session, { currentTurnId: turn.turnId });
          const blocks: AiContentBlock[] = [
            textBlock(locale === 'ar' ? 'عدنا للخطوة السابقة.' : 'Back to the previous step.'),
            session,
            turn,
          ];
          const assistantMessage = await createAssistantMessage({
            conversationId: ownedConversation.id,
            inReplyToMessageId: sessionState.assistantMessage.id,
            status: 'COMPLETED',
            contentBlocks: blocks,
            scopeClassification: 'DOMAIN_KNOWLEDGE',
            locale,
            provider: 'system',
            model: null,
            policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
            latencyMs: 0,
            inputTokens: null,
            outputTokens: null,
          });
          return mapTurnResponse({ conversation: ownedConversation, assistantMessage, blocks, locale });
        }
        const nextIndex = Math.min(index, Math.max(workingSteps.length - 1, 0));
        session = updateSession(session, {
          workingSteps,
          currentStepIndex: nextIndex,
          acceptedStepIndexes: [],
          awaitingStepsFinalSave: false,
        });
        const turn = buildTurnForStage({
          session,
          stage: 'STEP_REVIEW',
          draft: { ...draft, steps: workingSteps },
          locale,
        });
        session = updateSession(session, { currentTurnId: turn.turnId });
        const blocks: AiContentBlock[] = [
          textBlock(
            body.action === 'REMOVE_ITEM'
              ? locale === 'ar'
                ? 'تمت إزالة الخطوة من الخطة قيد المراجعة.'
                : 'Step removed from the working plan.'
              : locale === 'ar'
                ? 'تمت إضافة خطوة إلى الخطة قيد المراجعة.'
                : 'Step added to the working plan.',
          ),
          session,
          turn,
        ];
        const assistantMessage = await createAssistantMessage({
          conversationId: ownedConversation.id,
          inReplyToMessageId: sessionState.assistantMessage.id,
          status: 'COMPLETED',
          contentBlocks: blocks,
          scopeClassification: 'DOMAIN_KNOWLEDGE',
          locale,
          provider: 'system',
          model: null,
          policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
          latencyMs: 0,
          inputTokens: null,
          outputTokens: null,
        });
        return mapTurnResponse({ conversation: ownedConversation, assistantMessage, blocks, locale });
      }

      throw new AppError('Item action is not available in the current stage.', 400, 'VALIDATION_ERROR');
    }

    if (body.action === 'FINALIZE_SECTION') {
      const turnId = body.turnId ?? session.currentTurnId;
      if (!turnId) {
        throw new AppError('Turn not found.', 404, 'AI_AUTHORING_TURN_NOT_FOUND');
      }
      return runSequentialAuthoringActionForUser(userId, conversationId, {
        action: 'ACCEPT_TURN',
        turnId,
      });
    }

    if (body.action === 'SUGGEST_ANOTHER') {
      const suggestTurnId = body.turnId ?? session.currentTurnId;
      if (!suggestTurnId) {
        throw new AppError('Turn not found.', 404, 'AI_AUTHORING_TURN_NOT_FOUND');
      }
      const turnState = findTurnById(messages, suggestTurnId);
      if (!turnState || turnState.block.sessionId !== session.sessionId) {
        throw new AppError('Turn not found.', 404, 'AI_AUTHORING_TURN_NOT_FOUND');
      }

      const clarification = findLatestClarificationState(messages)!;
      const draft = await buildWorkingDraft({
        locale,
        ideaText: project.title,
        project,
        clarification: clarification.block,
        clarificationMessageId: clarification.messageId,
        recentAnswers: body.comment?.trim()
          ? [...collectRecentAnswers(messages), body.comment.trim()]
          : collectRecentAnswers(messages),
      });

      const stage = turnState.block.stage;
      const effectiveStage =
        stage === 'COMPONENTS' && session.acceptedStages.includes('COMPONENTS')
          ? 'STEPS_OVERVIEW'
          : stage;

      const refreshedSession = updateSession(session, {
        flowStatus: 'WAITING_FOR_USER',
        baseUpdatedAt: project.updatedAt.toISOString(),
        stage: stage === 'OVERVIEW' ? 'TITLE' : stage,
      });

      let sessionWithTurn = refreshedSession;
      let newTurn: AiProjectAuthoringTurnBlock;
      if (stage === 'COMPONENTS' && !session.componentReviewMode) {
        const currentComponents = componentsFromTurnProposal(turnState.block.proposal);
        const listContext = buildComponentListContext({
          locale,
          ideaText:
            messages.find((message) => message.role === 'USER')?.contentText?.trim() ??
            project.title,
          project,
          clarification: clarification.block,
          recentAnswers: body.comment?.trim()
            ? [...collectRecentAnswers(messages), body.comment.trim()]
            : collectRecentAnswers(messages),
        });
        let generated;
        try {
          generated = await generateAlternativeSequentialComponentListWithRepair({
            ...listContext,
            previousComponents: currentComponents,
          });
        } catch (error) {
          if (error instanceof AppError && error.code === 'AI_COMPONENT_PROPOSAL_IDENTICAL') {
            throw error;
          }
          throw new AppError(
            locale === 'ar'
              ? 'تعذّر على المساعد إنشاء قائمة مكوّنات صالحة. أعد المحاولة.'
              : 'The assistant could not create a valid component list. Retry.',
            502,
            'AI_COMPONENT_PROPOSAL_INVALID',
            { cause: error },
          );
        }
        sessionWithTurn = updateSession(refreshedSession, {
          workingComponents: generated.components,
        });
        newTurn = buildTurnForStage({
          session: sessionWithTurn,
          stage: 'COMPONENTS',
          draft: {
            ...draft,
            components: normalizeSequentialComponents(generated.components),
          },
          locale,
          explanation: generated.explanation,
        });
      } else if (
        (effectiveStage === 'STEPS_OVERVIEW' || effectiveStage === 'STEP_REVIEW') &&
        !session.stepReviewMode
      ) {
        const currentSteps = stepsFromTurnProposal(turnState.block.proposal);
        let generated;
        try {
          generated = await generateAlternativeSequentialStepPlanWithRepair({
            ...buildStepListContext({
              locale,
              ideaText:
                messages.find((message) => message.role === 'USER')?.contentText?.trim() ??
                project.title,
              project,
              clarification: clarification.block,
              recentAnswers: body.comment?.trim()
                ? [...collectRecentAnswers(messages), body.comment.trim()]
                : collectRecentAnswers(messages),
              draft,
            }),
            previousSteps: currentSteps,
          });
        } catch (error) {
          if (error instanceof AppError && error.code === 'AI_STEP_PLAN_IDENTICAL') {
            throw error;
          }
          throw new AppError(
            locale === 'ar'
              ? 'تعذّر على المساعد إنشاء خطة خطوات صالحة. أعد المحاولة.'
              : 'The assistant could not create a valid step plan. Retry.',
            502,
            'AI_STEP_PROPOSAL_INVALID',
            { cause: error },
          );
        }
        sessionWithTurn = updateSession(refreshedSession, {
          workingSteps: generated.steps,
        });
        newTurn = buildTurnForStage({
          session: sessionWithTurn,
          stage: 'STEPS_OVERVIEW',
          draft: { ...draft, steps: generated.steps },
          locale,
          explanation: generated.explanation,
          baseUpdatedAt: normalizeAuthoringTimestamp(project.updatedAt),
        });
      } else {
        newTurn = buildTurnForStage({
          session: refreshedSession,
          stage: stage === 'OVERVIEW' ? 'TITLE' : stage,
          draft,
          locale,
          explanation:
            body.comment?.trim() ||
            (locale === 'ar' ? 'إليك اقتراحًا بديلًا.' : 'Here is another suggestion.'),
        });
        sessionWithTurn = refreshedSession;
      }

      sessionWithTurn = updateSession(sessionWithTurn, {
        currentTurnId: newTurn.turnId,
      });
      const superseded = supersedeTurn(turnState.block);
      const suggestionText =
        stage === 'COMPONENTS' && !session.componentReviewMode
          ? locale === 'ar'
            ? 'إليك قائمة مكوّنات بديلة.'
            : 'Here is an alternative component list.'
          : (stage === 'STEPS_OVERVIEW' || stage === 'STEP_REVIEW') && !session.stepReviewMode
            ? locale === 'ar'
              ? 'إليك خطة خطوات بديلة.'
              : 'Here is an alternative step plan.'
            : locale === 'ar'
              ? 'إليك اقتراحًا محدّثًا لهذه المرحلة.'
              : 'Here is an updated suggestion for this stage.';
      const blocks: AiContentBlock[] = [
        textBlock(suggestionText),
        sessionWithTurn,
        superseded,
        newTurn,
      ];

      let userMessageId: string | null = null;
      if (body.comment?.trim() && body.clientMessageId) {
        const userMessage = await createUserMessage({
          conversationId: ownedConversation.id,
          contentText: body.comment.trim(),
          clientMessageId: body.clientMessageId,
          locale,
        });
        userMessageId = userMessage.id;
      }

      const assistantMessage = await createAssistantMessage({
        conversationId: ownedConversation.id,
        inReplyToMessageId: userMessageId ?? turnState.assistantMessage.id,
        status: 'COMPLETED',
        contentBlocks: blocks,
        scopeClassification: 'DOMAIN_KNOWLEDGE',
        locale,
        provider: 'system',
        model: null,
        policyVersion: PROJECT_AUTHORING_SEQUENTIAL_POLICY_VERSION,
        latencyMs: 0,
        inputTokens: null,
        outputTokens: null,
      });
      return mapTurnResponse({
        conversation: ownedConversation,
        userMessageId,
        assistantMessage,
        blocks,
        locale,
      });
    }

  throw new AppError('Unsupported action.', 400, 'VALIDATION_ERROR');
  } finally {
    await releaseConversationProcessingLock(ownedConversation.id);
  }
};

export const getSequentialAuthoringStateForUser = async (
  userId: string,
  conversationId: string,
): Promise<{ authoringSnapshot: AuthoringSnapshot | null }> => {
  const persistedSnapshot = await tryGetPersistedAuthoringSnapshot(userId, conversationId);
  if (persistedSnapshot) {
    return { authoringSnapshot: persistedSnapshot };
  }

  const ownedConversation = await findOwnedConversation({ conversationId, userId });
  if (!ownedConversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }

  const { project } = await assertAuthoringConversation(ownedConversation, userId);
  const messages = await loadRecentConversationMessages({
    conversationId: ownedConversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });

  return {
    authoringSnapshot: buildAuthoringSnapshot({
      project,
      messages,
      hasLegacyBlocks: hasLegacyAuthoringBlocks(messages),
    }),
  };
};

export const discussSequentialAuthoringTurnForUser = async (
  userId: string,
  conversationId: string,
  turnId: string,
  body: { comment: string; clientMessageId: string },
): Promise<AiTurnResponse> => {
  const ownedConversation = await findOwnedConversation({ conversationId, userId });
  if (!ownedConversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }

  const { project } = await assertAuthoringConversation(ownedConversation, userId);
  const locale = (ownedConversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;
  const trimmed = body.comment.trim();
  if (trimmed.length < 8) {
    throw new AppError(
      locale === 'ar'
        ? 'أضف تعليقًا أوضح يصف التغيير المطلوب.'
        : 'Add a clearer comment describing the change you want.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const { projectAuthoringSessionRepository } = await import(
    './project-authoring-session.repository.js'
  );
  const persistedSession = await projectAuthoringSessionRepository.findByConversationId(
    ownedConversation.id,
  );
  if (persistedSession?.currentTurnId === turnId) {
    const { submitPersistedComposerFeedback } = await import(
      './project-authoring-session.service.js'
    );
    await acquireConversationProcessingLock({
      conversationId: ownedConversation.id,
      staleBefore: new Date(Date.now() - env.aiChatProcessingStaleMs),
    });
    try {
      const result = await submitPersistedComposerFeedback({
        userId,
        sessionId: persistedSession.id,
        conversation: ownedConversation,
        project,
        locale,
        comment: trimmed,
        clientMessageId: body.clientMessageId,
        expectedVersion: persistedSession.version,
      });
      const turn = await toLegacyAiTurnResponse({
        result,
        conversationId: ownedConversation.id,
        locale,
        project,
        conversation: ownedConversation,
      });
      if (!turn) {
        throw new AppError(
          'Failed to process authoring feedback.',
          500,
          'AI_AUTHORING_FEEDBACK_FAILED',
        );
      }
      return turn;
    } finally {
      await releaseConversationProcessingLock(ownedConversation.id);
    }
  }

  const messages = await loadRecentConversationMessages({
    conversationId: ownedConversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });
  const sessionState = findLatestAuthoringSessionState(messages);
  const turnState = findTurnById(messages, turnId);
  if (!sessionState || !turnState) {
    throw new AppError('Turn not found.', 404, 'AI_AUTHORING_TURN_NOT_FOUND');
  }

  if (turnState.block.turnId !== sessionState.block.currentTurnId) {
    throw new AppError('This turn is no longer active.', 409, 'AI_AUTHORING_TURN_NOT_ACTIVE');
  }

  if (turnState.block.status !== 'PROPOSED') {
    throw new AppError('This turn is no longer active.', 409, 'AI_AUTHORING_TURN_NOT_ACTIVE');
  }

  await acquireConversationProcessingLock({
    conversationId: ownedConversation.id,
    staleBefore: new Date(Date.now() - env.aiChatProcessingStaleMs),
  });
  try {
    return await processStageFeedback({
      userId,
      ownedConversation,
      sessionState,
      turnState,
      project,
      locale,
      comment: trimmed,
      clientMessageId: body.clientMessageId,
    });
  } finally {
    await releaseConversationProcessingLock(ownedConversation.id);
  }
};
