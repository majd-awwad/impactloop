import { randomUUID } from 'node:crypto';

import type {
  Prisma,
  ProjectAuthoringSessionStage,
  ProjectAuthoringTurnKind,
} from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  applyAuthoringStageToMyDraft,
  type AuthoringSequentialStagePatch,
} from '../learning-projects/learning-projects.service.js';
import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';
import { findOwnedConversation, loadRecentConversationMessages } from './ai.repository.js';
import { buildBoundedConversationHistory } from './ai-context-builder.js';
import { getAiChatProvider } from './providers/ai-chat-provider.factory.js';
import { generateSequentialComponentListWithRepair } from './ai-project-authoring-sequential-components.provider.js';
import {
  areScalarsMateriallyIdentical,
  generateSequentialStageDiscussionWithRepair,
} from './ai-project-authoring-sequential-discussion.provider.js';
import {
  buildAuthoringRepairIssue,
  buildDeterministicReadyClarification,
  computeAuthoringTopicState,
  evaluateAuthoringReadiness,
  generateAuthoringClarification,
  MAX_AUTHORING_CLARIFICATION_QUESTIONS,
  normalizeQuestionPrompt,
  parseAuthoringClarificationBlock,
  validateAuthoringClarificationPolicy,
  type AuthoringClarificationContext,
} from './ai-project-authoring-clarification.provider.js';
import { formatAuthoringProviderSchemaRepairIssue } from './ai-project-authoring-clarification.shared.js';
import {
  isAuthoringDraftPlaceholderDescription,
  isAuthoringDraftPlaceholderShortDescription,
  isAuthoringDraftPlaceholderTitle,
} from '../learning-projects/learning-projects.authoring-draft-fields.js';
import type { AiProjectAuthoringClarificationBlock } from './ai.content-blocks.js';
import {
  applyResolvedComponentRefsToSteps,
  filterComponentConsistencyFalsePositives,
  computeStepPlanQualityRequirements,
  evaluateStepPlanQuality,
  buildStepQualityRepairIssue,
  type StepPlanQualityRequirements,
} from './ai-project-authoring-real.provider.js';
import { resolveAiChatProvider } from '../../config/env.js';
import {
  generateSequentialStepList,
  generateSequentialStepListWithRepair,
  validateStepList,
} from './ai-project-authoring-sequential-steps.provider.js';
import type { StepListContext } from './ai-project-authoring-sequential-steps.provider.js';
import {
  reindexWorkingSteps,
  validateComponentStepConsistency,
} from './ai-project-authoring-sequential.policy.js';
import {
  projectAuthoringSessionRepository,
  type ProjectAuthoringSessionWithTurn,
} from './project-authoring-session.repository.js';
import {
  emptyComponentWorkingState,
  emptyStepWorkingState,
  mergeConfirmedRequirementsIntoComponentState,
  parseComponentWorkingState,
  parseStepWorkingState,
  readConfirmedRequirements,
  type AuthoringConfirmedRequirements,
  type ComponentWorkingState,
  type SequentialComponent,
  type SequentialStep,
  type StepWorkingState,
} from './project-authoring-session.state.js';
import {
  MAX_PROPOSAL_COMPONENTS,
  MAX_PROPOSAL_STEPS,
  MIN_PROPOSAL_COMPONENTS,
} from './ai-project-authoring-proposal.policy.js';
import type { AiLocale, BoundedHistoryMessage } from './ai.types.js';
import type { ProjectRecord } from './project-authoring-session.types.js';

export type { ProjectRecord } from './project-authoring-session.types.js';

export const STAGE_ORDER: ProjectAuthoringSessionStage[] = [
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

export const nextStageAfter = (stage: ProjectAuthoringSessionStage): ProjectAuthoringSessionStage => {
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

export const assertPersistedAuthoringContext = (input: {
  conversationId: string;
  conversation: { id: string; learningProjectId: string | null; userId: string };
  session: ProjectAuthoringSessionWithTurn;
  project: ProjectRecord;
  userId: string;
}) => {
  if (input.conversation.id !== input.conversationId) {
    throw new AppError(
      'This authoring session does not belong to this project. Reload the workspace.',
      409,
      'AI_AUTHORING_WORKSPACE_MISMATCH',
    );
  }
  if (input.session.conversationId !== input.conversationId) {
    throw new AppError(
      'This authoring session does not belong to this project. Reload the workspace.',
      409,
      'AI_AUTHORING_WORKSPACE_MISMATCH',
    );
  }
  if (input.session.learningProjectId !== input.project.id) {
    throw new AppError(
      'This authoring session does not belong to this project. Reload the workspace.',
      409,
      'AI_AUTHORING_WORKSPACE_MISMATCH',
    );
  }
  if (input.conversation.learningProjectId !== input.project.id) {
    throw new AppError(
      'This authoring session does not belong to this project. Reload the workspace.',
      409,
      'AI_AUTHORING_WORKSPACE_MISMATCH',
    );
  }
  if (input.session.ownerId !== input.userId) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }
};

export const loadProjectForConversation = async (userId: string, conversationId: string) => {
  const conversation = await findOwnedConversation({ conversationId, userId });
  if (!conversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }
  if (!conversation.learningProjectId) {
    throw new AppError('Conversation is not bound to a project.', 409, 'AI_AUTHORING_CONTEXT_MISMATCH');
  }
  const project = await learningProjectsRepository.findMyLearningProjectSubmissionById(
    conversation.learningProjectId,
    userId,
  );
  if (!project) {
    throw new AppError('Learning project submission not found', 404, 'NOT_FOUND');
  }
  if (project.status !== 'DRAFT') {
    throw new AppError(
      'Only draft projects can be updated during guided authoring.',
      409,
      'PROJECT_NOT_EDITABLE',
    );
  }
  return { conversation, project };
};

export const learnerConstraintHints = (project: ProjectRecord): string[] => {
  const combined = [project.title, project.shortDescription, project.description ?? '']
    .join('\n')
    .trim();
  return combined.length > 0 ? [combined] : [];
};

const IRRELEVANT_SOFTWARE_FINANCE_PATTERNS = [
  /\btransaction(s)?\b/i,
  /\bfinancial\b/i,
  /\bincome\b/i,
  /\bexpense(s)?\b/i,
  /\bdatabase management\b/i,
  /\bui components?\b/i,
  /\bdata visualization\b/i,
  /\bexpense management\b/i,
  /\bbudget app/i,
  /\bweb (app|application|ui)\b/i,
  /\bmobile app\b/i,
  /تسجيل المعاملات/i,
  /البيانات المالية/i,
  /الدخل والمصروفات/i,
  /واجهة المستخدم/i,
  /قاعدة بيانات/i,
];

const HARDWARE_PROJECT_SIGNALS = [
  /\barduino\b/i,
  /\bldr\b/i,
  /\bled\b/i,
  /\bbreadboard\b/i,
  /\bjumper\b/i,
  /مصباح/i,
  /حساس ضوء/i,
  /اردوينو/i,
  /مقاومة/i,
];

const EXPLICIT_ARABIC_LANGUAGE_PATTERN =
  /(بالعربي|بالعربية|عربي|عربية|اكتب(?:وا)?\s+بالعربي|arabic)/iu;
const EXPLICIT_ENGLISH_LANGUAGE_PATTERN =
  /(in english|بالانجليز|بالإنجليز|english only|write in english)/iu;

export const readSessionContentLocale = (
  session: ProjectAuthoringSessionWithTurn | { componentWorkingState?: unknown },
): AiLocale | null => {
  if (!session.componentWorkingState || typeof session.componentWorkingState !== 'object') {
    return null;
  }
  const value = (session.componentWorkingState as Record<string, unknown>).contentLocale;
  return value === 'ar' || value === 'en' ? value : null;
};

export const persistSessionContentLocale = async (input: {
  sessionId: string;
  expectedVersion: number;
  sessionRecord: ProjectAuthoringSessionWithTurn;
  contentLocale: AiLocale;
}) => {
  const base =
    input.sessionRecord.componentWorkingState &&
    typeof input.sessionRecord.componentWorkingState === 'object'
      ? { ...(input.sessionRecord.componentWorkingState as Record<string, unknown>) }
      : {};
  if (base.contentLocale === input.contentLocale) {
    return input.sessionRecord;
  }
  return projectAuthoringSessionRepository.updateSession({
    sessionId: input.sessionId,
    expectedVersion: input.expectedVersion,
    patch: {
      componentWorkingState: {
        ...base,
        contentLocale: input.contentLocale,
      },
    },
  });
};

const buildAcceptedProjectCorpus = (project: ProjectRecord, ideaText: string) =>
  [
    isAuthoringDraftPlaceholderTitle(project.title) ? '' : project.title,
    isAuthoringDraftPlaceholderShortDescription(project.shortDescription)
      ? ''
      : project.shortDescription,
    isAuthoringDraftPlaceholderDescription(project.description ?? '') ? '' : project.description,
    ideaText,
  ]
    .filter(Boolean)
    .join('\n');

const textLooksArabic = (text: string) => /[\u0600-\u06FF]/u.test(text);

export const resolveAuthoringIdeaMessage = (
  messages: Array<{ role: string; contentText?: string | null }>,
) => {
  const idea = messages.find((message) => message.role === 'USER')?.contentText?.trim();
  if (!idea) {
    throw new AppError('Project idea message not found.', 404, 'NOT_FOUND');
  }
  return idea;
};

const localizeAcceptedFieldForSession = (input: {
  contentLocale: AiLocale;
  ideaText: string;
  acceptedValue: string;
  isPlaceholder: boolean;
  maxLength?: number;
}) => {
  if (input.isPlaceholder) {
    return input.maxLength != null
      ? input.ideaText.slice(0, input.maxLength)
      : input.ideaText;
  }
  if (input.contentLocale === 'ar' && !textLooksArabic(input.acceptedValue)) {
    return input.maxLength != null
      ? input.ideaText.slice(0, input.maxLength)
      : input.ideaText;
  }
  return input.acceptedValue;
};

export const resolveAuthoringContentLocale = (input: {
  ideaText: string;
  userComment?: string | null;
  acceptedProjectText?: string | null;
  uiLocale: AiLocale;
  storedContentLocale?: AiLocale | null;
}): AiLocale => {
  const comment = input.userComment?.trim() ?? '';
  const idea = input.ideaText.trim();
  const accepted = input.acceptedProjectText?.trim() ?? '';

  if (input.storedContentLocale === 'ar') {
    if (comment && EXPLICIT_ENGLISH_LANGUAGE_PATTERN.test(comment)) {
      return 'en';
    }
    return 'ar';
  }
  if (input.storedContentLocale === 'en') {
    if (comment && EXPLICIT_ARABIC_LANGUAGE_PATTERN.test(comment)) {
      return 'ar';
    }
    return 'en';
  }

  if (comment && EXPLICIT_ARABIC_LANGUAGE_PATTERN.test(comment)) {
    return 'ar';
  }
  if (comment && EXPLICIT_ENGLISH_LANGUAGE_PATTERN.test(comment)) {
    return 'en';
  }
  if (/[\u0600-\u06FF]/u.test(idea)) {
    return 'ar';
  }
  if (comment && /[\u0600-\u06FF]/u.test(comment)) {
    return 'ar';
  }
  if (accepted && /[\u0600-\u06FF]/u.test(accepted)) {
    return 'ar';
  }
  return input.uiLocale;
};

export const resolveAndPersistAuthoringContentLocale = async (input: {
  conversationId: string;
  project: ProjectRecord;
  uiLocale: AiLocale;
  sessionRecord: ProjectAuthoringSessionWithTurn;
  userComment?: string | null;
}): Promise<{ locale: AiLocale; session: ProjectAuthoringSessionWithTurn }> => {
  const messages = await loadRecentConversationMessages({
    conversationId: input.conversationId,
    limit: 40,
  });
  const ideaMessage = resolveAuthoringIdeaMessage(messages);

  const stored = readSessionContentLocale(input.sessionRecord);
  const locale = resolveAuthoringContentLocale({
    ideaText: ideaMessage,
    userComment: input.userComment,
    acceptedProjectText: buildAcceptedProjectCorpus(input.project, ideaMessage),
    uiLocale: input.uiLocale,
    storedContentLocale: stored,
  });

  if (stored === locale) {
    return { locale, session: input.sessionRecord };
  }

  const session = await persistSessionContentLocale({
    sessionId: input.sessionRecord.id,
    expectedVersion: input.sessionRecord.version,
    sessionRecord: input.sessionRecord,
    contentLocale: locale,
  });
  return { locale, session };
};

export const textMeetsArabicSessionLanguage = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }
  const arabicCount = (trimmed.match(/[\u0600-\u06FF]/gu) ?? []).length;
  return arabicCount >= 6;
};

export const assertSessionLanguageSurface = (
  contentLocale: AiLocale,
  text: string,
  field: string,
) => {
  if (contentLocale !== 'ar') {
    return;
  }
  if (!textMeetsArabicSessionLanguage(text)) {
    throw new AppError(
      `Generated ${field} must be written in Arabic for this project session.`,
      502,
      'AI_AUTHORING_LANGUAGE_MISMATCH',
      { field },
    );
  }
};

const isStructuredScalarStageValue = (
  stage: ProjectAuthoringSessionStage,
  value: string | number,
) => {
  if (stage === 'DIFFICULTY') {
    return value === 'BEGINNER' || value === 'INTERMEDIATE' || value === 'ADVANCED';
  }
  if (stage === 'ESTIMATED_DURATION') {
    return typeof value === 'number' && Number.isFinite(value);
  }
  return false;
};

export const assertScalarStageProposalLanguage = (
  contentLocale: AiLocale,
  stage: ProjectAuthoringSessionStage,
  proposedValue: string | number,
  assistantText: string,
) => {
  assertSessionLanguageSurface(contentLocale, assistantText, 'stage explanation');
  if (isStructuredScalarStageValue(stage, proposedValue)) {
    return;
  }
  assertSessionLanguageSurface(contentLocale, `${proposedValue}`, 'stage proposal');
};

const assertClarificationSessionLanguage = (
  contentLocale: AiLocale,
  block: AiProjectAuthoringClarificationBlock,
  assistantText: string,
) => {
  if (contentLocale !== 'ar') {
    return;
  }
  assertSessionLanguageSurface(contentLocale, assistantText, 'clarification assistant text');
  const question = block.nextQuestion;
  if (question?.prompt) {
    assertSessionLanguageSurface(contentLocale, question.prompt, 'clarification question');
  }
  for (const option of question?.options ?? []) {
    if (option.trim()) {
      assertSessionLanguageSurface(contentLocale, option, 'clarification option');
    }
  }
  if (block.summary?.trim()) {
    assertSessionLanguageSurface(contentLocale, block.summary, 'clarification summary');
  }
};

const ARABIC_LANGUAGE_REPAIR_ISSUE =
  'The session content language is Arabic. Rewrite every learner-facing sentence in Arabic. Keep technical terms such as Arduino, LDR, LED, Breadboard, USB, and Threshold in English when natural.';

