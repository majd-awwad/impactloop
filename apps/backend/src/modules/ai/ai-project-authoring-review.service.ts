import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { env, isAiChatProviderOperational, resolveAiChatProvider } from '../../config/env.js';
import type {
  AiConversation,
  AiMessage,
  AiPendingActionType,
} from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import { logger } from '../../observability/logger.js';

import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';

import { parseStoredContentBlocks } from './ai-context-builder.js';
import {
  customizeActionConfirmationLabels,
  prepareAiPendingAction,
} from './ai-action.service.js';
import type { VersionedActionPayload } from './ai-action.payloads.js';
import {
  type AiContentBlock,
  aiProjectAuthoringClarificationBlockSchema,
  aiProjectAuthoringProposalBlockSchema,
  aiProjectAuthoringReviewStateBlockSchema,
  aiProjectAuthoringDiscussionContextBlockSchema,
  type AiProjectAuthoringClarificationBlock,
  type AiProjectAuthoringProposalBlock,
  type AiProjectAuthoringReviewStateBlock,
  AUTHORING_REVIEW_DECISIONS,
  AUTHORING_REVIEW_FIELD_TARGETS,
} from './ai.content-blocks.js';
import {
  PROJECT_AUTHORING_PROPOSAL_POLICY_VERSION,
} from './ai-project-authoring.service.js';
import {
  buildAuthoringProposalRepairIssue,
  normalizeAuthoringProposalProviderPayload,
  parseAuthoringProposalProviderPayload,
  stampAuthoringProposalBlock,
  validateAuthoringProposalQuality,
} from './ai-project-authoring-proposal.policy.js';
import {
  generateRealAuthoringProposal,
  PROJECT_AUTHORING_PROPOSAL_SYSTEM_POLICY,
  type AuthoringProposalProviderResult,
} from './ai-project-authoring-proposal.provider.js';
import {
  applyReviewDecision,
  applyDiscussionComment,
  assertLockedProposalValues,
  buildMergedDraftInput,
  carryForwardReviewAfterRevision,
  defaultReviewState,
  deriveProposalDiff,
  isDiscussionDecision,
  type AuthoringReviewTarget,
  type DraftProjectSnapshot,
  reviewStateFingerprint,
  validateFinalMergedProject,
} from './ai-project-authoring-review.policy.js';
import {
  acquireConversationProcessingLock,
  createAssistantMessage,
  createUserMessage,
  findOwnedConversation,
  loadRecentConversationMessages,
  releaseConversationProcessingLock,
  touchConversationActivity,
} from './ai.repository.js';
import type { AiLocale, AiTurnResponse } from './ai.types.js';

export type AuthoringRevisionContext = {
  locale: AiLocale;
  ideaText: string;
  categoryName: string;
  currentProposal: AiProjectAuthoringProposalBlock;
  draft: DraftProjectSnapshot;
  review: AiProjectAuthoringReviewStateBlock;
  clarificationSummary: string;
  recentAuthoringAnswers: string[];
  repairAttempt: boolean;
  repairIssue?: string | null;
  previousInvalidOutput?: string | null;
};

type RevisionGenerator = (
  input: AuthoringRevisionContext,
) => AuthoringProposalProviderResult | Promise<AuthoringProposalProviderResult>;

let revisionGeneratorOverride: RevisionGenerator | null = null;

export const setAuthoringRevisionGeneratorForTests = (
  generator: RevisionGenerator | null,
) => {
  revisionGeneratorOverride = generator;
};

const buildLockedFinalValues = (input: AuthoringRevisionContext) => {
  const locked: Record<string, unknown> = {};
  for (const target of input.review.lockedTargets) {
    if (target === 'components') {
      locked.components =
        input.review.componentDecision === 'KEEP_CURRENT'
          ? input.draft.requiredComponents.map((component) => component.componentName)
          : input.currentProposal.requiredComponents.map(
              (component) => component.componentName,
            );
      continue;
    }
    if (target === 'steps') {
      locked.steps =
        input.review.stepDecision === 'KEEP_CURRENT'
          ? input.draft.steps.map((step) => step.title)
          : input.currentProposal.steps.map((step) => step.title);
      continue;
    }
    if (target === 'estimatedMinutes') {
      locked.estimatedMinutes =
        input.review.fieldDecisions.estimatedMinutes === 'KEEP_CURRENT'
          ? input.draft.estimatedDurationMinutes
          : input.currentProposal.project.estimatedMinutes;
      continue;
    }
    const decision = input.review.fieldDecisions[target];
    locked[target] =
      decision === 'KEEP_CURRENT'
        ? input.draft[target]
        : input.currentProposal.project[target];
  }
  return locked;
};

export const buildAuthoringRevisionPrompt = (input: AuthoringRevisionContext) => {
  const openRequests = input.review.revisionRequests.filter(
    (entry) => entry.status === 'OPEN',
  );
  const payload = {
    locale: input.locale,
    revision: {
      parentProposalId: input.currentProposal.proposalId,
      openRevisionRequests: openRequests,
      lockedFinalValues: buildLockedFinalValues(input),
      changeOnlyUnlockedTargets: true,
    },
    currentProposal: input.currentProposal,
    draftSnapshot: input.draft,
    clarificationSummary: input.clarificationSummary,
    recentAuthoringAnswers: input.recentAuthoringAnswers,
    repairAttempt: input.repairAttempt,
    repairIssue: input.repairIssue ?? null,
    previousInvalidOutput: input.previousInvalidOutput ?? null,
  };

  if (input.repairAttempt && input.repairIssue) {
    return JSON.stringify({ repair: { issue: input.repairIssue }, context: payload });
  }

  return JSON.stringify(payload);
};