const isPrimarilyArabicText = (text: string) => {
  const arabicCount = (text.match(/[\u0600-\u06FF]/gu) ?? []).length;
  const latinCount = (text.match(/[a-zA-Z]/g) ?? []).length;
  return arabicCount > 0 && arabicCount >= latinCount;
};

const projectLooksHardwareOriented = (corpus: string) =>
  HARDWARE_PROJECT_SIGNALS.some((pattern) => pattern.test(corpus));

const stepPlanLooksIrrelevant = (input: {
  ideaText: string;
  project: ProjectRecord;
  steps: SequentialStep[];
}) => {
  const projectCorpus = [
    input.ideaText,
    input.project.title,
    input.project.shortDescription,
    input.project.description ?? '',
    ...learnerConstraintHints(input.project),
  ].join('\n');
  const planText = input.steps.map((step) => `${step.title} ${step.description}`).join('\n');
  if (!projectLooksHardwareOriented(projectCorpus)) {
    return [];
  }
  const issues: string[] = [];
  for (const pattern of IRRELEVANT_SOFTWARE_FINANCE_PATTERNS) {
    if (pattern.test(planText)) {
      issues.push(
        `Step plan references unrelated software or finance concepts (${pattern.source}).`,
      );
    }
  }
  return issues;
};

const stepPlanLanguageIssues = (input: {
  ideaText: string;
  contentLocale: AiLocale;
  steps: SequentialStep[];
}) => {
  if (input.contentLocale !== 'ar') {
    return [];
  }
  const planText = input.steps.map((step) => `${step.title} ${step.description}`).join('\n');
  if (!textMeetsArabicSessionLanguage(planText) && !isPrimarilyArabicText(planText)) {
    return ['Step plan must be written in Arabic for this project session.'];
  }
  return [];
};

export const buildStepAuthoringContext = async (input: {
  project: ProjectRecord;
  conversationId: string;
  sessionId?: string;
  uiLocale: AiLocale;
  userComment?: string | null;
  repairAttempt?: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
  sessionRecord?: ProjectAuthoringSessionWithTurn | null;
}): Promise<StepListContext> => {
  if (input.sessionRecord && input.sessionId) {
    // Only validate identity fields that are actually populated on the record so
    // partial/mock session records do not trigger false workspace mismatches.
    if (input.sessionRecord.id && input.sessionRecord.id !== input.sessionId) {
      throw new AppError(
        input.uiLocale === 'ar'
          ? 'جلسة التأليف لا تطابق السياق الحالي.'
          : 'The authoring session does not match the active workspace.',
        409,
        'AI_AUTHORING_WORKSPACE_MISMATCH',
      );
    }
    if (
      input.sessionRecord.learningProjectId &&
      input.sessionRecord.learningProjectId !== input.project.id
    ) {
      throw new AppError(
        input.uiLocale === 'ar'
          ? 'جلسة التأليف لا تطابق هذا المشروع.'
          : 'This authoring session does not match the current project.',
        409,
        'AI_AUTHORING_WORKSPACE_MISMATCH',
      );
    }
    if (
      input.sessionRecord.conversationId &&
      input.sessionRecord.conversationId !== input.conversationId
    ) {
      throw new AppError(
        input.uiLocale === 'ar'
          ? 'جلسة التأليف لا تطابق هذه المحادثة.'
          : 'This authoring session does not match the active conversation.',
        409,
        'AI_AUTHORING_WORKSPACE_MISMATCH',
      );
    }
  }

  const messages = await loadRecentConversationMessages({
    conversationId: input.conversationId,
    limit: 40,
  });
  // The learner's original idea message can age out of the recent window; fall
  // back to the persisted project title so context building stays deterministic
  // instead of failing with a hard NOT_FOUND.
  const ideaMessage = (() => {
    try {
      return resolveAuthoringIdeaMessage(messages);
    } catch {
      const fallback = input.project.title?.trim();
      if (fallback) {
        return fallback;
      }
      throw new AppError('Project idea message not found.', 404, 'NOT_FOUND');
    }
  })();
  const conversationWindow = buildBoundedConversationHistory(messages, 24);
  const recentAnswers = conversationWindow.map((entry) =>
    entry.role === 'user' ? `USER: ${entry.text}` : `ASSISTANT: ${entry.text}`,
  );

  const storedLocale = input.sessionRecord ? readSessionContentLocale(input.sessionRecord) : null;
  const contentLocale = resolveAuthoringContentLocale({
    ideaText: ideaMessage,
    userComment: input.userComment,
    acceptedProjectText: buildAcceptedProjectCorpus(input.project, ideaMessage),
    uiLocale: input.uiLocale,
    storedContentLocale: storedLocale,
  });

  const projectTitle = localizeAcceptedFieldForSession({
    contentLocale,
    ideaText: ideaMessage,
    acceptedValue: input.project.title,
    isPlaceholder: isAuthoringDraftPlaceholderTitle(input.project.title),
    maxLength: 120,
  });
  const projectShortDescription = localizeAcceptedFieldForSession({
    contentLocale,
    ideaText: ideaMessage,
    acceptedValue: input.project.shortDescription,
    isPlaceholder: isAuthoringDraftPlaceholderShortDescription(input.project.shortDescription),
    maxLength: 280,
  });
  const projectDescription = localizeAcceptedFieldForSession({
    contentLocale,
    ideaText: ideaMessage,
    acceptedValue: input.project.description ?? '',
    isPlaceholder: isAuthoringDraftPlaceholderDescription(input.project.description ?? ''),
  });

  const clarificationSummaries =
    input.sessionId != null
      ? await buildClarificationAnswerSummaries({
          conversationId: input.conversationId,
          sessionId: input.sessionId,
        })
      : [];

  const confirmedRequirements = input.sessionRecord
    ? readConfirmedRequirements(input.sessionRecord)
    : {};
  const userCommentStepCount =
    input.userComment != null ? parseRequestedStepCount(input.userComment) : null;
  const userCommentComponentCount =
    input.userComment != null ? parseRequestedComponentCount(input.userComment) : null;
  const requestedStepCount =
    userCommentStepCount ?? confirmedRequirements.requestedStepCount ?? null;
  const requestedComponentCount =
    userCommentComponentCount ?? confirmedRequirements.requestedComponentCount ?? null;

  const augmentedRecentAnswers = [...recentAnswers];
  if (requestedStepCount != null) {
    augmentedRecentAnswers.push(`LEARNER_CONFIRMED_STEP_COUNT: ${requestedStepCount}`);
  }
  if (requestedComponentCount != null) {
    augmentedRecentAnswers.push(
      `LEARNER_CONFIRMED_COMPONENT_COUNT: ${requestedComponentCount}`,
    );
  }

  const qualityRequirements = computeStepPlanQualityRequirements({
    locale: contentLocale,
    ideaText: ideaMessage,
    projectTitle,
    projectShortDescription,
    projectDescription,
    difficulty: input.project.difficulty,
    estimatedMinutes: input.project.estimatedDurationMinutes,
    components: projectComponentsAsSequential(input.project),
    recentAnswers: augmentedRecentAnswers,
    requestedStepCount,
  });

  return {
    locale: contentLocale,
    projectId: input.project.id,
    ideaText: ideaMessage,
    projectTitle,
    projectShortDescription,
    projectDescription,
    difficulty: input.project.difficulty,
    estimatedMinutes: input.project.estimatedDurationMinutes,
    components: projectComponentsAsSequential(input.project),
    requestedStepCount,
    requestedComponentCount,
    clarification: {
      type: 'project_authoring_clarification',
      status: 'READY_FOR_PROPOSAL',
      summary: ideaMessage.slice(0, 500),
      knownFacts: clarificationSummaries.map((entry) => ({
        key: entry.questionId,
        label: entry.label,
        value: entry.answer,
        source: 'LEARNER_ANSWER',
      })),
      nextQuestion: null,
      remainingTopics: 0,
      assumptions: [],
      warnings: learnerConstraintHints(input.project),
      policyVersion: 'v1',
    } as StepListContext['clarification'],
    recentAnswers: augmentedRecentAnswers,
    repairAttempt: input.repairAttempt ?? false,
    repairIssue: input.repairIssue ?? null,
    previousInvalidOutput: input.previousInvalidOutput ?? null,
    qualityRequirements,
  };
};

/** @deprecated Use buildStepAuthoringContext for step generation. */
export const buildStepListContext = (
  project: ProjectRecord,
  locale: AiLocale,
): StepListContext => ({
  locale,
  projectId: project.id,
  ideaText: project.title,
  projectTitle: project.title,
  projectShortDescription: project.shortDescription,
  projectDescription: project.description,
  difficulty: project.difficulty,
  estimatedMinutes: project.estimatedDurationMinutes,
  components: projectComponentsAsSequential(project),
  clarification: {
    type: 'project_authoring_clarification',
    status: 'READY_FOR_PROPOSAL',
    summary: project.title,
    knownFacts: [],
    nextQuestion: null,
    remainingTopics: 0,
    assumptions: [],
    warnings: learnerConstraintHints(project),
    policyVersion: 'v1',
  } as StepListContext['clarification'],
  recentAnswers: [],
});

const slugifyStepTitle = (title: string) =>
  title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'step';

export type AuthoringStepPayload = {
  id: string;
  order: number;
  title: string;
  description: string;
  safetyNote?: string | null;
  referencedComponentIds?: string[];
};

export const serializeAuthoringStepPlanPayload = (
  steps: SequentialStep[],
): { payloadSteps: AuthoringStepPayload[]; sequential: SequentialStep[] } => {
  const sequential = reindexWorkingSteps(steps);
  const payloadSteps = sequential.map((step, index) => ({
    id: `step-${index + 1}-${slugifyStepTitle(step.title)}`,
    order: index + 1,
    title: step.title,
    description: step.description,
    safetyNote: null,
    referencedComponentIds: step.componentRefs ?? [],
  }));
  return { payloadSteps, sequential };
};

const exclusionMentionPattern =
  /(?:without|no|avoid|do not|don't|not use|excluding|بدون|لا تستخدم|تجنب|من دون)/i;

const filterExcludedTermConsistencyIssues = (
  issues: string[],
  project: ProjectRecord,
  steps: SequentialStep[],
): string[] => {
  const projectText = learnerConstraintHints(project).join('\n');
  const stepText = steps.map((step) => `${step.title} ${step.description}`).join('\n');
  return issues.filter((issue) => {
    const match = issue.match(/references "([^"]+)"/i);
    if (!match) {
      return true;
    }
    const term = match[1]?.trim() ?? '';
    if (!term || !projectText.toLowerCase().includes(term.toLowerCase())) {
      return true;
    }
    const termPattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (!termPattern.test(stepText)) {
      return false;
    }
    return !exclusionMentionPattern.test(stepText);
  });
};

const filterStepPlanConsistencyIssues = (
  issues: string[],
  project: ProjectRecord,
  steps: SequentialStep[],
  components: SequentialComponent[],
): string[] =>
  filterComponentConsistencyFalsePositives(
    filterExcludedTermConsistencyIssues(issues, project, steps),
    components,
    steps,
  );

type AuthoringConceptGroup = {
  key: string;
  label: string;
  patterns: RegExp[];
};

/**
 * Mutually exclusive primary-mechanism groups. A single authoring project must
 * not mix these (e.g. an LDR night-light must not also be a PIR motion detector).
 */
const AUTHORING_CONCEPT_GROUPS: AuthoringConceptGroup[] = [
  {
    key: 'LIGHT_SENSING',
    label: 'LDR / light sensing',
    patterns: [
      /\bldr\b/i,
      /photoresistor/i,
      /photocell/i,
      /light[-\s]?dependent/i,
      /light\s*sensor/i,
      /مقاومة\s*ضوئية/,
      /حسّ?اس\s*ضوء/,
      /الضوء|الإضاءة|الظلام/,
    ],
  },
  {
    key: 'MOTION_SENSING',
    label: 'PIR / motion sensing',
    patterns: [
      /\bpir\b/i,
      /motion\s*sensor/i,
      /motion[-\s]?activated/i,
      /occupancy/i,
      /person\s*detection|people\s*detection|detects?\s*people/i,
      /حسّ?اس\s*حركة/,
      /كشف\s*الحركة|استشعار\s*الحركة|كشف\s*الأشخاص/,
    ],
  },
  {
    key: 'SOIL_MOISTURE',
    label: 'soil-moisture monitoring',
    patterns: [
      /soil\s*moisture/i,
      /irrigation/i,
      /رطوبة\s*التربة/,
      /ري\b|الري\b/,
    ],
  },
  {
    key: 'FINANCE_SOFTWARE',
    label: 'finance / expense software',
    patterns: [
      /\bfinance\b|financial/i,
      /expense|budget|transaction/i,
      /مالية|مصروف|ميزانية|معاملات/,
    ],
  },
];

const conceptGroupsInText = (text: string): Set<string> => {
  const found = new Set<string>();
  if (!text) {
    return found;
  }
  for (const group of AUTHORING_CONCEPT_GROUPS) {
    if (group.patterns.some((pattern) => pattern.test(text))) {
      found.add(group.key);
    }
  }
  return found;
};

const conceptLabel = (key: string): string =>
  AUTHORING_CONCEPT_GROUPS.find((group) => group.key === key)?.label ?? key;

export type AuthoringConceptConflict = {
  field: string;
  fieldConcept: string;
  briefConcept: string;
};

/**
 * Detects whether any candidate field introduces a primary-mechanism concept
 * that contradicts the authoritative brief. The brief is the union of the anchor
 * fields (idea, title, full description, components). A conflict is only raised
 * when a field asserts an exclusive concept that the brief does not contain and
 * that differs from the brief's own concept(s).
 */
export const detectAuthoringConceptConflicts = (input: {
  briefText: string;
  fields: Array<{ field: string; text: string }>;
}): AuthoringConceptConflict[] => {
  const briefConcepts = conceptGroupsInText(input.briefText);
  if (briefConcepts.size === 0) {
    return [];
  }
  const conflicts: AuthoringConceptConflict[] = [];
  for (const candidate of input.fields) {
    const fieldConcepts = conceptGroupsInText(candidate.text);
    for (const fieldConcept of fieldConcepts) {
      if (briefConcepts.has(fieldConcept)) {
        continue;
      }
      // Field asserts an exclusive concept the brief never mentions.
      const briefConcept = [...briefConcepts][0] ?? 'unknown';
      conflicts.push({
        field: candidate.field,
        fieldConcept,
        briefConcept,
      });
    }
  }
  return conflicts;
};

const summarizeConceptConflicts = (
  conflicts: AuthoringConceptConflict[],
  locale: AiLocale,
): string => {
  const parts = conflicts.map((conflict) =>
    locale === 'ar'
      ? `الحقل «${conflict.field}» يقدّم مفهوم «${conceptLabel(conflict.fieldConcept)}» بينما المشروع عن «${conceptLabel(conflict.briefConcept)}»`
      : `Field "${conflict.field}" introduces "${conceptLabel(conflict.fieldConcept)}" but the project is about "${conceptLabel(conflict.briefConcept)}"`,
  );
  return parts.join('; ');
};