export const generateAuthoringProposalRevision = async (
  input: AuthoringRevisionContext,
): Promise<AuthoringProposalProviderResult> => {
  if (revisionGeneratorOverride) {
    return revisionGeneratorOverride(input);
  }

  const resolved = resolveAiChatProvider();
  if (resolved === 'mock' || resolved === 'disabled') {
    const revised = structuredClone(input.currentProposal);
    for (const request of input.review.revisionRequests.filter(
      (entry) => entry.status === 'OPEN',
    )) {
      if (request.target === 'components') {
        revised.requiredComponents = revised.requiredComponents.filter(
          (component) => !/pump|relay/i.test(component.componentName),
        );
        if (
          !revised.requiredComponents.some((component) =>
            /led/i.test(component.componentName),
          )
        ) {
          revised.requiredComponents.push({
            componentName: 'LED indicator',
            materialType: 'LED',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            isRequired: true,
            canBeSubstituted: true,
            searchKeywords: ['LED'],
            alternativeKeywords: [],
          });
        }
      }
      if (request.target === 'steps') {
        revised.steps = revised.steps
          .filter((step) => !/pump|water/i.test(`${step.title} ${step.description}`))
          .concat({
            title: 'Test the LED alert',
            description:
              'Upload the sketch and verify the LED turns on when soil moisture is low.',
          });
      }
    }

    return {
      provider: 'mock',
      model: 'mock-revision',
      data: {
        assistantText:
          input.locale === 'ar'
            ? 'تم تحديث الاقتراح وفق طلبات المراجعة مع الحفاظ على القرارات المقفلة.'
            : 'The proposal was updated for your revision requests while preserving locked decisions.',
        project: revised.project,
        requiredComponents: revised.requiredComponents,
        steps: revised.steps,
        assumptions: revised.assumptions,
        warnings: revised.warnings,
        safetyConsiderations: revised.safetyConsiderations,
      },
      usage: { inputTokens: 1, outputTokens: 1 },
      latencyMs: 1,
    };
  }

  const userPrompt = buildAuthoringRevisionPrompt(input);
  const revisionPolicy = [
    PROJECT_AUTHORING_PROPOSAL_SYSTEM_POLICY,
    'This is a revision request. Return a complete replacement proposal JSON.',
    'Change only targets with OPEN revision requests or UNREVIEWED sections.',
    'Preserve locked targets exactly as provided in lockedFinalValues.',
    'Do not mutate locked title, difficulty, components, or steps when locked.',
  ].join('\n');

  const result = await generateRealAuthoringProposal({
    locale: input.locale,
    ideaText: input.ideaText,
    projectTitle: input.draft.title,
    projectShortDescription: input.draft.shortDescription,
    projectDescription: input.draft.description,
    categoryName: input.categoryName,
    draftDifficulty: input.draft.difficulty,
    componentNames: input.draft.requiredComponents.map(
      (component) => component.componentName,
    ),
    stepTitles: input.draft.steps.map((step) => step.title),
    baseUpdatedAt: input.currentProposal.baseUpdatedAt,
    clarification: {
      type: 'project_authoring_clarification' as const,
      summary: input.clarificationSummary,
      knownFacts: [],
      assumptions: [],
      warnings: [],
      status: 'READY_FOR_PROPOSAL' as const,
      nextQuestion: null,
      remainingTopics: 0,
    },
    clarificationMessageId: input.currentProposal.clarificationMessageId,
    recentAuthoringAnswers: input.recentAuthoringAnswers,
    repairAttempt: input.repairAttempt,
    repairIssue: `${revisionPolicy}\n\n${userPrompt}`,
    previousInvalidOutput: input.previousInvalidOutput,
  });

  return result;
};

export const parseRevisionProviderPayload = (input: {
  raw: unknown;
  provider: string;
  attempt: number;
}) => parseAuthoringProposalProviderPayload(input);

export const buildRevisionRepairIssue = (issues: string[]) =>
  buildAuthoringProposalRepairIssue({
    schemaError: issues.join('; '),
  });

export const ensureRevisionProviderConfigured = () => {
  const resolved = resolveAiChatProvider();
  if (resolved === 'disabled') {
    throw new AppError(
      'The AI assistant is currently unavailable.',
      503,
      'AI_DISABLED',
    );
  }
};

import {
  acquireConversationProcessingLock,
  createAssistantMessage,
  findOwnedConversation,
  loadRecentConversationMessages,
  releaseConversationProcessingLock,
  touchConversationActivity,
} from './ai.repository.js';
import type { AiLocale, AiTurnResponse } from './ai.types.js';

export const PROJECT_AUTHORING_REVIEW_POLICY_VERSION = 'project-authoring-v2c';

type AuthoringReviewDecision = (typeof AUTHORING_REVIEW_DECISIONS)[number];

export type SubmitProjectAuthoringProposalReviewBody = {
  target: AuthoringReviewTarget;
  decision: Exclude<AuthoringReviewDecision, 'UNREVIEWED'>;
  comment?: string | null;
};

export type ReviseProjectAuthoringProposalBody = {
  reviewStateId: string;
};

export type SubmitProjectAuthoringDiscussionBody = {
  reviewStateId: string;
  target: AuthoringReviewTarget;
  comment: string;
  clientMessageId: string;
};

const finalProjectStepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

const finalProjectComponentSchema = z.object({
  componentName: z.string().trim().min(1).max(200),
  materialType: z.string().trim().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().trim().min(1).max(50),
  componentRole: z.string().trim().min(1).max(80),
  isRequired: z.boolean(),
  canBeSubstituted: z.boolean(),
  searchKeywords: z.array(z.string().trim().min(1).max(80)),
  notes: z.string().nullable(),
});

export const applyProjectAuthoringProposalPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  actionType: z.literal('APPLY_PROJECT_AUTHORING_PROPOSAL'),
  target: z.object({
    projectId: z.string().trim().min(8).max(64),
  }),
  parameters: z.object({
    conversationId: z.string().trim().min(8).max(64),
    proposalId: z.string().trim().min(1).max(80),
    reviewStateId: z.string().trim().min(1).max(80),
    expectedUpdatedAt: z.string().datetime(),
    acceptedSections: z.array(z.string().trim().min(1).max(80)),
    keptCurrentSections: z.array(z.string().trim().min(1).max(80)),
    finalProject: z.object({
      title: z.string().trim().min(3).max(200),
      shortDescription: z.string().trim().min(10).max(500),
      description: z.string().trim().min(10).max(10000),
      difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
      estimatedDurationMinutes: z.number().int().positive().max(10000).optional(),
      requiredComponents: z.array(finalProjectComponentSchema),
      steps: z.array(finalProjectStepSchema).min(3).max(20),
    }),
  }),
  displaySnapshot: z.object({
    title: z.string().trim().min(1).max(500),
    summary: z.string().trim().max(5000).optional(),
    priceLabel: z.string().trim().max(500).optional(),
    locationLabel: z.string().trim().max(500).optional(),
    quantityLabel: z.string().trim().max(500).optional(),
  }),
});

type ApplyProjectAuthoringProposalPayload = z.infer<
  typeof applyProjectAuthoringProposalPayloadSchema
>;

const STALE_PROPOSAL_COPY: Record<AiLocale, string> = {
  en: 'Project changed after this proposal. Your manual changes will not be overwritten.',
  ar: 'تغيّر المشروع بعد هذا الاقتراح. لن يتم استبدال تعديلاتك اليدوية.',
};

const PROPOSAL_NOT_FOUND_COPY: Record<AiLocale, string> = {
  en: 'Authoring proposal not found for this conversation.',
  ar: 'تعذر العثور على اقتراح التأليف لهذه المحادثة.',
};

const REVIEW_NOT_FOUND_COPY: Record<AiLocale, string> = {
  en: 'Authoring review state not found.',
  ar: 'تعذر العثور على حالة مراجعة التأليف.',
};

const REVIEW_NOT_READY_COPY: Record<AiLocale, string> = {
  en: 'Complete review for all fields and sections before applying.',
  ar: 'أكمل مراجعة جميع الحقول والأقسام قبل التطبيق.',
};

const REVISION_NOT_READY_COPY: Record<AiLocale, string> = {
  en: 'Mark at least one section as needing revision before generating a new proposal.',
  ar: 'حدّد قسمًا واحدًا على الأقل كبحاجة إلى مراجعة قبل إنشاء اقتراح جديد.',
};

const INVALID_REVISION_COPY: Record<AiLocale, string> = {
  en: 'The authoring assistant could not produce a valid revised proposal. Please try again.',
  ar: 'تعذر على مساعد التأليف إنشاء اقتراح مُراجع صالح. حاول مرة أخرى.',
};

const FINAL_INVALID_COPY: Record<AiLocale, string> = {
  en: 'The reviewed project combination is not valid. Adjust your decisions or request another revision.',
  ar: 'مزيج المشروع بعد المراجعة غير صالح. عدّل قراراتك أو اطلب مراجعة أخرى.',
};

const REVIEW_SAVED_COPY: Record<AiLocale, string> = {
  en: 'Review decision saved. Your draft has not been changed.',
  ar: 'تم حفظ قرار المراجعة. لم يتم تغيير مسودتك.',
};

const REVISION_READY_COPY: Record<AiLocale, string> = {
  en: 'A revised proposal is ready for your review. Your saved draft has not been changed.',
  ar: 'أصبح اقتراحًا مُراجعًا جاهزًا للمراجعة. لم يتم تغيير مسودتك المحفوظة.',
};

const APPLY_PREPARE_COPY: Record<AiLocale, string> = {
  en: 'Review the summary below, then confirm to update your draft.',
  ar: 'راجع الملخص أدناه، ثم أكّد لتحديث مسودتك.',
};

const textBlock = (text: string): AiContentBlock => ({
  type: 'text',
  text,
  purpose: 'answer',
});

const isProposalBlock = (
  block: AiContentBlock,
): block is AiProjectAuthoringProposalBlock =>
  block.type === 'project_authoring_proposal';

const isReviewStateBlock = (
  block: AiContentBlock,
): block is AiProjectAuthoringReviewStateBlock =>
  block.type === 'project_authoring_review_state';

const findProposalById = (
  messages: AiMessage[],
  proposalId: string,
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
      if (parsed.success && parsed.data.proposalId === proposalId) {
        return { block: parsed.data, assistantMessage: message };
      }
    }
  }

  return null;
};

const findLatestProposalForBasis = (
  messages: AiMessage[],
  baseUpdatedAt: string,
  clarificationMessageId: string,
): { block: AiProjectAuthoringProposalBlock; assistantMessage: AiMessage } | null => {
  let best: {
    block: AiProjectAuthoringProposalBlock;
    assistantMessage: AiMessage;
    version: number;
  } | null = null;

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
        !parsed.success ||
        parsed.data.baseUpdatedAt !== baseUpdatedAt ||
        parsed.data.clarificationMessageId !== clarificationMessageId
      ) {
        continue;
      }

      const version = parsed.data.version ?? 1;
      if (!best || version > best.version) {
        best = {
          block: parsed.data,
          assistantMessage: message,
          version,
        };
      }
    }
  }

  return best
    ? { block: best.block, assistantMessage: best.assistantMessage }
    : null;
};

const findLatestReviewStateForProposal = (
  messages: AiMessage[],
  proposalId: string,
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
      if (parsed.success && parsed.data.proposalId === proposalId) {
        return { block: parsed.data, assistantMessage: message };
      }
    }
  }

  return null;
};

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

const findClarificationBlock = (
  messages: AiMessage[],
  clarificationMessageId: string,
): AiProjectAuthoringClarificationBlock | null => {
  const message = messages.find((entry) => entry.id === clarificationMessageId);
  if (!message?.contentBlocks) {
    return null;
  }

  const blocks = parseStoredContentBlocks(message.contentBlocks);
  for (const block of blocks) {
    if (block.type !== 'project_authoring_clarification') {
      continue;
    }

    const parsed = aiProjectAuthoringClarificationBlockSchema.safeParse(block);
    if (parsed.success) {
      return parsed.data;
    }
  }

  return null;
};

const findInitialIdeaMessage = (messages: AiMessage[]) =>
  messages.find((message) => message.role === 'USER' && message.contentText?.trim());

const projectToDraftSnapshot = (
  project: NonNullable<
    Awaited<
      ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>
    >
  >,
): DraftProjectSnapshot => ({
  title: project.title,
  shortDescription: project.shortDescription,
  description: project.description,
  difficulty: project.difficulty,
  estimatedDurationMinutes: project.estimatedDurationMinutes,
  requiredComponents: (project.requiredComponents ?? []).map((component) => ({
    componentName: component.componentName,
    materialType: component.materialType,
    quantity: Number(component.quantity),
    unit: component.unit,
    componentRole: component.componentRole,
    isRequired: component.isRequired,
    canBeSubstituted: component.canBeSubstituted,
    searchKeywords: (Array.isArray(component.searchKeywords)
      ? component.searchKeywords
      : []
    ).filter((keyword): keyword is string => typeof keyword === 'string'),
    notes: component.notes,
  })),
  steps: (project.steps ?? []).map((step) => ({
    title: step.title,
    description: step.description,
  })),
});

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
    throw new AppError('Learning project submission not found', 404, 'NOT_FOUND');
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