export const validateAuthoringStepPlanForSession = (input: {
  project: ProjectRecord;
  steps: SequentialStep[];
  ideaText?: string;
  contentLocale?: AiLocale;
  requestedStepCount?: number | null;
  qualityRequirements?: StepPlanQualityRequirements;
}):
  | { ok: true; sequential: SequentialStep[] }
  | {
      ok: false;
      code: string;
      issues: string[];
      unknownComponents?: string[];
      requiredMinimum?: number;
      receivedSteps?: number;
      missingPhases?: string[];
    } => {
  const sequential = reindexWorkingSteps(input.steps);
  const ideaText =
    input.ideaText?.trim() ||
    [input.project.title, input.project.shortDescription, input.project.description ?? '']
      .join('\n')
      .trim();
  const contentLocale = input.contentLocale ?? 'en';

  if (sequential.length < 2) {
    return {
      ok: false,
      code: 'AI_AUTHORING_STEP_GENERATION_FAILED',
      issues: ['Step plan must include at least two steps.'],
    };
  }

  if (input.requestedStepCount != null) {
    if (sequential.length !== input.requestedStepCount) {
      return {
        ok: false,
        code: 'AI_AUTHORING_STEP_GENERATION_FAILED',
        issues: [
          `Learner requested exactly ${input.requestedStepCount} steps; received ${sequential.length}.`,
        ],
      };
    }
  }

  const emptyStep = sequential.find(
    (step) => step.title.trim().length === 0 || step.description.trim().length === 0,
  );
  if (emptyStep) {
    return {
      ok: false,
      code: 'AI_AUTHORING_STEP_GENERATION_FAILED',
      issues: ['Every step must have a title and description.'],
    };
  }

  const titles = sequential.map((step) => step.title.trim().toLowerCase());
  if (new Set(titles).size !== titles.length) {
    return {
      ok: false,
      code: 'AI_AUTHORING_STEP_GENERATION_FAILED',
      issues: ['Duplicate step titles are not allowed.'],
    };
  }

  const relevanceIssues = stepPlanLooksIrrelevant({
    ideaText,
    project: input.project,
    steps: sequential,
  });
  if (relevanceIssues.length > 0) {
    return {
      ok: false,
      code: 'AI_STEP_PLAN_IRRELEVANT',
      issues: relevanceIssues,
    };
  }

  const languageIssues = stepPlanLanguageIssues({
    ideaText,
    contentLocale,
    steps: sequential,
  });
  if (languageIssues.length > 0) {
    return {
      ok: false,
      code: 'AI_STEP_PLAN_LANGUAGE_MISMATCH',
      issues: languageIssues,
    };
  }

  const shallowPatterns = [
    /^connect the components\.?$/i,
    /^write the code\.?$/i,
    /^test the project\.?$/i,
    /^build the project\.?$/i,
    /^prepare the materials\.?$/i,
    /^جهّز المواد\.?$/,
    /^نفّذ المشروع\.?$/,
    /^اختبر النتيجة\.?$/,
  ];
  const qualityIssues: string[] = [];
  for (const step of sequential) {
    const description = step.description.trim();
    if (description.length < 48) {
      qualityIssues.push(`Step "${step.title}" needs a more detailed description.`);
    }
    if (shallowPatterns.some((pattern) => pattern.test(description))) {
      qualityIssues.push(`Step "${step.title}" description is too generic.`);
    }
  }
  if (qualityIssues.length > 0) {
    return {
      ok: false,
      code: 'AI_AUTHORING_STEP_GENERATION_FAILED',
      issues: qualityIssues,
    };
  }

  const projectCorpus = [
    ideaText,
    input.project.title,
    input.project.shortDescription,
    input.project.description ?? '',
  ].join('\n');
  const components = projectComponentsAsSequential(input.project);
  const qualityRequirements =
    input.qualityRequirements ??
    computeStepPlanQualityRequirements({
      locale: contentLocale,
      ideaText,
      projectTitle: input.project.title,
      projectShortDescription: input.project.shortDescription,
      projectDescription: input.project.description,
      difficulty: input.project.difficulty ?? 'BEGINNER',
      estimatedMinutes: input.project.estimatedDurationMinutes,
      components,
      requestedStepCount: input.requestedStepCount ?? null,
    });
  const qualityEvaluation = evaluateStepPlanQuality(sequential, qualityRequirements, components);
  if (!qualityEvaluation.ok) {
    return {
      ok: false,
      code: 'AI_AUTHORING_STEP_QUALITY_INVALID',
      issues: qualityEvaluation.issues,
      requiredMinimum: qualityEvaluation.requiredMinimum,
      receivedSteps: qualityEvaluation.receivedSteps,
      missingPhases: qualityEvaluation.missingPhases,
    };
  }

  const resolved = applyResolvedComponentRefsToSteps(sequential, components);
  if (resolved.unknown.length > 0 || resolved.ambiguous.length > 0) {
    const unknownComponents = [...resolved.unknown, ...resolved.ambiguous];
    return {
      ok: false,
      code: 'AI_STEP_COMPONENT_INCONSISTENT',
      issues: [
        ...resolved.unknown.map(
          (ref) => `Step plan references unknown component "${ref}".`,
        ),
        ...resolved.ambiguous.map(
          (ref) => `Step plan references ambiguous component "${ref}".`,
        ),
      ],
      unknownComponents,
    };
  }
  const consistency = validateComponentStepConsistency({
    components,
    steps: resolved.steps,
    constraints: learnerConstraintHints(input.project),
  });
  if (!consistency.ok) {
    const filteredIssues = filterStepPlanConsistencyIssues(
      consistency.issues,
      input.project,
      resolved.steps,
      components,
    );
    if (filteredIssues.length > 0) {
      return { ok: false, code: consistency.code, issues: filteredIssues };
    }
  }

  return { ok: true, sequential: resolved.steps };
};

export type StepsComposerIntent =
  | 'EXPLAIN_CURRENT_PLAN'
  | 'EXPLAIN_SPECIFIC_STEP'
  | 'ANSWER_PROJECT_QUESTION'
  | 'REVISE_FULL_PLAN'
  | 'REVISE_SPECIFIC_STEP'
  | 'ADD_MORE_DETAIL'
  | 'ADD_STEPS'
  | 'SET_STEP_COUNT'
  | 'SET_COMPONENT_COUNT'
  | 'CONTINUE_PREVIOUS_RESPONSE'
  | 'CLARIFY_LEARNER_REQUEST';

export type StepsStageComposerResult =
  | { kind: 'EXPLANATION'; assistantText: string }
  | { kind: 'FOLLOW_UP'; assistantText: string }
  | { kind: 'REVISED_PLAN'; assistantText: string; steps: SequentialStep[] };

const normalizeComposerComment = (comment: string) =>
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

const SHORT_FOLLOW_UP_PATTERN =
  /^(اه|اها|اي|ايوه|ايه|كمل|تمام|طيب|نعم|اوكي|ok|okay|yes|yep|sure|more|اكثر|وضح|وضح اكثر|وضحلي|اشرح اكثر)$/i;

export const isConversationContinuationFollowUp = (comment: string) => {
  const normalized = normalizeComposerComment(comment);
  if (SHORT_FOLLOW_UP_PATTERN.test(normalized)) {
    return true;
  }
  return /^(اه[،,]?\s*)?(كمل|تمام|وضح|وضحلي|وضح اكثر|اشرح اكثر|وبعدين|بعدين|more|continue)(?:\s|$|[،,.])/.test(
    normalized,
  );
};

export type ScalarComposerIntent =
  | 'EXPLAIN_CURRENT_PROPOSAL'
  | 'GENERAL_PROJECT_CHAT'
  | 'CONTINUE_PREVIOUS_RESPONSE'
  | 'REVISE_CURRENT_PROPOSAL'
  | 'CLARIFY_LEARNER_REQUEST';

const scalarStageLabel = (stage: ProjectAuthoringSessionStage, locale: AiLocale) => {
  const labels: Partial<Record<ProjectAuthoringSessionStage, { en: string; ar: string }>> = {
    TITLE: { en: 'project title', ar: 'عنوان المشروع' },
    SHORT_DESCRIPTION: { en: 'short description', ar: 'الوصف المختصر' },
    FULL_DESCRIPTION: { en: 'full description', ar: 'الوصف الكامل' },
    DIFFICULTY: { en: 'difficulty level', ar: 'مستوى الصعوبة' },
    ESTIMATED_DURATION: { en: 'estimated duration', ar: 'المدة المتوقعة' },
  };
  const label = labels[stage];
  return locale === 'ar' ? label?.ar ?? stage : label?.en ?? stage;
};

const readScalarProposalValue = (payload: Record<string, unknown>) => {
  const value = payload.value;
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
};

export const resolveScalarComposerIntent = (input: {
  comment: string;
  history: BoundedHistoryMessage[];
  stage: ProjectAuthoringSessionStage;
}): ScalarComposerIntent => {
  const normalized = normalizeComposerComment(input.comment);
  const lastAssistant = [...input.history].reverse().find((entry) => entry.role === 'assistant');

  if (isConversationContinuationFollowUp(input.comment) && lastAssistant) {
    return 'CONTINUE_PREVIOUS_RESPONSE';
  }

  const hasRevisionSignal =
    /(?:^|\s)(خلي|خليه|خليها|بسط|بسّط|غير|عدل|احذف|ازل|اضف|اذكر|تأكد|اضمن)(?:\s|$)/.test(
      normalized,
    ) ||
    /\b(add|remove|delete|revise|change|update|make it|shorter|longer|simpler|mention)\b/.test(
      normalized,
    );
  if (hasRevisionSignal && !input.comment.includes('؟') && !input.comment.includes('?')) {
    return 'REVISE_CURRENT_PROPOSAL';
  }

  const isQuestion =
    input.comment.includes('؟') ||
    input.comment.includes('?') ||
    /^(ليش|لماذا|ليه|why|how|what|explain)\b/.test(normalized) ||
    normalized.includes('ليش ') ||
    normalized.includes('اشرح') ||
    normalized.includes('وضح') ||
    normalized.includes('معنى') ||
    normalized.includes('ليش اخترت') ||
    normalized.includes('ليش بحتاج') ||
    normalized.includes('ليش المشروع') ||
    normalized.includes('ليش هذا') ||
    normalized.includes('ليش اختر');

  if (isQuestion) {
    return 'EXPLAIN_CURRENT_PROPOSAL';
  }

  if (
    normalized.includes('هل المشروع') ||
    normalized.includes('قبل ما ابدأ') ||
    normalized.includes('مخاطر') ||
    normalized.includes('مناسب ل') ||
    normalized.includes('beginner friendly') ||
    normalized.includes('suitable for') ||
    normalized.includes('what should i learn')
  ) {
    return 'GENERAL_PROJECT_CHAT';
  }

  if (lastAssistant) {
    return 'CONTINUE_PREVIOUS_RESPONSE';
  }

  return 'CLARIFY_LEARNER_REQUEST';
};