const assertProposalCurrent = (input: {
  locale: AiLocale;
  projectUpdatedAt: string;
  proposal: AiProjectAuthoringProposalBlock;
  messages: AiMessage[];
}) => {
  if (input.projectUpdatedAt !== input.proposal.baseUpdatedAt) {
    throw new AppError(
      STALE_PROPOSAL_COPY[input.locale],
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }

  const latest = findLatestProposalForBasis(
    input.messages,
    input.proposal.baseUpdatedAt,
    input.proposal.clarificationMessageId,
  );

  if (!latest || latest.block.proposalId !== input.proposal.proposalId) {
    throw new AppError(
      STALE_PROPOSAL_COPY[input.locale],
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }
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

const mapAuthoringReviewTurnResponse = (input: {
  conversation: AiConversation;
  basisMessageId: string;
  assistantMessage: AiMessage;
  blocks: AiContentBlock[];
  locale: AiLocale;
  policyVersion?: string;
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
      input.policyVersion ??
      PROJECT_AUTHORING_REVIEW_POLICY_VERSION,
    scopeClassification:
      input.assistantMessage.scopeClassification ?? 'DOMAIN_KNOWLEDGE',
    latencyMs: input.assistantMessage.latencyMs ?? null,
    usage: {
      inputTokens: input.assistantMessage.inputTokens ?? null,
      outputTokens: input.assistantMessage.outputTokens ?? null,
    },
  },
});

const buildReviewBlocks = (
  assistantText: string,
  reviewState: AiProjectAuthoringReviewStateBlock,
): AiContentBlock[] => [textBlock(assistantText), reviewState];

const TARGET_DISCUSSION_LABEL: Record<
  AuthoringReviewTarget,
  Record<AiLocale, string>
> = {
  title: { en: 'the title', ar: 'العنوان' },
  shortDescription: { en: 'the summary', ar: 'الملخص' },
  description: { en: 'the description', ar: 'الوصف' },
  difficulty: { en: 'the difficulty', ar: 'مستوى الصعوبة' },
  estimatedMinutes: { en: 'the estimated duration', ar: 'المدة التقديرية' },
  components: { en: 'the required components', ar: 'المكوّنات المطلوبة' },
  steps: { en: 'the steps', ar: 'الخطوات' },
};

const buildDiscussionAssistantReply = (input: {
  locale: AiLocale;
  target: AuthoringReviewTarget;
  comment: string;
  decision: 'UNDER_DISCUSSION' | 'REVISION_REQUESTED';
  lockedTargets: AuthoringReviewTarget[];
}) => {
  const label = TARGET_DISCUSSION_LABEL[input.target][input.locale];
  const lockedTitle = input.lockedTargets.includes('title');
  const lockedNote =
    input.locale === 'ar'
      ? lockedTitle
        ? ' سيبقى العنوان المقبول دون تغيير.'
        : ''
      : lockedTitle
        ? ' Your accepted title will remain unchanged.'
        : '';

  if (input.decision === 'UNDER_DISCUSSION') {
    return input.locale === 'ar'
      ? `شكرًا. لتحديث ${label}، هل يمكنك توضيح التغيير المطلوب بشكل أدق؟`
      : `Thanks. To update ${label}, could you clarify the change you want?`;
  }

  return input.locale === 'ar'
    ? `فهمت طلبك بخصوص ${label}: «${input.comment.slice(0, 180)}». عندما تكون جاهزًا، أنشئ اقتراحًا مُراجعًا.${lockedNote}`
    : `I understood your request for ${label}: "${input.comment.slice(0, 180)}". When you're ready, generate a revised proposal.${lockedNote}`;
};

const mapDiscussTurnResponse = (input: {
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
      input.assistantMessage.policyVersion ??
      PROJECT_AUTHORING_REVIEW_POLICY_VERSION,
    scopeClassification:
      input.assistantMessage.scopeClassification ?? 'DOMAIN_KNOWLEDGE',
    latencyMs: input.assistantMessage.latencyMs ?? null,
    usage: {
      inputTokens: input.assistantMessage.inputTokens ?? null,
      outputTokens: input.assistantMessage.outputTokens ?? null,
    },
  },
});

const resolveCurrentReviewState = (
  messages: AiMessage[],
  proposal: AiProjectAuthoringProposalBlock,
) =>
  findLatestReviewStateForProposal(messages, proposal.proposalId)?.block ??
  defaultReviewState({
    proposalId: proposal.proposalId,
    baseUpdatedAt: proposal.baseUpdatedAt,
  });

const buildSectionSummary = (review: AiProjectAuthoringReviewStateBlock) => {
  const acceptedSections: string[] = [];
  const keptCurrentSections: string[] = [];

  const record = (
    target: string,
    decision: AuthoringReviewDecision,
  ) => {
    if (decision === 'ACCEPT_PROPOSAL') {
      acceptedSections.push(target);
    } else if (decision === 'KEEP_CURRENT') {
      keptCurrentSections.push(target);
    }
  };

  record('title', review.fieldDecisions.title);
  record('shortDescription', review.fieldDecisions.shortDescription);
  record('description', review.fieldDecisions.description);
  record('difficulty', review.fieldDecisions.difficulty);
  record('estimatedMinutes', review.fieldDecisions.estimatedMinutes);
  record('components', review.componentDecision);
  record('steps', review.stepDecision);

  return { acceptedSections, keptCurrentSections };
};

const buildApplyDisplaySummary = (input: {
  locale: AiLocale;
  merged: ReturnType<typeof buildMergedDraftInput>;
  acceptedSections: string[];
  keptCurrentSections: string[];
}) => {
  const acceptedLabel =
    input.locale === 'ar' ? 'سيتم استخدام الاقتراح' : 'Will use proposal';
  const keptLabel =
    input.locale === 'ar' ? 'سيبقى كما هو في المسودة' : 'Will keep current draft';

  const lines = [
    input.locale === 'ar'
      ? 'يحدّث هذا الإجراء مسودتك فقط.'
      : 'This updates your draft only.',
    `${acceptedLabel}: ${input.acceptedSections.join(', ') || '—'}`,
    `${keptLabel}: ${input.keptCurrentSections.join(', ') || '—'}`,
    input.locale === 'ar'
      ? `المكوّنات: ${input.merged.requiredComponents.length} · الخطوات: ${input.merged.steps.length}`
      : `Components: ${input.merged.requiredComponents.length} · Steps: ${input.merged.steps.length}`,
  ];

  return {
    title: input.merged.title,
    summary: lines.join('\n'),
  };
};

const mergedToFinalProjectPayload = (
  merged: ReturnType<typeof buildMergedDraftInput>,
) => ({
  title: merged.title,
  shortDescription: merged.shortDescription,
  description: merged.description,
  difficulty: merged.difficulty,
  ...(merged.estimatedDurationMinutes !== undefined
    ? { estimatedDurationMinutes: merged.estimatedDurationMinutes }
    : {}),
  requiredComponents: merged.requiredComponents.map((component) => ({
    componentName: component.name,
    materialType: component.materialType,
    quantity: component.quantity,
    unit: component.unit,
    componentRole: component.componentRole,
    isRequired: component.isRequired,
    canBeSubstituted: component.canBeSubstituted,
    searchKeywords: component.searchKeywords,
    notes: component.notes ?? null,
  })),
  steps: merged.steps,
});

const throwInvalidRevision = (locale: AiLocale) => {
  throw new AppError(
    INVALID_REVISION_COPY[locale],
    502,
    'AI_RESPONSE_INVALID',
  );
};

const produceAuthoringRevision = async (input: {
  locale: AiLocale;
  ideaText: string;
  categoryName: string;
  currentProposal: AiProjectAuthoringProposalBlock;
  draft: DraftProjectSnapshot;
  review: AiProjectAuthoringReviewStateBlock;
  clarificationSummary: string;
  recentAuthoringAnswers: string[];
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

  ensureRevisionProviderConfigured();

  const revisionContext = {
    locale: input.locale,
    ideaText: input.ideaText,
    categoryName: input.categoryName,
    currentProposal: input.currentProposal,
    draft: input.draft,
    review: input.review,
    clarificationSummary: input.clarificationSummary,
    recentAuthoringAnswers: input.recentAuthoringAnswers,
    repairAttempt: false,
    repairIssue: null,
    previousInvalidOutput: null,
  };

  const clarificationBlock: AiProjectAuthoringClarificationBlock = {
    type: 'project_authoring_clarification',
    status: 'READY_FOR_PROPOSAL',
    summary: input.clarificationSummary,
    knownFacts: [],
    assumptions: [],
    warnings: [],
    remainingTopics: 0,
    nextQuestion: null,
  };

  const qualityContext = {
    locale: input.locale,
    ideaText: input.ideaText,
    categoryName: input.categoryName,
    draftDifficulty: input.draft.difficulty,
    clarification: clarificationBlock,
    recentAuthoringAnswers: input.recentAuthoringAnswers,
  };

  const isRepairableFailure = (error: unknown) => {
    if (error instanceof AppError) {
      return error.code === 'AI_RESPONSE_INVALID';
    }
    return true;
  };

  let providerResult!: Awaited<ReturnType<typeof generateAuthoringProposalRevision>>;
  let usedRepair = false;

  try {
    providerResult = await generateAuthoringProposalRevision(revisionContext);
  } catch (error) {
    if (!isRepairableFailure(error) || usedRepair) {
      if (error instanceof AppError) {
        throw error;
      }
      throwInvalidRevision(input.locale);
    }

    usedRepair = true;
    try {
      providerResult = await generateAuthoringProposalRevision({
        ...revisionContext,
        repairAttempt: true,
        repairIssue: buildAuthoringProposalRepairIssue({
          schemaError:
            'Provider JSON was malformed or truncated. Return complete valid JSON.',
        }),
        previousInvalidOutput: null,
      });
    } catch (repairError) {
      if (repairError instanceof AppError) {
        throw repairError;
      }
      throwInvalidRevision(input.locale);
    }
  }

  let normalized = normalizeAuthoringProposalProviderPayload(providerResult.data);
  let quality = validateAuthoringProposalQuality(normalized, qualityContext);
  let lockedIssues = assertLockedProposalValues({
    parent: input.currentProposal,
    revised: normalized,
    review: input.review,
    draft: input.draft,
  });

  if ((!quality.ok || lockedIssues.length > 0) && !usedRepair) {
    usedRepair = true;
    try {
      providerResult = await generateAuthoringProposalRevision({
        ...revisionContext,
        repairAttempt: true,
        repairIssue: buildRevisionRepairIssue([
          ...(!quality.ok ? quality.issues : []),
          ...lockedIssues,
        ]),
        previousInvalidOutput: JSON.stringify(providerResult.data).slice(0, 1500),
      });
      normalized = normalizeAuthoringProposalProviderPayload(providerResult.data);
      quality = validateAuthoringProposalQuality(normalized, qualityContext);
      lockedIssues = assertLockedProposalValues({
        parent: input.currentProposal,
        revised: normalized,
        review: input.review,
        draft: input.draft,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throwInvalidRevision(input.locale);
    }
  }

  if (!quality.ok || lockedIssues.length > 0) {
    throwInvalidRevision(input.locale);
  }

  const parentVersion = input.currentProposal.version ?? 1;
  const categoryDisplayName = input.currentProposal.categoryDisplayName;
  const stamped = stampAuthoringProposalBlock({
    proposalId: randomUUID(),
    baseUpdatedAt: input.currentProposal.baseUpdatedAt,
    clarificationMessageId: input.currentProposal.clarificationMessageId,
    categoryDisplayName,
    providerPayload: {
      ...normalized,
      warnings: [
        ...normalized.warnings,
        ...(quality.ok ? quality.warnings : []),
      ],
    },
    extraWarnings: [],
  });

  const proposalBlock = aiProjectAuthoringProposalBlockSchema.parse({
    ...stamped,
    version: parentVersion + 1,
    parentProposalId: input.currentProposal.proposalId,
    revisionReviewStateId: input.review.reviewStateId,
  });

  const assistantText =
    providerResult.data.assistantText.trim() || REVISION_READY_COPY[input.locale];

  return {
    proposalBlock,
    assistantText,
    provider: providerResult.provider,
    model: providerResult.model,
    latencyMs: providerResult.latencyMs,
    inputTokens: providerResult.usage.inputTokens,
    outputTokens: providerResult.usage.outputTokens,
  };
};

export const submitProjectAuthoringProposalReviewForUser = async (
  userId: string,
  conversationId: string,
  proposalId: string,
  body: SubmitProjectAuthoringProposalReviewBody,
): Promise<AiTurnResponse> => {
  const ownedConversation = await findOwnedConversation({
    conversationId,
    userId,
  });

  if (!ownedConversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }

  const { project } = await assertAuthoringConversation(ownedConversation, userId);
  const locale = (ownedConversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;
  const baseUpdatedAt = project.updatedAt.toISOString();

  const messages = await loadRecentConversationMessages({
    conversationId: ownedConversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });

  const proposalState = findProposalById(messages, proposalId);
  if (!proposalState) {
    throw new AppError(
      PROPOSAL_NOT_FOUND_COPY[locale],
      404,
      'AI_AUTHORING_PROPOSAL_NOT_FOUND',
    );
  }

  assertProposalCurrent({
    locale,
    projectUpdatedAt: baseUpdatedAt,
    proposal: proposalState.block,
    messages,
  });

  const currentReview = resolveCurrentReviewState(messages, proposalState.block);
  if (currentReview.status === 'APPLIED') {
    throw new AppError(
      'This proposal review has already been applied.',
      409,
      'AI_AUTHORING_REVIEW_NOT_READY',
    );
  }

  const previousFingerprint = reviewStateFingerprint(currentReview);
  let nextReview: AiProjectAuthoringReviewStateBlock;

  try {
    nextReview = applyReviewDecision({
      state: currentReview,
      target: body.target,
      decision: body.decision,
      comment: body.comment,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'revision_comment_required'
    ) {
      throw new AppError(
        locale === 'ar'
          ? 'أضف تعليقًا مفيدًا عند طلب التعديل.'
          : 'A useful comment is required when requesting revision.',
        400,
        'VALIDATION_ERROR',
      );
    }
    throw error;
  }

  const nextFingerprint = reviewStateFingerprint(nextReview);
  if (previousFingerprint === nextFingerprint) {
    const existingState = findLatestReviewStateForProposal(
      messages,
      proposalState.block.proposalId,
    );
    if (existingState) {
      return mapAuthoringReviewTurnResponse({
        conversation: ownedConversation,
        basisMessageId: proposalState.assistantMessage.inReplyToMessageId ?? proposalState.assistantMessage.id,
        assistantMessage: existingState.assistantMessage,
        blocks: parseStoredContentBlocks(existingState.assistantMessage.contentBlocks),
        locale,
      });
    }
  }

  await acquireAuthoringLock(ownedConversation.id);

  try {
    const refreshedMessages = await loadRecentConversationMessages({
      conversationId: ownedConversation.id,
      limit: env.aiChatMaxHistoryMessages,
    });
    const refreshedProject =
      await learningProjectsRepository.findMyLearningProjectSubmissionById(
        ownedConversation.learningProjectId!,
        userId,
      );
    if (!refreshedProject || refreshedProject.status !== 'DRAFT') {
      throw new AppError(
        'Project authoring is only available for draft submissions.',
        409,
        'LEARNING_PROJECT_NOT_EDITABLE',
      );
    }

    const refreshedProposal = findProposalById(refreshedMessages, proposalId);
    if (!refreshedProposal) {
      throw new AppError(
        PROPOSAL_NOT_FOUND_COPY[locale],
        404,
        'AI_AUTHORING_PROPOSAL_NOT_FOUND',
      );
    }

    assertProposalCurrent({
      locale,
      projectUpdatedAt: refreshedProject.updatedAt.toISOString(),
      proposal: refreshedProposal.block,
      messages: refreshedMessages,
    });

    const refreshedCurrent = resolveCurrentReviewState(
      refreshedMessages,
      refreshedProposal.block,
    );
    const refreshedPreviousFingerprint = reviewStateFingerprint(refreshedCurrent);
    let refreshedNext: AiProjectAuthoringReviewStateBlock;
    try {
      refreshedNext = applyReviewDecision({
        state: refreshedCurrent,
        target: body.target,
        decision: body.decision,
        comment: body.comment,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'revision_comment_required'
      ) {
        throw new AppError(
          locale === 'ar'
            ? 'أضف تعليقًا مفيدًا عند طلب التعديل.'
            : 'A useful comment is required when requesting revision.',
          400,
          'VALIDATION_ERROR',
        );
      }
      throw error;
    }
    const refreshedNextFingerprint = reviewStateFingerprint(refreshedNext);

    if (refreshedPreviousFingerprint === refreshedNextFingerprint) {
      const existingState = findLatestReviewStateForProposal(
        refreshedMessages,
        refreshedProposal.block.proposalId,
      );
      if (existingState) {
        return mapAuthoringReviewTurnResponse({
          conversation: ownedConversation,
          basisMessageId:
            refreshedProposal.assistantMessage.inReplyToMessageId ??
            refreshedProposal.assistantMessage.id,
          assistantMessage: existingState.assistantMessage,
          blocks: parseStoredContentBlocks(existingState.assistantMessage.contentBlocks),
          locale,
        });
      }
    }

    const blocks = buildReviewBlocks(REVIEW_SAVED_COPY[locale], refreshedNext);
    const assistantMessage = await createAssistantMessage({
      conversationId: ownedConversation.id,
      inReplyToMessageId: refreshedProposal.assistantMessage.id,
      status: 'COMPLETED',
      contentBlocks: blocks,
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      locale,
      provider: 'system',
      model: null,
      policyVersion: PROJECT_AUTHORING_REVIEW_POLICY_VERSION,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
    });

    await touchConversationActivity({
      conversationId: ownedConversation.id,
      locale,
      title: refreshedProject.title,
    });

    return mapAuthoringReviewTurnResponse({
      conversation: ownedConversation,
      basisMessageId:
        refreshedProposal.assistantMessage.inReplyToMessageId ??
        refreshedProposal.assistantMessage.id,
      assistantMessage,
      blocks,
      locale,
    });
  } catch (error) {
    logger.warn(
      {
        err: error instanceof Error ? error.message : String(error),
        conversationId: ownedConversation.id,
        proposalId,
      },
      'Project authoring review decision failed',
    );
    throw error;
  } finally {
    await releaseConversationProcessingLock(ownedConversation.id);
  }
};

export const submitProjectAuthoringDiscussionForUser = async (
  userId: string,
  conversationId: string,
  proposalId: string,
  body: SubmitProjectAuthoringDiscussionBody,
): Promise<AiTurnResponse> => {
  const ownedConversation = await findOwnedConversation({
    conversationId,
    userId,
  });

  if (!ownedConversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }

  const { project } = await assertAuthoringConversation(ownedConversation, userId);
  const locale = (ownedConversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;

  const messages = await loadRecentConversationMessages({
    conversationId: ownedConversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });

  const proposalState = findProposalById(messages, proposalId);
  if (!proposalState) {
    throw new AppError(
      PROPOSAL_NOT_FOUND_COPY[locale],
      404,
      'AI_AUTHORING_PROPOSAL_NOT_FOUND',
    );
  }

  assertProposalCurrent({
    locale,
    projectUpdatedAt: project.updatedAt.toISOString(),
    proposal: proposalState.block,
    messages,
  });

  const currentReview = resolveCurrentReviewState(messages, proposalState.block);
  if (
    currentReview.reviewStateId !== body.reviewStateId ||
    currentReview.status === 'APPLIED'
  ) {
    throw new AppError(
      REVIEW_NOT_FOUND_COPY[locale],
      404,
      'AI_AUTHORING_REVIEW_NOT_FOUND',
    );
  }

  await acquireAuthoringLock(ownedConversation.id);

  try {
    let nextReview: AiProjectAuthoringReviewStateBlock;
    try {
      nextReview = applyDiscussionComment({
        state: currentReview,
        target: body.target,
        comment: body.comment,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'revision_comment_required'
      ) {
        throw new AppError(
          locale === 'ar'
            ? 'أضف تعليقًا أوضح يصف التغيير المطلوب.'
            : 'Add a clearer comment describing the change you want.',
          400,
          'VALIDATION_ERROR',
        );
      }
      throw error;
    }

    const discussionContext = aiProjectAuthoringDiscussionContextBlockSchema.parse({
      type: 'project_authoring_discussion_context',
      target: body.target,
      proposalId: proposalState.block.proposalId,
      reviewStateId: nextReview.reviewStateId,
    });

    const userMessage = await createUserMessage({
      conversationId: ownedConversation.id,
      contentText: body.comment.trim(),
      clientMessageId: body.clientMessageId,
      locale,
      contentBlocks: [discussionContext],
    });

    const targetDecision =
      (AUTHORING_REVIEW_FIELD_TARGETS as readonly string[]).includes(body.target)
        ? nextReview.fieldDecisions[
            body.target as (typeof AUTHORING_REVIEW_FIELD_TARGETS)[number]
          ]
        : body.target === 'components'
          ? nextReview.componentDecision
          : nextReview.stepDecision;

    const assistantText = buildDiscussionAssistantReply({
      locale,
      target: body.target,
      comment: body.comment.trim(),
      decision:
        targetDecision === 'UNDER_DISCUSSION'
          ? 'UNDER_DISCUSSION'
          : 'REVISION_REQUESTED',
      lockedTargets: nextReview.lockedTargets,
    });

    const assistantBlocks: AiContentBlock[] = [
      textBlock(assistantText),
      nextReview,
    ];

    const assistantMessage = await createAssistantMessage({
      conversationId: ownedConversation.id,
      inReplyToMessageId: userMessage.id,
      status: 'COMPLETED',
      contentBlocks: assistantBlocks,
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      locale,
      provider: 'system',
      model: null,
      policyVersion: PROJECT_AUTHORING_REVIEW_POLICY_VERSION,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
    });

    await touchConversationActivity({
      conversationId: ownedConversation.id,
      locale,
      title: project.title,
    });

    return mapDiscussTurnResponse({
      conversation: ownedConversation,
      userMessage,
      assistantMessage,
      blocks: assistantBlocks,
      locale,
    });
  } finally {
    await releaseConversationProcessingLock(ownedConversation.id);
  }
};

export const reviseProjectAuthoringProposalForUser = async (
  userId: string,
  conversationId: string,
  proposalId: string,
  body: ReviseProjectAuthoringProposalBody,
): Promise<AiTurnResponse> => {
  const ownedConversation = await findOwnedConversation({
    conversationId,
    userId,
  });

  if (!ownedConversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }

  const { project } = await assertAuthoringConversation(ownedConversation, userId);
  const locale = (ownedConversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;

  const messages = await loadRecentConversationMessages({
    conversationId: ownedConversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });

  const proposalState = findProposalById(messages, proposalId);
  if (!proposalState) {
    throw new AppError(
      PROPOSAL_NOT_FOUND_COPY[locale],
      404,
      'AI_AUTHORING_PROPOSAL_NOT_FOUND',
    );
  }

  assertProposalCurrent({
    locale,
    projectUpdatedAt: project.updatedAt.toISOString(),
    proposal: proposalState.block,
    messages,
  });

  const reviewState = findReviewStateById(messages, body.reviewStateId);
  if (!reviewState || reviewState.block.proposalId !== proposalId) {
    throw new AppError(
      REVIEW_NOT_FOUND_COPY[locale],
      404,
      'AI_AUTHORING_REVIEW_NOT_FOUND',
    );
  }

  const latestReview = findLatestReviewStateForProposal(messages, proposalId);
  if (
    !latestReview ||
    latestReview.block.reviewStateId !== reviewState.block.reviewStateId
  ) {
    throw new AppError(
      STALE_PROPOSAL_COPY[locale],
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }

  const openRevisionTargets = reviewState.block.revisionRequests.filter(
    (entry) => entry.status === 'OPEN',
  );
  const hasNeedsRevision =
    Object.values(reviewState.block.fieldDecisions).some(
      (decision) => decision === 'NEEDS_REVISION',
    ) ||
    reviewState.block.componentDecision === 'NEEDS_REVISION' ||
    reviewState.block.stepDecision === 'NEEDS_REVISION';

  if (!hasNeedsRevision || openRevisionTargets.length === 0) {
    throw new AppError(
      REVISION_NOT_READY_COPY[locale],
      409,
      'AI_AUTHORING_REVISION_NOT_READY',
    );
  }

  const ideaMessage = findInitialIdeaMessage(messages);
  if (!ideaMessage?.contentText?.trim()) {
    throw new AppError(
      'Authoring idea message is missing.',
      409,
      'AI_AUTHORING_IDEA_MISSING',
    );
  }

  const clarification = findClarificationBlock(
    messages,
    proposalState.block.clarificationMessageId,
  );
  const categoryDisplayName = proposalState.block.categoryDisplayName;
  const recentAuthoringAnswers = messages
    .filter(
      (message) =>
        message.role === 'USER' &&
        message.id !== ideaMessage.id &&
        message.contentText?.trim(),
    )
    .slice(-6)
    .map((message) => message.contentText!.trim());

  await acquireAuthoringLock(ownedConversation.id);

  try {
    const refreshedMessages = await loadRecentConversationMessages({
      conversationId: ownedConversation.id,
      limit: env.aiChatMaxHistoryMessages,
    });
    const refreshedProject =
      await learningProjectsRepository.findMyLearningProjectSubmissionById(
        ownedConversation.learningProjectId!,
        userId,
      );
    if (!refreshedProject || refreshedProject.status !== 'DRAFT') {
      throw new AppError(
        'Project authoring is only available for draft submissions.',
        409,
        'LEARNING_PROJECT_NOT_EDITABLE',
      );
    }

    const refreshedProposal = findProposalById(refreshedMessages, proposalId);
    if (!refreshedProposal) {
      throw new AppError(
        PROPOSAL_NOT_FOUND_COPY[locale],
        404,
        'AI_AUTHORING_PROPOSAL_NOT_FOUND',
      );
    }

    assertProposalCurrent({
      locale,
      projectUpdatedAt: refreshedProject.updatedAt.toISOString(),
      proposal: refreshedProposal.block,
      messages: refreshedMessages,
    });

    const refreshedReview = findReviewStateById(
      refreshedMessages,
      body.reviewStateId,
    );
    if (!refreshedReview || refreshedReview.block.proposalId !== proposalId) {
      throw new AppError(
        REVIEW_NOT_FOUND_COPY[locale],
        404,
        'AI_AUTHORING_REVIEW_NOT_FOUND',
      );
    }

    const refreshedLatestReview = findLatestReviewStateForProposal(
      refreshedMessages,
      proposalId,
    );
    if (
      !refreshedLatestReview ||
      refreshedLatestReview.block.reviewStateId !== body.reviewStateId
    ) {
      throw new AppError(
        STALE_PROPOSAL_COPY[locale],
        409,
        'AI_AUTHORING_PROPOSAL_STALE',
      );
    }

    const produced = await produceAuthoringRevision({
      locale,
      ideaText: ideaMessage.contentText.trim(),
      categoryName: categoryDisplayName,
      currentProposal: refreshedProposal.block,
      draft: projectToDraftSnapshot(refreshedProject),
      review: refreshedReview.block,
      clarificationSummary: clarification?.summary ?? '',
      recentAuthoringAnswers,
    });

    const diffBlock = deriveProposalDiff({
      from: refreshedProposal.block,
      to: produced.proposalBlock,
    });
    const carriedReview = carryForwardReviewAfterRevision({
      previous: refreshedReview.block,
      newProposalId: produced.proposalBlock.proposalId,
      revisedTargets: diffBlock.changedTargets,
    });

    const blocks: AiContentBlock[] = [
      textBlock(produced.assistantText),
      produced.proposalBlock,
      diffBlock,
      carriedReview,
    ];

    const assistantMessage = await createAssistantMessage({
      conversationId: ownedConversation.id,
      inReplyToMessageId: refreshedProposal.assistantMessage.id,
      status: 'COMPLETED',
      contentBlocks: blocks,
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      locale,
      provider: produced.provider,
      model: produced.model,
      policyVersion: PROJECT_AUTHORING_PROPOSAL_POLICY_VERSION,
      latencyMs: produced.latencyMs,
      inputTokens: produced.inputTokens,
      outputTokens: produced.outputTokens,
    });

    await touchConversationActivity({
      conversationId: ownedConversation.id,
      locale,
      title: refreshedProject.title,
    });

    return mapAuthoringReviewTurnResponse({
      conversation: ownedConversation,
      basisMessageId:
        refreshedProposal.assistantMessage.inReplyToMessageId ??
        refreshedProposal.assistantMessage.id,
      assistantMessage,
      blocks,
      locale,
      policyVersion: PROJECT_AUTHORING_PROPOSAL_POLICY_VERSION,
    });
  } catch (error) {
    logger.warn(
      {
        err: error instanceof Error ? error.message : String(error),
        conversationId: ownedConversation.id,
        proposalId,
        reviewStateId: body.reviewStateId,
      },
      'Project authoring proposal revision failed',
    );
    throw error;
  } finally {
    await releaseConversationProcessingLock(ownedConversation.id);
  }
};

export const prepareApplyReviewedAuthoringProposalForUser = async (
  userId: string,
  conversationId: string,
  reviewStateId: string,
): Promise<AiTurnResponse> => {
  const ownedConversation = await findOwnedConversation({
    conversationId,
    userId,
  });

  if (!ownedConversation) {
    throw new AppError('Conversation not found.', 404, 'AI_CONVERSATION_NOT_FOUND');
  }

  const { project } = await assertAuthoringConversation(ownedConversation, userId);
  const locale = (ownedConversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;

  const messages = await loadRecentConversationMessages({
    conversationId: ownedConversation.id,
    limit: env.aiChatMaxHistoryMessages,
  });

  const reviewState = findReviewStateById(messages, reviewStateId);
  if (!reviewState) {
    throw new AppError(
      REVIEW_NOT_FOUND_COPY[locale],
      404,
      'AI_AUTHORING_REVIEW_NOT_FOUND',
    );
  }

  if (reviewState.block.status !== 'READY_TO_APPLY') {
    throw new AppError(
      REVIEW_NOT_READY_COPY[locale],
      409,
      'AI_AUTHORING_REVIEW_NOT_READY',
    );
  }

  const proposalState = findProposalById(messages, reviewState.block.proposalId);
  if (!proposalState) {
    throw new AppError(
      PROPOSAL_NOT_FOUND_COPY[locale],
      404,
      'AI_AUTHORING_PROPOSAL_NOT_FOUND',
    );
  }

  assertProposalCurrent({
    locale,
    projectUpdatedAt: project.updatedAt.toISOString(),
    proposal: proposalState.block,
    messages,
  });

  const latestReview = findLatestReviewStateForProposal(
    messages,
    reviewState.block.proposalId,
  );
  if (
    !latestReview ||
    latestReview.block.reviewStateId !== reviewState.block.reviewStateId
  ) {
    throw new AppError(
      STALE_PROPOSAL_COPY[locale],
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }

  const draft = projectToDraftSnapshot(project);
  const ideaMessage = findInitialIdeaMessage(messages);
  const clarification = findClarificationBlock(
    messages,
    proposalState.block.clarificationMessageId,
  );

  let merged: ReturnType<typeof buildMergedDraftInput>;
  try {
    merged = buildMergedDraftInput({
      review: reviewState.block,
      proposal: proposalState.block,
      draft,
    });
  } catch {
    throw new AppError(
      REVIEW_NOT_READY_COPY[locale],
      409,
      'AI_AUTHORING_REVIEW_NOT_READY',
    );
  }

  const validationIssues = validateFinalMergedProject({
    merged,
    review: reviewState.block,
    proposal: proposalState.block,
    draft,
    locale,
    ideaText: ideaMessage?.contentText?.trim() ?? '',
    categoryName: proposalState.block.categoryDisplayName,
    clarificationSummary: clarification?.summary ?? '',
  });

  if (validationIssues.length > 0) {
    throw new AppError(
      FINAL_INVALID_COPY[locale],
      409,
      'AI_AUTHORING_FINAL_INVALID',
      validationIssues,
    );
  }

  const { acceptedSections, keptCurrentSections } = buildSectionSummary(
    reviewState.block,
  );
  const displaySnapshot = buildApplyDisplaySummary({
    locale,
    merged,
    acceptedSections,
    keptCurrentSections,
  });

  const payload = applyProjectAuthoringProposalPayloadSchema.parse({
    schemaVersion: 1,
    actionType: 'APPLY_PROJECT_AUTHORING_PROPOSAL',
    target: { projectId: project.id },
    parameters: {
      conversationId: ownedConversation.id,
      proposalId: proposalState.block.proposalId,
      reviewStateId: reviewState.block.reviewStateId,
      expectedUpdatedAt: project.updatedAt.toISOString(),
      acceptedSections,
      keptCurrentSections,
      finalProject: mergedToFinalProjectPayload(merged),
    },
    displaySnapshot,
  }) satisfies ApplyProjectAuthoringProposalPayload;

  const prepared = await prepareAiPendingAction({
    userId,
    conversationId: ownedConversation.id,
    actionType: 'APPLY_PROJECT_AUTHORING_PROPOSAL' as AiPendingActionType,
    payload: payload as unknown as VersionedActionPayload,
    idempotencyKey: `authoring-apply:${reviewStateId}`,
    locale,
  });

  const confirmationBlock = customizeActionConfirmationLabels(prepared.block, {
    confirmLabel: locale === 'ar' ? 'تأكيد وتطبيق' : 'Confirm and apply',
    cancelLabel: locale === 'ar' ? 'إلغاء' : 'Cancel',
  });

  const blocks: AiContentBlock[] = [
    textBlock(APPLY_PREPARE_COPY[locale]),
    confirmationBlock,
  ];

  const assistantMessage = await createAssistantMessage({
    conversationId: ownedConversation.id,
    inReplyToMessageId: reviewState.assistantMessage.id,
    status: 'COMPLETED',
    contentBlocks: blocks,
    scopeClassification: 'DOMAIN_KNOWLEDGE',
    locale,
    provider: 'system',
    model: null,
    policyVersion: PROJECT_AUTHORING_REVIEW_POLICY_VERSION,
    latencyMs: 0,
    inputTokens: null,
    outputTokens: null,
  });

  await touchConversationActivity({
    conversationId: ownedConversation.id,
    locale,
    title: project.title,
  });

  return mapAuthoringReviewTurnResponse({
    conversation: ownedConversation,
    basisMessageId:
      proposalState.assistantMessage.inReplyToMessageId ??
      proposalState.assistantMessage.id,
    assistantMessage,
    blocks,
    locale,
  });
};

export const findLatestProposalForBasisForTests = findLatestProposalForBasis;
export const findLatestReviewStateForTests = findLatestReviewStateForProposal;

const APPLIED_COPY: Record<AiLocale, string> = {
  en: 'Reviewed proposal applied to your draft.',
  ar: 'تم تطبيق الاقتراح المراجع على مسودتك.',
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