export const generateScalarConversationExplanation = async (input: {
  locale: AiLocale;
  comment: string;
  history: BoundedHistoryMessage[];
  stage: ProjectAuthoringSessionStage;
  currentProposal: Record<string, unknown>;
  projectTitle: string;
  projectShortDescription: string;
  projectDescription: string | null;
  ideaText: string;
  intent: ScalarComposerIntent;
}): Promise<string> => {
  const provider = getAiChatProvider();
  if (provider.name === 'disabled') {
    throw new AppError(
      input.locale === 'ar'
        ? 'مساعد الذكاء الاصطناعي غير متاح حاليًا.'
        : 'The AI assistant is currently unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  const currentValue = readScalarProposalValue(input.currentProposal);
  const stageLabel = scalarStageLabel(input.stage, input.locale);
  const contextualMessage = [
    'You are helping a learner discuss an in-progress learning project authoring session.',
    'Answer only from the supplied project context and the current unsaved proposal.',
    'Do not change the proposal, do not save anything, and do not invent unrelated features.',
    input.intent === 'CONTINUE_PREVIOUS_RESPONSE'
      ? 'The learner sent a short follow-up. Continue your previous explanation with more detail and keep the same topic.'
      : null,
    input.intent === 'GENERAL_PROJECT_CHAT'
      ? 'Answer as general project guidance without revising the current field proposal.'
      : null,
    input.locale === 'ar'
      ? 'Respond in Arabic. Keep technical terms such as Arduino, LDR, LED, Breadboard, USB, Threshold, and pin names in English when natural.'
      : null,
    `Project idea: ${input.ideaText}`,
    `Project title: ${input.projectTitle}`,
    `Short description: ${input.projectShortDescription}`,
    input.projectDescription ? `Full description: ${input.projectDescription}` : null,
    `Current ${stageLabel} proposal: ${currentValue}`,
    `Learner message: ${input.comment}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const history =
    input.intent === 'CONTINUE_PREVIOUS_RESPONSE'
      ? input.history
      : input.history.slice(0, Math.max(0, input.history.length - 1));

  const answer = await provider.generateGeneralLearningAnswer({
    locale: input.locale,
    userMessage: contextualMessage,
    history,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
  });

  const assistantText = answer.data.blocks
    .filter((block) => block.type === 'text' && 'text' in block)
    .map((block) => block.text)
    .join('\n\n')
    .trim();

  if (!assistantText) {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر إنشاء شرح مناسب. حاول مرة أخرى.'
        : 'Could not generate a useful explanation. Please try again.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }

  if (
    input.locale === 'ar' &&
    (assistantText.match(/[\u0600-\u06FF]/gu) ?? []).length < 6
  ) {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر إنشاء شرح عربي مناسب. حاول مرة أخرى.'
        : 'Could not generate an Arabic explanation. Please try again.',
      502,
      'AI_AUTHORING_LANGUAGE_MISMATCH',
    );
  }

  return assistantText;
};

const MATERIAL_QUANTITY_PATTERN =
  /(?:قطع|قطعة|حبة|وحدة|pieces?|units?|qty|quantity|كمية)\s*(?:من\s*)?\d|\d\s*(?:قطع|قطعة|حبة|وحدة|pieces?|units?)/i;

export const parseRequestedStepCount = (comment: string): number | null => {
  if (MATERIAL_QUANTITY_PATTERN.test(comment)) {
    return null;
  }
  const normalized = normalizeComposerComment(comment);
  const patterns = [
    /(?:خليهم|خليها|اجعلها|make them|set to|want)\s*(\d{1,2})\s*(?:خطوات|خطوة|steps?)/i,
    /(\d{1,2})\s*(?:خطوات|خطوة)\s*(?:فقط|بس|only)?/i,
    /(\d{1,2})\s*steps?\s*(?:only|total)?/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern) ?? comment.match(pattern);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }
  return null;
};

export const parseRequestedComponentCount = (comment: string): number | null => {
  if (MATERIAL_QUANTITY_PATTERN.test(comment)) {
    return null;
  }
  const normalized = normalizeComposerComment(comment);
  const patterns = [
    /(?:بدي|اريد|أريد|want|need|only)\s*(\d{1,2})\s*(?:مواد|مكونات|مكوّنات|components?|materials?)/i,
    /(\d{1,2})\s*(?:مواد|مكونات|مكوّنات|components?|materials?)\s*(?:فقط|بس|only)?/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern) ?? comment.match(pattern);
    if (match?.[1]) {
      return Number(match[1]);
    }
  }
  return null;
};

export const validateRequestedStepCount = (
  count: number,
  locale: AiLocale,
): { ok: true } | { ok: false; message: string } => {
  if (!Number.isInteger(count) || count < 2 || count > MAX_PROPOSAL_STEPS) {
    return {
      ok: false,
      message:
        locale === 'ar'
          ? `عدد الخطوات يجب أن يكون بين 2 و${MAX_PROPOSAL_STEPS}.`
          : `Step count must be between 2 and ${MAX_PROPOSAL_STEPS}.`,
    };
  }
  return { ok: true };
};

export const validateRequestedComponentCount = (
  count: number,
  locale: AiLocale,
): { ok: true } | { ok: false; message: string } => {
  if (!Number.isInteger(count) || count < MIN_PROPOSAL_COMPONENTS || count > MAX_PROPOSAL_COMPONENTS) {
    return {
      ok: false,
      message:
        locale === 'ar'
          ? `عدد المكوّنات يجب أن يكون بين ${MIN_PROPOSAL_COMPONENTS} و${MAX_PROPOSAL_COMPONENTS}.`
          : `Component count must be between ${MIN_PROPOSAL_COMPONENTS} and ${MAX_PROPOSAL_COMPONENTS}.`,
    };
  }
  return { ok: true };
};

export const persistSessionConfirmedRequirements = async (input: {
  sessionId: string;
  expectedVersion: number;
  sessionRecord: ProjectAuthoringSessionWithTurn;
  patch: Partial<AuthoringConfirmedRequirements>;
}) => {
  const componentWorkingState = mergeConfirmedRequirementsIntoComponentState(
    input.sessionRecord.componentWorkingState,
    input.patch,
  );
  return projectAuthoringSessionRepository.updateSession({
    sessionId: input.sessionId,
    expectedVersion: input.expectedVersion,
    patch: { componentWorkingState: componentWorkingState as Prisma.InputJsonValue },
  });
};

export const loadAuthoringConversationHistory = async (
  conversationId: string,
  limit = 24,
): Promise<BoundedHistoryMessage[]> => {
  const messages = await loadRecentConversationMessages({ conversationId, limit });
  return buildBoundedConversationHistory(messages, limit);
};

export const resolveStepsComposerIntent = (input: {
  comment: string;
  history: BoundedHistoryMessage[];
  stage: 'STEPS_OVERVIEW' | 'STEP_REVIEW';
}): StepsComposerIntent => {
  const normalized = normalizeComposerComment(input.comment);
  const lastAssistant = [...input.history].reverse().find((entry) => entry.role === 'assistant');

  if (isConversationContinuationFollowUp(input.comment) && lastAssistant) {
    return 'CONTINUE_PREVIOUS_RESPONSE';
  }

  const requestedSteps = parseRequestedStepCount(input.comment);
  if (requestedSteps != null) {
    return 'SET_STEP_COUNT';
  }

  const requestedComponents = parseRequestedComponentCount(input.comment);
  if (requestedComponents != null && input.stage !== 'STEP_REVIEW') {
    return 'SET_COMPONENT_COUNT';
  }

  if (
    normalized.includes('زيد الخطوات') ||
    normalized.includes('زيد عدد الخطوات') ||
    normalized.includes('اضف خطوات') ||
    normalized.includes('أضف خطوات') ||
    normalized.includes('add more steps') ||
    normalized.includes('more steps')
  ) {
    return 'ADD_STEPS';
  }

  if (
    normalized.includes('اشرح') ||
    normalized.includes('وضح') ||
    normalized.includes('ليش') ||
    normalized.includes('لماذا') ||
    normalized.includes('ليه') ||
    normalized.includes('كيف') ||
    normalized.includes('شو') ||
    normalized.includes('وين') ||
    normalized.includes('explain') ||
    normalized.includes('why') ||
    normalized.includes('how') ||
    normalized.includes('what') ||
    normalized.includes('where') ||
    input.comment.includes('?') ||
    input.comment.includes('؟')
  ) {
    if (/اول|الاول|first|ثان|second|ثالث|third|\b[1-9]\b/.test(normalized)) {
      return 'EXPLAIN_SPECIFIC_STEP';
    }
    return 'EXPLAIN_CURRENT_PLAN';
  }

  if (
    normalized.includes('زيد') ||
    normalized.includes('اوضح') ||
    normalized.includes('أوضح') ||
    normalized.includes('تفصيل') ||
    normalized.includes('اكثر تفصيل') ||
    normalized.includes('more detail') ||
    normalized.includes('more detailed')
  ) {
    return 'ADD_MORE_DETAIL';
  }

  if (
    normalized.includes('بسط') ||
    normalized.includes('غير') ||
    normalized.includes('عدل') ||
    normalized.includes('احذف') ||
    normalized.includes('ازل') ||
    normalized.includes('revise') ||
    normalized.includes('change') ||
    normalized.includes('update') ||
    (normalized.includes('add') && !normalized.includes('explain'))
  ) {
    return input.stage === 'STEP_REVIEW' ? 'REVISE_SPECIFIC_STEP' : 'REVISE_FULL_PLAN';
  }

  if (
    (normalized.includes('مش فاهم') || normalized.includes('مو واضح') || normalized.includes('unclear')) &&
    !lastAssistant
  ) {
    return 'CLARIFY_LEARNER_REQUEST';
  }

  if (lastAssistant) {
    return 'ANSWER_PROJECT_QUESTION';
  }

  return 'CLARIFY_LEARNER_REQUEST';
};

const ordinalStepIndexFromComposerComment = (comment: string, stepCount: number) => {
  const normalized = normalizeComposerComment(comment);
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

const buildStepsPlanSummary = (steps: SequentialStep[]) =>
  steps
    .map((step, index) => `${index + 1}. ${step.title}\n${step.description}`)
    .join('\n\n');

export const generateStepsConversationExplanation = async (input: {
  locale: AiLocale;
  comment: string;
  history: BoundedHistoryMessage[];
  context: StepListContext;
  currentSteps: SequentialStep[];
  intent: StepsComposerIntent;
  focusStepIndex?: number;
}): Promise<string> => {
  const provider = getAiChatProvider();
  if (provider.name === 'disabled') {
    throw new AppError(
      input.locale === 'ar'
        ? 'مساعد الذكاء الاصطناعي غير متاح حاليًا.'
        : 'The AI assistant is currently unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  const focusStep =
    input.focusStepIndex != null
      ? input.currentSteps[input.focusStepIndex]
      : input.currentSteps[ordinalStepIndexFromComposerComment(input.comment, input.currentSteps.length)] ??
        input.currentSteps[0];

  const contextualMessage = [
    'You are helping a learner discuss an in-progress hardware/education project step plan.',
    'Answer only from the supplied project context and step plan.',
    'Do not change the plan, do not save anything, and do not invent unrelated software features.',
    input.context.locale === 'ar'
      ? 'Respond in Arabic. Keep technical terms such as Arduino, LDR, LED, Breadboard, USB, Analog pin, Digital pin, Voltage Divider, and Threshold in English when natural.'
      : null,
    `Project idea: ${input.context.ideaText}`,
    `Components: ${input.context.components.map((item) => item.componentName).join(', ')}`,
    `Current step plan:\n${buildStepsPlanSummary(input.currentSteps)}`,
    focusStep
      ? `Focus step: ${focusStep.title}\n${focusStep.description}`
      : null,
    input.intent === 'CONTINUE_PREVIOUS_RESPONSE'
      ? 'The learner sent a short follow-up. Continue your previous explanation with more detail.'
      : null,
    `Learner message: ${input.comment}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const history =
    input.intent === 'CONTINUE_PREVIOUS_RESPONSE'
      ? input.history
      : input.history.slice(0, Math.max(0, input.history.length - 1));

  const answer = await provider.generateGeneralLearningAnswer({
    locale: input.context.locale,
    userMessage: contextualMessage,
    history,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
  });

  const assistantText = answer.data.blocks
    .filter((block) => block.type === 'text' && 'text' in block)
    .map((block) => block.text)
    .join('\n\n')
    .trim();

  if (!assistantText) {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر إنشاء شرح مناسب. حاول مرة أخرى.'
        : 'Could not generate a useful explanation. Please try again.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }

  if (
    input.context.locale === 'ar' &&
    (assistantText.match(/[\u0600-\u06FF]/gu) ?? []).length < 6
  ) {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر إنشاء شرح عربي مناسب. حاول مرة أخرى.'
        : 'Could not generate an Arabic explanation. Please try again.',
      502,
      'AI_AUTHORING_LANGUAGE_MISMATCH',
    );
  }

  return assistantText;
};

export const reviseStepsPlanFromComposerFeedback = async (input: {
  context: StepListContext;
  comment: string;
  currentSteps: SequentialStep[];
  intent: StepsComposerIntent;
  project: ProjectRecord;
}): Promise<{ steps: SequentialStep[]; assistantText: string }> => {
  const revisionPrompt =
    input.intent === 'ADD_STEPS' || input.intent === 'ADD_MORE_DETAIL'
      ? `${input.comment}\n\nReturn a more detailed step plan. Add meaningful steps for wiring, calibration, testing, and troubleshooting when appropriate.`
      : input.comment;

  const generated = await generateSequentialStepListWithRepair({
    ...input.context,
    feedback: revisionPrompt,
    previousSteps: input.currentSteps,
  });

  const validated = validateAuthoringStepPlanForSession({
    project: input.project,
    steps: generated.steps,
    ideaText: input.context.ideaText,
    contentLocale: input.context.locale,
    requestedStepCount: input.context.requestedStepCount,
  });
  if (!validated.ok) {
    throw new AppError(validated.issues.join(' '), 502, validated.code);
  }

  const assistantText =
    input.context.locale === 'ar'
      ? 'حدّثت خطة الخطوات بناءً على طلبك. راجع الاقتراح الجديد قبل الحفظ.'
      : 'I updated the step plan based on your request. Review the new proposal before saving.';

  return {
    steps: validated.sequential,
    assistantText: generated.explanation?.trim() || assistantText,
  };
};

export const reviseSingleStepFromComposerFeedback = async (input: {
  context: StepListContext;
  comment: string;
  currentSteps: SequentialStep[];
  targetIndex: number;
  project: ProjectRecord;
  history: BoundedHistoryMessage[];
}): Promise<{ steps: SequentialStep[]; assistantText: string }> => {
  const provider = getAiChatProvider();
  if (provider.name === 'disabled') {
    throw new AppError(
      input.context.locale === 'ar'
        ? 'مساعد الذكاء الاصطناعي غير متاح حاليًا.'
        : 'The AI assistant is currently unavailable.',
      503,
      'AI_DISABLED',
    );
  }

  const targetStep = input.currentSteps[input.targetIndex];
  if (!targetStep) {
    throw new AppError('Target step not found.', 409, 'VALIDATION_ERROR');
  }

  const contextualMessage = [
    'Revise exactly one step in an in-progress project build plan.',
    'Return ONLY valid JSON with keys: title (string), description (string), safetyNote (string or null).',
    'Keep the same project identity. Do not change unrelated steps.',
    input.context.locale === 'ar'
      ? 'Write title and description in Arabic. Keep technical terms such as Arduino, LDR, LED, A0, Breadboard in English when natural.'
      : null,
    `Project idea: ${input.context.ideaText}`,
    `Components: ${input.context.components.map((item) => item.componentName).join(', ')}`,
    `Full plan:\n${buildStepsPlanSummary(input.currentSteps)}`,
    `Step to revise (${input.targetIndex + 1}): ${targetStep.title}\n${targetStep.description}`,
    `Learner revision request: ${input.comment}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const answer = await provider.generateGeneralLearningAnswer({
    locale: input.context.locale,
    userMessage: contextualMessage,
    history: input.history,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
  });

  const rawText = answer.data.blocks
    .filter((block) => block.type === 'text' && 'text' in block)
    .map((block) => block.text)
    .join('\n\n')
    .trim();

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AppError(
      input.context.locale === 'ar'
        ? 'تعذّر تعديل الخطوة. حاول مرة أخرى.'
        : 'Could not revise the step. Please try again.',
      502,
      'AI_AUTHORING_STEP_QUALITY_INVALID',
    );
  }

  let parsed: { title?: string; description?: string; safetyNote?: string | null };
  try {
    parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
  } catch {
    throw new AppError(
      input.context.locale === 'ar'
        ? 'تعذّر تعديل الخطوة. حاول مرة أخرى.'
        : 'Could not revise the step. Please try again.',
      502,
      'AI_AUTHORING_STEP_JSON_INVALID',
    );
  }

  const revisedTitle = parsed.title?.trim();
  const revisedDescription = parsed.description?.trim();
  if (!revisedTitle || !revisedDescription || revisedDescription.length < 8) {
    throw new AppError(
      input.context.locale === 'ar'
        ? 'تعذّر تعديل الخطوة. حاول مرة أخرى.'
        : 'Could not revise the step. Please try again.',
      502,
      'AI_AUTHORING_STEP_QUALITY_INVALID',
    );
  }

  const nextSteps = input.currentSteps.map((step, index) =>
    index === input.targetIndex
      ? {
          ...step,
          title: revisedTitle,
          description: revisedDescription,
        }
      : step,
  );

  const validated = validateAuthoringStepPlanForSession({
    project: input.project,
    steps: nextSteps,
    ideaText: input.context.ideaText,
    contentLocale: input.context.locale,
  });
  if (!validated.ok) {
    throw new AppError(validated.issues.join(' '), 502, validated.code);
  }

  const assistantText =
    input.context.locale === 'ar'
      ? `حدّثت الخطوة ${input.targetIndex + 1} بناءً على طلبك. راجع التعديل قبل المتابعة.`
      : `I updated step ${input.targetIndex + 1} based on your request. Review the change before continuing.`;

  return { steps: validated.sequential, assistantText };
};

export const processStepsStageComposerMessage = async (input: {
  stage: 'STEPS_OVERVIEW' | 'STEP_REVIEW';
  comment: string;
  context: StepListContext;
  currentSteps: SequentialStep[];
  project: ProjectRecord;
  conversationId: string;
  activeStepIndex?: number;
  sessionId?: string;
  expectedVersion?: number;
  sessionRecord?: ProjectAuthoringSessionWithTurn | null;
}): Promise<StepsStageComposerResult> => {
  const history = await loadAuthoringConversationHistory(input.conversationId, 24);
  const intent = resolveStepsComposerIntent({
    comment: input.comment,
    history,
    stage: input.stage,
  });

  if (intent === 'SET_STEP_COUNT') {
    const requested = parseRequestedStepCount(input.comment);
    if (requested == null) {
      return {
        kind: 'FOLLOW_UP',
        assistantText:
          input.context.locale === 'ar'
            ? 'لم أفهم عدد الخطوات المطلوب. اذكر رقمًا واضحًا مثل: خليهم 6 خطوات.'
            : 'I could not tell how many steps you want. Please specify a number, for example: make it 6 steps.',
      };
    }
    const validation = validateRequestedStepCount(requested, input.context.locale);
    if (!validation.ok) {
      return { kind: 'FOLLOW_UP', assistantText: validation.message };
    }
    const revised = await reviseStepsPlanFromComposerFeedback({
      context: { ...input.context, requestedStepCount: requested },
      comment: `${input.comment}\n\nGenerate exactly ${requested} ordered project steps.`,
      currentSteps: input.currentSteps,
      intent: 'REVISE_FULL_PLAN',
      project: input.project,
    });
    return {
      kind: 'REVISED_PLAN',
      assistantText:
        input.context.locale === 'ar'
          ? `حدّثت الخطة إلى ${requested} خطوات كما طلبت. راجع الاقتراح قبل المتابعة.`
          : `I updated the plan to ${requested} steps as requested. Review the proposal before continuing.`,
      steps: revised.steps,
    };
  }

  if (
    intent === 'EXPLAIN_CURRENT_PLAN' ||
    intent === 'EXPLAIN_SPECIFIC_STEP' ||
    intent === 'ANSWER_PROJECT_QUESTION' ||
    intent === 'CONTINUE_PREVIOUS_RESPONSE' ||
    intent === 'CLARIFY_LEARNER_REQUEST'
  ) {
    const assistantText = await generateStepsConversationExplanation({
      locale: input.context.locale,
      comment: input.comment,
      history,
      context: input.context,
      currentSteps: input.currentSteps,
      intent,
      focusStepIndex:
        intent === 'EXPLAIN_SPECIFIC_STEP'
          ? ordinalStepIndexFromComposerComment(input.comment, input.currentSteps.length)
          : input.stage === 'STEP_REVIEW'
            ? input.activeStepIndex
            : undefined,
    });
    return {
      kind: intent === 'CLARIFY_LEARNER_REQUEST' ? 'FOLLOW_UP' : 'EXPLANATION',
      assistantText,
    };
  }

  if (input.stage === 'STEP_REVIEW' && intent === 'REVISE_SPECIFIC_STEP') {
    const targetIndex = input.activeStepIndex ?? 0;
    const revised = await reviseSingleStepFromComposerFeedback({
      context: input.context,
      comment: input.comment,
      currentSteps: input.currentSteps,
      targetIndex,
      project: input.project,
      history,
    });
    return {
      kind: 'REVISED_PLAN',
      assistantText: revised.assistantText,
      steps: revised.steps,
    };
  }

  const revised = await reviseStepsPlanFromComposerFeedback({
    context: input.context,
    comment: input.comment,
    currentSteps: input.currentSteps,
    intent,
    project: input.project,
  });

  return {
    kind: 'REVISED_PLAN',
    assistantText: revised.assistantText,
    steps: revised.steps,
  };
};

const logStepGenerationEvent = (event: string, details: Record<string, unknown>) => {
  console.info(
    JSON.stringify({
      event,
      module: 'project-authoring-session.helpers',
      ...details,
    }),
  );
};

export const canonicalScalarForStage = (
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

export const turnKindForStage = (stage: ProjectAuthoringSessionStage): ProjectAuthoringTurnKind => {
  if (stage === 'COMPONENTS') {
    return 'COMPONENT_LIST';
  }
  if (stage === 'STEPS_OVERVIEW' || stage === 'STEP_REVIEW') {
    return 'STEP_PLAN';
  }
  return 'STAGE_PROPOSAL';
};

export const readCanonicalStageValue = (
  project: ProjectRecord,
  stage: ProjectAuthoringSessionStage,
): string | number => {
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
      return project.estimatedDurationMinutes ?? 120;
    default:
      return project.title;
  }
};

export const patchForStage = (
  stage: ProjectAuthoringSessionStage,
  payload: Record<string, unknown>,
): AuthoringSequentialStagePatch => {
  switch (stage) {
    case 'TITLE':
      return { title: `${payload.value ?? ''}` };
    case 'SHORT_DESCRIPTION':
      return { shortDescription: `${payload.value ?? ''}` };
    case 'FULL_DESCRIPTION':
      return { description: `${payload.value ?? ''}` };
    case 'DIFFICULTY':
      return {
        difficulty: `${payload.value ?? 'BEGINNER'}` as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
      };
    case 'ESTIMATED_DURATION':
      return { estimatedDurationMinutes: Number(payload.value ?? 0) };
    case 'COMPONENTS':
      return {
        requiredComponents: payload.components as AuthoringSequentialStagePatch['requiredComponents'],
      };
    case 'STEPS_OVERVIEW':
    case 'STEP_REVIEW':
      return { steps: payload.steps as AuthoringSequentialStagePatch['steps'] };
    default:
      return {};
  }
};

export const componentsFromPayload = (payload: Record<string, unknown>) => {
  const components = payload.components;
  return Array.isArray(components) ? components : [];
};

export const stepsFromPayload = (payload: Record<string, unknown>) => {
  const steps = payload.steps;
  return Array.isArray(steps) ? steps : [];
};

export const readTrustedComponentList = (
  session: ProjectAuthoringSessionWithTurn,
  turn: { payload: unknown },
) => {
  const working = parseComponentWorkingState(session.componentWorkingState);
  if (working?.workingComponents.length) {
    return working.workingComponents;
  }
  return componentsFromPayload(turn.payload as Record<string, unknown>) as SequentialComponent[];
};

export const readTrustedStepList = (
  session: ProjectAuthoringSessionWithTurn,
  turn: { payload: unknown },
) => {
  const working = parseStepWorkingState(session.stepWorkingState);
  if (working?.workingSteps.length) {
    return working.workingSteps;
  }
  return stepsFromPayload(turn.payload as Record<string, unknown>) as SequentialStep[];
};

export const createStageProposalTurn = async (input: {
  session: ProjectAuthoringSessionWithTurn;
  project: ProjectRecord;
  locale: AiLocale;
  stage: ProjectAuthoringSessionStage;
}) => {
  const context = await buildStepAuthoringContext({
    project: input.project,
    conversationId: input.session.conversationId,
    sessionId: input.session.id,
    uiLocale: input.locale,
    sessionRecord: input.session,
  });
  const locale = context.locale;

  if (input.stage === 'COMPONENTS') {
    // Gate: never invoke the component provider when the accepted scalar fields
    // describe different projects (e.g. LDR title/description but a PIR short
    // description). Return a specific, recoverable context error instead.
    const componentBrief = [
      context.ideaText,
      context.projectTitle,
      context.projectDescription ?? '',
    ].join('\n');
    const componentContextConflicts = detectAuthoringConceptConflicts({
      briefText: componentBrief,
      fields: [
        { field: 'shortDescription', text: context.projectShortDescription ?? '' },
      ],
    });
    if (componentContextConflicts.length > 0) {
      throw new AppError(
        summarizeConceptConflicts(componentContextConflicts, locale),
        409,
        'AI_AUTHORING_CONTEXT_INCONSISTENT',
        { conflicts: componentContextConflicts },
      );
    }
    const generated = await generateSequentialComponentListWithRepair({
      locale,
      projectId: input.project.id,
      ideaText: context.ideaText,
      projectTitle: context.projectTitle,
      projectShortDescription: context.projectShortDescription,
      projectDescription: context.projectDescription,
      difficulty: context.difficulty,
      durationMinutes: context.estimatedMinutes,
      clarification: context.clarification,
      recentAnswers: context.recentAnswers,
    });
    assertSessionLanguageSurface(locale, generated.explanation, 'component list explanation');
    for (const component of generated.components) {
      assertSessionLanguageSurface(
        locale,
        `${component.componentName} ${component.notes ?? ''}`,
        'component item',
      );
    }
    return {
      kind: 'COMPONENT_LIST' as const,
      payload: { components: generated.components },
      explanation: generated.explanation,
    };
  }
  if (input.stage === 'STEPS_OVERVIEW') {
    const context = await buildStepAuthoringContext({
      project: input.project,
      conversationId: input.session.conversationId,
      sessionId: input.session.id,
      uiLocale: input.locale,
      sessionRecord: input.session,
    });
    const generated = await generateSequentialStepListWithRepair(context);
    const validated = validateAuthoringStepPlanForSession({
      project: input.project,
      steps: generated.steps,
      ideaText: context.ideaText,
      contentLocale: context.locale,
      requestedStepCount: context.requestedStepCount,
    });
    if (!validated.ok) {
      throw new AppError(validated.issues.join(' '), 502, validated.code, {
        issues: validated.issues,
      });
    }
    return {
      kind: 'STEP_PLAN' as const,
      payload: { steps: validated.sequential },
      explanation: generated.explanation,
      contentLocale: context.locale,
    };
  }
  const value = readCanonicalStageValue(input.project, input.stage);
  let lastInvalidExplanation: string | null = null;

  const buildScalarStageProposal = async (options: {
    repairAttempt: boolean;
    repairIssue?: string | null;
    previousInvalidOutput?: string | null;
  }) => {
    const discussionReply = await generateSequentialStageDiscussionWithRepair({
      locale,
      stage: input.stage as never,
      comment: '',
      currentProposal: { value },
      explanation: '',
      projectId: input.project.id,
      projectTitle: context.projectTitle,
      projectShortDescription: context.projectShortDescription,
      projectDescription: context.projectDescription,
      projectDifficulty: input.project.difficulty,
      projectEstimatedMinutes: input.project.estimatedDurationMinutes,
      projectConstraints: learnerConstraintHints(input.project),
      clarificationContext: context.clarification.knownFacts.map((fact) => fact.value),
      repairAttempt: options.repairAttempt,
      repairIssue: options.repairIssue ?? null,
      previousInvalidOutput: options.previousInvalidOutput ?? null,
    });

    if (discussionReply.replyType === 'FOLLOW_UP_QUESTION') {
      throw new AppError(
        input.locale === 'ar'
          ? 'تعذر إنشاء اقتراح صالح لهذه المرحلة.'
          : 'Could not produce a valid stage proposal.',
        502,
        'AI_RESPONSE_INVALID',
      );
    }

    const proposedValue = discussionReply.suggestion.value;
    lastInvalidExplanation = discussionReply.assistantText;
    assertScalarStageProposalLanguage(
      locale,
      input.stage,
      proposedValue,
      discussionReply.assistantText,
    );
    const scalarBrief = [
      context.ideaText,
      context.projectTitle,
      context.projectDescription ?? '',
      projectComponentsAsSequential(input.project)
        .map((component) => `${component.componentName} ${component.notes ?? ''}`)
        .join(' '),
    ].join('\n');
    const scalarConflicts = detectAuthoringConceptConflicts({
      briefText: scalarBrief,
      fields: [{ field: input.stage, text: `${proposedValue}` }],
    });
    if (scalarConflicts.length > 0) {
      throw new AppError(
        summarizeConceptConflicts(scalarConflicts, locale),
        502,
        'AI_AUTHORING_SCALAR_CONTEXT_INCONSISTENT',
        { conflicts: scalarConflicts },
      );
    }
    return {
      kind: 'STAGE_PROPOSAL' as const,
      payload: { value: proposedValue },
      explanation: discussionReply.assistantText,
    };
  };

  try {
    return await buildScalarStageProposal({ repairAttempt: false });
  } catch (error) {
    if (
      locale === 'ar' &&
      error instanceof AppError &&
      error.code === 'AI_AUTHORING_LANGUAGE_MISMATCH'
    ) {
      return await buildScalarStageProposal({
        repairAttempt: true,
        repairIssue: `${ARABIC_LANGUAGE_REPAIR_ISSUE} ${error.message}`,
        previousInvalidOutput: lastInvalidExplanation,
      });
    }
    if (
      error instanceof AppError &&
      error.code === 'AI_AUTHORING_SCALAR_CONTEXT_INCONSISTENT'
    ) {
      // One bounded repair: tell the provider exactly which concept contradicted
      // the authoritative brief and require the same project identity.
      const repairInstruction =
        locale === 'ar'
          ? `يجب أن يبقى الاقتراح لنفس المشروع دون تغيير آليته الأساسية. تناقض سابق: ${error.message}. لا تُدخل جهازًا أو حسّاسًا مختلفًا.`
          : `The proposal must stay on the same project without changing its primary mechanism. Previous contradiction: ${error.message}. Do not introduce a different device or sensor.`;
      return await buildScalarStageProposal({
        repairAttempt: true,
        repairIssue: repairInstruction,
        previousInvalidOutput: lastInvalidExplanation,
      });
    }
    throw error;
  }
};

export const tryGenerateStepPlan = async (input: {
  session: ProjectAuthoringSessionWithTurn;
  project: ProjectRecord;
  locale: AiLocale;
  expectedVersion?: number;
}) => {
  const resolved = await resolveAndPersistAuthoringContentLocale({
    conversationId: input.session.conversationId,
    project: input.project,
    uiLocale: input.locale,
    sessionRecord: input.session,
  });
  const contentLocale = resolved.locale;
  const sessionRecord = resolved.session;
  const expectedVersion = sessionRecord.version;
  if (sessionRecord.learningProjectId !== input.project.id) {
    throw new AppError(
      contentLocale === 'ar'
        ? 'جلسة التأليف لا تطابق هذا المشروع.'
        : 'This authoring session does not match the current project.',
      409,
      'AI_AUTHORING_WORKSPACE_MISMATCH',
    );
  }

  const briefText = [
    input.project.title,
    input.project.description ?? '',
    projectComponentsAsSequential(input.project)
      .map((component) => `${component.componentName} ${component.notes ?? ''}`)
      .join(' '),
  ].join('\n');
  const contextConflicts = detectAuthoringConceptConflicts({
    briefText,
    fields: [{ field: 'shortDescription', text: input.project.shortDescription ?? '' }],
  });
  if (contextConflicts.length > 0) {
    const detail = summarizeConceptConflicts(contextConflicts, contentLocale);
    logStepGenerationEvent('step_generation_context_inconsistent', {
      sessionId: sessionRecord.id,
      learningProjectId: input.project.id,
      conversationId: sessionRecord.conversationId,
      version: expectedVersion,
      conflicts: contextConflicts,
    });
    await projectAuthoringSessionRepository.updateSession({
      sessionId: sessionRecord.id,
      expectedVersion,
      patch: {
        stage: 'STEPS_OVERVIEW',
        status: 'GENERATION_FAILED',
        generationErrorCode: 'AI_AUTHORING_CONTEXT_INCONSISTENT',
        currentTurnId: null,
      },
    });
    throw new AppError(
      contentLocale === 'ar'
        ? `تعذّر إنشاء الخطوات لأن حقول المشروع متناقضة: ${detail}. صحّح المرحلة المتعارضة ثم أعد المحاولة.`
        : `Step generation was blocked because the project fields contradict each other: ${detail}. Correct the conflicting stage and retry.`,
      409,
      'AI_AUTHORING_CONTEXT_INCONSISTENT',
      { conflicts: contextConflicts },
    );
  }

  let capturedStepQualityRequirements: StepPlanQualityRequirements | undefined;

  const generateValidatedPlan = async (
    repairAttempt: boolean,
    repairIssue?: string | null,
    previousInvalidOutput?: string | null,
  ) => {
    const context = await buildStepAuthoringContext({
      project: input.project,
      conversationId: sessionRecord.conversationId,
      sessionId: sessionRecord.id,
      uiLocale: contentLocale,
      repairAttempt,
      repairIssue,
      previousInvalidOutput,
      sessionRecord,
    });
    capturedStepQualityRequirements = context.qualityRequirements;
    logStepGenerationEvent('step_generation_started', {
      sessionId: sessionRecord.id,
      learningProjectId: input.project.id,
      conversationId: sessionRecord.conversationId,
      stage: sessionRecord.stage,
      version: expectedVersion,
      provider: resolveAiChatProvider(),
      componentCount: context.components.length,
      contentLocale: context.locale,
      repairAttempt,
      requestedStepCount: context.requestedStepCount,
    });
    // One provider attempt per call. Bounded repair is handled by the outer
    // try/catch below so Retry = 1 request + at most 1 repair, with the exact
    // first-response issues and raw invalid output fed into the repair prompt.
    const generated = await generateSequentialStepList(context);
    const validated = validateAuthoringStepPlanForSession({
      project: input.project,
      steps: generated.steps,
      ideaText: context.ideaText,
      contentLocale: context.locale,
      requestedStepCount: context.requestedStepCount,
      qualityRequirements: context.qualityRequirements,
    });
    if (!validated.ok) {
      throw new AppError(
        validated.issues.join(' '),
        validated.code === 'AI_STEP_COMPONENT_INCONSISTENT' ||
          validated.code === 'AI_AUTHORING_STEP_QUALITY_INVALID'
          ? 409
          : 502,
        validated.code,
        {
          issues: validated.issues,
          ...(validated.unknownComponents
            ? { unknownComponents: validated.unknownComponents }
            : {}),
          ...(validated.requiredMinimum != null
            ? { requiredMinimum: validated.requiredMinimum }
            : {}),
          ...(validated.receivedSteps != null ? { receivedSteps: validated.receivedSteps } : {}),
          ...(validated.missingPhases ? { missingPhases: validated.missingPhases } : {}),
        },
      );
    }
    return {
      steps: validated.sequential,
      explanation: generated.explanation,
      contentLocale: context.locale,
    };
  };

  try {
    let repairAttempted = false;
    let plan: Awaited<ReturnType<typeof generateValidatedPlan>>;
    try {
      plan = await generateValidatedPlan(false);
    } catch (firstError) {
      repairAttempted = true;
      const previousInvalidOutput =
        firstError instanceof AppError &&
        firstError.details &&
        typeof firstError.details === 'object' &&
        typeof (firstError.details as { previousInvalidOutput?: unknown })
          .previousInvalidOutput === 'string'
          ? (firstError.details as { previousInvalidOutput: string }).previousInvalidOutput
          : null;
      const unknownComponents =
        firstError instanceof AppError &&
        firstError.details &&
        typeof firstError.details === 'object' &&
        Array.isArray((firstError.details as { unknownComponents?: unknown }).unknownComponents)
          ? (firstError.details as { unknownComponents: string[] }).unknownComponents
          : [];
      const qualityDetails =
        firstError instanceof AppError &&
        firstError.details &&
        typeof firstError.details === 'object'
          ? (firstError.details as {
              issues?: string[];
              requiredMinimum?: number;
              receivedSteps?: number;
              missingPhases?: string[];
            })
          : {};
      const issueParts = [
        firstError instanceof AppError &&
        firstError.code === 'AI_AUTHORING_STEP_QUALITY_INVALID' &&
        capturedStepQualityRequirements
          ? buildStepQualityRepairIssue({
              requirements: capturedStepQualityRequirements,
              receivedSteps: qualityDetails.receivedSteps ?? 0,
              issues: qualityDetails.issues ?? [firstError.message],
              missingPhases: qualityDetails.missingPhases ?? [],
            })
          : firstError instanceof AppError
            ? firstError.message
            : 'Step plan was invalid.',
        contentLocale === 'ar' ? ARABIC_LANGUAGE_REPAIR_ISSUE : null,
        unknownComponents.length > 0
          ? `Unknown componentRefs: ${JSON.stringify(unknownComponents)}`
          : null,
        firstError instanceof AppError &&
        Array.isArray((firstError.details as { issues?: unknown })?.issues) &&
        firstError.code !== 'AI_AUTHORING_STEP_QUALITY_INVALID'
          ? `Issues: ${JSON.stringify((firstError.details as { issues: unknown }).issues).slice(0, 1500)}`
          : null,
      ].filter(Boolean);
      logStepGenerationEvent('step_generation_provider_failed', {
        sessionId: sessionRecord.id,
        learningProjectId: input.project.id,
        conversationId: sessionRecord.conversationId,
        version: expectedVersion,
        provider: resolveAiChatProvider(),
        errorCode: firstError instanceof AppError ? firstError.code : 'UNKNOWN',
        errorMessage: firstError instanceof Error ? firstError.message : String(firstError),
        repairAttempted: true,
        hasPreviousInvalidOutput: Boolean(previousInvalidOutput),
      });
      plan = await generateValidatedPlan(true, issueParts.join(' '), previousInvalidOutput);
    }

    const { payloadSteps, sequential } = serializeAuthoringStepPlanPayload(plan.steps);
    const turnId = randomUUID();
    const stepState = initStepWorkingState(sequential, 'FULL_PLAN', turnId);
    const planTurn = buildStepPlanTurn({
      steps: sequential,
      locale: plan.contentLocale,
    });

    const session = await projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: sessionRecord.id,
      expectedVersion,
      turn: {
        id: turnId,
        sessionId: sessionRecord.id,
        stage: 'STEPS_OVERVIEW',
        kind: planTurn.kind,
        status: 'PROPOSED',
        payload: { steps: payloadSteps },
        explanation: planTurn.explanation ?? plan.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        stage: 'STEPS_OVERVIEW',
        status: 'WAITING_FOR_USER',
        generationErrorCode: null,
        baseProjectUpdatedAt: input.project.updatedAt,
        stepReviewMode: 'FULL_PLAN',
        stepWorkingState: stepState,
      },
    });

    logStepGenerationEvent('step_generation_completed', {
      sessionId: sessionRecord.id,
      learningProjectId: input.project.id,
      conversationId: sessionRecord.conversationId,
      version: session.version,
      source: 'provider',
      repairAttempted,
      stepCount: payloadSteps.length,
      currentTurnId: turnId,
    });

    return session;
  } catch (error) {
    const preservedStepCodes = new Set([
      'AI_STEP_COMPONENT_INCONSISTENT',
      'AI_STEP_PLAN_IRRELEVANT',
      'AI_STEP_PLAN_LANGUAGE_MISMATCH',
      'AI_AUTHORING_CONTEXT_INCONSISTENT',
      'AI_AUTHORING_STEP_JSON_INVALID',
      'AI_AUTHORING_STEP_SCHEMA_INVALID',
      'AI_AUTHORING_STEP_QUALITY_INVALID',
      'AI_AUTHORING_STEP_GENERATION_TIMEOUT',
      'AI_DISABLED',
    ]);
    const errorCode =
      error instanceof AppError
        ? preservedStepCodes.has(error.code)
          ? error.code
          : error.code === 'AI_PROVIDER_TIMEOUT'
            ? 'AI_AUTHORING_STEP_GENERATION_TIMEOUT'
            : error.code === 'AI_RESPONSE_INVALID'
              ? 'AI_AUTHORING_STEP_JSON_INVALID'
              : 'AI_AUTHORING_STEP_GENERATION_FAILED'
        : 'AI_AUTHORING_STEP_GENERATION_FAILED';

    logStepGenerationEvent('step_generation_failed', {
      sessionId: sessionRecord.id,
      learningProjectId: input.project.id,
      conversationId: sessionRecord.conversationId,
      version: expectedVersion,
      errorCode,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    await projectAuthoringSessionRepository.updateSession({
      sessionId: sessionRecord.id,
      expectedVersion,
      patch: {
        stage: 'STEPS_OVERVIEW',
        status: 'GENERATION_FAILED',
        generationErrorCode: errorCode,
        currentTurnId: null,
      },
    });
    if (error instanceof AppError) {
      if (error.code === errorCode) {
        throw error;
      }
      throw new AppError(error.message, error.statusCode, errorCode, error.details);
    }
    throw new AppError(
      contentLocale === 'ar'
        ? 'تعذّر إنشاء خطة الخطوات من المكوّنات الحالية.'
        : 'The step plan could not be generated from the current components.',
      502,
      'AI_AUTHORING_STEP_GENERATION_FAILED',
      { cause: error },
    );
  }
};

export const assertProposalPayloadDistinctFromUserMessage = (input: {
  payload: Record<string, unknown>;
  comment: string;
  locale: AiLocale;
}) => {
  const trimmed = input.comment.trim();
  if (!trimmed) {
    return;
  }
  const value = input.payload.value;
  if (value == null) {
    return;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    return;
  }
  if (areScalarsMateriallyIdentical(value, trimmed)) {
    throw new AppError(
      input.locale === 'ar'
        ? 'لا يمكن حفظ ملاحظتك كنص الاقتراح.'
        : 'Learner feedback cannot be saved as the proposal value.',
      502,
      'AI_PROVIDER_RESPONSE_INVALID',
    );
  }
  if (typeof value === 'string' && trimmed.length >= 16 && value.includes(trimmed)) {
    throw new AppError(
      input.locale === 'ar'
        ? 'لا يمكن تضمين ملاحظتك داخل قيمة الاقتراح.'
        : 'Learner feedback cannot be embedded in the proposal value.',
      502,
      'AI_PROVIDER_RESPONSE_INVALID',
    );
  }
};

const overviewAnsweredQuestionKeys = async (sessionId: string) => {
  const turns = await projectAuthoringSessionRepository.listTurnsForSession(sessionId);
  return turns
    .filter(
      (turn) =>
        turn.stage === 'OVERVIEW' &&
        turn.kind === 'FOLLOW_UP_QUESTION' &&
        turn.status !== 'PROPOSED',
    )
    .map((turn) => {
      const payload = turn.payload as { questionId?: string; questionKey?: string };
      return payload.questionId?.trim() ?? payload.questionKey?.trim() ?? '';
    })
    .filter(Boolean);
};

export const CLARIFICATION_OTHER_OPTION_ID = 'other';

export type StructuredClarificationOption = {
  id: string;
  label: string;
  value: string;
};

const assertUniqueClarificationOptions = (
  options: StructuredClarificationOption[],
  locale: AiLocale,
) => {
  const seenIds = new Set<string>();
  const seenValues = new Set<string>();
  for (const option of options) {
    if (seenIds.has(option.id)) {
      throw new AppError(
        locale === 'ar'
          ? 'تعذّر إنشاء خيارات توضيح صالحة.'
          : 'Clarification options contained duplicate ids.',
        502,
        'AI_RESPONSE_INVALID',
        { field: 'duplicate_option_id', optionId: option.id },
      );
    }
    seenIds.add(option.id);
    if (seenValues.has(option.value)) {
      throw new AppError(
        locale === 'ar'
          ? 'تعذّر إنشاء خيارات توضيح صالحة.'
          : 'Clarification options contained duplicate values.',
        502,
        'AI_RESPONSE_INVALID',
        { field: 'duplicate_option_value', optionValue: option.value },
      );
    }
    seenValues.add(option.value);
  }
};

export type StructuredClarificationTurnPayload = {
  questionId: string;
  question: string;
  options: StructuredClarificationOption[];
  allowMultiple: boolean;
  allowOther: boolean;
  otherLabel: string;
  helperText: string | null;
  questionNumber: number;
  maxQuestions: number;
  clarificationSummary: Array<{ questionId: string; label: string; answer: string }>;
};

const buildClarificationAnswerSummaries = async (input: {
  conversationId: string;
  sessionId: string;
}) => {
  const turns = await projectAuthoringSessionRepository.listTurnsForSession(input.sessionId);
  const answeredTurns = turns.filter(
    (turn) =>
      turn.stage === 'OVERVIEW' &&
      turn.kind === 'FOLLOW_UP_QUESTION' &&
      turn.status !== 'PROPOSED',
  );
  const messages = await loadRecentConversationMessages({
    conversationId: input.conversationId,
    limit: 40,
  });
  const userAnswers = messages
    .filter((message) => message.role === 'USER')
    .map((message) => message.contentText?.trim() ?? '')
    .filter(Boolean)
    .slice(1);

  return answeredTurns
    .map((turn, index) => {
      const payload = turn.payload as Record<string, unknown>;
      const questionId = `${payload.questionId ?? payload.questionKey ?? ''}`.trim();
      const label = `${payload.question ?? ''}`.trim();
      const answer = userAnswers[index] ?? '';
      if (!questionId || !answer) {
        return null;
      }
      return { questionId, label, answer };
    })
    .filter((entry): entry is { questionId: string; label: string; answer: string } => entry != null);
};

export const buildStructuredClarificationTurnPayload = async (input: {
  block: AiProjectAuthoringClarificationBlock;
  locale: AiLocale;
  sessionId: string;
  conversationId: string;
  answeredQuestionCount: number;
}): Promise<StructuredClarificationTurnPayload> => {
  const nextQuestion = input.block.nextQuestion;
  if (!nextQuestion) {
    throw new AppError('Clarification question is missing.', 500, 'AI_RESPONSE_INVALID');
  }

  const questionId = `${nextQuestion.key ?? ''}`.trim();
  if (!questionId) {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر إنشاء سؤال توضيح صالح.'
        : 'Clarification question id is missing.',
      502,
      'AI_RESPONSE_INVALID',
      { field: 'missing_question_id' },
    );
  }

  const allowMultiple = nextQuestion.answerType === 'MULTI_CHOICE';
  const options: StructuredClarificationOption[] = nextQuestion.options
    .map((label, index) => {
      const trimmedLabel = `${label ?? ''}`.trim();
      const id = `${questionId}-${index + 1}`;
      if (!trimmedLabel) {
        return null;
      }
      return {
        id,
        label: trimmedLabel,
        value: id,
      };
    })
    .filter((entry): entry is StructuredClarificationOption => entry != null);

  if (options.length === 0 && nextQuestion.answerType !== 'FREE_TEXT') {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر إنشاء خيارات توضيح صالحة.'
        : 'Clarification options are missing.',
      502,
      'AI_RESPONSE_INVALID',
      { field: 'missing_options' },
    );
  }

  if (options.length > 0) {
    assertUniqueClarificationOptions(options, input.locale);
  }

  const clarificationSummary = await buildClarificationAnswerSummaries({
    conversationId: input.conversationId,
    sessionId: input.sessionId,
  });

  return {
    questionId,
    question: nextQuestion.prompt,
    options,
    allowMultiple,
    allowOther: true,
    otherLabel: input.locale === 'ar' ? 'إجابة أخرى' : 'Other',
    helperText: null,
    questionNumber: input.answeredQuestionCount + 1,
    maxQuestions: MAX_AUTHORING_CLARIFICATION_QUESTIONS,
    clarificationSummary,
  };
};

const readStructuredClarificationPayload = (
  payload: Record<string, unknown>,
): StructuredClarificationTurnPayload => {
  const options = Array.isArray(payload.options)
    ? payload.options
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const option = entry as Record<string, unknown>;
          const id = typeof option.id === 'string' ? option.id.trim() : '';
          const label = typeof option.label === 'string' ? option.label.trim() : '';
          const value = typeof option.value === 'string' ? option.value.trim() : label;
          if (!id || !label) {
            return null;
          }
          return { id, label, value };
        })
        .filter((entry): entry is StructuredClarificationOption => entry != null)
    : [];

  const summary = Array.isArray(payload.clarificationSummary)
    ? payload.clarificationSummary
        .map((entry) => {
          if (!entry || typeof entry !== 'object') {
            return null;
          }
          const item = entry as Record<string, unknown>;
          const questionId = typeof item.questionId === 'string' ? item.questionId.trim() : '';
          const label = typeof item.label === 'string' ? item.label.trim() : '';
          const answer = typeof item.answer === 'string' ? item.answer.trim() : '';
          if (!questionId || !answer) {
            return null;
          }
          return { questionId, label, answer };
        })
        .filter(
          (entry): entry is { questionId: string; label: string; answer: string } => entry != null,
        )
    : [];

  return {
    questionId: `${payload.questionId ?? payload.questionKey ?? ''}`.trim(),
    question: `${payload.question ?? ''}`.trim(),
    options,
    allowMultiple: payload.allowMultiple === true,
    allowOther: payload.allowOther !== false,
    otherLabel:
      typeof payload.otherLabel === 'string' && payload.otherLabel.trim().length > 0
        ? payload.otherLabel.trim()
        : 'Other',
    helperText: typeof payload.helperText === 'string' ? payload.helperText : null,
    questionNumber: typeof payload.questionNumber === 'number' ? payload.questionNumber : 1,
    maxQuestions:
      typeof payload.maxQuestions === 'number'
        ? payload.maxQuestions
        : MAX_AUTHORING_CLARIFICATION_QUESTIONS,
    clarificationSummary: summary,
  };
};

export const resolveStructuredClarificationAnswer = (input: {
  turnPayload: Record<string, unknown>;
  questionId: string;
  selectedOptionIds: string[];
  otherText?: string | null;
  locale: AiLocale;
}) => {
  const structured = readStructuredClarificationPayload(input.turnPayload);
  if (structured.questionId !== input.questionId.trim()) {
    throw new AppError(
      input.locale === 'ar'
        ? 'سؤال التوضيح لم يعد نشطًا.'
        : 'The clarification question is no longer active.',
      409,
      'AI_AUTHORING_INVALID_ACTION',
    );
  }

  const selectedIds = Array.from(
    new Set(input.selectedOptionIds.map((value) => value.trim()).filter(Boolean)),
  );
  if (selectedIds.length === 0) {
    throw new AppError(
      input.locale === 'ar' ? 'اختر إجابة قبل المتابعة.' : 'Select an answer before continuing.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const hasOther = selectedIds.includes(CLARIFICATION_OTHER_OPTION_ID);
  const nonOtherIds = selectedIds.filter((id) => id !== CLARIFICATION_OTHER_OPTION_ID);

  if (hasOther && nonOtherIds.length > 0) {
    throw new AppError(
      input.locale === 'ar'
        ? 'لا يمكن اختيار "إجابة أخرى" مع خيارات أخرى.'
        : 'Other cannot be combined with preset options.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (hasOther) {
    const otherText = input.otherText?.trim() ?? '';
    if (otherText.length < 2) {
      throw new AppError(
        input.locale === 'ar'
          ? 'أدخل إجابتك في حقل "إجابة أخرى".'
          : 'Enter your answer in the Other field.',
        400,
        'VALIDATION_ERROR',
      );
    }
    return otherText;
  }

  if (!structured.allowMultiple && nonOtherIds.length > 1) {
    throw new AppError(
      input.locale === 'ar' ? 'اختر إجابة واحدة فقط.' : 'Select only one answer.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const selectedOptions = structured.options.filter((option) => nonOtherIds.includes(option.id));
  if (selectedOptions.length !== nonOtherIds.length) {
    throw new AppError(
      input.locale === 'ar' ? 'الخيار المحدد غير صالح.' : 'The selected option is invalid.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (selectedOptions.length === 0 && structured.options.length > 0) {
    throw new AppError(
      input.locale === 'ar' ? 'اختر أحد الخيارات المتاحة.' : 'Select one of the available options.',
      400,
      'VALIDATION_ERROR',
    );
  }

  return selectedOptions.map((option) => option.label).join(', ');
};

const buildFollowUpQuestionPayload = async (input: {
  block: AiProjectAuthoringClarificationBlock;
  locale: AiLocale;
  sessionId: string;
  conversationId: string;
  answeredQuestionCount: number;
}) => {
  const structured = await buildStructuredClarificationTurnPayload(input);
  return {
    ...structured,
    questionKey: structured.questionId,
    clarification: input.block,
  };
};

export const hasOverviewClarificationCompleted = async (sessionId: string) => {
  const turns = await projectAuthoringSessionRepository.listTurnsForSession(sessionId);
  return turns.some((turn) => {
    if (turn.stage !== 'OVERVIEW') {
      return false;
    }
    if (turn.kind === 'EXPLANATION') {
      const payload = turn.payload as {
        clarification?: { status?: string };
      };
      return payload.clarification?.status === 'READY_FOR_PROPOSAL';
    }
    return false;
  });
};

export const buildOverviewClarificationContext = async (input: {
  conversationId: string;
  project: ProjectRecord;
  locale: AiLocale;
  sessionId: string;
  sessionRecord?: ProjectAuthoringSessionWithTurn | null;
  currentAnswer?: string | null;
}) => {
  const messages = await loadRecentConversationMessages({
    conversationId: input.conversationId,
    limit: 40,
  });
  const ideaMessage = resolveAuthoringIdeaMessage(messages);
  const sessionRecord =
    input.sessionRecord ??
    (await projectAuthoringSessionRepository.findById(input.sessionId));
  const storedLocale = sessionRecord ? readSessionContentLocale(sessionRecord) : null;
  const contentLocale = resolveAuthoringContentLocale({
    ideaText: ideaMessage,
    userComment: input.currentAnswer ?? null,
    acceptedProjectText: buildAcceptedProjectCorpus(input.project, ideaMessage),
    uiLocale: input.locale,
    storedContentLocale: storedLocale,
  });

  const answeredQuestionKeys = await overviewAnsweredQuestionKeys(input.sessionId);
  const conversationWindow = buildBoundedConversationHistory(messages, 24);
  const recentAuthoringAnswers = conversationWindow
    .map((entry) =>
      entry.role === 'user' ? `USER: ${entry.text}` : `ASSISTANT: ${entry.text}`,
    )
    .slice(-(MAX_AUTHORING_CLARIFICATION_QUESTIONS * 2));

  return {
    locale: contentLocale,
    ideaText: ideaMessage,
    projectTitle: isAuthoringDraftPlaceholderTitle(input.project.title)
      ? null
      : input.project.title,
    projectShortDescription: isAuthoringDraftPlaceholderShortDescription(
      input.project.shortDescription,
    )
      ? null
      : input.project.shortDescription,
    projectDescription: isAuthoringDraftPlaceholderDescription(input.project.description)
      ? null
      : input.project.description,
    categoryName: input.project.category?.nameEn ?? null,
    difficulty: input.project.difficulty,
    componentNames: input.project.requiredComponents.map(
      (component) => component.componentName,
    ),
    stepTitles: input.project.steps.map((step) => step.title),
    answeredQuestionKeys,
    answeredQuestionCount: answeredQuestionKeys.length,
    currentAnswer: input.currentAnswer ?? null,
    latestClarification: null,
    recentAuthoringAnswers,
    repairAttempt: false,
    repairIssue: null,
    previousInvalidOutput: null,
  };
};

const buildOverviewTopicContext = (context: AuthoringClarificationContext) => ({
  ideaText: context.ideaText,
  projectTitle: context.projectTitle,
  projectShortDescription: context.projectShortDescription,
  projectDescription: context.projectDescription,
  categoryName: context.categoryName,
  difficulty: context.difficulty,
  answeredQuestionKeys: context.answeredQuestionKeys,
  answeredQuestionCount: context.answeredQuestionCount,
});

const throwInvalidOverviewClarification = (locale: AiLocale) => {
  throw new AppError(
    locale === 'ar'
      ? 'تعذّر على المساعد إنشاء سؤال توضيحي صالح. أعد المحاولة.'
      : 'The learning assistant returned an invalid response.',
    502,
    'AI_RESPONSE_INVALID',
  );
};

const generateOverviewClarificationWithRepair = async (
  context: AuthoringClarificationContext,
) => {
  const topicContext = buildOverviewTopicContext(context);
  const topicState = computeAuthoringTopicState(topicContext);
  const remainingQuestionBudget = Math.max(
    0,
    MAX_AUTHORING_CLARIFICATION_QUESTIONS - context.answeredQuestionCount,
  );
  const readiness =
    context.answeredQuestionCount === 0
      ? { ready: false, reasons: ['initial_clarification_required'] }
      : evaluateAuthoringReadiness(topicContext, topicState);

  if (readiness.ready) {
    const clarification = buildDeterministicReadyClarification({
      locale: context.locale,
      topicState,
      latest: context.latestClarification,
      reasons: readiness.reasons,
    });
    return {
      provider: 'server-readiness',
      model: null,
      data: {
        assistantText:
          context.locale === 'ar'
            ? 'أصبحت فكرة مشروعك جاهزة. ابدأ التأليف الموجّه عندما تكون مستعدًا.'
            : 'Your project idea is ready. Start guided authoring when you are ready.',
        clarification,
      },
      usage: { inputTokens: null, outputTokens: null },
      latencyMs: 0,
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
    requestContext: AuthoringClarificationContext,
    attempt: number,
  ) => {
    const providerResult = await generateAuthoringClarification(requestContext);
    return parseProviderResult(providerResult, attempt);
  };

  const isRepairableProviderFailure = (error: unknown) => {
    if (error instanceof AppError) {
      return (
        error.code === 'AI_RESPONSE_INVALID' ||
        error.code === 'AI_AUTHORING_LANGUAGE_MISMATCH'
      );
    }
    return true;
  };

  const providerSchemaRepairIssue = (error: AppError): string | null => {
    const details = error.details;
    if (!details || typeof details !== 'object') {
      return null;
    }
    return formatAuthoringProviderSchemaRepairIssue(
      (details as { providerSchemaIssues?: unknown }).providerSchemaIssues,
    );
  };

  let providerResult!: Awaited<ReturnType<typeof generateAuthoringClarification>>;
  let clarification!: AiProjectAuthoringClarificationBlock;
  let usedRepair = false;

  const runClarificationAttempt = async (
    requestContext: AuthoringClarificationContext,
    attempt: number,
  ) => {
    const parsed = await requestClarification(requestContext, attempt);
    assertClarificationSessionLanguage(
      requestContext.locale,
      parsed.clarification,
      parsed.assistantText,
    );
    return parsed;
  };

  try {
    ({ providerResult, clarification } = await runClarificationAttempt(context, 1));
  } catch (error) {
    if (error instanceof AppError && !isRepairableProviderFailure(error)) {
      throw error;
    }
    usedRepair = true;
    const repairIssue =
      error instanceof AppError && error.code === 'AI_AUTHORING_LANGUAGE_MISMATCH'
        ? `${ARABIC_LANGUAGE_REPAIR_ISSUE} ${error.message}`
        : error instanceof AppError
          ? providerSchemaRepairIssue(error) ?? error.message
          : 'Provider output failed JSON or schema validation. Return strict JSON with clarification and assistantText. FREE_TEXT must use options: []. SINGLE_CHOICE needs 2-4 unique options.';
    try {
      ({ providerResult, clarification } = await runClarificationAttempt(
        {
          ...context,
          repairAttempt: true,
          repairIssue,
          previousInvalidOutput: null,
        },
        2,
      ));
    } catch (repairError) {
      if (repairError instanceof AppError) {
        throw repairError;
      }
      throwInvalidOverviewClarification(context.locale);
    }
  }

  let validation = validateAuthoringClarificationPolicy({
    clarification,
    answeredQuestionKeys: context.answeredQuestionKeys,
    previousPrompts: [],
    topicState,
    remainingQuestionBudget,
    normalizeQuestionPrompt,
  });

  if (!validation.ok && !usedRepair) {
    usedRepair = true;
    try {
      ({ providerResult, clarification } = await requestClarification(
        {
          ...context,
          repairAttempt: true,
          repairIssue: buildAuthoringRepairIssue({
            policy: validation,
            unresolvedTopics: topicState.unresolvedTopics,
            remainingQuestionBudget,
          }),
          previousInvalidOutput: JSON.stringify({
            clarification,
            assistantText: providerResult.data.assistantText,
          }).slice(0, 1500),
        },
        2,
      ));
      validation = validateAuthoringClarificationPolicy({
        clarification,
        answeredQuestionKeys: context.answeredQuestionKeys,
        previousPrompts: [],
        topicState,
        remainingQuestionBudget,
        normalizeQuestionPrompt,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throwInvalidOverviewClarification(context.locale);
    }
  }

  if (!validation.ok) {
    if (
      ['satisfied_topic', 'irrelevant_topic', 'repeated_key', 'repeated_prompt'].includes(
        validation.reason,
      )
    ) {
      clarification = buildDeterministicReadyClarification({
        locale: context.locale,
        topicState,
        latest: clarification,
        reasons: ['policy_conflict_ready_fallback'],
      });
    } else {
      throwInvalidOverviewClarification(context.locale);
    }
  }

  return providerResult;
};

export const ensureOverviewClarificationTurn = async (input: {
  session: ProjectAuthoringSessionWithTurn;
  project: ProjectRecord;
  conversationId: string;
  locale: AiLocale;
  currentAnswer?: string | null;
}) => {
  if (await hasOverviewClarificationCompleted(input.session.id)) {
    return input.session;
  }

  const clarificationContext = await buildOverviewClarificationContext({
    conversationId: input.conversationId,
    project: input.project,
    locale: input.locale,
    sessionId: input.session.id,
    sessionRecord: input.session,
    currentAnswer: input.currentAnswer ?? null,
  });
  const clarification = await generateOverviewClarificationWithRepair(
    clarificationContext,
  );
  const block = clarification.data.clarification;

  if (block.status === 'READY_FOR_PROPOSAL' || !block.nextQuestion) {
    if (await hasOverviewClarificationCompleted(input.session.id)) {
      if (input.session.currentTurnId) {
        return projectAuthoringSessionRepository.updateSession({
          sessionId: input.session.id,
          expectedVersion: input.session.version,
          patch: {
            currentTurnId: null,
            status: 'WAITING_FOR_USER',
          },
        });
      }
      return input.session;
    }

    return projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: input.session.id,
      expectedVersion: input.session.version,
      turn: {
        id: randomUUID(),
        sessionId: input.session.id,
        stage: 'OVERVIEW',
        kind: 'EXPLANATION',
        status: 'PROPOSED',
        payload: {
          clarification: block,
          clarificationSummary: await buildClarificationAnswerSummaries({
            conversationId: input.conversationId,
            sessionId: input.session.id,
          }),
        },
        explanation: clarification.data.assistantText,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        status: 'WAITING_FOR_USER',
        baseProjectUpdatedAt: input.project.updatedAt,
      },
    });
  }

  return projectAuthoringSessionRepository.setCurrentTurn({
    sessionId: input.session.id,
    expectedVersion: input.session.version,
    turn: {
      id: randomUUID(),
      sessionId: input.session.id,
      stage: 'OVERVIEW',
      kind: 'FOLLOW_UP_QUESTION',
      status: 'PROPOSED',
      payload: await buildFollowUpQuestionPayload({
        block,
        locale: input.locale,
        sessionId: input.session.id,
        conversationId: input.conversationId,
        answeredQuestionCount: clarificationContext.answeredQuestionCount,
      }),
      explanation: clarification.data.assistantText,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      status: 'WAITING_FOR_USER',
      baseProjectUpdatedAt: input.project.updatedAt,
    },
  });
};

export const processOverviewClarificationAnswer = async (input: {
  session: ProjectAuthoringSessionWithTurn;
  project: ProjectRecord;
  conversationId: string;
  locale: AiLocale;
  answer: string;
  expectedVersion: number;
  userMessageId: string;
}) => {
  const currentTurnId = input.session.currentTurnId;
  const currentTurn = input.session.currentTurn;
  if (!currentTurnId || !currentTurn || currentTurn.kind !== 'FOLLOW_UP_QUESTION') {
    throw new AppError(
      input.locale === 'ar'
        ? 'لا يوجد سؤال توضيحي نشط.'
        : 'There is no active clarification question.',
      409,
      'AI_AUTHORING_INVALID_ACTION',
    );
  }

  const clarificationContext = await buildOverviewClarificationContext({
    conversationId: input.conversationId,
    project: input.project,
    locale: input.locale,
    sessionId: input.session.id,
    sessionRecord: input.session,
    currentAnswer: input.answer,
  });
  const clarification = await generateOverviewClarificationWithRepair(clarificationContext);
  const block = clarification.data.clarification;

  if (block.status === 'READY_FOR_PROPOSAL' || !block.nextQuestion) {
    return projectAuthoringSessionRepository.supersedeCurrentTurn({
      sessionId: input.session.id,
      expectedVersion: input.expectedVersion,
      supersededTurnId: currentTurnId,
      newTurn: {
        id: randomUUID(),
        sessionId: input.session.id,
        parentTurnId: currentTurnId,
        triggerUserMessageId: input.userMessageId,
        stage: 'OVERVIEW',
        kind: 'EXPLANATION',
        status: 'PROPOSED',
        payload: {
          clarification: block,
          clarificationSummary: await buildClarificationAnswerSummaries({
            conversationId: input.conversationId,
            sessionId: input.session.id,
          }),
        },
        explanation: clarification.data.assistantText,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        status: 'WAITING_FOR_USER',
        baseProjectUpdatedAt: input.project.updatedAt,
      },
    });
  }

  return projectAuthoringSessionRepository.supersedeCurrentTurn({
    sessionId: input.session.id,
    expectedVersion: input.expectedVersion,
    supersededTurnId: currentTurnId,
    newTurn: {
      id: randomUUID(),
      sessionId: input.session.id,
      parentTurnId: currentTurnId,
      triggerUserMessageId: input.userMessageId,
      stage: 'OVERVIEW',
      kind: 'FOLLOW_UP_QUESTION',
      status: 'PROPOSED',
      payload: await buildFollowUpQuestionPayload({
        block,
        locale: input.locale,
        sessionId: input.session.id,
        conversationId: input.conversationId,
        answeredQuestionCount: clarificationContext.answeredQuestionCount + 1,
      }),
      explanation: clarification.data.assistantText,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      status: 'WAITING_FOR_USER',
      baseProjectUpdatedAt: input.project.updatedAt,
    },
  });
};

export const advanceOverviewToTitleProposal = async (input: {
  session: ProjectAuthoringSessionWithTurn;
  project: ProjectRecord;
  locale: AiLocale;
}) => {
  const resolved = await resolveAndPersistAuthoringContentLocale({
    conversationId: input.session.conversationId,
    project: input.project,
    uiLocale: input.locale,
    sessionRecord: input.session,
  });
  const proposal = await createStageProposalTurn({
    session: resolved.session,
    project: input.project,
    locale: resolved.locale,
    stage: 'TITLE',
  });
  return projectAuthoringSessionRepository.setCurrentTurn({
    sessionId: resolved.session.id,
    expectedVersion: resolved.session.version,
    turn: {
      id: randomUUID(),
      sessionId: resolved.session.id,
      stage: 'TITLE',
      kind: proposal.kind,
      status: 'PROPOSED',
      payload: proposal.payload,
      explanation: proposal.explanation,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      stage: 'TITLE',
      status: 'WAITING_FOR_USER',
      baseProjectUpdatedAt: input.project.updatedAt,
    },
  });
};

export const buildComponentItemTurn = (input: {
  componentState: ComponentWorkingState;
  locale: AiLocale;
}) => {
  const { workingComponents, currentIndex } = input.componentState;
  const component = workingComponents[currentIndex] ?? workingComponents[0]!;
  return {
    kind: 'COMPONENT_ITEM' as const,
    payload: {
      index: currentIndex,
      total: workingComponents.length,
      component,
    },
    explanation:
      input.locale === 'ar'
        ? `المكوّن ${currentIndex + 1} من ${workingComponents.length}: ${component.componentName}`
        : `Component ${currentIndex + 1} of ${workingComponents.length}: ${component.componentName}`,
  };
};

export const buildComponentListTurn = (input: {
  components: SequentialComponent[];
  locale: AiLocale;
  awaitingFinalSave?: boolean;
}) => ({
  kind: 'COMPONENT_LIST' as const,
  payload: { components: input.components },
  explanation:
    input.awaitingFinalSave
      ? input.locale === 'ar'
        ? 'راجعت جميع المكوّنات. اعتمد القائمة لحفظها في المسودة.'
        : 'You reviewed every component. Accept the list to save it to your draft.'
      : input.locale === 'ar'
        ? `قائمة من ${input.components.length} مكوّنات.`
        : `A list of ${input.components.length} components.`,
});

export const buildStepItemTurn = (input: {
  stepState: StepWorkingState;
  locale: AiLocale;
}) => {
  const { workingSteps, currentIndex } = input.stepState;
  const step = workingSteps[currentIndex] ?? workingSteps[0]!;
  return {
    kind: 'STEP_ITEM' as const,
    payload: {
      index: currentIndex,
      total: workingSteps.length,
      title: step.title,
      description: step.description,
    },
    explanation:
      input.locale === 'ar'
        ? `الخطوة ${currentIndex + 1} من ${workingSteps.length}: ${step.title}`
        : `Step ${currentIndex + 1} of ${workingSteps.length}: ${step.title}`,
  };
};

export const buildStepPlanTurn = (input: {
  steps: SequentialStep[];
  locale: AiLocale;
  awaitingFinalSave?: boolean;
}) => {
  const { payloadSteps } = serializeAuthoringStepPlanPayload(input.steps);
  return {
    kind: 'STEP_PLAN' as const,
    payload: { steps: payloadSteps },
    explanation:
      input.awaitingFinalSave
        ? input.locale === 'ar'
          ? 'راجعت جميع الخطوات. اعتمد الخطة لحفظها في المسودة.'
          : 'You reviewed every step. Accept the plan to save it to your draft.'
        : input.locale === 'ar'
          ? `خطة من ${payloadSteps.length} خطوات جاهزة للمراجعة.`
          : `A ${payloadSteps.length}-step plan ready for review.`,
  };
};

export const projectComponentsAsSequential = (project: ProjectRecord): SequentialComponent[] =>
  project.requiredComponents.map((component) => ({
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
  }));

export const projectStepsAsSequential = (project: ProjectRecord): SequentialStep[] =>
  project.steps.map((step) => ({
    title: step.title,
    description: step.description,
  }));

export const initComponentWorkingState = (
  components: SequentialComponent[],
  mode: ComponentWorkingState['mode'],
  sourceTurnId: string | null,
) => emptyComponentWorkingState(components, mode, sourceTurnId);

export const initStepWorkingState = (
  steps: SequentialStep[],
  mode: StepWorkingState['mode'],
  sourceTurnId: string | null,
) => emptyStepWorkingState(steps, mode, sourceTurnId);

export const assertProposalNotStale = (input: {
  turn: { baseProjectUpdatedAt: Date };
  project: ProjectRecord;
  locale: AiLocale;
  stage?: ProjectAuthoringSessionStage;
}) => {
  if (input.turn.baseProjectUpdatedAt.toISOString() !== input.project.updatedAt.toISOString()) {
    throw new AppError(
      input.locale === 'ar'
        ? input.stage === 'COMPONENTS'
          ? 'تغيّرت المسودة بعد اقتراح المكوّنات هذا.'
          : 'تغيّرت المسودة بعد هذا الاقتراح.'
        : input.stage === 'COMPONENTS'
          ? 'The draft changed after this component suggestion.'
          : 'The draft changed after this suggestion.',
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }
};

export const advanceSessionAfterStageWrite = async (input: {
  userId: string;
  session: ProjectAuthoringSessionWithTurn;
  project: ProjectRecord;
  locale: AiLocale;
  completedStage: ProjectAuthoringSessionStage;
  expectedVersion: number;
  clearComponentState?: boolean;
  clearStepState?: boolean;
}) => {
  const refreshedProject =
    await learningProjectsRepository.findMyLearningProjectSubmissionById(
      input.project.id,
      input.userId,
    );
  if (!refreshedProject) {
    throw new AppError('Project not found after accept.', 404, 'LEARNING_PROJECT_NOT_FOUND');
  }

  const completedStages = input.session.completedStages.includes(input.completedStage)
    ? input.session.completedStages
    : [...input.session.completedStages, input.completedStage];
  const nextStage = nextStageAfter(input.completedStage);
  const preservedContentLocale = readSessionContentLocale(input.session);

  const resolved = await resolveAndPersistAuthoringContentLocale({
    conversationId: input.session.conversationId,
    project: refreshedProject,
    uiLocale: input.locale,
    sessionRecord: input.session,
  });
  const contentLocale = resolved.locale;

  let session = await projectAuthoringSessionRepository.acceptCurrentTurn({
    sessionId: resolved.session.id,
    expectedVersion: resolved.session.version,
    turnId: resolved.session.currentTurnId!,
    sessionPatch: {
      stage: nextStage,
      status: nextStage === 'COMPONENTS' ? 'WAITING_FOR_USER' : 'WAITING_FOR_ASSISTANT',
      currentTurnId: null,
      completedStages,
      baseProjectUpdatedAt: refreshedProject.updatedAt,
      generationErrorCode: null,
      componentReviewMode: input.clearComponentState ? null : input.session.componentReviewMode,
      ...(input.clearComponentState
        ? {
            componentWorkingState: preservedContentLocale
              ? { contentLocale: preservedContentLocale }
              : undefined,
          }
        : {}),
      stepReviewMode: input.clearStepState ? null : input.session.stepReviewMode,
      ...(input.clearStepState ? { stepWorkingState: undefined } : {}),
    },
  });

  if (input.completedStage === 'COMPONENTS') {
    session = await tryGenerateStepPlan({
      session,
      project: refreshedProject,
      locale: contentLocale,
    });
  } else if (nextStage !== 'FINAL_REVIEW' && nextStage !== 'COMPLETE') {
    // The accepted proposal is already durable at this point.  Keep the
    // external provider call outside a database transaction, then either
    // attach the fully validated next turn or retain an explicit retryable
    // generation-failed state.  A failed call must never leave an old turn
    // whose baseProjectUpdatedAt is now stale after its patch was persisted.
    try {
      const nextProposal = await createStageProposalTurn({
        session,
        project: refreshedProject,
        locale: contentLocale,
        stage: nextStage,
      });
      session = await projectAuthoringSessionRepository.setCurrentTurn({
        sessionId: session.id,
        expectedVersion: session.version,
        turn: {
          id: randomUUID(),
          sessionId: session.id,
          stage: nextStage,
          kind: turnKindForStage(nextStage),
          status: 'PROPOSED',
          payload: nextProposal.payload,
          explanation: nextProposal.explanation,
          baseProjectUpdatedAt: refreshedProject.updatedAt,
        },
        sessionPatch: {
          status: 'WAITING_FOR_USER',
          baseProjectUpdatedAt: refreshedProject.updatedAt,
        },
      });
    } catch (error) {
      await projectAuthoringSessionRepository.updateSession({
        sessionId: session.id,
        expectedVersion: session.version,
        patch: {
          stage: nextStage,
          status: 'GENERATION_FAILED',
          currentTurnId: null,
          generationErrorCode:
            error instanceof AppError
              ? error.code
              : 'AI_AUTHORING_STAGE_GENERATION_FAILED',
          baseProjectUpdatedAt: refreshedProject.updatedAt,
        },
      });
      throw error;
    }
  } else if (nextStage === 'FINAL_REVIEW') {
    session = await projectAuthoringSessionRepository.updateSession({
      sessionId: session.id,
      expectedVersion: session.version,
      patch: {
        stage: 'FINAL_REVIEW',
        status: 'WAITING_FOR_USER',
        currentTurnId: null,
      },
    });
  }

  return { session, project: refreshedProject };
};

export const writeStagePatch = async (input: {
  userId: string;
  project: ProjectRecord;
  session: ProjectAuthoringSessionWithTurn;
  patch: AuthoringSequentialStagePatch;
}) => {
  await applyAuthoringStageToMyDraft({
    userId: input.userId,
    projectId: input.project.id,
    expectedUpdatedAt: input.session.baseProjectUpdatedAt.toISOString(),
    patch: input.patch,
  });
};
